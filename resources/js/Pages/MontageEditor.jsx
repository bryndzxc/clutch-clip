import { Head, router } from '@inertiajs/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DashboardHeader from '../Components/Dashboard/DashboardHeader';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtSec(s) {
    if (!s && s !== 0) return '—';
    const m   = Math.floor(s / 60);
    const sec = (s % 60).toFixed(1);
    return `${m}:${String(sec).padStart(4, '0')}`;
}

function fmtDur(s) {
    if (!s && s !== 0) return '—';
    const m   = Math.floor(s / 60);
    const sec = Math.round(s % 60);
    return `${m}:${String(sec).padStart(2, '0')}`;
}

function getCsrf() {
    return document.querySelector('meta[name="csrf-token"]')?.content ?? '';
}

async function apiFetch(url, options = {}) {
    const res = await fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'Accept':       'application/json',
            'X-CSRF-TOKEN': getCsrf(),
            ...(options.headers ?? {}),
        },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message ?? `Request failed (${res.status})`);
    return data;
}

function defaultClipSettings(clip) {
    return {
        trim_start:   0,
        trim_end:     parseFloat(clip.duration),
        muted:        false,
        volume:       1.0,
        fade_in:      0,
        fade_out:     0,
        speed:        1.0,
        brightness:   0,
        contrast:     0,
        saturation:   0,
        text_overlay: { enabled: false, text: '', size: 'md', position: 'bottom', color: 'white', animation: 'none', bgBox: true },
        transition:   { type: 'cut', duration: 0.5 },
    };
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function ExportBadge({ status }) {
    if (!status || status === 'pending') return null;
    const map = {
        rendering: { cls: 'bg-violet-500/15 text-violet-300 border-violet-500/20', label: 'Rendering' },
        completed: { cls: 'bg-green-500/15  text-green-300  border-green-500/20',  label: 'Ready' },
        failed:    { cls: 'bg-red-500/15    text-red-300    border-red-500/20',    label: 'Failed' },
    };
    const c = map[status] ?? map.rendering;
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${c.cls}`}>
            {status === 'rendering' && (
                <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
            )}
            {c.label}
        </span>
    );
}

// ─── Clip thumbnail ───────────────────────────────────────────────────────────

function ClipThumb({ clip, size = 'md' }) {
    const sizeMap = { sm: 'h-14 w-24', md: 'h-20 w-32', lg: 'h-24 w-40' };
    return (
        <div className={`${sizeMap[size]} rounded-lg overflow-hidden bg-gray-800 border border-white/8 shrink-0 relative`}>
            {clip.thumbnail_url ? (
                <img
                    src={clip.thumbnail_url}
                    alt=""
                    className="w-full h-full object-cover"
                    onError={e => { e.currentTarget.style.display = 'none'; }}
                />
            ) : null}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-700" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
                </svg>
            </div>
        </div>
    );
}

// ─── Card preview overlay ─────────────────────────────────────────────────────

function CardPreviewOverlay({ card, type }) {
    const bgMap = {
        'clean-fade':       'bg-gray-900',
        'neon-slide':       'bg-gradient-to-br from-violet-900 to-gray-950',
        'pulse-zoom':       'bg-gradient-to-br from-blue-900 to-gray-950',
        'gaming-flash':     'bg-gradient-to-br from-green-900 to-gray-950',
        'cinematic-reveal': 'bg-gradient-to-br from-yellow-950 to-gray-950',
    };
    const bg = bgMap[card?.bg_style ?? 'clean-fade'] ?? 'bg-gray-900';
    return (
        <div className={`absolute inset-0 flex flex-col items-center justify-center gap-2 ${bg}`}>
            <div className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-1">
                {type === 'intro' ? '▶ Intro Card' : '◀ Outro Card'}
            </div>
            {card?.text && (
                <p className="text-2xl font-bold text-white text-center px-8 leading-snug">{card.text}</p>
            )}
            {card?.subtitle && (
                <p className="text-sm text-white/50 text-center px-8 mt-1">{card.subtitle}</p>
            )}
            <div className="mt-3 flex items-center gap-1 text-white/20">
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                <span className="text-[10px]">{card?.duration ?? 3}s</span>
            </div>
        </div>
    );
}

// ─── Main Preview (center column, large player) ───────────────────────────────

function MainPreview({ orderedClips, selectedClip, clipSettings, previewMode, onModeChange, onClipSelect, titleCard, outroCard }) {
    const videoRef     = useRef(null);
    const autoPlayRef  = useRef(false);
    const cardTimerRef = useRef(null);
    const [playing,  setPlaying]  = useState(false);
    const [curTime,  setCurTime]  = useState(0);
    const [seqIndex, setSeqIndex] = useState(0);

    // Build sequence items: [intro?, ...clips, outro?]
    const seqItems = useMemo(() => {
        const items = [];
        if (titleCard?.enabled)  items.push({ type: 'intro', card: titleCard });
        orderedClips.forEach(clip => items.push({ type: 'clip', clip }));
        if (outroCard?.enabled)  items.push({ type: 'outro', card: outroCard });
        return items;
    }, [titleCard, orderedClips, outroCard]);

    const activeItem = previewMode === 'sequence'
        ? (seqItems[seqIndex] ?? null)
        : (selectedClip ? { type: 'clip', clip: selectedClip } : null);

    const activeClip = activeItem?.type === 'clip' ? activeItem.clip : null;
    const activeCard = (activeItem?.type === 'intro' || activeItem?.type === 'outro') ? activeItem : null;

    const settings   = activeClip ? (clipSettings[activeClip.id] ?? {}) : {};
    const trimStart  = settings.trim_start  ?? 0;
    const trimEnd    = settings.trim_end    ?? parseFloat(activeClip?.duration ?? 0);
    const brightness = settings.brightness  ?? 0;
    const contrast   = settings.contrast   ?? 0;
    const saturation = settings.saturation  ?? 0;
    const muted      = settings.muted       ?? false;
    const volume     = settings.volume      ?? 1.0;
    const textOv     = settings.text_overlay ?? {};
    const speed      = settings.speed       ?? 1.0;
    const duration   = parseFloat(activeClip?.duration ?? 0) || 1;
    const src        = activeClip ? (activeClip.refined_url || activeClip.url) : null;

    // Track whether current item is a card (updated synchronously during render)
    const onCardRef = useRef(false);
    onCardRef.current = (previewMode === 'sequence' && activeCard !== null);

    // CSS filter: maps -1..1 range → 0..2 for CSS brightness/contrast/saturate
    const cssFilter = useMemo(() => {
        const parts = [];
        if (brightness !== 0) parts.push(`brightness(${(1 + brightness).toFixed(2)})`);
        if (contrast   !== 0) parts.push(`contrast(${(1 + contrast).toFixed(2)})`);
        if (saturation !== 0) parts.push(`saturate(${(1 + saturation).toFixed(2)})`);
        return parts.length ? parts.join(' ') : undefined;
    }, [brightness, contrast, saturation]);

    // Load new src imperatively — avoids key-remount race condition with autoPlayRef
    useEffect(() => {
        const v = videoRef.current;
        if (!v) return;
        if (src) {
            v.src = src;
            v.load();
        } else {
            v.removeAttribute('src');
            v.load();
            if (!onCardRef.current) setPlaying(false);
            setCurTime(0);
        }
    }, [src]); // eslint-disable-line react-hooks/exhaustive-deps

    // Reset on mode change (user action — always cancel autoplay intent)
    useEffect(() => {
        autoPlayRef.current = false;
        if (cardTimerRef.current) { clearTimeout(cardTimerRef.current); cardTimerRef.current = null; }
        const v = videoRef.current;
        if (v) v.pause();
        setPlaying(false);
        setCurTime(0);
    }, [previewMode]);

    // Card timer: advance sequence after card duration elapses
    useEffect(() => {
        if (cardTimerRef.current) { clearTimeout(cardTimerRef.current); cardTimerRef.current = null; }
        if (!playing || !activeCard || previewMode !== 'sequence') return;
        const dur      = (activeCard.card?.duration ?? 3) * 1000;
        const totalLen = seqItems.length;
        const curIdx   = seqIndex;
        cardTimerRef.current = setTimeout(() => {
            if (curIdx < totalLen - 1) {
                autoPlayRef.current = true;
                setSeqIndex(i => i + 1);
            } else {
                setPlaying(false);
                setSeqIndex(0);
            }
        }, dur);
        return () => { if (cardTimerRef.current) { clearTimeout(cardTimerRef.current); cardTimerRef.current = null; } };
    }, [activeCard, playing, previewMode, seqIndex, seqItems.length]); // eslint-disable-line react-hooks/exhaustive-deps

    // Auto-play when arriving at a card item via sequence advancement
    useEffect(() => {
        if (!autoPlayRef.current || !activeCard || previewMode !== 'sequence') return;
        autoPlayRef.current = false;
        setPlaying(true);
    }, [activeCard, previewMode, seqIndex]); // eslint-disable-line react-hooks/exhaustive-deps

    // Sync volume/muted live
    useEffect(() => {
        const v = videoRef.current;
        if (!v) return;
        v.muted  = muted;
        v.volume = muted ? 0 : volume;
    }, [muted, volume]);

    // Sync playback rate live
    useEffect(() => {
        const v = videoRef.current;
        if (!v) return;
        v.playbackRate = speed;
    }, [speed]);

    function handleLoaded() {
        const v = videoRef.current;
        if (!v) return;
        v.currentTime  = trimStart;
        v.muted        = muted;
        v.volume       = muted ? 0 : volume;
        v.playbackRate = speed;
        setCurTime(trimStart);
        if (autoPlayRef.current) {
            autoPlayRef.current = false;
            v.play().catch(() => {});
            setPlaying(true);
        }
    }

    function togglePlay() {
        if (activeCard && previewMode === 'sequence') {
            setPlaying(p => !p);
            return;
        }
        const v = videoRef.current;
        if (!v || !src) return;
        if (playing) {
            v.pause();
            setPlaying(false);
        } else {
            if (v.currentTime >= trimEnd - 0.05) v.currentTime = trimStart;
            v.play().catch(() => {});
            setPlaying(true);
        }
    }

    function handleTimeUpdate() {
        const v = videoRef.current;
        if (!v) return;
        setCurTime(v.currentTime);
        if (v.currentTime >= trimEnd) {
            if (previewMode === 'sequence' && seqIndex < seqItems.length - 1) {
                autoPlayRef.current = true;
                setSeqIndex(i => i + 1);
            } else {
                v.pause();
                v.currentTime = trimStart;
                setCurTime(trimStart);
                setPlaying(false);
                if (previewMode === 'sequence') setSeqIndex(0);
            }
        }
    }

    function handleScrubberSeek(e) {
        const v = videoRef.current;
        if (!v || !src) return;
        const rect  = e.currentTarget.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const t     = trimStart + ratio * (trimEnd - trimStart);
        v.currentTime = t;
        setCurTime(t);
    }

    function handleTimelineClick(idx, clipId) {
        if (previewMode === 'sequence') setSeqIndex(idx);
        if (clipId) onClipSelect(clipId);
    }

    const trimRange    = Math.max(trimEnd - trimStart, 0.01);
    const progress     = Math.max(0, Math.min(1, (curTime - trimStart) / trimRange));
    const trimStartPct = (trimStart / duration) * 100;
    const trimWidthPct = ((trimEnd - trimStart) / duration) * 100;
    const playheadPct  = trimStartPct + trimWidthPct * progress;
    const hasFx        = brightness !== 0 || contrast !== 0 || saturation !== 0;

    const textSizeMap  = { sm: 'text-sm', md: 'text-xl', lg: 'text-3xl', xl: 'text-5xl' };
    const textPosMap   = { top: 'top-3', center: 'top-1/2 -translate-y-1/2', bottom: 'bottom-3' };
    const textColorMap = { white: 'text-white', yellow: 'text-yellow-400', purple: 'text-violet-400', cyan: 'text-cyan-400' };

    // Timeline items: includes card slots for intro/outro
    const timelineItems = useMemo(() => {
        const items = [];
        if (titleCard?.enabled) items.push({ type: 'intro', card: titleCard, clip: null, duration: titleCard.duration ?? 3 });
        orderedClips.forEach(clip => {
            const s   = clipSettings[clip.id] ?? {};
            const spd = s.speed ?? 1;
            const dur = ((s.trim_end ?? parseFloat(clip.duration)) - (s.trim_start ?? 0)) / spd;
            items.push({ type: 'clip', card: null, clip, duration: Math.max(dur, 0.2) });
        });
        if (outroCard?.enabled) items.push({ type: 'outro', card: outroCard, clip: null, duration: outroCard.duration ?? 3 });
        const total = items.reduce((sum, it) => sum + it.duration, 0) || 1;
        return items.map(it => ({ ...it, pct: (it.duration / total) * 100 }));
    }, [titleCard, orderedClips, clipSettings, outroCard]);

    const showPlaceholder = previewMode === 'clip' ? !selectedClip : seqItems.length === 0;

    return (
        <div className="flex-shrink-0 bg-gray-950 border-b border-white/5">
            {/* Mode toggle + clip label */}
            <div className="flex items-center justify-between px-4 pt-2 pb-2">
                <div className="flex items-center gap-0.5 bg-gray-800/70 rounded-lg p-0.5 border border-white/5">
                    <button
                        onClick={() => onModeChange('clip')}
                        className={[
                            'px-3 py-1 rounded-md text-xs font-semibold transition-all',
                            previewMode === 'clip' ? 'bg-gray-700 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300',
                        ].join(' ')}
                    >
                        Clip Preview
                    </button>
                    <button
                        onClick={() => { onModeChange('sequence'); setSeqIndex(0); }}
                        disabled={orderedClips.length === 0}
                        className={[
                            'px-3 py-1 rounded-md text-xs font-semibold transition-all disabled:opacity-30',
                            previewMode === 'sequence' ? 'bg-gray-700 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300',
                        ].join(' ')}
                    >
                        Full Sequence
                    </button>
                </div>
                <div className="flex items-center gap-2 min-w-0">
                    {previewMode === 'sequence' && activeCard ? (
                        <p className="text-[11px] text-gray-500">
                            <span className="text-gray-600 mr-0.5">{seqIndex + 1}/{seqItems.length} ·</span>
                            {activeCard.type === 'intro' ? 'Intro Card' : 'Outro Card'}
                        </p>
                    ) : activeClip ? (
                        <p className="text-[11px] text-gray-500 truncate max-w-[180px]">
                            {previewMode === 'sequence' && (
                                <span className="text-gray-600 mr-0.5">{seqIndex + 1}/{seqItems.length} ·</span>
                            )}
                            {activeClip.label || 'Clip'}
                        </p>
                    ) : null}
                    {hasFx && (
                        <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded shrink-0">
                            FX
                        </span>
                    )}
                </div>
            </div>

            {/* Video area */}
            <div
                className="relative mx-4 rounded-xl overflow-hidden bg-black cursor-pointer group"
                style={{ aspectRatio: '16/9' }}
                onClick={togglePlay}
            >
                <video
                    ref={videoRef}
                    className="w-full h-full object-contain"
                    style={cssFilter ? { filter: cssFilter } : undefined}
                    onTimeUpdate={handleTimeUpdate}
                    onLoadedMetadata={handleLoaded}
                    preload="auto"
                    playsInline
                />

                {/* Card overlay for intro/outro */}
                {activeCard && (
                    <CardPreviewOverlay card={activeCard.card} type={activeCard.type} />
                )}

                {showPlaceholder && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center px-4">
                        <svg className="h-8 w-8 text-gray-700" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
                        </svg>
                        <p className="text-xs text-gray-600">
                            {previewMode === 'clip' ? 'Select a clip to preview' : 'Add clips to preview sequence'}
                        </p>
                    </div>
                )}

                {/* Live text overlay */}
                {src && textOv.enabled && textOv.text && (() => {
                    const useBox = textOv.bgBox ?? true;
                    return (
                        <div className={`absolute inset-x-0 flex justify-center px-4 pointer-events-none ${textPosMap[textOv.position ?? 'bottom'] ?? 'bottom-3'}`}>
                            <span className={[
                                'font-bold drop-shadow-lg select-none',
                                useBox ? 'px-3 py-1 rounded bg-black/60' : 'drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]',
                                textSizeMap[textOv.size ?? 'md'] ?? 'text-xl',
                                textColorMap[textOv.color ?? 'white'] ?? 'text-white',
                            ].join(' ')}>
                                {textOv.text}
                            </span>
                        </div>
                    );
                })()}

                {/* Play / pause overlay */}
                {(src || activeCard) && (
                    <div className={`absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-150 ${playing ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'}`}>
                        <div className="h-12 w-12 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center ring-1 ring-white/20">
                            {playing ? (
                                <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                                    <rect x="6" y="4" width="4" height="16" rx="1" />
                                    <rect x="14" y="4" width="4" height="16" rx="1" />
                                </svg>
                            ) : (
                                <svg className="h-5 w-5 text-white ml-0.5" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M8 5.14v14l11-7-11-7z" />
                                </svg>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Scrubber */}
            <div className="px-4 pt-2 pb-1.5">
                <div className="flex items-center justify-between text-[10px] font-mono text-gray-600 mb-1">
                    <span>{fmtSec(trimStart)}</span>
                    <span className="text-violet-400">{fmtSec(curTime)}</span>
                    <span>{fmtSec(trimEnd)}</span>
                </div>
                <div
                    className="relative h-1.5 rounded-full bg-gray-800 cursor-pointer select-none"
                    onClick={handleScrubberSeek}
                >
                    <div className="absolute top-0 h-full rounded-full bg-violet-800/50"
                        style={{ left: `${trimStartPct}%`, width: `${trimWidthPct}%` }} />
                    <div className="absolute top-0 h-full rounded-full bg-violet-500"
                        style={{ left: `${trimStartPct}%`, width: `${progress * trimWidthPct}%` }} />
                    <div className="absolute top-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-white -translate-x-1/2 border border-violet-400 shadow pointer-events-none"
                        style={{ left: `${playheadPct}%` }} />
                </div>
            </div>

            {/* Sequence timeline strip */}
            {timelineItems.length > 0 && (
                <div className="px-4 pb-2.5">
                    <div className="flex items-stretch gap-0.5 h-7 rounded-lg overflow-hidden">
                        {timelineItems.map(({ type, clip, pct }, i) => {
                            const isActive = previewMode === 'sequence'
                                ? seqIndex === i
                                : (type === 'clip' && clip?.id === selectedClip?.id);
                            const seqProg  = (isActive && previewMode === 'sequence' && type === 'clip') ? progress : 0;
                            return (
                                <div
                                    key={type === 'clip' ? clip.id : type}
                                    title={type === 'clip' ? (clip.label || 'Clip') : (type === 'intro' ? 'Intro' : 'Outro')}
                                    onClick={() => handleTimelineClick(i, type === 'clip' ? clip.id : null)}
                                    style={{ width: `${pct}%`, minWidth: '4px' }}
                                    className={[
                                        'relative overflow-hidden cursor-pointer transition-all duration-100 rounded-sm',
                                        isActive ? 'ring-1 ring-inset ring-violet-400' : 'opacity-60 hover:opacity-90',
                                    ].join(' ')}
                                >
                                    {type === 'clip' ? (
                                        <>
                                            {clip.thumbnail_url ? (
                                                <img
                                                    src={clip.thumbnail_url}
                                                    className="absolute inset-0 w-full h-full object-cover"
                                                    alt=""
                                                    onError={e => { e.currentTarget.style.display = 'none'; }}
                                                />
                                            ) : null}
                                            <div className={`absolute inset-0 ${clip.thumbnail_url ? 'bg-gray-800/40' : 'bg-gray-700'}`} />
                                            {!isActive && <div className="absolute inset-0 bg-black/40" />}
                                            {seqProg > 0 && (
                                                <div className="absolute inset-0 bg-violet-500/30 origin-left"
                                                    style={{ transform: `scaleX(${seqProg})` }} />
                                            )}
                                            <div className="absolute bottom-0 left-0 text-[7px] font-bold text-white/60 px-0.5 pb-px leading-none">
                                                {orderedClips.findIndex(c => c.id === clip.id) + 1}
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className={`absolute inset-0 ${type === 'intro' ? 'bg-violet-900/60' : 'bg-blue-900/60'}`} />
                                            {!isActive && <div className="absolute inset-0 bg-black/40" />}
                                            <div className="absolute inset-0 flex items-center justify-center text-[7px] font-bold text-white/70">
                                                {type === 'intro' ? 'IN' : 'OUT'}
                                            </div>
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                    <p className="mt-1 text-[10px] text-gray-700">
                        {orderedClips.length} clip{orderedClips.length !== 1 ? 's' : ''}
                        {previewMode === 'sequence' && playing && <span className="ml-1.5 text-violet-500">▶ playing</span>}
                    </p>
                </div>
            )}
        </div>
    );
}

// ─── Shared UI primitives ─────────────────────────────────────────────────────

function PillToggle({ on, accent = 'violet' }) {
    const colors = {
        violet: { track: 'bg-violet-500/30 border-violet-500/50', dot: 'bg-violet-400' },
        amber:  { track: 'bg-amber-500/30  border-amber-500/50',  dot: 'bg-amber-400'  },
    };
    const c = colors[accent] ?? colors.violet;
    return (
        <div className={`h-5 w-9 rounded-full border relative shrink-0 transition-colors ${on ? `${c.track}` : 'bg-gray-700 border-gray-600'}`}>
            <span className={`absolute top-0.5 h-4 w-4 rounded-full transition-all ${on ? `left-4 ${c.dot}` : 'left-0.5 bg-gray-500'}`} />
        </div>
    );
}

function SliderRow({ label, value, min, max, step, onChange, display }) {
    return (
        <div>
            <div className="flex justify-between text-xs text-gray-600 mb-1">
                <span>{label}</span>
                <span className="font-mono text-gray-400">{display ? display(value) : value}</span>
            </div>
            <input
                type="range" min={min} max={max} step={step}
                value={value}
                onChange={e => onChange(parseFloat(e.target.value))}
                className="w-full h-1.5 accent-violet-500 cursor-pointer rounded-full bg-gray-800 appearance-none"
            />
        </div>
    );
}

function ButtonGroup({ options, value, onChange }) {
    return (
        <div className="flex gap-1.5">
            {options.map(([val, label]) => (
                <button
                    key={val}
                    onClick={() => onChange(val)}
                    className={[
                        'flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-150',
                        value === val
                            ? 'bg-violet-600/20 border-violet-500/50 text-violet-300'
                            : 'bg-gray-800/50 border-white/8 text-gray-500 hover:border-white/20 hover:text-gray-300',
                    ].join(' ')}
                >
                    {label}
                </button>
            ))}
        </div>
    );
}

function SectionDivider() {
    return <div className="h-px bg-white/5" />;
}

// ─── Visual preset map ────────────────────────────────────────────────────────

const VISUAL_PRESETS = [
    { id: 'default',   label: 'Default',   b: 0,     c: 0,    s: 0     },
    { id: 'vibrant',   label: 'Vibrant',   b: 0.05,  c: 0.10, s: 0.50  },
    { id: 'dark',      label: 'Dark',      b: -0.15, c: 0.20, s: -0.10 },
    { id: 'gaming',    label: 'Gaming',    b: 0.10,  c: 0.30, s: 0.60  },
    { id: 'cinematic', label: 'Film',      b: -0.05, c: 0.25, s: -0.30 },
];

// ─── Card style options ───────────────────────────────────────────────────────

const CARD_BG_STYLES = [
    ['clean-fade',       'Clean',  'bg-gray-400'],
    ['neon-slide',       'Neon',   'bg-violet-500'],
    ['pulse-zoom',       'Pulse',  'bg-blue-500'],
    ['gaming-flash',     'Gaming', 'bg-green-400'],
    ['cinematic-reveal', 'Film',   'bg-yellow-600'],
];

const CARD_ANIMATIONS = [
    ['fade',   'Fade'],
    ['slide',  'Slide'],
    ['zoom',   'Zoom'],
    ['flash',  'Flash'],
    ['reveal', 'Reveal'],
];

// ─── Built-in music library ───────────────────────────────────────────────────

const BUILT_IN_TRACKS = [
    { id: null,            name: 'None',          vibe: 'No background music', duration: null   },
    { id: 'energy-pulse',  name: 'Energy Pulse',  vibe: 'Hype / Gaming',       duration: '2:34' },
    { id: 'neon-nights',   name: 'Neon Nights',   vibe: 'Cinematic',           duration: '3:12' },
    { id: 'clutch-moment', name: 'Clutch Moment', vibe: 'Intense',             duration: '1:58' },
    { id: 'smooth-grind',  name: 'Smooth Grind',  vibe: 'Chill',               duration: '2:47' },
    { id: 'flash-zone',    name: 'Flash Zone',    vibe: 'Fast / Action',       duration: '2:05' },
];

// ─── Text style presets ───────────────────────────────────────────────────────

const TEXT_STYLE_PRESETS = [
    { id: 'minimal',     label: 'Minimal', size: 'sm', color: 'white',  animation: 'none',     bgBox: false },
    { id: 'bold-gaming', label: 'Bold',    size: 'lg', color: 'yellow', animation: 'none',     bgBox: true  },
    { id: 'neon',        label: 'Neon',    size: 'md', color: 'cyan',   animation: 'fade-in',  bgBox: true  },
    { id: 'cinematic',   label: 'Film',    size: 'xl', color: 'white',  animation: 'slide-up', bgBox: false },
];

// ─── Export intent presets ────────────────────────────────────────────────────

const EXPORT_PRESETS = [
    { id: 'original', label: 'Original', note: 'Keep source ratio',       aspect: 'original', quality: 'high' },
    { id: 'shorts',   label: 'Shorts',   note: 'TikTok · Reels · Shorts', aspect: '9:16',     quality: 'high' },
    { id: 'youtube',  label: 'YouTube',  note: 'Landscape 16:9',          aspect: '16:9',     quality: 'high' },
];

// ─── Left panel: Available clips ──────────────────────────────────────────────

function ClipPicker({ clips, selectedIds, onAdd }) {
    return (
        <aside className="flex flex-col h-full overflow-hidden">
            <div className="px-4 pt-4 pb-3 border-b border-white/5 shrink-0">
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
                    Source clips
                </h2>
                <p className="mt-0.5 text-xs text-gray-700">
                    {clips.length} clip{clips.length !== 1 ? 's' : ''} · click to add
                </p>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {clips.map((clip, i) => {
                    const added = selectedIds.has(clip.id);
                    return (
                        <button
                            key={clip.id}
                            onClick={() => !added && onAdd(clip)}
                            disabled={added}
                            className={[
                                'w-full flex items-center gap-3 rounded-xl border p-2.5 text-left transition-all duration-150',
                                added
                                    ? 'bg-violet-600/10 border-violet-500/30 cursor-default opacity-60'
                                    : 'bg-gray-800/50 border-white/8 hover:border-violet-500/40 hover:bg-gray-800 cursor-pointer',
                            ].join(' ')}
                        >
                            <ClipThumb clip={clip} size="sm" />
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-white truncate">
                                    {clip.label || `Clip #${i + 1}`}
                                </p>
                                <p className="mt-0.5 text-[11px] text-gray-600">
                                    {fmtDur(clip.duration)}
                                    {clip.score && <span className="ml-1.5 text-violet-500/70">⚡ {clip.score}</span>}
                                </p>
                                {clip.refined_url && (
                                    <span className="mt-1 inline-block text-[10px] font-semibold text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded">
                                        Refined
                                    </span>
                                )}
                            </div>
                            {added ? (
                                <svg className="h-4 w-4 text-violet-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                                </svg>
                            ) : (
                                <svg className="h-4 w-4 text-gray-700 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                </svg>
                            )}
                        </button>
                    );
                })}
            </div>
        </aside>
    );
}

// ─── Storyboard card ──────────────────────────────────────────────────────────

function StoryboardCard({ clip, index, isSelected, settings, onSelect, onRemove, onDragStart, onDragOver, onDrop, isDragOver }) {
    const trimStart  = settings?.trim_start ?? 0;
    const trimEnd    = settings?.trim_end   ?? clip.duration;
    const muted      = settings?.muted      ?? false;
    const speed      = settings?.speed      ?? 1.0;
    const textOv     = settings?.text_overlay;
    const hasText    = textOv?.enabled && textOv?.text?.trim();
    const hasEffects = (settings?.brightness ?? 0) !== 0 ||
                       (settings?.contrast   ?? 0) !== 0 ||
                       (settings?.saturation ?? 0) !== 0;
    const renderedDur = ((trimEnd - trimStart) / speed).toFixed(1);

    return (
        <div
            draggable
            onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; onDragStart(index); }}
            onDragOver={e => { e.preventDefault(); onDragOver(index); }}
            onDrop={e => { e.preventDefault(); onDrop(index); }}
            onClick={() => onSelect(clip.id)}
            className={[
                'flex items-center gap-3 rounded-xl border p-3 cursor-pointer select-none transition-all duration-150',
                isSelected
                    ? 'bg-violet-600/15 border-violet-500/60 ring-2 ring-violet-500/30 shadow-lg shadow-violet-500/15'
                    : 'bg-gray-800/50 border-white/8 hover:border-white/20',
                isDragOver ? 'border-violet-400 ring-1 ring-violet-400/30' : '',
            ].join(' ')}
        >
            {/* Drag handle */}
            <div className="shrink-0 text-gray-700 cursor-grab active:cursor-grabbing">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9h16.5m-16.5 6.75h16.5" />
                </svg>
            </div>

            {/* Order badge */}
            <span className="shrink-0 h-5 w-5 rounded-full bg-gray-700 flex items-center justify-center text-[10px] font-bold text-gray-300">
                {index + 1}
            </span>

            <ClipThumb clip={clip} size="sm" />

            <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white truncate">
                    {clip.label || `Clip #${index + 1}`}
                </p>
                <p className="mt-0.5 text-[11px] text-gray-600">
                    {fmtSec(trimStart)} – {fmtSec(trimEnd)}
                    <span className="ml-1.5 text-gray-700">({renderedDur}s)</span>
                </p>
                {/* Status icon badges */}
                <div className="mt-1.5 flex items-center gap-1 flex-wrap">
                    {muted && (
                        <span title="Muted" className="h-4 w-4 flex items-center justify-center rounded bg-amber-500/15 text-amber-400">
                            <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75 19.5 12m0 0 2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6 4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
                            </svg>
                        </span>
                    )}
                    {speed !== 1.0 && (
                        <span title={`${speed}× speed`} className="h-4 px-1 flex items-center justify-center rounded bg-cyan-500/15 text-cyan-400 text-[9px] font-bold">
                            {speed}×
                        </span>
                    )}
                    {hasText && (
                        <span title="Text overlay" className="h-4 w-4 flex items-center justify-center rounded bg-violet-500/15 text-violet-400">
                            <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
                            </svg>
                        </span>
                    )}
                    {hasEffects && (
                        <span title="Visual effects" className="h-4 w-4 flex items-center justify-center rounded bg-emerald-500/15 text-emerald-400">
                            <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
                            </svg>
                        </span>
                    )}
                    {(settings?.fade_in > 0 || settings?.fade_out > 0) && (
                        <span title="Audio fade" className="h-4 w-4 flex items-center justify-center rounded bg-sky-500/15 text-sky-400">
                            <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
                            </svg>
                        </span>
                    )}
                    {clip.refined_url && (
                        <span className="text-[9px] font-semibold text-violet-400 bg-violet-500/10 px-1 py-0.5 rounded">
                            AI
                        </span>
                    )}
                </div>
            </div>

            {/* Remove */}
            <button
                onClick={e => { e.stopPropagation(); onRemove(clip.id); }}
                className="shrink-0 h-6 w-6 flex items-center justify-center rounded-md text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                title="Remove from storyboard"
            >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
            </button>
        </div>
    );
}

// ─── Transition divider ───────────────────────────────────────────────────────

function TransitionDivider({ transition }) {
    const type = transition?.type     ?? 'cut';
    const dur  = transition?.duration ?? 0.5;
    const labelMap = { cut: 'Cut', fade: `Fade · ${dur}s`, crossfade: `Crossfade · ${dur}s`, 'smooth-fade': `Smooth · ${dur}s` };
    const label = labelMap[type] ?? 'Cut';
    const isAnimated = type !== 'cut';
    return (
        <div className="flex items-center gap-2 px-1 py-1">
            <div className="h-px flex-1 bg-white/5" />
            <span className={`text-[10px] font-medium ${isAnimated ? 'text-violet-500' : 'text-gray-700'}`}>
                {label}
            </span>
            <div className="h-px flex-1 bg-white/5" />
        </div>
    );
}

// ─── Right panel: Clip inspector (tabbed) ─────────────────────────────────────

const SPEEDS      = [[0.5, '0.5×'], [1, '1×'], [1.25, '1.25×'], [1.5, '1.5×'], [2, '2×']];
const INSP_TABS   = [{ id: 'trim', label: 'Trim' }, { id: 'audio', label: 'Audio' }, { id: 'visual', label: 'Visual' }, { id: 'text', label: 'Text' }];

function ClipSettingsPanel({ clip, settings, onChange }) {
    const [activeTab, setActiveTab] = useState('trim');

    const duration   = clip.duration;
    const trimStart  = settings.trim_start  ?? 0;
    const trimEnd    = settings.trim_end    ?? duration;
    const muted      = settings.muted       ?? false;
    const volume     = settings.volume      ?? 1.0;
    const fadeIn     = settings.fade_in     ?? 0;
    const fadeOut    = settings.fade_out    ?? 0;
    const speed      = settings.speed       ?? 1.0;
    const brightness = settings.brightness  ?? 0;
    const contrast   = settings.contrast   ?? 0;
    const saturation = settings.saturation  ?? 0;
    const textOv     = settings.text_overlay ?? { enabled: false, text: '', size: 'md', position: 'bottom', color: 'white', animation: 'none' };
    const transition = settings.transition  ?? { type: 'cut', duration: 0.5 };
    const hasEffects = brightness !== 0 || contrast !== 0 || saturation !== 0;

    function set(key, value)           { onChange(key, value); }
    function setTextOv(key, value)     { onChange('text_overlay', { ...textOv, [key]: value }); }
    function setTransition(key, value) { onChange('transition', { ...transition, [key]: value }); }

    return (
        <div>
            {/* Header */}
            <div className="mb-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-0.5">Inspector</p>
                <p className="text-sm font-semibold text-white truncate">{clip.label || 'Clip'}</p>
                <p className="text-xs text-gray-600">{fmtDur(duration)} source</p>
            </div>

            {/* Tabs */}
            <div className="flex gap-0.5 bg-gray-800/60 rounded-lg p-0.5 mb-4 border border-white/5">
                {INSP_TABS.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={[
                            'flex-1 py-1.5 rounded-md text-xs font-semibold transition-all',
                            activeTab === tab.id ? 'bg-gray-700 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300',
                        ].join(' ')}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* ── Trim tab ── */}
            {activeTab === 'trim' && (
                <div className="space-y-4">
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-gray-600">Range</span>
                            <span className="text-xs font-mono text-violet-300">{(trimEnd - trimStart).toFixed(1)}s</span>
                        </div>
                        <div
                            className="relative h-4 rounded-lg bg-gray-800 mb-3 cursor-pointer select-none overflow-hidden"
                            onClick={e => {
                                const rect  = e.currentTarget.getBoundingClientRect();
                                const ratio = (e.clientX - rect.left) / rect.width;
                                const t     = ratio * duration;
                                if (Math.abs(t - trimStart) <= Math.abs(t - trimEnd)) {
                                    set('trim_start', Math.max(0, Math.min(t, trimEnd - 0.5)));
                                } else {
                                    set('trim_end', Math.min(duration, Math.max(t, trimStart + 0.5)));
                                }
                            }}
                        >
                            <div className="absolute top-0 h-full bg-gray-900/70 rounded-l-lg"
                                style={{ width: `${(trimStart / duration) * 100}%` }} />
                            <div className="absolute top-0 h-full bg-violet-600/40 border-t border-b border-violet-500/40"
                                style={{ left: `${(trimStart / duration) * 100}%`, width: `${((trimEnd - trimStart) / duration) * 100}%` }} />
                            <div className="absolute top-0 right-0 h-full bg-gray-900/70 rounded-r-lg"
                                style={{ width: `${((duration - trimEnd) / duration) * 100}%` }} />
                            <div className="absolute top-0 bottom-0 w-1.5 bg-violet-500 rounded-l-lg cursor-ew-resize"
                                style={{ left: `${(trimStart / duration) * 100}%` }} />
                            <div className="absolute top-0 bottom-0 w-1.5 bg-violet-500 rounded-r-lg cursor-ew-resize"
                                style={{ left: `calc(${(trimEnd / duration) * 100}% - 6px)` }} />
                        </div>
                        <div className="space-y-2">
                            <SliderRow label="Start" value={trimStart} min={0} max={duration} step={0.1}
                                onChange={v => set('trim_start', Math.min(v, trimEnd - 0.5))} display={fmtSec} />
                            <SliderRow label="End" value={trimEnd} min={0} max={duration} step={0.1}
                                onChange={v => set('trim_end', Math.max(v, trimStart + 0.5))} display={fmtSec} />
                        </div>
                    </div>

                    <SectionDivider />

                    <div>
                        <p className="text-xs text-gray-600 mb-2">Speed</p>
                        <ButtonGroup options={SPEEDS} value={speed} onChange={v => set('speed', v)} />
                        {speed !== 1.0 && (
                            <p className="mt-1.5 text-[11px] text-gray-600">
                                Rendered: <span className="text-gray-400 font-mono">{((trimEnd - trimStart) / speed).toFixed(1)}s</span>
                            </p>
                        )}
                    </div>

                    <SectionDivider />

                    <div>
                        <p className="text-xs text-gray-600 mb-2">Outgoing Transition</p>
                        <ButtonGroup
                            options={[['cut','Cut'],['fade','Fade'],['crossfade','X-Fade'],['smooth-fade','Smooth']]}
                            value={transition.type}
                            onChange={v => setTransition('type', v)}
                        />
                        {transition.type !== 'cut' && (
                            <div className="mt-2">
                                <SliderRow label="Duration" value={transition.duration ?? 0.5}
                                    min={0.1} max={2} step={0.1}
                                    onChange={v => setTransition('duration', v)}
                                    display={v => `${v.toFixed(1)}s`} />
                            </div>
                        )}
                        <p className="mt-1.5 text-[11px] text-gray-700">Transition into the next clip.</p>
                    </div>
                </div>
            )}

            {/* ── Audio tab ── */}
            {activeTab === 'audio' && (
                <div className="space-y-4">
                    <button
                        onClick={() => set('muted', !muted)}
                        className={[
                            'w-full flex items-center justify-between rounded-xl border px-4 py-2.5 transition-all duration-150',
                            muted ? 'bg-amber-500/10 border-amber-500/30 text-white' : 'bg-gray-800/40 border-white/8 text-gray-400 hover:border-white/20',
                        ].join(' ')}
                    >
                        <div className="flex items-center gap-2.5">
                            <svg className={`h-4 w-4 ${muted ? 'text-amber-400' : 'text-gray-500'}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                {muted ? (
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75 19.5 12m0 0 2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6 4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
                                ) : (
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
                                )}
                            </svg>
                            <div className="text-left">
                                <p className="text-sm font-semibold">{muted ? 'Muted' : 'Audio on'}</p>
                                <p className="text-xs text-gray-600">{muted ? 'Silent in export' : 'Original audio'}</p>
                            </div>
                        </div>
                        <PillToggle on={muted} accent="amber" />
                    </button>
                    {!muted && (
                        <div className="space-y-3">
                            <SliderRow label="Volume" value={volume} min={0} max={1} step={0.05}
                                onChange={v => set('volume', v)} display={v => `${Math.round(v * 100)}%`} />
                            <SliderRow label="Fade in" value={fadeIn} min={0} max={3} step={0.1}
                                onChange={v => set('fade_in', v)} display={v => v === 0 ? 'off' : `${v.toFixed(1)}s`} />
                            <SliderRow label="Fade out" value={fadeOut} min={0} max={3} step={0.1}
                                onChange={v => set('fade_out', v)} display={v => v === 0 ? 'off' : `${v.toFixed(1)}s`} />
                        </div>
                    )}
                </div>
            )}

            {/* ── Visual tab ── */}
            {activeTab === 'visual' && (() => {
                const activePreset = VISUAL_PRESETS.find(p =>
                    Math.abs(p.b - brightness) < 0.01 &&
                    Math.abs(p.c - contrast)   < 0.01 &&
                    Math.abs(p.s - saturation) < 0.01
                )?.id ?? null;

                return (
                    <div className="space-y-4">
                        {/* Preset picker */}
                        <div>
                            <p className="text-xs text-gray-600 mb-2">Preset</p>
                            <div className="grid grid-cols-5 gap-1">
                                {VISUAL_PRESETS.map(p => (
                                    <button
                                        key={p.id}
                                        onClick={() => { set('brightness', p.b); set('contrast', p.c); set('saturation', p.s); }}
                                        className={[
                                            'py-1.5 rounded-lg text-[10px] font-semibold border transition-all duration-150',
                                            activePreset === p.id
                                                ? 'bg-violet-600/20 border-violet-500/50 text-violet-300'
                                                : 'bg-gray-800/50 border-white/8 text-gray-500 hover:border-white/20 hover:text-gray-300',
                                        ].join(' ')}
                                    >
                                        {p.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <SectionDivider />

                        {/* Fine-tune sliders */}
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <p className="text-xs text-gray-600">Fine-tune</p>
                                {hasEffects && (
                                    <button
                                        onClick={() => { set('brightness', 0); set('contrast', 0); set('saturation', 0); }}
                                        className="text-[11px] text-gray-600 hover:text-violet-400 transition-colors"
                                    >
                                        Reset
                                    </button>
                                )}
                            </div>
                            <div className="space-y-3">
                                <SliderRow label="Brightness" value={brightness} min={-1} max={1} step={0.05}
                                    onChange={v => set('brightness', v)} display={v => `${v > 0 ? '+' : ''}${v.toFixed(2)}`} />
                                <SliderRow label="Contrast" value={contrast} min={-1} max={1} step={0.05}
                                    onChange={v => set('contrast', v)} display={v => `${v > 0 ? '+' : ''}${v.toFixed(2)}`} />
                                <SliderRow label="Saturation" value={saturation} min={-1} max={1} step={0.05}
                                    onChange={v => set('saturation', v)} display={v => `${v > 0 ? '+' : ''}${v.toFixed(2)}`} />
                            </div>
                            {hasEffects ? (
                                <p className="mt-2 text-[10px] text-emerald-500/80">Effects visible in preview above ↑</p>
                            ) : (
                                <p className="mt-2 text-[11px] text-gray-700">Pick a preset or drag sliders.</p>
                            )}
                        </div>
                    </div>
                );
            })()}

            {/* ── Text tab ── */}
            {activeTab === 'text' && (
                <div className="space-y-4">
                    <button
                        onClick={() => setTextOv('enabled', !textOv.enabled)}
                        className={[
                            'w-full flex items-center justify-between rounded-xl border px-4 py-2.5 transition-all duration-150',
                            textOv.enabled ? 'bg-violet-600/10 border-violet-500/30 text-white' : 'bg-gray-800/40 border-white/8 text-gray-400 hover:border-white/20',
                        ].join(' ')}
                    >
                        <div className="flex items-center gap-2.5">
                            <svg className={`h-4 w-4 ${textOv.enabled ? 'text-violet-400' : 'text-gray-600'}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
                            </svg>
                            <div className="text-left">
                                <p className="text-sm font-semibold">{textOv.enabled ? 'Text on' : 'No text'}</p>
                                <p className="text-xs text-gray-600">{textOv.enabled ? 'Visible in preview above ↑' : 'Burned in at export'}</p>
                            </div>
                        </div>
                        <PillToggle on={textOv.enabled} />
                    </button>
                    {textOv.enabled && (
                        <div className="space-y-3">
                            {/* Style presets */}
                            <div>
                                <label className="block text-xs text-gray-600 mb-1.5">Style Preset</label>
                                <div className="grid grid-cols-4 gap-1">
                                    {TEXT_STYLE_PRESETS.map(p => {
                                        const active = textOv.size === p.size && textOv.color === p.color && textOv.animation === p.animation;
                                        return (
                                            <button
                                                key={p.id}
                                                onClick={() => {
                                                    setTextOv('size', p.size);
                                                    setTextOv('color', p.color);
                                                    setTextOv('animation', p.animation);
                                                    setTextOv('bgBox', p.bgBox);
                                                }}
                                                className={[
                                                    'py-1.5 rounded-lg text-[10px] font-semibold border transition-all duration-150',
                                                    active ? 'bg-violet-600/20 border-violet-500/50 text-violet-300' : 'bg-gray-800/50 border-white/8 text-gray-500 hover:border-white/20 hover:text-gray-300',
                                                ].join(' ')}
                                            >
                                                {p.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs text-gray-600 mb-1.5">Text</label>
                                <input
                                    type="text"
                                    value={textOv.text}
                                    onChange={e => setTextOv('text', e.target.value)}
                                    maxLength={80}
                                    placeholder="e.g. CLUTCH"
                                    className="w-full rounded-lg bg-gray-800 border border-white/8 text-sm text-white placeholder-gray-700 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-600 mb-1.5">Position</label>
                                <ButtonGroup options={[['top','Top'],['center','Center'],['bottom','Bottom']]}
                                    value={textOv.position} onChange={v => setTextOv('position', v)} />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-600 mb-1.5">Size</label>
                                <ButtonGroup options={[['sm','Small'],['md','Med'],['lg','Large'],['xl','XL']]}
                                    value={textOv.size} onChange={v => setTextOv('size', v)} />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-600 mb-1.5">Color</label>
                                <div className="flex gap-1.5">
                                    {[['white','White','bg-white'],['yellow','Yellow','bg-yellow-400'],['purple','Purple','bg-violet-400'],['cyan','Cyan','bg-cyan-400']].map(([val, lab, dot]) => (
                                        <button key={val} onClick={() => setTextOv('color', val)}
                                            className={['flex-1 py-1.5 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1 transition-all duration-150',
                                                textOv.color === val ? 'bg-violet-600/20 border-violet-500/50 text-violet-300' : 'bg-gray-800/50 border-white/8 text-gray-500 hover:border-white/20 hover:text-gray-300',
                                            ].join(' ')}
                                        >
                                            <span className={`h-2 w-2 rounded-full ${dot}`} />
                                            {lab}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs text-gray-600 mb-1.5">Animation</label>
                                <ButtonGroup options={[['none','None'],['fade-in','Fade in'],['slide-up','Slide up']]}
                                    value={textOv.animation ?? 'none'} onChange={v => setTextOv('animation', v)} />
                            </div>
                            <button
                                onClick={() => setTextOv('bgBox', !(textOv.bgBox ?? true))}
                                className={[
                                    'w-full flex items-center justify-between rounded-xl border px-4 py-2.5 transition-all duration-150',
                                    (textOv.bgBox ?? true)
                                        ? 'bg-gray-800/60 border-white/15 text-white'
                                        : 'bg-gray-800/40 border-white/8 text-gray-400 hover:border-white/20',
                                ].join(' ')}
                            >
                                <div className="text-left">
                                    <p className="text-sm font-semibold">Background box</p>
                                    <p className="text-xs text-gray-600">Semi-transparent backing behind text</p>
                                </div>
                                <PillToggle on={!!(textOv.bgBox ?? true)} />
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Reusable card toggle block (intro / outro) ───────────────────────────────

function CardToggleBlock({
    label, headerSubtitle, enabled,
    text, subtitleText, duration, bgStyle, animation,
    onToggle, onTextChange, onSubtitleChange, onDurationChange, onBgStyleChange, onAnimationChange,
}) {
    return (
        <div className="rounded-xl border border-white/8 overflow-hidden">
            <button
                onClick={onToggle}
                className={[
                    'w-full flex items-center justify-between px-4 py-3 transition-colors',
                    enabled ? 'bg-violet-600/10' : 'bg-gray-800/40 hover:bg-gray-800/60',
                ].join(' ')}
            >
                <div className="flex items-center gap-2.5">
                    <svg className={`h-4 w-4 ${enabled ? 'text-violet-400' : 'text-gray-600'}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-3.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125 1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-1.5A1.125 1.125 0 0 1 18 18.375M20.625 4.5H3.375m17.25 0c.621 0 1.125.504 1.125 1.125M20.625 4.5h-1.5C18.504 4.5 18 5.004 18 5.625m3.75 0v1.5c0 .621-.504 1.125-1.125 1.125M3.375 4.5c-.621 0-1.125.504-1.125 1.125M3.375 4.5h1.5C5.496 4.5 6 5.004 6 5.625m-3.75 0v1.5c0 .621.504 1.125 1.125 1.125m0 0h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m1.5-3.75C5.496 8.25 6 8.754 6 9.375v1.5m0-5.25v5.25m0-5.25C6 5.004 6.504 4.5 7.125 4.5h9.75c.621 0 1.125.504 1.125 1.125m1.125 2.625h1.5m-1.5 0A1.125 1.125 0 0 1 18 7.125v1.5m1.125-1.125c.621 0 1.125.504 1.125 1.125v1.5m-7.5-6v5.625m0 0v5.625M12 10.5h.008v.008H12V10.5Zm0 5.25h.008v.008H12v-.008Z" />
                    </svg>
                    <div className="text-left">
                        <p className={`text-sm font-semibold ${enabled ? 'text-white' : 'text-gray-400'}`}>{label}</p>
                        <p className="text-xs text-gray-600">{headerSubtitle}</p>
                    </div>
                </div>
                <div className={`h-5 w-9 rounded-full border relative shrink-0 transition-colors ${enabled ? 'bg-violet-500/30 border-violet-500/50' : 'bg-gray-700 border-gray-600'}`}>
                    <span className={`absolute top-0.5 h-4 w-4 rounded-full transition-all ${enabled ? 'left-4 bg-violet-400' : 'left-0.5 bg-gray-500'}`} />
                </div>
            </button>

            {enabled && (
                <div className="px-4 pb-4 pt-3 space-y-3 border-t border-white/5 bg-gray-900/40">
                    {/* Title */}
                    <div>
                        <label className="block text-xs text-gray-600 mb-1.5">Title</label>
                        <input
                            type="text"
                            value={text}
                            onChange={e => onTextChange(e.target.value)}
                            maxLength={80}
                            placeholder="e.g. Best Plays"
                            className="w-full rounded-lg bg-gray-800 border border-white/8 text-sm text-white placeholder-gray-700 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition"
                        />
                    </div>
                    {/* Subtitle */}
                    <div>
                        <label className="block text-xs text-gray-600 mb-1.5">Subtitle <span className="text-gray-700">(optional)</span></label>
                        <input
                            type="text"
                            value={subtitleText ?? ''}
                            onChange={e => onSubtitleChange(e.target.value)}
                            maxLength={80}
                            placeholder="e.g. Season 3 Highlights"
                            className="w-full rounded-lg bg-gray-800 border border-white/8 text-sm text-white placeholder-gray-700 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition"
                        />
                    </div>
                    {/* Background style */}
                    <div>
                        <label className="block text-xs text-gray-600 mb-1.5">Style Preset</label>
                        <div className="grid grid-cols-5 gap-1">
                            {CARD_BG_STYLES.map(([val, lbl, dot]) => {
                                const active = (bgStyle ?? 'clean-fade') === val;
                                return (
                                    <button
                                        key={val}
                                        onClick={() => onBgStyleChange(val)}
                                        className={[
                                            'py-2 rounded-lg text-[10px] font-semibold border transition-all duration-150 flex flex-col items-center gap-1',
                                            active
                                                ? 'bg-violet-600/20 border-violet-500/50 text-violet-300'
                                                : 'bg-gray-800/50 border-white/8 text-gray-500 hover:border-white/20 hover:text-gray-300',
                                        ].join(' ')}
                                    >
                                        <span className={`h-2 w-2 rounded-full ${dot} ${active ? 'opacity-100' : 'opacity-50'}`} />
                                        {lbl}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    {/* Animation */}
                    <div>
                        <label className="block text-xs text-gray-600 mb-1.5">Animation</label>
                        <div className="grid grid-cols-5 gap-1">
                            {CARD_ANIMATIONS.map(([val, lbl]) => (
                                <button
                                    key={val}
                                    onClick={() => onAnimationChange(val)}
                                    className={[
                                        'py-1.5 rounded-lg text-[10px] font-semibold border transition-all duration-150',
                                        (animation ?? 'fade') === val
                                            ? 'bg-violet-600/20 border-violet-500/50 text-violet-300'
                                            : 'bg-gray-800/50 border-white/8 text-gray-500 hover:border-white/20 hover:text-gray-300',
                                    ].join(' ')}
                                >
                                    {lbl}
                                </button>
                            ))}
                        </div>
                    </div>
                    {/* Duration */}
                    <div>
                        <label className="block text-xs text-gray-600 mb-1.5">
                            Duration: <span className="text-gray-400 font-mono">{duration}s</span>
                        </label>
                        <input
                            type="range" min={1} max={10} step={1}
                            value={duration}
                            onChange={e => onDurationChange(parseInt(e.target.value))}
                            className="w-full h-1.5 accent-violet-500 cursor-pointer rounded-full bg-gray-800 appearance-none"
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Right panel: Project settings ────────────────────────────────────────────

function ProjectSettingsPanel({ titleCard, onTitleCardChange, projectSettings, onProjectSettingsChange }) {
    const outroCard   = projectSettings.outro_card   ?? { enabled: false, text: '', subtitle: '', duration: 3, bg_style: 'clean-fade', animation: 'fade' };
    const aspectRatio = projectSettings.aspect_ratio ?? 'original';
    const quality     = projectSettings.quality      ?? 'high';
    const music       = projectSettings.music        ?? { track_id: null, volume: 0.5, fade_in: 0, fade_out: 2, duck_clips: false, mute_clips_globally: false };
    const activeExportPreset = EXPORT_PRESETS.find(p => p.aspect === aspectRatio)?.id ?? 'original';

    // ── Music preview ─────────────────────────────────────────────────────────
    const audioRef              = useRef(null);
    const [previewing, setPreviewing] = useState(false);

    // Load + auto-play when the selected track changes
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;
        if (music.track_id) {
            audio.src    = `/music/builtin/${music.track_id}`;
            audio.volume = Math.max(0, Math.min(1, music.volume ?? 0.5));
            audio.load();
            audio.play().then(() => setPreviewing(true)).catch(() => setPreviewing(false));
        } else {
            audio.pause();
            audio.removeAttribute('src');
            setPreviewing(false);
        }
    }, [music.track_id]); // eslint-disable-line react-hooks/exhaustive-deps

    // Sync preview volume live (no reload needed)
    useEffect(() => {
        const audio = audioRef.current;
        if (audio) audio.volume = Math.max(0, Math.min(1, music.volume ?? 0.5));
    }, [music.volume]);

    // Stop audio when the panel unmounts
    useEffect(() => () => {
        const audio = audioRef.current;
        if (audio) { audio.pause(); audio.removeAttribute('src'); }
    }, []);

    // Click on already-selected track → toggle play/pause; click new track → select + play
    function handleTrackClick(trackId) {
        if (music.track_id === trackId && trackId !== null) {
            const audio = audioRef.current;
            if (!audio) return;
            if (previewing) { audio.pause(); } else { audio.play().catch(() => {}); }
        } else {
            setMusic('track_id', trackId);
        }
    }

    function setOutro(key, value) {
        onProjectSettingsChange('outro_card', { ...outroCard, [key]: value });
    }
    function setMusic(key, value) {
        onProjectSettingsChange('music', { ...music, [key]: value });
    }

    return (
        <div className="space-y-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Project settings</p>

            {/* ── Intro card ── */}
            <CardToggleBlock
                label="Intro card"
                headerSubtitle="Branded opening screen"
                enabled={titleCard.enabled}
                text={titleCard.text ?? ''}
                subtitleText={titleCard.subtitle ?? ''}
                duration={titleCard.duration ?? 3}
                bgStyle={titleCard.bg_style ?? 'clean-fade'}
                animation={titleCard.animation ?? 'fade'}
                onToggle={() => onTitleCardChange('enabled', !titleCard.enabled)}
                onTextChange={v => onTitleCardChange('text', v)}
                onSubtitleChange={v => onTitleCardChange('subtitle', v)}
                onDurationChange={v => onTitleCardChange('duration', v)}
                onBgStyleChange={v => onTitleCardChange('bg_style', v)}
                onAnimationChange={v => onTitleCardChange('animation', v)}
            />

            {/* ── Outro card ── */}
            <CardToggleBlock
                label="Outro card"
                headerSubtitle="Closing screen at the end"
                enabled={outroCard.enabled}
                text={outroCard.text ?? ''}
                subtitleText={outroCard.subtitle ?? ''}
                duration={outroCard.duration ?? 3}
                bgStyle={outroCard.bg_style ?? 'clean-fade'}
                animation={outroCard.animation ?? 'fade'}
                onToggle={() => setOutro('enabled', !outroCard.enabled)}
                onTextChange={v => setOutro('text', v)}
                onSubtitleChange={v => setOutro('subtitle', v)}
                onDurationChange={v => setOutro('duration', v)}
                onBgStyleChange={v => setOutro('bg_style', v)}
                onAnimationChange={v => setOutro('animation', v)}
            />

            <SectionDivider />

            {/* ── Background music ── */}
            <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Background Music</p>

                {/* Hidden audio element for music preview */}
                <audio
                    ref={audioRef}
                    loop
                    preload="none"
                    onPlay={() => setPreviewing(true)}
                    onPause={() => setPreviewing(false)}
                />

                {/* Built-in track picker */}
                <div className="space-y-1 mb-3">
                    {BUILT_IN_TRACKS.map(track => {
                        const isSelected = music.track_id === track.id;
                        const isPlaying  = isSelected && previewing && track.id !== null;
                        return (
                            <button
                                key={String(track.id)}
                                onClick={() => handleTrackClick(track.id)}
                                className={[
                                    'w-full flex items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-all duration-150',
                                    isSelected
                                        ? 'bg-violet-600/15 border-violet-500/50 ring-1 ring-violet-500/20'
                                        : 'bg-gray-800/40 border-white/8 hover:border-white/20',
                                ].join(' ')}
                            >
                                {track.id === null ? (
                                    <svg className="h-3.5 w-3.5 text-gray-600 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75 19.5 12m0 0 2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6 4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
                                    </svg>
                                ) : (
                                    <svg className={`h-3.5 w-3.5 shrink-0 ${isSelected ? 'text-violet-400' : 'text-gray-600'}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="m9 9 10.5-3m0 6.553v3.75a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 1 1-.99-3.467l2.31-.66a2.25 2.25 0 0 0 1.632-2.163Zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 0 1-.99-3.467l2.31-.66A2.25 2.25 0 0 0 9 15.553Z" />
                                    </svg>
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className={`text-xs font-semibold truncate ${isSelected ? 'text-white' : 'text-gray-400'}`}>
                                        {track.name}
                                    </p>
                                    {track.id !== null && (
                                        <p className="text-[10px] text-gray-600 mt-0.5">
                                            {track.vibe}{track.duration ? ` · ${track.duration}` : ''}
                                        </p>
                                    )}
                                </div>
                                {/* Playing indicator: animated bars when playing, dot when paused */}
                                {isSelected && track.id !== null && (
                                    isPlaying ? (
                                        <span className="flex items-end gap-px h-3 shrink-0" title="Click to pause preview">
                                            <span className="w-0.5 rounded-sm bg-violet-400 animate-bounce" style={{ height: '40%', animationDuration: '0.7s' }} />
                                            <span className="w-0.5 rounded-sm bg-violet-400 animate-bounce" style={{ height: '75%', animationDuration: '0.7s', animationDelay: '0.15s' }} />
                                            <span className="w-0.5 rounded-sm bg-violet-400 animate-bounce" style={{ height: '55%', animationDuration: '0.7s', animationDelay: '0.3s' }} />
                                        </span>
                                    ) : (
                                        <span className="h-2 w-2 rounded-full bg-violet-400/50 shrink-0" title="Click to resume preview" />
                                    )
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Music controls — shown when a track is selected */}
                {music.track_id && (
                    <div className="space-y-3 mb-3">
                        <SliderRow label="Volume" value={music.volume ?? 0.5} min={0} max={1} step={0.05}
                            onChange={v => setMusic('volume', v)} display={v => `${Math.round(v * 100)}%`} />
                        <SliderRow label="Fade in" value={music.fade_in ?? 0} min={0} max={10} step={0.5}
                            onChange={v => setMusic('fade_in', v)} display={v => v === 0 ? 'off' : `${v.toFixed(1)}s`} />
                        <SliderRow label="Fade out" value={music.fade_out ?? 2} min={0} max={10} step={0.5}
                            onChange={v => setMusic('fade_out', v)} display={v => v === 0 ? 'off' : `${v.toFixed(1)}s`} />
                    </div>
                )}

                {/* Global clip audio controls */}
                <div className="space-y-3">
                    <button
                        onClick={() => setMusic('mute_clips_globally', !music.mute_clips_globally)}
                        className={[
                            'w-full flex items-center justify-between rounded-xl border px-4 py-2.5 transition-all duration-150',
                            music.mute_clips_globally
                                ? 'bg-amber-500/10 border-amber-500/30 text-white'
                                : 'bg-gray-800/40 border-white/8 text-gray-400 hover:border-white/20',
                        ].join(' ')}
                    >
                        <div className="text-left">
                            <p className="text-sm font-semibold">Mute all clip audio</p>
                            <p className="text-xs text-gray-600">Silence every clip — overrides per-clip setting</p>
                        </div>
                        <PillToggle on={!!music.mute_clips_globally} accent="amber" />
                    </button>

                    {!music.mute_clips_globally && (
                        <button
                            onClick={() => setMusic('duck_clips', !music.duck_clips)}
                            className={[
                                'w-full flex items-center justify-between rounded-xl border px-4 py-2.5 transition-all duration-150',
                                music.duck_clips
                                    ? 'bg-violet-600/10 border-violet-500/30 text-white'
                                    : 'bg-gray-800/40 border-white/8 text-gray-400 hover:border-white/20',
                            ].join(' ')}
                        >
                            <div className="text-left">
                                <p className="text-sm font-semibold">Duck clip audio</p>
                                <p className="text-xs text-gray-600">Lower clip volume to 30% for music mix</p>
                            </div>
                            <PillToggle on={!!music.duck_clips} />
                        </button>
                    )}
                </div>
            </div>

            <SectionDivider />

            {/* ── Output ── */}
            <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">Output</p>
                <div className="grid grid-cols-3 gap-1.5 mb-3">
                    {EXPORT_PRESETS.map(preset => {
                        const active = activeExportPreset === preset.id;
                        return (
                            <button
                                key={preset.id}
                                onClick={() => {
                                    onProjectSettingsChange('aspect_ratio', preset.aspect);
                                    onProjectSettingsChange('quality', preset.quality);
                                }}
                                className={[
                                    'flex flex-col items-center gap-1 py-2.5 rounded-lg border text-xs transition-all duration-150',
                                    active
                                        ? 'bg-violet-600/20 border-violet-500/50 text-violet-300'
                                        : 'bg-gray-800/50 border-white/8 text-gray-500 hover:border-white/20 hover:text-gray-300',
                                ].join(' ')}
                            >
                                <span className="font-semibold">{preset.label}</span>
                                <span className={`text-[10px] leading-tight text-center ${active ? 'text-violet-400/70' : 'opacity-50'}`}>{preset.note}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Quality fine-tune */}
                <p className="text-[11px] text-gray-600 mb-1.5">Quality</p>
                <div className="flex gap-1.5">
                    {[
                        ['standard', 'Standard', 'Balanced'],
                        ['high',     'High',     'Best quality'],
                        ['smaller',  'Smaller',  'Fast upload'],
                    ].map(([val, label, note]) => (
                        <button
                            key={val}
                            onClick={() => onProjectSettingsChange('quality', val)}
                            className={[
                                'flex-1 flex flex-col items-center py-2 rounded-lg border text-xs transition-all duration-150',
                                quality === val
                                    ? 'bg-violet-600/20 border-violet-500/50 text-violet-300'
                                    : 'bg-gray-800/50 border-white/8 text-gray-500 hover:border-white/20 hover:text-gray-300',
                            ].join(' ')}
                        >
                            <span className="font-semibold">{label}</span>
                            <span className="text-[10px] mt-0.5 opacity-60">{note}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Hint */}
            <div className="flex items-start gap-2 rounded-xl bg-gray-800/30 border border-white/5 px-3.5 py-3">
                <svg className="mt-0.5 h-3.5 w-3.5 text-gray-700 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
                </svg>
                <p className="text-xs text-gray-600 leading-relaxed">
                    Click a clip in the storyboard to open its inspector.
                </p>
            </div>
        </div>
    );
}

// ─── Export panel ─────────────────────────────────────────────────────────────

function ExportPanel({ clipCount, exportStatus, outputUrl, errorMessage, saving, onExport }) {
    const isWorking = exportStatus === 'rendering';
    const isDone    = exportStatus === 'completed';
    const isFailed  = exportStatus === 'failed';

    return (
        <div className="space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Export</p>

            <div className="rounded-xl bg-gray-800/40 border border-white/8 px-4 py-3">
                <p className="text-sm text-gray-400">
                    <span className="font-semibold text-white">{clipCount}</span> clip{clipCount !== 1 ? 's' : ''} selected
                    {clipCount === 0 && <span className="block text-xs text-gray-600 mt-0.5">Add clips from the left panel</span>}
                </p>
            </div>

            {isFailed && errorMessage && (
                <div className="flex items-start gap-2 rounded-xl bg-red-500/8 border border-red-500/20 px-3.5 py-3">
                    <svg className="mt-0.5 h-3.5 w-3.5 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                    </svg>
                    <p className="text-xs text-red-400">{errorMessage}</p>
                </div>
            )}

            {isWorking && (
                <div className="flex items-center gap-3 rounded-xl bg-violet-500/8 border border-violet-500/20 px-4 py-3">
                    <svg className="h-4 w-4 text-violet-400 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <div>
                        <p className="text-sm font-semibold text-violet-300">Rendering montage...</p>
                        <p className="text-xs text-violet-500/60">This may take a moment. You can leave this page.</p>
                    </div>
                </div>
            )}

            {isDone && outputUrl && (
                <a
                    href={outputUrl}
                    download
                    className="flex items-center justify-center gap-2 w-full rounded-xl bg-green-600 hover:bg-green-500 text-white text-sm font-semibold py-3 transition-all duration-200 shadow-lg shadow-green-500/20 hover:-translate-y-px"
                >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                    </svg>
                    Download Montage
                </a>
            )}

            {!isWorking && (
                <button
                    onClick={onExport}
                    disabled={saving || clipCount === 0}
                    className={[
                        'flex items-center justify-center gap-2 w-full rounded-xl text-white text-sm font-semibold py-3 transition-all duration-200 shadow-lg',
                        isDone
                            ? 'bg-gray-700 hover:bg-gray-600 shadow-none'
                            : 'bg-violet-600 hover:bg-violet-500 shadow-violet-500/25 hover:shadow-violet-500/40 hover:-translate-y-px',
                        (saving || clipCount === 0) ? 'opacity-50 cursor-not-allowed translate-y-0' : '',
                    ].join(' ')}
                >
                    {saving ? (
                        <>
                            <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            Saving…
                        </>
                    ) : (
                        <>
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
                            </svg>
                            {isDone ? 'Re-render Montage' : isFailed ? 'Retry Render' : 'Render Montage'}
                        </>
                    )}
                </button>
            )}
        </div>
    );
}

// ─── Main editor page ─────────────────────────────────────────────────────────

export default function MontageEditor({ video, clips, project }) {

    // ── Project state ─────────────────────────────────────────────────────────
    const [projectId,      setProjectId]      = useState(project?.id    ?? null);
    const [projectTitle,   setProjectTitle]   = useState(project?.title ?? 'My Montage');
    const [orderedClipIds, setOrderedClipIds] = useState(project?.clip_order ?? []);
    const [clipSettings,     setClipSettings]     = useState(project?.clip_settings ?? {});
    const [titleCard,        setTitleCard]        = useState(project?.title_card ?? { enabled: false, text: '', subtitle: '', duration: 3, bg_style: 'clean-fade', animation: 'fade' });
    const [projectSettings,  setProjectSettings]  = useState(project?.project_settings ?? {
        outro_card:   { enabled: false, text: '', subtitle: '', duration: 3, bg_style: 'clean-fade', animation: 'fade' },
        aspect_ratio: 'original',
        quality:      'high',
        music:        { track_id: null, file_path: null, original_name: null, volume: 0.5, fade_in: 0, fade_out: 2, loop: false, duck_clips: false, mute_clips_globally: false },
    });

    // ── Export state ──────────────────────────────────────────────────────────
    const [exportStatus,   setExportStatus]   = useState(project?.status ?? null);
    const [outputUrl,      setOutputUrl]      = useState(project?.output_url ?? null);
    const [errorMessage,   setErrorMessage]   = useState(project?.error_message ?? null);
    const [saving,         setSaving]         = useState(false);

    // ── Editor UI state ───────────────────────────────────────────────────────
    const [selectedStoryboardId, setSelectedStoryboardId] = useState(null);
    const [dragFromIndex,        setDragFromIndex]         = useState(null);
    const [dragOverIndex,        setDragOverIndex]         = useState(null);
    const [titleEditing,         setTitleEditing]          = useState(false);
    const [previewMode,          setPreviewMode]           = useState('clip');

    const pollRef = useRef(null);

    // ── Derived ───────────────────────────────────────────────────────────────
    const clipsMap     = useMemo(() => Object.fromEntries(clips.map(c => [c.id, c])), [clips]);
    const selectedIds  = useMemo(() => new Set(orderedClipIds), [orderedClipIds]);
    const orderedClips = useMemo(() => orderedClipIds.map(id => clipsMap[id]).filter(Boolean), [orderedClipIds, clipsMap]);
    const selectedClip = selectedStoryboardId ? clipsMap[selectedStoryboardId] : null;
    const isExporting  = exportStatus === 'rendering';

    // ── Clip actions ──────────────────────────────────────────────────────────
    const addClip = useCallback((clip) => {
        if (selectedIds.has(clip.id)) return;
        setOrderedClipIds(prev => [...prev, clip.id]);
        setClipSettings(prev => ({ ...prev, [clip.id]: defaultClipSettings(clip) }));
    }, [selectedIds]);

    const removeClip = useCallback((clipId) => {
        setOrderedClipIds(prev => prev.filter(id => id !== clipId));
        setSelectedStoryboardId(prev => prev === clipId ? null : prev);
    }, []);

    const updateClipSetting = useCallback((clipId, key, value) => {
        setClipSettings(prev => ({
            ...prev,
            [clipId]: { ...prev[clipId], [key]: value },
        }));
    }, []);

    // ── Drag reorder ──────────────────────────────────────────────────────────
    const handleDragStart = useCallback((index) => setDragFromIndex(index), []);
    const handleDragOver  = useCallback((index) => setDragOverIndex(index), []);
    const handleDrop      = useCallback((toIndex) => {
        if (dragFromIndex === null || dragFromIndex === toIndex) {
            setDragFromIndex(null);
            setDragOverIndex(null);
            return;
        }
        setOrderedClipIds(prev => {
            const next = [...prev];
            const [moved] = next.splice(dragFromIndex, 1);
            next.splice(toIndex, 0, moved);
            return next;
        });
        setDragFromIndex(null);
        setDragOverIndex(null);
    }, [dragFromIndex]);

    // ── Title card ────────────────────────────────────────────────────────────
    const updateTitleCard = useCallback((key, value) => {
        setTitleCard(prev => ({ ...prev, [key]: value }));
    }, []);

    // ── Project settings ──────────────────────────────────────────────────────
    const updateProjectSettings = useCallback((key, value) => {
        setProjectSettings(prev => ({ ...prev, [key]: value }));
    }, []);

    // ── Polling ───────────────────────────────────────────────────────────────
    const startPolling = useCallback((pid) => {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = setInterval(async () => {
            try {
                const data = await apiFetch(`/api/montage-projects/${pid}/status`, { method: 'GET' });
                setExportStatus(data.status);
                setErrorMessage(data.error_message ?? null);
                if (data.status === 'completed') {
                    setOutputUrl(data.output_url);
                    clearInterval(pollRef.current);
                }
                if (data.status === 'failed') {
                    clearInterval(pollRef.current);
                }
            } catch { /* network hiccup — retry */ }
        }, 3000);
    }, []);

    useEffect(() => {
        if (isExporting && projectId) startPolling(projectId);
        return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }, [isExporting, projectId, startPolling]);

    // ── Export flow ───────────────────────────────────────────────────────────
    async function handleExport() {
        if (orderedClipIds.length === 0) return;
        setSaving(true);

        const payload = {
            video_id:         video.id,
            title:            projectTitle,
            clip_order:       orderedClipIds,
            clip_settings:    clipSettings,
            title_card:       titleCard,
            project_settings: projectSettings,
        };

        try {
            let pid = projectId;
            if (pid) {
                await apiFetch(`/montage-projects/${pid}`, { method: 'PUT', body: JSON.stringify(payload) });
            } else {
                const data = await apiFetch('/montage-projects', { method: 'POST', body: JSON.stringify(payload) });
                pid = data.project.id;
                setProjectId(pid);
            }
            const data = await apiFetch(`/montage-projects/${pid}/export`, { method: 'POST' });
            setExportStatus('rendering');
            setOutputUrl(null);
            setErrorMessage(null);
            router.visit(data.redirect_url);
        } catch (err) {
            setErrorMessage(err.message ?? 'Failed to start export. Please try again.');
        } finally {
            setSaving(false);
        }
    }

    // ── Save only ─────────────────────────────────────────────────────────────
    async function handleSave() {
        setSaving(true);
        const payload = {
            video_id:         video.id,
            title:            projectTitle,
            clip_order:       orderedClipIds,
            clip_settings:    clipSettings,
            title_card:       titleCard,
            project_settings: projectSettings,
        };
        try {
            if (projectId) {
                await apiFetch(`/montage-projects/${projectId}`, { method: 'PUT', body: JSON.stringify(payload) });
            } else {
                const data = await apiFetch('/montage-projects', { method: 'POST', body: JSON.stringify(payload) });
                setProjectId(data.project.id);
            }
        } catch (err) {
            setErrorMessage(err.message);
        } finally {
            setSaving(false);
        }
    }

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <>
            <Head title={`Montage Editor — ${video.original_name}`} />
            <div className="min-h-screen bg-gray-950 text-white flex flex-col">

                <DashboardHeader active="history" />

                {/* ── Top bar ───────────────────────────────────────────────── */}
                <div className="border-b border-white/5 bg-gray-900/60 backdrop-blur-sm">
                    <div className="mx-auto max-w-[1600px] px-4 sm:px-6 py-3 flex items-center gap-4">

                        <a
                            href={`/videos/${video.id}`}
                            className="shrink-0 flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-300 transition-colors"
                        >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                            </svg>
                            <span className="hidden sm:block">Back to clips</span>
                        </a>

                        <div className="h-4 w-px bg-white/10" />

                        {/* Editable project title */}
                        <div className="flex-1 min-w-0">
                            {titleEditing ? (
                                <input
                                    autoFocus
                                    type="text"
                                    value={projectTitle}
                                    onChange={e => setProjectTitle(e.target.value)}
                                    onBlur={() => setTitleEditing(false)}
                                    onKeyDown={e => e.key === 'Enter' && setTitleEditing(false)}
                                    maxLength={160}
                                    className="bg-transparent border-b border-violet-500 text-white text-sm font-semibold outline-none py-0.5 w-full max-w-xs"
                                />
                            ) : (
                                <button
                                    onClick={() => setTitleEditing(true)}
                                    className="flex items-center gap-1.5 group"
                                >
                                    <span className="text-sm font-semibold text-white truncate max-w-[220px]">
                                        {projectTitle}
                                    </span>
                                    <svg className="h-3 w-3 text-gray-700 group-hover:text-gray-400 shrink-0 transition-colors" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                                    </svg>
                                </button>
                            )}
                            <p className="text-xs text-gray-700 truncate">{video.original_name}</p>
                        </div>

                        {/* Status + actions */}
                        <div className="flex items-center gap-2.5 shrink-0">
                            <ExportBadge status={exportStatus} />

                            <button
                                onClick={handleSave}
                                disabled={saving || isExporting}
                                className="text-xs font-medium text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 border border-white/8 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
                            >
                                Save
                            </button>

                            <button
                                onClick={handleExport}
                                disabled={saving || isExporting || orderedClipIds.length === 0}
                                className="flex items-center gap-1.5 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-500 px-4 py-1.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                {isExporting ? (
                                    <>
                                        <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                        </svg>
                                        Rendering…
                                    </>
                                ) : (
                                    <>
                                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
                                        </svg>
                                        Render Montage
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                {/* ── Editor body ───────────────────────────────────────────── */}
                <div className="flex-1 grid grid-cols-[280px_1fr_300px] overflow-hidden">

                    {/* LEFT: Clip picker */}
                    <div className="border-r border-white/5 overflow-y-auto bg-gray-900/30">
                        <ClipPicker clips={clips} selectedIds={selectedIds} onAdd={addClip} />
                    </div>

                    {/* CENTRE: Preview + Storyboard */}
                    <div className="flex flex-col overflow-hidden">
                        <MainPreview
                            orderedClips={orderedClips}
                            selectedClip={selectedClip}
                            clipSettings={clipSettings}
                            previewMode={previewMode}
                            onModeChange={setPreviewMode}
                            onClipSelect={setSelectedStoryboardId}
                            titleCard={titleCard}
                            outroCard={projectSettings.outro_card ?? { enabled: false }}
                        />
                        <div className="flex-1 overflow-y-auto px-6 py-5">
                        <div className="mb-4 flex items-center justify-between">
                            <div>
                                <h2 className="text-sm font-semibold text-white">Storyboard</h2>
                                <p className="text-xs text-gray-600 mt-0.5">Drag to reorder · click to inspect</p>
                            </div>
                            {orderedClips.length > 0 && (
                                <span className="text-xs text-gray-600">
                                    {orderedClips.length} clip{orderedClips.length !== 1 ? 's' : ''}
                                </span>
                            )}
                        </div>

                        {/* Title card indicator */}
                        {titleCard.enabled && (
                            <div className="flex items-center gap-3 mb-3">
                                <div className="h-px flex-1 bg-white/5" />
                                <div className="flex items-center gap-2 rounded-lg bg-gray-800/60 border border-white/8 px-3 py-1.5">
                                    <svg className="h-3.5 w-3.5 text-violet-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-3.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125 1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-1.5A1.125 1.125 0 0 1 18 18.375M20.625 4.5H3.375m17.25 0c.621 0 1.125.504 1.125 1.125M20.625 4.5h-1.5C18.504 4.5 18 5.004 18 5.625m3.75 0v1.5c0 .621-.504 1.125-1.125 1.125M3.375 4.5c-.621 0-1.125.504-1.125 1.125M3.375 4.5h1.5C5.496 4.5 6 5.004 6 5.625m-3.75 0v1.5c0 .621.504 1.125 1.125 1.125m0 0h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m1.5-3.75C5.496 8.25 6 8.754 6 9.375v1.5m0-5.25v5.25m0-5.25C6 5.004 6.504 4.5 7.125 4.5h9.75c.621 0 1.125.504 1.125 1.125m1.125 2.625h1.5m-1.5 0A1.125 1.125 0 0 1 18 7.125v1.5m1.125-1.125c.621 0 1.125.504 1.125 1.125v1.5m-7.5-6v5.625m0 0v5.625M12 10.5h.008v.008H12V10.5Zm0 5.25h.008v.008H12v-.008Z" />
                                    </svg>
                                    <span className="text-xs text-gray-400">
                                        Intro: <span className="text-white font-medium">{titleCard.text || '(no text)'}</span>
                                        {titleCard.subtitle && <span className="text-gray-600 ml-1">— {titleCard.subtitle}</span>}
                                        <span className="text-gray-600 ml-1">· {titleCard.duration}s · {titleCard.bg_style ?? 'clean-fade'}</span>
                                    </span>
                                </div>
                                <div className="h-px flex-1 bg-white/5" />
                            </div>
                        )}

                        {/* Project status chips */}
                        {(() => {
                            const musicTrack   = BUILT_IN_TRACKS.find(t => t.id === projectSettings.music?.track_id);
                            const exportPreset = EXPORT_PRESETS.find(p => p.aspect === (projectSettings.aspect_ratio ?? 'original'));
                            const hasChips     = (musicTrack && musicTrack.id !== null) || exportPreset;
                            if (!hasChips) return null;
                            return (
                                <div className="flex items-center gap-1.5 flex-wrap mb-3">
                                    {musicTrack && musicTrack.id !== null && (
                                        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-[10px] font-medium text-violet-400">
                                            <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="m9 9 10.5-3m0 6.553v3.75a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 1 1-.99-3.467l2.31-.66a2.25 2.25 0 0 0 1.632-2.163Zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 0 1-.99-3.467l2.31-.66A2.25 2.25 0 0 0 9 15.553Z" />
                                            </svg>
                                            {musicTrack.name}
                                        </span>
                                    )}
                                    {exportPreset && exportPreset.id !== 'original' && (
                                        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-[10px] font-medium text-cyan-400">
                                            <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                                            </svg>
                                            {exportPreset.label}
                                        </span>
                                    )}
                                    {titleCard.enabled && (
                                        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-gray-700/60 border border-white/8 text-[10px] font-medium text-gray-400">
                                            Intro
                                        </span>
                                    )}
                                    {(projectSettings.outro_card?.enabled) && (
                                        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-gray-700/60 border border-white/8 text-[10px] font-medium text-gray-400">
                                            Outro
                                        </span>
                                    )}
                                </div>
                            );
                        })()}

                        {/* Empty state */}
                        {orderedClips.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-64 rounded-2xl border border-dashed border-white/10 text-center">
                                <svg className="h-8 w-8 text-gray-700 mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
                                </svg>
                                <p className="text-sm font-semibold text-gray-600">Storyboard is empty</p>
                                <p className="mt-1 text-xs text-gray-700">Add clips from the source panel on the left</p>
                            </div>
                        )}

                        {/* Clip cards + transition dividers */}
                        <div
                            className="space-y-0"
                            onDragEnd={() => { setDragFromIndex(null); setDragOverIndex(null); }}
                        >
                            {orderedClips.map((clip, i) => (
                                <div key={clip.id}>
                                    <StoryboardCard
                                        clip={clip}
                                        index={i}
                                        isSelected={selectedStoryboardId === clip.id}
                                        settings={clipSettings[clip.id] ?? {}}
                                        onSelect={setSelectedStoryboardId}
                                        onRemove={removeClip}
                                        onDragStart={handleDragStart}
                                        onDragOver={handleDragOver}
                                        onDrop={handleDrop}
                                        isDragOver={dragOverIndex === i && dragFromIndex !== i}
                                    />
                                    {i < orderedClips.length - 1 && (
                                        <TransitionDivider transition={clipSettings[clip.id]?.transition} />
                                    )}
                                </div>
                            ))}
                        </div>
                        </div>
                    </div>

                    {/* RIGHT: Inspector + export */}
                    <div className="border-l border-white/5 overflow-y-auto bg-gray-900/30">
                        <div className="p-4 space-y-6">

                            {selectedClip ? (
                                <div>
                                    <ClipSettingsPanel
                                        clip={selectedClip}
                                        settings={clipSettings[selectedClip.id] ?? {}}
                                        onChange={(key, val) => updateClipSetting(selectedClip.id, key, val)}
                                    />
                                    <button
                                        onClick={() => setSelectedStoryboardId(null)}
                                        className="mt-5 text-xs text-gray-600 hover:text-gray-400 transition-colors"
                                    >
                                        ← Project settings
                                    </button>
                                </div>
                            ) : (
                                <ProjectSettingsPanel
                                    titleCard={titleCard}
                                    onTitleCardChange={updateTitleCard}
                                    projectSettings={projectSettings}
                                    onProjectSettingsChange={updateProjectSettings}
                                />
                            )}

                            <div className="h-px bg-white/5" />

                            <ExportPanel
                                clipCount={orderedClips.length}
                                exportStatus={exportStatus}
                                outputUrl={outputUrl}
                                errorMessage={errorMessage}
                                saving={saving}
                                onExport={handleExport}
                            />
                        </div>
                    </div>

                </div>
            </div>
        </>
    );
}
