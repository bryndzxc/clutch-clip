import { Head, router } from '@inertiajs/react';
import { useState } from 'react';
import AdminLayout from '../../Components/Admin/AdminLayout';

const TYPE_LABELS = {
    bug_report:      'Bug',
    feature_request: 'Feature',
    general:         'Feedback',
};

const TYPE_COLORS = {
    bug_report:      'bg-red-500/15 text-red-300 border-red-500/20',
    feature_request: 'bg-violet-500/15 text-violet-300 border-violet-500/20',
    general:         'bg-sky-500/15 text-sky-300 border-sky-500/20',
};

const STATUS_COLORS = {
    new:      'bg-yellow-500/15 text-yellow-300 border-yellow-500/20',
    reviewed: 'bg-blue-500/15 text-blue-300 border-blue-500/20',
    fixed:    'bg-green-500/15 text-green-300 border-green-500/20',
    closed:   'bg-gray-500/15 text-gray-400 border-gray-500/20',
};

const STATUSES = ['new', 'reviewed', 'fixed', 'closed'];

function Badge({ label, colorClass }) {
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${colorClass}`}>
            {label}
        </span>
    );
}

function StatusSelect({ reportId, current }) {
    const [value, setValue] = useState(current);
    const [saving, setSaving] = useState(false);

    function handleChange(e) {
        const next = e.target.value;
        setValue(next);
        setSaving(true);
        router.patch(
            `/admin/feedback/${reportId}`,
            { status: next },
            {
                preserveScroll: true,
                onFinish: () => setSaving(false),
            }
        );
    }

    return (
        <select
            value={value}
            onChange={handleChange}
            disabled={saving}
            className="rounded-lg border border-white/10 bg-gray-900 px-2.5 py-1.5 text-xs text-gray-300 focus:border-violet-500/50 focus:outline-none disabled:opacity-50 cursor-pointer"
        >
            {STATUSES.map((s) => (
                <option key={s} value={s}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
            ))}
        </select>
    );
}

function FilterBar({ filters }) {
    const [status, setStatus] = useState(filters.status ?? '');
    const [type,   setType]   = useState(filters.type   ?? '');

    function apply(newStatus, newType) {
        const params = {};
        if (newStatus) params.status = newStatus;
        if (newType)   params.type   = newType;
        router.get('/admin/feedback', params, { preserveScroll: true, replace: true });
    }

    function handleStatus(val) {
        setStatus(val);
        apply(val, type);
    }

    function handleType(val) {
        setType(val);
        apply(status, val);
    }

    function clearFilters() {
        setStatus('');
        setType('');
        router.get('/admin/feedback', {}, { preserveScroll: true, replace: true });
    }

    const hasFilter = status || type;

    return (
        <div className="flex flex-wrap items-center gap-2 mb-5">
            <select
                value={status}
                onChange={e => handleStatus(e.target.value)}
                className="rounded-lg border border-white/10 bg-gray-900 px-3 py-1.5 text-xs text-gray-300 focus:border-violet-500/50 focus:outline-none"
            >
                <option value="">All statuses</option>
                {STATUSES.map(s => (
                    <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
            </select>

            <select
                value={type}
                onChange={e => handleType(e.target.value)}
                className="rounded-lg border border-white/10 bg-gray-900 px-3 py-1.5 text-xs text-gray-300 focus:border-violet-500/50 focus:outline-none"
            >
                <option value="">All types</option>
                <option value="bug_report">Bug Reports</option>
                <option value="feature_request">Feature Requests</option>
                <option value="general">General Feedback</option>
            </select>

            {hasFilter && (
                <button
                    onClick={clearFilters}
                    className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
                >
                    Clear filters ×
                </button>
            )}
        </div>
    );
}

function FeedbackRow({ report }) {
    const [expanded, setExpanded] = useState(false);

    return (
        <div className="border-b border-white/5 last:border-0 px-5 py-4">
            <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <Badge
                            label={TYPE_LABELS[report.type] ?? report.type}
                            colorClass={TYPE_COLORS[report.type] ?? 'bg-gray-500/15 text-gray-400 border-gray-500/20'}
                        />
                        <span className="text-sm font-medium text-white">{report.subject}</span>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-600">
                        <span>{report.user_name}</span>
                        <span>{report.user_email}</span>
                        <span>{report.created_ago}</span>
                        {report.page && <span className="text-gray-700">on {report.page}</span>}
                    </div>

                    {expanded && (
                        <p className="mt-3 text-sm text-gray-400 whitespace-pre-wrap leading-relaxed border-l-2 border-white/10 pl-3">
                            {report.message}
                        </p>
                    )}

                    <button
                        onClick={() => setExpanded(v => !v)}
                        className="mt-2 text-xs text-gray-600 hover:text-gray-400 transition-colors"
                    >
                        {expanded ? 'Hide message ↑' : 'Show message ↓'}
                    </button>
                </div>

                <div className="shrink-0 flex flex-col items-end gap-2">
                    <StatusSelect reportId={report.id} current={report.status} />
                </div>
            </div>
        </div>
    );
}

function Pagination({ links, meta }) {
    if (meta.last_page <= 1) return null;

    return (
        <div className="flex items-center justify-between px-5 py-3 border-t border-white/5">
            <p className="text-xs text-gray-600">
                {meta.from}–{meta.to} of {meta.total}
            </p>
            <div className="flex gap-1">
                {links.map((link, i) => (
                    <button
                        key={i}
                        disabled={!link.url || link.active}
                        onClick={() => link.url && router.visit(link.url, { preserveScroll: true })}
                        className={`min-w-[32px] rounded px-2 py-1 text-xs transition-colors ${
                            link.active
                                ? 'bg-violet-600 text-white font-semibold'
                                : link.url
                                ? 'border border-white/10 text-gray-400 hover:border-white/20 hover:text-white'
                                : 'border border-white/5 text-gray-700 cursor-not-allowed'
                        }`}
                        dangerouslySetInnerHTML={{ __html: link.label }}
                    />
                ))}
            </div>
        </div>
    );
}

export default function AdminFeedback({ reports, filters }) {
    const rows  = reports.data  ?? [];
    const links = reports.links ?? [];
    const meta  = {
        last_page: reports.last_page,
        from:      reports.from,
        to:        reports.to,
        total:     reports.total,
    };

    return (
        <>
            <Head title="Admin — Feedback" />
            <AdminLayout active="feedback">
                <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 pb-24 md:pb-8">
                    <div className="mb-6">
                        <h1 className="text-2xl font-bold text-white">Feedback Inbox</h1>
                        <p className="mt-1 text-sm text-gray-500">{reports.total} total submissions</p>
                    </div>

                    <FilterBar filters={filters} />

                    <div className="rounded-xl border border-white/8 bg-gray-900/60 overflow-hidden">
                        {rows.length === 0 ? (
                            <div className="px-5 py-12 text-center text-sm text-gray-600">
                                No feedback found.
                            </div>
                        ) : (
                            <>
                                {rows.map(report => (
                                    <FeedbackRow key={report.id} report={report} />
                                ))}
                                <Pagination links={links} meta={meta} />
                            </>
                        )}
                    </div>
                </main>
            </AdminLayout>
        </>
    );
}
