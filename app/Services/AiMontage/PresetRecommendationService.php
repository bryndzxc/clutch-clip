<?php

namespace App\Services\AiMontage;

/**
 * Maps an AI mode to concrete preset values for music, title card, and export settings.
 *
 * All values reference keys that are already validated by MontageProjectController:
 *   music.track_id      → energy-pulse | neon-nights | clutch-moment | smooth-grind | flash-zone
 *   title_card.bg_style → clean-fade | neon-slide | pulse-zoom | gaming-flash | cinematic-reveal
 *   title_card.animation→ fade | slide | zoom | flash | reveal
 *   title_card.template_id → fire-scope-reveal | blue-energy-sweep | neon-pulse-intro | glitch-reveal | cinematic-shockwave
 *   quality             → standard | high | smaller
 */
class PresetRecommendationService
{
    private const MUSIC = [
        'auto'      => 'energy-pulse',
        'flashy'    => 'flash-zone',
        'cinematic' => 'neon-nights',
        'clean'     => 'smooth-grind',
    ];

    private const TITLE_CARD = [
        'auto' => [
            'bg_style'    => 'pulse-zoom',
            'animation'   => 'zoom',
            'template_id' => 'neon-pulse-intro',
            'duration'    => 3,
        ],
        'flashy' => [
            'bg_style'    => 'gaming-flash',
            'animation'   => 'flash',
            'template_id' => 'glitch-reveal',
            'duration'    => 2,
        ],
        'cinematic' => [
            'bg_style'    => 'cinematic-reveal',
            'animation'   => 'reveal',
            'template_id' => 'cinematic-shockwave',
            'duration'    => 5,
        ],
        'clean' => [
            'bg_style'    => 'clean-fade',
            'animation'   => 'fade',
            'template_id' => 'blue-energy-sweep',
            'duration'    => 3,
        ],
    ];

    /** Music volume level per mode (0–1). */
    private const MUSIC_VOLUME = [
        'auto'      => 0.55,
        'flashy'    => 0.65,
        'cinematic' => 0.40,
        'clean'     => 0.50,
    ];

    private const QUALITY = [
        'auto'      => 'high',
        'flashy'    => 'high',
        'cinematic' => 'high',
        'clean'     => 'standard',
    ];

    // ─── Public API ───────────────────────────────────────────────────────────

    /**
     * Build the title_card array ready to be stored on MontageProject.
     */
    public function titleCard(string $mode, string $title, string $subtitle): array
    {
        $preset = self::TITLE_CARD[$mode] ?? self::TITLE_CARD['auto'];

        return [
            'enabled'     => true,
            'text'        => $title,
            'subtitle'    => $subtitle,
            'duration'    => $preset['duration'],
            'bg_style'    => $preset['bg_style'],
            'animation'   => $preset['animation'],
            'template_id' => $preset['template_id'],
        ];
    }

    /**
     * Build the project_settings array ready to be stored on MontageProject.
     */
    public function projectSettings(string $mode): array
    {
        return [
            'outro_card' => [
                'enabled'     => false,
                'text'        => '',
                'subtitle'    => '',
                'duration'    => 3,
                'bg_style'    => 'clean-fade',
                'animation'   => 'fade',
                'template_id' => null,
            ],
            'aspect_ratio' => 'original',
            'quality'      => self::QUALITY[$mode] ?? 'high',
            'music'        => [
                'track_id'            => self::MUSIC[$mode] ?? 'energy-pulse',
                'file_path'           => null,
                'original_name'       => null,
                'volume'              => self::MUSIC_VOLUME[$mode] ?? 0.55,
                'trim_start'          => 0,
                'fade_in'             => $mode === 'cinematic' ? 2.0 : 0.0,
                'fade_out'            => $mode === 'cinematic' ? 3.0 : 2.0,
                'loop'                => false,
                'duck_clips'          => false,
                'mute_clips_globally' => false,
            ],
        ];
    }
}
