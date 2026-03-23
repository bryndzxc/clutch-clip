export default function Hero() {
    return (
        <section className="relative min-h-screen flex flex-col items-center justify-center px-6 pt-28 pb-24 text-center overflow-hidden">
            {/* Ambient glow */}
            <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full bg-violet-700/10 blur-3xl" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-cyan-600/5 blur-2xl" />
            </div>

            {/* Badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/25 bg-violet-500/10 px-4 py-1.5 text-xs font-medium text-violet-300 mb-8">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
                AI-Powered Highlight Detection
            </div>

            {/* Headline */}
            <h1 className="max-w-3xl text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-white leading-[1.1]">
                Your best moments,{' '}
                <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-cyan-400 bg-clip-text text-transparent">
                    clipped automatically.
                </span>
            </h1>

            <p className="mt-6 max-w-xl text-lg text-gray-400 leading-relaxed">
                Drop in your gameplay footage. ClutchClip's AI scans every second, detects peak moments, and exports share-ready clips — no editing required.
            </p>

            {/* CTAs */}
            <div className="mt-10 flex flex-col sm:flex-row items-center gap-4">
                <a
                    href="/upload"
                    className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold px-8 py-3.5 rounded-xl text-sm transition-all shadow-lg shadow-violet-500/25"
                >
                    Generate Highlights — Free
                </a>
                <a
                    href="#how-it-works"
                    className="group flex items-center gap-2 text-sm font-medium text-gray-400 hover:text-white transition-colors"
                >
                    See how it works
                    <svg className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                    </svg>
                </a>
            </div>

            {/* Hero mockup */}
            <div className="mt-20 w-full max-w-4xl">
                <div className="rounded-2xl border border-white/8 bg-slate-900/60 shadow-2xl shadow-black/50 overflow-hidden">
                    {/* Fake window chrome */}
                    <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 bg-slate-950/60">
                        <span className="w-3 h-3 rounded-full bg-red-500/60" />
                        <span className="w-3 h-3 rounded-full bg-yellow-500/60" />
                        <span className="w-3 h-3 rounded-full bg-green-500/60" />
                        <span className="ml-4 flex-1 text-xs text-gray-600 font-mono">clutchclip.app/results</span>
                    </div>

                    {/* Fake results UI */}
                    <div className="p-6">
                        {/* Status bar */}
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <p className="text-xs text-gray-500 mb-1">Processed</p>
                                <p className="text-sm font-medium text-white">ranked_match_vod.mp4</p>
                            </div>
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400 bg-emerald-400/10 px-3 py-1 rounded-full border border-emerald-400/20">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                6 clips found
                            </span>
                        </div>

                        {/* Clip cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {[
                                { label: 'Highlight #1', time: '0:14', score: 94 },
                                { label: 'Highlight #2', time: '0:22', score: 87 },
                                { label: 'Highlight #3', time: '0:09', score: 81 },
                            ].map((clip, i) => (
                                <div key={i} className="rounded-xl border border-white/6 bg-slate-950/60 p-4 flex flex-col gap-3">
                                    {/* Fake thumbnail */}
                                    <div className="rounded-lg bg-gradient-to-br from-violet-900/40 to-slate-900 h-20 flex items-center justify-center">
                                        <svg className="w-8 h-8 text-violet-400/60" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M8 5.14v14l11-7-11-7z" />
                                        </svg>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-xs font-medium text-white">{clip.label}</p>
                                            <p className="text-xs text-gray-500">{clip.time}</p>
                                        </div>
                                        <span className="text-xs font-bold text-cyan-400">{clip.score}%</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
