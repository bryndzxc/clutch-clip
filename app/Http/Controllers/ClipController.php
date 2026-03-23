<?php

namespace App\Http\Controllers;

use App\Models\Clip;
use App\Models\Video;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Process;

class ClipController extends Controller
{
    /**
     * POST /clips/{video}/{clip}/refine
     *
     * Accept trim + format options, run FFmpeg on the original clip file,
     * and save the result as a refined export. The original is never touched.
     */
    public function refine(Request $request, Video $video, Clip $clip): JsonResponse
    {
        abort_if(auth()->id() !== $video->user_id, 403);
        abort_if($clip->video_id !== $video->id, 404);

        $data = $request->validate([
            'trim_start'   => ['required', 'numeric', 'min:0'],
            'trim_end'     => ['required', 'numeric', 'gt:trim_start'],
            'aspect_ratio' => ['required', 'in:original,9:16'],
            'muted'        => ['boolean'],
            'label'        => ['nullable', 'string', 'max:120'],
        ]);

        $sourcePath = $clip->getAbsolutePath();

        if (!file_exists($sourcePath)) {
            return response()->json(['message' => 'Source clip file not found.'], 404);
        }

        // ── Build output path ──────────────────────────────────────────────────
        $refinedDir = storage_path('app/public/clips/' . $clip->video_id . '/refined');
        @mkdir($refinedDir, 0755, true);
        $outFilename = 'clip_' . $clip->id . '_r' . time() . '.mp4';
        $outPath     = $refinedDir . '/' . $outFilename;

        // ── Clamp trim to actual clip duration ─────────────────────────────────
        $clipDuration = (float) $clip->duration;
        $trimStart    = max(0, min((float) $data['trim_start'], $clipDuration - 0.5));
        $trimEnd      = max($trimStart + 0.5, min((float) $data['trim_end'], $clipDuration));

        // ── Build FFmpeg arguments ─────────────────────────────────────────────
        $cmd = [
            'ffmpeg', '-y',
            '-ss', (string) $trimStart,
            '-to', (string) $trimEnd,
            '-i', $sourcePath,
        ];

        // Video filter: aspect ratio conversion
        if ($data['aspect_ratio'] === '9:16') {
            // Scale to fit inside 1080×1920, pad remainder with black
            $cmd[] = '-vf';
            $cmd[] = 'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=black';
        }

        // Audio: mute or re-encode with AAC
        if (!empty($data['muted'])) {
            $cmd[] = '-an';
        } else {
            $cmd[] = '-c:a';
            $cmd[] = 'aac';
            $cmd[] = '-b:a';
            $cmd[] = '192k';
        }

        // Video codec
        $cmd = array_merge($cmd, [
            '-c:v', 'libx264',
            '-preset', 'fast',
            '-crf', '22',
            '-movflags', '+faststart',
            $outPath,
        ]);

        Log::info('[ClipController] Starting refinement', [
            'clip_id'     => $clip->id,
            'trim_start'  => $trimStart,
            'trim_end'    => $trimEnd,
            'aspect_ratio'=> $data['aspect_ratio'],
            'muted'       => !empty($data['muted']),
        ]);

        $result = Process::timeout(120)->run($cmd);

        if (!$result->successful() || !file_exists($outPath) || filesize($outPath) === 0) {
            Log::error('[ClipController] FFmpeg refinement failed', [
                'clip_id' => $clip->id,
                'stderr'  => $result->errorOutput(),
            ]);

            // Clean up any partial output
            if (file_exists($outPath)) {
                @unlink($outPath);
            }

            return response()->json([
                'message' => 'Re-export failed. Please try again.',
            ], 500);
        }

        // ── Delete previous refined file (keep disk clean) ─────────────────────
        if ($clip->refined_path) {
            $oldPath = storage_path('app/' . $clip->refined_path);
            if (file_exists($oldPath)) {
                @unlink($oldPath);
            }
        }

        // ── Persist the refinement metadata ────────────────────────────────────
        $clip->update([
            'label'        => $data['label'] ?? $clip->label,
            'refined_path' => 'public/clips/' . $clip->video_id . '/refined/' . $outFilename,
            'muted'        => !empty($data['muted']),
            'refined_at'   => now(),
        ]);

        Log::info('[ClipController] Refinement saved', ['clip_id' => $clip->id, 'out' => $outPath]);

        return response()->json([
            'clip' => [
                'id'          => $clip->id,
                'label'       => $clip->label,
                'refined_url' => $clip->getRefinedUrl(),
                'refined_at'  => $clip->refined_at->toIso8601String(),
                'duration'    => round($trimEnd - $trimStart, 2),
                'muted'       => $clip->muted,
            ],
        ]);
    }

    /**
     * GET /clips/{video}/{clip}/refined
     *
     * Stream the refined clip file with Range support (mirrors serveClip).
     */
    public function serveRefined(Request $request, Video $video, Clip $clip)
    {
        abort_if(auth()->id() !== $video->user_id, 403);
        abort_if($clip->video_id !== $video->id, 404);

        $path = $clip->getRefinedAbsolutePath();

        if (!$path || !file_exists($path)) {
            abort(404, 'Refined clip not found.');
        }

        $size    = filesize($path);
        $headers = [
            'Content-Type'  => 'video/mp4',
            'Accept-Ranges' => 'bytes',
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
}
