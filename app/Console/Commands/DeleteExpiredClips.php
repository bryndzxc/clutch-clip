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
        $deleted  = 0;
        $skipped  = 0;

        // Find all completed videos that still have clip records
        Video::where('status', 'done')
            ->whereNotNull('processed_at')
            ->whereHas('clips')
            ->with(['user', 'clips'])
            ->chunk(50, function ($videos) use (&$deleted, &$skipped) {
                foreach ($videos as $video) {
                    $user = $video->user;

                    // If the video belongs to a deleted user, skip (will be cleaned by orphan sweep)
                    if (! $user) {
                        $skipped++;
                        continue;
                    }

                    $settings     = $user->getSettings();
                    $retainHours  = (int) ($settings['auto_delete_hours'] ?? 168);
                    $expiresAt    = $video->processed_at->addHours($retainHours);

                    if (! $expiresAt->isPast()) {
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
            // Delete clip file
            $clipPath = $clip->getAbsolutePath();
            if (file_exists($clipPath)) {
                @unlink($clipPath);
            }

            // Delete thumbnail file
            if ($clip->thumbnail_path) {
                $thumbPath = storage_path('app/' . $clip->thumbnail_path);
                if (file_exists($thumbPath)) {
                    @unlink($thumbPath);
                }
            }
        }

        // Try to remove the now-empty clips and thumbnails directories
        @rmdir($video->getClipsDir());
        @rmdir($video->getThumbnailsDir());

        // Delete all clip DB records for this video (files are already gone)
        $video->clips()->delete();

        Log::info("[DeleteExpiredClips] Clips removed for Video #{$video->id} ({$video->original_name})");
    }
}
