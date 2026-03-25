<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Process;

/**
 * Generates synthetic overlay video assets used by intro/outro templates.
 *
 * Assets are stored in public/overlays/ and composited via FFmpeg's
 * screen-blend mode at render time. All overlays are dark backgrounds with
 * brightly-coloured animated elements so they add light rather than obscure
 * the template background.
 *
 * Run once (or with --force to regenerate):
 *   php artisan overlays:generate
 */
class GenerateOverlayAssets extends Command
{
    protected $signature   = 'overlays:generate {--force : Overwrite existing files}';
    protected $description = 'Generate synthetic overlay video assets for intro/outro templates';

    /** Overlay definitions: id → [filename, duration, FFmpeg vf expression, description] */
    private const OVERLAYS = [
        'fire' => [
            'file'    => 'fire_overlay.mp4',
            'dur'     => 6,
            'desc'    => 'Fire glow — warm orange/red upward gradient',
            // Upward-anchored orange fire that flickers with time.
            // Multipliers (182/57) keep max values ≤255 (182*1.4≈255, 57*1.4≈80)
            // so no clip() is needed — avoids multi-arg functions (commas) in the expression.
            // No shell: single quotes are passed literally, so they must be avoided.
            'vf'      => "geq=r=(1-Y/H)*182*abs(sin(X/60+T*4)+0.4)"
                       . ":g=(1-Y/H)*57*abs(sin(X/60+T*4)+0.4):b=0",
        ],
        'energy' => [
            'file'    => 'energy_pulse.mp4',
            'dur'     => 5,
            'desc'    => 'Blue energy pulse — radial glow from centre',
            // Radial cyan/blue pulse expanding from centre.
            // pow(sigma,2) replaced with sigma*sigma to avoid the comma inside pow().
            // clip() dropped — exp() is always 0..1 so channel values stay within 0..255.
            'vf'      => "geq=r=0"
                       . ":g=exp(-((X-W/2)*(X-W/2)+(Y-H/2)*(Y-H/2))"
                       .    "/((220+80*abs(sin(T*4)))*(220+80*abs(sin(T*4)))))"
                       .    "*220*abs(sin(T*5))"
                       . ":b=exp(-((X-W/2)*(X-W/2)+(Y-H/2)*(Y-H/2))"
                       .    "/((220+80*abs(sin(T*4)))*(220+80*abs(sin(T*4)))))"
                       .    "*255*abs(sin(T*5))",
        ],
        'neon' => [
            'file'    => 'neon_scan.mp4',
            'dur'     => 4,
            'desc'    => 'Neon scan line — horizontal cyan sweep',
            // Horizontal cyan scan line sweeping down.
            // mod(t*280,ih+120) comma escaped as \, so FFmpeg's filter parser
            // treats it as a literal comma inside the expression, not a chain separator.
            'vf'      => "drawbox=x=0:y=trunc(mod(t*280\,ih+120)-60):w=iw:h=4"
                       . ":color=0x00FFFF@0.9:t=fill,"
                       . "boxblur=0:8",
        ],
        'glitch' => [
            'file'    => 'glitch_static.mp4',
            'dur'     => 3,
            'desc'    => 'Glitch static — dim noise on near-black',
            // Dim noise overlay; screen-blend keeps it subtle
            'vf'      => "noise=alls=22:allf=t,eq=brightness=-0.6:contrast=0.8",
        ],
    ];

    public function handle(): int
    {
        $dir = public_path('overlays');
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
            $this->info("Created directory: {$dir}");
        }

        $force = $this->option('force');
        $ok    = 0;
        $skip  = 0;

        foreach (self::OVERLAYS as $key => $cfg) {
            $outPath = "{$dir}/{$cfg['file']}";

            if (!$force && file_exists($outPath) && filesize($outPath) > 0) {
                $this->line("  <fg=gray>skip</> {$cfg['file']} — already exists (use --force to regenerate)");
                $skip++;
                continue;
            }

            $this->info("  Generating {$cfg['file']} — {$cfg['desc']}");

            $cmd = [
                'ffmpeg', '-y',
                '-f', 'lavfi',
                '-i', "color=c=black:s=1920x1080:r=30:d={$cfg['dur']}",
                '-vf', $cfg['vf'],
                '-c:v', 'libx264',
                '-crf', '23',
                '-preset', 'fast',
                '-pix_fmt', 'yuv420p',
                '-an',
                $outPath,
            ];

            $result = Process::timeout(120)->run($cmd);

            if ($result->successful() && file_exists($outPath) && filesize($outPath) > 0) {
                $size = round(filesize($outPath) / 1024);
                $this->info("  <fg=green>done</> {$cfg['file']} ({$size} KB)");
                $ok++;
            } else {
                $this->error("  Failed: {$cfg['file']}");
                $this->line('  ' . $result->errorOutput());
            }
        }

        $this->newLine();
        $this->info("Done — {$ok} generated, {$skip} skipped.");
        $this->line('Assets saved to: ' . $dir);

        return self::SUCCESS;
    }
}
