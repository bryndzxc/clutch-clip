<?php

namespace App\Http\Controllers;

use App\Models\Montage;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
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

    public function stream(Request $request, Montage $montage)
    {
        abort_if(auth()->id() !== $montage->user_id, 403);
        abort_if($montage->status !== 'completed', 404, 'Montage not ready.');

        $path = $montage->getOutputAbsolutePath();

        if (!$path || !file_exists($path)) {
            abort(404, 'Montage file not found.');
        }

        $size = filesize($path);
        $headers = [
            'Content-Type'        => 'video/mp4',
            'Content-Disposition' => 'inline; filename="' . basename($path) . '"',
            'Accept-Ranges'       => 'bytes',
        ];

        $range = $request->header('Range');
        if ($range) {
            preg_match('/bytes=(\d+)-(\d*)/', $range, $matches);
            $start  = (int) $matches[1];
            $end    = isset($matches[2]) && $matches[2] !== '' ? (int) $matches[2] : $size - 1;
            $length = $end - $start + 1;

            $headers['Content-Range']  = "bytes {$start}-{$end}/{$size}";
            $headers['Content-Length'] = $length;

            return response()->stream(function () use ($path, $start, $length) {
                $fp = fopen($path, 'rb');
                fseek($fp, $start);
                echo fread($fp, $length);
                fclose($fp);
            }, 206, $headers);
        }

        $headers['Content-Length'] = $size;

        return response()->file($path, $headers);
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
            'output_path'   => $montage->status === 'completed' ? route('montages.stream', $montage) : null,
            'download_url'  => $montage->status === 'completed' ? route('montages.stream', $montage) : null,
            'created_at'    => $montage->created_at?->toIso8601String(),
            'duration'      => $montage->duration !== null ? (float) $montage->duration : null,
            'file_size'     => $montage->file_size,
            'error_message' => $montage->error_message,
        ];
    }
}
