<?php

namespace App\Jobs;

use App\Models\Clip;
use App\Models\Montage;
use App\Models\MontageProject;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Process;
use Illuminate\Support\Facades\Storage;

class RenderMontageJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $timeout = 900;

    public function __construct(public int $projectId, public int $montageId)
    {
    }

    public function handle(): void
    {
        $project = MontageProject::with('video.clips')->findOrFail($this->projectId);
        $montage = Montage::find($this->montageId);

        $project->update([
            'status'        => 'rendering',
            'error_message' => null,
        ]);

        $montage?->update([
            'title'         => $project->title,
            'status'        => 'rendering',
            'error_message' => null,
            'output_path'   => null,
            'duration'      => null,
            'file_size'     => null,
        ]);

        Log::info("[RenderMontageJob] Starting render for project #{$project->id}");

        $clipOrder = $project->clip_order ?? [];
        $clipSettings = $project->clip_settings ?? [];
        $titleCard = $project->title_card ?? [];

        if (empty($clipOrder)) {
            $this->fail($project, $montage, 'No clips selected for montage.');
            return;
        }

        $clipsMap = $project->video->clips->keyBy('id');

        $tmpDir = storage_path("app/tmp/montages/{$project->id}");
        @mkdir($tmpDir, 0755, true);

        $segments = [];
        $renderedDuration = 0.0;

        if (!empty($titleCard['enabled'])) {
            $titleCardPath = "{$tmpDir}/title_card.mp4";
            $text = $this->escapeFfmpegText($titleCard['text'] ?? 'Highlights');
            $duration = max(1, min(10, (int) ($titleCard['duration'] ?? 3)));

            $cmd = [
                'ffmpeg', '-y',
                '-f', 'lavfi', '-i', "color=c=black:s=1920x1080:r=30:d={$duration}",
                '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo',
                '-vf', "drawtext=text='{$text}':fontsize=60:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2",
                '-c:v', 'libx264', '-preset', 'fast', '-crf', '22',
                '-c:a', 'aac', '-b:a', '128k',
                '-t', (string) $duration,
                $titleCardPath,
            ];

            $result = Process::timeout(60)->run($cmd);

            if ($result->successful() && file_exists($titleCardPath) && filesize($titleCardPath) > 0) {
                $segments[] = $titleCardPath;
                $renderedDuration += $duration;
                Log::info("[RenderMontageJob] Title card rendered: {$titleCardPath}");
            } else {
                Log::warning("[RenderMontageJob] Title card failed: " . $result->errorOutput());
            }
        }

        foreach ($clipOrder as $i => $clipId) {
            /** @var Clip|null $clip */
            $clip = $clipsMap[$clipId] ?? null;

            if (!$clip) {
                Log::warning("[RenderMontageJob] Clip #{$clipId} not found, skipping.");
                continue;
            }

            $sourcePath = null;
            if ($clip->refined_path) {
                $refinedAbs = $clip->getRefinedAbsolutePath();
                if ($refinedAbs && file_exists($refinedAbs)) {
                    $sourcePath = $refinedAbs;
                }
            }

            if (!$sourcePath) {
                $sourcePath = $clip->getAbsolutePath();
            }

            if (!file_exists($sourcePath)) {
                Log::warning("[RenderMontageJob] Clip #{$clipId} file missing at {$sourcePath}, skipping.");
                continue;
            }

            $settings = $clipSettings[$clipId] ?? $clipSettings[(string) $clipId] ?? [];
            $trimStart = (float) ($settings['trim_start'] ?? 0);
            $trimEnd = (float) ($settings['trim_end'] ?? (float) $clip->duration);
            $muted = !empty($settings['muted']);

            $clipDur = (float) $clip->duration;
            $trimStart = max(0, min($trimStart, $clipDur - 0.5));
            $trimEnd = max($trimStart + 0.5, min($trimEnd, $clipDur));

            $segPath = "{$tmpDir}/seg_{$i}.mp4";

            if ($muted) {
                $cmd = [
                    'ffmpeg', '-y',
                    '-ss', (string) $trimStart,
                    '-to', (string) $trimEnd,
                    '-i', $sourcePath,
                    '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo',
                    '-map', '0:v',
                    '-map', '1:a',
                    '-vf', 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black',
                    '-c:v', 'libx264', '-preset', 'fast', '-crf', '22',
                    '-c:a', 'aac', '-b:a', '128k',
                    '-shortest',
                    $segPath,
                ];
            } else {
                $cmd = [
                    'ffmpeg', '-y',
                    '-ss', (string) $trimStart,
                    '-to', (string) $trimEnd,
                    '-i', $sourcePath,
                    '-vf', 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black',
                    '-c:v', 'libx264', '-preset', 'fast', '-crf', '22',
                    '-c:a', 'aac', '-b:a', '192k',
                    $segPath,
                ];
            }

            $result = Process::timeout(180)->run($cmd);

            if ($result->successful() && file_exists($segPath) && filesize($segPath) > 0) {
                $segments[] = $segPath;
                $renderedDuration += max(0, $trimEnd - $trimStart);
                Log::info("[RenderMontageJob] Segment {$i} ready: {$segPath}");
            } else {
                Log::error("[RenderMontageJob] Segment {$i} (clip #{$clipId}) failed: " . $result->errorOutput());
            }
        }

        if (empty($segments)) {
            $this->fail($project, $montage, 'All clip segments failed to process. Check that source clip files exist.');
            $this->cleanupTmp($tmpDir);
            return;
        }

        $concatListPath = str_replace('\\', '/', "{$tmpDir}/concat.txt");
        $lines = [];

        foreach ($segments as $seg) {
            $safe = str_replace('\\', '/', $seg);
            $lines[] = "file '{$safe}'";
        }

        file_put_contents($concatListPath, implode("\n", $lines) . "\n");

        $relativeDirectory = "montages/{$project->id}";
        Storage::disk('public')->makeDirectory($relativeDirectory);

        $outFilename = 'montage_' . time() . '.mp4';
        $relativeOutputPath = "{$relativeDirectory}/{$outFilename}";
        $outPath = Storage::disk('public')->path($relativeOutputPath);

        $concatCmd = [
            'ffmpeg', '-y',
            '-f', 'concat', '-safe', '0',
            '-i', $concatListPath,
            '-c', 'copy',
            '-movflags', '+faststart',
            $outPath,
        ];

        Log::info("[RenderMontageJob] Running concat for project #{$project->id}");

        $result = Process::timeout(300)->run($concatCmd);

        if (!$result->successful() || !file_exists($outPath) || filesize($outPath) === 0) {
            Log::error("[RenderMontageJob] Concat failed: " . $result->errorOutput());
            $this->fail($project, $montage, 'Final merge failed. Please try again.');
            $this->cleanupTmp($tmpDir);
            return;
        }

        $project->update([
            'status'        => 'completed',
            'output_path'   => $relativeOutputPath,
            'completed_at'  => now(),
            'error_message' => null,
        ]);

        $montage?->update([
            'title'         => $project->title,
            'status'        => 'completed',
            'output_path'   => $relativeOutputPath,
            'duration'      => round($renderedDuration, 2),
            'file_size'     => filesize($outPath),
            'error_message' => null,
        ]);

        Log::info("[RenderMontageJob] Done — project #{$project->id}, output: {$outPath}");

        $this->cleanupTmp($tmpDir);
    }

    private function fail(MontageProject $project, ?Montage $montage, string $message): void
    {
        $project->update([
            'status'        => 'failed',
            'error_message' => $message,
        ]);

        $montage?->update([
            'title'         => $project->title,
            'status'        => 'failed',
            'error_message' => $message,
        ]);

        Log::error("[RenderMontageJob] Project #{$project->id} failed: {$message}");
    }

    private function cleanupTmp(string $dir): void
    {
        if (!is_dir($dir)) {
            return;
        }

        foreach (glob($dir . '/*') ?: [] as $file) {
            @unlink($file);
        }

        @rmdir($dir);
    }

    private function escapeFfmpegText(string $text): string
    {
        $text = substr(strip_tags($text), 0, 80);

        return preg_replace('/[^\w\s\-!.,#@&()+]/u', '', $text);
    }

    public function failed(\Throwable $exception): void
    {
        Log::error("[RenderMontageJob] Job crashed for project #{$this->projectId}: " . $exception->getMessage());

        $message = 'Render job crashed: ' . substr($exception->getMessage(), 0, 500);

        MontageProject::find($this->projectId)?->update([
            'status'        => 'failed',
            'error_message' => $message,
        ]);

        Montage::find($this->montageId)?->update([
            'status'        => 'failed',
            'error_message' => $message,
        ]);
    }
}
