import { usePage, router } from '@inertiajs/react';
import { useState } from 'react';
import FeedbackModal from '../FeedbackModal';

const NAV = [
    { key: 'upload', label: 'Dashboard', href: '/upload' },
    { key: 'history', label: 'History', href: '/history' },
    { key: 'projects', label: 'Projects', href: '/montage-projects' },
    { key: 'montages', label: 'Montages', href: '/montages' },
    { key: 'settings', label: 'Settings', href: '/settings' },
];

const NAV_ICONS = {
    upload: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25zM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25z" />
        </svg>
    ),
    history: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
        </svg>
    ),
    projects: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-8.25A2.25 2.25 0 0 0 17.25 3.75H6.75A2.25 2.25 0 0 0 4.5 6v12A2.25 2.25 0 0 0 6.75 20.25h6.75m-6-12h9m-9 4.5h5.25m2.25 5.25 2.25 2.25 4.5-4.5" />
        </svg>
    ),
    montages: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9A2.25 2.25 0 0 0 13.5 5.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
        </svg>
    ),
    settings: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" />
        </svg>
    ),
};

function Avatar({ user }) {
    const [broken, setBroken] = useState(false);
    const initials = user?.name
        ? user.name.split(' ').map((part) => part[0]).join('').toUpperCase().slice(0, 2)
        : '?';

    if (user?.avatar && !broken) {
        return (
            <img
                src={user.avatar}
                alt={user.name}
                onError={() => setBroken(true)}
                className="h-8 w-8 rounded-full object-cover ring-1 ring-white/10"
            />
        );
    }

    return (
        <div className="flex h-8 w-8 select-none items-center justify-center rounded-full border border-violet-500/30 bg-violet-500/20 text-xs font-semibold text-violet-300">
            {initials}
        </div>
    );
}

export default function DashboardHeader({ active = 'upload' }) {
    const { auth } = usePage().props;
    const user = auth?.user;
    const isAdmin = user?.is_admin ?? false;
    const [feedbackOpen, setFeedbackOpen] = useState(false);

    function handleLogout(event) {
        event.preventDefault();
        router.post('/logout');
    }

    return (
        <>
            <header className="sticky top-0 z-40 border-b border-white/5 bg-gray-950/90 backdrop-blur-md">
                <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
                    <a href="/upload" className="shrink-0 flex items-center">
                        <picture>
                            <source srcSet="/storage/light_version_logo.png" media="(prefers-color-scheme: light)" />
                            <img
                                src="/storage/main_logo.png"
                                alt="ClutchClip"
                                className="h-7 w-auto object-contain"
                            />
                        </picture>
                    </a>

                    <nav className="hidden items-center gap-1 md:flex">
                        {NAV.map(({ key, label, href }) => (
                            <a
                                key={key}
                                href={href}
                                className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${
                                    active === key
                                        ? 'bg-white/10 text-white shadow-sm shadow-violet-500/25'
                                        : 'text-gray-400 hover:bg-white/5 hover:text-white'
                                }`}
                            >
                                {label}
                            </a>
                        ))}
                        {isAdmin && (
                            <a
                                href="/admin"
                                className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${
                                    active === 'admin'
                                        ? 'bg-violet-500/20 text-violet-300 shadow-sm shadow-violet-500/25'
                                        : 'text-violet-400 hover:bg-violet-500/10 hover:text-violet-300'
                                }`}
                            >
                                Admin
                            </a>
                        )}
                    </nav>

                    <div className="flex shrink-0 items-center gap-2.5">
                        <Avatar user={user} />

                        <span className="hidden max-w-[140px] truncate text-sm text-gray-400 sm:block">
                            {user?.name}
                        </span>

                        <button
                            onClick={() => setFeedbackOpen(true)}
                            className="hidden sm:flex items-center gap-1 ml-1 rounded-md border border-white/10 px-2.5 py-1 text-xs text-gray-500 transition-colors hover:border-white/20 hover:text-gray-300"
                            title="Send feedback"
                        >
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                            </svg>
                            Feedback
                        </button>

                        <button
                            onClick={handleLogout}
                            className="ml-1 rounded-md border border-white/10 px-2.5 py-1 text-xs text-gray-500 transition-colors hover:border-white/20 hover:text-gray-300"
                        >
                            Sign out
                        </button>
                    </div>
                </div>
            </header>

            <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/8 bg-gray-950/95 backdrop-blur-md md:hidden">
                <div className="flex items-center justify-around">
                    {NAV.map(({ key, label, href }) => (
                        <a
                            key={key}
                            href={href}
                            className={`relative flex flex-1 flex-col items-center gap-1 py-3 transition-all duration-150 ${
                                active === key ? 'text-violet-400' : 'text-gray-500 active:text-gray-300'
                            }`}
                        >
                            {active === key && (
                                <span className="absolute left-1/2 top-0 h-0.5 w-8 -translate-x-1/2 rounded-full bg-violet-400" />
                            )}
                            {NAV_ICONS[key]}
                            <span className="text-[10px] font-medium tracking-wide">{label}</span>
                        </a>
                    ))}
                </div>
            </nav>
            <FeedbackModal
                open={feedbackOpen}
                onClose={() => setFeedbackOpen(false)}
                defaultPage={typeof window !== 'undefined' ? window.location.pathname : ''}
            />
        </>
    );
}
