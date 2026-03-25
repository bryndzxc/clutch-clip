<?php

namespace App\Jobs;

use App\Models\Video;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Process;

class ProbeVideoJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $timeout = 60;
    public int $tries   = 2;

    /**
     * Video codecs that ffmpeg can reliably decode and transcode to H.264.
     * Anything outside this list gets rejected with a clear message before
     * analysis starts.  Add entries here if a legitimate format is refused.
     */
    private const SUPPORTED_VIDEO_CODECS = [
        // H.264 / H.265 — most common gaming recordings
        'h264', 'hevc',
        // VP8 / VP9 / AV1 — WebM (OBS, Chrome, modern encoders)
        'vp8', 'vp9', 'av1',
        // MPEG-4 Part 2 — older AVI / MP4 (Fraps, old Bandicam)
        'mpeg4', 'msmpeg4v3', 'msmpeg4v2', 'msmpeg4',
        // MPEG-1 / MPEG-2 — very old, but ffmpeg handles them fine
        'mpeg1video', 'mpeg2video',
        // WMV — Windows Screen Recorder / Windows Media Player captures
        'wmv1', 'wmv2', 'wmv3', 'wmv3image', 'vc1',
        // ProRes — macOS / Final Cut exports
        'prores', 'prores_ks',
        // MJPEG — action cams, some screen recorders, webcam DVRs
        'mjpeg',
        // Lossless — OBS lossless mode (HuffYUV, Ut Video, FFV1)
        'huffyuv', 'ffvhuff', 'utvideo', 'ffv1',
        // Theora — older open-source WebM alternative
        'theora',
        // FLV1 — legacy Flash recordings
        'flv1',
        // DV — camcorder captures
        'dvvideo',
    ];

    public function __construct(public int $videoId)
    {
    }

    public function handle(): void
    {
        $video = Video::findOrFail($this->videoId);
        $video->update(['status' => 'probing']);

        $absPath = $video->getTempVideoPath();

        if (!$absPath || !file_exists($absPath)) {
            Log::error("[ProbeVideoJob] Video #{$video->id}: source file not found at {$absPath}");
            $this->failVideo($video, 'Source file missing before probe.');
            return;
        }

        // ── Run ffprobe ───────────────────────────────────────────────────────
        // Include -show_streams so we can validate the video stream and codec.

        $result = Process::run([
            'ffprobe', '-v', 'quiet',
            '-print_format', 'json',
            '-show_format',
            '-show_streams',
            $absPath,
        ]);

        // ffprobe failure = unreadable container or corrupt file.
        // Do NOT fall through to analysis — delete the temp file and fail fast.
        if (!$result->successful()) {
            Log::warning("[ProbeVideoJob] Video #{$video->id}: ffprobe failed — " . trim($result->errorOutput()));
            $video->deleteTempFile();
            $this->failVideo(
                $video,
                'The video file could not be read. It may be corrupt, truncated, or in an unsupported container format.'
            );
            return;
        }

        $meta    = json_decode($result->output(), true) ?? [];
        $streams = $meta['streams'] ?? [];
        $format  = $meta['format']  ?? [];

        // ── Validate: video stream must exist ─────────────────────────────────

        $videoStream = $this->findVideoStream($streams);

        if (!$videoStream) {
            Log::warning("[ProbeVideoJob] Video #{$video->id}: no video stream in file.");
            $video->deleteTempFile();
            $this->failVideo($video, 'No video stream was found in the uploaded file. Please upload a video file (not audio-only).');
            return;
        }

        // ── Validate: codec must be in the supported list ─────────────────────

        $codec = strtolower($videoStream['codec_name'] ?? '');

        if (!$this->isCodecSupported($codec)) {
            $label = $codec ?: 'unknown';
            Log::warning("[ProbeVideoJob] Video #{$video->id}: unsupported codec '{$label}'.");
            $video->deleteTempFile();
            $this->failVideo(
                $video,
                "The video codec '{$label}' is not supported. Please re-encode to H.264, H.265, VP9, or AV1 before uploading."
            );
            return;
        }

        // ── Validate: video must have positive dimensions ─────────────────────

        $width  = (int) ($videoStream['width']  ?? 0);
        $height = (int) ($videoStream['height'] ?? 0);

        if ($width <= 0 || $height <= 0) {
            Log::warning("[ProbeVideoJob] Video #{$video->id}: invalid dimensions {$width}x{$height} (codec={$codec}).");
            $video->deleteTempFile();
            $this->failVideo($video, 'The video has invalid or unreadable dimensions and cannot be processed.');
            return;
        }

        // ── Validate: duration limit ──────────────────────────────────────────

        $duration   = isset($format['duration']) ? (float) $format['duration'] : null;
        $maxSeconds = config('clutchclip.upload.max_duration_minutes', 60) * 60;

        if ($duration !== null && $duration > $maxSeconds) {
            $maxMin = config('clutchclip.upload.max_duration_minutes', 60);
            Log::info("[ProbeVideoJob] Video #{$video->id}: duration {$duration}s exceeds {$maxSeconds}s limit.");
            $video->deleteTempFile();
            $this->failVideo($video, "Video exceeds the maximum allowed duration of {$maxMin} minutes.");
            return;
        }

        // ── All checks passed — hand off to analysis ──────────────────────────

        Log::info(sprintf(
            '[ProbeVideoJob] Video #%d validated: codec=%s, %dx%d, duration=%ss.',
            $video->id,
            $codec,
            $width,
            $height,
            $duration ?? 'unknown'
        ));

        $video->update([
            'duration' => $duration,
            'status'   => 'preparing_analysis_assets',
        ]);

        PrepareAnalysisAssetsJob::dispatch($video->id);
    }

    public function failed(\Throwable $e): void
    {
        Log::error("[ProbeVideoJob] Job exception for Video #{$this->videoId}: " . $e->getMessage());

        Video::find($this->videoId)?->update([
            'status'        => 'failed',
            'error_message' => 'Probe job failed: ' . substr($e->getMessage(), 0, 500),
            'failed_at'     => now(),
        ]);
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    /** Return the first stream with codec_type == 'video', or null. */
    private function findVideoStream(array $streams): ?array
    {
        foreach ($streams as $stream) {
            if (($stream['codec_type'] ?? '') === 'video') {
                return $stream;
            }
        }

        return null;
    }

    /** Return true if $codec is in the supported list. */
    private function isCodecSupported(string $codec): bool
    {
        return $codec !== '' && in_array($codec, self::SUPPORTED_VIDEO_CODECS, true);
    }

    /** Mark the video failed with a user-facing message. */
    private function failVideo(Video $video, string $message): void
    {
        $video->update([
            'status'        => 'failed',
            'error_message' => $message,
            'failed_at'     => now(),
        ]);
    }
}
