import { GlassPanel, IconShell, SectionHeading } from './LandingPrimitives';

const useCases = [
    {
        title: 'FPS players',
        description: 'Turn long Valorant or CS2 sessions into highlight-packed montage cuts without scrubbing through every round.',
        tone: 'violet',
        icon: (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.7" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 7.5V6A3 3 0 0 0 9 6v1.5m6 0h1.5A1.5 1.5 0 0 1 18 9v7.5A1.5 1.5 0 0 1 16.5 18h-9A1.5 1.5 0 0 1 6 16.5V9a1.5 1.5 0 0 1 1.5-1.5H9m6 0H9" />
            </svg>
        ),
    },
    {
        title: 'Streamers',
        description: 'Clip marathon streams into fast social-ready moments for X, TikTok, and Shorts while your full VOD stays untouched.',
        tone: 'cyan',
        icon: (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.7" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25v4.5m4.5-6v10.5m4.5-7.5v4.5M6 19.5h12A1.5 1.5 0 0 0 19.5 18V6A1.5 1.5 0 0 0 18 4.5H6A1.5 1.5 0 0 0 4.5 6v12A1.5 1.5 0 0 0 6 19.5Z" />
            </svg>
        ),
    },
    {
        title: 'Content creators',
        description: 'Build polished recap videos faster with AI-generated first drafts and a lightweight editor for fine-tuning.',
        tone: 'fuchsia',
        icon: (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.7" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6H7.875C6.839 6 6 6.84 6 7.875v8.25C6 17.16 6.84 18 7.875 18h8.25A1.875 1.875 0 0 0 18 16.125V13.5m-7.5-7.5L18 13.5m0 0V8.625A1.875 1.875 0 0 0 16.125 6H10.5Z" />
            </svg>
        ),
    },
    {
        title: 'TikTok editors',
        description: 'Get vertical exports, tempo-aware cuts, text overlays, and effect-ready moments built for short-form performance.',
        tone: 'indigo',
        icon: (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.7" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a3.75 3.75 0 1 0 0-7.5v-6A6.75 6.75 0 1 1 5.25 12" />
            </svg>
        ),
    },
];

export default function UseCases() {
    return (
        <section className="px-6 py-24 md:py-32">
            <div className="mx-auto max-w-7xl">
                <SectionHeading
                    eyebrow="Use cases"
                    title="Built for gamers & creators"
                    description="Whether you are farming clips from ranked sessions or shipping daily short-form content, ClutchClip keeps the workflow fast and professional."
                />

                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                    {useCases.map((useCase) => (
                        <GlassPanel
                            key={useCase.title}
                            className="group h-full p-6 transition-all duration-300 hover:-translate-y-1 hover:border-violet-400/20 hover:bg-white/[0.05]"
                        >
                            <IconShell tone={useCase.tone}>{useCase.icon}</IconShell>
                            <h3 className="mt-5 text-lg font-semibold text-white">{useCase.title}</h3>
                            <p className="mt-3 text-sm leading-7 text-slate-300">{useCase.description}</p>
                        </GlassPanel>
                    ))}
                </div>
            </div>
        </section>
    );
}
