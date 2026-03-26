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

AUDIO_WEIGHT  = 0.40  # raw RMS amplitude per second
MOTION_WEIGHT = 0.25  # raw frame-difference per second
              # ↑ was 0.30 — raw motion alone over-weights walking/spectating/death-cam;
              #   reducing it stops steady panning motion from inflating scores.
BURST_WEIGHT  = 0.25  # local temporal variance of motion (distinguishes action from walking/spectating)
              # ↑ was 0.20 — burst now equals raw motion; chaotic action scores higher,
              #   passive steady movement scores lower.
ADELTA_WEIGHT = 0.10  # audio change rate (rewards sudden audio events over constant ambient music)

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
# Step 3a: Motion burstiness (temporal variance of motion scores)
# ──────────────────────────────────────────────────────────────────────────────

def compute_motion_burstiness(motion_scores: np.ndarray, window: int = 5) -> np.ndarray:
    """
    Computes local temporal standard deviation of motion scores in a sliding window.

    High variance = bursty, reactive motion → combat, teamfights, key plays.
    Low variance  = steady-state motion → walking, spectating, camera panning.

    This is computed purely from the already-computed motion_scores array — zero
    extra FFmpeg / OpenCV work.  The result is used as BURST_WEIGHT in the
    combined scoring signal to down-rank no-action / walking / spectate moments.

    Returns a normalized [0, 1] float32 array of the same length.
    """
    n = len(motion_scores)
    if n == 0:
        return np.zeros(0, dtype=np.float32)

    half       = window // 2
    burstiness = np.zeros(n, dtype=np.float32)

    for i in range(n):
        lo = max(0, i - half)
        hi = min(n, i + half + 1)
        chunk = motion_scores[lo:hi]
        if len(chunk) >= 2:
            burstiness[i] = float(np.std(chunk))

    max_val = burstiness.max()
    if max_val > 0:
        burstiness /= max_val

    return burstiness


# ──────────────────────────────────────────────────────────────────────────────
# Step 3b: Context-aware event window scorer
# ──────────────────────────────────────────────────────────────────────────────

