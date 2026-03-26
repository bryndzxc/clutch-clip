"""
process_video.py — ClutchClip highlight detector

Legacy mode (all-in-one, backwards compatible):
    python process_video.py --input /path/to/video.mp4 --output-dir /path/to/clips/
                            [--clip-count 5] [--pre-roll 3] [--post-roll 3]
                            [--merge-gap 5] [--min-score 50]
                            [--quality high] [--resolution 720p] [--aspect-ratio original]

Optimized mode (detection only, PHP jobs handle cutting + thumbnails):
    python process_video.py --analysis-video /path/analysis.mp4
                            --analysis-audio /path/audio.wav
                            --source-duration 300.5
                            --detect-only
                            [--clip-count 5] [--pre-roll 3] [--post-roll 3]
                            [--merge-gap 5] [--min-score 50]

Output (stdout, last line):

  Legacy mode:
    {"clips": [{"start": 120, "end": 135, "filename": "clip_1.mp4", "score": 87, "thumbnail": "..."}, ...], "duration": 300.5}

  Detect-only mode:
    {"highlights": [{"start": 120, "end": 135, "score": 87}, ...]}

Dependencies:
    pip install opencv-python numpy scipy
    FFmpeg must be on PATH.
"""

import argparse
import json
import os
import subprocess
import sys
import tempfile

import cv2
import numpy as np
from scipy.io import wavfile
from scipy.signal import find_peaks


# ──────────────────────────────────────────────────────────────────────────────
# Fixed internal constants (not user-configurable)
# ──────────────────────────────────────────────────────────────────────────────

AUDIO_WEIGHT  = 0.5   # weight for audio-peak score
MOTION_WEIGHT = 0.5   # weight for frame-difference score

# Legacy mode: samples every 5th frame from the original full-res video,
# then resizes each frame to 320×180 for the diff.
FRAME_SAMPLE_LEGACY = 5

# Optimised mode: the analysis video is 640px wide and capped at 15 fps
# (set in PrepareAnalysisAssetsJob via ',fps=15' VF filter).
# Sampling every 5th frame of a 15 fps video → 3 fps of decoded frames,
# giving ~3 samples per 1-second bucket.  For a 60 fps source this is ~75 %
# fewer OpenCV loop iterations vs the old 10-skip-on-uncapped approach.
FRAME_SAMPLE_ANALYSIS = 5

# ──────────────────────────────────────────────────────────────────────────────
# Quality presets → FFmpeg CRF + preset flag
# ──────────────────────────────────────────────────────────────────────────────

QUALITY_PRESETS = {
    'standard': {'crf': 28, 'preset': 'medium'},
    'high':     {'crf': 20, 'preset': 'medium'},
    'smaller':  {'crf': 35, 'preset': 'fast'},
}

# ──────────────────────────────────────────────────────────────────────────────
# Resolution → output height in pixels
# ──────────────────────────────────────────────────────────────────────────────

RESOLUTION_MAP = {
    'low':  480,   # fast processing, smaller files
    '720p': 720,   # standard quality
    # '1080p' intentionally excluded
}


# ──────────────────────────────────────────────────────────────────────────────
# Step 1: Extract audio from video using FFmpeg → temp WAV file
# ──────────────────────────────────────────────────────────────────────────────

def extract_audio(video_path: str, tmp_dir: str, sample_rate: int = 16000) -> str | None:
    """
    Extracts mono WAV audio from video at the given sample rate.
    16 kHz is sufficient for RMS peak detection and is faster than 22 kHz.
    Returns path to WAV file, or None if extraction fails (silent video).
    """
    wav_path = os.path.join(tmp_dir, "audio.wav")
    cmd = [
        "ffmpeg", "-y",
        "-i", video_path,
        "-ac", "1",                  # mono
        "-ar", str(sample_rate),     # sample rate
        "-vn",                       # no video
        wav_path,
        "-loglevel", "error"
    ]
    result = subprocess.run(cmd, capture_output=True)
    if result.returncode != 0 or not os.path.exists(wav_path):
        print(f"[audio] No audio stream found or extraction failed.", file=sys.stderr)
        return None
    return wav_path


