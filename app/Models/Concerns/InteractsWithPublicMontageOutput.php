<?php

namespace App\Models\Concerns;

use Illuminate\Support\Facades\Storage;

trait InteractsWithPublicMontageOutput
{
    public function getOutputRelativePath(): ?string
    {
        if (!$this->output_path) {
            return null;
        }

        $path = ltrim($this->output_path, '/');

        if (str_starts_with($path, 'public/')) {
            $path = substr($path, strlen('public/'));
        }

        return ltrim($path, '/');
    }

    public function getOutputAbsolutePath(): ?string
    {
        $relativePath = $this->getOutputRelativePath();

        return $relativePath ? Storage::disk('public')->path($relativePath) : null;
    }

    public function getPublicOutputUrl(): ?string
    {
        $relativePath = $this->getOutputRelativePath();

        return $relativePath ? Storage::disk('public')->url($relativePath) : null;
    }

    public function deleteStoredOutput(): void
    {
        $relativePath = $this->getOutputRelativePath();

        if ($relativePath && Storage::disk('public')->exists($relativePath)) {
            Storage::disk('public')->delete($relativePath);
        }
    }
}
