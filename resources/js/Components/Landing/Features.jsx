const features = [
    {
        title: 'Automatic Highlight Detection',
        description: 'AI scans audio spikes and motion intensity to find the moments that matter — eliminating hours of manual scrubbing.',
        icon: (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
            </svg>
        ),
        accent: 'violet',
    },
    {
        title: 'Fast Clip Generation',
        description: 'FFmpeg-powered processing cuts and encodes clips in the background. No waiting around — clips are ready as soon as processing finishes.',
        icon: (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        ),
        accent: 'cyan',
    },
    {
        title: 'Optimized for Sharing',
        description: 'Clips are trimmed and exported at share-ready quality. Drop them directly to Twitter, TikTok, or Discord without re-encoding.',
        icon: (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
            </svg>
        ),
        accent: 'fuchsia',
    },
    {
        title: 'Clean Dashboard',
        description: 'Preview clips inline, see highlight scores, and download only the moments worth keeping. Simple by design.',
        icon: (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
            </svg>
        ),
        accent: 'indigo',
    },
];

const accentMap = {
    violet: 'bg-violet-500/10 text-violet-400 group-hover:bg-violet-500/20',
    cyan:   'bg-cyan-500/10 text-cyan-400 group-hover:bg-cyan-500/20',
    fuchsia:'bg-fuchsia-500/10 text-fuchsia-400 group-hover:bg-fuchsia-500/20',
    indigo: 'bg-indigo-500/10 text-indigo-400 group-hover:bg-indigo-500/20',
};

export default function Features() {
    return (
        <section id="features" className="py-24 md:py-32 px-6">
            <div className="mx-auto max-w-6xl">
                {/* Header */}
                <div className="text-center mb-16">
                    <p className="text-xs font-semibold uppercase tracking-widest text-violet-400 mb-3">Features</p>
                    <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
                        Everything you need.<br />Nothing you don't.
                    </h2>
                </div>

                {/* Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {features.map((f, i) => (
                        <div
                            key={i}
                            className="group rounded-2xl border border-white/6 bg-slate-900/50 p-8 hover:border-white/10 hover:bg-slate-900/80 transition-all"
                        >
                            <div className={`inline-flex items-center justify-center w-10 h-10 rounded-lg mb-5 transition-colors ${accentMap[f.accent]}`}>
                                {f.icon}
                            </div>
                            <h3 className="text-base font-semibold text-white mb-2">{f.title}</h3>
                            <p className="text-sm text-gray-400 leading-relaxed">{f.description}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
