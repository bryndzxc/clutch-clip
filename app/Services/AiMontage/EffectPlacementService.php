<?php

namespace App\Services\AiMontage;

/**
 * Builds per-clip settings (trim, transition, effects) for an AI-generated draft.
 *
 * Effect placement mirrors the timing logic used in the MontageEditor frontend
 * (getClipHighlightOffset) so effects land on the actual action moment.
 *
 * Effect types supported by the render pipeline:
 *   flash | zoom-hit | glitch | shake | blur-whip | slow-mo | fire | neon-glow | speed-up | rgb-split
 */
class EffectPlacementService
{
    /** Effects the AI is allowed to use per mode. */
    private const ALLOWED_EFFECTS = [
        'auto'      => ['zoom-hit', 'flash', 'shake'],
        'flashy'    => ['zoom-hit', 'flash', 'shake', 'glitch', 'rgb-split', 'blur-whip'],
        'cinematic' => ['slow-mo', 'blur-whip'],
        'clean'     => ['zoom-hit'],
    ];

    private const TRANSITION_TYPE = [
        'auto'      => 'cut',
        'flashy'    => 'cut',
        'cinematic' => 'fade',
        'clean'     => 'fade',
    ];

    private const TRANSITION_DURATION = [
        'auto'      => 0.3,
        'flashy'    => 0.2,
        'cinematic' => 0.8,
        'clean'     => 0.5,
    ];

    /**
     * Build the full clip_settings entry for one clip.
     *
     * @param  array   $clip  ['id', 'duration', 'score', 'label']
     * @param  string  $mode
     */
    public function buildClipSettings(array $clip, string $mode): array
    {
        $duration = (float) ($clip['duration'] ?? 0);
        $score    = (float) ($clip['score']    ?? 0);

        [$trimStart, $trimEnd] = $this->computeTrim($duration, $score, $mode);

        return [
            'trim_start'   => $trimStart,
            'trim_end'     => $trimEnd,
            'muted'        => false,
            'volume'       => 1.0,
            'fade_in'      => 0,
            'fade_out'     => 0,
            'speed'        => 1.0,
            'brightness'   => 0,
            'contrast'     => $mode === 'cinematic' ? 0.1  : 0,
            'saturation'   => $mode === 'flashy'    ? 0.1  : 0,
            'text_overlay' => [
                'enabled'   => false,
                'text'      => '',
                'size'      => 'md',
                'position'  => 'bottom',
                'color'     => 'white',
                'animation' => 'none',
                'bgBox'     => true,
            ],
            'transition' => [
                'type'     => self::TRANSITION_TYPE[$mode]     ?? 'cut',
                'duration' => self::TRANSITION_DURATION[$mode] ?? 0.3,
            ],
            'effect_preset' => null,
            'effects'       => $this->placeEffects($clip, $trimStart, $trimEnd, $mode),
        ];
    }

    // ─── Trim logic ───────────────────────────────────────────────────────────

    /**
     * Optionally trim a small opening on high-scoring clips to tighten pacing.
     * Never trims if the clip is short (< 6 s) to avoid over-cutting.
     *
     * @return array [trimStart, trimEnd]
     */
    private function computeTrim(float $duration, float $score, string $mode): array
    {
        $trimStart = 0.0;
        $trimEnd   = round($duration, 2);

        if ($mode !== 'cinematic' && $score > 0.72 && $duration > 6) {
            // Strip roughly 8 % of lead-up footage to sharpen the opening.
            $trimStart = round($duration * 0.08, 2);
        }

        return [$trimStart, $trimEnd];
    }

    // ─── Effect placement ─────────────────────────────────────────────────────

    private function placeEffects(array $clip, float $trimStart, float $trimEnd, string $mode): array
    {
        $allowed  = self::ALLOWED_EFFECTS[$mode] ?? ['zoom-hit'];
        $score    = (float) ($clip['score'] ?? 0);
        $label    = strtolower($clip['label'] ?? '');
        $clipLen  = max(0.1, $trimEnd - $trimStart);

        $highlightT = $this->highlightOffset($label, $trimStart, $trimEnd, $clipLen);

        $effects = [];

        // ── Primary impact effect at the action moment ──
        if (in_array('zoom-hit', $allowed, true)) {
            $effects[] = $this->effect('zoom-hit', $highlightT, $highlightT + 0.4, min(1.0, 0.55 + $score * 0.45));
        } elseif (in_array('slow-mo', $allowed, true)) {
            // Cinematic: slow-mo stretches the moment rather than punching it.
            $effects[] = $this->effect('slow-mo', $highlightT, $highlightT + 1.5, 0.7);
        }

        // ── Secondary effects for high-energy modes ──
        if ($mode === 'flashy' && $score > 0.55) {
            if (in_array('flash', $allowed, true)) {
                $effects[] = $this->effect('flash', max($trimStart, $highlightT - 0.1), $highlightT + 0.3, 0.7);
            }
            if (in_array('shake', $allowed, true) && $score > 0.72) {
                $effects[] = $this->effect('shake', max($trimStart, $highlightT - 0.05), $highlightT + 0.5, 0.5);
            }
        }

        // ── Glitch on ace/kill clips in flashy mode ──
        if ($mode === 'flashy' && $score > 0.80 && $this->isHighAction($label)) {
            if (in_array('glitch', $allowed, true)) {
                $effects[] = $this->effect('glitch', max($trimStart, $highlightT - 0.2), $highlightT + 0.2, 0.6);
            }
        }

        // ── RGB split on top-tier flashy clips ──
        if ($mode === 'flashy' && $score > 0.90) {
            if (in_array('rgb-split', $allowed, true)) {
                $effects[] = $this->effect('rgb-split', max($trimStart, $highlightT - 0.15), $highlightT + 0.15, 0.5);
            }
        }

        // ── Cinematic blur-whip transition out ──
        if ($mode === 'cinematic' && in_array('blur-whip', $allowed, true) && $clipLen > 3) {
            $whipT     = max($trimStart, $trimEnd - 0.5);
            $effects[] = $this->effect('blur-whip', $whipT, $trimEnd, 0.6);
        }

        return $effects;
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    /**
     * Mirrors the editor's getClipHighlightOffset logic.
     * Gaming highlight clips have lead-up footage; the peak action lands at ~35–42 %.
     */
    private function highlightOffset(string $label, float $trimStart, float $trimEnd, float $clipLen): float
    {
        $factor = match (true) {
            str_contains($label, 'kill')   => 0.35,
            str_contains($label, 'clutch') => 0.42,
            str_contains($label, 'multi')  => 0.38,
            default                        => 0.40,
        };

        $raw = $trimStart + $clipLen * $factor;

        // Keep at least 0.1 s of buffer from each edge so effects don't clip out.
        return (float) round(max($trimStart + 0.1, min($trimEnd - 0.5, $raw)), 2);
    }

    private function isHighAction(string $label): bool
    {
        return str_contains($label, 'kill')
            || str_contains($label, 'ace')
            || str_contains($label, 'clutch');
    }

    private function effect(string $type, float $start, float $end, float $intensity): array
    {
        return [
            'type'       => $type,
            'start_time' => (float) round($start, 2),
            'end_time'   => (float) round(max($start + 0.05, $end), 2),
            'intensity'  => (float) round(min(1.0, max(0.0, $intensity)), 2),
        ];
    }
}