def _score_event_window(
    combined: np.ndarray,
    group_peaks: list,
    pre_roll: int,
    post_roll: int,
    motion_burst: np.ndarray,
    motion_raw: np.ndarray | None = None,
    audio_raw: np.ndarray | None = None,
    audio_delta: np.ndarray | None = None,
) -> float:
    """
    Scores an event window using six heuristic signals that together model the
    arc of a gaming highlight:  setup → engagement → payoff → continuation.

    1. Sustained intensity — average of the top-half values inside the capture
       window. Prefers moments where multiple seconds are active (real action)
       over a single spike surrounded by silence.

    2. Spike width check — counts how many seconds in the window reach ≥ 50 %
       of the peak value.  Fewer than 4 seconds = narrow spike:
         - utility throw / grenade / ability burst (1–2 s peak then done)
         - very brief losing skirmish with no continuation
       Real engagements sustain 4+ seconds of high activity.  Narrow spikes
       receive a 25 % score penalty.

    3. Immediate payoff — if the 1–3 s after the peak drops to < 10 % of peak,
       the moment hard-stopped (death, loading screen, menu flash).
       Penalty capped at 50 %.

    4. Extended collapse / continuation — looks 4–8 s after the peak to
       distinguish confirmed failure from a momentary dip:
         - BOTH immediate AND extended near-zero → confirmed death/respawn
           → additional 30 % penalty on top of the immediate payoff penalty
         - Extended activity stays > 35 % of peak → player is still alive,
           action continued → +10–15 % continuation bonus

    5. Buildup bonus — rising activity in the 4 s before the peak suggests
       an escalating fight (not a random ambush).  Capped at +15 %.

    6. Passivity penalty — if motion burstiness is uniformly low across the
       window, motion is steady / uniform (spectating, idle walk, death-cam
       replay).  Mean burst < 0.15 → 35 % penalty.

    7. Hard signal collapse — detects a sharp >60 % drop within 2 s of the
       peak that stays low in the extended window.  Kill-cam / respawn / menu
       transitions produce a "cliff edge" that the gradual payoff check
       misses.  Penalty: 40–50 %.

    8. Death-cam / spectate detector — after the peak, if raw motion remains
       moderate (camera panning) but burstiness drops to near-zero (steady,
       non-reactive movement), this matches the kill-cam / spectate signature.
       Penalty: 50 %.

    9. Utility-only rejection — strengthens the spike-width penalty: if the
       spike is narrow AND post-burst engagement is low, the moment is almost
       certainly a grenade / smoke / ability with no follow-up fight.
       Combined with spike_width_factor this can reach 0.34× (≈ score 34 for
       a peak of 1.0), which reliably drops below min_score=50.

    10. Clip tail quality — examines the last 2–3 s of the actual clip window
        (what the viewer sees at the end).  Low tail activity = clip ends on
        death / silence.  Penalty: 25–45 %.

    11. Post-peak audio-motion coherence — real engagements have BOTH audio
        AND motion active after the peak.  Single-channel activity (ambient
        music alone, or camera pan alone) indicates death-cam, menu, or
        respawn.  Penalty: 35–55 %.

    12. Audio-isolated utility detection — uses audio_delta to detect the
        impulse-then-silence signature of grenades/smokes/abilities even
        when spike_width_factor didn't fire (nearby peaks inflated width).
        Penalty: 45–50 %.

    Returns a quality float in [0, ~1.3].  Multiply by 100 for score 0–100.
    """
    n          = len(combined)
    first_peak = group_peaks[0]
    last_peak  = group_peaks[-1]
    peak_val   = max(combined[min(p, n - 1)] for p in group_peaks)

    win_start = max(0, first_peak - pre_roll)
    win_end   = min(n, last_peak + post_roll + 1)
    window    = combined[win_start:win_end]

    # ── 1. Sustained intensity ────────────────────────────────────────────────
    if len(window) > 0:
        sorted_w  = np.sort(window)[::-1]
        sustained = float(np.mean(sorted_w[: max(1, len(sorted_w) // 2)]))
    else:
        sustained = float(peak_val)

    # ── 2. Spike width — utility / brief-skirmish penalty ────────────────────
    # A grenade throw, smoke, or ability burst produces 1–3 high-intensity
    # seconds then drops.  A real sustained fight holds above 50 % of peak for
    # 4+ consecutive-ish seconds.  We count seconds inside the window that
    # are ≥ 50 % of peak_val across the full capture window.
    #
    # Threshold 4 s chosen because:
    #   - typical grenade arc + explosion ≈ 2–3 high-activity seconds
    #   - shortest meaningful gunfight (2-player exchange) ≈ 3–5 s
    #   - allows a 1-second dip inside a fight without triggering the penalty
    high_threshold   = float(peak_val) * 0.50
    high_count       = int(np.sum(window >= high_threshold))
    spike_width_factor = 0.75 if high_count < 4 else 1.0

    # ── 3. Immediate payoff (1–3 s after peak) ────────────────────────────────
    post_start  = min(n, last_peak + 1)
    post_end    = min(n, last_peak + 4)
    post_window = combined[post_start:post_end]
    if len(post_window) > 0:
        post_mean    = float(np.mean(post_window))
        payoff_ratio = post_mean / (float(peak_val) + 1e-8)
        payoff_factor = max(0.50, payoff_ratio / 0.10) if payoff_ratio < 0.10 else 1.0
    else:
        post_mean     = 0.0
        payoff_ratio  = 1.0
        payoff_factor = 1.0

    # ── 4. Extended collapse / continuation (4–8 s after peak) ───────────────
    # Only evaluated when there is enough post-peak signal (≥ 5 s remaining).
    # Events at the very end of a video are not penalised for running out of data.
    ext_start = min(n, last_peak + 4)
    ext_end   = min(n, last_peak + 9)

    collapse_factor    = 1.0
    continuation_bonus = 1.0

    if (n - last_peak) >= 5 and ext_end > ext_start:
        ext_window = combined[ext_start:ext_end]
        ext_mean   = float(ext_window.mean()) if len(ext_window) > 0 else 0.0
        ext_ratio  = ext_mean / (float(peak_val) + 1e-8)

        if payoff_ratio < 0.10 and ext_ratio < 0.15:
            # Confirmed failure arc: immediate drop → stays near-zero.
            # Pattern: death screen, respawn lobby, or hard game-state reset.
            # Applies on top of payoff_factor; together these can reach 0.35×
            # which is enough to push most losing fights below min_score=50.
            collapse_factor = 0.70
        elif ext_ratio > 0.35:
            # Player is still active 4–8 s after the peak: fight continued,
            # objective captured, chase persisted — genuine highlight follow-through.
            # Require audio-motion coherence: both channels must be active in
            # the extended window, not just one channel inflating combined.
            _coherent = True
            if audio_raw is not None and motion_raw is not None:
                ext_audio_mean = float(np.mean(audio_raw[ext_start:ext_end]))
                ext_motion_mean = float(np.mean(motion_raw[ext_start:ext_end]))
                # Both channels must contribute; one alone = ambient noise
                _coherent = ext_audio_mean > 0.15 and ext_motion_mean > 0.15
            if _coherent:
                continuation_bonus = 1.15 if ext_ratio > 0.50 else 1.10
            else:
                continuation_bonus = 1.0  # single-channel activity, not real engagement

    # ── 5. Buildup bonus ──────────────────────────────────────────────────────
    pre_start  = max(0, first_peak - 4)
    pre_window = combined[pre_start:first_peak]
    if len(pre_window) >= 2:
        trend         = float(pre_window[-1]) - float(pre_window[0])
        buildup_bonus = 1.0 + max(0.0, min(0.15, trend))
    else:
        buildup_bonus = 1.0

    # ── 6. Passivity penalty — spectating / idle walking / death-cam ──────────
    if len(motion_burst) > 0:
        win_burst  = motion_burst[win_start:win_end]
        mean_burst = float(win_burst.mean()) if len(win_burst) > 0 else 0.0
        passivity_factor = 0.65 if mean_burst < 0.15 else 1.0
    else:
        passivity_factor = 1.0

    # ── 7. Hard signal collapse — death / loading / menu transition ──────────
    # Detect a sharp drop (>60%) within 2 seconds of the peak that stays low.
    # Kill-cam / spectate / respawn screens produce a distinctive "cliff edge"
    # in the combined signal that the gradual payoff_factor misses because
    # kill-cams still generate moderate ambient motion + audio.
    #
    # We look at the 2 seconds immediately after the peak: if the minimum
    # value in that micro-window is < 40 % of peak AND the extended window
    # (4–8 s) also stays below 30 %, this is a hard state transition.
    cliff_factor = 1.0
    micro_start = min(n, last_peak + 1)
    micro_end   = min(n, last_peak + 3)   # 2-second micro-window
    if micro_end > micro_start:
        micro_window = combined[micro_start:micro_end]
        micro_min    = float(np.min(micro_window))
        micro_ratio  = micro_min / (float(peak_val) + 1e-8)
        if micro_ratio < 0.40:
            # Sharp drop detected — check if it stays low (extended window)
            if ext_end > ext_start:
                ext_window_vals = combined[ext_start:ext_end]
                ext_max = float(np.max(ext_window_vals)) if len(ext_window_vals) > 0 else 0.0
                ext_max_ratio = ext_max / (float(peak_val) + 1e-8)
                if ext_max_ratio < 0.30:
                    # Confirmed hard collapse: cliff + stays dead
                    cliff_factor = 0.40
            elif (n - last_peak) < 5:
                pass  # not enough data, don't penalize
            else:
                cliff_factor = 0.50  # cliff detected but no extended data

    # ── 8. Post-peak death-cam / spectate detector ────────────────────────────
    # Death / spectate has a specific motion signature: raw motion stays
    # moderate (camera slowly panning over the scene) but burstiness drops
    # to near-zero (steady, non-reactive, automated camera movement).
    # This catches cases where kill-cam motion keeps payoff_ratio above
    # the 0.10 threshold, defeating the payoff penalty.
    deathcam_factor = 1.0
    if len(motion_burst) > 0 and motion_raw is not None and len(motion_raw) > 0:
        post_burst_start = min(len(motion_burst), last_peak + 1)
        post_burst_end   = min(len(motion_burst), last_peak + 6)  # 5s post-peak
        if post_burst_end > post_burst_start:
            post_burst = motion_burst[post_burst_start:post_burst_end]
            post_burst_mean = float(np.mean(post_burst))
            # Also check raw motion to confirm camera is still moving
            post_motion = motion_raw[post_burst_start:post_burst_end]
            post_motion_mean = float(np.mean(post_motion))
            # Death-cam signature: motion present (>0.15) but burst near zero (<0.10)
            if post_burst_mean < 0.10 and post_motion_mean > 0.15:
                deathcam_factor = 0.50

    # ── 9. Utility-only rejection — narrow spike with no engagement payoff ───
    # Strengthens the spike_width_factor: if the spike is narrow (<4s) AND
    # there is no sustained post-peak engagement, this is almost certainly
    # a grenade / smoke / ability burst with no follow-up action.
    # The original 0.75 penalty was insufficient because utility audio spikes
    # push combined scores high enough to survive a 25% cut.
    utility_reject_factor = 1.0
    if spike_width_factor < 1.0:  # narrow spike detected
        # Check if there's any sustained engagement after the burst
        engage_start = min(n, last_peak + 2)
        engage_end   = min(n, last_peak + 7)  # 5s post-burst window
        if engage_end > engage_start:
            engage_window = combined[engage_start:engage_end]
            engage_mean   = float(np.mean(engage_window))
            engage_ratio  = engage_mean / (float(peak_val) + 1e-8)
            if engage_ratio < 0.25:
                # Narrow spike + no follow-up engagement = utility-only
                utility_reject_factor = 0.45  # combined with spike_width: 0.75 * 0.45 ≈ 0.34
            elif engage_ratio < 0.40:
                # Narrow spike + weak follow-up = marginal
                utility_reject_factor = 0.65  # combined: 0.75 * 0.65 ≈ 0.49

    # ── 10. Clip tail quality — viewer sees the ending ──────────────────────
    # The clip window extends to last_peak + post_roll.  If the final 2–3 s
    # of the *actual clip* show low activity, the viewer's last impression is
    # "nothing happened" or "they died."  This is independent of the post-peak
    # checks (which measure relative to the peak), because even a clip with a
    # decent peak can *end* on a whimper if post_roll extends into dead air.
    tail_factor = 1.0
    tail_len    = min(3, post_roll)
    tail_start  = max(0, win_end - tail_len)
    if tail_start < win_end and tail_start < n:
        tail_window = combined[tail_start:min(win_end, n)]
        if len(tail_window) > 0:
            tail_mean  = float(np.mean(tail_window))
            tail_ratio = tail_mean / (float(peak_val) + 1e-8)
            if tail_ratio < 0.12:
                # Clip ends in near-silence / death screen
                tail_factor = 0.55
            elif tail_ratio < 0.20:
                # Clip ends weakly
                tail_factor = 0.75

    # ── 11. Post-peak audio-motion coherence ──────────────────────────────────
    # A real engagement has BOTH audio (gunfire, abilities, voice) AND motion
    # (player moving, camera reacting) active simultaneously after the peak.
    # Death-cam: motion only (camera pans, but audio drops to ambient).
    # Grenade aftermath: neither (explosion done, player hasn't moved).
    # Menu/respawn: possible audio (music) but no reactive motion.
    #
    # This catches the gap where `combined` stays above thresholds because
    # a single channel (ambient music or slow camera pan) inflates it,
    # even though there's no actual continued fight.
    coherence_factor = 1.0
    if audio_raw is not None and motion_raw is not None:
        coh_start = min(n, last_peak + 1)
        coh_end   = min(n, last_peak + 5)  # 4s post-peak
        if coh_end > coh_start:
            coh_audio  = audio_raw[coh_start:coh_end]
            coh_motion = motion_raw[coh_start:coh_end]
            coh_burst  = motion_burst[coh_start:coh_end] if len(motion_burst) > coh_start else np.array([])

            a_active = float(np.mean(coh_audio))  > 0.20
            m_active = float(np.mean(coh_motion)) > 0.20
            b_active = float(np.mean(coh_burst))  > 0.10 if len(coh_burst) > 0 else False

            if not a_active and not m_active:
                # Total post-peak silence — strongest penalty
                coherence_factor = 0.45
            elif not a_active and m_active and not b_active:
                # Motion but no audio, no burst = death-cam / spectate panning
                coherence_factor = 0.60
            elif a_active and not m_active:
                # Audio but no motion = menu screen with music, or respawn lobby
                coherence_factor = 0.65

    # ── 12. Audio-isolated utility detection ──────────────────────────────────
    # Factor 9 only fires when spike_width_factor < 1.0 (narrow spike).
    # But nearby peaks can inflate high_count to 4+, skipping the entire
    # utility path even for an obvious grenade/smoke burst.
    #
    # This factor uses audio_delta (rate of audio change) to detect the
    # utility-burst signature directly: a single sharp audio spike (high
    # delta at peak) followed by rapid audio drop (high delta 1-2s later,
    # then near-zero delta).  Game-agnostic: grenades, smokes, abilities,
    # and flash-bangs all share this impulse-then-silence audio shape.
    audio_utility_factor = 1.0
    if audio_delta is not None and len(audio_delta) > 0:
        peak_idx = min(last_peak, len(audio_delta) - 1)
        peak_adelta = float(audio_delta[peak_idx])
        # High audio delta at peak = sharp audio onset
        if peak_adelta > 0.50:
            # Check if audio delta drops to near-zero within 3s (impulse, not sustained)
            ad_post_start = min(len(audio_delta), last_peak + 2)
            ad_post_end   = min(len(audio_delta), last_peak + 5)
            if ad_post_end > ad_post_start:
                post_adelta = audio_delta[ad_post_start:ad_post_end]
                post_adelta_mean = float(np.mean(post_adelta))
                if post_adelta_mean < 0.10:
                    # Impulse audio → silence: classic utility signature
                    # Only penalize if there's no sustained motion engagement
                    if motion_raw is not None:
                        post_m = motion_raw[ad_post_start:ad_post_end]
                        post_m_mean = float(np.mean(post_m))
                        if post_m_mean < 0.25:
                            audio_utility_factor = 0.50
                    else:
                        audio_utility_factor = 0.55

    return (sustained
            * spike_width_factor
            * payoff_factor
            * collapse_factor
            * continuation_bonus
            * buildup_bonus
            * passivity_factor
            * cliff_factor
            * deathcam_factor
            * utility_reject_factor
            * tail_factor
            * coherence_factor
            * audio_utility_factor)


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

    Scoring model: setup → engagement → payoff → continuation arc.
    - 3-second rolling average smoothing before peak detection suppresses
      single-second noise (camera flashes, HUD blinks, brief menu overlays).
    - Baseline height threshold skips flat / idle segments.
    - Higher prominence (0.15) reduces false-positive peaks; two-tier fallback
      (retry at 0.05 before evenly-spaced) avoids over-filtering real clips.
    - _score_event_window() models the full event arc using: sustained intensity,
      spike width (catches utility-only bursts), immediate payoff, extended
      collapse/continuation (catches failed fights and rewards follow-through),
      buildup bonus, and passivity penalty (spectating/walking).
    - Diversity-aware greedy selection avoids clustered clips from one short
      burst while ignoring the rest of the video.

    Returns list of dicts: [{"start": int, "end": int, "score": int}, ...]
    """
    length = max(len(audio_scores), len(motion_scores))
    a = np.pad(audio_scores,  (0, length - len(audio_scores)))
    m = np.pad(motion_scores, (0, length - len(motion_scores)))

    # Motion burstiness: temporal std-dev of motion in a 5-second sliding window.
    # Walking / spectating = low variance (steady motion) → down-ranked.
    # Combat / action     = high variance (chaotic motion) → up-ranked.
    motion_burst = compute_motion_burstiness(m)

    # Audio delta: |RMS[t] - RMS[t-1]| per second.
    # Constant ambient music keeps a steady RMS → near-zero delta (ignored).
    # Action audio (gunfire, ability sounds, crowd surges) spikes sharply → high delta.
    audio_delta = np.abs(np.diff(a, prepend=a[:1] if len(a) > 0 else np.zeros(1)))
    ad_max = audio_delta.max()
    if ad_max > 0:
        audio_delta = (audio_delta / ad_max).astype(np.float32)

    combined = (AUDIO_WEIGHT  * a
                + MOTION_WEIGHT * m
                + BURST_WEIGHT  * motion_burst
                + ADELTA_WEIGHT * audio_delta)

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

        # Context-aware score: sustained + payoff + buildup + passivity (see _score_event_window)
        quality = _score_event_window(
            combined, group, pre_roll, post_roll, motion_burst,
            motion_raw=m, audio_raw=a, audio_delta=audio_delta,
        )
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
