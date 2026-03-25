import { Head } from '@inertiajs/react';
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
    pending:  'bg-yellow-500/15 text-yellow-300 border-yellow-500/20',
    completed:'bg-green-500/15 text-green-300 border-green-500/20',
    failed:   'bg-red-500/15 text-red-300 border-red-500/20',
    rendering:'bg-violet-500/15 text-violet-300 border-violet-500/20',
};

function Badge({ label, colorClass }) {
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${colorClass}`}>
            {label}
        </span>
    );
}

function StatCard({ label, value, sub, accent }) {
    return (
        <div className="rounded-xl border border-white/8 bg-gray-900/60 p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-gray-500">{label}</p>
            <p className={`mt-2 text-3xl font-bold ${accent ?? 'text-white'}`}>{value}</p>
            {sub && <p className="mt-1 text-xs text-gray-600">{sub}</p>}
        </div>
    );
}

export default function AdminDashboard({ stats, recentUsers, recentFeedback, recentRenders }) {
    return (
        <>
            <Head title="Admin — Dashboard" />
            <AdminLayout active="dashboard">
            <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 pb-24 md:pb-8">
                <div className="mb-8">
                    <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
                    <p className="mt-1 text-sm text-gray-500">Overview of ClutchClip activity.</p>
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 mb-10">
                    <StatCard label="Total Users"     value={stats.total_users} />
                    <StatCard label="New This Week"   value={stats.new_users_week}  accent="text-violet-400" />
                    <StatCard label="Projects"        value={stats.total_projects} />
                    <StatCard label="Renders Done"    value={stats.total_renders}   accent="text-green-400" />
                    <StatCard label="Failed Renders"  value={stats.failed_renders}  accent={stats.failed_renders > 0 ? 'text-red-400' : 'text-white'} />
                    <StatCard label="Total Feedback"  value={stats.total_feedback} />
                    <StatCard label="New Feedback"    value={stats.new_feedback}    accent={stats.new_feedback > 0 ? 'text-yellow-400' : 'text-white'} />
                </div>

                <div className="grid gap-6 lg:grid-cols-3">
                    {/* Recent users */}
                    <div className="lg:col-span-1 rounded-xl border border-white/8 bg-gray-900/60 p-5">
                        <h2 className="mb-4 text-sm font-semibold text-white">Recent Users</h2>
                        <ul className="divide-y divide-white/5">
                            {recentUsers.map((u) => (
                                <li key={u.id} className="flex items-center justify-between py-2.5 gap-2">
                                    <div className="min-w-0">
                                        <p className="text-sm text-white truncate">{u.name}</p>
                                        <p className="text-xs text-gray-600 truncate">{u.email}</p>
                                    </div>
                                    <div className="shrink-0 flex flex-col items-end gap-1">
                                        <span className="text-xs text-gray-600">{u.created_at}</span>
                                        {u.is_admin && (
                                            <span className="text-[10px] font-semibold uppercase tracking-wider text-violet-400">Admin</span>
                                        )}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Recent feedback */}
                    <div className="lg:col-span-1 rounded-xl border border-white/8 bg-gray-900/60 p-5">
                        <h2 className="mb-4 text-sm font-semibold text-white">Recent Feedback</h2>
                        {recentFeedback.length === 0 ? (
                            <p className="text-sm text-gray-600">No feedback yet.</p>
                        ) : (
                            <ul className="divide-y divide-white/5">
                                {recentFeedback.map((f) => (
                                    <li key={f.id} className="py-2.5">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Badge label={TYPE_LABELS[f.type] ?? f.type} colorClass={TYPE_COLORS[f.type] ?? 'bg-gray-500/15 text-gray-400 border-gray-500/20'} />
                                            <Badge label={f.status} colorClass={STATUS_COLORS[f.status] ?? 'bg-gray-500/15 text-gray-400 border-gray-500/20'} />
                                        </div>
                                        <p className="text-sm text-white truncate">{f.subject}</p>
                                        <p className="text-xs text-gray-600 mt-0.5">{f.user_name} · {f.created_at}</p>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {/* Recent renders */}
                    <div className="lg:col-span-1 rounded-xl border border-white/8 bg-gray-900/60 p-5">
                        <h2 className="mb-4 text-sm font-semibold text-white">Recent Renders</h2>
                        {recentRenders.length === 0 ? (
                            <p className="text-sm text-gray-600">No renders yet.</p>
                        ) : (
                            <ul className="divide-y divide-white/5">
                                {recentRenders.map((m) => (
                                    <li key={m.id} className="flex items-center justify-between py-2.5 gap-2">
                                        <div className="min-w-0">
                                            <p className="text-sm text-white truncate">{m.title}</p>
                                            <p className="text-xs text-gray-600 mt-0.5">{m.user_name} · {m.created_at}</p>
                                        </div>
                                        <Badge label={m.status} colorClass={STATUS_COLORS[m.status] ?? 'bg-gray-500/15 text-gray-400 border-gray-500/20'} />
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            </main>
            </AdminLayout>
        </>
    );
}
