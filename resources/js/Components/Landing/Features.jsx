import { GlassPanel, IconShell, SectionHeading } from './LandingPrimitives';

const features = [
    {
        title: 'AI Highlight Detection',
        description: 'Detects standout kills, clutches, and momentum swings from long gameplay sessions.',
        tone: 'violet',
        icon: (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.7" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m5.25 2.25A8.25 8.25 0 1 1 3.75 12a8.25 8.25 0 0 1 16.5 0Z" />
            </svg>
        ),
    },
    {
        title: 'AI Montage Generator',
        description: 'Sequences top moments into a clean montage structure automatically.',
        tone: 'cyan',
        icon: (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.7" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 7.5h15m-15 4.5h10.5m-10.5 4.5h15" />
            </svg>
        ),
    },
    {
        title: 'Built-in Editor',
        description: 'Trim moments, arrange clips, and refine the timeline without leaving the app.',
        tone: 'fuchsia',
        icon: (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.7" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 6.75h9m-12 4.5h15m-12 4.5h9" />
            </svg>
        ),
    },
    {
        title: 'Slow Motion & Impact Effects',
        description: 'Layer in dramatic pacing, zoom hits, and punchy transitions on the biggest plays.',
        tone: 'indigo',
        icon: (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.7" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l3.75 2.25M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
        ),
    },
    {
        title: 'Drag & Drop Timeline',
        description: 'Reorder clips and effect blocks with a familiar editing workflow that stays lightweight.',
        tone: 'violet',
        icon: (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.7" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 7.5h7.5m-7.5 4.5h7.5m-7.5 4.5h4.5" />
            </svg>
        ),
    },
    {
        title: 'Export for TikTok / Reels / YouTube',
        description: 'Ship vertical or widescreen presets built for the platforms where clips spread fastest.',
        tone: 'cyan',
        icon: (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.7" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5 20.25 6m0 0v4.5m0-4.5h-4.5M8.25 13.5 3.75 18m0 0v-4.5m0 4.5h4.5" />
            </svg>
        ),
    },
    {
        title: 'Built-in Music Library',
        description: 'Drop royalty-friendly tracks into edits and auto-align timing to montage pacing.',
        tone: 'fuchsia',
        icon: (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.7" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 18V6l10.5-1.5v10.5M9 16.5A2.25 2.25 0 1 1 6.75 14.25 2.25 2.25 0 0 1 9 16.5Zm10.5-1.5A2.25 2.25 0 1 1 17.25 12.75 2.25 2.25 0 0 1 19.5 15Z" />
            </svg>
        ),
    },
];

export default function Features() {
    return (
        <section id="features" className="px-6 py-24 md:py-32">
            <div className="mx-auto max-w-7xl">
                <SectionHeading
                    eyebrow="Features"
                    title="Built to make AI-powered clipping feel fast, polished, and pro"
                    description="Everything on the page supports the core promise: turn raw gameplay into viral clips automatically, then fine-tune only when you want to."
                />

                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                    {features.map((feature) => (
                        <GlassPanel
                            key={feature.title}
                            className="group h-full p-6 transition-all duration-300 hover:-translate-y-1 hover:border-violet-400/20 hover:bg-white/[0.05]"
                        >
                            <IconShell tone={feature.tone}>{feature.icon}</IconShell>
                            <h3 className="mt-5 text-lg font-semibold text-white">{feature.title}</h3>
                            <p className="mt-3 text-sm leading-7 text-slate-300">{feature.description}</p>
                        </GlassPanel>
                    ))}
                </div>
            </div>
        </section>
    );
}
