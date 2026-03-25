import { useState, useEffect } from 'react';

const STORAGE_KEY = 'clutchclip_onboarded';

const STEPS = [
    {
        number: '01',
        title: 'Upload your gameplay',
        description: 'Drop an MP4, MKV, or WebM file — up to 1.5 GB and 60 minutes long.',
        icon: (
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
        ),
        tone: 'violet',
    },
    {
        number: '02',
        title: 'AI detects highlights',
        description: 'Our model scans your footage and automatically identifies your best clutch moments.',
        icon: (
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h4.5l2.25-6 4.5 12 2.25-6h3" />
            </svg>
        ),
        tone: 'cyan',
    },
    {
        number: '03',
        title: 'Edit your montage',
        description: 'Trim clips, reorder sequences, and add effects in the montage editor.',
        icon: (
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
            </svg>
        ),
        tone: 'fuchsia',
    },
    {
        number: '04',
        title: 'Export your clips',
        description: 'Download a polished montage ready to share on TikTok, YouTube, or anywhere else.',
        icon: (
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3.75v11.5m0 0l4.5-4.5m-4.5 4.5-4.5-4.5m-2.25 7.5h13.5" />
            </svg>
        ),
        tone: 'indigo',
    },
];

const TONE_CLASSES = {
    violet:  { shell: 'bg-violet-500/15 border-violet-500/25 text-violet-400',  dot: 'bg-violet-400' },
    cyan:    { shell: 'bg-cyan-500/15 border-cyan-500/25 text-cyan-400',         dot: 'bg-cyan-400' },
    fuchsia: { shell: 'bg-fuchsia-500/15 border-fuchsia-500/25 text-fuchsia-400', dot: 'bg-fuchsia-400' },
    indigo:  { shell: 'bg-indigo-500/15 border-indigo-500/25 text-indigo-400',   dot: 'bg-indigo-400' },
};

export default function OnboardingModal() {
    const [open, setOpen]       = useState(false);
    const [step, setStep]       = useState(0);

    useEffect(() => {
        if (!localStorage.getItem(STORAGE_KEY)) {
            // Small delay so the page settles before modal appears
            const t = setTimeout(() => setOpen(true), 800);
            return () => clearTimeout(t);
        }
    }, []);

    function dismiss() {
        localStorage.setItem(STORAGE_KEY, '1');
        setOpen(false);
    }

    function next() {
        if (step < STEPS.length - 1) {
            setStep(s => s + 1);
        } else {
            dismiss();
        }
    }

    if (!open) return null;

    const current = STEPS[step];
    const tone    = TONE_CLASSES[current.tone];
    const isLast  = step === STEPS.length - 1;

    return (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={(e) => e.target === e.currentTarget && dismiss()}
        >
            <div className="relative w-full max-w-md rounded-2xl bg-gray-900 border border-white/10 shadow-2xl overflow-hidden">

                {/* Header gradient accent */}
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-400/50 to-transparent" />

                <div className="p-7">

                    {/* Step indicator */}
                    <div className="flex items-center gap-1.5 mb-6">
                        {STEPS.map((_, i) => (
                            <div
                                key={i}
                                className={[
                                    'h-1 rounded-full transition-all duration-300',
                                    i === step
                                        ? 'w-6 bg-violet-400'
                                        : i < step
                                            ? 'w-3 bg-violet-400/40'
                                            : 'w-3 bg-gray-700',
                                ].join(' ')}
                            />
                        ))}
                        <span className="ml-auto text-xs text-gray-600 tabular-nums">
                            {step + 1} / {STEPS.length}
                        </span>
                    </div>

                    {/* Icon */}
                    <div className={`h-12 w-12 rounded-xl border flex items-center justify-center mb-5 ${tone.shell}`}>
                        {current.icon}
                    </div>

                    {/* Content */}
                    <p className="text-xs font-semibold text-gray-600 uppercase tracking-widest mb-2">
                        Step {current.number}
                    </p>
                    <h2 className="text-xl font-bold text-white mb-3">
                        {current.title}
                    </h2>
                    <p className="text-sm text-gray-400 leading-relaxed">
                        {current.description}
                    </p>

                    {/* Actions */}
                    <div className="mt-8 flex items-center gap-3">
                        <button
                            onClick={next}
                            className="flex-1 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-600 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:-translate-y-px transition-all duration-200"
                        >
                            {isLast ? 'Get Started' : 'Next'}
                        </button>
                        <button
                            onClick={dismiss}
                            className="rounded-xl px-4 py-2.5 text-sm text-gray-500 hover:text-gray-300 transition-colors"
                        >
                            Skip
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
}
