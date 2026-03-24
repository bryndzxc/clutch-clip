<?php

namespace App\Services\AiMontage;

use App\Models\Video;

/**
 * Orchestrates the four sub-services to produce a complete montage draft.
 *
 * The returned array matches the shape expected by MontageProjectController::store()
 * plus an `ai_meta` block that the controller strips before persisting.
 *
 * Draft structure
 * ───────────────
 * {
 *   mode             : string           – 'auto' | 'flashy' | 'cinematic' | 'clean'
 *   title            : string           – generated montage title
 *   clip_order       : int[]            – ordered clip IDs
 *   clip_settings    : { "<id>": {...} }– per-clip trim/effects/transitions
 *   title_card       : { ... }          – intro card settings
 *   project_settings : { ... }          – music, quality, aspect ratio, outro
 *   ai_meta          : { ... }          – generation metadata (not persisted)
 * }
 */
class AiMontageDraftService
{
    public function __construct(
        private readonly ClipRankingService         $clipRanker,
        private readonly EffectPlacementService     $effectPlacer,
        private readonly PresetRecommendationService $presets,
        private readonly TitleGenerationService     $titleGen,
    ) {}

    /**
     * Generate a full montage draft for the given video and AI mode.
     *
     * @param  Video   $video
     * @param  string  $mode  'auto' | 'flashy' | 'cinematic' | 'clean'
     * @return array
     */
    public function generate(Video $video, string $mode): array
    {
        $allClips = $video->clips;

        // 1. Select and order the best clips.
        $selected = $this->clipRanker->selectAndOrder($allClips, $mode);

        // 2. Build clip_order as an array of integer IDs.
        $clipOrder = $selected->pluck('id')->map(fn ($id) => (int) $id)->values()->all();

        // 3. Build clip_settings keyed by string clip ID.
        $clipSettings = [];
        foreach ($selected as $clip) {
            $clipSettings[(string) $clip->id] = $this->effectPlacer->buildClipSettings([
                'id'       => $clip->id,
                'duration' => (float) $clip->duration,
                'score'    => (float) ($clip->score ?? 0),
                'label'    => $clip->label ?? '',
            ], $mode);
        }

        // 4. Generate title / subtitle text.
        $text = $this->titleGen->generate($selected, $mode, $video->original_name ?? '');

        // 5. Build title card and project settings from mode presets.
        $titleCard       = $this->presets->titleCard($mode, $text['title'], $text['subtitle']);
        $projectSettings = $this->presets->projectSettings($mode);

        return [
            'mode'             => $mode,
            'title'            => $text['title'],
            'clip_order'       => $clipOrder,
            'clip_settings'    => $clipSettings,
            'title_card'       => $titleCard,
            'project_settings' => $projectSettings,
            'ai_meta'          => [
                'mode'             => $mode,
                'clips_considered' => $allClips->count(),
                'clips_selected'   => count($clipOrder),
                'generated_at'     => now()->toIso8601String(),
            ],
        ];
    }
}
