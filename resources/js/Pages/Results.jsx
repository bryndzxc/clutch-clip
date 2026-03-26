import { Head, router } from '@inertiajs/react';
import { useState, useEffect } from 'react';
import DashboardHeader from '../Components/Dashboard/DashboardHeader';
import ClipRefinementModal from '../Components/ClipRefinementModal';
import ResumeProjectsPanel from '../Components/Projects/ResumeProjectsPanel';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtTime(totalSeconds) {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
}

function fmtSize(bytes) {
    if (!bytes) return null;
    if (bytes >= 1024 * 1024 * 1024) return (bytes / 1024 / 1024 / 1024).toFixed(1) + ' GB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

function fmtDuration(seconds) {
    if (!seconds) return null;
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
}

// ─── Status badge ─────────────────────────────────────────────────────────────

// Statuses that represent "still processing" in the new pipeline
const PROCESSING_STATUSES = new Set([
    'queued', 'pending', 'probing', 'preparing_analysis_assets',
    'detecting_highlights', 'cutting_clips', 'generating_thumbnails',
    'processing', // legacy
]);
const DONE_STATUSES = new Set(['done', 'completed']);

function StatusBadge({ status }) {
    const processingEntry = { cls: 'bg-violet-500/15 text-violet-300 border-violet-500/20', label: 'Processing' };
    const map = {
        queued:                    { cls: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/20', label: 'Queued' },
        pending:                   { cls: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/20', label: 'Queued' },
        probing:                   processingEntry,
        preparing_analysis_assets: processingEntry,
        detecting_highlights:      processingEntry,
        cutting_clips:             processingEntry,
        generating_thumbnails:     processingEntry,
        processing:                processingEntry,
        done:                      { cls: 'bg-green-500/15  text-green-300  border-green-500/20',  label: 'Complete' },
        completed:                 { cls: 'bg-green-500/15  text-green-300  border-green-500/20',  label: 'Complete' },
        failed:                    { cls: 'bg-red-500/15    text-red-300    border-red-500/20',    label: 'Failed' },
    };
    const c = map[status] ?? map.queued;
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${c.cls}`}>
            {PROCESSING_STATUSES.has(status) && !['queued', 'pending'].includes(status) && (
                <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse" />
            )}
            {c.label}
        </span>
    );
}

// ─── Processing state ─────────────────────────────────────────────────────────

// Ordered labels for the detailed checklist (index = step position)
const PIPELINE_STEPS = [
    { key: 'received',   label: 'Video received' },
    { key: 'analyzing',  label: 'Analysing highlights' },
    { key: 'cutting',    label: 'Cutting clips' },
    { key: 'generating', label: 'Generating thumbnails' },
];

// Canonical map: backend status → 0-based pipeline step index
// A step at index i is "done" when STATUS_STEP_IDX[status] > i,
// and "active" when STATUS_STEP_IDX[status] === i.
// 4 = all steps complete (completed/done).
const STATUS_STEP_IDX = {
    queued:                    0,
    pending:                   0,
    probing:                   1,
    preparing_analysis_assets: 1,
    detecting_highlights:      1,
    processing:                1, // legacy
    cutting_clips:             2,
    generating_thumbnails:     3,
    completed:                 4,
    done:                      4,
};

// Canonical map: backend status → 0-based track step index
// Track steps: Upload(0) → Detect(1) → Generate(2) → Ready(3)
const STATUS_TRACK_IDX = {
    queued:                    0,
    pending:                   0,
    probing:                   1,
    preparing_analysis_assets: 1,
    detecting_highlights:      1,
    processing:                1, // legacy
    cutting_clips:             2,
    generating_thumbnails:     2,
    completed:                 3,
    done:                      3,
};

const STEP_DELAYS = ['animate-fade-up', 'animate-fade-up-1', 'animate-fade-up-2', 'animate-fade-up-3'];

// Horizontal step track: Upload → Detect → Generate → Ready
const TRACK_STEPS = ['Upload', 'Detect', 'Generate', 'Ready'];

function ProcessingView({ status, stageLabel, video }) {
    const pipelineIdx    = STATUS_STEP_IDX[status]  ?? 0;
    const trackActiveIdx = STATUS_TRACK_IDX[status] ?? 0;

    return (
        <div className="mx-auto max-w-md animate-fade-up">
            <div className="bg-gray-900 border border-violet-500/15 rounded-2xl p-10 text-center shadow-xl shadow-violet-500/5">

                {/* Rings animation + ambient glow */}
                <div className="relative mx-auto mb-2 h-16 w-16">
                    {/* Ambient glow orb */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-28 w-28 rounded-full bg-violet-500/10 blur-2xl pointer-events-none" />
                    <div className="absolute inset-0 rounded-full border-2 border-gray-800" />
                    <div className="absolute inset-0 rounded-full border-2 border-violet-500/30" />
                    <div className="absolute inset-[-6px] rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
                    <div className="absolute inset-[-12px] rounded-full border border-violet-500/20 border-t-transparent animate-spin [animation-duration:3s]" />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span className="h-3 w-3 rounded-full bg-violet-500 animate-pulse" />
                    </div>
                </div>

                {/* Scan sweep */}
                <div className="relative mx-auto mt-5 mb-6 h-px w-32 overflow-hidden rounded-full bg-gray-800/70">
                    <div className="absolute inset-y-0 w-16 bg-gradient-to-r from-transparent via-violet-400/65 to-transparent animate-scan-x" />
                </div>

                <h2 className="text-base font-semibold text-white">
                    {stageLabel ?? (PROCESSING_STATUSES.has(status) ? 'Processing…' : 'Queued for processing…')}
                </h2>
                <p className="mt-1.5 text-sm text-gray-500">
                    This may take a few minutes. The page updates automatically.
                </p>
                <p className="mt-1 text-xs text-gray-700">
                    Most videos complete in 1–5 minutes depending on length.
                </p>

                {/* Horizontal step track: Upload → Detect → Generate → Ready */}
                <div className="mt-7 mb-1">
                    <div className="flex items-start">
                        {TRACK_STEPS.map((label, i) => (
                            <div key={label} className="flex-1 flex flex-col items-center">
                                <div className="w-full flex items-center">
                                    <div className={`flex-1 h-px ${i === 0 ? 'invisible' : i <= trackActiveIdx ? 'bg-violet-500/45' : 'bg-gray-800'} transition-colors duration-500`} />
                                    <div className={`h-2 w-2 rounded-full shrink-0 transition-all duration-500 ${
                                        i < trackActiveIdx  ? 'bg-violet-400' :
                                        i === trackActiveIdx ? 'bg-violet-400 ring-2 ring-violet-400/25 ring-offset-1 ring-offset-gray-900' :
                                        'bg-gray-700'
                                    } ${i === trackActiveIdx ? 'animate-pulse' : ''}`} />
                                    <div className={`flex-1 h-px ${i === TRACK_STEPS.length - 1 ? 'invisible' : i < trackActiveIdx ? 'bg-violet-500/45' : 'bg-gray-800'} transition-colors duration-500`} />
                                </div>
                                <span className={`mt-2 text-[10px] font-medium tracking-wide transition-colors duration-300 ${
                                    i < trackActiveIdx  ? 'text-violet-400/60' :
                                    i === trackActiveIdx ? 'text-violet-300' :
                                    'text-gray-700'
                                }`}>{label}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Detailed step indicators */}
                <div className="mt-6 text-left space-y-3">
                    {PIPELINE_STEPS.map((step, i) => {
                        const isDone   = i < pipelineIdx;
                        const isActive = i === pipelineIdx;

                        return (
                            <div key={step.key} className={`flex items-center gap-3 ${STEP_DELAYS[i]}`}>
                                <div className={`h-5 w-5 rounded-full border flex items-center justify-center shrink-0 transition-all duration-300 ${
                                    isDone   ? 'bg-green-500/20 border-green-500/50' :
                                    isActive ? 'bg-violet-500/20 border-violet-500/50' :
                                               'bg-gray-800 border-gray-700'
                                }`}>
                                    {isDone ? (
                                        <svg className="h-2.5 w-2.5 text-green-400" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                        </svg>
                                    ) : isActive ? (
                                        <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse" />
                                    ) : (
                                        <span className="h-1.5 w-1.5 rounded-full bg-gray-700" />
                                    )}
                                </div>
                                <span className={`text-sm transition-colors duration-300 ${
                                    isDone   ? 'text-gray-400 line-through decoration-gray-600' :
                                    isActive ? 'text-white font-medium' :
                                               'text-gray-700'
                                }`}>
                                    {step.label}
                                </span>
                                {isActive && (
                                    <span className="ml-auto text-xs text-violet-400 animate-pulse">in progress</span>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* File context */}
                {video && (
                    <div className="mt-6 pt-5 border-t border-white/5 flex items-center justify-center gap-2 text-xs text-gray-600">
                        <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
                        </svg>
                        <span className="truncate max-w-[240px]">{video.original_name}</span>
                        {fmtSize(video.size) && <><span>·</span><span>{fmtSize(video.size)}</span></>}
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Failed state ─────────────────────────────────────────────────────────────

function FailedView({ error }) {
    return (
        <div className="mx-auto max-w-lg">
            <div className="bg-gray-900 border border-red-500/20 rounded-2xl p-10 text-center">
                <div className="mx-auto mb-5 h-12 w-12 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                    <svg className="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                    </svg>
                </div>
                <h2 className="text-base font-semibold text-white">Processing failed</h2>
                {error && (
                    <p className="mt-2 text-sm text-red-400/80 font-mono bg-red-500/5 border border-red-500/10 rounded-lg px-4 py-2 mt-3">
                        {error}
                    </p>
                )}
                <div className="mt-6 flex items-center justify-center gap-3">
                    <a
                        href="/upload"
                        className="rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-5 py-2 transition-colors"
                    >
                        Try another video
                    </a>
                    <a
                        href="/history"
                        className="rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium px-5 py-2 transition-colors border border-white/8"
                    >
                        Back to history
                    </a>
                </div>
            </div>
        </div>
    );
}

// ─── No clips found ───────────────────────────────────────────────────────────

function NoClipsView() {
    return (
        <div className="mx-auto max-w-lg">
            <div className="bg-gray-900 border border-white/8 rounded-2xl p-10 text-center">
                <div className="mx-auto mb-5 h-12 w-12 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center">
                    <svg className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.182 16.318A4.486 4.486 0 0 0 12.016 15a4.486 4.486 0 0 0-3.198 1.318M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75Zm-.375 0h.008v.015h-.008V9.75Zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75Zm-.375 0h.008v.015h-.008V9.75Z" />
                    </svg>
                </div>
                <h2 className="text-base font-semibold text-white">No highlights detected</h2>
                <p className="mt-1.5 text-sm text-gray-500">
                    This footage didn't have enough intensity peaks to generate clips.
                </p>
                <div className="mt-6">
                    <a
                        href="/upload"
                        className="inline-block rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-5 py-2 transition-colors"
                    >
                        Try another video
                    </a>
                </div>
            </div>
        </div>
    );
}

// ─── Clip card ────────────────────────────────────────────────────────────────

const CLIP_DELAYS = ['animate-fade-up', 'animate-fade-up-1', 'animate-fade-up-2', 'animate-fade-up-3'];

function ClipCard({ clip, index, onEdit }) {
    const isTop = index === 0;
    // Prefer refined clip URL for playback/download if available
    const playUrl     = clip.refined_url ?? clip.url;
    const downloadUrl = clip.refined_url ?? clip.url;

    return (
        <div className={[
            'bg-gray-900 border rounded-xl overflow-hidden group',
            'transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:shadow-violet-500/10',
            isTop ? 'border-violet-500/25 hover:border-violet-500/40' : 'border-white/8 hover:border-white/15',
            CLIP_DELAYS[Math.min(index, 3)],
        ].join(' ')}>
            {/* Player */}
            <div className="relative aspect-video bg-black">
                <video
                    src={playUrl}
                    poster={clip.thumbnail_url ?? undefined}
                    controls
                    preload="metadata"
                    className="w-full h-full object-contain"
                />
                {/* Overlays — pointer-events-none so video controls still work */}
                <div className="absolute top-2 left-2 pointer-events-none">
                    <span className="bg-black/60 backdrop-blur-sm text-white text-xs font-semibold px-2 py-0.5 rounded-md">
                        {isTop ? '⭐ #1' : `#${index + 1}`}
                    </span>
                </div>
                <div className="absolute top-2 right-2 pointer-events-none flex items-center gap-1.5">
                    {clip.refined_url && (
                        <span className="bg-violet-600/80 backdrop-blur-sm text-white text-xs font-semibold px-2 py-0.5 rounded-md">
                            Refined
                        </span>
                    )}
                    <span className={`bg-black/60 backdrop-blur-sm text-xs font-mono font-semibold px-2 py-0.5 rounded-md border ${
                        clip.confidence === 'high'
                            ? 'text-violet-200 border-violet-500/50'
                            : clip.confidence === 'low'
                            ? 'text-yellow-400/70 border-yellow-500/30'
                            : 'text-violet-300 border-violet-500/30'
                    }`}>
                        {clip.confidence === 'low' ? '? ' : ''}⚡ {clip.score}
                    </span>
                </div>
            </div>

            {/* Info strip */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
                <div>
                    <p className="text-sm font-semibold text-white">
                        {clip.label || `Highlight #${index + 1}`}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500">
                        {fmtTime(clip.start_time)} – {fmtTime(clip.end_time)}
                        <span className="ml-1.5 text-gray-700">· {clip.duration}s</span>
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {/* Edit / Refine button */}
                    <button
                        onClick={() => onEdit(clip)}
                        className="flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-violet-300 bg-gray-800 hover:bg-gray-800 border border-white/8 hover:border-violet-500/30 px-3 py-1.5 rounded-lg transition-all duration-200"
                        title="Refine clip"
                    >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                        </svg>
                        Refine
                    </button>
                    {/* Download button */}
                    <a
                        href={downloadUrl}
                        download={`clutchclip_highlight_${index + 1}.mp4`}
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1.5 text-xs font-medium text-gray-300 hover:text-violet-300 bg-gray-800 hover:bg-gray-800 border border-white/8 hover:border-violet-500/30 px-3 py-1.5 rounded-lg transition-all duration-200"
                    >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                        </svg>
                        Download
                    </a>
                </div>
            </div>
        </div>
    );
}

// ─── Job summary sidebar ──────────────────────────────────────────────────────

function JobSummary({ video, clipCount }) {
    const meta = [
        { label: 'File',       value: video.original_name },
        { label: 'Uploaded',   value: video.uploaded_at },
        { label: 'Processed',  value: video.processed_at ?? '—' },
        { label: 'Duration',   value: fmtDuration(video.duration) ?? '—' },
        { label: 'File size',  value: fmtSize(video.size) ?? '—' },
        { label: 'Highlights', value: clipCount > 0 ? `${clipCount} clip${clipCount !== 1 ? 's' : ''}` : '—' },
    ];

    return (
        <div className="bg-gray-900 border border-white/8 rounded-2xl p-5">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-4">Job summary</h3>
            <dl className="space-y-3">
                {meta.map(({ label, value }) => (
                    <div key={label}>
                        <dt className="text-xs text-gray-600 mb-0.5">{label}</dt>
                        <dd className="text-sm text-gray-300 break-all leading-snug">{value}</dd>
                    </div>
                ))}
            </dl>
        </div>
    );
}

// ─── Download all helper ──────────────────────────────────────────────────────

function downloadAll(clips) {
    clips.forEach((clip, i) => {
        setTimeout(() => {
            const a = document.createElement('a');
            a.href = clip.url;
            a.download = `clutchclip_highlight_${i + 1}.mp4`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }, i * 400); // stagger to avoid browser blocking multiple downloads
    });
}

// ─── AI Montage Panel ─────────────────────────────────────────────────────────

const AI_MODES = [
    {
        id: 'auto',
        label: 'Auto',
        desc: 'Best clips, dramatic arc',
        icon: (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
            </svg>
        ),
    },
    {
        id: 'flashy',
        label: 'Flashy',
        desc: 'Max effects, high energy',
        icon: (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
            </svg>
        ),
    },
    {
        id: 'cinematic',
        label: 'Cinematic',
        desc: 'Slow-mo, gradual build',
        icon: (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
            </svg>
        ),
    },
    {
        id: 'clean',
        label: 'Clean',
        desc: 'Minimal, smooth cuts',
        icon: (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
        ),
    },
];

function AiMontagePanel({ videoId }) {
    const [open, setOpen]       = useState(false);
    const [mode, setMode]       = useState('auto');
    const [loading, setLoading] = useState(false);
    const [error, setError]     = useState(null);

    async function handleGenerate() {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/videos/${videoId}/ai-montage`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept':       'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.content ?? '',
                },
                body: JSON.stringify({ mode }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message ?? 'Generation failed. Please try again.');
            router.visit(data.redirect_url);
        } catch (err) {
            setError(err.message);
            setLoading(false);
        }
    }

    if (!open) {
        return (
            <button
                onClick={() => setOpen(true)}
                className="relative flex items-center justify-center gap-2 w-full rounded-xl text-white text-sm font-semibold py-2.5 overflow-hidden transition-all duration-200 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 shadow-lg shadow-violet-500/30 hover:shadow-violet-500/50 hover:-translate-y-px"
            >
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z" />
                </svg>
                Generate with AI
            </button>
        );
    }

    return (
        <div className="rounded-xl border border-violet-500/25 bg-violet-500/5 p-3 space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-violet-300 uppercase tracking-wider">Choose style</span>
                <button
                    onClick={() => { setOpen(false); setError(null); }}
                    className="text-gray-600 hover:text-gray-400 transition-colors"
                    aria-label="Cancel"
                >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            {/* Mode grid */}
            <div className="grid grid-cols-2 gap-1.5">
                {AI_MODES.map(m => (
                    <button
                        key={m.id}
                        onClick={() => setMode(m.id)}
                        className={[
                            'flex flex-col items-start gap-0.5 rounded-lg px-2.5 py-2 text-left transition-all duration-150 border',
                            mode === m.id
                                ? 'bg-violet-600/20 border-violet-500/50 text-white'
                                : 'bg-gray-900/60 border-white/8 text-gray-400 hover:border-white/20 hover:text-gray-300',
                        ].join(' ')}
                    >
                        <span className={`${mode === m.id ? 'text-violet-300' : 'text-gray-600'} transition-colors`}>
                            {m.icon}
                        </span>
                        <span className="text-xs font-semibold leading-tight">{m.label}</span>
                        <span className="text-[10px] leading-tight opacity-70">{m.desc}</span>
                    </button>
                ))}
            </div>

            {/* Error */}
            {error && (
                <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                    {error}
                </p>
            )}

            {/* Generate button */}
            <button
                onClick={handleGenerate}
                disabled={loading}
                className="flex items-center justify-center gap-2 w-full rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold py-2 transition-colors"
            >
                {loading ? (
                    <>
                        <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Generating draft…
                    </>
                ) : (
                    `Generate ${AI_MODES.find(m => m.id === mode)?.label ?? ''}`
                )}
            </button>
        </div>
    );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Results({ video, initialClips = [], relatedProjects = [] }) {
    const [status, setStatus]         = useState(video.status);
    const [stageLabel, setStageLabel] = useState(null);
    const [errorMsg, setErrorMsg]     = useState(video.error_message ?? null);
    const [clips, setClips]           = useState(initialClips);
    const [editingClip, setEditingClip] = useState(null);

    function handleEditClip(clip) {
        setEditingClip(clip);
    }

    function handleCloseModal() {
        setEditingClip(null);
    }

    function handleRefineSaved(clipId, refinedData) {
        setClips(prev => prev.map(c =>
            c.id === clipId
                ? { ...c, ...refinedData }
                : c
        ));
    }

    const isDone     = DONE_STATUSES.has(status);
    const isTerminal = isDone || status === 'failed';

    // Poll while not terminal
    useEffect(() => {
        if (isTerminal) return;

        const interval = setInterval(async () => {
            try {
                const res  = await fetch(`/api/videos/${video.id}/status`);
                const data = await res.json();
                setStatus(data.status);
                if (data.stage_label) setStageLabel(data.stage_label);

                if (data.status === 'failed') {
                    setErrorMsg(data.error_message ?? 'An unknown error occurred.');
                    clearInterval(interval);
                }
                if (DONE_STATUSES.has(data.status)) {
                    clearInterval(interval);
                }
            } catch {
                // Silently retry — network hiccup
            }
        }, 2500);

        return () => clearInterval(interval);
    }, [isTerminal, video.id]);

    // Fetch clips when polling transitions us to done (not on initial load)
    useEffect(() => {
        if (!isDone) return;
        if (clips.length > 0) return; // already pre-loaded from server props

        fetch(`/api/videos/${video.id}/clips`)
            .then(r => r.json())
            .then(d => setClips(d.clips ?? []))
            .catch(() => {});
    }, [isDone, video.id, clips.length]);

    const pageTitle = isDone
        ? `Highlights — ${video.original_name}`
        : status === 'failed'
            ? 'Processing Failed'
            : 'Processing…';

    return (
        <>
            <Head title={pageTitle} />
            <div className="min-h-screen bg-gray-950 text-white">

                <DashboardHeader active="history" />

                <main className="mx-auto max-w-7xl px-4 sm:px-6 py-8 pb-24 md:pb-16">

                    {/* ── Back link ─────────────────────────────────────── */}
                    <a
                        href="/history"
                        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-300 transition-colors mb-6"
                    >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                        </svg>
                        Back to history
                    </a>

                    {/* ── Page header ───────────────────────────────────── */}
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-8">
                        <div className="min-w-0">
                            <p className="text-xs font-semibold text-violet-400 uppercase tracking-widest mb-1">Results</p>
                            <h1 className="text-2xl font-bold text-white truncate" title={video.original_name}>
                                {video.original_name}
                            </h1>
                            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                                {video.uploaded_at && <span>Uploaded {video.uploaded_at}</span>}
                                {fmtSize(video.size) && <><span className="text-gray-700">·</span><span>{fmtSize(video.size)}</span></>}
                                {fmtDuration(video.duration) && <><span className="text-gray-700">·</span><span>{fmtDuration(video.duration)} long</span></>}
                            </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                            <StatusBadge status={status} />
                            <a
                                href="/upload"
                                className="text-xs font-semibold text-white bg-violet-600 hover:bg-violet-500 px-4 py-1.5 rounded-lg transition-colors"
                            >
                                New upload
                            </a>
                        </div>
                    </div>

                    {/* ── States ───────────────────────────────────────── */}

                    {/* Processing — show for ANY non-terminal state so new pipeline
                        stages (or unexpected statuses) never leave the page blank. */}
                    {!isTerminal && (
                        <ProcessingView status={status} stageLabel={stageLabel} video={video} />
                    )}

                    {/* Failed */}
                    {status === 'failed' && (
                        <FailedView error={errorMsg} />
                    )}

                    {/* Done — no clips */}
                    {isDone && clips.length === 0 && (
                        <NoClipsView />
                    )}

                    {/* Done — with clips */}
                    {isDone && clips.length > 0 && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-up">

                            {/* Clips column */}
                            <div className="lg:col-span-2 space-y-5">
                                <div className="flex items-center justify-between gap-3">
                                    <p className="text-sm text-gray-500">
                                        Found{' '}
                                        <span className="text-white font-semibold">{clips.length}</span>
                                        {' '}highlight{clips.length !== 1 ? 's' : ''} — ranked by intensity score.
                                    </p>
                                    {clips.length > 1 && (
                                        <button
                                            onClick={() => downloadAll(clips)}
                                            className="shrink-0 flex items-center gap-1.5 text-xs font-medium text-gray-300 hover:text-white bg-gray-800 hover:bg-gray-700 border border-white/8 px-3 py-1.5 rounded-lg transition-colors"
                                        >
                                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                                            </svg>
                                            Download all ({clips.length})
                                        </button>
                                    )}
                                </div>
                                {clips.map((clip, i) => (
                                    <ClipCard key={clip.id} clip={clip} index={i} onEdit={handleEditClip} />
                                ))}
                            </div>

                            {/* Sidebar */}
                            <div className="space-y-4">
                                <JobSummary video={video} clipCount={clips.length} />

                                <ResumeProjectsPanel
                                    title="Projects for this video"
                                    subtitle="Open an existing draft for this session or start a fresh edit if you want a new montage."
                                    projects={relatedProjects}
                                    emptyTitle="No saved projects for this video"
                                    emptyDescription="Create a montage once and it will stay available here to resume later."
                                />

                                <div className="bg-gray-900 border border-white/8 rounded-2xl p-5 space-y-2.5">
                                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Actions</h3>

                                    {/* AI montage generator */}
                                    <AiMontagePanel videoId={video.id} />

                                    {/* Manual montage editor entry point */}
                                    <a
                                        href={`/videos/${video.id}/montage/new`}
                                        className="flex items-center justify-center gap-2 w-full rounded-xl bg-gray-800 hover:bg-gray-700 border border-white/8 text-gray-300 hover:text-white text-sm font-medium py-2.5 transition-all duration-200"
                                    >
                                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-3.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125 1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-1.5A1.125 1.125 0 0 1 18 18.375M20.625 4.5H3.375m17.25 0c.621 0 1.125.504 1.125 1.125M20.625 4.5h-1.5C18.504 4.5 18 5.004 18 5.625m3.75 0v1.5c0 .621-.504 1.125-1.125 1.125M3.375 4.5c-.621 0-1.125.504-1.125 1.125M3.375 4.5h1.5C5.496 4.5 6 5.004 6 5.625m-3.75 0v1.5c0 .621.504 1.125 1.125 1.125m0 0h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m1.5-3.75C5.496 8.25 6 8.754 6 9.375v1.5m0-5.25v5.25m0-5.25C6 5.004 6.504 4.5 7.125 4.5h9.75c.621 0 1.125.504 1.125 1.125m1.125 2.625h1.5m-1.5 0A1.125 1.125 0 0 1 18 7.125v1.5m1.125-1.125c.621 0 1.125.504 1.125 1.125v1.5m-7.5-6v5.625m0 0v5.625M12 10.5h.008v.008H12V10.5Zm0 5.25h.008v.008H12v-.008Z" />
                                        </svg>
                                        Create Montage
                                    </a>

                                    <a
                                        href="/upload"
                                        className="flex items-center justify-center gap-2 w-full rounded-xl bg-gray-800 hover:bg-gray-700 border border-white/8 text-gray-300 text-sm font-medium py-2.5 transition-colors"
                                    >
                                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                        </svg>
                                        New upload
                                    </a>
                                    <a
                                        href="/history"
                                        className="flex items-center justify-center gap-2 w-full rounded-xl bg-gray-800 hover:bg-gray-700 border border-white/8 text-gray-300 text-sm font-medium py-2.5 transition-colors"
                                    >
                                        View all history
                                    </a>
                                </div>

                                {/* Retention notice */}
                                <div className="rounded-xl bg-amber-500/5 border border-amber-500/15 px-4 py-3.5">
                                    <div className="flex items-start gap-2">
                                        <svg className="mt-0.5 h-3.5 w-3.5 text-amber-400/60 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                                        </svg>
                                        <p className="text-xs text-amber-300/50 leading-relaxed">
                                            Clips are available for a limited time. Download your highlights now to keep them permanently.
                                        </p>
                                    </div>
                                </div>
                            </div>

                        </div>
                    )}

                </main>
            </div>

            {/* ── Clip Refinement Modal ──────────────────────────────────── */}
            {editingClip && (
                <ClipRefinementModal
                    clip={editingClip}
                    index={clips.findIndex(c => c.id === editingClip.id)}
                    videoId={video.id}
                    onClose={handleCloseModal}
                    onSaved={handleRefineSaved}
                />
            )}
        </>
    );
}
