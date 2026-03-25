import { Head } from '@inertiajs/react';
import { router } from '@inertiajs/react';
import AdminLayout from '../../Components/Admin/AdminLayout';

function Pagination({ links, meta }) {
    if (meta.last_page <= 1) return null;

    return (
        <div className="flex items-center justify-between px-1 pt-4">
            <p className="text-xs text-gray-600">
                {meta.from}–{meta.to} of {meta.total} users
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

export default function AdminUsers({ users }) {
    const { data, links, meta } = users;

    // LengthAwarePaginator from Inertia serializes slightly differently;
    // handle both shapes
    const rows   = data  ?? users.data  ?? [];
    const pLinks = links ?? users.links ?? [];
    const pMeta  = meta  ?? { last_page: users.last_page, from: users.from, to: users.to, total: users.total };

    return (
        <>
            <Head title="Admin — Users" />
            <AdminLayout active="users">
                <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 pb-24 md:pb-8">
                    <div className="mb-6">
                        <h1 className="text-2xl font-bold text-white">Users</h1>
                        <p className="mt-1 text-sm text-gray-500">{users.total ?? rows.length} registered accounts</p>
                    </div>

                    <div className="rounded-xl border border-white/8 bg-gray-900/60 overflow-hidden">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-white/8 text-xs uppercase tracking-wider text-gray-600">
                                    <th className="px-4 py-3 text-left font-medium">User</th>
                                    <th className="px-4 py-3 text-left font-medium hidden sm:table-cell">Email</th>
                                    <th className="px-4 py-3 text-left font-medium hidden md:table-cell">Joined</th>
                                    <th className="px-4 py-3 text-right font-medium">Projects</th>
                                    <th className="px-4 py-3 text-right font-medium">Renders</th>
                                    <th className="px-4 py-3 text-right font-medium hidden lg:table-cell">Role</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {rows.map((u) => (
                                    <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                                        <td className="px-4 py-3">
                                            <p className="font-medium text-white">{u.name}</p>
                                            <p className="text-xs text-gray-600 sm:hidden">{u.email}</p>
                                        </td>
                                        <td className="px-4 py-3 text-gray-400 hidden sm:table-cell">{u.email}</td>
                                        <td className="px-4 py-3 hidden md:table-cell">
                                            <span className="text-gray-400">{u.created_at}</span>
                                            <span className="block text-xs text-gray-600">{u.created_ago}</span>
                                        </td>
                                        <td className="px-4 py-3 text-right text-gray-300">{u.projects_count}</td>
                                        <td className="px-4 py-3 text-right text-gray-300">{u.renders_count}</td>
                                        <td className="px-4 py-3 text-right hidden lg:table-cell">
                                            {u.is_admin ? (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border bg-violet-500/15 text-violet-300 border-violet-500/20">
                                                    Admin
                                                </span>
                                            ) : (
                                                <span className="text-xs text-gray-600">User</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {rows.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-600">
                                            No users found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>

                        {pMeta.last_page > 1 && (
                            <div className="border-t border-white/5 px-4 py-3">
                                <Pagination links={pLinks} meta={pMeta} />
                            </div>
                        )}
                    </div>
                </main>
            </AdminLayout>
        </>
    );
}
