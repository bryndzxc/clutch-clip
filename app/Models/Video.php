<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Log;

class Video extends Model
{
    protected $fillable = [
        'user_id',
        'upload_id',
        'filename',
        'original_name',
        'temp_path',
        'analysis_video_path',
        'analysis_audio_path',
        'detected_highlights',
        'size',
        'status',
        'duration',
        'error_message',
        'uploaded_at',
        'processed_at',
        'failed_at',
        'deleted_temp_at',
    ];

    protected function casts(): array
    {
        return [
            'uploaded_at'        => 'datetime',
            'processed_at'       => 'datetime',
            'failed_at'          => 'datetime',
            'deleted_temp_at'    => 'datetime',
            'duration'           => 'decimal:2',
            'detected_highlights' => 'array',
        ];
    }

    public function clips(): HasMany
    {
        return $this->hasMany(Clip::class)->orderBy('score', 'desc');
    }

    /**
     * Absolute path to the temporary source video.
     * Returns null if temp_path is cleared (after successful processing).
     */
    public function getTempVideoPath(): ?string
    {
        if (!$this->temp_path) {
            return null;
        }

        return storage_path('app/' . $this->temp_path);
    }

    // ─── Canonical pipeline statuses ──────────────────────────────────────────

    /** Terminal success: new pipeline writes 'completed'; legacy records may have 'done'. */
    public function isCompleted(): bool
    {
        return in_array($this->status, ['completed', 'done'], true);
    }

    /** Terminal failure. */
    public function isFailed(): bool
    {
        return $this->status === 'failed';
    }

    /** Any terminal state (success or failure) — polling should stop. */
    public function isTerminal(): bool
    {
        return $this->isCompleted() || $this->isFailed();
    }

    /** Any in-flight processing state (not queued, not terminal). */
    public function isProcessing(): bool
    {
        return in_array($this->status, [
            'probing',
            'preparing_analysis_assets',
            'detecting_highlights',
            'cutting_clips',
            'generating_thumbnails',
            'processing', // legacy
        ], true);
    }

    /**
     * Whether this video has reached a successful terminal state.
     * @deprecated Use isCompleted() instead.
     */
    public function isProcessed(): bool
    {
        return $this->isCompleted();
    }

    /**
     * Absolute path to the low-res analysis video, or null if not generated / already cleaned up.
     */
    public function getAnalysisVideoPath(): ?string
    {
        return $this->analysis_video_path
            ? storage_path('app/' . $this->analysis_video_path)
            : null;
    }

    /**
     * Absolute path to the mono 16 kHz analysis audio WAV, or null if not generated / cleaned up.
     */
    public function getAnalysisAudioPath(): ?string
    {
        return $this->analysis_audio_path
            ? storage_path('app/' . $this->analysis_audio_path)
            : null;
    }

    /**
     * Delete analysis assets from disk and clear their DB columns.
     * Safe to call even if the files are already gone.
     */
    public function deleteAnalysisAssets(): void
    {
        foreach (['getAnalysisVideoPath', 'getAnalysisAudioPath'] as $method) {
            $abs = $this->$method();
            if ($abs && file_exists($abs)) {
                @unlink($abs);
            }
        }

        // Remove the directory if it is now empty
        $dir = storage_path("app/temp/analysis/{$this->id}");
        if (is_dir($dir) && count(glob("{$dir}/*")) === 0) {
            @rmdir($dir);
        }

        $this->update([
            'analysis_video_path' => null,
            'analysis_audio_path' => null,
        ]);
    }

    /**
     * Directory where final clips are stored for this video.
     */
    public function getClipsDir(): string
    {
        return storage_path('app/' . config('clutchclip.clips_dir') . '/' . $this->id);
    }

    /**
     * Directory where thumbnails are stored for this video.
     */
    public function getThumbnailsDir(): string
    {
        return storage_path('app/' . config('clutchclip.thumbnails_dir') . '/' . $this->id);
    }

    /**
     * Check if the temporary source file still exists on disk.
     */
    public function isTempFileAvailable(): bool
    {
        $path = $this->getTempVideoPath();

        return $path && file_exists($path);
    }

    /**
     * Delete the temporary source video from disk and clear temp_path.
     * Only call after processing is confirmed successful.
     */
    public function deleteTempFile(): bool
    {
        $path = $this->getTempVideoPath();

        if (!$path) {
            return false;
        }

        if (!file_exists($path)) {
            Log::warning("[Video #{$this->id}] Temp file already missing: {$path}");
            $this->update(['temp_path' => null, 'deleted_temp_at' => now()]);
            return false;
        }

        $deleted = @unlink($path);

        if ($deleted) {
            Log::info("[Video #{$this->id}] Temp source deleted: {$path}");
            $this->update(['temp_path' => null, 'deleted_temp_at' => now()]);
        } else {
            Log::error("[Video #{$this->id}] Failed to delete temp source: {$path}");
        }

        return $deleted;
    }
}
