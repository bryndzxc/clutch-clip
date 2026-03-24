<?php

namespace App\Http\Controllers;

use App\Jobs\RenderMontageJob;
use App\Models\Clip;
use App\Models\Montage;
use App\Models\MontageProject;
use App\Models\Video;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;

class MontageProjectController extends Controller
{
    public function create(Video $video): InertiaResponse
    {
        abort_if(auth()->id() !== $video->user_id, 403);
        abort_if($video->status !== 'done', 422, 'Video is not yet processed.');

        return Inertia::render('MontageEditor', [
            'video'   => $this->videoPayload($video),
            'clips'   => $this->clipsPayload($video),
            'project' => null,
        ]);
    }

    public function show(MontageProject $project): InertiaResponse
    {
        abort_if(auth()->id() !== $project->user_id, 403);

        $video = $project->video;

        return Inertia::render('MontageEditor', [
            'video'   => $this->videoPayload($video),
            'clips'   => $this->clipsPayload($video),
            'project' => $this->projectPayload($project),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'video_id'                                          => ['required', 'integer', 'exists:videos,id'],
            'title'                                             => ['nullable', 'string', 'max:160'],
            'clip_order'                                        => ['nullable', 'array'],
            'clip_order.*'                                      => ['integer'],
            'clip_settings'                                     => ['nullable', 'array'],
            'clip_settings.*.effects'                           => ['nullable', 'array'],
            'clip_settings.*.effects.*.type'                    => ['required', 'string', 'in:flash,zoom-hit,glitch,shake,blur-whip,slow-mo,fire,neon-glow,speed-up,rgb-split'],
            'clip_settings.*.effects.*.start_time'              => ['required', 'numeric', 'min:0'],
            'clip_settings.*.effects.*.end_time'                => ['required', 'numeric', 'min:0'],
            'clip_settings.*.effects.*.intensity'               => ['nullable', 'numeric', 'min:0', 'max:1'],
            'title_card'                                        => ['nullable', 'array'],
            'title_card.enabled'                                => ['boolean'],
            'title_card.text'                                   => ['nullable', 'string', 'max:80'],
            'title_card.subtitle'                               => ['nullable', 'string', 'max:80'],
            'title_card.duration'                               => ['nullable', 'integer', 'min:1', 'max:10'],
            'title_card.bg_style'                               => ['nullable', 'string', 'in:clean-fade,neon-slide,pulse-zoom,gaming-flash,cinematic-reveal'],
            'title_card.animation'                              => ['nullable', 'string', 'in:fade,slide,zoom,flash,reveal'],
            'title_card.template_id'                            => ['nullable', 'string', 'in:fire-scope-reveal,blue-energy-sweep,neon-pulse-intro,glitch-reveal,cinematic-shockwave'],
            'project_settings'                                  => ['nullable', 'array'],
            'project_settings.outro_card'                       => ['nullable', 'array'],
            'project_settings.outro_card.enabled'               => ['boolean'],
            'project_settings.outro_card.text'                  => ['nullable', 'string', 'max:80'],
            'project_settings.outro_card.subtitle'              => ['nullable', 'string', 'max:80'],
            'project_settings.outro_card.duration'              => ['nullable', 'integer', 'min:1', 'max:10'],
            'project_settings.outro_card.bg_style'              => ['nullable', 'string', 'in:clean-fade,neon-slide,pulse-zoom,gaming-flash,cinematic-reveal'],
            'project_settings.outro_card.animation'             => ['nullable', 'string', 'in:fade,slide,zoom,flash,reveal'],
            'project_settings.outro_card.template_id'           => ['nullable', 'string', 'in:fire-scope-reveal,blue-energy-sweep,neon-pulse-intro,glitch-reveal,cinematic-shockwave'],
            'project_settings.aspect_ratio'                     => ['nullable', 'string', 'in:original,16:9,9:16,1:1'],
            'project_settings.quality'                          => ['nullable', 'string', 'in:standard,high,smaller'],
            'project_settings.music'                            => ['nullable', 'array'],
            'project_settings.music.track_id'                   => ['nullable', 'string', 'max:60'],
            'project_settings.music.volume'                     => ['nullable', 'numeric', 'min:0', 'max:1'],
            'project_settings.music.trim_start'                 => ['nullable', 'numeric', 'min:0'],
            'project_settings.music.fade_in'                    => ['nullable', 'numeric', 'min:0', 'max:30'],
            'project_settings.music.fade_out'                   => ['nullable', 'numeric', 'min:0', 'max:30'],
            'project_settings.music.loop'                       => ['nullable', 'boolean'],
            'project_settings.music.duck_clips'                 => ['nullable', 'boolean'],
            'project_settings.music.mute_clips_globally'        => ['nullable', 'boolean'],
        ]);

        $video = Video::findOrFail($data['video_id']);
        abort_if(auth()->id() !== $video->user_id, 403);

        $project = MontageProject::create([
            'user_id'          => auth()->id(),
            'video_id'         => $data['video_id'],
            'title'            => $data['title'] ?? 'My Montage',
            'clip_order'       => $data['clip_order'] ?? [],
            'clip_settings'    => $data['clip_settings'] ?? [],
            'title_card'       => $data['title_card'] ?? $this->defaultTitleCard(),
            'project_settings' => $data['project_settings'] ?? $this->defaultProjectSettings(),
            'status'           => 'pending',
        ]);

        return response()->json(['project' => $this->projectPayload($project)], 201);
    }

