export default function LandingFooter() {
    return (
        <footer className="border-t border-white/5 py-12 px-6">
            <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-6">
                {/* Brand */}
                <a href="/" className="text-lg font-bold tracking-tight">
                    <span className="text-violet-400">Clutch</span>
                    <span className="text-white">Clip</span>
                </a>

                {/* Links */}
                <nav className="flex items-center gap-6">
                    <a href="#how-it-works" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
                        How it works
                    </a>
                    <a href="#features" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
                        Features
                    </a>
                    <a href="#faq" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
                        FAQ
                    </a>
                    <a href="/upload" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
                        Upload
                    </a>
                </nav>

                <p className="text-xs text-gray-600">
                    &copy; {new Date().getFullYear()} ClutchClip. All rights reserved.
                </p>
            </div>
        </footer>
    );
}
