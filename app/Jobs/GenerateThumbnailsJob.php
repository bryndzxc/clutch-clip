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

class GenerateThumbnailsJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $timeout = 120;
    public int $tries   = 2;

    public function __construct(
        public int   $videoId,
        public array $clipIds,
    ) {
    }

    public function handle(): void
    {
        $video = Video::findOrFail($this->videoId);
        $video->update(['status' => 'generating_thumbnails']);

        $thumbsDir     = $video->getThumbnailsDir();
        $thumbsBaseDir = config('clutchclip.thumbnails_dir');
        @mkdir($thumbsDir, 0755, true);

        $clips = Clip::whereIn('id', $this->clipIds)->get();

        foreach ($clips as $clip) {
            $midpoint  = $clip->start_time + ($clip->duration / 2);
            $thumbFile = "thumb_{$clip->id}.jpg";
            $thumbPath = "{$thumbsDir}/{$thumbFile}";

            // Seek into the already-cut clip (short file = fast seek)
            $clipAbs = $clip->getAbsolutePath();
            if (!$clipAbs || !file_exists($clipAbs)) {
                Log::warning("[GenerateThumbnailsJob] Video #{$video->id}: clip file missing for Clip #{$clip->id}");
                continue;
            }

            exec(implode(' ', array_map('escapeshellarg', [
                'ffmpeg', '-y',
                '-ss', (string) ($clip->duration / 2),  // seek within clip, not source
                '-i', $clipAbs,
                '-frames:v', '1',
                '-vf', 'scale=480:-2',   // clip is 720p; 480p is sufficient for web card thumbnails
                '-q:v', '5',             // -q:v 3 is near-lossless and overkill for thumbnails; 5 is still high quality
                $thumbPath,
            ])) . ' 2>/dev/null', $out, $code);

            if ($code === 0 && file_exists($thumbPath)) {
                $clip->update([
                    'thumbnail_path' => $thumbsBaseDir . '/' . $video->id . '/' . $thumbFile,
                ]);
            } else {
                Log::warning("[GenerateThumbnailsJob] Video #{$video->id}: thumbnail failed for Clip #{$clip->id}");
            }
        }

        // ── Cleanup analysis assets (success path) ────────────────────────────
        $video->deleteAnalysisAssets();

        // ── Delete temp source file (all clips saved) ─────────────────────────
        $video->deleteTempFile();

        $video->update([
            'status'       => 'completed',
            'processed_at' => now(),
        ]);

        Log::info("[GenerateThumbnailsJob] Video #{$video->id}: completed — " . count($this->clipIds) . " clips, thumbnails generated, assets cleaned up.");
    }

    public function failed(\Throwable $e): void
    {
        Log::error("[GenerateThumbnailsJob] Job exception for Video #{$this->videoId}: " . $e->getMessage());

        // Thumbnails failing is non-critical — mark completed anyway if clips exist,
        // but set a note in error_message so it's visible in logs.
        $video = Video::find($this->videoId);
        if (!$video) {
            return;
        }

        $hasClips = Clip::where('video_id', $this->videoId)->exists();

        if ($hasClips) {
            // Clips were cut successfully — surface them to the user even without thumbnails
            $video->update([
                'status'        => 'completed',
                'processed_at'  => now(),
                'error_message' => 'Thumbnails could not be generated: ' . substr($e->getMessage(), 0, 300),
            ]);
            $video->deleteAnalysisAssets();
            $video->deleteTempFile();
        } else {
            $video->update([
                'status'        => 'failed',
                'error_message' => 'Thumbnail job failed: ' . substr($e->getMessage(), 0, 500),
                'failed_at'     => now(),
            ]);
        }
    }
}
