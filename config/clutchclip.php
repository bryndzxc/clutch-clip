<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Upload Limits
    |--------------------------------------------------------------------------
    |
    | Controls maximum file size and video duration accepted at upload time.
    | File size is enforced by Laravel validation; duration is checked via
    | ffprobe after the file lands on disk, before any DB record is created.
    |
    */

    'upload' => [
        // Maximum upload file size in megabytes
        'max_size_mb'          => (int) env('CLUTCHCLIP_MAX_SIZE_MB', 1536),

        // Maximum video duration in minutes — uploads exceeding this are rejected
        'max_duration_minutes' => (int) env('CLUTCHCLIP_MAX_DURATION_MINUTES', 60),
    ],

    /*
    |--------------------------------------------------------------------------
    | Storage Paths
    |--------------------------------------------------------------------------
    |
    | Folder paths relative to storage/app/ used by ClutchClip.
    |
    */

    'temp_upload_dir' => 'temp/uploads',
    'chunks_dir'      => 'temp/chunks',
    'analysis_dir'    => 'temp/analysis',
    'clips_dir'       => 'public/clips',
    'thumbnails_dir'  => 'public/thumbnails',

    /*
    |--------------------------------------------------------------------------
    | Cleanup Strategy
    |--------------------------------------------------------------------------
    |
    | Controls automatic cleanup of temporary and orphan files.
    |
    */

    'cleanup' => [
        // Delete temp uploads and analysis assets from failed jobs older than this many hours
        'failed_retention_hours' => (int) env('CLUTCHCLIP_FAILED_RETENTION_HOURS', 24),

        // Delete abandoned temp files (no matching DB record) older than this many hours
        'abandoned_retention_hours' => (int) env('CLUTCHCLIP_ABANDONED_RETENTION_HOURS', 12),

        // Mark videos stuck in a pipeline stage for longer than this as failed and clean their assets
        'stuck_processing_hours' => (int) env('CLUTCHCLIP_STUCK_PROCESSING_HOURS', 4),

        // Per-user clip retention fallback used by delete-expired-clips when the user has no setting
        // (individual users can override this via their account settings)
        'clips_retention_hours' => (int) env('CLUTCHCLIP_CLIPS_RETENTION_HOURS', 168),
    ],

];
