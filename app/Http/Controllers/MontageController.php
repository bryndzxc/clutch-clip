<?php

namespace App\Http\Controllers;

use App\Models\Montage;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;

class MontageController extends Controller
{
    public function index(): InertiaResponse
    {
        $montages = Montage::query()
            ->where('user_id', auth()->id())
            ->latest()
            ->get()
            ->map(fn (Montage $montage) => $this->montagePayload($montage))
            ->values()
            ->all();

        return Inertia::render('Montages/Index', [
            'montages' => $montages,
        ]);
    }

    public function show(Montage $montage): InertiaResponse
    {
        abort_if(auth()->id() !== $montage->user_id, 403);

        return Inertia::render('Montages/Show', [
            'montage' => $this->montagePayload($montage),
        ]);
    }

    public function destroy(Montage $montage): RedirectResponse
    {
        abort_if(auth()->id() !== $montage->user_id, 403);

        $project = $montage->project;
        $deletedRelativePath = $montage->getOutputRelativePath();

        $montage->deleteStoredOutput();
        $montage->delete();

        if ($project && $deletedRelativePath && $project->getOutputRelativePath() === $deletedRelativePath) {
            $project->update([
                'output_path'   => null,
                'status'        => 'pending',
                'completed_at'  => null,
                'error_message' => null,
            ]);
        }

        return redirect()->route('montages.index');
    }

    private function montagePayload(Montage $montage): array
    {
        return [
            'id'            => $montage->id,
            'project_id'    => $montage->project_id,
            'title'         => $montage->title,
            'filename'      => $montage->getFilename(),
            'status'        => $montage->status,
            'output_path'   => $montage->getOutputUrl(),
            'download_url'  => $montage->getOutputUrl(),
            'created_at'    => $montage->created_at?->toIso8601String(),
            'duration'      => $montage->duration !== null ? (float) $montage->duration : null,
            'file_size'     => $montage->file_size,
            'error_message' => $montage->error_message,
        ];
    }
}