    public function update(Request $request, MontageProject $project): JsonResponse
    {
        abort_if(auth()->id() !== $project->user_id, 403);
        abort_if($project->isExporting(), 422, 'Cannot edit while export is in progress.');

        $data = $request->validate([
            'title'                                             => ['nullable', 'string', 'max:160'],
            'clip_order'                                        => ['nullable', 'array'],
            'clip_order.*'                                      => ['integer'],
            'clip_settings'                                     => ['nullable', 'array'],
            'clip_settings.*.effects'                           => ['nullable', 'array'],
            'clip_settings.*.effects.*.type'                    => ['required', 'string', 'in:flash,zoom-hit,glitch,shake,blur-whip,slow-mo,fire,neon-glow,speed-up,rgb-split'],
            'clip_settings.*.effects.*.start_time'              => ['required', 'numeric', 'min:0'],
            'clip_settings.*.effects.*.end_time'                => ['required', 'numeric', 'min:0'],
            'clip_settings.*.effects.*.intensity'               => ['nullable', 'numeric', 'min:0', 'max:1'],
            'title_card'                                        => ['nullable', 'array'],
            'title_card.enabled'                                => ['boolean'],
            'title_card.text'                                   => ['nullable', 'string', 'max:80'],
            'title_card.subtitle'                               => ['nullable', 'string', 'max:80'],
            'title_card.duration'                               => ['nullable', 'integer', 'min:1', 'max:10'],
            'title_card.bg_style'                               => ['nullable', 'string', 'in:clean-fade,neon-slide,pulse-zoom,gaming-flash,cinematic-reveal'],
            'title_card.animation'                              => ['nullable', 'string', 'in:fade,slide,zoom,flash,reveal'],
            'title_card.template_id'                            => ['nullable', 'string', 'in:fire-scope-reveal,blue-energy-sweep,neon-pulse-intro,glitch-reveal,cinematic-shockwave'],
            'project_settings'                                  => ['nullable', 'array'],
            'project_settings.outro_card'                       => ['nullable', 'array'],
            'project_settings.outro_card.enabled'               => ['boolean'],
            'project_settings.outro_card.text'                  => ['nullable', 'string', 'max:80'],
            'project_settings.outro_card.subtitle'              => ['nullable', 'string', 'max:80'],
            'project_settings.outro_card.duration'              => ['nullable', 'integer', 'min:1', 'max:10'],
            'project_settings.outro_card.bg_style'              => ['nullable', 'string', 'in:clean-fade,neon-slide,pulse-zoom,gaming-flash,cinematic-reveal'],
            'project_settings.outro_card.animation'             => ['nullable', 'string', 'in:fade,slide,zoom,flash,reveal'],
            'project_settings.outro_card.template_id'           => ['nullable', 'string', 'in:fire-scope-reveal,blue-energy-sweep,neon-pulse-intro,glitch-reveal,cinematic-shockwave'],
            'project_settings.aspect_ratio'                     => ['nullable', 'string', 'in:original,16:9,9:16,1:1'],
            'project_settings.quality'                          => ['nullable', 'string', 'in:standard,high,smaller'],
            'project_settings.music'                            => ['nullable', 'array'],
            'project_settings.music.track_id'                   => ['nullable', 'string', 'max:60'],
            'project_settings.music.volume'                     => ['nullable', 'numeric', 'min:0', 'max:1'],
            'project_settings.music.trim_start'                 => ['nullable', 'numeric', 'min:0'],
            'project_settings.music.fade_in'                    => ['nullable', 'numeric', 'min:0', 'max:30'],
            'project_settings.music.fade_out'                   => ['nullable', 'numeric', 'min:0', 'max:30'],
            'project_settings.music.loop'                       => ['nullable', 'boolean'],
            'project_settings.music.duck_clips'                 => ['nullable', 'boolean'],
            'project_settings.music.mute_clips_globally'        => ['nullable', 'boolean'],
        ]);

        $project->update([
            'title'            => $data['title']            ?? $project->title,
            'clip_order'       => $data['clip_order']       ?? $project->clip_order,
            'clip_settings'    => $data['clip_settings']    ?? $project->clip_settings,
            'title_card'       => $data['title_card']       ?? $project->title_card,
            'project_settings' => $data['project_settings'] ?? $project->project_settings,
            'status'           => 'pending',
            'error_message'    => null,
        ]);

        return response()->json(['project' => $this->projectPayload($project->refresh())]);
    }

