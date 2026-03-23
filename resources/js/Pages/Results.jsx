import { Head } from '@inertiajs/react';
import { useState, useEffect } from 'react';
import DashboardHeader from '../Components/Dashboard/DashboardHeader';

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

function StatusBadge({ status }) {
    const map = {
        pending:    { cls: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/20', label: 'Queued' },
        processing: { cls: 'bg-violet-500/15 text-violet-300 border-violet-500/20', label: 'Processing' },
        done:       { cls: 'bg-green-500/15  text-green-300  border-green-500/20',  label: 'Complete' },
        failed:     { cls: 'bg-red-500/15    text-red-300    border-red-500/20',    label: 'Failed' },
    };
    const c = map[status] ?? map.pending;
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${c.cls}`}>
            {status === 'processing' && (
                <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse" />
            )}
            {c.label}
        </span>
    );
}

// ─── Processing state ─────────────────────────────────────────────────────────

const PROCESSING_STEPS = [
    { key: 'received',   label: 'Video received',       statuses: ['pending', 'processing', 'done'] },
    { key: 'queued',     label: 'Queued for processing', statuses: ['pending', 'processing', 'done'] },
    { key: 'analyzing',  label: 'Extracting highlights', statuses: ['processing', 'done'] },
    { key: 'generating', label: 'Generating clips',      statuses: ['done'] },
];

const STEP_DELAYS = ['animate-fade-up', 'animate-fade-up-1', 'animate-fade-up-2', 'animate-fade-up-3'];

// Horizontal step track: Upload → Detect → Generate → Ready
const TRACK_STEPS = ['Upload', 'Detect', 'Generate', 'Ready'];

function ProcessingView({ status, video }) {
    const activeIndex     = status === 'processing' ? 2 : 1;
    const trackActiveIdx  = status === 'processing' ? 2 : 1;

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
                    {status === 'processing' ? 'Extracting highlights…' : 'Queued for processing…'}
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
                    {PROCESSING_STEPS.map((step, i) => {
                        const isDone    = step.statuses.includes(status) && i < activeIndex;
                        const isActive  = i === activeIndex && step.statuses.includes(status);

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

function ClipCard({ clip, index }) {
    const isTop = index === 0;
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
                    src={clip.url}
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
                <div className="absolute top-2 right-2 pointer-events-none">
                    <span className={`bg-black/60 backdrop-blur-sm text-xs font-mono font-semibold px-2 py-0.5 rounded-md border ${
                        isTop
                            ? 'text-violet-200 border-violet-500/50'
                            : 'text-violet-300 border-violet-500/30'
                    }`}>
                        ⚡ {clip.score}
                    </span>
                </div>
            </div>

            {/* Info strip */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
                <div>
                    <p className="text-sm font-semibold text-white">Highlight #{index + 1}</p>
                    <p className="mt-0.5 text-xs text-gray-500">
                        {fmtTime(clip.start_time)} – {fmtTime(clip.end_time)}
                        <span className="ml-1.5 text-gray-700">· {clip.duration}s</span>
                    </p>
                </div>
                <a
                    href={clip.url}
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

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Results({ video, initialClips = [] }) {
    const [status, setStatus]     = useState(video.status);
    const [errorMsg, setErrorMsg] = useState(video.error_message ?? null);
    const [clips, setClips]       = useState(initialClips);

    const isTerminal = status === 'done' || status === 'failed';

    // Poll while not terminal
    useEffect(() => {
        if (isTerminal) return;

        const interval = setInterval(async () => {
            try {
                const res  = await fetch(`/api/videos/${video.id}/status`);
                const data = await res.json();
                setStatus(data.status);

                if (data.status === 'failed') {
                    setErrorMsg(data.error_message ?? 'An unknown error occurred.');
                    clearInterval(interval);
                }
                if (data.status === 'done') {
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
        if (status !== 'done') return;
        if (clips.length > 0) return; // already pre-loaded from server props

        fetch(`/api/videos/${video.id}/clips`)
            .then(r => r.json())
            .then(d => setClips(d.clips ?? []))
            .catch(() => {});
    }, [status, video.id, clips.length]);

    const pageTitle = status === 'done'
        ? `Highlights — ${video.original_name}`
        : status === 'failed'
            ? 'Processing Failed'
            : 'Processing…';

    return (
        <>
            <Head title={pageTitle} />
            <div className="min-h-screen bg-gray-950 text-white">

                <DashboardHeader active="results" />

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

                    {/* Processing */}
                    {(status === 'pending' || status === 'processing') && (
                        <ProcessingView status={status} video={video} />
                    )}

                    {/* Failed */}
                    {status === 'failed' && (
                        <FailedView error={errorMsg} />
                    )}

                    {/* Done — no clips */}
                    {status === 'done' && clips.length === 0 && (
                        <NoClipsView />
                    )}

                    {/* Done — with clips */}
                    {status === 'done' && clips.length > 0 && (
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
                                    <ClipCard key={clip.id} clip={clip} index={i} />
                                ))}
                            </div>

                            {/* Sidebar */}
                            <div className="space-y-4">
                                <JobSummary video={video} clipCount={clips.length} />

                                <div className="bg-gray-900 border border-white/8 rounded-2xl p-5 space-y-2.5">
                                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Actions</h3>
                                    <a
                                        href="/upload"
                                        className="flex items-center justify-center gap-2 w-full rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold py-2.5 transition-all duration-200 shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:-translate-y-px"
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
        </>
    );
}
