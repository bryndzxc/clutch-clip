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
        <div className={`${sizeMap[size]} rounded-lg overflow-hidden bg-gray-800 border border-white/8 shrink-0`}>
            {clip.thumbnail_url ? (
                <img src={clip.thumbnail_url} alt="" className="w-full h-full object-cover" />
            ) : (
                <div className="w-full h-full flex items-center justify-center">
                    <svg className="h-5 w-5 text-gray-700" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
                    </svg>
                </div>
            )}
        </div>
    );
}

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
                                <svg className="h-4 w-4 text-gray-700 group-hover:text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
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

// ─── Storyboard strip ─────────────────────────────────────────────────────────

function StoryboardCard({ clip, index, isSelected, settings, onSelect, onRemove, onDragStart, onDragOver, onDrop, isDragOver }) {
    const trimStart = settings?.trim_start ?? 0;
    const trimEnd   = settings?.trim_end   ?? clip.duration;
    const muted     = settings?.muted      ?? false;
    const trimmedDur = (trimEnd - trimStart).toFixed(1);

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
                    ? 'bg-violet-600/15 border-violet-500/50'
                    : 'bg-gray-800/50 border-white/8 hover:border-white/20',
                isDragOver
                    ? 'border-violet-400 ring-1 ring-violet-400/30'
                    : '',
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
                    <span className="ml-1.5 text-gray-700">({trimmedDur}s)</span>
                </p>
                <div className="mt-1 flex items-center gap-2">
                    {muted && (
                        <span className="text-[10px] font-semibold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                            Muted
                        </span>
                    )}
                    {clip.refined_url && (
                        <span className="text-[10px] font-semibold text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded">
                            Refined
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

// ─── Right panel: Settings ────────────────────────────────────────────────────

function ClipSettingsPanel({ clip, settings, onChange }) {
    const duration  = clip.duration;
    const trimStart = settings.trim_start ?? 0;
    const trimEnd   = settings.trim_end   ?? duration;
    const muted     = settings.muted      ?? false;

    return (
        <div className="space-y-5">
            <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">
                    Selected clip
                </p>
                <p className="text-sm font-semibold text-white">
                    {clip.label || `Clip`}
                </p>
                <p className="text-xs text-gray-600">Full duration: {fmtDur(duration)}</p>
            </div>

            {/* Trim */}
            <div>
                <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Trim</label>
                    <span className="text-xs font-mono text-violet-300">
                        {(trimEnd - trimStart).toFixed(1)}s
                    </span>
                </div>

                {/* Range bar */}
                <div className="relative h-1.5 rounded-full bg-gray-800 mb-4">
                    <div
                        className="absolute h-full rounded-full bg-violet-600"
                        style={{
                            left:  `${(trimStart / duration) * 100}%`,
                            width: `${((trimEnd - trimStart) / duration) * 100}%`,
                        }}
                    />
                </div>

                <div className="space-y-3">
                    <div>
                        <div className="flex justify-between text-xs text-gray-600 mb-1">
                            <span>Start</span>
                            <span className="font-mono text-gray-400">{fmtSec(trimStart)}</span>
                        </div>
                        <input
                            type="range" min={0} max={duration} step={0.1}
                            value={trimStart}
                            onChange={e => onChange('trim_start', Math.min(parseFloat(e.target.value), trimEnd - 0.5))}
                            className="w-full h-1.5 accent-violet-500 cursor-pointer rounded-full bg-gray-800 appearance-none"
                        />
                    </div>
                    <div>
                        <div className="flex justify-between text-xs text-gray-600 mb-1">
                            <span>End</span>
                            <span className="font-mono text-gray-400">{fmtSec(trimEnd)}</span>
                        </div>
                        <input
                            type="range" min={0} max={duration} step={0.1}
                            value={trimEnd}
                            onChange={e => onChange('trim_end', Math.max(parseFloat(e.target.value), trimStart + 0.5))}
                            className="w-full h-1.5 accent-violet-500 cursor-pointer rounded-full bg-gray-800 appearance-none"
                        />
                    </div>
                </div>
            </div>

            {/* Mute */}
            <button
                onClick={() => onChange('muted', !muted)}
                className={[
                    'w-full flex items-center justify-between rounded-xl border px-4 py-3 transition-all duration-150',
                    muted
                        ? 'bg-amber-500/10 border-amber-500/30 text-white'
                        : 'bg-gray-800/40 border-white/8 text-gray-400 hover:border-white/20',
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
                    <div>
                        <p className="text-sm font-semibold">{muted ? 'Muted' : 'Audio on'}</p>
                        <p className="text-xs text-gray-600">{muted ? 'Silent in final montage' : 'Original audio included'}</p>
                    </div>
                </div>
                {/* Toggle pill */}
                <div className={`h-5 w-9 rounded-full border relative shrink-0 transition-colors ${muted ? 'bg-amber-500/30 border-amber-500/50' : 'bg-gray-700 border-gray-600'}`}>
                    <span className={`absolute top-0.5 h-4 w-4 rounded-full transition-all ${muted ? 'left-4 bg-amber-400' : 'left-0.5 bg-gray-500'}`} />
                </div>
            </button>
        </div>
    );
}

function ProjectSettingsPanel({ titleCard, onTitleCardChange }) {
    return (
        <div className="space-y-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Project settings</p>

            {/* Title card */}
            <div className="rounded-xl border border-white/8 overflow-hidden">
                <button
                    onClick={() => onTitleCardChange('enabled', !titleCard.enabled)}
                    className={[
                        'w-full flex items-center justify-between px-4 py-3 transition-colors',
                        titleCard.enabled ? 'bg-violet-600/10' : 'bg-gray-800/40 hover:bg-gray-800/60',
                    ].join(' ')}
                >
                    <div className="flex items-center gap-2.5">
                        <svg className={`h-4 w-4 ${titleCard.enabled ? 'text-violet-400' : 'text-gray-600'}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-3.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-1.5A1.125 1.125 0 0 1 18 18.375M20.625 4.5H3.375m17.25 0c.621 0 1.125.504 1.125 1.125M20.625 4.5h-1.5C18.504 4.5 18 5.004 18 5.625m3.75 0v1.5c0 .621-.504 1.125-1.125 1.125M3.375 4.5c-.621 0-1.125.504-1.125 1.125M3.375 4.5h1.5C5.496 4.5 6 5.004 6 5.625m-3.75 0v1.5c0 .621.504 1.125 1.125 1.125m0 0h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m1.5-3.75C5.496 8.25 6 8.754 6 9.375v1.5m0-5.25v5.25m0-5.25C6 5.004 6.504 4.5 7.125 4.5h9.75c.621 0 1.125.504 1.125 1.125m1.125 2.625h1.5m-1.5 0A1.125 1.125 0 0 1 18 7.125v1.5m1.125-1.125c.621 0 1.125.504 1.125 1.125v1.5m-7.5-6v5.625m0 0v5.625M12 10.5h.008v.008H12V10.5Zm0 5.25h.008v.008H12v-.008Z" />
                        </svg>
                        <div className="text-left">
                            <p className={`text-sm font-semibold ${titleCard.enabled ? 'text-white' : 'text-gray-400'}`}>
                                Intro title card
                            </p>
                            <p className="text-xs text-gray-600">Black screen with text at the start</p>
                        </div>
                    </div>
                    <div className={`h-5 w-9 rounded-full border relative shrink-0 transition-colors ${titleCard.enabled ? 'bg-violet-500/30 border-violet-500/50' : 'bg-gray-700 border-gray-600'}`}>
                        <span className={`absolute top-0.5 h-4 w-4 rounded-full transition-all ${titleCard.enabled ? 'left-4 bg-violet-400' : 'left-0.5 bg-gray-500'}`} />
                    </div>
                </button>

                {titleCard.enabled && (
                    <div className="px-4 pb-4 pt-1 space-y-3 border-t border-white/5 bg-gray-900/40">
                        <div>
                            <label className="block text-xs text-gray-600 mb-1.5">Title text</label>
                            <input
                                type="text"
                                value={titleCard.text}
                                onChange={e => onTitleCardChange('text', e.target.value)}
                                maxLength={80}
                                placeholder="e.g. Best Plays"
                                className="w-full rounded-lg bg-gray-800 border border-white/8 text-sm text-white placeholder-gray-700 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-600 mb-1.5">
                                Duration: <span className="text-gray-400 font-mono">{titleCard.duration}s</span>
                            </label>
                            <input
                                type="range" min={1} max={10} step={1}
                                value={titleCard.duration}
                                onChange={e => onTitleCardChange('duration', parseInt(e.target.value))}
                                className="w-full h-1.5 accent-violet-500 cursor-pointer rounded-full bg-gray-800 appearance-none"
                            />
                        </div>
                    </div>
                )}
            </div>

            <div className="flex items-start gap-2 rounded-xl bg-gray-800/30 border border-white/5 px-3.5 py-3">
                <svg className="mt-0.5 h-3.5 w-3.5 text-gray-700 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
                </svg>
                <p className="text-xs text-gray-600 leading-relaxed">
                    Click a clip in the storyboard to adjust its trim and audio settings.
                </p>
            </div>
        </div>
    );
}

// ─── Export panel ─────────────────────────────────────────────────────────────

function ExportPanel({ clipCount, exportStatus, outputUrl, errorMessage, saving, onExport }) {
    const isIdle       = !exportStatus || exportStatus === 'pending';
    const isWorking    = exportStatus === 'rendering';
    const isDone       = exportStatus === 'completed';
    const isFailed     = exportStatus === 'failed';

    return (
        <div className="space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Export</p>

            {/* Duration summary */}
            <div className="rounded-xl bg-gray-800/40 border border-white/8 px-4 py-3">
                <p className="text-sm text-gray-400">
                    <span className="font-semibold text-white">{clipCount}</span> clip{clipCount !== 1 ? 's' : ''} selected
                    {clipCount === 0 && <span className="block text-xs text-gray-600 mt-0.5">Add clips from the left panel</span>}
                </p>
            </div>

            {/* Error */}
            {isFailed && errorMessage && (
                <div className="flex items-start gap-2 rounded-xl bg-red-500/8 border border-red-500/20 px-3.5 py-3">
                    <svg className="mt-0.5 h-3.5 w-3.5 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                    </svg>
                    <p className="text-xs text-red-400">{errorMessage}</p>
                </div>
            )}

            {/* Working indicator */}
            {isWorking && (
                <div className="flex items-center gap-3 rounded-xl bg-violet-500/8 border border-violet-500/20 px-4 py-3">
                    <svg className="h-4 w-4 text-violet-400 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <div>
                        <p className="text-sm font-semibold text-violet-300">
                            Rendering montage...
                        </p>
                        <p className="text-xs text-violet-500/60">This may take a moment. You can leave this page.</p>
                    </div>
                </div>
            )}

            {/* Download */}
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

            {/* Render / Re-render button */}
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
    // ── Project state ──────────────────────────────────────────────────────────
    const [projectId,    setProjectId]    = useState(project?.id    ?? null);
    const [projectTitle, setProjectTitle] = useState(project?.title ?? 'My Montage');
    const [orderedClipIds, setOrderedClipIds] = useState(project?.clip_order ?? []);
    const [clipSettings, setClipSettings] = useState(project?.clip_settings ?? {});
    const [titleCard, setTitleCard] = useState(project?.title_card ?? { enabled: false, text: '', duration: 3 });

    // ── Export state ───────────────────────────────────────────────────────────
    const [exportStatus, setExportStatus] = useState(project?.status ?? null);
    const [outputUrl,    setOutputUrl]    = useState(project?.output_url ?? null);
    const [errorMessage, setErrorMessage] = useState(project?.error_message ?? null);
    const [saving,       setSaving]       = useState(false);

    // ── Editor UI state ────────────────────────────────────────────────────────
    const [selectedStoryboardId, setSelectedStoryboardId] = useState(null);
    const [dragFromIndex,        setDragFromIndex]         = useState(null);
    const [dragOverIndex,        setDragOverIndex]         = useState(null);
    const [titleEditing,         setTitleEditing]          = useState(false);

    // ── Polling ref ────────────────────────────────────────────────────────────
    const pollRef = useRef(null);

    // ── Derived ───────────────────────────────────────────────────────────────
    const clipsMap      = useMemo(() => Object.fromEntries(clips.map(c => [c.id, c])), [clips]);
    const selectedIds   = useMemo(() => new Set(orderedClipIds), [orderedClipIds]);
    const orderedClips  = useMemo(() => orderedClipIds.map(id => clipsMap[id]).filter(Boolean), [orderedClipIds, clipsMap]);
    const selectedClip  = selectedStoryboardId ? clipsMap[selectedStoryboardId] : null;

    const isExporting = exportStatus === 'rendering';

    // ── Clip actions ──────────────────────────────────────────────────────────
    const addClip = useCallback((clip) => {
        if (selectedIds.has(clip.id)) return;
        setOrderedClipIds(prev => [...prev, clip.id]);
        setClipSettings(prev => ({
            ...prev,
            [clip.id]: { trim_start: 0, trim_end: parseFloat(clip.duration), muted: false },
        }));
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
            video_id:      video.id,
            title:         projectTitle,
            clip_order:    orderedClipIds,
            clip_settings: clipSettings,
            title_card:    titleCard,
        };

        try {
            let pid = projectId;

            // Save or create project
            if (pid) {
                await apiFetch(`/montage-projects/${pid}`, { method: 'PUT', body: JSON.stringify(payload) });
            } else {
                const data = await apiFetch('/montage-projects', { method: 'POST', body: JSON.stringify(payload) });
                pid = data.project.id;
                setProjectId(pid);
            }

            // Dispatch export job
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

    // ── Save only (no export) ─────────────────────────────────────────────────
    async function handleSave() {
        setSaving(true);
        const payload = {
            video_id:      video.id,
            title:         projectTitle,
            clip_order:    orderedClipIds,
            clip_settings: clipSettings,
            title_card:    titleCard,
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

                        {/* Back */}
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
                <div className="flex-1 grid grid-cols-[280px_1fr_260px] overflow-hidden">

                    {/* ── LEFT: Clip picker ──────────────────────────────────── */}
                    <div className="border-r border-white/5 overflow-y-auto bg-gray-900/30">
                        <ClipPicker clips={clips} selectedIds={selectedIds} onAdd={addClip} />
                    </div>

                    {/* ── CENTRE: Storyboard ────────────────────────────────── */}
                    <div className="overflow-y-auto px-6 py-5">
                        <div className="mb-4 flex items-center justify-between">
                            <div>
                                <h2 className="text-sm font-semibold text-white">Storyboard</h2>
                                <p className="text-xs text-gray-600 mt-0.5">Drag to reorder · click to edit</p>
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
                                        <span className="text-gray-600 ml-1">· {titleCard.duration}s</span>
                                    </span>
                                </div>
                                <div className="h-px flex-1 bg-white/5" />
                            </div>
                        )}

                        {/* Empty state */}
                        {orderedClips.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-64 rounded-2xl border border-dashed border-white/10 text-center">
                                <svg className="h-8 w-8 text-gray-700 mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-3.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125 1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-1.5A1.125 1.125 0 0 1 18 18.375M20.625 4.5H3.375m17.25 0c.621 0 1.125.504 1.125 1.125M20.625 4.5h-1.5C18.504 4.5 18 5.004 18 5.625m3.75 0v1.5c0 .621-.504 1.125-1.125 1.125M3.375 4.5c-.621 0-1.125.504-1.125 1.125M3.375 4.5h1.5C5.496 4.5 6 5.004 6 5.625m-3.75 0v1.5c0 .621.504 1.125 1.125 1.125m0 0h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m1.5-3.75C5.496 8.25 6 8.754 6 9.375v1.5m0-5.25v5.25m0-5.25C6 5.004 6.504 4.5 7.125 4.5h9.75c.621 0 1.125.504 1.125 1.125m1.125 2.625h1.5m-1.5 0A1.125 1.125 0 0 1 18 7.125v1.5m1.125-1.125c.621 0 1.125.504 1.125 1.125v1.5m-7.5-6v5.625m0 0v5.625M12 10.5h.008v.008H12V10.5Zm0 5.25h.008v.008H12v-.008Z" />
                                </svg>
                                <p className="text-sm font-semibold text-gray-600">Storyboard is empty</p>
                                <p className="mt-1 text-xs text-gray-700">Add clips from the source panel on the left</p>
                            </div>
                        )}

                        {/* Clip cards */}
                        <div
                            className="space-y-2"
                            onDragEnd={() => { setDragFromIndex(null); setDragOverIndex(null); }}
                        >
                            {orderedClips.map((clip, i) => (
                                <StoryboardCard
                                    key={clip.id}
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
                            ))}
                        </div>
                    </div>

                    {/* ── RIGHT: Settings + export ──────────────────────────── */}
                    <div className="border-l border-white/5 overflow-y-auto bg-gray-900/30">
                        <div className="p-4 space-y-6">

                            {/* Per-clip settings when a clip is selected */}
                            {selectedClip ? (
                                <div>
                                    <ClipSettingsPanel
                                        clip={selectedClip}
                                        settings={clipSettings[selectedClip.id] ?? {}}
                                        onChange={(key, val) => updateClipSetting(selectedClip.id, key, val)}
                                    />
                                    <button
                                        onClick={() => setSelectedStoryboardId(null)}
                                        className="mt-4 text-xs text-gray-600 hover:text-gray-400 transition-colors"
                                    >
                                        ← Back to project settings
                                    </button>
                                </div>
                            ) : (
                                <ProjectSettingsPanel
                                    titleCard={titleCard}
                                    onTitleCardChange={updateTitleCard}
                                />
                            )}

                            <div className="h-px bg-white/5" />

                            {/* Export panel */}
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