# ──────────────────────────────────────────────────────────────────────────────
# Step 2: Compute per-second audio peak scores
# ──────────────────────────────────────────────────────────────────────────────

def compute_audio_scores(wav_path: str, video_duration: float) -> np.ndarray:
    """
    Reads WAV and computes RMS amplitude per second.
    Returns array of length ceil(video_duration) normalized to [0, 1].
    """
    sample_rate, data = wavfile.read(wav_path)

    # Handle stereo (shouldn't happen after -ac 1, but just in case)
    if data.ndim > 1:
        data = data.mean(axis=1)

    data = data.astype(np.float32)
    num_seconds = int(np.ceil(video_duration))
    scores = np.zeros(num_seconds)

    for sec in range(num_seconds):
        start = sec * sample_rate
        end   = start + sample_rate
        chunk = data[start:end]
        if len(chunk) == 0:
            continue
        scores[sec] = np.sqrt(np.mean(chunk ** 2))

    max_val = scores.max()
    if max_val > 0:
        scores /= max_val

    return scores


# ──────────────────────────────────────────────────────────────────────────────
# Step 3: Compute per-second motion scores from frame differences
# ──────────────────────────────────────────────────────────────────────────────

def compute_motion_scores(
    video_path: str,
    video_duration: float,
    frame_sample: int = FRAME_SAMPLE_LEGACY,
    pre_scaled: bool = False,
) -> np.ndarray:
    """
    Reads video frames (every frame_sample-th), computes absolute diff between
    consecutive frames, groups by second, averages → motion score per second.

    pre_scaled=True: video is already low-res (e.g. 640px wide from PrepareAnalysisAssetsJob),
    so the per-frame cv2.resize() is skipped entirely.

    Returns normalized [0, 1] array.
    """
    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0

    num_seconds = int(np.ceil(video_duration))
    second_scores = [[] for _ in range(num_seconds)]

    prev_gray = None
    frame_idx  = 0

    while True:
        if frame_idx % frame_sample == 0:
            # Full decode — we need the pixel data for this frame.
            ret, frame = cap.read()
        else:
            # grab() advances the demuxer position without decoding pixel data.
            # ~8–10× cheaper than read() for H.264; critical when frame_sample > 1.
            ret  = cap.grab()
            frame = None

        if not ret:
            break

        if frame is not None:
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

            if not pre_scaled:
                # Legacy path: resize full-res frame down for speed
                gray = cv2.resize(gray, (320, 180))

            if prev_gray is not None:
                diff  = cv2.absdiff(gray, prev_gray)
                score = diff.mean()
                sec   = int(frame_idx / fps)
                if sec < num_seconds:
                    second_scores[sec].append(score)

            prev_gray = gray

        frame_idx += 1

    cap.release()

    motion = np.array([
        np.mean(s) if s else 0.0
        for s in second_scores
    ], dtype=np.float32)

    max_val = motion.max()
    if max_val > 0:
        motion /= max_val

    return motion


# ──────────────────────────────────────────────────────────────────────────────
# Step 3b: Context-aware event window scorer
# ──────────────────────────────────────────────────────────────────────────────

