import { useState } from 'react';

const faqs = [
    {
        q: 'What video formats does ClutchClip support?',
        a: 'MP4, WebM, MKV, and AVI. Most recording software and console capture cards output one of these formats natively.',
    },
    {
        q: 'How large can my video file be?',
        a: 'Up to 1.5 GB per upload. For long recording sessions, we recommend trimming to the relevant match or session before uploading.',
    },
    {
        q: 'How does the AI decide what counts as a highlight?',
        a: 'The model analyzes audio intensity (e.g., gunfire, callouts, crowd noise) and frame-to-frame motion differences. Moments with combined spikes above a threshold are extracted as clips.',
    },
    {
        q: 'How long does processing take?',
        a: 'Typically 1–3 minutes for a standard match VOD depending on length and server load. You can watch clips appear in real time as the job completes.',
    },
    {
        q: 'Can I use ClutchClip for any game?',
        a: "Yes — it's game-agnostic. Valorant, CS2, Apex, Warzone, Rocket League, you name it. If there's audio and motion, the AI can find the peaks.",
    },
    {
        q: 'Are my videos stored permanently?',
        a: 'Videos and clips are stored temporarily for processing and download. We do not use your footage for training or share it with third parties.',
    },
];

function FAQItem({ q, a }) {
    const [open, setOpen] = useState(false);
    return (
        <div className="border-b border-white/6 last:border-0">
            <button
                onClick={() => setOpen(!open)}
                className="w-full flex items-center justify-between py-5 text-left group"
            >
                <span className="text-sm font-medium text-white group-hover:text-violet-300 transition-colors pr-6">
                    {q}
                </span>
                <svg
                    className={`w-4 h-4 text-gray-500 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
            </button>
            {open && (
                <p className="pb-5 text-sm text-gray-400 leading-relaxed">
                    {a}
                </p>
            )}
        </div>
    );
}

export default function FAQ() {
    return (
        <section id="faq" className="py-24 md:py-32 px-6">
            <div className="mx-auto max-w-2xl">
                <div className="text-center mb-12">
                    <p className="text-xs font-semibold uppercase tracking-widest text-violet-400 mb-3">FAQ</p>
                    <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
                        Common questions.
                    </h2>
                </div>

                <div className="rounded-2xl border border-white/6 bg-slate-900/50 px-8">
                    {faqs.map((item, i) => (
                        <FAQItem key={i} q={item.q} a={item.a} />
                    ))}
                </div>
            </div>
        </section>
    );
}
