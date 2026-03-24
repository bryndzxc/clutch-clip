function formatDateTime(value) {
    if (!value) return 'Recently';

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return 'Recently';

    return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(parsed);
}

function projectStatusStyles(status) {
    return {
        pending: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/20',
        rendering: 'bg-violet-500/15 text-violet-300 border-violet-500/20',
        completed: 'bg-green-500/15 text-green-300 border-green-500/20',
        failed: 'bg-red-500/15 text-red-300 border-red-500/20',
    }[status] ?? 'bg-gray-500/15 text-gray-300 border-gray-500/20';
}

function projectStatusLabel(status) {
    return {
        pending: 'Draft',
        rendering: 'Rendering',
        completed: 'Completed',
        failed: 'Failed',
    }[status] ?? 'Saved';
}

function ProjectRow({ project }) {
    return (
        <div className="rounded-xl border border-white/8 bg-gray-950/60 px-4 py-3 transition-all duration-200 hover:border-white/15 hover:bg-gray-950">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold text-white">
                            {project.title || 'My Montage'}
                        </p>
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${projectStatusStyles(project.status)}`}>
                            {projectStatusLabel(project.status)}
                        </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500">
                        {project.video_name ? <span>{project.video_name}</span> : null}
                        {project.clip_count ? <><span>·</span><span>{project.clip_count} clips</span></> : null}
                        <><span>·</span><span>Edited {formatDateTime(project.last_edited_at)}</span></>
                    </div>
                </div>

                <a
                    href={project.resume_url}
                    className="inline-flex items-center justify-center rounded-lg bg-violet-600 px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-violet-500"
                >
                    Resume Editing
                </a>
            </div>
        </div>
    );
}

export default function ResumeProjectsPanel({
    title = 'Resume editing',
    eyebrow = 'Projects',
    subtitle = 'Continue working on your saved montage drafts.',
    projects = [],
    emptyTitle = 'No saved projects yet',
    emptyDescription = 'Your saved montage drafts will show up here once you start editing.',
    viewAllHref = '/montage-projects',
    viewAllLabel = 'View all',
}) {
    return (
        <div className="rounded-2xl border border-white/8 bg-gray-900 p-6 transition-all duration-200 hover:border-white/[0.13]">
            <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-violet-400">{eyebrow}</p>
                    <h3 className="mt-1 text-base font-semibold text-white">{title}</h3>
                    <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
                </div>
                <a
                    href={viewAllHref}
                    className="shrink-0 rounded-lg border border-white/8 bg-gray-800 px-3 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:border-white/15 hover:bg-gray-700 hover:text-white"
                >
                    {viewAllLabel}
                </a>
            </div>

            {projects.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/8 bg-gray-950/50 px-5 py-8 text-center">
                    <p className="text-sm font-medium text-gray-400">{emptyTitle}</p>
                    <p className="mt-1 text-xs text-gray-600">{emptyDescription}</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {projects.map((project) => (
                        <ProjectRow key={project.id} project={project} />
                    ))}
                </div>
            )}
        </div>
    );
}
