import { Head, router } from '@inertiajs/react';
import DashboardHeader from '../../Components/Dashboard/DashboardHeader';

function formatDate(value) {
    if (!value) return '—';
    return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(value));
}

function formatDuration(seconds) {
    if (seconds === null || seconds === undefined) return null;
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}:${String(secs).padStart(2, '0')}`;
}

function formatFileSize(bytes) {
    if (!bytes) return null;
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

function EmptyState() {
    return (
        <div className="rounded-2xl border border-white/8 bg-gray-900 py-16 text-center">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-gray-700 bg-gray-800">
                <svg className="h-7 w-7 text-gray-700" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9A2.25 2.25 0 0 0 13.5 5.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
                </svg>
            </div>
            <h2 className="text-base font-semibold text-gray-300">No montages rendered yet</h2>
            <p className="mt-1.5 text-sm text-gray-500">Render a montage from the editor and it will show up here.</p>
        </div>
    );
}

function MontageRow({ montage }) {
    const displayTitle = montage.title || montage.filename;

    function handleDelete() {
        if (!confirm(`Delete "${displayTitle}"? This cannot be undone.`)) return;
        router.delete(`/montages/${montage.id}`, { preserveScroll: true });
    }

    return (
        <div className="rounded-xl border border-white/8 bg-gray-900 px-5 py-4 transition-all duration-200 hover:border-white/15 hover:bg-gray-900/80">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                        <h2 className="truncate text-sm font-semibold text-white">{displayTitle}</h2>
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusStyles(montage.status)}`}>
                            {montage.status === 'rendering' && <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current animate-pulse" />}
                            {statusLabel(montage.status)}
                        </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500">
                        <span>{formatDate(montage.created_at)}</span>
                        {formatDuration(montage.duration) && <><span>·</span><span>{formatDuration(montage.duration)}</span></>}
                        {formatFileSize(montage.file_size) && <><span>·</span><span>{formatFileSize(montage.file_size)}</span></>}
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <a
                        href={`/montages/${montage.id}`}
                        className="rounded-lg border border-white/8 bg-gray-800 px-4 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:border-white/15 hover:bg-gray-700 hover:text-white"
                    >
                        View
                    </a>

                    {montage.status === 'completed' && montage.download_url && (
                        <a
                            href={montage.download_url}
                            download={montage.filename}
                            className="rounded-lg bg-violet-600 px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-violet-500"
                        >
                            Download
                        </a>
                    )}

                    <button
                        onClick={handleDelete}
                        className="rounded-lg border border-white/8 px-4 py-1.5 text-xs font-medium text-gray-400 transition-colors hover:border-red-500/20 hover:bg-red-500/10 hover:text-red-300"
                    >
                        Delete
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function Index({ montages = [] }) {
    const completedCount = montages.filter((montage) => montage.status === 'completed').length;
    const renderingCount = montages.filter((montage) => montage.status === 'pending' || montage.status === 'rendering').length;

    return (
        <>
            <Head title="Montages — ClutchClip" />

            <div className="min-h-screen bg-gray-950 text-white">
                <DashboardHeader active="montages" />

                <main className="mx-auto max-w-7xl px-4 py-8 pb-24 sm:px-6 md:pb-16">
                    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-violet-400">Exports</p>
                            <h1 className="text-2xl font-bold text-white">Montages</h1>
                            <p className="mt-1 text-sm text-gray-500">View rendered montages, check their status, and download finished exports.</p>
                        </div>
                        <a
                            href="/history"
                            className="inline-flex items-center gap-2 rounded-xl border border-white/8 bg-gray-900 px-5 py-2.5 text-sm font-medium text-gray-300 transition-colors hover:border-white/15 hover:bg-gray-800 hover:text-white"
                        >
                            Back to history
                        </a>
                    </div>

                    {montages.length > 0 && (
                        <div className="mb-8 grid grid-cols-3 gap-4">
                            {[
                                { label: 'Total montages', value: montages.length },
                                { label: 'Completed', value: completedCount },
                                { label: 'In progress', value: renderingCount },
                            ].map(({ label, value }) => (
                                <div key={label} className="rounded-xl border border-white/8 bg-gray-900 px-5 py-4">
                                    <p className="text-2xl font-bold text-white">{value}</p>
                                    <p className="mt-0.5 text-xs text-gray-500">{label}</p>
                                </div>
                            ))}
                        </div>
                    )}

                    {montages.length === 0 ? (
                        <EmptyState />
                    ) : (
                        <div className="space-y-3">
                            {montages.map((montage) => (
                                <MontageRow key={montage.id} montage={montage} />
                            ))}
                        </div>
                    )}
                </main>
            </div>
        </>
    );
}
