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

        // ── Pass 1: Low-res silent analysis video ─────────────────────────────
        // 640px wide, ultrafast encode — only used for OpenCV frame diffs.
        // -an: no audio stream needed in the analysis video.
        if (!$this->runFfmpeg([
            '-y', '-i', $source,
            '-vf', 'scale=640:-2',
            '-c:v', 'libx264', '-crf', '28', '-preset', 'ultrafast',
            '-an',
            $analysisVideo,
        ])) {
            $this->failVideo($video, 'FFmpeg failed to generate analysis video.');
            return;
        }

        // ── Pass 2: Mono 16 kHz WAV for audio RMS scoring ─────────────────────
        // -vn: no video needed in the audio pass.
        if (!$this->runFfmpeg([
            '-y', '-i', $source,
            '-vn',
            '-ac', '1',
            '-ar', '16000',
            '-acodec', 'pcm_s16le',
            $analysisAudio,
        ])) {
            // Non-fatal: audio extraction can fail for silent videos.
            // DetectHighlightsJob will use motion-only mode.
            Log::warning("[PrepareAnalysisAssetsJob] Video #{$video->id}: audio extraction failed — continuing without audio.");
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
