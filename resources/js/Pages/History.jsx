import { Head, router } from '@inertiajs/react';
import DashboardHeader from '../Components/Dashboard/DashboardHeader';
import ResumeProjectsPanel from '../Components/Projects/ResumeProjectsPanel';

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
        pending:    { cls: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/20', label: 'Queued',     dot: 'bg-yellow-400' },
        processing: { cls: 'bg-violet-500/15 text-violet-300 border-violet-500/20', label: 'Processing', dot: 'bg-violet-400 animate-pulse' },
        done:       { cls: 'bg-green-500/15  text-green-300  border-green-500/20',  label: 'Complete',   dot: 'bg-green-400' },
        failed:     { cls: 'bg-red-500/15    text-red-300    border-red-500/20',    label: 'Failed',     dot: 'bg-red-400' },
    };
    const c = map[status] ?? map.pending;
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${c.cls}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
            {c.label}
        </span>
    );
}

// ─── Video row card ───────────────────────────────────────────────────────────

function VideoRow({ video }) {
    function handleDelete(e) {
        e.preventDefault();
        if (!confirm(`Delete "${video.original_name}"? This cannot be undone.`)) return;
        router.delete(`/videos/${video.id}`);
    }

    const isProcessing = video.status === 'pending' || video.status === 'processing';
    const isDone       = video.status === 'done';
    const isFailed     = video.status === 'failed';

    const isClickable = video.status === 'done' || video.status === 'pending' || video.status === 'processing';
    const Wrapper = isClickable ? 'a' : 'div';
    const wrapperProps = isClickable ? { href: `/videos/${video.id}` } : {};

    return (
        <Wrapper {...wrapperProps} className={`bg-gray-900 border border-white/8 rounded-xl px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-4 ${isClickable ? 'cursor-pointer hover:border-white/15 hover:bg-gray-900/80 hover:-translate-y-px hover:shadow-md hover:shadow-violet-500/5 transition-all duration-200 group' : ''}`}>

            {/* Video icon + filename */}
            <div className="flex items-center gap-3.5 min-w-0 flex-1">
                <div className={`shrink-0 h-10 w-10 rounded-lg border flex items-center justify-center ${
                    isDone    ? 'bg-violet-500/10 border-violet-500/25' :
                    isFailed  ? 'bg-red-500/10    border-red-500/25' :
                                'bg-gray-800      border-gray-700'
                }`}>
                    <svg className={`h-5 w-5 ${isDone ? 'text-violet-400' : isFailed ? 'text-red-400' : 'text-gray-500'}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
                    </svg>
                </div>

                <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{video.original_name}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-gray-600">
                        <span>{video.uploaded_at}</span>
                        {fmtSize(video.size) && <><span>·</span><span>{fmtSize(video.size)}</span></>}
                        {fmtDuration(video.duration) && <><span>·</span><span>{fmtDuration(video.duration)}</span></>}
                    </div>
                </div>
            </div>

            {/* Status + meta */}
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 shrink-0">
                <StatusBadge status={video.status} />

                {isDone && video.clips_count > 0 && (
                    <span className="text-xs text-gray-500 whitespace-nowrap">
                        {video.clips_count} clip{video.clips_count !== 1 ? 's' : ''}
                    </span>
                )}

                {video.processed_at && (
                    <span className="hidden lg:block text-xs text-gray-700 whitespace-nowrap">
                        Processed {video.processed_at}
                    </span>
                )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
                {isDone && (
                    <a
                        href={`/videos/${video.id}`}
                        className="text-xs font-semibold text-white bg-violet-600 hover:bg-violet-500 px-4 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                    >
                        View results
                    </a>
                )}
                {isProcessing && (
                    <a
                        href={`/videos/${video.id}`}
                        className="text-xs font-medium text-violet-400 hover:text-violet-300 bg-violet-500/10 hover:bg-violet-500/15 border border-violet-500/20 px-4 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                    >
                        View progress →
                    </a>
                )}
                {isFailed && (
                    <a
                        href="/upload"
                        className="text-xs font-medium text-gray-400 hover:text-gray-300 bg-gray-800 hover:bg-gray-700 border border-white/8 px-4 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                    >
                        Try again
                    </a>
                )}

                {/* Delete */}
                <button
                    onClick={handleDelete}
                    title="Delete"
                    className="h-8 w-8 flex items-center justify-center rounded-lg text-gray-700 hover:text-red-400 hover:bg-red-500/10 border border-white/8 hover:border-red-500/20 transition-colors"
                >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                    </svg>
                </button>
            </div>

        </Wrapper>
    );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
    return (
        <div className="bg-gray-900 border border-white/8 rounded-2xl py-16 text-center">
            <div className="mx-auto mb-5 h-14 w-14 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center">
                <svg className="h-7 w-7 text-gray-700" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
                </svg>
            </div>
            <h2 className="text-base font-semibold text-gray-400">No highlights yet</h2>
            <p className="mt-1.5 text-sm text-gray-600 max-w-xs mx-auto">
                Upload your first gameplay video to start generating highlight clips.
            </p>
            <div className="mt-6">
                <a
                    href="/upload"
                    className="inline-flex items-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-6 py-2.5 transition-colors"
                >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    Upload a video
                </a>
            </div>
        </div>
    );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function History({ videos = [], recentProjects = [] }) {
    const doneCount       = videos.filter(v => v.status === 'done').length;
    const processingCount = videos.filter(v => v.status === 'pending' || v.status === 'processing').length;
    const totalClips      = videos.reduce((sum, v) => sum + (v.clips_count ?? 0), 0);

    return (
        <>
            <Head title="History — ClutchClip" />
            <div className="min-h-screen bg-gray-950 text-white">

                <DashboardHeader active="history" />

                <main className="mx-auto max-w-7xl px-4 sm:px-6 py-8 pb-24 md:pb-16">

                    {/* ── Page header ───────────────────────────────────── */}
                    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8 animate-fade-up">
                        <div>
                            <p className="text-xs font-semibold text-violet-400 uppercase tracking-widest mb-1">History</p>
                            <h1 className="text-2xl font-bold text-white">All uploads</h1>
                            <p className="mt-1 text-sm text-gray-500">
                                A log of every video you've processed with ClutchClip.
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-3 shrink-0">
                            <a
                                href="/montage-projects"
                                className="inline-flex items-center gap-2 rounded-xl border border-white/8 bg-gray-900 px-5 py-2.5 text-sm font-medium text-gray-300 transition-colors hover:border-white/15 hover:bg-gray-800 hover:text-white"
                            >
                                Projects
                            </a>
                            <a
                                href="/upload"
                                className="inline-flex items-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-5 py-2.5 transition-all duration-200 shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:-translate-y-px"
                            >
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                </svg>
                                New upload
                            </a>
                        </div>
                    </div>

                    {/* ── Stats row (only when there's data) ────────────── */}
                    {videos.length > 0 && (
                        <div className="grid grid-cols-3 gap-4 mb-8 animate-fade-up-1">
                            {[
                                { label: 'Total sessions',   value: videos.length },
                                { label: 'Completed',        value: doneCount },
                                { label: 'Clips generated',  value: totalClips },
                            ].map(({ label, value }) => (
                                <div key={label} className="bg-gray-900 border border-white/8 rounded-xl px-5 py-4 transition-all duration-200 hover:border-white/[0.13] hover:-translate-y-px hover:shadow-sm hover:shadow-violet-500/5">
                                    <p className="text-2xl font-bold text-white">{value}</p>
                                    <p className="mt-0.5 text-xs text-gray-500">{label}</p>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* ── Processing notice ────────────────────────────── */}
                    {processingCount > 0 && (
                        <div className="mb-5 flex items-center gap-2.5 rounded-xl bg-violet-500/8 border border-violet-500/20 px-4 py-3">
                            <span className="h-2 w-2 rounded-full bg-violet-400 animate-pulse shrink-0" />
                            <p className="text-sm text-violet-300">
                                {processingCount} job{processingCount !== 1 ? 's are' : ' is'} currently processing.
                                {' '}<a href={`/videos/${videos.find(v => v.status === 'pending' || v.status === 'processing')?.id}`}
                                    className="underline underline-offset-2 hover:text-violet-200 transition-colors">
                                    View progress →
                                </a>
                            </p>
                        </div>
                    )}

                    <div className="mb-8">
                        <ResumeProjectsPanel
                            title="Resume saved montage projects"
                            subtitle="Drafts are shown first so you can jump back into unfinished edits quickly."
                            projects={recentProjects}
                            emptyTitle="No saved projects in progress"
                            emptyDescription="Create a montage from any results page and it will show up here."
                        />
                    </div>

                    {/* ── List ────────────────────────────────────────── */}
                    {videos.length === 0 ? (
                        <EmptyState />
                    ) : (
                        <div className="space-y-3">
                            {videos.map(video => (
                                <VideoRow key={video.id} video={video} />
                            ))}
                        </div>
                    )}

                </main>
            </div>
        </>
    );
}
