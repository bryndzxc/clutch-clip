import { router, usePage } from '@inertiajs/react';

export default function Navbar({ onOpenAuthModal }) {
    const { auth } = usePage().props;

    function handleLogout(event) {
        event.preventDefault();
        router.post('/logout');
    }

    return (
        <nav className="fixed inset-x-0 top-0 z-50 border-b border-white/8 bg-gray-950/70 backdrop-blur-xl">
            <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
                <a href="/" className="flex items-center">
                    <picture>
                        <source srcSet="/light_version_logo.png" media="(prefers-color-scheme: light)" />
                        <img
                            src="/main_logo.png"
                            alt="ClutchClip"
                            className="h-8 w-auto object-contain"
                        />
                    </picture>
                </a>

                <div className="hidden items-center gap-8 md:flex">
                    <a href="#how-it-works" className="text-sm text-slate-300 transition-colors hover:text-white">
                        How it works
                    </a>
                    <a href="#features" className="text-sm text-slate-300 transition-colors hover:text-white">
                        Features
                    </a>
                </div>

                {auth.user ? (
                    <div className="flex items-center gap-3">
                        <a href="/upload" className="hidden text-sm text-slate-300 transition-colors hover:text-white sm:block">
                            Dashboard
                        </a>
                        <button onClick={handleLogout} className="text-sm text-slate-300 transition-colors hover:text-white">
                            Sign out
                        </button>
                        <a
                            href="/upload"
                            className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-violet-500 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(124,58,237,0.25)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(124,58,237,0.35)]"
                        >
                            Try Free
                        </a>
                    </div>
                ) : (
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => onOpenAuthModal?.('login')}
                            className="text-sm text-slate-300 transition-colors hover:text-white"
                        >
                            Sign in
                        </button>
                        <button
                            type="button"
                            onClick={() => onOpenAuthModal?.('register')}
                            className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-violet-500 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(124,58,237,0.25)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(124,58,237,0.35)]"
                        >
                            Try Free
                        </button>
                    </div>
                )}
            </div>
        </nav>
    );
}
