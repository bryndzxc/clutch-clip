<?php

namespace App\Models;

use App\Models\Concerns\InteractsWithPublicMontageOutput;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Montage extends Model
{
    use InteractsWithPublicMontageOutput;

    protected $fillable = [
        'user_id',
        'project_id',
        'title',
        'output_path',
        'status',
        'duration',
        'file_size',
        'error_message',
    ];

    protected function casts(): array
    {
        return [
            'duration'  => 'float',
            'file_size' => 'integer',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(MontageProject::class, 'project_id');
    }

    public function getOutputUrl(): ?string
    {
        if ($this->status !== 'completed') {
            return null;
        }

        return $this->getPublicOutputUrl();
    }

    public function getFilename(): string
    {
        $relativePath = $this->getOutputRelativePath();

        if ($relativePath) {
            return basename($relativePath);
        }

        return "montage-{$this->id}.mp4";
    }
}
