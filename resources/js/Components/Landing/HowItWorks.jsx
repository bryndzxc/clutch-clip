import { GlassPanel, IconShell, SectionHeading } from './LandingPrimitives';

const steps = [
    {
        step: '01',
        title: 'Upload Gameplay',
        description: 'Drop in your raw gameplay footage and let ClutchClip start processing immediately.',
        tone: 'violet',
        icon: (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.7" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V3.75m0 0-4.5 4.5M12 3.75l4.5 4.5M3.75 15.75v2.25A2.25 2.25 0 0 0 6 20.25h12A2.25 2.25 0 0 0 20.25 18v-2.25" />
            </svg>
        ),
    },
    {
        step: '02',
        title: 'AI Finds Highlights',
        description: 'The model scores your footage, detects standout moments, and assembles the strongest sequence.',
        tone: 'cyan',
        icon: (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.7" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h4.5l2.25-6 4.5 12 2.25-6h3" />
            </svg>
        ),
    },
    {
        step: '03',
        title: 'Download Your Montage',
        description: 'Preview the edit, make quick tweaks if you want, and export a ready-to-share final cut.',
        tone: 'fuchsia',
        icon: (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.7" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3.75v11.5m0 0 4.5-4.5m-4.5 4.5-4.5-4.5m-2.25 7.5h13.5" />
            </svg>
        ),
    },
];

export default function HowItWorks() {
    return (
        <section id="how-it-works" className="px-6 py-24 md:py-32">
            <div className="mx-auto max-w-7xl">
                <SectionHeading
                    eyebrow="How it works"
                    title="Three steps from raw footage to finished montage"
                    description="No complex workflow. Upload your session, let the AI build the first edit, then download a clip package or a polished montage."
                />

                <div className="relative grid gap-5 lg:grid-cols-3">
                    <div className="pointer-events-none absolute left-[16.5%] right-[16.5%] top-10 hidden h-px bg-gradient-to-r from-transparent via-violet-400/30 to-transparent lg:block" />

                    {steps.map((step) => (
                        <GlassPanel
                            key={step.step}
                            className="group relative overflow-hidden p-6 transition-all duration-300 hover:-translate-y-1 hover:border-violet-400/20 hover:bg-white/[0.05]"
                        >
                            <span className="absolute right-6 top-6 text-5xl font-semibold tracking-tight text-white/6">
                                {step.step}
                            </span>
                            <IconShell tone={step.tone}>{step.icon}</IconShell>
                            <h3 className="mt-5 text-xl font-semibold text-white">{step.title}</h3>
                            <p className="mt-3 text-sm leading-7 text-slate-300">{step.description}</p>
                        </GlassPanel>
                    ))}
                </div>
            </div>
        </section>
    );
}
