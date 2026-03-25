import { Head, router } from '@inertiajs/react';
import { useState, useRef } from 'react';
import DashboardHeader from '../Components/Dashboard/DashboardHeader';
import ResumeProjectsPanel from '../Components/Projects/ResumeProjectsPanel';
import OnboardingModal from '../Components/OnboardingModal';
import Tooltip from '../Components/Tooltip';

// ─── Status helpers ────────────────────────────────────────────────────────────

const DONE_STATUSES   = new Set(['completed', 'done']);
const ACTIVE_STATUSES = new Set([
    'queued', 'pending',
    'probing', 'preparing_analysis_assets', 'detecting_highlights',
    'cutting_clips', 'generating_thumbnails',
    'processing', // legacy
]);

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
    const processingEntry = { cls: 'bg-violet-500/15 text-violet-300 border-violet-500/20', label: 'Processing' };
    const config = {
        queued:                    { cls: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/20', label: 'Queued' },
        pending:                   { cls: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/20', label: 'Queued' },
        probing:                   processingEntry,
        preparing_analysis_assets: processingEntry,
        detecting_highlights:      processingEntry,
        cutting_clips:             processingEntry,
        generating_thumbnails:     processingEntry,
        processing:                processingEntry,
        completed:                 { cls: 'bg-green-500/15  text-green-300  border-green-500/20',  label: 'Done' },
        done:                      { cls: 'bg-green-500/15  text-green-300  border-green-500/20',  label: 'Done' },
        failed:                    { cls: 'bg-red-500/15    text-red-300    border-red-500/20',    label: 'Failed' },
    };
    const c = config[status] ?? config.queued;
    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${c.cls}`}>
            {c.label}
        </span>
    );
}

// ─── Recent job row ───────────────────────────────────────────────────────────
function JobRow({ video }) {
    const isClickable = DONE_STATUSES.has(video.status) || ACTIVE_STATUSES.has(video.status);

    return (
        <a
            href={isClickable ? `/videos/${video.id}` : undefined}
            className={[
                'flex items-center justify-between py-3.5 border-b border-white/5 last:border-0',
                isClickable ? 'cursor-pointer group' : '',
            ].join(' ')}
        >
            <div className="flex items-center gap-3 min-w-0">
                <div className="shrink-0 h-9 w-9 rounded-lg bg-gray-800 border border-white/8 flex items-center justify-center">
                    <svg className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
                    </svg>
                </div>
                <div className="min-w-0">
                    <p className="text-sm text-white truncate group-hover:text-violet-300 transition-colors">{video.original_name}</p>
                    <p className="text-xs text-gray-600 mt-0.5">{video.uploaded_at}</p>
                </div>
            </div>
            <div className="flex items-center gap-3 shrink-0 ml-4">
                <StatusBadge status={video.status} />
                {DONE_STATUSES.has(video.status) && (
                    <span className="text-xs font-medium text-violet-400 group-hover:text-violet-300 transition-colors whitespace-nowrap">
                        View clips →
                    </span>
                )}
                {ACTIVE_STATUSES.has(video.status) && (
                    <span className="text-xs text-gray-600 group-hover:text-gray-400 transition-colors whitespace-nowrap">
                        View →
                    </span>
                )}
            </div>
        </a>
    );
}

// ─── Sidebar: workflow steps ──────────────────────────────────────────────────
const STEPS = [
    { n: '01', label: 'Upload',   desc: 'Drop your gameplay footage' },
    { n: '02', label: 'Detect',   desc: 'AI scans for intense moments' },
    { n: '03', label: 'Generate', desc: 'Highlight clips are cut' },
    { n: '04', label: 'Download', desc: 'Save and share your clips' },
];

// ─── Sidebar: tips ────────────────────────────────────────────────────────────
const TIPS = [
    'Longer sessions generate more highlights',
    'H.264 MP4 produces the best output quality',
    'High-FPS recordings give sharper clips',
    'Audio spikes help detect clutch moments',
];

// ─── Main page ────────────────────────────────────────────────────────────────
export default function Upload({ recentVideos = [], recentProjects = [] }) {
    const [file, setFile]               = useState(null);
    const [dragActive, setDrag]         = useState(false);
    const [uploading, setUploading]     = useState(false);
    const [progress, setProgress]       = useState(0);
    const [chunkInfo, setChunkInfo]     = useState({ current: 0, total: 0 });
    const [error, setError]             = useState(null);
    const inputRef                      = useRef(null);

    function handleFile(f) {
        setError(null);
        if (f.size > 1536 * 1024 * 1024) {
            setError('File too large. Maximum size is 1.5 GB.');
            return;
        }
        setFile(f);
    }

    function handleDrop(e) {
        e.preventDefault();
        setDrag(false);
        if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
    }

    async function handleSubmit(e) {
        e.preventDefault();
        if (!file || uploading) return;

        setUploading(true);
        setError(null);
        setProgress(0);

        const CHUNK_SIZE  = 50 * 1024 * 1024;
        const uploadId    = crypto.randomUUID();
        const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
        setChunkInfo({ current: 0, total: totalChunks });
        const token       = document.querySelector('meta[name="csrf-token"]')?.content;

        const baseHeaders = {
            'Accept':           'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            ...(token ? { 'X-CSRF-TOKEN': token } : {}),
        };

        try {
            for (let i = 0; i < totalChunks; i++) {
                const chunk    = file.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
                const formData = new FormData();
                formData.append('upload_id',    uploadId);
                formData.append('chunk_index',  i);
                formData.append('total_chunks', totalChunks);
                formData.append('chunk',        chunk);

                const res = await fetch('/videos/chunks', { method: 'POST', headers: baseHeaders, body: formData });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(err.message || `Chunk ${i + 1} failed to upload.`);
                }
                setChunkInfo({ current: i + 1, total: totalChunks });
                setProgress(Math.round(((i + 1) / totalChunks) * 90));
            }

            setProgress(95);

            const assembleRes = await fetch('/videos/assemble', {
                method:  'POST',
                headers: { ...baseHeaders, 'Content-Type': 'application/json' },
                body:    JSON.stringify({ upload_id: uploadId, filename: file.name, total_chunks: totalChunks }),
            });

            const data = await assembleRes.json();
            if (!assembleRes.ok) throw new Error(data.message || 'Upload failed.');

            router.visit(`/videos/${data.id}`);
        } catch (err) {
            setUploading(false);
            setProgress(0);
            setError(err.message || 'Upload failed. Please try again.');
        }
    }

    return (
        <>
            <Head title="Dashboard — ClutchClip" />
            <OnboardingModal />
            <div className="min-h-screen bg-gray-950 text-white">

                <DashboardHeader active="upload" />

                <main className="mx-auto max-w-7xl px-4 sm:px-6 py-8 pb-24 md:pb-16">

                    {/* ── Page header ──────────────────────────────────────── */}
                    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8 animate-fade-up">
                        <div>
                            <p className="text-xs font-semibold text-violet-400 uppercase tracking-widest mb-1">Dashboard</p>
                            <h1 className="text-2xl font-bold text-white">Create Highlights</h1>
                            <p className="mt-1 text-sm text-gray-500">
                                Upload gameplay footage and get AI-detected highlight clips automatically.
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2 shrink-0">
                            {['.mp4', '.webm', '.mkv', '.avi'].map(fmt => (
                                <span key={fmt} className="px-2.5 py-1 rounded-md bg-gray-800/80 border border-white/8 text-xs text-gray-500 font-mono">
                                    {fmt}
                                </span>
                            ))}
                            <span className="px-2.5 py-1 rounded-md bg-gray-800/80 border border-white/8 text-xs text-gray-500">
                                Max 1.5 GB
                            </span>
                            <span className="px-2.5 py-1 rounded-md bg-gray-800/80 border border-white/8 text-xs text-gray-500">
                                Max 60 min
                            </span>
                        </div>
                    </div>

                    {/* ── Main grid ────────────────────────────────────────── */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-up-1">

                        {/* ── Left column (upload + history) ─────────────── */}
                        <div className="lg:col-span-2 space-y-6">

                            {/* Upload card */}
                            <div className="bg-gray-900 border border-white/8 rounded-2xl p-6 transition-all duration-200 hover:border-white/[0.13]">
                                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-5">
                                    Upload Video
                                </h2>

                                <form onSubmit={handleSubmit}>

                                    {/* Drop zone */}
                                    <Tooltip text="Drop your gameplay here (MP4, MKV, up to 60 mins)" position="top">
                                    <div
                                        className={[
                                            'relative rounded-xl border-2 border-dashed p-10 text-center',
                                            'transition-all duration-200 cursor-pointer select-none',
                                            dragActive
                                                ? 'border-violet-400 bg-violet-400/8 scale-[1.01] shadow-lg shadow-violet-500/20'
                                                : file
                                                    ? 'border-green-500/70 bg-green-500/8'
                                                    : 'border-gray-700 hover:border-gray-600 hover:bg-white/[0.015]',
                                        ].join(' ')}
                                        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
                                        onDragLeave={() => setDrag(false)}
                                        onDrop={handleDrop}
                                        onClick={() => !uploading && inputRef.current?.click()}
                                    >
                                        <input
                                            ref={inputRef}
                                            type="file"
                                            accept="video/mp4,video/webm,video/x-matroska,video/avi"
                                            className="hidden"
                                            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                                        />

                                        {file ? (
                                            <div>
                                                <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-green-500/15 border border-green-500/30 flex items-center justify-center">
                                                    <svg className="h-5 w-5 text-green-400" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                                    </svg>
                                                </div>
                                                <div className="flex items-center justify-center gap-2">
                                                    <p className="text-sm font-semibold text-green-300 truncate max-w-[260px]">{file.name}</p>
                                                    <span className="shrink-0 text-xs font-mono px-1.5 py-0.5 rounded bg-gray-800 border border-white/10 text-gray-500 uppercase">
                                                        {file.name.split('.').pop()}
                                                    </span>
                                                </div>
                                                <p className="mt-0.5 text-xs text-gray-600">
                                                    {(file.size / 1024 / 1024).toFixed(1)} MB
                                                </p>
                                                {!uploading && (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => { e.stopPropagation(); setFile(null); setError(null); }}
                                                        className="mt-3 text-xs text-gray-600 hover:text-gray-400 transition-colors underline underline-offset-2"
                                                    >
                                                        Remove file
                                                    </button>
                                                )}
                                            </div>
                                        ) : (
                                            <div>
                                                <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center">
                                                    <svg className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                                                    </svg>
                                                </div>
                                                <p className="text-sm text-gray-400">
                                                    Drag & drop your video here, or{' '}
                                                    <span className="text-violet-400 font-medium cursor-pointer">browse files</span>
                                                </p>
                                                <p className="mt-2 text-xs text-gray-700">
                                                    MP4 · WebM · MKV · AVI — max 1.5 GB · 60 min
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                    </Tooltip>

                                    {/* Error */}
                                    {error && (
                                        <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3">
                                            <svg className="mt-0.5 h-4 w-4 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                                            </svg>
                                            <p className="text-sm text-red-300">{error}</p>
                                        </div>
                                    )}

                                    {/* Progress */}
                                    {uploading && (
                                        <div className="mt-5 space-y-1.5">
                                            <div className="flex items-center justify-between text-xs text-gray-500">
                                                <span>
                                                    {progress < 95
                                                        ? chunkInfo.total > 1
                                                            ? `Uploading chunk ${chunkInfo.current} of ${chunkInfo.total}…`
                                                            : 'Uploading…'
                                                        : 'Assembling file…'
                                                    }
                                                </span>
                                                <span className="font-mono">{progress}%</span>
                                            </div>
                                            <div className="h-1.5 rounded-full bg-gray-800 overflow-hidden">
                                                <div
                                                    className="h-full rounded-full bg-gradient-to-r from-violet-600 to-indigo-400 transition-all duration-300"
                                                    style={{ width: `${progress}%` }}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* Submit */}
                                    <Tooltip text="Export your final montage" position="top">
                                    <button
                                        type="submit"
                                        disabled={!file || uploading}
                                        className={[
                                            'mt-5 w-full rounded-xl py-3 text-sm font-semibold transition-all duration-200',
                                            file && !uploading
                                                ? 'bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-500/30 hover:shadow-violet-500/50 hover:-translate-y-px cursor-pointer'
                                                : 'bg-gray-800 text-gray-600 cursor-not-allowed',
                                        ].join(' ')}
                                    >
                                        {uploading ? (
                                            <span className="flex items-center justify-center gap-2">
                                                <span className="h-3.5 w-3.5 rounded-full border-2 border-white/25 border-t-white animate-spin" />
                                                {progress < 95 ? `Uploading… ${progress}%` : 'Finalizing…'}
                                            </span>
                                        ) : (
                                            'Generate Highlights'
                                        )}
                                    </button>
                                    </Tooltip>

                                </form>
                            </div>

                            {/* Recent highlights */}
                            <div className="bg-gray-900 border border-white/8 rounded-2xl p-6 transition-all duration-200 hover:border-white/[0.13]">
                                <div className="flex items-center justify-between mb-1">
                                    <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
                                        Recent Highlights
                                    </h2>
                                    {recentVideos.length > 0 && (
                                        <span className="text-xs text-gray-700">
                                            {recentVideos.length} session{recentVideos.length !== 1 ? 's' : ''}
                                        </span>
                                    )}
                                </div>

                                {recentVideos.length === 0 ? (
                                    <div className="py-12 text-center">
                                        <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-gray-800 border border-white/5 flex items-center justify-center">
                                            <svg className="h-5 w-5 text-gray-700" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
                                            </svg>
                                        </div>
                                        <p className="text-sm font-medium text-gray-600">No highlights generated yet</p>
                                        <p className="mt-1 text-xs text-gray-700">
                                            Upload your first gameplay video above to get started
                                        </p>
                                    </div>
                                ) : (
                                    <div className="mt-4">
                                        {recentVideos.map(video => (
                                            <JobRow key={video.id} video={video} />
                                        ))}
                                    </div>
                                )}
                            </div>

                        </div>

                        {/* ── Right sidebar ───────────────────────────────── */}
                        <div className="space-y-4">

                            <ResumeProjectsPanel
                                title="Resume editing"
                                subtitle="Jump back into your latest saved montage drafts without hunting through old sessions."
                                projects={recentProjects}
                                emptyTitle="No saved montage drafts"
                                emptyDescription="Start editing a montage and autosave will keep it ready to resume here."
                            />

                            {/* Workflow steps */}
                            <div className="bg-gray-900 border border-white/8 rounded-2xl p-6 transition-all duration-200 hover:border-white/[0.13]">
                                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-5">
                                    How it works
                                </h3>
                                <div className="space-y-1">
                                    {STEPS.map((step, i) => (
                                        <div key={step.n} className="flex gap-3.5">
                                            <div className="flex flex-col items-center">
                                                <div className="h-8 w-8 shrink-0 rounded-lg bg-violet-500/15 border border-violet-500/25 flex items-center justify-center text-xs font-mono font-bold text-violet-400">
                                                    {step.n}
                                                </div>
                                                {i < STEPS.length - 1 && (
                                                    <div className="w-px flex-1 bg-gradient-to-b from-violet-500/20 to-transparent my-1 min-h-[18px]" />
                                                )}
                                            </div>
                                            <div className="pb-5 pt-1">
                                                <p className="text-sm font-semibold text-white leading-none">{step.label}</p>
                                                <p className="mt-1 text-xs text-gray-600">{step.desc}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Best results tips */}
                            <div className="bg-gray-900 border border-white/8 rounded-2xl p-6 transition-all duration-200 hover:border-white/[0.13]">
                                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-4">
                                    Best results
                                </h3>
                                <ul className="space-y-3">
                                    {TIPS.map((tip, i) => (
                                        <li key={i} className="flex items-start gap-2.5">
                                            <span className="mt-[3px] h-4 w-4 shrink-0 rounded-full bg-violet-500/15 border border-violet-500/25 flex items-center justify-center">
                                                <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
                                            </span>
                                            <span className="text-xs text-gray-500 leading-relaxed">{tip}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* Storage note */}
                            <div className="rounded-xl bg-amber-500/5 border border-amber-500/15 px-4 py-4">
                                <div className="flex items-start gap-2.5">
                                    <svg className="mt-0.5 h-4 w-4 text-amber-400/60 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                                    </svg>
                                    <div>
                                        <p className="text-xs font-semibold text-amber-300/70 mb-0.5">Storage note</p>
                                        <p className="text-xs text-amber-300/40 leading-relaxed">
                                            Source videos are deleted after processing. Only the generated clips are kept for download.
                                        </p>
                                    </div>
                                </div>
                            </div>

                        </div>

                    </div>
                </main>
            </div>
        </>
    );
}
