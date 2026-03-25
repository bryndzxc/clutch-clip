<?php

namespace App\Jobs;

use App\Models\Clip;
use App\Models\Montage;
use App\Models\MontageProject;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Process;
use Illuminate\Support\Facades\Storage;

class RenderMontageJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $timeout = 900;

    /** Known built-in track IDs — any value not in this list is rejected. */
    private const BUILTIN_TRACK_IDS = [
        'energy-pulse',
        'neon-nights',
        'clutch-moment',
        'smooth-grind',
        'flash-zone',
    ];

    public function __construct(public int $projectId, public int $montageId)
    {
    }

    public function handle(): void
    {
        $project = MontageProject::with('video.clips')->findOrFail($this->projectId);
        $montage = Montage::find($this->montageId);

        $project->update(['status' => 'rendering', 'error_message' => null]);
        $montage?->update([
            'title'         => $project->title,
            'status'        => 'rendering',
            'error_message' => null,
            'output_path'   => null,
            'duration'      => null,
            'file_size'     => null,
        ]);

        Log::info("[RenderMontageJob] Starting render for project #{$project->id}");

        $clipOrder       = $project->clip_order       ?? [];
        $clipSettings    = $project->clip_settings    ?? [];
        $titleCard       = $project->title_card       ?? [];
        $projectSettings = $project->project_settings ?? [];

        // ── Project-level settings ────────────────────────────────────────────
        $outroCard   = $projectSettings['outro_card']   ?? ['enabled' => false];
        $aspectRatio = $projectSettings['aspect_ratio'] ?? 'original';
        $quality     = $projectSettings['quality']      ?? 'high';
        $music       = $projectSettings['music']        ?? [];

        $muteGlobally = !empty($music['mute_clips_globally']);
        $duckClips    = !empty($music['duck_clips']) && !$muteGlobally;

        [$crf, $preset, $audioBitrate] = $this->qualityParams($quality);

        $tmpDir = storage_path("app/tmp/montages/{$project->id}");
        @mkdir($tmpDir, 0755, true);

        if (empty($clipOrder)) {
            $this->fail($project, $montage, 'No clips selected for montage.', $tmpDir);
            return;
        }

        $clipsMap = $project->video->clips->keyBy('id');

        $segments         = [];
        $segmentDurations = [];   // float[] — rendered duration of each segment (parallel to $segments)
        $segmentSources   = [];   // string[] — 'intro' | 'clip:{id}' | 'outro' (parallel to $segments)
        $renderedDuration = 0.0;

        // ── Intro title card ──────────────────────────────────────────────────
        if (!empty($titleCard['enabled'])) {
            $cardDuration = max(1, min(10, (int) ($titleCard['duration'] ?? 3)));
            $seg = $this->renderCard(
                "{$tmpDir}/intro_card.mp4",
                $titleCard['text']        ?? '',
                $titleCard['subtitle']    ?? '',
                $cardDuration,
                $titleCard['bg_style']    ?? 'clean-fade',
                $titleCard['animation']   ?? 'fade',
                $aspectRatio, $crf, $preset, $audioBitrate,
                $titleCard['template_id'] ?? null
            );
            if ($seg) {
                $segments[]         = $seg;
                $segmentDurations[] = (float) $cardDuration;
                $segmentSources[]   = 'intro';
                $renderedDuration  += $cardDuration;
            }
        }

        // ── Clip segments ─────────────────────────────────────────────────────
        $clipCount = count($clipOrder);

        foreach ($clipOrder as $i => $clipId) {
            /** @var Clip|null $clip */
            $clip = $clipsMap[$clipId] ?? null;
            if (!$clip) {
                Log::warning("[RenderMontageJob] Clip #{$clipId} not found, skipping.");
                continue;
            }

            $sourcePath = $this->resolveClipPath($clip);
            if (!$sourcePath) {
                Log::warning("[RenderMontageJob] Clip #{$clipId} file missing, skipping.");
                continue;
            }

            $settings = $clipSettings[$clipId] ?? $clipSettings[(string) $clipId] ?? [];

            // Trim (clamped to source duration)
            $clipDur   = (float) $clip->duration;
            $trimStart = (float) ($settings['trim_start'] ?? 0);
            $trimEnd   = (float) ($settings['trim_end']   ?? $clipDur);
            $trimStart = max(0.0, min($trimStart, $clipDur - 0.5));
            $trimEnd   = max($trimStart + 0.5, min($trimEnd, $clipDur));

            // Audio
            $muted      = !empty($settings['muted']) || $muteGlobally;
            $volume     = (float) ($settings['volume']   ?? 1.0);
            $audioFadeIn  = (float) ($settings['fade_in']  ?? 0.0);
            $audioFadeOut = (float) ($settings['fade_out'] ?? 0.0);
            if ($duckClips && !$muted) {
                $volume *= 0.3;
            }

            // Speed (0.5–2.0; clamped to atempo-compatible range)
            $speed = (float) ($settings['speed'] ?? 1.0);
            $speed = max(0.25, min(4.0, $speed));

            // Visual adjustments
            $brightness = (float) ($settings['brightness'] ?? 0.0);
            $contrast   = (float) ($settings['contrast']   ?? 0.0);
            $saturation = (float) ($settings['saturation'] ?? 0.0);

            // Text overlay
            $textOverlay = is_array($settings['text_overlay'] ?? null) ? $settings['text_overlay'] : null;

            // Effect preset (clip-level; validated against known IDs)
            $rawPreset   = $settings['effect_preset'] ?? null;
            $knownPresets = ['kill-impact', 'headshot-focus', 'flash-cut', 'motion-blur', 'cinematic-boost', 'neon-hype'];
            $effectPreset = (is_string($rawPreset) && in_array($rawPreset, $knownPresets, true)) ? $rawPreset : null;

            // Time-range effects
            $validEffectTypes = ['flash','zoom-hit','glitch','shake','blur-whip','slow-mo','speed-up','fire','neon-glow'];
            $speedEffectTypes = ['slow-mo', 'speed-up'];
            $timeEffects      = [];   // visual-only effects (CSS/filter-based)
            $speedTimeEffects = [];   // speed-change effects (require segment splitting)
            foreach ((array) ($settings['effects'] ?? []) as $eff) {
                $eType = $eff['type'] ?? null;
                if (!is_string($eType) || !in_array($eType, $validEffectTypes, true)) {
                    continue;
                }
                $es         = max(0.0, (float) ($eff['start_time'] ?? 0));
                $ee         = max($es + 0.05, (float) ($eff['end_time']   ?? $es + 0.5));
                $ei         = max(0.0, min(1.0, (float) ($eff['intensity'] ?? 0.8)));
                $normalized = ['type' => $eType, 'start' => $es, 'end' => $ee, 'intensity' => $ei];
                if (in_array($eType, $speedEffectTypes, true)) {
                    $speedTimeEffects[] = $normalized;
                } else {
                    $timeEffects[] = $normalized;
                }
            }

            // Transitions
            $outTrans = is_array($settings['transition'] ?? null) ? $settings['transition'] : null;

            // Incoming transition = outgoing from the previous clip
            $prevId   = $i > 0 ? ($clipOrder[$i - 1] ?? null) : null;
            $prevSettings = $prevId
                ? ($clipSettings[$prevId] ?? $clipSettings[(string) $prevId] ?? [])
                : [];
            $inTrans = is_array($prevSettings['transition'] ?? null) ? $prevSettings['transition'] : null;

            // Output duration after speed change
            $outputDur = ($trimEnd - $trimStart) / $speed;

            // Fade flags (don't fade on the last clip's outgoing, no incoming on first clip)
            // smooth-fade is a slower, more gradual fade (1.0 s default vs 0.5 s for fade/crossfade).
            $fadeTypes  = ['fade', 'crossfade', 'smooth-fade'];
            $hasFadeIn  = $inTrans  && in_array($inTrans['type']  ?? '', $fadeTypes, true) && $i > 0;
            $hasFadeOut = $outTrans && in_array($outTrans['type'] ?? '', $fadeTypes, true) && ($i < $clipCount - 1);

            $inDefaultDur  = ($inTrans['type']  ?? '') === 'smooth-fade' ? 1.0 : 0.5;
            $outDefaultDur = ($outTrans['type'] ?? '') === 'smooth-fade' ? 1.0 : 0.5;
            $fadeInDur  = $hasFadeIn  ? max(0.1, min(2.0, (float) ($inTrans['duration']  ?? $inDefaultDur)))  : 0.0;
            $fadeOutDur = $hasFadeOut ? max(0.1, min(2.0, (float) ($outTrans['duration'] ?? $outDefaultDur))) : 0.0;

            $segPath = "{$tmpDir}/seg_{$i}.mp4";

            if (!empty($speedTimeEffects)) {
                // One or more speed-change time effects: use segment-split render.
                // Audio is muted for the whole clip to avoid A/V desync complexity.
                $cmd = $this->buildSegmentedSpeedCmd(
                    $sourcePath, $trimStart, $trimEnd,
                    $speed, $speedTimeEffects,
                    $aspectRatio, $brightness, $contrast, $saturation,
                    $effectPreset, $timeEffects,
                    $crf, $preset, $segPath
                );
            } else {
                $videoFilter = $this->buildVideoFilter(
                    $aspectRatio, $trimStart, $trimEnd, $speed, $brightness, $contrast, $saturation,
                    $textOverlay, $outputDur, $hasFadeIn, $fadeInDur, $hasFadeOut, $fadeOutDur,
                    $effectPreset, $timeEffects
                );
                $cmd = $this->buildClipCmd(
                    $sourcePath, $trimStart, $trimEnd,
                    $muted, $volume, $speed,
                    $audioFadeIn, $audioFadeOut, $outputDur,
                    $videoFilter, $crf, $preset, $audioBitrate,
                    $segPath
                );
            }

            $result = Process::timeout(300)->run($cmd);

            if ($result->successful() && file_exists($segPath) && filesize($segPath) > 0) {
                $segments[]         = $segPath;
                $segmentDurations[] = $outputDur;
                $segmentSources[]   = "clip:{$clipId}";
                $renderedDuration  += $outputDur;
                Log::info("[RenderMontageJob] Segment {$i} ready: {$segPath}");
            } else {
                Log::error("[RenderMontageJob] Segment {$i} (clip #{$clipId}) failed: " . $result->errorOutput());
            }
        }

        // ── Outro card ────────────────────────────────────────────────────────
        if (!empty($outroCard['enabled'])) {
            $cardDuration = max(1, min(10, (int) ($outroCard['duration'] ?? 3)));
            $seg = $this->renderCard(
                "{$tmpDir}/outro_card.mp4",
                $outroCard['text']        ?? '',
                $outroCard['subtitle']    ?? '',
                $cardDuration,
                $outroCard['bg_style']    ?? 'clean-fade',
                $outroCard['animation']   ?? 'fade',
                $aspectRatio, $crf, $preset, $audioBitrate,
                $outroCard['template_id'] ?? null
            );
            if ($seg) {
                $segments[]         = $seg;
                $segmentDurations[] = (float) $cardDuration;
                $segmentSources[]   = 'outro';
                $renderedDuration  += $cardDuration;
            }
        }

        // ── Bail if nothing rendered ──────────────────────────────────────────
        if (empty($segments)) {
            $this->fail($project, $montage, 'All clip segments failed to process. Check that source clip files exist.', $tmpDir);
            return;
        }

        // ── Concat segments ───────────────────────────────────────────────────
        // Build per-gap transition map from tracked sources
        $gapTransitions = [];
        for ($g = 0, $gMax = count($segments) - 1; $g < $gMax; $g++) {
            $source = $segmentSources[$g] ?? '';
            if (str_starts_with($source, 'clip:')) {
                $srcClipId   = (int) substr($source, 5);
                $srcSettings = $clipSettings[$srcClipId] ?? $clipSettings[(string) $srcClipId] ?? [];
                $outTrans    = is_array($srcSettings['transition'] ?? null) ? $srcSettings['transition'] : null;
                $gapTransitions[$g] = $outTrans ?? ['type' => 'cut', 'duration' => 0.5];
            } else {
                $gapTransitions[$g] = ['type' => 'cut', 'duration' => 0.5];
            }
        }

        $needsXfade = false;
        foreach ($gapTransitions as $gap) {
            if ($this->isXfadeType($gap['type'] ?? 'cut')) {
                $needsXfade = true;
                break;
            }
        }

        $relativeDirectory  = "montages/{$project->id}";
        Storage::disk('public')->makeDirectory($relativeDirectory);
        $outFilename        = 'montage_' . time() . '.mp4';
        $relativeOutputPath = "{$relativeDirectory}/{$outFilename}";
        $outPath            = Storage::disk('public')->path($relativeOutputPath);

        Log::info("[RenderMontageJob] Running " . ($needsXfade ? 'xfade' : 'copy') . " concat for project #{$project->id}");

        if ($needsXfade) {
            $concatOk = $this->runXfadeConcat(
                $segments, $segmentDurations, $gapTransitions,
                $outPath, $crf, $preset, $audioBitrate
            );
        } else {
            $concatListPath = str_replace('\\', '/', "{$tmpDir}/concat.txt");
            $lines = [];
            foreach ($segments as $seg) {
                $lines[] = "file '" . str_replace('\\', '/', $seg) . "'";
            }
            file_put_contents($concatListPath, implode("\n", $lines) . "\n");

            $result   = Process::timeout(300)->run([
                'ffmpeg', '-y',
                '-f', 'concat', '-safe', '0',
                '-i', $concatListPath,
                '-c', 'copy',
                '-movflags', '+faststart',
                $outPath,
            ]);
            $concatOk = $result->successful();
            if (!$concatOk) {
                Log::error("[RenderMontageJob] Concat failed: " . $result->errorOutput());
            }
        }

        if (!$concatOk || !file_exists($outPath) || filesize($outPath) === 0) {
            $this->fail($project, $montage, 'Final merge failed. Please try again.', $tmpDir);
            return;
        }

        // ── Music mix (best-effort second pass) ───────────────────────────────
        // Prefer user-uploaded file; fall back to built-in track by id.
        $musicFilePath = $music['file_path'] ?? null;
        $musicAbsPath  = $musicFilePath ? Storage::disk('local')->path($musicFilePath) : null;

        if ((!$musicAbsPath || !file_exists($musicAbsPath)) && !empty($music['track_id'])) {
            $trackId = $music['track_id'];
            if (in_array($trackId, self::BUILTIN_TRACK_IDS, true)) {
                $builtinPath  = public_path('music/builtin/' . $trackId . '.mp3');
                $musicAbsPath = file_exists($builtinPath) ? $builtinPath : null;
                if ($musicAbsPath === null) {
                    Log::warning("[RenderMontageJob] Built-in track '{$trackId}' not found at expected path, skipping music.");
                }
            } else {
                Log::warning("[RenderMontageJob] Unknown track_id '{$trackId}' rejected.");
            }
        }

        if ($musicAbsPath && file_exists($musicAbsPath)) {
            $mixedPath = "{$tmpDir}/montage_mixed.mp4";
            $mixCmd    = $this->buildMusicMixCmd($outPath, $musicAbsPath, $mixedPath, $music, $renderedDuration);
            $mixResult = Process::timeout(300)->run($mixCmd);

            if ($mixResult->successful() && file_exists($mixedPath) && filesize($mixedPath) > 0) {
                rename($mixedPath, $outPath);
                Log::info("[RenderMontageJob] Music mixed into project #{$project->id}");
            } else {
                Log::warning("[RenderMontageJob] Music mix failed, continuing without: " . $mixResult->errorOutput());
            }
        }

        $project->update([
            'status'        => 'completed',
            'output_path'   => $relativeOutputPath,
            'completed_at'  => now(),
            'error_message' => null,
        ]);

        $montage?->update([
            'title'         => $project->title,
            'status'        => 'completed',
            'output_path'   => $relativeOutputPath,
            'duration'      => round($renderedDuration, 2),
            'file_size'     => filesize($outPath),
            'error_message' => null,
        ]);

        Log::info("[RenderMontageJob] Done — project #{$project->id}, output: {$outPath}");

        $this->cleanupTmp($tmpDir);
    }

    // ─── FFmpeg helpers ───────────────────────────────────────────────────────

    /** Maps a speed-change time-effect type to its playback speed multiplier. */
    private function speedMultiplierForEffectType(string $type): float
    {
        return match ($type) {
            'slow-mo'  => 0.5,   // half speed → segment duration doubles
            'speed-up' => 2.0,   // double speed → segment duration halves
            default    => 1.0,
        };
    }

    /**
     * Build an FFmpeg command for a clip that contains speed-change time effects
     * (slow-mo / speed-up). Uses filter_complex to split the source into segments
     * with different setpts multipliers and then concatenates them.
     *
     * Audio is muted on the output to avoid A/V desync from uneven speed segments.
     * Visual colour/preset filters are applied uniformly to every segment.
     *
     * Speed-effect times ($speedEffects[*]['start'/'end']) are clip-relative source
     * seconds (0 = trimStart), matching how the JS frontend stores start_time/end_time.
     */
    private function buildSegmentedSpeedCmd(
        string  $sourcePath,
        float   $trimStart,
        float   $trimEnd,
        float   $baseSpeed,
        array   $speedEffects,
        string  $aspectRatio,
        float   $brightness,
        float   $contrast,
        float   $saturation,
        ?string $effectPreset,
        array   $visualTimeEffects,
        int     $crf,
        string  $preset,
        string  $segPath
    ): array {
        // Sort speed effects by source-relative start time
        usort($speedEffects, fn($a, $b) => $a['start'] <=> $b['start']);

        // Build a list of [src_start, src_end, speed] segments covering trimStart..trimEnd.
        // $eff['start'] / ['end'] are source-relative (offset from trimStart), so absolute
        // source time = trimStart + offset.
        $segments = [];
        $cursor   = $trimStart;

        foreach ($speedEffects as $eff) {
            $effSrcStart = $trimStart + (float) $eff['start'];
            $effSrcEnd   = $trimStart + (float) $eff['end'];
            // Clamp to the trim window
            $effSrcStart = max($trimStart, min($trimEnd, $effSrcStart));
            $effSrcEnd   = max($effSrcStart + 0.05, min($trimEnd, $effSrcEnd));
            $effSpeed    = $baseSpeed * $this->speedMultiplierForEffectType($eff['type']);

            if ($effSrcStart > $cursor + 0.001) {
                $segments[] = ['src_start' => $cursor, 'src_end' => $effSrcStart, 'speed' => $baseSpeed];
            }
            $segments[] = ['src_start' => $effSrcStart, 'src_end' => $effSrcEnd, 'speed' => $effSpeed];
            $cursor = $effSrcEnd;
        }

        if ($cursor < $trimEnd - 0.001) {
            $segments[] = ['src_start' => $cursor, 'src_end' => $trimEnd, 'speed' => $baseSpeed];
        }

        // Base visual filter chain (scale + colour eq + preset) — no speed-specific CSS
        [$w, $h]     = $this->dimensionsForRatio($aspectRatio);
        $baseFilters = [$this->scaleFilter($aspectRatio)];

        if (abs($brightness) > 0.001 || abs($contrast) > 0.001 || abs($saturation) > 0.001) {
            $br = number_format($brightness, 3, '.', '');
            $co = number_format(max(0.05, 1.0 + $contrast),  3, '.', '');
            $sa = number_format(max(0.0,  1.0 + $saturation), 3, '.', '');
            $baseFilters[] = "eq=brightness={$br}:contrast={$co}:saturation={$sa}";
        }

        if ($effectPreset !== null) {
            foreach ($this->effectPresetFilters($effectPreset, $w, $h) as $flt) {
                $baseFilters[] = $flt;
            }
        }

        // Append visual-only time effects with enable= windows.
        // Times need converting to output-timeline of each segment individually,
        // which is complex; for MVP we omit them on speed-effect clips to keep
        // the render correct and simple.

        $visualChain = implode(',', $baseFilters);
        $n           = count($segments);

        // filter_complex: split source → per-segment trim+speed+visual → concat
        $filterParts  = [];
        $splitLabels  = implode('', array_map(fn($j) => "[raw{$j}]", range(0, $n - 1)));
        $filterParts[] = "[0:v]split={$n}{$splitLabels}";

        $concatInputs = '';
        foreach ($segments as $j => $seg) {
            $t1  = number_format($seg['src_start'], 6, '.', '');
            $t2  = number_format($seg['src_end'],   6, '.', '');
            $pts = number_format(1.0 / $seg['speed'], 6, '.', '');
            $filterParts[] = "[raw{$j}]trim=start={$t1}:end={$t2},setpts={$pts}*(PTS-STARTPTS),{$visualChain}[seg{$j}]";
            $concatInputs .= "[seg{$j}]";
        }

        $filterParts[]  = "{$concatInputs}concat=n={$n}:v=1:a=0[outv]";
        $filterComplex  = implode(';', $filterParts);
        $seekPos        = number_format(max(0.0, $trimStart - 5.0), 6, '.', '');

        return [
            'ffmpeg', '-y',
            '-ss', $seekPos,
            '-i', $sourcePath,
            '-filter_complex', $filterComplex,
            '-map', '[outv]',
            '-an',
            '-c:v', 'libx264', '-preset', $preset, '-crf', (string) $crf,
            '-movflags', '+faststart', $segPath,
        ];
    }

    /**
     * Build the -vf filter chain for a clip segment.
     * Order: trim (source range) → setpts reset → scale → setpts (speed) → eq (colour) → effect preset → drawtext → fade
     *
     * Using filter-based trimming (trim/atrim) instead of input-seek flags keeps video
     * and audio starting from the exact same source timestamp, eliminating A/V desync.
     */
    private function buildVideoFilter(
        string  $aspectRatio,
        float   $trimStart,
        float   $trimEnd,
        float   $speed,
        float   $brightness,
        float   $contrast,
        float   $saturation,
        ?array  $textOverlay,
        float   $outputDur,
        bool    $hasFadeIn,
        float   $fadeInDur,
        bool    $hasFadeOut,
        float   $fadeOutDur,
        ?string $effectPreset = null,
        array   $timeEffects  = []
    ): string {
        $f  = [];
        $t1 = number_format($trimStart, 6, '.', '');
        $t2 = number_format($trimEnd,   6, '.', '');

        // Trim to the exact source range — filter-based for frame-accurate A/V sync
        $f[] = "trim=start={$t1}:end={$t2}";
        $f[] = 'setpts=PTS-STARTPTS';

        // Scale + pad to target resolution
        $f[] = $this->scaleFilter($aspectRatio);

        // Speed adjustment in output timeline (after timestamp reset above)
        if (abs($speed - 1.0) > 0.001) {
            $pts = number_format(1.0 / $speed, 6, '.', '');
            $f[] = "setpts={$pts}*(PTS-STARTPTS)";
        }

        // Colour adjustments via eq filter
        // FFmpeg eq: brightness (-1..1, default 0), contrast (default 1.0 = neutral), saturation (default 1.0 = neutral)
        if (abs($brightness) > 0.001 || abs($contrast) > 0.001 || abs($saturation) > 0.001) {
            $br = number_format($brightness, 3, '.', '');
            $co = number_format(max(0.05, 1.0 + $contrast),  3, '.', '');  // map -1..1 → 0.05..2
            $sa = number_format(max(0.0,  1.0 + $saturation), 3, '.', '');  // map -1..1 → 0..2
            $f[] = "eq=brightness={$br}:contrast={$co}:saturation={$sa}";
        }

        // Effect preset — inserted after colour eq, before text/fades
        if ($effectPreset !== null) {
            [$w, $h] = $this->dimensionsForRatio($aspectRatio);
            foreach ($this->effectPresetFilters($effectPreset, $w, $h) as $flt) {
                $f[] = $flt;
            }
        }

        // Time-range effects — each effect uses enable='between(t,start,end)' so only
        // activates within its window. Times are in the output timeline (after speed adj).
        if (!empty($timeEffects)) {
            [$w, $h] = $this->dimensionsForRatio($aspectRatio);
            foreach ($timeEffects as $eff) {
                $ts  = number_format($eff['start'] / $speed, 6, '.', '');
                $te  = number_format($eff['end']   / $speed, 6, '.', '');
                $ei  = $eff['intensity'];
                foreach ($this->timeEffectFilters($eff['type'], $ts, $te, $ei, $w, $h) as $flt) {
                    $f[] = $flt;
                }
            }
        }

        // Text overlay via drawtext
        if (!empty($textOverlay['enabled']) && trim($textOverlay['text'] ?? '') !== '') {
            $dt = $this->buildDrawtext($textOverlay);
            if ($dt !== '') {
                $f[] = $dt;
            }
        }

        // Fade in from black (applied in output timeline, after setpts)
        if ($hasFadeIn && $fadeInDur > 0) {
            $d = number_format(min($fadeInDur, $outputDur * 0.4), 3, '.', '');
            $f[] = "fade=t=in:st=0:d={$d}";
        }

        // Fade out to black
        if ($hasFadeOut && $fadeOutDur > 0 && $outputDur > 0) {
            $d  = number_format(min($fadeOutDur, $outputDur * 0.4), 3, '.', '');
            $st = number_format(max(0.0, $outputDur - (float) $d), 3, '.', '');
            $f[] = "fade=t=out:st={$st}:d={$d}";
        }

        return implode(',', $f);
    }

    /**
     * Assemble the full ffmpeg command for one clip segment.
     *
     * $audioFadeIn / $audioFadeOut are per-clip audio envelope fades (seconds, 0 = off).
     * $outputDur is the clip duration after speed adjustment, used to compute fade-out start.
     */
    private function buildClipCmd(
        string $sourcePath,
        float  $trimStart,
        float  $trimEnd,
        bool   $muted,
        float  $volume,
        float  $speed,
        float  $audioFadeIn,
        float  $audioFadeOut,
        float  $outputDur,
        string $videoFilter,
        int    $crf,
        string $preset,
        string $audioBitrate,
        string $segPath
    ): array {
        // Fast-seek to a keyframe shortly before the trim window for performance.
        // The exact frame boundary is still enforced by the trim/atrim filters in
        // the video and audio chains, so A/V sync is preserved.
        $seekPos = number_format(max(0.0, $trimStart - 5.0), 6, '.', '');

        if ($muted) {
            return [
                'ffmpeg', '-y',
                '-ss', $seekPos,
                '-i', $sourcePath,
                '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo',
                '-map', '0:v',
                '-map', '1:a',
                '-vf', $videoFilter,
                '-c:v', 'libx264', '-preset', $preset, '-crf', (string) $crf,
                '-c:a', 'aac', '-b:a', '128k',
                '-shortest',
                $segPath,
            ];
        }

        // Build audio filter chain — filter-trim first (keeps A/V in sync), then speed, volume, per-clip fades
        $t1 = number_format($trimStart, 6, '.', '');
        $t2 = number_format($trimEnd,   6, '.', '');
        $af = ["atrim=start={$t1}:end={$t2}", 'asetpts=PTS-STARTPTS'];

        if (abs($speed - 1.0) > 0.001) {
            // atempo range is 0.5–2.0; chain two filters for values outside that
            $tempo = max(0.5, min(2.0, $speed));
            $af[]  = "atempo=" . number_format($tempo, 4, '.', '');

            // Handle 0.25x: two chained atempo=0.5
            if ($speed < 0.5) {
                $af[] = "atempo=0.5000";
            }
        }

        if (abs($volume - 1.0) > 0.001) {
            $af[] = "volume=" . number_format(max(0.0, $volume), 4, '.', '');
        }

        // Per-clip audio fade in/out (applied after speed + volume, in output time domain)
        if ($audioFadeIn > 0.001 && $outputDur > 0.2) {
            $fi = number_format(min($audioFadeIn, $outputDur * 0.45), 3, '.', '');
            $af[] = "afade=t=in:st=0:d={$fi}";
        }
        if ($audioFadeOut > 0.001 && $outputDur > 0.2) {
            $fd  = min($audioFadeOut, $outputDur * 0.45);
            $st  = number_format(max(0.0, $outputDur - $fd), 3, '.', '');
            $af[] = "afade=t=out:st={$st}:d=" . number_format($fd, 3, '.', '');
        }

        $cmd = [
            'ffmpeg', '-y',
            '-ss', $seekPos,
            '-i', $sourcePath,
            '-vf', $videoFilter,
        ];

        if (!empty($af)) {
            $cmd[] = '-af';
            $cmd[] = implode(',', $af);
        }

        array_push($cmd,
            '-c:v', 'libx264', '-preset', $preset, '-crf', (string) $crf,
            '-c:a', 'aac', '-b:a', $audioBitrate,
            $segPath
        );

        return $cmd;
    }

    /**
     * Render an intro or outro title card.
     * When $templateId is provided it overrides $bgStyle / $animation entirely.
     */
    private function renderCard(
        string  $outPath,
        string  $text,
        string  $subtitle,
        int     $duration,
        string  $bgStyle,
        string  $animation,
        string  $aspectRatio,
        int     $crf,
        string  $preset,
        string  $audioBitrate,
        ?string $templateId = null
    ): ?string {
        [$w, $h] = $this->dimensionsForRatio($aspectRatio);

        // Resolve template → render params (overrides bgStyle / animation when set)
        $tmpl = $templateId ? $this->templateRenderParams($templateId) : [];

        $bgColor    = $tmpl['bgColor']    ?? match ($bgStyle) {
            'neon-slide'       => '0x0d0d1a',
            'gaming-flash'     => '0x0a0014',
            'cinematic-reveal' => '0x0a0a0a',
            default            => 'black',
        };
        $textColor  = $tmpl['textColor']  ?? match ($bgStyle) {
            'neon-slide'   => '0x9333EA',
            'gaming-flash' => '0x00ff88',
            default        => 'white',
        };
        $animation  = $tmpl['animation']  ?? $animation;
        $cinematic  = $tmpl['cinematic']  ?? ($bgStyle === 'cinematic-reveal');
        $doPulseZoom = $tmpl['pulseZoom'] ?? ($bgStyle === 'pulse-zoom');
        $extraVf    = $tmpl['extraVf']    ?? [];

        $vfParts = [];

        // Template-specific or pulse-zoom background animation
        if ($doPulseZoom && $duration >= 2) {
            $totalFrames = $duration * 30;
            $vfParts[]   = "zoompan=z='min(1+0.04*on/{$totalFrames},1.08)':d={$totalFrames}"
                         . ":x=iw/2-(iw/zoom/2):y=ih/2-(ih/zoom/2):s={$w}x{$h}";
        }

        // Extra template filters (colour grading, noise, etc.) applied early
        foreach ($extraVf as $flt) {
            $vfParts[] = $flt;
        }

        // Title text
        $escapedTitle = $this->escapeFfmpegText($text);
        $escapedSub   = $this->escapeFfmpegText($subtitle);

        if ($escapedTitle !== '') {
            $titleY    = $escapedSub !== '' ? "(h-text_h)/2-40" : "(h-text_h)/2";
            $vfParts[] = "drawtext=text='{$escapedTitle}':fontsize=64:fontcolor={$textColor}"
                       . ":x=(w-text_w)/2:y={$titleY}";
        }

        if ($escapedSub !== '') {
            $vfParts[] = "drawtext=text='{$escapedSub}':fontsize=36:fontcolor=0x9ca3af"
                       . ":x=(w-text_w)/2:y=(h+text_h)/2+20";
        }

        // Cinematic letterbox bars
        if ($cinematic) {
            $barH      = (int) ($h * 0.09);
            $vfParts[] = "drawbox=x=0:y=0:w={$w}:h={$barH}:color=black@1:t=fill";
            $vfParts[] = "drawbox=x=0:y=" . ($h - $barH) . ":w={$w}:h={$barH}:color=black@1:t=fill";
        }

        // Fade in/out per animation type
        if ($duration >= 2) {
            $fadeDur = match ($animation) {
                'flash'  => 0.08,
                'reveal' => 1.2,
                'zoom'   => 0.5,
                default  => 0.6,
            };
            $fadeOutSt  = number_format(max(0.0, $duration - $fadeDur), 3, '.', '');
            $fadeDurFmt = number_format($fadeDur, 3, '.', '');
            $vfParts[]  = "fade=t=in:st=0:d={$fadeDurFmt}";
            $vfParts[]  = "fade=t=out:st={$fadeOutSt}:d={$fadeDurFmt}";
        }

        $vf = !empty($vfParts)
            ? implode(',', $vfParts)
            : "drawtext=text='':fontsize=1:fontcolor=white:x=0:y=0";

        // Overlay asset compositing (screen blend — black pixels are transparent)
        $overlayFile = $tmpl['overlayFile'] ?? null;
        $overlayPath = $overlayFile ? public_path("overlays/{$overlayFile}") : null;
        $hasOverlay  = $overlayPath && file_exists($overlayPath);

        if ($hasOverlay) {
            // Composite: background → blend overlay via screen mode → apply $vf
            $filterComplex = "[0:v]scale={$w}:{$h}:force_original_aspect_ratio=increase,crop={$w}:{$h}[bg];"
                           . "[1:v]scale={$w}:{$h}:force_original_aspect_ratio=increase,crop={$w}:{$h},loop=loop=-1:size=32767:start=0,trim=duration={$duration},setpts=PTS-STARTPTS[ov];"
                           . "[bg][ov]blend=all_mode=screen[blended];"
                           . "[blended]{$vf}[vout]";

            $cmd = [
                'ffmpeg', '-y',
                '-f', 'lavfi', '-i', "color=c={$bgColor}:s={$w}x{$h}:r=30:d={$duration}",
                '-i', $overlayPath,
                '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo',
                '-filter_complex', $filterComplex,
                '-map', '[vout]',
                '-map', '2:a',
                '-c:v', 'libx264', '-preset', $preset, '-crf', (string) $crf,
                '-c:a', 'aac', '-b:a', $audioBitrate,
                '-t', (string) $duration,
                $outPath,
            ];
        } else {
            $cmd = [
                'ffmpeg', '-y',
                '-f', 'lavfi', '-i', "color=c={$bgColor}:s={$w}x{$h}:r=30:d={$duration}",
                '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo',
                '-vf', $vf,
                '-c:v', 'libx264', '-preset', $preset, '-crf', (string) $crf,
                '-c:a', 'aac', '-b:a', $audioBitrate,
                '-t', (string) $duration,
                $outPath,
            ];
        }

        $result = Process::timeout(60)->run($cmd);

        if ($result->successful() && file_exists($outPath) && filesize($outPath) > 0) {
            $id = $templateId ?? "{$bgStyle}/{$animation}";
            Log::info("[RenderMontageJob] Card rendered ({$id}): {$outPath}");
            return $outPath;
        }

        Log::warning("[RenderMontageJob] Card failed: " . $result->errorOutput());
        return null;
    }

    /**
     * Map an intro/outro template ID to its FFmpeg render parameters.
     *
     * @return array{bgColor: string, textColor: string, animation: string, extraVf: string[], cinematic?: bool, pulseZoom?: bool}
     */
    private function templateRenderParams(string $templateId): array
    {
        return match ($templateId) {
            'fire-scope-reveal' => [
                'bgColor'     => '0x0D0200',
                'textColor'   => '0xFF6B00',
                'animation'   => 'zoom',
                'extraVf'     => ['eq=saturation=1.5:contrast=1.1:brightness=0.02'],
                'overlayFile' => 'fire_overlay.mp4',
            ],
            'blue-energy-sweep' => [
                'bgColor'     => '0x00091A',
                'textColor'   => '0x00BFFF',
                'animation'   => 'slide',
                'extraVf'     => ['eq=saturation=1.4:contrast=1.05'],
                'overlayFile' => 'energy_pulse.mp4',
            ],
            'neon-pulse-intro' => [
                'bgColor'     => '0x050009',
                'textColor'   => '0xCC00FF',
                'animation'   => 'flash',
                'extraVf'     => ['eq=saturation=2.0:contrast=1.2:brightness=-0.03'],
                'overlayFile' => 'neon_scan.mp4',
            ],
            'glitch-reveal' => [
                'bgColor'     => '0x000000',
                'textColor'   => 'white',
                'animation'   => 'flash',
                'extraVf'     => ['noise=alls=8:allf=t'],
                'overlayFile' => 'glitch_static.mp4',
            ],
            'cinematic-shockwave' => [
                'bgColor'   => '0x080808',
                'textColor' => 'white',
                'animation' => 'reveal',
                'cinematic' => true,
                'extraVf'   => [],
            ],
            default => [],
        };
    }

    /**
     * Return extra video-filter parts for a clip-level effect preset.
     * These are inserted into the filter chain after eq/colour adjustments.
     *
     * @return string[]
     */
    private function effectPresetFilters(string $preset, int $w, int $h): array
    {
        // kill-impact / headshot-focus: crop edges for zoom then upscale
        $cwKill = (int) (round($w / 1.16 / 2) * 2);
        $chKill = (int) (round($h / 1.16 / 2) * 2);
        $cwHead = (int) (round($w / 1.22 / 2) * 2);
        $chHead = (int) (round($h / 1.22 / 2) * 2);

        return match ($preset) {
            'kill-impact'    => [
                "crop={$cwKill}:{$chKill}:(iw-{$cwKill})/2:(ih-{$chKill})/2,scale={$w}:{$h}",
                'eq=brightness=0.12:contrast=1.5:saturation=1.35',
                'vignette=PI/4',
            ],
            'headshot-focus' => [
                "crop={$cwHead}:{$chHead}:(iw-{$cwHead})/2:(ih-{$chHead})/2,scale={$w}:{$h}",
                'eq=brightness=0.06:contrast=1.6:saturation=0.85',
                'vignette=PI/4',
            ],
            'flash-cut'      => ['fade=t=in:st=0:d=0.12:color=white', 'eq=brightness=0.25:contrast=1.3'],
            'motion-blur'    => ['boxblur=6:1', 'eq=brightness=0.08'],
            'cinematic-boost'=> ['eq=saturation=1.45:contrast=1.35:brightness=-0.08', 'vignette=PI/4'],
            'neon-hype'      => ['eq=saturation=2.5:contrast=1.5:brightness=0.04'],
            default          => [],
        };
    }

    /**
     * Build FFmpeg filter strings for a single time-ranged effect.
     *
     * All filters use the `enable='between(t,start,end)'` timeline option so they
     * only activate within the specified output-time window. Filters that don't
     * support the enable option (e.g. fade) use their own built-in time params instead.
     *
     * @return string[]
     */
    private function timeEffectFilters(string $type, string $ts, string $te, float $intensity, int $w, int $h): array
    {
        $en = "enable='between(t,{$ts},{$te})'";

        return match ($type) {
            // Impact FX
            'flash'     => ["eq=brightness=" . number_format(min(1.0, 0.4 + $intensity * 0.6), 3, '.', '') . ":{$en}"],
            'zoom-hit'  => (() => {
                $cw = (int) (round($w / 1.06 / 2) * 2);
                $ch = (int) (round($h / 1.06 / 2) * 2);
                return ["crop={$cw}:{$ch}:(iw-{$cw})/2:(ih-{$ch})/2:{$en},scale={$w}:{$h}"];
            })(),
            'glitch'    => ["noise=alls=" . (int) round(5 + $intensity * 25) . ":allf=t:{$en}"],
            'shake'     => [
                "noise=alls=" . (int) round(3 + $intensity * 12) . ":allf=t:{$en}",
                "eq=contrast=" . number_format(1.0 + $intensity * 0.2, 3, '.', '') . ":{$en}",
            ],
            // Transition FX
            'blur-whip' => ["boxblur=" . number_format(4 + $intensity * 8, 1, '.', '') . ":1:{$en}"],
            'slow-mo'   => [
                "eq=brightness=0.06:contrast=1.3:saturation=0.8:{$en}",
                "crop=" . (int)(round($w / 1.1 / 2) * 2) . ":" . (int)(round($h / 1.1 / 2) * 2) . ":(iw-" . (int)(round($w / 1.1 / 2) * 2) . ")/2:(ih-" . (int)(round($h / 1.1 / 2) * 2) . ")/2:{$en},scale={$w}:{$h}",
            ],
            // Style FX
            'fire'      => ["eq=saturation=" . number_format(1.0 + $intensity * 1.4, 3, '.', '') . ":contrast=" . number_format(1.0 + $intensity * 0.25, 3, '.', '') . ":brightness=" . number_format($intensity * 0.08, 3, '.', '') . ":{$en}"],
            'neon-glow' => ["eq=saturation=" . number_format(1.5 + $intensity * 1.8, 3, '.', '') . ":contrast=" . number_format(1.1 + $intensity * 0.5, 3, '.', '') . ":brightness=" . number_format($intensity * 0.04, 3, '.', '') . ":{$en}"],
            default      => [],
        };
    }

    // ─── xfade concat ────────────────────────────────────────────────────────

    /** xfade transition types that use the FFmpeg xfade filter (vs. fade-to-black). */
    private const XFADE_TYPES = ['dissolve', 'wipe-left', 'wipe-right', 'slide-left', 'pixelize'];

    private function isXfadeType(string $type): bool
    {
        return in_array($type, self::XFADE_TYPES, true);
    }

    private function xfadeFilterName(string $type): string
    {
        return match ($type) {
            'wipe-left'  => 'wipeleft',
            'wipe-right' => 'wiperight',
            'slide-left' => 'slideleft',
            'pixelize'   => 'pixelize',
            default      => 'dissolve',
        };
    }

    /**
     * Merge all segments into a single video using the FFmpeg xfade filter for
     * xfade-type transitions and a near-instant fade (0.04 s ≈ 1 frame) for cuts.
     *
     * Audio streams are concatenated without cross-fading (music is mixed in a
     * separate pass, so audio cuts are invisible in the final export).
     */
    private function runXfadeConcat(
        array  $segments,
        array  $segDurations,
        array  $gapTransitions,
        string $outPath,
        int    $crf,
        string $preset,
        string $audioBitrate
    ): bool {
        $n = count($segments);
        if ($n === 0) {
            return false;
        }
        if ($n === 1) {
            // Single segment — just re-encode to the output path
            $result = Process::timeout(300)->run([
                'ffmpeg', '-y', '-i', $segments[0],
                '-c:v', 'libx264', '-preset', $preset, '-crf', (string) $crf,
                '-c:a', 'aac', '-b:a', $audioBitrate,
                '-movflags', '+faststart', $outPath,
            ]);
            return $result->successful();
        }

        // Build inputs list
        $inputs = [];
        foreach ($segments as $seg) {
            $inputs[] = '-i';
            $inputs[] = $seg;
        }

        // Build filter_complex: chain xfade / near-instant-fade between every pair
        $filterParts = [];
        $cumOffset   = 0.0;
        $prevLabel   = '[0:v]';

        for ($g = 0; $g < $n - 1; $g++) {
            $trans     = $gapTransitions[$g] ?? ['type' => 'cut', 'duration' => 0.5];
            $transType = $trans['type'] ?? 'cut';
            $isXfade   = $this->isXfadeType($transType);
            $transDur  = $isXfade
                ? max(0.1, min(2.0, (float) ($trans['duration'] ?? 0.5)))
                : 0.04;   // near-instant pass-through for cuts

            $cumOffset   += $segDurations[$g] - $transDur;
            $nextLabel    = ($g === $n - 2) ? '[vout]' : "[v{$g}]";
            $nextInput    = '[' . ($g + 1) . ':v]';
            $ffmpegTrans  = $isXfade ? $this->xfadeFilterName($transType) : 'fade';
            $durFmt       = number_format($transDur, 4, '.', '');
            $offFmt       = number_format(max(0.0, $cumOffset), 4, '.', '');

            $filterParts[] = "{$prevLabel}{$nextInput}xfade=transition={$ffmpegTrans}:duration={$durFmt}:offset={$offFmt}{$nextLabel}";
            $prevLabel     = $nextLabel;
        }

        // Audio concat (clean cut — music mix handles fades in the next pass)
        $audioIn     = implode('', array_map(fn ($i) => "[{$i}:a]", range(0, $n - 1)));
        $filterParts[] = "{$audioIn}concat=n={$n}:v=0:a=1[aout]";

        $filterComplex = implode(';', $filterParts);

        $cmd = array_merge(
            ['ffmpeg', '-y'],
            $inputs,
            [
                '-filter_complex', $filterComplex,
                '-map', '[vout]',
                '-map', '[aout]',
                '-c:v', 'libx264', '-preset', $preset, '-crf', (string) $crf,
                '-c:a', 'aac', '-b:a', $audioBitrate,
                '-movflags', '+faststart',
                $outPath,
            ]
        );

        $result = Process::timeout(600)->run($cmd);

        if (!$result->successful()) {
            Log::error('[RenderMontageJob] xfade concat failed: ' . $result->errorOutput());
        }

        return $result->successful();
    }

    /**
     * Mix a background music track into the already-concatenated video output.
     * Video stream is copied; only the audio is re-encoded.
     */
    private function buildMusicMixCmd(
        string $videoPath,
        string $musicPath,
        string $outPath,
        array  $music,
        float  $totalDuration
    ): array {
        $musicVolume = (float) ($music['volume']     ?? 0.5);
        $trimStart   = (float) ($music['trim_start'] ?? 0.0);
        $fadeIn      = (float) ($music['fade_in']    ?? 0.0);
        $fadeOut     = (float) ($music['fade_out']   ?? 2.0);
        $loop        = !empty($music['loop']);

        // Build the music audio filter chain
        $af = [];

        if ($loop) {
            // aloop=-1 loops indefinitely; trim to exact montage length
            $af[] = "aloop=loop=-1:size=2000000000";
        }

        if ($trimStart > 0 && !$loop) {
            // For non-looping: seek via input flag (handled below) — no need for atrim here
        }

        $af[] = "atrim=duration=" . number_format($totalDuration, 3, '.', '');
        $af[] = "asetpts=PTS-STARTPTS";

        if ($fadeIn > 0) {
            $af[] = "afade=t=in:st=0:d=" . number_format(min($fadeIn, $totalDuration * 0.3), 3, '.', '');
        }
        if ($fadeOut > 0) {
            $fd  = min($fadeOut, $totalDuration * 0.3);
            $st  = max(0.0, $totalDuration - $fd);
            $af[] = "afade=t=out:st=" . number_format($st, 3, '.', '') . ":d=" . number_format($fd, 3, '.', '');
        }

        $af[] = "volume=" . number_format(max(0.0, $musicVolume), 4, '.', '');

        $musicAfStr = implode(',', $af);

        // Input: video first, then music (with optional trim-start seek)
        $cmd = ['ffmpeg', '-y', '-i', $videoPath];

        if ($loop) {
            array_push($cmd, '-stream_loop', '-1');
        } elseif ($trimStart > 0) {
            array_push($cmd, '-ss', (string) $trimStart);
        }

        array_push($cmd, '-i', $musicPath);

        $filterComplex = "[1:a]{$musicAfStr}[music];[0:a][music]amix=inputs=2:duration=first:dropout_transition=0[aout]";

        array_push($cmd,
            '-filter_complex', $filterComplex,
            '-map', '0:v',
            '-map', '[aout]',
            '-c:v', 'copy',
            '-c:a', 'aac', '-b:a', '192k',
            '-shortest',
            '-movflags', '+faststart',
            $outPath
        );

        return $cmd;
    }

    /**
     * Build an FFmpeg drawtext filter string from text overlay settings.
     */
    private function buildDrawtext(array $ov): string
    {
        $text = $this->escapeFfmpegText($ov['text'] ?? '');
        if ($text === '') {
            return '';
        }

        $fontsize = match ($ov['size'] ?? 'md') {
            'sm'    => 28,
            'lg'    => 72,
            'xl'    => 96,
            default => 48,
        };

        $color = match ($ov['color'] ?? 'white') {
            'purple' => '0x9333EA',
            'cyan'   => '0x22D3EE',
            'yellow' => '0xFBBF24',
            default  => 'white',
        };

        $y = match ($ov['position'] ?? 'bottom') {
            'top'    => '80',
            'center' => '(h-text_h)/2',
            default  => 'h-100',
        };

        // Background box: on by default for readability, off when user disables it.
        // bgBox defaults to true for backward compat with projects saved before Phase B.
        $useBox = !isset($ov['bgBox']) || !empty($ov['bgBox']);
        $boxStr = $useBox ? ':box=1:boxcolor=black@0.45:boxborderw=10' : '';

        // Text animation: fade-in applies an alpha ramp over the first 0.5 s.
        // slide-up is not supported via drawtext — skip gracefully.
        $animation = $ov['animation'] ?? 'none';
        $alphaStr  = ($animation === 'fade-in') ? ":alpha='min(1,t/0.5)'" : '';

        return "drawtext=text='{$text}':fontsize={$fontsize}:fontcolor={$color}"
             . ":x=(w-text_w)/2:y={$y}"
             . $boxStr . $alphaStr;
    }

    /**
     * Return the scale+pad filter string for the given aspect ratio.
     */
    private function scaleFilter(string $aspectRatio): string
    {
        [$w, $h] = $this->dimensionsForRatio($aspectRatio);
        return "scale={$w}:{$h}:force_original_aspect_ratio=decrease"
             . ",pad={$w}:{$h}:(ow-iw)/2:(oh-ih)/2:color=black";
    }

    /**
     * Pixel dimensions for each aspect ratio preset.
     *
     * @return array{int, int}
     */
    private function dimensionsForRatio(string $aspectRatio): array
    {
        return match ($aspectRatio) {
            '9:16'  => [1080, 1920],
            '1:1'   => [1080, 1080],
            default => [1920, 1080],  // original / 16:9
        };
    }

    /**
     * CRF, x264 preset, and audio bitrate for each quality preset.
     *
     * @return array{int, string, string}
     */
    private function qualityParams(string $quality): array
    {
        return match ($quality) {
            'standard' => [26, 'fast',     '128k'],
            'smaller'  => [30, 'veryfast', '96k'],
            default    => [20, 'medium',   '192k'],  // high
        };
    }

    /**
     * Resolve the best available source file for a clip.
     */
    private function resolveClipPath(Clip $clip): ?string
    {
        if ($clip->refined_path) {
            $abs = $clip->getRefinedAbsolutePath();
            if ($abs && file_exists($abs)) {
                return $abs;
            }
        }

        $abs = $clip->getAbsolutePath();
        return ($abs && file_exists($abs)) ? $abs : null;
    }

    // ─── Job lifecycle ────────────────────────────────────────────────────────

    private function fail(MontageProject $project, ?Montage $montage, string $message, string $tmpDir = ''): void
    {
        $project->update(['status' => 'failed', 'error_message' => $message]);
        $montage?->update(['title' => $project->title, 'status' => 'failed', 'error_message' => $message]);
        Log::error("[RenderMontageJob] Project #{$project->id} failed: {$message}");
        if ($tmpDir !== '') {
            $this->cleanupTmp($tmpDir);
        }
    }

    private function cleanupTmp(string $dir): void
    {
        if (!is_dir($dir)) {
            return;
        }

        foreach (glob($dir . '/*') ?: [] as $file) {
            @unlink($file);
        }

        @rmdir($dir);
    }

    private function escapeFfmpegText(string $text): string
    {
        $text = substr(strip_tags($text), 0, 80);
        // Strip characters that would break drawtext's simple quoting
        return preg_replace("/[^\\w\\s\\-!.,#@&()+]/u", '', $text);
    }

    public function failed(\Throwable $exception): void
    {
        Log::error("[RenderMontageJob] Job crashed for project #{$this->projectId}: " . $exception->getMessage());

        $message = 'Render job crashed: ' . substr($exception->getMessage(), 0, 500);

        MontageProject::find($this->projectId)?->update([
            'status'        => 'failed',
            'error_message' => $message,
        ]);

        Montage::find($this->montageId)?->update([
            'status'        => 'failed',
            'error_message' => $message,
        ]);
    }
}
