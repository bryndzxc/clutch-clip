"""
process_video.py — ClutchClip highlight detector

Usage:
    python process_video.py --input /path/to/video.mp4 --output-dir /path/to/clips/

Output (stdout, last line):
    {"clips": [{"start": 120, "end": 135, "filename": "clip_1.mp4", "score": 87}, ...]}

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
# Config — tweak these to tune highlight detection
# ──────────────────────────────────────────────────────────────────────────────

AUDIO_WEIGHT   = 0.5   # weight for audio-peak score
MOTION_WEIGHT  = 0.5   # weight for frame-difference score

PRE_ROLL       = 6     # seconds of context before each highlight peak
POST_ROLL      = 4     # seconds of context after each highlight peak
MERGE_GAP      = 8     # merge peaks within this many seconds into one event window
MAX_CLIPS      = 3     # keep only top N clips (by score)
MIN_CLIPS      = 3     # minimum clips (if enough moments detected)

OUTPUT_HEIGHT  = 720   # output resolution height (720p); width auto-scaled
VIDEO_CRF      = 28    # H.264 CRF — 28 gives good quality at small file sizes

FRAME_SAMPLE   = 5     # analyze every Nth frame (speed vs accuracy tradeoff)


# ──────────────────────────────────────────────────────────────────────────────
# Step 1: Extract audio from video using FFmpeg → temp WAV file
# ──────────────────────────────────────────────────────────────────────────────

def extract_audio(video_path: str, tmp_dir: str) -> str | None:
    """
    Extracts mono 22050 Hz WAV audio from video.
    Returns path to WAV file, or None if extraction fails (silent video).
    """
    wav_path = os.path.join(tmp_dir, "audio.wav")
    cmd = [
        "ffmpeg", "-y",
        "-i", video_path,
        "-ac", "1",           # mono
        "-ar", "22050",       # 22 kHz sample rate
        "-vn",                # no video
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
        # RMS energy — captures "loud" moments well
        scores[sec] = np.sqrt(np.mean(chunk ** 2))

    # Normalize to [0, 1]
    max_val = scores.max()
    if max_val > 0:
        scores /= max_val

    return scores


# ──────────────────────────────────────────────────────────────────────────────
# Step 3: Compute per-second motion scores from frame differences
# ──────────────────────────────────────────────────────────────────────────────

def compute_motion_scores(video_path: str, video_duration: float) -> np.ndarray:
    """
    Reads video frames (every FRAME_SAMPLE-th), computes absolute diff between
    consecutive frames, groups by second, averages → motion score per second.
    Returns normalized [0, 1] array.
    """
    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0

    num_seconds = int(np.ceil(video_duration))
    second_scores = [[] for _ in range(num_seconds)]

    prev_gray = None
    frame_idx  = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        # Only process every FRAME_SAMPLE-th frame
        if frame_idx % FRAME_SAMPLE == 0:
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            gray = cv2.resize(gray, (320, 180))  # downscale for speed

            if prev_gray is not None:
                diff  = cv2.absdiff(gray, prev_gray)
                score = diff.mean()
                sec   = int(frame_idx / fps)
                if sec < num_seconds:
                    second_scores[sec].append(score)

            prev_gray = gray

        frame_idx += 1

    cap.release()

    # Average per second
    motion = np.array([
        np.mean(s) if s else 0.0
        for s in second_scores
    ], dtype=np.float32)

    # Normalize
    max_val = motion.max()
    if max_val > 0:
        motion /= max_val

    return motion


# ──────────────────────────────────────────────────────────────────────────────
# Step 4: Combine scores, group peaks into event windows
# ──────────────────────────────────────────────────────────────────────────────

def find_highlight_moments(
    audio_scores: np.ndarray,
    motion_scores: np.ndarray,
    video_duration: float
) -> list[dict]:
    """
    Merges audio + motion scores, finds peaks, groups nearby peaks into event
    windows using PRE_ROLL/POST_ROLL padding, merges overlapping events within
    MERGE_GAP seconds, and returns the top MAX_CLIPS events by score.

    Returns list of dicts: [{"start": int, "end": int, "score": int}, ...]
    """
    # Pad shorter array so they're the same length
    length = max(len(audio_scores), len(motion_scores))
    a = np.pad(audio_scores,  (0, length - len(audio_scores)))
    m = np.pad(motion_scores, (0, length - len(motion_scores)))

    combined = AUDIO_WEIGHT * a + MOTION_WEIGHT * m

    # Find raw peaks — small distance so nearby sub-peaks are kept for grouping
    peaks, _ = find_peaks(combined, distance=2, prominence=0.1)

    if len(peaks) == 0:
        # Fallback: evenly spaced event windows
        print("[peaks] No peaks found, using evenly spaced fallback.", file=sys.stderr)
        step   = max(1, int(video_duration / MAX_CLIPS))
        events = []
        for i in range(MAX_CLIPS):
            center = step * (i + 1)
            start  = max(0, center - PRE_ROLL)
            end    = min(int(video_duration), center + POST_ROLL)
            score  = int(combined[min(center, len(combined) - 1)] * 100) if len(combined) > 0 else 0
            events.append({"start": start, "end": end, "score": score})
        return events

    # Sort peaks chronologically
    peaks_sorted = sorted(peaks.tolist())

    # Group peaks that are within MERGE_GAP seconds of each other into one event
    groups = []
    current_group = [peaks_sorted[0]]
    for p in peaks_sorted[1:]:
        if p - current_group[-1] <= MERGE_GAP:
            current_group.append(p)
        else:
            groups.append(current_group)
            current_group = [p]
    groups.append(current_group)

    # Build event windows: PRE_ROLL before first peak, POST_ROLL after last peak
    events = []
    for group in groups:
        first_peak = group[0]
        last_peak  = group[-1]
        start = max(0, first_peak - PRE_ROLL)
        end   = min(int(video_duration), last_peak + POST_ROLL)
        score = int(max(combined[p] for p in group) * 100)
        events.append({"start": start, "end": end, "score": score})

    # Keep top MAX_CLIPS by score, then re-sort chronologically
    events.sort(key=lambda e: e["score"], reverse=True)
    top_events = events[:MAX_CLIPS]
    top_events.sort(key=lambda e: e["start"])

    return top_events


# ──────────────────────────────────────────────────────────────────────────────
# Step 5: Cut clips with FFmpeg
# ──────────────────────────────────────────────────────────────────────────────

def cut_clip(
    video_path: str,
    output_dir: str,
    clip_index: int,
    start_sec: int,
    end_sec: int
) -> str:
    """
    Cuts a clip from video_path using FFmpeg (fast copy, no re-encode).
    Returns the output filename.
    """
    filename   = f"clip_{clip_index}.mp4"
    output_path = os.path.join(output_dir, filename)
    duration   = end_sec - start_sec

    cmd = [
        "ffmpeg", "-y",
        "-ss", str(start_sec),                    # seek BEFORE -i for speed
        "-i", video_path,
        "-t", str(duration),
        "-vf", f"scale=-2:{OUTPUT_HEIGHT}",        # 720p, preserve aspect ratio
        "-c:v", "libx264",                         # H.264 (browser-compatible)
        "-c:a", "aac",                             # AAC audio
        "-preset", "slow",                         # better compression ratio
        "-crf", str(VIDEO_CRF),                    # small file size target
        "-movflags", "+faststart",                 # streaming-ready
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
# Main
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
        "-q:v", "3",           # JPEG quality (2-5 is good)
        output_path,
        "-loglevel", "error"
    ]

    result = subprocess.run(cmd, capture_output=True)

    if result.returncode != 0 or not os.path.exists(output_path):
        print(f"[thumb] Failed to generate thumbnail {clip_index}: {result.stderr.decode()}", file=sys.stderr)
        return None

    return filename


def main():
    parser = argparse.ArgumentParser(description="ClutchClip highlight detector")
    parser.add_argument("--input",           required=True, help="Path to source video")
    parser.add_argument("--output-dir",      required=True, help="Directory to save clips")
    parser.add_argument("--thumbnails-dir",  default=None,  help="Directory to save thumbnails")
    args = parser.parse_args()

    video_path     = args.input
    output_dir     = args.output_dir
    thumbnails_dir = args.thumbnails_dir

    if not os.path.exists(video_path):
        print(json.dumps({"error": f"Video not found: {video_path}"}))
        sys.exit(1)

    os.makedirs(output_dir, exist_ok=True)
    if thumbnails_dir:
        os.makedirs(thumbnails_dir, exist_ok=True)

    print(f"[info] Processing: {video_path}", file=sys.stderr)

    # Get duration
    duration = get_video_duration(video_path)
    print(f"[info] Duration: {duration:.1f}s", file=sys.stderr)

    with tempfile.TemporaryDirectory() as tmp_dir:

        # ── Audio scores ──────────────────────────────────────────────────────
        wav_path = extract_audio(video_path, tmp_dir)
        if wav_path:
            audio_scores = compute_audio_scores(wav_path, duration)
            print(f"[audio] Computed {len(audio_scores)} second scores.", file=sys.stderr)
        else:
            # No audio — use zeros (motion-only mode)
            audio_scores = np.zeros(int(np.ceil(duration)))

        # ── Motion scores ─────────────────────────────────────────────────────
        print("[motion] Analyzing frames...", file=sys.stderr)
        motion_scores = compute_motion_scores(video_path, duration)
        print(f"[motion] Computed {len(motion_scores)} second scores.", file=sys.stderr)

        # ── Find highlights ───────────────────────────────────────────────────
        moments = find_highlight_moments(audio_scores, motion_scores, duration)
        print(f"[peaks] Found {len(moments)} highlight moments.", file=sys.stderr)

        if len(moments) < MIN_CLIPS:
            print(f"[warn] Only {len(moments)} moments detected (need {MIN_CLIPS}).", file=sys.stderr)

        # ── Cut clips ─────────────────────────────────────────────────────────
        clips = []
        for i, event in enumerate(moments, start=1):
            # start/end already computed and clamped by find_highlight_moments
            start = event["start"]
            end   = event["end"]

            print(f"[clip {i}] Cutting {start}s → {end}s (score={event['score']})", file=sys.stderr)

            filename = cut_clip(video_path, output_dir, i, start, end)
            if filename:
                # Generate thumbnail at the midpoint of the clip
                thumbnail = None
                if thumbnails_dir:
                    mid_sec = start + (end - start) // 2
                    thumbnail = generate_thumbnail(video_path, thumbnails_dir, i, mid_sec)

                clips.append({
                    "start":     start,
                    "end":       end,
                    "filename":  filename,
                    "score":     event["score"],
                    "thumbnail": thumbnail,
                })

        # ── Output JSON ───────────────────────────────────────────────────────
        # IMPORTANT: this must be the last line of stdout — Laravel parses it.
        print(json.dumps({"clips": clips, "duration": duration}))


if __name__ == "__main__":
    main()
