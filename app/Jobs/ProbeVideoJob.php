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
            $video->update([
                'status'        => 'failed',
                'error_message' => 'Source file missing before probe.',
                'failed_at'     => now(),
            ]);
            return;
        }

        $result = Process::run([
            'ffprobe', '-v', 'quiet',
            '-print_format', 'json',
            '-show_format',
            $absPath,
        ]);

        if (!$result->successful()) {
            Log::warning("[ProbeVideoJob] ffprobe failed for Video #{$video->id}: " . $result->errorOutput());
            // Non-fatal: continue without duration — PrepareAnalysisAssetsJob will use Python fallback
            $video->update(['status' => 'preparing_analysis_assets']);
            PrepareAnalysisAssetsJob::dispatch($video->id);
            return;
        }

        $meta     = json_decode($result->output(), true);
        $duration = isset($meta['format']['duration']) ? (float) $meta['format']['duration'] : null;

        // Enforce duration limit
        $maxSeconds = config('clutchclip.upload.max_duration_minutes', 60) * 60;
        if ($duration !== null && $duration > $maxSeconds) {
            $maxMin = config('clutchclip.upload.max_duration_minutes', 60);
            Log::info("[ProbeVideoJob] Video #{$video->id}: duration {$duration}s exceeds {$maxSeconds}s limit. Failing.");
            $video->deleteTempFile();
            $video->update([
                'status'        => 'failed',
                'error_message' => "Video exceeds the maximum allowed duration of {$maxMin} minutes.",
                'failed_at'     => now(),
            ]);
            return;
        }

        $video->update([
            'duration' => $duration,
            'status'   => 'preparing_analysis_assets',
        ]);

        Log::info("[ProbeVideoJob] Video #{$video->id}: probed duration={$duration}s. Dispatching PrepareAnalysisAssetsJob.");

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
}
