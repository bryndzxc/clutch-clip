<?php

namespace App\Http\Controllers;

use App\Jobs\ProcessVideoJob;
use App\Models\Clip;
use App\Models\MontageProject;
use App\Models\Video;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Process;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;

class VideoController extends Controller
{
    public function landing(): InertiaResponse
    {
        return Inertia::render('Landing');
    }

    public function index(): InertiaResponse
    {
        $recentVideos = Video::where('user_id', auth()->id())
            ->latest('uploaded_at')
            ->take(5)
            ->get()
            ->map(fn(Video $video) => [
                'id'            => $video->id,
                'original_name' => $video->original_name,
                'status'        => $video->status,
                'uploaded_at'   => $video->uploaded_at?->diffForHumans() ?? 'recently',
            ]);

        return Inertia::render('Upload', [
            'recentVideos' => $recentVideos,
            'recentProjects' => $this->recentMontageProjectsPayload(limit: 4),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $maxSizeMb      = config('clutchclip.upload.max_size_mb', 1536);
        $maxSizeKb      = $maxSizeMb * 1024;
        $maxDurationMin = config('clutchclip.upload.max_duration_minutes', 60);

        // ── Step 1: Validate file size and mimetype ───────────────────────────
        $request->validate([
            'video' => [
                'required',
                'file',
                'mimetypes:video/mp4,video/x-matroska,video/webm,video/avi,video/x-msvideo,video/msvideo',
                "max:{$maxSizeKb}",
            ],
        ], [
            'video.max'      => "Video exceeds the maximum allowed size of {$maxSizeMb} MB.",
            'video.mimetypes' => 'Unsupported format. Please upload an MP4, MKV, WebM, or AVI file.',
        ]);

        $uploaded = $request->file('video');
        $filename = Str::uuid() . '.' . $uploaded->getClientOriginalExtension();

        // ── Step 2: Move to temporary directory (rename, no copy) ────────────
        $tempDir = storage_path('app/' . config('clutchclip.temp_upload_dir'));
        @mkdir($tempDir, 0755, true);
        $uploaded->move($tempDir, $filename);

        $tempPath = config('clutchclip.temp_upload_dir') . '/' . $filename;
        $absPath  = storage_path('app/' . $tempPath);

        // ── Step 3: Inspect actual video duration before creating any record ──
        $duration       = $this->probeVideoDuration($absPath);
        $maxDurationSec = $maxDurationMin * 60;

        if ($duration !== null && $duration > $maxDurationSec) {
            @unlink($absPath);
            Log::info("[VideoController] Rejected upload — duration {$duration}s exceeds {$maxDurationSec}s limit. File deleted.");

            return response()->json([
                'message' => "Video exceeds the maximum allowed duration of {$maxDurationMin} minutes. For best results, upload focused gameplay sessions under {$maxDurationMin} minutes.",
                'errors'  => ['video' => ["Video exceeds the maximum allowed duration of {$maxDurationMin} minutes."]],
            ], 422);
        }

        // ── Step 4: Persist record and queue processing ───────────────────────
        $video = Video::create([
            'user_id'       => auth()->id(),
            'filename'      => $filename,
            'original_name' => $uploaded->getClientOriginalName(),
            'temp_path'     => $tempPath,
            'size'          => $uploaded->getSize(),
            'status'        => 'pending',
            'uploaded_at'   => now(),
        ]);

        ProcessVideoJob::dispatch($video->id);

        return response()->json(['id' => $video->id, 'status' => $video->status], 201);
    }

    /**
     * Receive a single chunk and save it to a temporary holding directory.
     * The frontend sends chunks sequentially; this just writes each one to disk.
     */
    public function storeChunk(Request $request): JsonResponse
    {
        $request->validate([
            'upload_id'    => ['required', 'string', 'regex:/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i'],
            'chunk_index'  => ['required', 'integer', 'min:0', 'max:999'],
            'total_chunks' => ['required', 'integer', 'min:1', 'max:1000'],
            'chunk'        => ['required', 'file'],
        ]);

        $uploadId   = $request->input('upload_id');
        $chunkIndex = (int) $request->input('chunk_index');

        $chunkDir = storage_path('app/' . config('clutchclip.chunks_dir') . '/' . $uploadId);
        if (!is_dir($chunkDir)) {
            mkdir($chunkDir, 0755, true);
        }

        // move_uploaded_file — atomic rename, no data copy
        $request->file('chunk')->move($chunkDir, "chunk_{$chunkIndex}");

        return response()->json(['received' => true]);
    }

    /**
     * Verify all chunks are present, stream-assemble them into a single file,
     * run size + duration validation, then create the Video record and queue the job.
     * Each chunk is deleted immediately after it is consumed.
     */
    public function assembleChunks(Request $request): JsonResponse
    {
        $request->validate([
            'upload_id'    => ['required', 'string', 'regex:/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i'],
            'filename'     => ['required', 'string', 'max:255'],
            'total_chunks' => ['required', 'integer', 'min:1', 'max:1000'],
        ]);

        $uploadId     = $request->input('upload_id');
        $totalChunks  = (int) $request->input('total_chunks');
        $originalName = $request->input('filename');
        $chunkDir     = storage_path('app/' . config('clutchclip.chunks_dir') . '/' . $uploadId);

        // Verify every chunk landed before touching any of them
        for ($i = 0; $i < $totalChunks; $i++) {
            if (!file_exists("{$chunkDir}/chunk_{$i}")) {
                return response()->json(['message' => "Upload incomplete — chunk {$i} is missing. Please try again."], 422);
            }
        }

        // Prepare destination file
        $ext      = strtolower(pathinfo($originalName, PATHINFO_EXTENSION)) ?: 'mp4';
        $filename = Str::uuid() . '.' . $ext;
        $tempPath = config('clutchclip.temp_upload_dir') . '/' . $filename;
        $absPath  = storage_path('app/' . $tempPath);

        // Ensure destination directory exists before writing
        @mkdir(dirname($absPath), 0755, true);

        // Stream-assemble: read each chunk into the output file, delete chunk immediately
        $out = fopen($absPath, 'wb');
        for ($i = 0; $i < $totalChunks; $i++) {
            $chunkPath = "{$chunkDir}/chunk_{$i}";
            $in = fopen($chunkPath, 'rb');
            stream_copy_to_stream($in, $out);
            fclose($in);
            unlink($chunkPath);
        }
        fclose($out);
        @rmdir($chunkDir);

        $fileSize  = filesize($absPath);
        $maxSizeMb = config('clutchclip.upload.max_size_mb', 1536);

        if ($fileSize > $maxSizeMb * 1024 * 1024) {
            @unlink($absPath);
            return response()->json([
                'message' => "Video exceeds the maximum allowed size of {$maxSizeMb} MB.",
                'errors'  => ['video' => ["Video exceeds the maximum allowed size of {$maxSizeMb} MB."]],
            ], 422);
        }

        $maxDurationMin = config('clutchclip.upload.max_duration_minutes', 60);
        $duration       = $this->probeVideoDuration($absPath);

        if ($duration !== null && $duration > $maxDurationMin * 60) {
            @unlink($absPath);
            Log::info("[VideoController] Rejected assembled upload — duration {$duration}s. File deleted.");
            return response()->json([
                'message' => "Video exceeds the maximum allowed duration of {$maxDurationMin} minutes. For best results, upload focused gameplay sessions under {$maxDurationMin} minutes.",
                'errors'  => ['video' => ["Video exceeds the maximum allowed duration of {$maxDurationMin} minutes."]],
            ], 422);
        }

        $video = Video::create([
            'user_id'       => auth()->id(),
            'filename'      => $filename,
            'original_name' => $originalName,
            'temp_path'     => $tempPath,
            'size'          => $fileSize,
            'status'        => 'pending',
            'uploaded_at'   => now(),
        ]);

        ProcessVideoJob::dispatch($video->id);

        return response()->json(['id' => $video->id, 'status' => $video->status], 201);
    }

    /**
     * Run ffprobe on the given file and return its duration in seconds.
     * Returns null if ffprobe is unavailable or the probe fails — callers
     * treat null as "unknown duration, allow through".
     */
    private function probeVideoDuration(string $absPath): ?float
    {
        $result = Process::run([
            'ffprobe', '-v', 'error',
            '-show_entries', 'format=duration',
            '-of', 'default=noprint_wrappers=1:nokey=1',
            $absPath,
        ]);

        if (!$result->successful()) {
            Log::warning("[VideoController] ffprobe failed for {$absPath}: " . $result->errorOutput());
            return null;
        }

        $output = trim($result->output());

        return is_numeric($output) ? (float) $output : null;
    }

    public function history(): InertiaResponse
    {
        $videos = Video::where('user_id', auth()->id())
            ->withCount('clips')
            ->latest('uploaded_at')
            ->get()
            ->map(fn(Video $v) => [
                'id'            => $v->id,
                'original_name' => $v->original_name,
                'status'        => $v->status,
                'size'          => $v->size,
                'duration'      => $v->duration,
                'clips_count'   => $v->clips_count,
                'uploaded_at'   => $v->uploaded_at?->diffForHumans(),
                'processed_at'  => $v->processed_at?->diffForHumans(),
            ]);

        return Inertia::render('History', [
            'videos' => $videos,
            'recentProjects' => $this->recentMontageProjectsPayload(limit: 3),
        ]);
    }

    public function destroy(Video $video): RedirectResponse
    {
        abort_if(auth()->id() !== $video->user_id, 403);

        // Delete clip files and thumbnails from disk
        foreach ($video->clips as $clip) {
            $clipPath = $clip->getAbsolutePath();
            if (file_exists($clipPath)) {
                @unlink($clipPath);
            }
            if ($clip->thumbnail_path) {
                $thumbPath = storage_path('app/' . $clip->thumbnail_path);
                if (file_exists($thumbPath)) {
                    @unlink($thumbPath);
                }
            }
        }

        // Delete temp source file if still on disk
        $video->deleteTempFile();

        // Delete record — clips cascade via FK
        $video->delete();

        return redirect()->route('history');
    }

    public function status(Video $video): JsonResponse
    {
        abort_if(auth()->id() !== $video->user_id, 403);

        return response()->json([
            'id'            => $video->id,
            'status'        => $video->status,
            'duration'      => $video->duration,
            'error_message' => $video->error_message,
            'processed_at'  => $video->processed_at?->toIso8601String(),
        ]);
    }

    public function clips(Video $video): JsonResponse
    {
        abort_if(auth()->id() !== $video->user_id, 403);

        if ($video->status !== 'done') {
            return response()->json(['message' => 'Processing not complete'], 422);
        }

        $clips = $video->clips->map(fn(Clip $clip) => [
            'id'            => $clip->id,
            'start_time'    => $clip->start_time,
            'end_time'      => $clip->end_time,
            'duration'      => $clip->duration,
            'score'         => $clip->score,
            'url'           => $clip->getUrl(),
            'thumbnail_url' => $clip->getThumbnailUrl(),
        ]);

        return response()->json([
            'video' => [
                'id'            => $video->id,
                'original_name' => $video->original_name,
                'duration'      => $video->duration,
            ],
            'clips' => $clips,
        ]);
    }

    public function serveClip(Request $request, Video $video, Clip $clip)
    {
        abort_if($clip->video_id !== $video->id, 404);

        $path = $clip->getAbsolutePath();

        if (!file_exists($path)) {
            abort(404, 'Clip file not found.');
        }

        $size = filesize($path);
        $headers = [
            'Content-Type'   => 'video/mp4',
            'Accept-Ranges'  => 'bytes',
        ];

        // Handle Range requests (required for browser video playback)
        $range = $request->header('Range');
        if ($range) {
            preg_match('/bytes=(\d+)-(\d*)/', $range, $matches);
            $start = (int) $matches[1];
            $end   = isset($matches[2]) && $matches[2] !== '' ? (int) $matches[2] : $size - 1;
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

    public function results(Video $video): InertiaResponse
    {
        abort_if(auth()->id() !== $video->user_id, 403);

        // Pre-load clips when already done — avoids a second round-trip
        $initialClips = [];
        if ($video->status === 'done') {
            $initialClips = $video->clips->map(fn(Clip $clip) => [
                'id'            => $clip->id,
                'start_time'    => $clip->start_time,
                'end_time'      => $clip->end_time,
                'duration'      => $clip->duration,
                'score'         => $clip->score,
                'url'           => $clip->getUrl(),
                'thumbnail_url' => $clip->getThumbnailUrl(),
            ])->values()->all();
        }

        return Inertia::render('Results', [
            'video' => [
                'id'            => $video->id,
                'original_name' => $video->original_name,
                'status'        => $video->status,
                'duration'      => $video->duration,
                'size'          => $video->size,
                'uploaded_at'   => $video->uploaded_at?->format('M j, Y g:i A'),
                'processed_at'  => $video->processed_at?->diffForHumans(),
                'error_message' => $video->error_message,
                'clip_count'    => count($initialClips),
            ],
            'initialClips' => $initialClips,
            'relatedProjects' => $this->recentMontageProjectsPayload(videoId: $video->id, limit: 3),
        ]);
    }

    private function recentMontageProjectsPayload(?int $videoId = null, int $limit = 4): array
    {
        $query = MontageProject::query()
            ->where('user_id', auth()->id())
            ->with('video')
            ->withCount('montages')
            ->orderByRaw("CASE WHEN status = 'pending' THEN 0 ELSE 1 END")
            ->orderByDesc('last_edited_at')
            ->orderByDesc('updated_at');

        if ($videoId !== null) {
            $query->where('video_id', $videoId);
        }

        return $query
            ->limit($limit)
            ->get()
            ->map(fn (MontageProject $project) => [
                'id'             => $project->id,
                'title'          => $project->title,
                'status'         => $this->normalizedProjectStatus($project->status),
                'is_draft'       => $this->normalizedProjectStatus($project->status) === 'pending',
                'video_name'     => $project->video?->original_name,
                'clip_count'     => count(is_array($project->clip_order) ? $project->clip_order : []),
                'montages_count' => $project->montages_count ?? 0,
                'last_edited_at' => $project->last_edited_at?->toIso8601String(),
                'resume_url'     => route('montage-projects.show', $project),
            ])
            ->values()
            ->all();
    }

    private function normalizedProjectStatus(?string $status): ?string
    {
        return match ($status) {
            'queued', 'processing' => 'rendering',
            'done'                 => 'completed',
            default                => $status,
        };
    }
}
