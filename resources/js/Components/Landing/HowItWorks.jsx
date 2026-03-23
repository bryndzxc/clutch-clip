const steps = [
    {
        number: '01',
        title: 'Upload Your Footage',
        description: 'Drop in any gameplay recording — up to 1.5 GB. Supports MP4, MKV, WebM, and AVI.',
        icon: (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
        ),
    },
    {
        number: '02',
        title: 'AI Detects Highlights',
        description: 'Our model scans audio intensity and motion peaks to pinpoint every clutch moment.',
        icon: (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
            </svg>
        ),
    },
    {
        number: '03',
        title: 'Download Your Clips',
        description: 'Preview every highlight, download the ones you want, and share instantly.',
        icon: (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
        ),
    },
];

export default function HowItWorks() {
    return (
        <section id="how-it-works" className="py-24 md:py-32 px-6">
            <div className="mx-auto max-w-6xl">
                {/* Header */}
                <div className="text-center mb-16">
                    <p className="text-xs font-semibold uppercase tracking-widest text-violet-400 mb-3">Process</p>
                    <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
                        From footage to highlights<br />in three steps.
                    </h2>
                </div>

                {/* Steps */}
                <div className="relative grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Connecting line (desktop only) */}
                    <div className="hidden md:block absolute top-10 left-1/6 right-1/6 h-px bg-gradient-to-r from-transparent via-violet-500/30 to-transparent" />

                    {steps.map((step, i) => (
                        <div
                            key={i}
                            className="relative rounded-2xl border border-white/6 bg-slate-900/50 p-8 hover:border-violet-500/30 transition-colors group"
                        >
                            {/* Number */}
                            <span className="text-5xl font-black text-white/5 absolute top-6 right-6 select-none">
                                {step.number}
                            </span>

                            {/* Icon */}
                            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-violet-500/10 text-violet-400 mb-6 group-hover:bg-violet-500/20 transition-colors">
                                {step.icon}
                            </div>

                            <h3 className="text-lg font-semibold text-white mb-2">{step.title}</h3>
                            <p className="text-sm text-gray-400 leading-relaxed">{step.description}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