    public function export(MontageProject $project): JsonResponse
    {
        abort_if(auth()->id() !== $project->user_id, 403);

        if ($project->isExporting()) {
            return response()->json(['message' => 'Export already in progress.'], 422);
        }

        $clipOrder = $project->clip_order ?? [];
        if (empty($clipOrder)) {
            return response()->json(['message' => 'No clips selected. Add at least one clip before exporting.'], 422);
        }

        $montage = Montage::create([
            'user_id'    => auth()->id(),
            'project_id' => $project->id,
            'title'      => $project->title,
            'status'     => 'pending',
        ]);

        $project->update([
            'status'        => 'rendering',
            'output_path'   => null,
            'error_message' => null,
            'queued_at'     => now(),
            'completed_at'  => null,
        ]);

        RenderMontageJob::dispatch($project->id, $montage->id);

        return response()->json([
            'status'       => 'pending',
            'redirect_url' => route('montages.show', $montage),
            'montage'      => [
                'id'     => $montage->id,
                'status' => $montage->status,
            ],
        ]);
    }

    public function status(MontageProject $project): JsonResponse
    {
        abort_if(auth()->id() !== $project->user_id, 403);

        return response()->json([
            'status'        => $this->normalizedProjectStatus($project->status),
            'output_url'    => $project->getOutputUrl(),
            'error_message' => $project->error_message,
        ]);
    }