def _score_event_window(
    combined: np.ndarray,
    group_peaks: list,
    pre_roll: int,
    post_roll: int,
) -> float:
    """
    Scores an event window using three heuristic signals:

    1. Sustained intensity — average of the top-half values inside the capture
       window. Prefers moments where multiple seconds are active (real action)
       over a single spike surrounded by silence (flash / kill-cam cut).

    2. Payoff check — if post-peak activity drops to <10 % of the peak value,
       the moment ends immediately (death screen, loading screen, menu flash).
       Penalty capped at 40 % so hard-stop legitimate moments are not destroyed.

    3. Buildup bonus — rising activity *before* the peak suggests action
       building up (chase, fight escalation). Capped at +15 %.

    Returns a quality float in [0, ~1.15].
    """
    n          = len(combined)
    first_peak = group_peaks[0]
    last_peak  = group_peaks[-1]
    peak_val   = max(combined[min(p, n - 1)] for p in group_peaks)

    # ── 1. Sustained intensity ────────────────────────────────────────────────
    win_start = max(0, first_peak - pre_roll)
    win_end   = min(n, last_peak + post_roll + 1)
    window    = combined[win_start:win_end]
    if len(window) > 0:
        sorted_w  = np.sort(window)[::-1]
        sustained = float(np.mean(sorted_w[: max(1, len(sorted_w) // 2)]))
    else:
        sustained = float(peak_val)

    # ── 2. Payoff check ───────────────────────────────────────────────────────
    post_start  = min(n, last_peak + 1)
    post_end    = min(n, last_peak + 4)
    post_window = combined[post_start:post_end]
    if len(post_window) > 0:
        post_mean     = float(np.mean(post_window))
        payoff_ratio  = post_mean / (float(peak_val) + 1e-8)
        # Only apply penalty when post-peak drops to < 10 % of peak
        payoff_factor = max(0.6, payoff_ratio / 0.10) if payoff_ratio < 0.10 else 1.0
    else:
        payoff_factor = 1.0

    # ── 3. Buildup bonus ──────────────────────────────────────────────────────
    pre_start  = max(0, first_peak - 4)
    pre_window = combined[pre_start:first_peak]
    if len(pre_window) >= 2:
        trend         = float(pre_window[-1]) - float(pre_window[0])
        buildup_bonus = 1.0 + max(0.0, min(0.15, trend))
    else:
        buildup_bonus = 1.0

    return sustained * payoff_factor * buildup_bonus


# ──────────────────────────────────────────────────────────────────────────────
# Step 4: Combine scores, group peaks into event windows
# ──────────────────────────────────────────────────────────────────────────────

def find_highlight_moments(
    audio_scores: np.ndarray,
    motion_scores: np.ndarray,
    video_duration: float,
    pre_roll: int,
    post_roll: int,
    merge_gap: int,
    max_clips: int,
    min_score: int,
) -> list[dict]:
    """
    Merges audio + motion scores, finds peaks, groups nearby peaks into event
    windows, filters by min_score, and returns the top max_clips events.

    Improvements over the original:
    - 3-second rolling average smoothing before peak detection suppresses
      single-second noise (camera flashes, HUD blinks, brief menu overlays).
    - Baseline height threshold skips flat / idle segments.
    - Higher prominence (0.15) reduces false-positive peaks; two-tier fallback
      (retry at 0.05 before evenly-spaced) avoids over-filtering real clips.
    - _score_event_window() replaces raw max(peak): uses sustained intensity,
      payoff check, and build-up bonus for cross-game quality scoring.
    - Diversity-aware greedy selection avoids clustered clips from one short
      burst while ignoring the rest of the video.

    Returns list of dicts: [{"start": int, "end": int, "score": int}, ...]
    """
    length = max(len(audio_scores), len(motion_scores))
    a = np.pad(audio_scores,  (0, length - len(audio_scores)))
    m = np.pad(motion_scores, (0, length - len(motion_scores)))

    combined = AUDIO_WEIGHT * a + MOTION_WEIGHT * m

    # Smooth with 3-second rolling average to reduce single-second noise spikes.
    # Peak detection uses smoothed; scoring uses the original combined values.
    kernel   = np.ones(3) / 3.0
    smoothed = np.convolve(combined, kernel, mode='same')

    # Compute baseline from the 25th percentile of "active" seconds (>5 % level).
    # Used as a minimum height so idle / menu-heavy segments produce no peaks.
    active   = combined[combined > 0.05]
    baseline = float(np.percentile(active, 25)) if len(active) >= 10 else 0.0

    peaks, _ = find_peaks(smoothed, distance=2, prominence=0.15, height=max(0.05, baseline))

    if len(peaks) == 0:
        # Relaxed retry before falling back to evenly spaced clips
        peaks, _ = find_peaks(smoothed, distance=2, prominence=0.05)

    if len(peaks) == 0:
        print("[peaks] No peaks found, using evenly spaced fallback.", file=sys.stderr)
        step   = max(1, int(video_duration / max_clips))
        events = []
        for i in range(max_clips):
            center = step * (i + 1)
            start  = max(0, center - pre_roll)
            end    = min(int(video_duration), center + post_roll)
            score  = int(combined[min(center, len(combined) - 1)] * 100) if len(combined) > 0 else 0
            events.append({"start": start, "end": end, "score": score})
        return events

    peaks_sorted = sorted(peaks.tolist())

    groups = []
    current_group = [peaks_sorted[0]]
    for p in peaks_sorted[1:]:
        if p - current_group[-1] <= merge_gap:
            current_group.append(p)
        else:
            groups.append(current_group)
            current_group = [p]
    groups.append(current_group)

    events = []
    for group in groups:
        first_peak = group[0]
        last_peak  = group[-1]
        start = max(0, first_peak - pre_roll)
        end   = min(int(video_duration), last_peak + post_roll)

        # Context-aware score: sustained + payoff + buildup (see _score_event_window)
        quality = _score_event_window(combined, group, pre_roll, post_roll)
        score   = int(min(100, quality * 100))

        events.append({"start": start, "end": end, "score": score})

    events = [e for e in events if e["score"] >= min_score]

    if not events:
        print(f"[peaks] All moments below min_score={min_score}, no clips will be generated.", file=sys.stderr)
        return []

    # Diversity-aware greedy selection:
    # Sort by score DESC, then pick events that are at least min_gap seconds
    # apart from already-selected ones.  Falls back to filling remaining slots
    # by score so clip count is preserved even with tight temporal distribution.
    min_gap = max(merge_gap, pre_roll + post_roll + 2)
    events.sort(key=lambda e: e["score"], reverse=True)

    selected: list[dict] = []
    for event in events:
        too_close = any(abs(event["start"] - sel["start"]) < min_gap for sel in selected)
        if not too_close:
            selected.append(event)
        if len(selected) >= max_clips:
            break

    # Fill remaining slots with next-best events if diversity filtering fell short
    if len(selected) < max_clips:
        selected_ids = {id(e) for e in selected}
        for event in events:
            if id(event) not in selected_ids:
                selected.append(event)
                selected_ids.add(id(event))
            if len(selected) >= max_clips:
                break

    selected.sort(key=lambda e: e["start"])
    return selected


# ──────────────────────────────────────────────────────────────────────────────
# Step 5: Cut clips with FFmpeg (legacy all-in-one mode only)
# ──────────────────────────────────────────────────────────────────────────────

def cut_clip(
    video_path: str,
    output_dir: str,
    clip_index: int,
    start_sec: int,
    end_sec: int,
    output_height: int,
    crf: int,
    preset: str,
    vf_filter: str,
) -> str:
    """
    Cuts a clip from video_path using FFmpeg.
    Returns the output filename, or None on failure.
    """
    filename    = f"clip_{clip_index}.mp4"
    output_path = os.path.join(output_dir, filename)
    duration    = end_sec - start_sec

    cmd = [
        "ffmpeg", "-y",
        "-ss", str(start_sec),
        "-i", video_path,
        "-t", str(duration),
        "-vf", vf_filter,
        "-c:v", "libx264",
        "-c:a", "aac",
        "-preset", preset,
        "-crf", str(crf),
        "-movflags", "+faststart",
        "-avoid_negative_ts", "1",
        output_path,
        "-loglevel", "error"
    ]

    result = subprocess.run(cmd, capture_output=True)

    if result.returncode != 0:
        print(f"[ffmpeg] Failed to cut clip {clip_index}: {result.stderr.decode()}", file=sys.stderr)
        return None

    return filename


# ──────────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────────

def get_video_duration(video_path: str) -> float:
    """Use FFprobe to get video duration in seconds."""
    cmd = [
        "ffprobe", "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        video_path
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    try:
        return float(result.stdout.strip())
    except ValueError:
        print("[ffprobe] Could not determine duration, defaulting to 300s.", file=sys.stderr)
        return 300.0


def generate_thumbnail(video_path: str, thumbnails_dir: str, clip_index: int, time_sec: int) -> str | None:
    """
    Extract a single frame at time_sec from the video and save as a JPEG thumbnail.
    Returns the thumbnail filename, or None on failure.
    """
    filename = f"thumb_{clip_index}.jpg"
    output_path = os.path.join(thumbnails_dir, filename)

    cmd = [
        "ffmpeg", "-y",
        "-ss", str(time_sec),
        "-i", video_path,
        "-frames:v", "1",
        "-q:v", "3",
        output_path,
        "-loglevel", "error"
    ]

    result = subprocess.run(cmd, capture_output=True)

    if result.returncode != 0 or not os.path.exists(output_path):
        print(f"[thumb] Failed to generate thumbnail {clip_index}: {result.stderr.decode()}", file=sys.stderr)
        return None

    return filename


# ──────────────────────────────────────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="ClutchClip highlight detector")

    # ── Source (legacy mode — one or the other set of args required) ──────────
    parser.add_argument("--input",          default=None, help="Path to source video (legacy all-in-one mode)")
    parser.add_argument("--output-dir",     default=None, help="Directory to save clips (legacy mode)")
    parser.add_argument("--thumbnails-dir", default=None, help="Directory to save thumbnails (legacy mode)")

    # ── Optimised mode: pre-generated analysis assets ─────────────────────────
    parser.add_argument("--analysis-video",  default=None, help="Path to pre-generated low-res analysis video")
    parser.add_argument("--analysis-audio",  default=None, help="Path to pre-extracted mono 16 kHz WAV")
    parser.add_argument("--source-duration", type=float,   default=None, help="Duration of original source video (seconds)")

    # ── Detect-only flag: output timestamps JSON, skip clip cutting ───────────
    parser.add_argument("--detect-only", action="store_true",
                        help="Output highlight timestamps only — skip clip cutting and thumbnails")

    # ── Detection settings (user preferences) ─────────────────────────────────
    parser.add_argument("--clip-count",  type=int, default=5,  help="Max clips to generate")
    parser.add_argument("--pre-roll",    type=int, default=3,  help="Seconds before peak")
    parser.add_argument("--post-roll",   type=int, default=3,  help="Seconds after peak")
    parser.add_argument("--merge-gap",   type=int, default=5,  help="Merge window (seconds)")
    parser.add_argument("--min-score",   type=int, default=50, help="Minimum intensity score (0-100)")

    # ── Output settings (legacy mode only) ────────────────────────────────────
    parser.add_argument("--quality",      default="high",     choices=["standard", "high", "smaller"])
    parser.add_argument("--resolution",   default="720p",     choices=["low", "720p"])
    parser.add_argument("--aspect-ratio", default="original", choices=["original", "vertical"])

    args = parser.parse_args()

    # ── Decide mode ───────────────────────────────────────────────────────────
    use_analysis_assets = args.analysis_video is not None and args.analysis_audio is not None

    if not use_analysis_assets and not args.input:
        print(json.dumps({"error": "Either --input or (--analysis-video + --analysis-audio) must be provided."}))
        sys.exit(1)

    # ── Resolve duration ──────────────────────────────────────────────────────
    if use_analysis_assets:
        if args.source_duration is None:
            # Fall back to probing the analysis video (less accurate but safe)
            duration = get_video_duration(args.analysis_video)
        else:
            duration = args.source_duration
    else:
        if not os.path.exists(args.input):
            print(json.dumps({"error": f"Video not found: {args.input}"}))
            sys.exit(1)
        duration = get_video_duration(args.input)

    print(f"[info] Duration: {duration:.1f}s  mode={'analysis-assets' if use_analysis_assets else 'legacy'}  detect-only={args.detect_only}", file=sys.stderr)

    # ── Resolve quality / resolution for legacy clip-cutting ─────────────────
    quality_cfg   = QUALITY_PRESETS.get(args.quality, QUALITY_PRESETS["high"])
    crf           = quality_cfg["crf"]
    preset        = quality_cfg["preset"]
    output_height = RESOLUTION_MAP.get(args.resolution, 720)  # unknown value → 720p fallback

    if args.aspect_ratio == "vertical":
        vf_filter = f"crop=ih*9/16:ih,scale=-2:{output_height}"
    else:
        vf_filter = f"scale=-2:{output_height}"

    # ── Analysis: use pre-generated assets or extract inline ──────────────────
    def run_analysis(tmp_dir: str):
        if use_analysis_assets:
            audio_path   = args.analysis_audio
            analysis_vid = args.analysis_video
            pre_scaled   = True
            frame_sample = FRAME_SAMPLE_ANALYSIS
        else:
            audio_path   = extract_audio(args.input, tmp_dir)
            analysis_vid = args.input
            pre_scaled   = False
            frame_sample = FRAME_SAMPLE_LEGACY

        # Audio scores
        if audio_path and os.path.exists(audio_path):
            audio_scores = compute_audio_scores(audio_path, duration)
            print(f"[audio] Computed {len(audio_scores)} second scores.", file=sys.stderr)
        else:
            audio_scores = np.zeros(int(np.ceil(duration)))
            print("[audio] No audio — using zeros (motion-only mode).", file=sys.stderr)

        # Motion scores
        print(f"[motion] Analyzing frames (sample_every={frame_sample}, pre_scaled={pre_scaled})...", file=sys.stderr)
        motion_scores = compute_motion_scores(analysis_vid, duration, frame_sample=frame_sample, pre_scaled=pre_scaled)
        print(f"[motion] Computed {len(motion_scores)} second scores.", file=sys.stderr)

        return audio_scores, motion_scores

    with tempfile.TemporaryDirectory() as tmp_dir:
        audio_scores, motion_scores = run_analysis(tmp_dir)

        # ── Find highlights ───────────────────────────────────────────────────
        moments = find_highlight_moments(
            audio_scores, motion_scores, duration,
            pre_roll=args.pre_roll,
            post_roll=args.post_roll,
            merge_gap=args.merge_gap,
            max_clips=args.clip_count,
            min_score=args.min_score,
        )
        print(f"[peaks] Found {len(moments)} highlight moments.", file=sys.stderr)

        # ── Detect-only: output timestamps and exit ───────────────────────────
        if args.detect_only:
            # IMPORTANT: last line of stdout — Laravel DetectHighlightsJob parses it.
            print(json.dumps({"highlights": moments}))
            return

        # ── Legacy: cut clips + generate thumbnails ───────────────────────────
        os.makedirs(args.output_dir, exist_ok=True)
        if args.thumbnails_dir:
            os.makedirs(args.thumbnails_dir, exist_ok=True)

        clips = []
        clip_out_index = 0
        for i, event in enumerate(moments, start=1):
            start = event["start"]
            end   = event["end"]

            print(f"[clip {i}] Cutting {start}s → {end}s (score={event['score']})", file=sys.stderr)

            clip_out_index += 1
            filename = cut_clip(
                args.input, args.output_dir, clip_out_index, start, end,
                output_height=output_height,
                crf=crf,
                preset=preset,
                vf_filter=vf_filter,
            )
            if not filename:
                clip_out_index -= 1
                continue

            thumbnail = None
            if args.thumbnails_dir:
                mid_sec   = start + (end - start) // 2
                thumbnail = generate_thumbnail(args.input, args.thumbnails_dir, clip_out_index, mid_sec)

            clips.append({
                "start":     start,
                "end":       end,
                "filename":  filename,
                "score":     event["score"],
                "thumbnail": thumbnail,
            })

        # IMPORTANT: last line of stdout — Laravel ProcessVideoJob parses it.
        print(json.dumps({"clips": clips, "duration": duration}))


if __name__ == "__main__":
    main()
