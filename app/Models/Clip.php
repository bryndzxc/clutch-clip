<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Clip extends Model
{
    protected $fillable = [
        'video_id',
        'start_time',
        'end_time',
        'duration',
        'filename',
        'clip_path',
        'thumbnail_path',
        'score',
        'confidence',
        'label',
        'refined_path',
        'muted',
        'refined_at',
    ];

    protected function casts(): array
    {
        return [
            'duration'    => 'decimal:2',
            'muted'       => 'boolean',
            'refined_at'  => 'datetime',
        ];
    }

    public function video(): BelongsTo
    {
        return $this->belongsTo(Video::class);
    }

    /**
     * Absolute path to the clip file on disk.
     * clip_path is stored relative to storage/app/ (e.g. "public/clips/{id}/clip_1.mp4")
     */
    public function getAbsolutePath(): string
    {
        return storage_path('app/' . $this->clip_path);
    }

    /**
     * Route URL for streaming/downloading this clip.
     */
    public function getUrl(): string
    {
        return route('clips.serve', [
            'video' => $this->video_id,
            'clip'  => $this->id,
        ]);
    }

    /**
     * Route URL for streaming the refined export, or null if none exists.
     */
    public function getRefinedUrl(): ?string
    {
        if (!$this->refined_path) {
            return null;
        }

        return route('clips.serveRefined', [
            'video' => $this->video_id,
            'clip'  => $this->id,
        ]);
    }

    /**
     * Absolute path to the refined clip on disk.
     */
    public function getRefinedAbsolutePath(): ?string
    {
        if (!$this->refined_path) {
            return null;
        }

        return storage_path('app/' . $this->refined_path);
    }

    /**
     * Public URL for the thumbnail, or null if not generated.
     * thumbnail_path is stored as "public/thumbnails/{id}/thumb_1.jpg" (relative to storage/app/).
     * The storage symlink serves storage/app/public/** at /storage/**, so strip the leading "public/".
     */
    public function getThumbnailUrl(): ?string
    {
        if (!$this->thumbnail_path) {
            return null;
        }

        // Strip leading "public/" so asset('storage/thumbnails/...') resolves correctly.
        $relativePath = ltrim(substr($this->thumbnail_path, strlen('public')), '/');

        return asset('storage/' . $relativePath);
    }
}
