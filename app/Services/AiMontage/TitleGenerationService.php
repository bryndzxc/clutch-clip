<?php

namespace App\Services\AiMontage;

use Illuminate\Support\Collection;

/**
 * Generates a title and subtitle for the AI montage draft.
 *
 * V1 uses deterministic label-matching rules.
 * No external LLM calls are made.
 */
class TitleGenerationService
{
    private const SUBTITLES = [
        'auto'      => 'Best Moments · ClutchClip',
        'flashy'    => 'Insane Highlights · ClutchClip',
        'cinematic' => 'Epic Plays · ClutchClip',
        'clean'     => 'Top Plays · ClutchClip',
    ];

    /**
     * Return ['title' => string, 'subtitle' => string].
     *
     * @param  Collection  $clips     Selected Clip models
     * @param  string      $mode
     * @param  string      $videoName Original filename (used for fallbacks)
     */
    public function generate(Collection $clips, string $mode, string $videoName = ''): array
    {
        $labels = $clips
            ->map(fn ($c) => strtolower($c->label ?? ''))
            ->filter()
            ->values();

        $title    = $this->pickTitle($labels, $mode);
        $subtitle = self::SUBTITLES[$mode] ?? 'Highlights · ClutchClip';

        return ['title' => $title, 'subtitle' => $subtitle];
    }

    // ─── Title selection ──────────────────────────────────────────────────────

    private function pickTitle(Collection $labels, string $mode): string
    {
        $hasAce    = $labels->contains(fn ($l) => str_contains($l, 'ace')   || str_contains($l, 'penta'));
        $hasKill   = $labels->contains(fn ($l) => str_contains($l, 'kill'));
        $hasClutch = $labels->contains(fn ($l) => str_contains($l, 'clutch'));
        $hasMulti  = $labels->contains(fn ($l) => str_contains($l, 'multi') || str_contains($l, 'quad'));

        return match (true) {
            // ── Cinematic mode titles ──
            $mode === 'cinematic' && $hasAce                  => 'Cinematic ACE',
            $mode === 'cinematic' && $hasKill && $hasClutch   => 'The Defining Moments',
            $mode === 'cinematic' && $hasKill                 => 'Cinematic Kill Reel',
            $mode === 'cinematic'                             => 'The Highlight Reel',

            // ── Flashy mode titles ──
            $mode === 'flashy' && $hasAce                     => 'ACE OR DIE',
            $mode === 'flashy' && $hasKill && $hasClutch      => 'CLUTCH KILLS',
            $mode === 'flashy' && $hasKill                    => 'KILL MONTAGE',
            $mode === 'flashy' && $hasMulti                   => 'MULTI-KILL FRENZY',
            $mode === 'flashy'                                => 'INSANE HIGHLIGHTS',

            // ── Clean mode titles ──
            $mode === 'clean' && $hasClutch                   => 'Clutch Moments',
            $mode === 'clean' && $hasKill                     => 'Kill Highlights',
            $mode === 'clean'                                  => 'Top Plays',

            // ── Auto / fallback titles ──
            $hasAce                                            => 'ACE Montage',
            $hasKill && $hasClutch                            => 'Clutch Kills',
            $hasKill                                           => 'Kill Highlights',
            $hasClutch                                         => 'Clutch Moments',
            $hasMulti                                          => 'Multi-Kill Montage',
            default                                            => 'Epic Highlights',
        };
    }
}
