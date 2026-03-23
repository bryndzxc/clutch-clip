import { usePage, router } from '@inertiajs/react';

export default function Navbar() {
    const { auth } = usePage().props;

    function handleLogout(e) {
        e.preventDefault();
        router.post('/logout');
    }

    return (
        <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-gray-950/80 backdrop-blur-md">
            <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
                <a href="/" className="text-xl font-bold tracking-tight">
                    <span className="text-violet-400">Clutch</span>
                    <span className="text-white">Clip</span>
                </a>
                <div className="flex items-center gap-6">
                    <a href="#how-it-works" className="hidden sm:block text-sm text-gray-400 hover:text-white transition-colors">
                        How it works
                    </a>
                    <a href="#features" className="hidden sm:block text-sm text-gray-400 hover:text-white transition-colors">
                        Features
                    </a>
                    {auth.user ? (
                        <div className="flex items-center gap-3">
                            <a
                                href="/upload"
                                className="hidden sm:block text-sm text-gray-400 hover:text-white transition-colors"
                            >
                                Dashboard
                            </a>
                            <button
                                onClick={handleLogout}
                                className="text-sm text-gray-400 hover:text-white transition-colors"
                            >
                                Sign out
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-3">
                            <a
                                href="/login"
                                className="text-sm text-gray-400 hover:text-white transition-colors"
                            >
                                Sign in
                            </a>
                            <a
                                href="/register"
                                className="bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-all duration-200 shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:-translate-y-px"
                            >
                                Try Free
                            </a>
                        </div>
                    )}
                </div>
            </div>
        </nav>
    );
}
