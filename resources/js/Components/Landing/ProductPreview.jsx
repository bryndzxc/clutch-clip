const clips = [
    { label: 'Highlight #1', game: 'Valorant', duration: '0:14', score: 94, color: 'from-violet-600/30 to-slate-900' },
    { label: 'Highlight #2', game: 'Valorant', duration: '0:22', score: 87, color: 'from-cyan-700/30 to-slate-900' },
    { label: 'Highlight #3', game: 'Valorant', duration: '0:09', score: 81, color: 'from-fuchsia-700/30 to-slate-900' },
    { label: 'Highlight #4', game: 'Valorant', duration: '0:17', score: 76, color: 'from-indigo-700/30 to-slate-900' },
];

function ScoreBadge({ score }) {
    const color = score >= 90 ? 'text-emerald-400 border-emerald-400/20 bg-emerald-400/10'
                : score >= 80 ? 'text-cyan-400 border-cyan-400/20 bg-cyan-400/10'
                : 'text-violet-400 border-violet-400/20 bg-violet-400/10';
    return (
        <span className={`text-xs font-bold border rounded-full px-2 py-0.5 ${color}`}>
            {score}%
        </span>
    );
}

export default function ProductPreview() {
    return (
        <section className="py-24 md:py-32 px-6">
            <div className="mx-auto max-w-6xl">
                {/* Header */}
                <div className="text-center mb-16">
                    <p className="text-xs font-semibold uppercase tracking-widest text-violet-400 mb-3">Dashboard</p>
                    <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
                        Your clips, ready to go.
                    </h2>
                    <p className="mt-4 text-gray-400 text-base max-w-md mx-auto">
                        A clean results view shows each highlight ranked by intensity score.
                    </p>
                </div>

                {/* Mock dashboard */}
                <div className="rounded-2xl border border-white/8 bg-slate-900/60 overflow-hidden shadow-2xl shadow-black/40">
                    {/* Top bar */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-slate-950/50">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center">
                                <svg className="w-4 h-4 text-violet-400" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-white">ranked_match_vod.mp4</p>
                                <p className="text-xs text-gray-500">2h 14m &middot; 1.1 GB</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400 bg-emerald-400/10 px-3 py-1 rounded-full border border-emerald-400/20">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                Complete
                            </span>
                        </div>
                    </div>

                    {/* Clip grid */}
                    <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {clips.map((clip, i) => (
                            <div key={i} className="rounded-xl border border-white/6 bg-slate-950/60 overflow-hidden hover:border-violet-500/25 transition-colors group cursor-pointer">
                                {/* Thumbnail area */}
                                <div className={`relative h-24 bg-gradient-to-br ${clip.color} flex items-center justify-center`}>
                                    <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-colors">
                                        <svg className="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M8 5.14v14l11-7-11-7z" />
                                        </svg>
                                    </div>
                                    <span className="absolute bottom-2 right-2 text-xs text-white/60 font-mono">{clip.duration}</span>
                                </div>

                                {/* Info */}
                                <div className="p-3 flex items-center justify-between">
                                    <div>
                                        <p className="text-xs font-semibold text-white">{clip.label}</p>
                                        <p className="text-xs text-gray-500">{clip.game}</p>
                                    </div>
                                    <ScoreBadge score={clip.score} />
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Bottom bar */}
                    <div className="flex items-center justify-between px-6 py-4 border-t border-white/5 bg-slate-950/30">
                        <p className="text-xs text-gray-500">4 highlights detected &middot; 1:02 total</p>
                        <button className="text-xs font-semibold text-white bg-violet-600 hover:bg-violet-500 px-4 py-1.5 rounded-lg transition-colors">
                            Download All
                        </button>
                    </div>
                </div>
            </div>
        </section>
    );
}
