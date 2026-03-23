# ClutchClip

AI-assisted gaming highlight generator. Upload a gameplay recording, get the best moments clipped automatically.

No manual scrubbing. No editing skills required. Drop in a session, walk away with highlights.

---

## How it works

1. **Upload** — drag and drop a gameplay video (MP4, MKV, WebM, AVI — up to 1.5 GB, 60 min max). Large files are sent in 50 MB chunks so the browser never hangs.
2. **Analyse** — a background job runs a Python script that extracts audio energy (RMS per second) and motion intensity (frame difference per second) across the entire video.
3. **Detect** — peaks in the combined signal are grouped into event windows. A post-roll filter penalises moments followed by a quiet death/respawn screen so kills rank higher than deaths.
4. **Clip** — the top 3 events are cut to 720p H.264 clips (6 s pre-roll, 4 s post-roll) and stored for download.
5. **View** — the results page polls for completion, then shows each clip with a thumbnail and score.

---

## Tech stack

| Layer | Tech |
|---|---|
| Backend | Laravel 12, PHP 8.2+ |
| Frontend | React 19, Inertia.js v2, Tailwind CSS, Vite |
| Queue | Database (default) or Redis |
| Analysis | Python 3 — OpenCV, NumPy, SciPy |
| Video | FFmpeg + ffprobe |
| Database | SQLite (default) or MySQL |

---

## Requirements

- PHP 8.2+ with extensions: `pdo`, `pdo_sqlite` (or `pdo_mysql`), `fileinfo`, `mbstring`
- Composer
- Node.js 20+
- Python 3.10+ with pip
- FFmpeg and ffprobe on `PATH`

---

## Local setup

### 1. Clone and install

```bash
git clone https://github.com/bryndzxc/clutch-clip.git
cd clutch-clip

composer install
npm install
```

### 2. Environment

```bash
cp .env.example .env
php artisan key:generate
```

Edit `.env` for your environment. SQLite works out of the box:

```env
DB_CONNECTION=sqlite
QUEUE_CONNECTION=database
```

### 3. Database

```bash
php artisan migrate
```

### 4. Python dependencies

```bash
pip install opencv-python numpy scipy
```

### 5. Storage symlink

```bash
php artisan storage:link
```

### 6. Build frontend assets

```bash
npm run dev      # development with hot reload
npm run build    # production build
```

### 7. Start the queue worker

Video processing runs in the background. The worker **must** be started manually with a long timeout — the default 60 seconds will kill the job mid-processing:

```bash
php artisan queue:work --timeout=660 --tries=1 --sleep=3
```

Keep this terminal open while testing.

### 8. Start the dev server

```bash
php artisan serve
```

Visit `http://localhost:8000`.

---

## PHP upload limits

Each chunk is 50 MB, so you only need modest PHP limits — but they must at least cover one chunk:

```ini
; php.ini
upload_max_filesize = 55M
post_max_size       = 60M
```

For Nginx, add:

```nginx
client_max_body_size 60M;
```

---

## Configuration

All ClutchClip-specific settings live in `config/clutchclip.php` and can be overridden via `.env`:

```env
# Upload limits
CLUTCHCLIP_MAX_SIZE_MB=1536             # max file size (default 1.5 GB)
CLUTCHCLIP_MAX_DURATION_MINUTES=60     # max video length (default 60 min)

# Automatic cleanup retention
CLUTCHCLIP_FAILED_RETENTION_HOURS=24    # keep failed uploads for debugging
CLUTCHCLIP_ABANDONED_RETENTION_HOURS=12 # orphan temp file TTL
CLUTCHCLIP_CLIPS_RETENTION_HOURS=48     # auto-delete final clips after 48 h
```

### Tuning highlight detection

Edit the constants at the top of `python/process_video.py`:

```python
AUDIO_WEIGHT         = 0.5   # weight for audio energy vs motion
MOTION_WEIGHT        = 0.5   # weight for motion vs audio
PRE_ROLL             = 6     # seconds of context before each highlight peak
POST_ROLL            = 4     # seconds of context after each highlight peak
MERGE_GAP            = 8     # merge peaks within this many seconds into one clip
MAX_CLIPS            = 3     # number of clips to produce

# Death/respawn screen filter
POST_QUIET_THRESHOLD = 0.08  # raise to filter deaths more aggressively
POST_QUIET_PENALTY   = 30    # score penalty for moments followed by silence
MIN_EVENT_SCORE      = 20    # drop events below this score entirely
```

---

## Cleanup

Run the cleanup command manually or on a cron schedule to remove temporary and expired files:

```bash
# Preview what would be deleted
php artisan clutchclip:cleanup --dry-run

# Run cleanup
php artisan clutchclip:cleanup
```

To schedule it automatically, add to `routes/console.php`:

```php
Schedule::command('clutchclip:cleanup')->hourly();
```

---

## Project structure

```
app/
  Http/Controllers/VideoController.php   # upload, chunked assembly, status, clips, serve
  Jobs/ProcessVideoJob.php               # runs Python, parses output, saves clips
  Models/Video.php                       # video record + file path helpers
  Models/Clip.php                        # clip record + URL helpers
  Console/Commands/CleanupTempFiles.php  # clutchclip:cleanup artisan command

python/
  process_video.py                       # highlight detection + FFmpeg clip cutting

resources/js/Pages/
  Upload.jsx                             # drag-and-drop upload with chunked fetch
  Results.jsx                            # polling + video preview + download

config/
  clutchclip.php                         # storage paths, upload limits, cleanup TTLs
  queue.php                              # retry_after bumped to 660 s for long jobs
```

---

## Upload flow

```
Browser
  └─ slices file into 50 MB chunks
  └─ POST /videos/chunks  × N            storeChunk()  — move() to temp/chunks/{id}/
  └─ POST /videos/assemble               assembleChunks()
        ├─ stream-concatenates all chunks → temp/uploads/{uuid}.ext
        ├─ deletes each chunk immediately after consuming it
        ├─ ffprobe duration check (rejects if over limit, deletes file)
        └─ Video::create() → ProcessVideoJob::dispatch()

Queue worker
  └─ ProcessVideoJob::handle()
        ├─ python process_video.py --input … --output-dir … --thumbnails-dir …
        ├─ parses JSON from stdout
        ├─ Clip::create() for each result
        └─ Video::deleteTempFile()  — source deleted after confirmed success
```

---

## Storage layout

```
storage/app/
  temp/
    uploads/    # assembled source videos (deleted after successful processing)
    chunks/     # in-flight upload chunks (deleted during assembly)
  public/
    clips/      # final highlight clips  — {video_id}/clip_{n}.mp4
    thumbnails/ # clip preview frames   — {video_id}/thumb_{n}.jpg
```

---

## Queue timeout reference

These three values must stay in sync — if `retry_after` is shorter than the job runtime, the same video will be processed twice simultaneously:

| Setting | Value | Location |
|---|---|---|
| `queue:work --timeout` | `660 s` | CLI flag when starting the worker |
| `ProcessVideoJob::$timeout` | `600 s` | `app/Jobs/ProcessVideoJob.php` |
| `Process::timeout()` | `580 s` | inside `ProcessVideoJob::handle()` |
| `retry_after` | `660 s` | `config/queue.php` (database + redis) |

---

## License

MIT
