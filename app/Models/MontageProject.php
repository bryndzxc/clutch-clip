<?php

namespace App\Models;

use App\Models\Concerns\InteractsWithPublicMontageOutput;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class MontageProject extends Model
{
    use InteractsWithPublicMontageOutput;

    protected $fillable = [
        'user_id',
        'video_id',
        'title',
        'clip_order',
        'clip_settings',
        'title_card',
        'project_settings',
        'status',
        'last_edited_at',
        'output_path',
        'error_message',
        'queued_at',
        'completed_at',
    ];

    protected function casts(): array
    {
        return [
            'clip_order'       => 'array',
            'clip_settings'    => 'array',
            'title_card'       => 'array',
            'project_settings' => 'array',
            'last_edited_at'   => 'datetime',
            'queued_at'        => 'datetime',
            'completed_at'     => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function video(): BelongsTo
    {
        return $this->belongsTo(Video::class);
    }

    public function montages(): HasMany
    {
        return $this->hasMany(Montage::class, 'project_id');
    }

    public function getOutputUrl(): ?string
    {
        if (!$this->output_path || !in_array($this->status, ['completed', 'done'], true)) {
            return null;
        }

        return route('montage-projects.download', $this->id);
    }

    public function isExporting(): bool
    {
        return in_array($this->status, ['rendering', 'queued', 'processing'], true);
    }
}
