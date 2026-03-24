import { usePage } from '@inertiajs/react';
import { GlassPanel, GridGlow } from './LandingPrimitives';

const previewClips = [
    { title: 'Ace clutch', tag: 'Auto clipped', duration: '00:17', tone: 'from-violet-500/30 to-cyan-400/10' },
    { title: 'Operator flick', tag: 'Slow motion', duration: '00:09', tone: 'from-fuchsia-500/25 to-violet-500/10' },
    { title: 'Triple spray', tag: 'Zoom impact', duration: '00:12', tone: 'from-cyan-500/25 to-indigo-500/10' },
];

export default function Hero({ onOpenAuthModal }) {
    const { auth } = usePage().props;
    const primaryCtaHref = auth.user ? '/upload' : null;

    return (
        <section className="relative overflow-hidden px-6 pb-24 pt-32 md:pb-32 md:pt-40">
            <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(124,58,237,0.22),transparent_32%),radial-gradient(circle_at_80%_25%,rgba(34,211,238,0.14),transparent_25%),linear-gradient(135deg,rgba(76,29,149,0.12),rgba(2,6,23,0))]" />
                <div className="absolute left-1/2 top-24 h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-violet-600/12 blur-3xl animate-float-soft" />
                <div className="absolute right-10 top-32 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl animate-float-soft-delayed" />
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:90px_90px] [mask-image:radial-gradient(circle_at_center,black,transparent_80%)]" />
            </div>

            <div className="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[1.05fr_0.95fr]">
                <div className="animate-fade-up">
                    <div className="inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-500/10 px-4 py-1.5 text-xs font-medium text-violet-200 shadow-[0_0_30px_rgba(124,58,237,0.15)]">
                        <span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(103,232,249,0.9)]" />
                        AI Highlight Detector + Montage Generator
                    </div>

                    <h1 className="mt-8 max-w-4xl text-5xl font-semibold leading-[1.02] tracking-tight text-white md:text-6xl lg:text-7xl">
                        Turn your best moments into{' '}
                        <span className="bg-gradient-to-r from-violet-300 via-fuchsia-300 to-cyan-300 bg-clip-text text-transparent">
                            viral clips
                        </span>{' '}
                        &mdash; automatically.
                    </h1>

                    <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300 md:text-xl">
                        Upload your gameplay. ClutchClip detects highlights, edits your montage, and exports ready-to-share clips in seconds.
                    </p>

                    <div className="mt-10 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                        {auth.user ? (
                            <a
                                href={primaryCtaHref}
                                className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-violet-500 via-violet-600 to-indigo-600 px-7 py-3.5 text-sm font-semibold text-white shadow-[0_16px_50px_rgba(124,58,237,0.35)] transition-all duration-300 hover:-translate-y-0.5 hover:scale-[1.01] hover:shadow-[0_20px_60px_rgba(124,58,237,0.45)]"
                            >
                                Generate Montage &mdash; Free
                            </a>
                        ) : (
                            <button
                                type="button"
                                onClick={() => onOpenAuthModal?.('register')}
                                className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-violet-500 via-violet-600 to-indigo-600 px-7 py-3.5 text-sm font-semibold text-white shadow-[0_16px_50px_rgba(124,58,237,0.35)] transition-all duration-300 hover:-translate-y-0.5 hover:scale-[1.01] hover:shadow-[0_20px_60px_rgba(124,58,237,0.45)]"
                            >
                                Generate Montage &mdash; Free
                            </button>
                        )}
                        <a
                            href="#editor-preview"
                            className="inline-flex items-center gap-2 rounded-2xl border border-white/12 bg-white/5 px-6 py-3.5 text-sm font-medium text-slate-100 transition-all duration-300 hover:border-violet-400/30 hover:bg-white/8 hover:text-white"
                        >
                            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/8">
                                <svg className="ml-0.5 h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                    <path d="M6 4.5v11l9-5.5-9-5.5Z" />
                                </svg>
                            </span>
                            Watch Demo
                        </a>
                    </div>

                    <div className="mt-10 flex flex-wrap items-center gap-3 text-sm text-slate-300">
                        {['Detects highlights instantly', 'Auto-syncs effects and music', 'Exports for TikTok, Reels, YouTube'].map((item) => (
                            <div key={item} className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2">
                                {item}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="animate-fade-up-2">
                    <GlassPanel className="relative overflow-hidden p-3">
                        <GridGlow />

                        <div className="rounded-[1.4rem] border border-white/8 bg-slate-950/85 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                            <div className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                                <div className="flex items-center gap-3">
                                    <div className="flex gap-1.5">
                                        <span className="h-2.5 w-2.5 rounded-full bg-rose-400/80" />
                                        <span className="h-2.5 w-2.5 rounded-full bg-amber-300/80" />
                                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-white">Montage Studio</p>
                                        <p className="text-xs text-slate-400">ranked_session.mp4</p>
                                    </div>
                                </div>
                                <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-300">
                                    Ready to export
                                </div>
                            </div>

                            <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                                <div className="rounded-[1.5rem] border border-white/8 bg-gradient-to-br from-violet-500/12 via-slate-950 to-cyan-500/8 p-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-medium text-white">Live montage preview</p>
                                            <p className="text-xs text-slate-400">AI sequence assembled in 12s</p>
                                        </div>
                                        <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                                            1080p vertical
                                        </div>
                                    </div>

                                    <div className="mt-4 rounded-[1.4rem] border border-white/8 bg-[radial-gradient(circle_at_top,rgba(124,58,237,0.25),transparent_40%),linear-gradient(160deg,rgba(15,23,42,0.9),rgba(2,6,23,0.95))] p-5">
                                        <div className="relative aspect-[16/11] overflow-hidden rounded-[1.2rem] border border-white/8 bg-slate-950">
                                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(34,211,238,0.18),transparent_25%),radial-gradient(circle_at_30%_80%,rgba(217,70,239,0.14),transparent_25%)]" />
                                            <div className="absolute inset-x-6 top-6 flex items-center justify-between">
                                                <div className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-white/80">
                                                    Highlight score 96
                                                </div>
                                                <div className="rounded-full border border-violet-400/20 bg-violet-400/10 px-3 py-1 text-xs text-violet-200">
                                                    Auto zoom + impact
                                                </div>
                                            </div>
                                            <div className="absolute inset-x-0 bottom-0 p-6">
                                                <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 backdrop-blur-sm">
                                                    <div className="flex items-center justify-between text-xs text-slate-300">
                                                        <span>Timeline</span>
                                                        <span>Music sync: On beat</span>
                                                    </div>
                                                    <div className="mt-3 flex gap-2">
                                                        <div className="h-3 flex-1 rounded-full bg-violet-400/70" />
                                                        <div className="h-3 w-20 rounded-full bg-cyan-400/70" />
                                                        <div className="h-3 w-14 rounded-full bg-fuchsia-400/70" />
                                                        <div className="h-3 flex-1 rounded-full bg-white/10" />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="rounded-[1.5rem] border border-white/8 bg-white/[0.03] p-4">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-sm font-medium text-white">Clips generated</p>
                                                <p className="text-xs text-slate-400">Best moments, ready to post</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-lg font-semibold text-white">06</p>
                                                <p className="text-xs text-slate-500">viral-ready cuts</p>
                                            </div>
                                        </div>

                                        <div className="mt-4 space-y-3">
                                            {previewClips.map((clip) => (
                                                <div
                                                    key={clip.title}
                                                    className="group rounded-2xl border border-white/8 bg-slate-950/70 p-3 transition-all duration-300 hover:border-violet-400/25 hover:bg-slate-950"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className={`h-14 w-20 rounded-xl bg-gradient-to-br ${clip.tone} ring-1 ring-white/10`} />
                                                        <div className="flex-1">
                                                            <p className="text-sm font-medium text-white">{clip.title}</p>
                                                            <p className="text-xs text-slate-400">{clip.tag}</p>
                                                        </div>
                                                        <span className="text-xs font-medium text-slate-300">{clip.duration}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="rounded-[1.5rem] border border-white/8 bg-gradient-to-br from-violet-500/10 via-white/[0.03] to-cyan-500/10 p-4">
                                        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-violet-200/80">
                                            AI pipeline
                                        </p>
                                        <div className="mt-4 space-y-3">
                                            {['Highlight detection', 'Montage sequencing', 'Effects and music sync', 'Export presets'].map((step, index) => (
                                                <div key={step} className="flex items-center gap-3 text-sm text-slate-200">
                                                    <span className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/5 text-xs font-semibold text-white">
                                                        {index + 1}
                                                    </span>
                                                    <span>{step}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </GlassPanel>
                </div>
            </div>
        </section>
    );
}
