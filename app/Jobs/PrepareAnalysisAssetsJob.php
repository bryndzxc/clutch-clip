<?php

namespace App\Jobs;

use App\Models\Video;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class PrepareAnalysisAssetsJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $timeout = 300; // 5 min — two fast FFmpeg passes
    public int $tries   = 2;

    public function __construct(public int $videoId)
    {
    }

    public function handle(): void
    {
        $video = Video::findOrFail($this->videoId);
        $video->update(['status' => 'preparing_analysis_assets']);

        $source = $video->getTempVideoPath();

        if (!$source || !file_exists($source)) {
            $this->failVideo($video, 'Source file missing before analysis asset preparation.');
            return;
        }

        $analysisDir = storage_path("app/temp/analysis/{$video->id}");
        @mkdir($analysisDir, 0755, true);

        $analysisVideo = "{$analysisDir}/analysis.mp4";
        $analysisAudio = "{$analysisDir}/audio.wav";

        // ── Single-pass: produce both outputs in one FFmpeg invocation ────────
        // Reading the source once halves disk I/O vs two sequential passes.
        //
        // Output 1: 640px silent analysis video for OpenCV frame diffs.
        //   -map 0:v:0  — explicit video stream mapping
        //   -an         — no audio in this output
        //
        // Output 2: mono 16 kHz WAV for audio RMS scoring.
        //   -map 0:a:0? — optional audio mapping; '?' makes it non-fatal when
        //                 the source has no audio stream (silent gameplay captures).
        //   -vn         — no video in this output
        //
        // We do NOT rely solely on the exit code to determine audio success —
        // file_exists() is the authoritative check, because FFmpeg may exit 0
        // even when the optional audio stream was absent and the WAV was skipped.
        $this->runFfmpeg([
            '-y', '-i', $source,
            // Output 1: low-res silent analysis video
            '-map', '0:v:0',
            '-vf', 'scale=640:-2',
            '-c:v', 'libx264', '-crf', '35', '-preset', 'ultrafast',
            '-an',
            $analysisVideo,
            // Output 2: mono 16 kHz WAV (optional — skipped if no audio stream)
            '-map', '0:a:0?',
            '-vn', '-ac', '1', '-ar', '16000', '-acodec', 'pcm_s16le',
            $analysisAudio,
        ]);

        if (!file_exists($analysisVideo)) {
            $this->failVideo($video, 'FFmpeg failed to generate analysis video.');
            return;
        }

        if (!file_exists($analysisAudio)) {
            // Non-fatal: silent videos produce no WAV. DetectHighlightsJob falls back to motion-only mode.
            Log::warning("[PrepareAnalysisAssetsJob] Video #{$video->id}: audio extraction yielded no file — continuing without audio.");
            $analysisAudio = null;
        }

        $video->update([
            'analysis_video_path' => "temp/analysis/{$video->id}/analysis.mp4",
            'analysis_audio_path' => $analysisAudio ? "temp/analysis/{$video->id}/audio.wav" : null,
            'status'              => 'detecting_highlights',
        ]);

        Log::info("[PrepareAnalysisAssetsJob] Video #{$video->id}: analysis assets ready. Dispatching DetectHighlightsJob.");

        DetectHighlightsJob::dispatch($video->id);
    }

    private function runFfmpeg(array $args): bool
    {
        $cmd = array_merge(['ffmpeg'], $args);
        exec(implode(' ', array_map('escapeshellarg', $cmd)) . ' 2>&1', $out, $code);

        if ($code !== 0) {
            Log::error("[PrepareAnalysisAssetsJob] FFmpeg failed (exit {$code}): " . implode("\n", $out));
            return false;
        }

        return true;
    }

    private function failVideo(Video $video, string $message): void
    {
        Log::error("[PrepareAnalysisAssetsJob] Video #{$video->id}: {$message}");
        $video->update([
            'status'        => 'failed',
            'error_message' => $message,
            'failed_at'     => now(),
        ]);
    }

    public function failed(\Throwable $e): void
    {
        Log::error("[PrepareAnalysisAssetsJob] Job exception for Video #{$this->videoId}: " . $e->getMessage());

        Video::find($this->videoId)?->update([
            'status'        => 'failed',
            'error_message' => 'Analysis preparation failed: ' . substr($e->getMessage(), 0, 500),
            'failed_at'     => now(),
        ]);
    }
}
