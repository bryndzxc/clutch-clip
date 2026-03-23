import { Head, router } from '@inertiajs/react';
import { useEffect } from 'react';
import DashboardHeader from '../../Components/Dashboard/DashboardHeader';

function formatDate(value) {
    if (!value) return '—';
    return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(value));
}

function formatDuration(seconds) {
    if (seconds === null || seconds === undefined) return '—';
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}:${String(secs).padStart(2, '0')}`;
}

function formatFileSize(bytes) {
    if (!bytes) return '—';
    if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
    if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024).toFixed(1)} KB`;
}

function statusStyles(status) {
    return {
        pending: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/20',
        rendering: 'bg-violet-500/15 text-violet-300 border-violet-500/20',
        completed: 'bg-green-500/15 text-green-300 border-green-500/20',
        failed: 'bg-red-500/15 text-red-300 border-red-500/20',
    }[status] ?? 'bg-gray-500/15 text-gray-300 border-gray-500/20';
}

function statusLabel(status) {
    return {
        pending: 'Pending',
        rendering: 'Rendering',
        completed: 'Completed',
        failed: 'Failed',
    }[status] ?? status;
}

export default function Show({ montage }) {
    const displayTitle = montage.title || montage.filename;
    const isPending = montage.status === 'pending';
    const isRendering = montage.status === 'rendering';
    const isCompleted = montage.status === 'completed';
    const isFailed = montage.status === 'failed';

    useEffect(() => {
        if (isCompleted || isFailed) {
            return undefined;
        }

        const timer = window.setInterval(() => {
            router.reload({
                only: ['montage'],
                preserveScroll: true,
                preserveState: true,
            });
        }, 4000);

        return () => window.clearInterval(timer);
    }, [isCompleted, isFailed]);

    function handleDelete() {
        if (!confirm(`Delete "${displayTitle}"? This cannot be undone.`)) return;
        router.delete(`/montages/${montage.id}`);
    }

    return (
        <>
            <Head title={`${displayTitle} — ClutchClip`} />

            <div className="min-h-screen bg-gray-950 text-white">
                <DashboardHeader active="montages" />

                <main className="mx-auto max-w-6xl px-4 py-8 pb-24 sm:px-6 md:pb-16">
                    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                            <a href="/montages" className="mb-3 inline-flex items-center gap-2 text-sm text-gray-500 transition-colors hover:text-gray-300">
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0 7.5-7.5M3 12h18" />
                                </svg>
                                Back to montages
                            </a>

                            <div className="flex flex-wrap items-center gap-3">
                                <h1 className="text-2xl font-bold text-white">{displayTitle}</h1>
                                <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusStyles(montage.status)}`}>
                                    {(isPending || isRendering) && <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current animate-pulse" />}
                                    {statusLabel(montage.status)}
                                </span>
                            </div>

                            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-500">
                                <span>{formatDate(montage.created_at)}</span>
                                <span>·</span>
                                <span>{formatDuration(montage.duration)}</span>
                                <span>·</span>
                                <span>{formatFileSize(montage.file_size)}</span>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            {isCompleted && montage.download_url && (
                                <a
                                    href={montage.download_url}
                                    download={montage.filename}
                                    className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-500"
                                >
                                    Download
                                </a>
                            )}

                            <button
                                onClick={handleDelete}
                                className="rounded-xl border border-white/8 px-5 py-2.5 text-sm font-medium text-gray-400 transition-colors hover:border-red-500/20 hover:bg-red-500/10 hover:text-red-300"
                            >
                                Delete
                            </button>
                        </div>
                    </div>

                    {(isPending || isRendering) && (
                        <div className="rounded-2xl border border-violet-500/20 bg-violet-500/8 px-5 py-5">
                            <div className="flex items-start gap-3">
                                <svg className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-violet-400" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                                <div>
                                    <h2 className="text-base font-semibold text-violet-300">
                                        {isPending ? 'Preparing render...' : 'Rendering montage...'}
                                    </h2>
                                    <p className="mt-1 text-sm text-violet-200/70">
                                        This page refreshes automatically every few seconds until the montage is ready.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {isFailed && (
                        <div className="rounded-2xl border border-red-500/20 bg-red-500/8 px-5 py-5">
                            <h2 className="text-base font-semibold text-red-300">Montage render failed</h2>
                            <p className="mt-1 text-sm text-red-200/80">{montage.error_message || 'Something went wrong while rendering this montage.'}</p>
                        </div>
                    )}

                    {isCompleted && montage.output_path && (
                        <div className="overflow-hidden rounded-2xl border border-white/8 bg-gray-900">
                            <video
                                key={montage.output_path}
                                controls
                                preload="metadata"
                                className="aspect-video w-full bg-black"
                                src={montage.output_path}
                            />
                        </div>
                    )}
                </main>
            </div>
        </>
    );
}
