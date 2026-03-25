<?php

namespace App\Jobs;

use App\Models\Clip;
use App\Models\Video;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Process;

class ProcessVideoJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $timeout = 600; // 10 minutes max

    public function __construct(public int $videoId)
    {
    }

    public function handle(): void
    {
        $video = Video::findOrFail($this->videoId);
        $video->update(['status' => 'processing']);

        $videoPath     = $video->getTempVideoPath();
        $clipsDir      = $video->getClipsDir();
        $thumbnailsDir = $video->getThumbnailsDir();

        if (!$videoPath || !file_exists($videoPath)) {
            Log::error("[ProcessVideoJob] Video #{$video->id}: source file not found at {$videoPath}");
            $video->update([
                'status'        => 'failed',
                'error_message' => 'Video file not found.',
                'failed_at'     => now(),
            ]);
            return;
        }

        // Ensure output directories exist
        if (!is_dir($clipsDir)) {
            mkdir($clipsDir, 0755, true);
            Log::info("[ProcessVideoJob] Created clips dir: {$clipsDir}");
        }
        if (!is_dir($thumbnailsDir)) {
            mkdir($thumbnailsDir, 0755, true);
            Log::info("[ProcessVideoJob] Created thumbnails dir: {$thumbnailsDir}");
        }

        // Load the user's processing preferences (falls back to defaults)
        $settings = \App\Models\User::find($video->user_id)?->getSettings()
            ?? \App\Models\User::DEFAULT_SETTINGS;

        // Run the Python highlight detection script
        $pythonBin = env('PYTHON_BIN', 'python3');
        $pythonScript = base_path('python/process_video.py');
        $command = sprintf(
            '%s %s --input %s --output-dir %s --thumbnails-dir %s'
            . ' --clip-count %d --pre-roll %d --post-roll %d --merge-gap %d --min-score %d'
            . ' --quality %s --resolution %s --aspect-ratio %s',
            escapeshellarg($pythonBin),
            escapeshellarg($pythonScript),
            escapeshellarg($videoPath),
            escapeshellarg($clipsDir),
            escapeshellarg($thumbnailsDir),
            (int) $settings['clip_count'],
            (int) $settings['pre_roll'],
            (int) $settings['post_roll'],
            (int) $settings['merge_gap'],
            (int) $settings['min_score'],
            escapeshellarg($settings['output_quality']),
            escapeshellarg($settings['resolution']),
            escapeshellarg($settings['aspect_ratio']),
        );

        Log::info("[ProcessVideoJob] Running: {$command}");

        $result = Process::timeout(580)->run($command);

        if (!$result->successful()) {
            Log::error("[ProcessVideoJob] Python failed: " . $result->errorOutput());
            $video->update([
                'status'        => 'failed',
                'error_message' => 'Processing failed: ' . substr($result->errorOutput(), 0, 500),
                'failed_at'     => now(),
            ]);
            // Keep temp file for debugging — cleanup command will handle it later
            return;
        }

        // Parse JSON from the LAST line of stdout (Python prints logs to stderr)
        $output = trim($result->output());
        $lines  = explode("\n", $output);
        $json   = end($lines);

        $data = json_decode($json, true);

        if (!$data || !isset($data['clips'])) {
            Log::error("[ProcessVideoJob] Invalid JSON: {$json}");
            $video->update([
                'status'        => 'failed',
                'error_message' => 'Invalid output from processing script.',
                'failed_at'     => now(),
            ]);
            return;
        }

        // Create clip records
        $clipsBaseDir = config('clutchclip.clips_dir');
        $thumbsBaseDir = config('clutchclip.thumbnails_dir');

        foreach ($data['clips'] as $clipData) {
            $clipDuration = $clipData['end'] - $clipData['start'];
            $clipRelPath  = $clipsBaseDir . '/' . $video->id . '/' . $clipData['filename'];

            $thumbnailRelPath = null;
            if (!empty($clipData['thumbnail'])) {
                $thumbnailRelPath = $thumbsBaseDir . '/' . $video->id . '/' . $clipData['thumbnail'];
            }

            Clip::create([
                'video_id'       => $video->id,
                'start_time'     => $clipData['start'],
                'end_time'       => $clipData['end'],
                'duration'       => $clipDuration,
                'filename'       => $clipData['filename'],
                'clip_path'      => $clipRelPath,
                'thumbnail_path' => $thumbnailRelPath,
                'score'          => $clipData['score'],
            ]);

            Log::info("[ProcessVideoJob] Clip saved: {$clipRelPath}");
        }

        // Mark processing as done
        $video->update([
            'status'       => 'done',
            'duration'     => $data['duration'] ?? null,
            'processed_at' => now(),
        ]);

        Log::info("[ProcessVideoJob] Done — Video #{$video->id} — " . count($data['clips']) . " clips created.");

        // ── SAFETY: Delete temp source ONLY after everything is saved ──
        $video->deleteTempFile();
    }

    public function failed(\Throwable $exception): void
    {
        Log::error("[ProcessVideoJob] Job failed for Video #{$this->videoId}: " . $exception->getMessage());

        $video = Video::find($this->videoId);
        $video?->update([
            'status'        => 'failed',
            'error_message' => 'Job failed: ' . substr($exception->getMessage(), 0, 500),
            'failed_at'     => now(),
        ]);
        // Temp file is intentionally kept for debugging
    }
}
