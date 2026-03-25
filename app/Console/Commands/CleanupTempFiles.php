<?php

namespace App\Console\Commands;

use App\Models\Clip;
use App\Models\Video;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class CleanupTempFiles extends Command
{
    protected $signature = 'clutchclip:cleanup
        {--failed-hours=   : Override failed retention hours from config}
        {--abandoned-hours= : Override abandoned retention hours from config}
        {--stuck-hours=    : Override stuck-processing threshold from config}
        {--dry-run         : Show what would be deleted without deleting}';

    protected $description = 'Clean temporary uploads, stale analysis assets, orphan clip/thumbnail files, and stuck videos';

    // ─── Status sets ──────────────────────────────────────────────────────────

    /** Pipeline stages that mean a video is still being actively processed. */
    private const ACTIVE_STATUSES = [
        'queued',
        'probing',
        'preparing_analysis_assets',
        'detecting_highlights',
        'cutting_clips',
        'generating_thumbnails',
        'processing', // legacy
    ];

    /** Terminal success statuses — new pipeline writes 'completed'; legacy records may say 'done'. */
    private const DONE_STATUSES = ['completed', 'done'];

    // ─── Entry point ──────────────────────────────────────────────────────────

    public function handle(): int
    {
        $dryRun = $this->option('dry-run');

        if ($dryRun) {
            $this->info('[DRY RUN] No files will be deleted.');
        }

        // Run in dependency order: mark stuck videos failed first so subsequent
        // passes treat them correctly.
        $this->cleanStuckVideos($dryRun);
        $this->cleanFailedTempUploads($dryRun);
        $this->cleanStaleAnalysisAssets($dryRun);
        $this->cleanAbandonedTempFiles($dryRun);
        $this->cleanAbandonedChunks($dryRun);
        $this->cleanOrphanClipFiles($dryRun);

        return self::SUCCESS;
    }

    // ─── Passes ───────────────────────────────────────────────────────────────

    /**
     * Videos that have been sitting in a pipeline stage for too long are almost
     * certainly stuck (worker crash, queue problem, ffmpeg hang).  Mark them
     * failed so the rest of this command — and the next run — can clean up their
     * artifacts.
     */
    private function cleanStuckVideos(bool $dryRun): void
    {
        $hours  = (int) ($this->option('stuck-hours') ?? config('clutchclip.cleanup.stuck_processing_hours', 4));
        $cutoff = now()->subHours($hours);

        $stuck = Video::whereIn('status', self::ACTIVE_STATUSES)
            ->where('updated_at', '<', $cutoff)
            ->get();

        $this->info("Stuck videos (>{$hours}h in a processing stage): {$stuck->count()} found.");

        foreach ($stuck as $video) {
            $this->line("  → Video #{$video->id} stuck at '{$video->status}' since {$video->updated_at}");

            if ($dryRun) {
                continue;
            }

            $video->update([
                'status'        => 'failed',
                'error_message' => "Processing timed out after {$hours}h in stage '{$video->status}'.",
                'failed_at'     => now(),
            ]);

            // Best-effort: clean whatever analysis assets may already exist.
            $video->deleteAnalysisAssets();

            Log::warning("[Cleanup] Video #{$video->id} marked failed (stuck in '{$video->status}').");
        }
    }

    /**
     * Delete the temp source upload and any leftover analysis assets from videos
     * whose pipeline failed, once they have been failed long enough.
     */
    private function cleanFailedTempUploads(bool $dryRun): void
    {
        $hours  = (int) ($this->option('failed-hours') ?? config('clutchclip.cleanup.failed_retention_hours', 24));
        $cutoff = now()->subHours($hours);

        $videos = Video::where('status', 'failed')
            ->where(fn ($q) => $q->whereNotNull('temp_path')->orWhereNotNull('analysis_video_path'))
            ->whereNull('deleted_temp_at')
            ->where('failed_at', '<', $cutoff)
            ->get();

        $this->info("Failed videos with artifacts older than {$hours}h: {$videos->count()} found.");

        foreach ($videos as $video) {
            $this->line("  → Video #{$video->id}: temp={$video->temp_path}, analysis={$video->analysis_video_path}");

            if ($dryRun) {
                continue;
            }

            // Order matters: analysis assets first (may be in temp/analysis/), then source.
            $video->deleteAnalysisAssets();
            $video->deleteTempFile();
        }
    }

    /**
     * Sweep temp/analysis/ for directories whose video has already finished
     * (completed / done) or failed past the retention window.
     *
     * GenerateThumbnailsJob deletes these on the success path, but a job exception
     * after clips are cut — or a worker restart — can leave analysis files stranded.
     */
    private function cleanStaleAnalysisAssets(bool $dryRun): void
    {
        $analysisBaseDir = storage_path('app/' . config('clutchclip.analysis_dir', 'temp/analysis'));

        if (!is_dir($analysisBaseDir)) {
            $this->info('Stale analysis assets: analysis directory does not exist.');
            return;
        }

        $failedHours  = (int) ($this->option('failed-hours') ?? config('clutchclip.cleanup.failed_retention_hours', 24));
        $failedCutoff = now()->subHours($failedHours);
        $deleted      = 0;

        foreach (scandir($analysisBaseDir) as $entry) {
            if ($entry === '.' || $entry === '..') {
                continue;
            }

            $dirPath = $analysisBaseDir . DIRECTORY_SEPARATOR . $entry;

            if (!is_dir($dirPath)) {
                continue;
            }

            $videoId = is_numeric($entry) ? (int) $entry : null;
            $video   = $videoId ? Video::find($videoId) : null;

            // No DB record at all — orphan directory.
            if (!$video) {
                $this->line("  → Orphan analysis dir (no DB record): {$dirPath}");

                if (!$dryRun) {
                    $this->deleteDirectory($dirPath);
                    Log::info("[Cleanup] Deleted orphan analysis dir: {$dirPath}");
                }

                $deleted++;
                continue;
            }

            // Completed/done: the job should have cleaned these; sweep them now.
            if (in_array($video->status, self::DONE_STATUSES, true)) {
                $this->line("  → Missed analysis cleanup for completed Video #{$video->id}: {$dirPath}");

                if (!$dryRun) {
                    $video->deleteAnalysisAssets();
                    Log::info("[Cleanup] Removed leftover analysis assets for completed Video #{$video->id}.");
                }

                $deleted++;
                continue;
            }

            // Failed past the retention window: safe to clean.
            if ($video->status === 'failed' && $video->failed_at?->lt($failedCutoff)) {
                $this->line("  → Analysis assets for failed Video #{$video->id} (failed {$video->failed_at}): {$dirPath}");

                if (!$dryRun) {
                    $video->deleteAnalysisAssets();
                    Log::info("[Cleanup] Removed analysis assets for failed Video #{$video->id}.");
                }

                $deleted++;
                continue;
            }

            // Video is still actively processing — leave it alone.
        }

        $this->info("Stale analysis dirs: {$deleted} " . ($dryRun ? 'would be' : '') . " cleaned.");
    }

    /**
     * Delete files in temp/uploads/ that have no matching DB record and are older
     * than the abandoned-files threshold.  Files still tracked in the DB are left
     * to cleanFailedTempUploads().
     */
    private function cleanAbandonedTempFiles(bool $dryRun): void
    {
        $hours   = (int) ($this->option('abandoned-hours') ?? config('clutchclip.cleanup.abandoned_retention_hours', 12));
        $cutoff  = now()->subHours($hours)->timestamp;
        $tempDir = storage_path('app/' . config('clutchclip.temp_upload_dir'));

        if (!is_dir($tempDir)) {
            $this->info('Abandoned temp files: temp directory does not exist.');
            return;
        }

        // Build a set of filenames that are still tracked in the DB.
        $knownFilenames = Video::whereNotNull('temp_path')
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

            if (filemtime($fullPath) > $cutoff) {
                continue; // too recent to be abandoned
            }

            if (in_array($file, $knownFilenames, true)) {
                continue; // still tracked — let cleanFailedTempUploads handle it
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
     * Delete chunk upload directories left behind by aborted uploads.
     * Any chunk dir whose newest file is older than 2 hours is dead.
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
                continue; // still active
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
     * Remove clip directories and thumbnail directories on disk that have no
     * matching video in the database.
     *
     * For video directories that DO have a DB record, also clean:
     *   - individual clip files not tracked in the clips table
     *   - files inside refined/ that are no longer tracked in clips.refined_path
     */
    private function cleanOrphanClipFiles(bool $dryRun): void
    {
        $clipsBaseDir = storage_path('app/' . config('clutchclip.clips_dir'));
        $thumbsBaseDir = storage_path('app/' . config('clutchclip.thumbnails_dir'));

        $deleted = 0;

        // ── Phase 1: entire orphan video directories (clips + thumbnails) ──────

        foreach ([$clipsBaseDir, $thumbsBaseDir] as $baseDir) {
            if (!is_dir($baseDir)) {
                continue;
            }

            foreach (scandir($baseDir) as $entry) {
                if ($entry === '.' || $entry === '..') {
                    continue;
                }

                $dirPath = $baseDir . DIRECTORY_SEPARATOR . $entry;

                if (!is_dir($dirPath) || !is_numeric($entry)) {
                    continue;
                }

                if (!Video::where('id', (int) $entry)->exists()) {
                    $this->line("  → Orphan dir (no DB record): {$dirPath}");

                    if (!$dryRun) {
                        $this->deleteDirectory($dirPath);
                        Log::info("[Cleanup] Deleted orphan dir: {$dirPath}");
                    }

                    $deleted++;
                }
            }
        }

        // ── Phase 2: individual orphan files inside known clip directories ─────

        if (!is_dir($clipsBaseDir)) {
            $this->info("Orphan clip/thumbnail files: {$deleted} " . ($dryRun ? 'would be' : '') . " cleaned.");
            return;
        }

        foreach (scandir($clipsBaseDir) as $videoDir) {
            if ($videoDir === '.' || $videoDir === '..' || !is_numeric($videoDir)) {
                continue;
            }

            $videoDirPath = $clipsBaseDir . DIRECTORY_SEPARATOR . $videoDir;

            if (!is_dir($videoDirPath)) {
                continue;
            }

            // Already removed as an orphan above — skip.
            if (!Video::where('id', (int) $videoDir)->exists()) {
                continue;
            }

            foreach (scandir($videoDirPath) as $entry) {
                if ($entry === '.' || $entry === '..') {
                    continue;
                }

                $entryPath = $videoDirPath . DIRECTORY_SEPARATOR . $entry;

                // refined/ subdirectory — scan it separately.
                if ($entry === 'refined' && is_dir($entryPath)) {
                    $this->cleanOrphanRefinedDir($entryPath, (int) $videoDir, $dryRun, $deleted);
                    continue;
                }

                if (!is_file($entryPath)) {
                    continue; // skip any other unexpected subdirectories
                }

                // Check whether this file is tracked in the DB.
                $tracked = Clip::where('video_id', (int) $videoDir)
                    ->where('filename', $entry)
                    ->exists();

                if (!$tracked) {
                    $this->line("  → Orphan clip file: {$entryPath}");

                    if (!$dryRun) {
                        if (@unlink($entryPath)) {
                            Log::info("[Cleanup] Deleted orphan clip file: {$entryPath}");
                            $deleted++;
                        }
                    } else {
                        $deleted++;
                    }
                }
            }
        }

        $this->info("Orphan clip/thumbnail files: {$deleted} " . ($dryRun ? 'would be' : '') . " cleaned.");
    }

    /**
     * Remove files inside a clip's refined/ directory that are no longer
     * referenced by any Clip record (refined_path column).
     * Removes the directory itself when it becomes empty.
     */
    private function cleanOrphanRefinedDir(string $refinedDir, int $videoId, bool $dryRun, int &$deleted): void
    {
        $knownFilenames = Clip::where('video_id', $videoId)
            ->whereNotNull('refined_path')
            ->pluck('refined_path')
            ->map(fn ($p) => basename($p))
            ->toArray();

        foreach (scandir($refinedDir) as $file) {
            if ($file === '.' || $file === '..') {
                continue;
            }

            $filePath = $refinedDir . DIRECTORY_SEPARATOR . $file;

            if (!is_file($filePath)) {
                continue;
            }

            if (!in_array($file, $knownFilenames, true)) {
                $this->line("  → Orphan refined file: {$filePath}");

                if (!$dryRun) {
                    if (@unlink($filePath)) {
                        Log::info("[Cleanup] Deleted orphan refined file: {$filePath}");
                        $deleted++;
                    }
                } else {
                    $deleted++;
                }
            }
        }

        // If the directory is now empty (or was already empty), remove it.
        if (!$dryRun) {
            $remaining = array_diff(scandir($refinedDir), ['.', '..']);
            if (empty($remaining)) {
                @rmdir($refinedDir);
            }
        }
    }

    // ─── Utility ──────────────────────────────────────────────────────────────

    /**
     * Recursively delete a directory and all its contents.
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