    public function download(Request $request, MontageProject $project)
    {
        abort_if(auth()->id() !== $project->user_id, 403);
        abort_if(!in_array($project->status, ['completed', 'done'], true), 404, 'Montage not ready.');

        $path = $project->getOutputAbsolutePath();

        if (!$path || !file_exists($path)) {
            abort(404, 'Montage file not found.');
        }

        $size = filesize($path);
        $headers = [
            'Content-Type'        => 'video/mp4',
            'Content-Disposition' => 'attachment; filename="' . $this->safeFilename($project->title) . '.mp4"',
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

    public function destroy(MontageProject $project): JsonResponse
    {
        abort_if(auth()->id() !== $project->user_id, 403);

        $deletedPaths = [];

        foreach ($project->montages as $montage) {
            $relativePath = $montage->getOutputRelativePath();

            if ($relativePath && !in_array($relativePath, $deletedPaths, true)) {
                $montage->deleteStoredOutput();
                $deletedPaths[] = $relativePath;
            }

            $montage->delete();
        }

        $projectRelativePath = $project->getOutputRelativePath();
        if ($projectRelativePath && !in_array($projectRelativePath, $deletedPaths, true)) {
            $project->deleteStoredOutput();
        }

        // Clean up music file for the project
        $musicPath = $project->project_settings['music']['file_path'] ?? null;
        if ($musicPath) {
            Storage::disk('local')->delete($musicPath);
        }

        $project->delete();

        return response()->json(['deleted' => true]);
    }

    public function uploadMusic(Request $request, MontageProject $project): JsonResponse
    {
        abort_if(auth()->id() !== $project->user_id, 403);
        abort_if($project->isExporting(), 422, 'Cannot change music while export is in progress.');

        $request->validate([
            'music_file' => ['required', 'file', 'mimes:mp3,wav,aac,m4a,ogg,flac', 'max:51200'],
        ]);

        // Delete old file if one is stored
        $existing = $project->project_settings['music']['file_path'] ?? null;
        if ($existing) {
            Storage::disk('local')->delete($existing);
        }

        $path = $request->file('music_file')->store("music/project_{$project->id}", 'local');

        $currentSettings          = $project->project_settings ?? $this->defaultProjectSettings();
        $currentSettings['music'] = array_merge(
            $currentSettings['music'] ?? [],
            [
                'file_path'     => $path,
                'original_name' => $request->file('music_file')->getClientOriginalName(),
            ]
        );

        $project->update(['project_settings' => $currentSettings]);

        return response()->json(['music' => $currentSettings['music']]);
    }

    public function deleteMusic(MontageProject $project): JsonResponse
    {
        abort_if(auth()->id() !== $project->user_id, 403);
        abort_if($project->isExporting(), 422, 'Cannot change music while export is in progress.');

        $path = $project->project_settings['music']['file_path'] ?? null;
        if ($path) {
            Storage::disk('local')->delete($path);
        }

        $currentSettings          = $project->project_settings ?? $this->defaultProjectSettings();
        $currentSettings['music'] = array_merge(
            $currentSettings['music'] ?? [],
            ['file_path' => null, 'original_name' => null]
        );

        $project->update(['project_settings' => $currentSettings]);

        return response()->json(['music' => $currentSettings['music']]);
    }

    // ─── Private helpers ──────────────────────────────────────────────────────

    private function defaultTitleCard(): array
    {
        return ['enabled' => false, 'text' => '', 'subtitle' => '', 'duration' => 3, 'bg_style' => 'clean-fade', 'animation' => 'fade', 'template_id' => null];
    }

    private function defaultProjectSettings(): array
    {
        return [
            'outro_card'   => ['enabled' => false, 'text' => '', 'subtitle' => '', 'duration' => 3, 'bg_style' => 'clean-fade', 'animation' => 'fade', 'template_id' => null],
            'aspect_ratio' => 'original',
            'quality'      => 'high',
            'music'        => [
                'track_id'            => null,
                'file_path'           => null,
                'original_name'       => null,
                'volume'              => 0.5,
                'trim_start'          => 0,
                'fade_in'             => 0,
                'fade_out'            => 2,
                'loop'                => false,
                'duck_clips'          => false,
                'mute_clips_globally' => false,
            ],
        ];
    }

    private function videoPayload(Video $video): array
    {
        return [
            'id'            => $video->id,
            'original_name' => $video->original_name,
            'duration'      => $video->duration,
        ];
    }

    private function clipsPayload(Video $video): array
    {
        return $video->clips->map(fn (Clip $clip) => [
            'id'            => $clip->id,
            'url'           => $clip->getUrl(),
            'refined_url'   => $clip->getRefinedUrl(),
            'thumbnail_url' => $clip->getThumbnailUrl(),
            'duration'      => (float) $clip->duration,
            'score'         => $clip->score,
            'start_time'    => $clip->start_time,
            'end_time'      => $clip->end_time,
            'label'         => $clip->label,
        ])->values()->all();
    }

    private function projectPayload(MontageProject $project): array
    {
        return [
            'id'               => $project->id,
            'title'            => $project->title,
            'clip_order'       => $project->clip_order       ?? [],
            'clip_settings'    => $project->clip_settings    ?? [],
            'title_card'       => $project->title_card       ?? $this->defaultTitleCard(),
            'project_settings' => $project->project_settings ?? $this->defaultProjectSettings(),
            'status'           => $this->normalizedProjectStatus($project->status),
            'output_url'       => $project->getOutputUrl(),
            'error_message'    => $project->error_message,
        ];
    }

    private function normalizedProjectStatus(?string $status): ?string
    {
        return match ($status) {
            'queued', 'processing' => 'rendering',
            'done'                 => 'completed',
            default                => $status,
        };
    }

    private function safeFilename(string $title): string
    {
        $safe = preg_replace('/[^\w\s-]/', '', $title);
        $safe = preg_replace('/\s+/', '_', trim($safe));

        return $safe ?: 'montage';
    }
}
