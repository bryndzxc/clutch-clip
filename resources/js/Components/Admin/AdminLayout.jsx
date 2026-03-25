import DashboardHeader from '../Dashboard/DashboardHeader';

const ADMIN_NAV = [
    { key: 'dashboard', label: 'Overview', href: '/admin' },
    { key: 'users',     label: 'Users',    href: '/admin/users' },
    { key: 'feedback',  label: 'Feedback', href: '/admin/feedback' },
];

export default function AdminLayout({ children, active }) {
    return (
        <>
            <DashboardHeader active="admin" />
            <div className="border-b border-white/5 bg-gray-950">
                <div className="mx-auto max-w-7xl px-4 sm:px-6">
                    <nav className="flex gap-0 -mb-px">
                        {ADMIN_NAV.map(({ key, label, href }) => (
                            <a
                                key={key}
                                href={href}
                                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                                    active === key
                                        ? 'border-violet-500 text-white'
                                        : 'border-transparent text-gray-500 hover:text-gray-300 hover:border-white/20'
                                }`}
                            >
                                {label}
                            </a>
                        ))}
                    </nav>
                </div>
            </div>
            {children}
        </>
    );
}
