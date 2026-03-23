import { useEffect, useRef, useState } from 'react';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtSec(s) {
    const m = Math.floor(s / 60);
    const sec = (s % 60).toFixed(1);
    return `${m}:${String(sec).padStart(4, '0')}`;
}

// ─── Aspect ratio options ─────────────────────────────────────────────────────

const RATIO_OPTIONS = [
    { value: 'original', label: 'Original', hint: 'Keep source ratio' },
    { value: '9:16',     label: 'Vertical 9:16', hint: 'TikTok / Reels' },
];

// ─── Trim slider (two thumbs, one <input type="range"> per thumb) ─────────────

function TrimControls({ duration, trimStart, trimEnd, onChange }) {
    const step = 0.1;

    function handleStart(e) {
        const val = parseFloat(e.target.value);
        onChange(Math.min(val, trimEnd - 0.5), trimEnd);
    }

    function handleEnd(e) {
        const val = parseFloat(e.target.value);
        onChange(trimStart, Math.max(val, trimStart + 0.5));
    }

    const startPct = ((trimStart / duration) * 100).toFixed(1);
    const endPct   = ((trimEnd   / duration) * 100).toFixed(1);

    return (
        <div>
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Trim</span>
                <span className="text-xs font-mono text-violet-300">
                    {fmtSec(trimStart)} – {fmtSec(trimEnd)}
                    <span className="text-gray-600 ml-2">({(trimEnd - trimStart).toFixed(1)}s)</span>
                </span>
            </div>

            {/* Visual range bar */}
            <div className="relative h-2 rounded-full bg-gray-800 mb-5">
                <div
                    className="absolute h-full rounded-full bg-violet-600"
                    style={{ left: `${startPct}%`, width: `${endPct - startPct}%` }}
                />
            </div>

            {/* Start thumb */}
            <div className="mb-4">
                <div className="flex justify-between text-xs text-gray-600 mb-1">
                    <span>Start</span>
                    <span className="font-mono text-gray-400">{fmtSec(trimStart)}</span>
                </div>
                <input
                    type="range"
                    min={0}
                    max={duration}
                    step={step}
                    value={trimStart}
                    onChange={handleStart}
                    className="w-full h-1.5 accent-violet-500 cursor-pointer rounded-full bg-gray-800 appearance-none"
                />
            </div>

            {/* End thumb */}
            <div>
                <div className="flex justify-between text-xs text-gray-600 mb-1">
                    <span>End</span>
                    <span className="font-mono text-gray-400">{fmtSec(trimEnd)}</span>
                </div>
                <input
                    type="range"
                    min={0}
                    max={duration}
                    step={step}
                    value={trimEnd}
                    onChange={handleEnd}
                    className="w-full h-1.5 accent-violet-500 cursor-pointer rounded-full bg-gray-800 appearance-none"
                />
            </div>

            {/* Duration callout */}
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-gray-800/60 px-3 py-2">
                <svg className="h-3.5 w-3.5 text-violet-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                <span className="text-xs text-gray-400">
                    Resulting duration:
                    <span className="ml-1 font-semibold text-white">{(trimEnd - trimStart).toFixed(1)}s</span>
                </span>
            </div>
        </div>
    );
}

// ─── Main modal ───────────────────────────────────────────────────────────────

