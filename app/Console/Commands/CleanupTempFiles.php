<?php

namespace App\Console\Commands;

use App\Models\Clip;
use App\Models\Video;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class CleanupTempFiles extends Command
{
    protected $signature = 'clutchclip:cleanup
        {--failed-hours= : Override failed retention hours from config}
        {--abandoned-hours= : Override abandoned retention hours from config}
        {--clips-hours= : Override final clips retention hours from config}
        {--dry-run : Show what would be deleted without deleting}';

    protected $description = 'Clean up temporary uploads, failed temp files, and orphan clip files';

    public function handle(): int
    {
        $dryRun = $this->option('dry-run');

        if ($dryRun) {
            $this->info('[DRY RUN] No files will be deleted.');
        }

        $this->cleanFailedTempUploads($dryRun);
        $this->cleanAbandonedTempFiles($dryRun);
        $this->cleanAbandonedChunks($dryRun);
        $this->cleanOrphanClipFiles($dryRun);
        $this->cleanExpiredClips($dryRun);

        return self::SUCCESS;
    }

    /**
     * Delete temp uploads from failed jobs older than the configured retention period.
     */
    private function cleanFailedTempUploads(bool $dryRun): void
    {
        $hours = $this->option('failed-hours')
            ?? config('clutchclip.cleanup.failed_retention_hours', 24);

        $cutoff = now()->subHours((int) $hours);

        $videos = Video::where('status', 'failed')
            ->whereNotNull('temp_path')
            ->whereNull('deleted_temp_at')
            ->where('failed_at', '<', $cutoff)
            ->get();

        $this->info("Failed temp uploads older than {$hours}h: {$videos->count()} found.");

        foreach ($videos as $video) {
            $path = $video->getTempVideoPath();
            $this->line("  → Video #{$video->id}: {$path}");

            if ($dryRun) {
                continue;
            }

            $video->deleteTempFile();
        }
    }

    /**
     * Delete temp files on disk that have no matching database record.
     */
    private function cleanAbandonedTempFiles(bool $dryRun): void
    {
        $hours = $this->option('abandoned-hours')
            ?? config('clutchclip.cleanup.abandoned_retention_hours', 12);

        $cutoff = now()->subHours((int) $hours)->timestamp;
        $tempDir = storage_path('app/' . config('clutchclip.temp_upload_dir'));

        if (!is_dir($tempDir)) {
            $this->info('Abandoned temp files: temp directory does not exist.');
            return;
        }

        $knownPaths = Video::whereNotNull('temp_path')
            ->pluck('temp_path')
            ->map(fn ($p) => basename($p))
            ->toArray();

        $deleted = 0;
        foreach (scandir($tempDir) as $file) {
            if ($file === '.' || $file === '..') {
                continue;
            }

            $fullPath = $tempDir . DIRECTORY_SEPARATOR . $file;

            if (!is_file($fullPath)) {
                continue;
            }

            // Skip files newer than the cutoff
            if (filemtime($fullPath) > $cutoff) {
                continue;
            }

            // Skip files that still have a DB record (handled by cleanFailedTempUploads)
            if (in_array($file, $knownPaths, true)) {
                continue;
            }

            $this->line("  → Abandoned: {$fullPath}");

            if (!$dryRun) {
                if (@unlink($fullPath)) {
                    Log::info("[Cleanup] Deleted abandoned temp file: {$fullPath}");
                    $deleted++;
                } else {
                    Log::error("[Cleanup] Failed to delete abandoned file: {$fullPath}");
                }
            } else {
                $deleted++;
            }
        }

        $this->info("Abandoned temp files older than {$hours}h: {$deleted} " . ($dryRun ? 'would be' : '') . " deleted.");
    }

    /**
     * Delete clip files on disk that have no matching database record.
     */
    private function cleanOrphanClipFiles(bool $dryRun): void
    {
        $clipsBaseDir = storage_path('app/' . config('clutchclip.clips_dir'));

        if (!is_dir($clipsBaseDir)) {
            $this->info('Orphan clip files: clips directory does not exist.');
            return;
        }

        $deleted = 0;

        // Each subdirectory is a video ID
        foreach (scandir($clipsBaseDir) as $videoDir) {
            if ($videoDir === '.' || $videoDir === '..') {
                continue;
            }

            $videoDirPath = $clipsBaseDir . DIRECTORY_SEPARATOR . $videoDir;
            if (!is_dir($videoDirPath)) {
                continue;
            }

            // Check if the video record exists
            $videoExists = Video::where('id', $videoDir)->exists();

            if (!$videoExists) {
                $this->line("  → Orphan video dir (no DB record): {$videoDirPath}");

                if (!$dryRun) {
                    $this->deleteDirectory($videoDirPath);
                    Log::info("[Cleanup] Deleted orphan video clips dir: {$videoDirPath}");
                }

                $deleted++;
                continue;
            }

            // Check individual clip files
            foreach (scandir($videoDirPath) as $clipFile) {
                if ($clipFile === '.' || $clipFile === '..') {
                    continue;
                }

                $clipFilePath = $videoDirPath . DIRECTORY_SEPARATOR . $clipFile;

                $clipExists = Clip::where('video_id', $videoDir)
                    ->where('filename', $clipFile)
                    ->exists();

                if (!$clipExists) {
                    $this->line("  → Orphan clip file: {$clipFilePath}");

                    if (!$dryRun) {
                        if (@unlink($clipFilePath)) {
                            Log::info("[Cleanup] Deleted orphan clip file: {$clipFilePath}");
                            $deleted++;
                        }
                    } else {
                        $deleted++;
                    }
                }
            }
        }

        $this->info("Orphan clip files: {$deleted} " . ($dryRun ? 'would be' : '') . " cleaned.");
    }

    /**
     * Delete chunk directories left behind by abandoned or failed chunked uploads.
     * Any chunk dir older than 2 hours with no corresponding assemble call is dead.
     */
    private function cleanAbandonedChunks(bool $dryRun): void
    {
        $chunkBaseDir = storage_path('app/' . config('clutchclip.chunks_dir'));

        if (!is_dir($chunkBaseDir)) {
            $this->info('Abandoned chunks: chunk directory does not exist.');
            return;
        }

        $cutoff  = now()->subHours(2)->timestamp;
        $deleted = 0;

        foreach (scandir($chunkBaseDir) as $uploadId) {
            if ($uploadId === '.' || $uploadId === '..') {
                continue;
            }

            $uploadDir = $chunkBaseDir . DIRECTORY_SEPARATOR . $uploadId;

            if (!is_dir($uploadDir)) {
                continue;
            }

            // Age the directory by the modification time of its newest chunk
            $files = array_values(array_filter(
                scandir($uploadDir),
                fn ($f) => $f !== '.' && $f !== '..'
            ));

            if (empty($files)) {
                if (!$dryRun) {
                    @rmdir($uploadDir);
                }
                continue;
            }

            $newest = max(array_map(
                fn ($f) => filemtime($uploadDir . DIRECTORY_SEPARATOR . $f),
                $files
            ));

            if ($newest > $cutoff) {
                continue; // still active or recently written
            }

            $this->line("  → Abandoned chunk dir: {$uploadDir}");

            if (!$dryRun) {
                $this->deleteDirectory($uploadDir);
                Log::info("[Cleanup] Deleted abandoned chunk dir: {$uploadDir}");
            }

            $deleted++;
        }

        $this->info("Abandoned chunk dirs (>2h old): {$deleted} " . ($dryRun ? 'would be' : '') . " deleted.");
    }

    /**
     * Delete final generated clips (files + DB records) for videos processed
     * longer ago than the configured retention window.
     */
    private function cleanExpiredClips(bool $dryRun): void
    {
        $hours = $this->option('clips-hours')
            ?? config('clutchclip.cleanup.clips_retention_hours', 48);

        $cutoff = now()->subHours((int) $hours);

        $videos = Video::where('status', 'done')
            ->whereNotNull('processed_at')
            ->where('processed_at', '<', $cutoff)
            ->get();

        $this->info("Expired clips (processed >{$hours}h ago): {$videos->count()} video(s) found.");

        $deletedFiles = 0;
        $deletedRecords = 0;

        foreach ($videos as $video) {
            $clipsDir      = $video->getClipsDir();
            $thumbnailsDir = $video->getThumbnailsDir();

            $this->line("  → Video #{$video->id} processed at {$video->processed_at}");

            if ($dryRun) {
                continue;
            }

            // Delete clip files and thumbnail files from disk
            foreach ([$clipsDir, $thumbnailsDir] as $dir) {
                if (is_dir($dir)) {
                    $this->deleteDirectory($dir);
                    Log::info("[Cleanup] Deleted expired clips dir: {$dir}");
                    $deletedFiles++;
                }
            }

            // Delete Clip DB records for this video
            $count = Clip::where('video_id', $video->id)->count();
            Clip::where('video_id', $video->id)->delete();
            $deletedRecords += $count;

            Log::info("[Cleanup] Removed {$count} clip records for Video #{$video->id}.");
        }

        $this->info("Expired clips: {$deletedFiles} dirs and {$deletedRecords} records " . ($dryRun ? 'would be' : '') . " deleted.");
    }

    /**
     * Recursively delete a directory and its contents.
     */
    private function deleteDirectory(string $dir): void
    {
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
