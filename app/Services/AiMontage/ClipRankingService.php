<?php

namespace App\Services\AiMontage;

use Illuminate\Support\Collection;

/**
 * Selects and orders clips for an AI-generated montage draft.
 *
 * Scoring breakdown (totals 1.0):
 *   0.60 – raw clip score (already 0–1 from the detection pipeline)
 *   0.25 – duration sweet-spot (5–15 s is ideal for montage pacing)
 *   0.15 – label priority (ace/kill/clutch outrank generic highlights)
 */
class ClipRankingService
{
    /** Maximum clips to include per mode. */
    private const MODE_MAX_CLIPS = [
        'auto'      => 6,
        'flashy'    => 8,
        'cinematic' => 5,
        'clean'     => 5,
    ];

    /**
     * [min, max] total montage duration budget in seconds per mode.
     * Clips that would push past the max are dropped (unless fewer than 2 are selected).
     */
    private const MODE_DURATION_BUDGET = [
        'auto'      => [20, 90],
        'flashy'    => [15, 60],
        'cinematic' => [30, 120],
        'clean'     => [20, 90],
    ];

    /**
     * Select and order the best clips for the given mode.
     *
     * @param  Collection  $clips  Collection of Clip Eloquent models
     * @param  string      $mode
     * @return Collection  Ordered subset of clips
     */
    public function selectAndOrder(Collection $clips, string $mode): Collection
    {
        if ($clips->isEmpty()) {
            return collect();
        }

        // Score every clip, then sort descending so we always pick top-ranked first.
        $scored = $clips
            ->map(fn ($clip) => ['clip' => $clip, 'score' => $this->compositeScore($clip)])
            ->sortByDesc('score')
            ->values();

        $maxClips = self::MODE_MAX_CLIPS[$mode] ?? 6;
        $budget   = self::MODE_DURATION_BUDGET[$mode] ?? [20, 90];

        $selected = $this->pickWithBudget($scored, $maxClips, $budget);

        return $this->order($selected, $mode);
    }

    // ─── Composite scoring ────────────────────────────────────────────────────

    private function compositeScore($clip): float
    {
        $raw      = (float) ($clip->score    ?? 0);
        $duration = (float) ($clip->duration ?? 0);
        $label    = strtolower($clip->label  ?? '');

        return 0.60 * $raw
             + 0.25 * $this->durationScore($duration)
             + 0.15 * $this->labelPriority($label);
    }

    private function durationScore(float $sec): float
    {
        if ($sec < 2)   return 0.0;
        if ($sec < 5)   return 0.3;
        if ($sec <= 15) return 1.0;
        if ($sec <= 25) return 0.7;
        return 0.4;
    }

    private function labelPriority(string $label): float
    {
        if (str_contains($label, 'ace'))    return 1.00;
        if (str_contains($label, 'penta'))  return 1.00;
        if (str_contains($label, 'kill'))   return 0.95;
        if (str_contains($label, 'clutch')) return 0.90;
        if (str_contains($label, 'multi'))  return 0.85;
        if (str_contains($label, 'quad'))   return 0.85;
        return 0.50;
    }

    // ─── Selection ────────────────────────────────────────────────────────────

    /**
     * Greedily pick the top-scored clips while staying inside the duration budget.
     *
     * @param  Collection  $scored   [{clip, score}, …] sorted desc by score
     * @param  int         $maxClips
     * @param  array       $budget   [minSec, maxSec]
     */
    private function pickWithBudget(Collection $scored, int $maxClips, array $budget): Collection
    {
        $selected = collect();
        $totalDur = 0.0;
        $maxSec   = $budget[1];

        foreach ($scored as $item) {
            if ($selected->count() >= $maxClips) {
                break;
            }

            $dur = (float) ($item['clip']->duration ?? 0);

            // Allow at least 2 clips even if they exceed budget (better than empty montage).
            if ($totalDur + $dur > $maxSec && $selected->count() >= 2) {
                break;
            }

            $selected->push($item['clip']);
            $totalDur += $dur;
        }

        return $selected;
    }

    // ─── Ordering ─────────────────────────────────────────────────────────────

    private function order(Collection $clips, string $mode): Collection
    {
        if ($clips->count() <= 1) {
            return $clips->values();
        }

        return match ($mode) {
            // Front-loaded: highest-scored clips play first (immediate impact).
            'flashy'    => $clips->sortByDesc(fn ($c) => (float) ($c->score ?? 0))->values(),
            // Gradual ascent: weakest opens, strongest closes.
            'cinematic' => $clips->sortBy(fn ($c) => (float) ($c->score ?? 0))->values(),
            // Chronological: preserves the game's natural narrative.
            'clean'     => $clips->sortBy(fn ($c) => (float) ($c->start_time ?? 0))->values(),
            // Dramatic arc: mid-tier opener → filler → best clip last.
            default     => $this->dramaticArc($clips),
        };
    }

    /**
     * Builds a "save-the-best-for-last" arc:
     *   [second-best, rest in score order, best]
     */
    private function dramaticArc(Collection $clips): Collection
    {
        if ($clips->count() < 3) {
            return $clips->values();
        }

        $sorted = $clips->sortByDesc(fn ($c) => (float) ($c->score ?? 0))->values();
        $best   = $sorted->shift();   // #1 – saved for the end
        $second = $sorted->shift();   // #2 – used as opener

        // [second, ...rest (weakest→stronger), best]
        return collect([$second])->concat($sorted)->push($best)->values();
    }
}
