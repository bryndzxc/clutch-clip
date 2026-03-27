<?php

namespace App\Jobs;

use App\Models\User;
use App\Models\Video;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Process;

class DetectHighlightsJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $timeout = 600; // 10 min — OpenCV on 640p analysis video
    public int $tries   = 2;

    public function __construct(public int $videoId)
    {
    }

    public function handle(): void
    {
        $video = Video::findOrFail($this->videoId);
        $video->update(['status' => 'detecting_highlights']);

        $analysisVideo = $video->getAnalysisVideoPath();
        $analysisAudio = $video->getAnalysisAudioPath();

        if (!$analysisVideo || !file_exists($analysisVideo)) {
            $this->failVideo($video, 'Analysis video missing before highlight detection.');
            return;
        }

        $settings  = User::find($video->user_id)?->getSettings() ?? User::DEFAULT_SETTINGS;
        $pythonBin = config('services.python.bin', 'python3');

        // Validate the configured binary before use; fall back to system python3
        if (!file_exists($pythonBin) || !is_executable($pythonBin)) {
            Log::warning("[DetectHighlightsJob] Video #{$video->id}: python binary '{$pythonBin}' not found or not executable — falling back to 'python3'.");
            $pythonBin = 'python3';
        }

        $script = base_path('python/process_video.py');

        $cmd = [
            $pythonBin, $script,
            '--analysis-video', $analysisVideo,
            '--detect-only',
            '--clip-count',  (string) (int) $settings['clip_count'],
            '--pre-roll',    (string) (int) $settings['pre_roll'],
            '--post-roll',   (string) (int) $settings['post_roll'],
            '--merge-gap',   (string) (int) $settings['merge_gap'],
            '--min-score',   (string) (int) $settings['min_score'],
        ];

        // Pass audio asset if available (silent videos skip this)
        if ($analysisAudio && file_exists($analysisAudio)) {
            $cmd[] = '--analysis-audio';
            $cmd[] = $analysisAudio;
        }

        // Pass known duration so Python skips its own ffprobe call
        if ($video->duration) {
            $cmd[] = '--source-duration';
            $cmd[] = (string) $video->duration;
        }

        // Diagnostic mode — appends --diagnose so per-clip analysis goes to stderr.
        // Enabled via HIGHLIGHT_DIAGNOSE=true in .env; off by default.
        if (config('services.python.highlight_diagnose')) {
            $cmd[] = '--diagnose';
        }

        Log::info("[DetectHighlightsJob] Video #{$video->id}: running Python detect-only. binary={$pythonBin}");

        // Process::run() with an array uses proc_open directly (no shell).
        // Do NOT wrap args with escapeshellarg() — that would add literal quotes
        // to the binary path, causing "not found" errors on the executing OS.
        $result = Process::timeout(580)->path(base_path())->run($cmd);

        if (!$result->successful()) {
            $this->failVideo($video, 'Highlight detection failed: ' . substr($result->errorOutput(), 0, 500));
            return;
        }

        // Parse JSON from the last stdout line
        $lines    = array_filter(explode("\n", trim($result->output())));
        $json     = end($lines);
        $detected = json_decode($json, true);

        if (!$detected || !isset($detected['highlights'])) {
            $this->failVideo($video, 'Invalid output from highlight detection script: ' . substr($json, 0, 200));
            return;
        }

        if (empty($detected['highlights'])) {
            $this->failVideo($video, 'No highlights detected in video. Try lowering the minimum score in settings.');
            return;
        }

        $video->update([
            'detected_highlights' => $detected['highlights'],
            'status'              => 'cutting_clips',
        ]);

        Log::info("[DetectHighlightsJob] Video #{$video->id}: detected " . count($detected['highlights']) . " highlights. Dispatching CutClipsJob.");

        CutClipsJob::dispatch($video->id);
    }

    private function failVideo(Video $video, string $message): void
    {
        Log::error("[DetectHighlightsJob] Video #{$video->id}: {$message}");
        $video->update([
            'status'        => 'failed',
            'error_message' => $message,
            'failed_at'     => now(),
        ]);
    }

    public function failed(\Throwable $e): void
    {
        Log::error("[DetectHighlightsJob] Job exception for Video #{$this->videoId}: " . $e->getMessage());

        Video::find($this->videoId)?->update([
            'status'        => 'failed',
            'error_message' => 'Highlight detection job failed: ' . substr($e->getMessage(), 0, 500),
            'failed_at'     => now(),
        ]);
    }
}
