<?php

namespace App\Console\Commands;

use App\Models\Video;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class DeleteExpiredClips extends Command
{
    protected $signature   = 'clutchclip:delete-expired-clips';
    protected $description = 'Delete clip files and records that have exceeded the user\'s retention period.';

    public function handle(): int
    {
        $deleted = 0;
        $skipped = 0;

        // Find all completed videos (both 'completed' and legacy 'done') that still have clip records.
        Video::whereIn('status', ['completed', 'done'])
            ->whereNotNull('processed_at')
            ->whereHas('clips')
            ->with(['user', 'clips'])
            ->chunk(50, function ($videos) use (&$deleted, &$skipped) {
                foreach ($videos as $video) {
                    $user = $video->user;

                    // If the video's user was deleted, skip — the orphan-clip sweep
                    // in clutchclip:cleanup will remove these files.
                    if (!$user) {
                        $skipped++;
                        continue;
                    }

                    $settings    = $user->getSettings();
                    $retainHours = (int) ($settings['auto_delete_hours']
                        ?? config('clutchclip.cleanup.clips_retention_hours', 168));
                    $expiresAt   = $video->processed_at->addHours($retainHours);

                    if (!$expiresAt->isPast()) {
                        continue; // not expired yet
                    }

                    $this->deleteClipsForVideo($video);
                    $deleted++;
                }
            });

        $this->info("Expired clips deleted for {$deleted} video(s). Skipped: {$skipped}.");
        Log::info("[DeleteExpiredClips] Deleted clips for {$deleted} video(s).");

        return self::SUCCESS;
    }

    private function deleteClipsForVideo(Video $video): void
    {
        foreach ($video->clips as $clip) {
            // Primary clip file
            $clipPath = $clip->getAbsolutePath();
            if (file_exists($clipPath)) {
                @unlink($clipPath);
            }

            // Refined export (may exist alongside the original clip)
            $refinedPath = $clip->getRefinedAbsolutePath();
            if ($refinedPath && file_exists($refinedPath)) {
                @unlink($refinedPath);
            }

            // Thumbnail
            if ($clip->thumbnail_path) {
                $thumbPath = storage_path('app/' . $clip->thumbnail_path);
                if (file_exists($thumbPath)) {
                    @unlink($thumbPath);
                }
            }
        }

        // Remove the per-video clip directory tree (catches refined/ and any other residue).
        $this->deleteDirectory($video->getClipsDir());

        // Remove the per-video thumbnails directory.
        $this->deleteDirectory($video->getThumbnailsDir());

        // Remove all clip DB records for this video.
        $video->clips()->delete();

        Log::info("[DeleteExpiredClips] Clips removed for Video #{$video->id} ({$video->original_name})");
    }

    /**
     * Recursively delete a directory and all its contents.
     * Safe to call on non-existent paths.
     */
    private function deleteDirectory(string $dir): void
    {
        if (!is_dir($dir)) {
            return;
        }

        foreach (scandir($dir) as $item) {
            if ($item === '.' || $item === '..') {
                continue;
            }

            $path = $dir . DIRECTORY_SEPARATOR . $item;
            is_dir($path) ? $this->deleteDirectory($path) : @unlink($path);
        }

        @rmdir($dir);
    }
}