export default function ClipRefinementModal({ clip, index, videoId, onClose, onSaved }) {
    const duration = parseFloat(clip.duration) || 10;

    const [trimStart,   setTrimStart]   = useState(0);
    const [trimEnd,     setTrimEnd]     = useState(duration);
    const [aspectRatio, setAspectRatio] = useState('original');
    const [muted,       setMuted]       = useState(false);
    const [label,       setLabel]       = useState(clip.label ?? `Highlight #${index + 1}`);
    const [saving,      setSaving]      = useState(false);
    const [error,       setError]       = useState(null);

    const videoRef = useRef(null);
    const overlayRef = useRef(null);

    // Seek video preview to trim start when it changes
    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.currentTime = trimStart;
        }
    }, [trimStart]);

    // Lock body scroll while modal is open
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, []);

    // Close on backdrop click
    function handleOverlayClick(e) {
        if (e.target === overlayRef.current) onClose();
    }

    // Close on Escape
    useEffect(() => {
        function onKey(e) { if (e.key === 'Escape') onClose(); }
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    function handleTrimChange(start, end) {
        setTrimStart(parseFloat(start.toFixed(1)));
        setTrimEnd(parseFloat(end.toFixed(1)));
    }

    async function handleSave() {
        setSaving(true);
        setError(null);

        try {
            const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content ?? '';

            const res = await fetch(`/clips/${videoId}/${clip.id}/refine`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    trim_start:   trimStart,
                    trim_end:     trimEnd,
                    aspect_ratio: aspectRatio,
                    muted:        muted,
                    label:        label.trim() || null,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.message ?? 'Re-export failed. Please try again.');
                return;
            }

            onSaved(clip.id, data.clip);
            onClose();
        } catch {
            setError('Network error. Please check your connection and try again.');
        } finally {
            setSaving(false);
        }
    }

    return (
        <div
            ref={overlayRef}
            onClick={handleOverlayClick}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
        >
            <div className="relative w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-2xl bg-gray-900 border border-white/10 shadow-2xl shadow-black/60">

                {/* ── Header ────────────────────────────────────────────────── */}
                <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-5 py-4 bg-gray-900 border-b border-white/8">
                    <div>
                        <p className="text-xs font-semibold text-violet-400 uppercase tracking-widest">Refine clip</p>
                        <h2 className="text-sm font-bold text-white mt-0.5 truncate max-w-xs">
                            {label || `Highlight #${index + 1}`}
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="shrink-0 h-8 w-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-gray-800 transition-colors"
                    >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-5 space-y-6">

                    {/* ── Video preview ─────────────────────────────────────── */}
                    <div className="rounded-xl overflow-hidden bg-black aspect-video border border-white/5">
                        <video
                            ref={videoRef}
                            src={clip.refined_url ?? clip.url}
                            poster={clip.thumbnail_url ?? undefined}
                            controls
                            preload="metadata"
                            className="w-full h-full object-contain"
                        />
                    </div>

                    {/* ── Trim controls ─────────────────────────────────────── */}
                    <section className="rounded-xl bg-gray-800/40 border border-white/5 p-4">
                        <TrimControls
                            duration={duration}
                            trimStart={trimStart}
                            trimEnd={trimEnd}
                            onChange={handleTrimChange}
                        />
                    </section>

                    {/* ── Label ─────────────────────────────────────────────── */}
                    <section>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">
                            Clip name
                        </label>
                        <input
                            type="text"
                            value={label}
                            onChange={e => setLabel(e.target.value)}
                            maxLength={120}
                            placeholder={`Highlight #${index + 1}`}
                            className="w-full rounded-lg bg-gray-800 border border-white/8 text-sm text-white placeholder-gray-600 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition"
                        />
                    </section>

                    {/* ── Aspect ratio ──────────────────────────────────────── */}
                    <section>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">
                            Aspect ratio
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            {RATIO_OPTIONS.map(opt => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => setAspectRatio(opt.value)}
                                    className={[
                                        'rounded-xl border px-4 py-3 text-left transition-all duration-150',
                                        aspectRatio === opt.value
                                            ? 'bg-violet-600/15 border-violet-500/50 text-white'
                                            : 'bg-gray-800/50 border-white/8 text-gray-400 hover:border-white/20 hover:text-gray-200',
                                    ].join(' ')}
                                >
                                    <div className="flex items-center gap-2 mb-1">
                                        {aspectRatio === opt.value && (
                                            <span className="h-1.5 w-1.5 rounded-full bg-violet-400 shrink-0" />
                                        )}
                                        <span className="text-sm font-semibold">{opt.label}</span>
                                    </div>
                                    <span className="text-xs text-gray-600">{opt.hint}</span>
                                </button>
                            ))}
                        </div>
                    </section>

                    {/* ── Mute toggle ───────────────────────────────────────── */}
                    <section>
                        <button
                            type="button"
                            onClick={() => setMuted(m => !m)}
                            className={[
                                'w-full flex items-center justify-between rounded-xl border px-4 py-3 transition-all duration-150',
                                muted
                                    ? 'bg-amber-500/10 border-amber-500/30 text-white'
                                    : 'bg-gray-800/40 border-white/8 text-gray-400 hover:border-white/20',
                            ].join(' ')}
                        >
                            <div className="flex items-center gap-3">
                                {muted ? (
                                    <svg className="h-4 w-4 text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75 19.5 12m0 0 2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6 4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
                                    </svg>
                                ) : (
                                    <svg className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
                                    </svg>
                                )}
                                <div>
                                    <p className="text-sm font-semibold">{muted ? 'Audio muted' : 'Audio on'}</p>
                                    <p className="text-xs text-gray-600">{muted ? 'Export will have no audio track' : 'Click to mute the export'}</p>
                                </div>
                            </div>
                            {/* Pill toggle indicator */}
                            <div className={[
                                'h-5 w-9 rounded-full border transition-colors duration-200 relative shrink-0',
                                muted ? 'bg-amber-500/30 border-amber-500/50' : 'bg-gray-700 border-gray-600',
                            ].join(' ')}>
                                <span className={[
                                    'absolute top-0.5 h-4 w-4 rounded-full transition-all duration-200',
                                    muted ? 'left-4 bg-amber-400' : 'left-0.5 bg-gray-500',
                                ].join(' ')} />
                            </div>
                        </button>
                    </section>

                    {/* ── Error ─────────────────────────────────────────────── */}
                    {error && (
                        <div className="flex items-start gap-2.5 rounded-xl bg-red-500/8 border border-red-500/20 px-4 py-3">
                            <svg className="mt-0.5 h-4 w-4 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                            </svg>
                            <p className="text-sm text-red-400">{error}</p>
                        </div>
                    )}

                    {/* ── FFmpeg info note ──────────────────────────────────── */}
                    <div className="flex items-start gap-2 rounded-xl bg-gray-800/30 border border-white/5 px-4 py-3">
                        <svg className="mt-0.5 h-3.5 w-3.5 text-gray-600 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
                        </svg>
                        <p className="text-xs text-gray-600 leading-relaxed">
                            The original clip is preserved. Re-export creates a new file — this may take a few seconds.
                        </p>
                    </div>
                </div>

                {/* ── Footer actions ────────────────────────────────────────── */}
                <div className="sticky bottom-0 flex items-center justify-end gap-3 px-5 py-4 bg-gray-900 border-t border-white/8">
                    <button
                        onClick={onClose}
                        disabled={saving}
                        className="rounded-lg bg-gray-800 hover:bg-gray-700 border border-white/8 text-gray-300 text-sm font-medium px-5 py-2.5 transition-colors disabled:opacity-40"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-5 py-2.5 transition-all duration-200 shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:-translate-y-px disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0"
                    >
                        {saving ? (
                            <>
                                <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                                Exporting…
                            </>
                        ) : (
                            <>
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                                </svg>
                                Save &amp; Re-export
                            </>
                        )}
                    </button>
                </div>

            </div>
        </div>
    );
}
