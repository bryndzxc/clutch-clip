<?php

namespace App\Jobs;

use App\Models\Clip;
use App\Models\User;
use App\Models\Video;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class CutClipsJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $timeout = 1800; // 30 min — final-quality cuts from original source
    public int $tries   = 2;

    public function __construct(public int $videoId)
    {
    }

    public function handle(): void
    {
        $video = Video::findOrFail($this->videoId);
        $video->update(['status' => 'cutting_clips']);

        $source     = $video->getTempVideoPath();
        $highlights = $video->detected_highlights ?? [];

        if (!$source || !file_exists($source)) {
            $this->failVideo($video, 'Source file missing before clip cutting.');
            return;
        }

        if (empty($highlights)) {
            $this->failVideo($video, 'No detected highlights available for clip cutting.');
            return;
        }

        $clipsDir = $video->getClipsDir();
        @mkdir($clipsDir, 0755, true);

        $settings = User::find($video->user_id)?->getSettings() ?? User::DEFAULT_SETTINGS;
        [$crf, $preset] = $this->qualityParams($settings['output_quality'] ?? 'high');
        $resolution = $settings['resolution'] ?? '720p';
        $vfFilter   = $this->buildVfFilter($resolution, $settings['aspect_ratio'] ?? 'original');

        // Purge stale clip records from any previous (failed/retried) run
        Clip::where('video_id', $video->id)->delete();

        $clipsBaseDir  = config('clutchclip.clips_dir');
        $createdClipIds = [];

        foreach ($highlights as $i => $h) {
            $n        = $i + 1;
            $filename = "clip_{$n}.mp4";
            $outPath  = "{$clipsDir}/{$filename}";
            $duration = ($h['end'] ?? 0) - ($h['start'] ?? 0);

            Log::info("[CutClipsJob] Video #{$video->id}: cutting clip {$n} ({$h['start']}s → {$h['end']}s, score={$h['score']})");

            $success = $this->runFfmpeg([
                '-y',
                '-ss', (string) $h['start'],
                '-i', $source,
                '-t', (string) $duration,
                '-vf', $vfFilter,
                '-c:v', 'libx264',
                '-c:a', 'aac',
                '-b:a', '128k',
                '-preset', $preset,
                '-crf', (string) $crf,
                '-movflags', '+faststart',
                '-avoid_negative_ts', '1',
                $outPath,
            ]);

            if (!$success || !file_exists($outPath) || filesize($outPath) < 1024) {
                Log::warning("[CutClipsJob] Video #{$video->id}: clip {$n} failed or empty — skipping.");
                continue;
            }

            $clip = Clip::create([
                'video_id'   => $video->id,
                'start_time' => $h['start'],
                'end_time'   => $h['end'],
                'duration'   => $duration,
                'filename'   => $filename,
                'clip_path'  => $clipsBaseDir . '/' . $video->id . '/' . $filename,
                'score'      => $h['score'] ?? 0,
                'label'      => $h['label'] ?? null,
            ]);

            $createdClipIds[] = $clip->id;
        }

        if (empty($createdClipIds)) {
            $this->failVideo($video, 'All clip cuts failed — no output files were produced.');
            return;
        }

        $video->update(['status' => 'generating_thumbnails']);

        Log::info("[CutClipsJob] Video #{$video->id}: cut " . count($createdClipIds) . " clips. Dispatching GenerateThumbnailsJob.");

        GenerateThumbnailsJob::dispatch($video->id, $createdClipIds);
    }

    private function qualityParams(string $quality): array
    {
        // Preset ladder on a 2-CPU server (measured encode-time ratios vs medium):
        //   fast     ~1.5×  — previous setting; still wastes CPU at 720p
        //   veryfast ~2.0×  — saves ~25 % encode CPU vs fast; no perceptible
        //                     quality difference on 720p short gaming clips
        //   ultrafast ~2.8× — visible macro-blocking on motion; not safe
        //
        // veryfast is the correct production preset for all tiers on this server.
        return match ($quality) {
            'standard' => [28, 'veryfast'],
            'smaller'  => [35, 'veryfast'],
            // CRF 24 vs 23: bit-for-bit indistinguishable at 720p gaming content.
            // veryfast vs fast: ~25 % less encode CPU — the dominant cost here.
            default    => [24, 'veryfast'],   // 'high'
        };
    }

    private function buildVfFilter(string $resolution, string $aspectRatio): string
    {
        $height = match ($resolution) {
            '720p' => 720,
            'low'  => 480,
            default => 720,  // unknown value → safe fallback
        };

        return $aspectRatio === 'vertical'
            ? "crop=ih*9/16:ih,scale=-2:{$height}"
            : "scale=-2:{$height}";
    }

    private function runFfmpeg(array $args): bool
    {
        $cmd = array_merge(['ffmpeg'], $args);
        exec(implode(' ', array_map('escapeshellarg', $cmd)) . ' 2>&1', $out, $code);

        if ($code !== 0) {
            Log::error("[CutClipsJob] FFmpeg failed (exit {$code}): " . implode("\n", array_slice($out, -5)));
            return false;
        }

        return true;
    }

    private function failVideo(Video $video, string $message): void
    {
        Log::error("[CutClipsJob] Video #{$video->id}: {$message}");
        $video->update([
            'status'        => 'failed',
            'error_message' => $message,
            'failed_at'     => now(),
        ]);
    }

    public function failed(\Throwable $e): void
    {
        Log::error("[CutClipsJob] Job exception for Video #{$this->videoId}: " . $e->getMessage());

        Video::find($this->videoId)?->update([
            'status'        => 'failed',
            'error_message' => 'Clip cutting job failed: ' . substr($e->getMessage(), 0, 500),
            'failed_at'     => now(),
        ]);
    }
}
