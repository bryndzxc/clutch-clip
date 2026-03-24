import { usePage } from '@inertiajs/react';

export default function LandingFooter() {
    const { auth } = usePage().props;
    const primaryCtaHref = auth.user ? '/upload' : '/register';

    return (
        <footer className="border-t border-white/8 px-6 py-12">
            <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 sm:flex-row">
                <a href="/" className="text-lg font-semibold tracking-tight text-white">
                    <span className="text-violet-300">Clutch</span>
                    Clip
                </a>

                <nav className="flex flex-wrap items-center justify-center gap-6">
                    <a href="#how-it-works" className="text-sm text-slate-400 transition-colors hover:text-white">
                        How it works
                    </a>
                    <a href="#features" className="text-sm text-slate-400 transition-colors hover:text-white">
                        Features
                    </a>
                    <a href="#editor-preview" className="text-sm text-slate-400 transition-colors hover:text-white">
                        Editor
                    </a>
                    <a href="#faq" className="text-sm text-slate-400 transition-colors hover:text-white">
                        FAQ
                    </a>
                    <a href={primaryCtaHref} className="text-sm text-slate-400 transition-colors hover:text-white">
                        Try Free
                    </a>
                </nav>

                <p className="text-xs text-slate-500">&copy; {new Date().getFullYear()} ClutchClip. All rights reserved.</p>
            </div>
        </footer>
    );
}
