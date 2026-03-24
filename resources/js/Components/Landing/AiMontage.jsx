import { GlassPanel, IconShell, SectionHeading } from './LandingPrimitives';

const cards = [
    {
        title: 'Detect Highlights',
        description: 'Finds kills, clutch swings, and momentum spikes from raw gameplay automatically.',
        tone: 'violet',
        icon: (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.7" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5 10.5 6.75l3.75 3.75 6-6v5.25m0 0H15" />
            </svg>
        ),
    },
    {
        title: 'Auto Edit Clips',
        description: 'Cuts dead space, sequences the best moments, and builds a montage flow for you.',
        tone: 'cyan',
        icon: (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.7" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 8.25 21 4.5 9 15.75m0-7.5L3 4.5l6 11.25m0 0 3 3.75 3-3.75" />
            </svg>
        ),
    },
    {
        title: 'Add Effects',
        description: 'Applies slow motion, zoom hits, impact cuts, and music sync without manual keyframing.',
        tone: 'fuchsia',
        icon: (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.7" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5m6 15V15m-3-3H7.5m9 0H21M6 19.5h12a1.5 1.5 0 0 0 1.5-1.5v-12A1.5 1.5 0 0 0 18 4.5H6A1.5 1.5 0 0 0 4.5 6v12A1.5 1.5 0 0 0 6 19.5Z" />
            </svg>
        ),
    },
    {
        title: 'Export Montage',
        description: 'Sends out vertical or widescreen versions optimized for TikTok, Reels, Shorts, and YouTube.',
        tone: 'indigo',
        icon: (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.7" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 12a.75.75 0 0 1 .75-.75h8.69l-2.72-2.72a.75.75 0 1 1 1.06-1.06l4 4a.75.75 0 0 1 0 1.06l-4 4a.75.75 0 1 1-1.06-1.06l2.72-2.72H7.5A.75.75 0 0 1 6.75 12Z" />
            </svg>
        ),
    },
];

export default function AiMontage() {
    return (
        <section id="ai-montage" className="px-6 py-24 md:py-32">
            <div className="mx-auto max-w-7xl">
                <SectionHeading
                    eyebrow="AI montage generation"
                    title="AI edits your montage for you"
                    description="ClutchClip detects highlights, auto cuts clips, layers in effects, syncs music, and exports a montage that looks polished from the first pass."
                />

                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                    {cards.map((card) => (
                        <GlassPanel
                            key={card.title}
                            className="group relative overflow-hidden p-6 transition-all duration-300 hover:-translate-y-1 hover:border-violet-400/20 hover:bg-white/[0.05]"
                        >
                            <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                            <IconShell tone={card.tone}>{card.icon}</IconShell>
                            <h3 className="mt-5 text-lg font-semibold text-white">{card.title}</h3>
                            <p className="mt-3 text-sm leading-7 text-slate-300">{card.description}</p>

                            <div className="mt-6 overflow-hidden rounded-2xl border border-white/8 bg-slate-950/70 p-3">
                                <div className="flex items-center justify-between text-xs text-slate-400">
                                    <span>Pipeline step</span>
                                    <span className="text-slate-500">Automated</span>
                                </div>
                                <div className="mt-3 h-2 rounded-full bg-white/8">
                                    <div className="h-2 rounded-full bg-gradient-to-r from-violet-400 via-fuchsia-400 to-cyan-400" />
                                </div>
                            </div>
                        </GlassPanel>
                    ))}
                </div>
            </div>
        </section>
    );
}
