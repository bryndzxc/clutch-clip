<?php

namespace App\Http\Controllers;

use App\Models\MontageProject;
use App\Models\Video;
use App\Services\AiMontage\AiMontageDraftService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AiMontageController extends Controller
{
    public function __construct(private readonly AiMontageDraftService $draftService) {}

    /**
     * Generate an AI montage draft, persist it as a MontageProject, and return
     * the redirect URL so the frontend can drop the user straight into the editor.
     *
     * POST /videos/{video}/ai-montage
     *
     * Request body (all optional):
     *   mode  string  'auto' | 'flashy' | 'cinematic' | 'clean'  (default: 'auto')
     *
     * Success 201:
     *   project_id   int     – newly created MontageProject ID
     *   redirect_url string  – editor URL for the new project
     *   ai_meta      object  – generation metadata
     *
     * Error 422:
     *   message  string  – human-readable reason
     */
    public function generate(Request $request, Video $video): JsonResponse
    {
        abort_if(auth()->id() !== $video->user_id, 403);
        abort_if($video->status !== 'done', 422, 'Video is not yet processed.');

        $data = $request->validate([
            'mode' => ['nullable', 'string', 'in:auto,flashy,cinematic,clean'],
        ]);

        $mode  = $data['mode'] ?? 'auto';
        $draft = $this->draftService->generate($video, $mode);

        if (empty($draft['clip_order'])) {
            return response()->json([
                'message' => 'No suitable clips found. Upload and process a video with at least one detected highlight.',
            ], 422);
        }

        $project = MontageProject::create([
            'user_id'          => auth()->id(),
            'video_id'         => $video->id,
            'title'            => $draft['title'],
            'clip_order'       => $draft['clip_order'],
            'clip_settings'    => $draft['clip_settings'],
            'title_card'       => $draft['title_card'],
            'project_settings' => $draft['project_settings'],
            'status'           => 'pending',
            'last_edited_at'   => now(),
        ]);

        return response()->json([
            'project_id'   => $project->id,
            'redirect_url' => route('montage-projects.show', $project),
            'ai_meta'      => $draft['ai_meta'],
        ], 201);
    }
}
