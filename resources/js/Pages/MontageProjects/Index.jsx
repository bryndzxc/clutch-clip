import { Head } from '@inertiajs/react';
import DashboardHeader from '../../Components/Dashboard/DashboardHeader';

function formatDate(value) {
    if (!value) return 'Recently';

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return 'Recently';

    return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(parsed);
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
        pending: 'Draft',
        rendering: 'Rendering',
        completed: 'Completed',
        failed: 'Failed',
    }[status] ?? 'Saved';
}

function EmptyState() {
    return (
        <div className="rounded-2xl border border-white/8 bg-gray-900 py-16 text-center">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-gray-700 bg-gray-800">
                <svg className="h-7 w-7 text-gray-700" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-8.25A2.25 2.25 0 0 0 17.25 3.75H6.75A2.25 2.25 0 0 0 4.5 6v12A2.25 2.25 0 0 0 6.75 20.25h6.75m-6-12h9m-9 4.5h5.25m2.25 5.25 2.25 2.25 4.5-4.5" />
                </svg>
            </div>
            <h2 className="text-base font-semibold text-gray-300">No montage projects yet</h2>
            <p className="mt-1.5 text-sm text-gray-500">Create or autosave a montage draft and it will appear here for easy recovery.</p>
            <div className="mt-6">
                <a
                    href="/history"
                    className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-500"
                >
                    Go to history
                </a>
            </div>
        </div>
    );
}

function ProjectRow({ project }) {
    return (
        <div className="rounded-xl border border-white/8 bg-gray-900 px-5 py-4 transition-all duration-200 hover:border-white/15 hover:bg-gray-900/80">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                        <h2 className="truncate text-sm font-semibold text-white">{project.title || 'My Montage'}</h2>
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusStyles(project.status)}`}>
                            {statusLabel(project.status)}
                        </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500">
                        {project.video_name ? <span>{project.video_name}</span> : null}
                        {project.clip_count ? <><span>·</span><span>{project.clip_count} clips</span></> : null}
                        <><span>·</span><span>Last edited {formatDate(project.last_edited_at)}</span></>
                        {project.montages_count ? <><span>·</span><span>{project.montages_count} export{project.montages_count !== 1 ? 's' : ''}</span></> : null}
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <a
                        href={project.resume_url}
                        className="rounded-lg bg-violet-600 px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-violet-500"
                    >
                        Resume Editing
                    </a>
                </div>
            </div>
        </div>
    );
}

export default function Index({ projects = [] }) {
    const draftCount = projects.filter((project) => project.is_draft).length;
    const completedCount = projects.filter((project) => project.status === 'completed').length;

    return (
        <>
            <Head title="Projects — ClutchClip" />

            <div className="min-h-screen bg-gray-950 text-white">
                <DashboardHeader active="projects" />

                <main className="mx-auto max-w-7xl px-4 py-8 pb-24 sm:px-6 md:pb-16">
                    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-violet-400">Workspace</p>
                            <h1 className="text-2xl font-bold text-white">Montage Projects</h1>
                            <p className="mt-1 text-sm text-gray-500">
                                Pick up in-progress drafts, reopen saved edits, and jump back into the montage editor quickly.
                            </p>
                        </div>
                        <a
                            href="/history"
                            className="inline-flex items-center gap-2 rounded-xl border border-white/8 bg-gray-900 px-5 py-2.5 text-sm font-medium text-gray-300 transition-colors hover:border-white/15 hover:bg-gray-800 hover:text-white"
                        >
                            Open history
                        </a>
                    </div>

                    {projects.length > 0 && (
                        <div className="mb-8 grid grid-cols-3 gap-4">
                            {[
                                { label: 'Saved projects', value: projects.length },
                                { label: 'Drafts', value: draftCount },
                                { label: 'Completed', value: completedCount },
                            ].map(({ label, value }) => (
                                <div key={label} className="rounded-xl border border-white/8 bg-gray-900 px-5 py-4">
                                    <p className="text-2xl font-bold text-white">{value}</p>
                                    <p className="mt-0.5 text-xs text-gray-500">{label}</p>
                                </div>
                            ))}
                        </div>
                    )}

                    {projects.length === 0 ? (
                        <EmptyState />
                    ) : (
                        <div className="space-y-3">
                            {projects.map((project) => (
                                <ProjectRow key={project.id} project={project} />
                            ))}
                        </div>
                    )}
                </main>
            </div>
        </>
    );
}
