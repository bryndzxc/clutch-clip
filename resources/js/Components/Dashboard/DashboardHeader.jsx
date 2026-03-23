import { usePage, router } from '@inertiajs/react';
import { useState } from 'react';

const NAV = [
    { key: 'upload',   label: 'Dashboard', href: '/upload' },
    { key: 'history',  label: 'History',   href: '/history' },
    { key: 'montages', label: 'Montages',  href: '/montages' },
    { key: 'settings', label: 'Settings',  href: '/settings' },
];

// Icons for the mobile bottom navigation bar
const NAV_ICONS = {
    upload: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
        </svg>
    ),
    history: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
    ),
    montages: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9A2.25 2.25 0 0 0 13.5 5.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
        </svg>
    ),
    settings: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
    ),
};

function Avatar({ user }) {
    const [broken, setBroken] = useState(false);
    const initials = user?.name
        ? user.name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)
        : '?';

    if (user?.avatar && !broken) {
        return (
            <img
                src={user.avatar}
                alt={user.name}
                onError={() => setBroken(true)}
                className="h-8 w-8 rounded-full ring-1 ring-white/10 object-cover"
            />
        );
    }

    return (
        <div className="h-8 w-8 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-xs font-semibold text-violet-300 select-none">
            {initials}
        </div>
    );
}

export default function DashboardHeader({ active = 'upload' }) {
    const { auth } = usePage().props;
    const user = auth?.user;

    function handleLogout(e) {
        e.preventDefault();
        router.post('/logout');
    }

    return (
    <>
        <header className="sticky top-0 z-40 border-b border-white/5 bg-gray-950/90 backdrop-blur-md">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 py-3 flex items-center justify-between gap-4">

                {/* Logo */}
                <a href="/upload" className="text-xl font-bold tracking-tight shrink-0">
                    <span className="text-violet-400">Clutch</span>
                    <span className="text-white">Clip</span>
                </a>

                {/* Nav */}
                <nav className="hidden md:flex items-center gap-1">
                    {NAV.map(({ key, label, href }) => (
                        <a
                            key={key}
                            href={href}
                            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                active === key
                                    ? 'bg-white/10 text-white shadow-sm shadow-violet-500/25'
                                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                            }`}
                        >
                            {label}
                        </a>
                    ))}
                </nav>

                {/* User area */}
                <div className="flex items-center gap-2.5 shrink-0">
                    <Avatar user={user} />

                    <span className="hidden sm:block text-sm text-gray-400 max-w-[140px] truncate">
                        {user?.name}
                    </span>

                    <button
                        onClick={handleLogout}
                        className="ml-1 text-xs text-gray-500 hover:text-gray-300 transition-colors px-2.5 py-1 rounded-md border border-white/10 hover:border-white/20"
                    >
                        Sign out
                    </button>
                </div>

            </div>
        </header>

        {/* ── Mobile bottom navigation ─────────────────────────────────── */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-gray-950/95 backdrop-blur-md border-t border-white/8">
            <div className="flex items-center justify-around">
                {NAV.map(({ key, label, href }) => (
                    <a
                        key={key}
                        href={href}
                        className={`relative flex flex-col items-center gap-1 flex-1 py-3 transition-all duration-150 ${
                            active === key
                                ? 'text-violet-400'
                                : 'text-gray-500 active:text-gray-300'
                        }`}
                    >
                        {/* Active top-bar indicator */}
                        {active === key && (
                            <span className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-full bg-violet-400" />
                        )}
                        {NAV_ICONS[key]}
                        <span className="text-[10px] font-medium tracking-wide">{label}</span>
                    </a>
                ))}
            </div>
        </nav>
    </>
    );
}
