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
        $renderedDuration = 0.0;

        // ── Intro title card ──────────────────────────────────────────────────
        if (!empty($titleCard['enabled'])) {
            $cardDuration = max(1, min(10, (int) ($titleCard['duration'] ?? 3)));
            $seg = $this->renderCard(
                "{$tmpDir}/intro_card.mp4",
                $titleCard['text']     ?? '',
                $titleCard['subtitle'] ?? '',
                $cardDuration,
                $titleCard['bg_style']  ?? 'clean-fade',
                $titleCard['animation'] ?? 'fade',
                $aspectRatio, $crf, $preset, $audioBitrate
            );
            if ($seg) {
                $segments[] = $seg;
                $renderedDuration += $cardDuration;
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

            $videoFilter = $this->buildVideoFilter(
                $aspectRatio, $speed, $brightness, $contrast, $saturation,
                $textOverlay, $outputDur, $hasFadeIn, $fadeInDur, $hasFadeOut, $fadeOutDur
            );

            $segPath = "{$tmpDir}/seg_{$i}.mp4";
            $cmd     = $this->buildClipCmd(
                $sourcePath, $trimStart, $trimEnd,
                $muted, $volume, $speed,
                $audioFadeIn, $audioFadeOut, $outputDur,
                $videoFilter, $crf, $preset, $audioBitrate,
                $segPath
            );

            $result = Process::timeout(300)->run($cmd);

            if ($result->successful() && file_exists($segPath) && filesize($segPath) > 0) {
                $segments[] = $segPath;
                $renderedDuration += $outputDur;
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
                $outroCard['text']     ?? '',
                $outroCard['subtitle'] ?? '',
                $cardDuration,
                $outroCard['bg_style']  ?? 'clean-fade',
                $outroCard['animation'] ?? 'fade',
                $aspectRatio, $crf, $preset, $audioBitrate
            );
            if ($seg) {
                $segments[] = $seg;
                $renderedDuration += $cardDuration;
            }
        }

        // ── Bail if nothing rendered ──────────────────────────────────────────
        if (empty($segments)) {
            $this->fail($project, $montage, 'All clip segments failed to process. Check that source clip files exist.', $tmpDir);
            return;
        }

        // ── Concat segments ───────────────────────────────────────────────────
        $concatListPath = str_replace('\\', '/', "{$tmpDir}/concat.txt");
        $lines = [];
        foreach ($segments as $seg) {
            $lines[] = "file '" . str_replace('\\', '/', $seg) . "'";
        }
        file_put_contents($concatListPath, implode("\n", $lines) . "\n");

        $relativeDirectory  = "montages/{$project->id}";
        Storage::disk('public')->makeDirectory($relativeDirectory);
        $outFilename        = 'montage_' . time() . '.mp4';
        $relativeOutputPath = "{$relativeDirectory}/{$outFilename}";
        $outPath            = Storage::disk('public')->path($relativeOutputPath);

        $concatCmd = [
            'ffmpeg', '-y',
            '-f', 'concat', '-safe', '0',
            '-i', $concatListPath,
            '-c', 'copy',
            '-movflags', '+faststart',
            $outPath,
        ];

        Log::info("[RenderMontageJob] Running concat for project #{$project->id}");

        $result = Process::timeout(300)->run($concatCmd);

        if (!$result->successful() || !file_exists($outPath) || filesize($outPath) === 0) {
            Log::error("[RenderMontageJob] Concat failed: " . $result->errorOutput());
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
                $builtinPath  = storage_path('app/music/builtin/' . $trackId . '.mp3');
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

    /**
     * Build the -vf filter chain for a clip segment.
     * Order: scale → setpts (speed) → eq (colour) → drawtext → fade
     */
    private function buildVideoFilter(
        string  $aspectRatio,
        float   $speed,
        float   $brightness,
        float   $contrast,
        float   $saturation,
        ?array  $textOverlay,
        float   $outputDur,
        bool    $hasFadeIn,
        float   $fadeInDur,
        bool    $hasFadeOut,
        float   $fadeOutDur
    ): string {
        $f = [];

        // Scale + pad to target resolution
        $f[] = $this->scaleFilter($aspectRatio);

        // Always reset video timestamps to 0 after input-seek trim, then apply speed
        if (abs($speed - 1.0) > 0.001) {
            $pts = number_format(1.0 / $speed, 6, '.', '');
            $f[] = "setpts={$pts}*(PTS-STARTPTS)";
        } else {
            $f[] = "setpts=PTS-STARTPTS";
        }

        // Colour adjustments via eq filter
        // FFmpeg eq: brightness (-1..1, default 0), contrast (default 1.0 = neutral), saturation (default 1.0 = neutral)
        if (abs($brightness) > 0.001 || abs($contrast) > 0.001 || abs($saturation) > 0.001) {
            $br = number_format($brightness, 3, '.', '');
            $co = number_format(max(0.05, 1.0 + $contrast),  3, '.', '');  // map -1..1 → 0.05..2
            $sa = number_format(max(0.0,  1.0 + $saturation), 3, '.', '');  // map -1..1 → 0..2
            $f[] = "eq=brightness={$br}:contrast={$co}:saturation={$sa}";
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
        if ($muted) {
            return [
                'ffmpeg', '-y',
                '-ss', (string) $trimStart,
                '-to', (string) $trimEnd,
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

        // Build audio filter chain — timestamps reset, then speed, volume, per-clip fades
        $af = ['asetpts=PTS-STARTPTS'];

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
            '-ss', (string) $trimStart,
            '-to', (string) $trimEnd,
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
     * Render an intro or outro title card with style preset support.
     */
    private function renderCard(
        string $outPath,
        string $text,
        string $subtitle,
        int    $duration,
        string $bgStyle,
        string $animation,
        string $aspectRatio,
        int    $crf,
        string $preset,
        string $audioBitrate
    ): ?string {
        [$w, $h] = $this->dimensionsForRatio($aspectRatio);

        // Background colour per style
        $bgColor = match ($bgStyle) {
            'neon-slide'       => '0x0d0d1a',
            'gaming-flash'     => '0x0a0014',
            'cinematic-reveal' => '0x0a0a0a',
            default            => 'black',     // clean-fade, pulse-zoom
        };

        // Primary text colour per style
        $textColor = match ($bgStyle) {
            'neon-slide'    => '0x9333EA',
            'gaming-flash'  => '0x00ff88',
            default         => 'white',
        };

        $vfParts = [];

        // For pulse-zoom: slow zoom on the background before drawing text
        if ($bgStyle === 'pulse-zoom' && $duration >= 2) {
            $totalFrames = $duration * 30;
            $vfParts[]   = "zoompan=z='min(1+0.04*on/{$totalFrames},1.08)':d={$totalFrames}"
                         . ":x=iw/2-(iw/zoom/2):y=ih/2-(ih/zoom/2):s={$w}x{$h}";
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
        if ($bgStyle === 'cinematic-reveal') {
            $barH      = (int) ($h * 0.09);
            $vfParts[] = "drawbox=x=0:y=0:w={$w}:h={$barH}:color=black@1:t=fill";
            $vfParts[] = "drawbox=x=0:y=" . ($h - $barH) . ":w={$w}:h={$barH}:color=black@1:t=fill";
        }

        // Fade duration per animation type (applied to whole frame)
        if ($duration >= 2) {
            $fadeDur = match ($animation) {
                'flash'  => 0.08,
                'reveal' => 1.2,
                'zoom'   => 0.5,
                default  => 0.6,    // fade, slide
            };
            $fadeOutSt = number_format(max(0.0, $duration - $fadeDur), 3, '.', '');
            $fadeDurFmt = number_format($fadeDur, 3, '.', '');
            $vfParts[] = "fade=t=in:st=0:d={$fadeDurFmt}";
            $vfParts[] = "fade=t=out:st={$fadeOutSt}:d={$fadeDurFmt}";
        }

        // Fallback no-op if nothing was added
        $vf = !empty($vfParts)
            ? implode(',', $vfParts)
            : "drawtext=text='':fontsize=1:fontcolor=white:x=0:y=0";

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

        $result = Process::timeout(60)->run($cmd);

        if ($result->successful() && file_exists($outPath) && filesize($outPath) > 0) {
            Log::info("[RenderMontageJob] Card rendered ({$bgStyle}/{$animation}): {$outPath}");
            return $outPath;
        }

        Log::warning("[RenderMontageJob] Card failed: " . $result->errorOutput());
        return null;
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
