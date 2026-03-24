import { GlassPanel, SectionHeading } from './LandingPrimitives';

const effectBlocks = [
    { label: 'Slow motion', width: 'w-28', tone: 'bg-violet-400/75' },
    { label: 'Zoom hit', width: 'w-20', tone: 'bg-cyan-400/75' },
    { label: 'Text overlay', width: 'w-24', tone: 'bg-fuchsia-400/75' },
    { label: 'Beat sync', width: 'w-16', tone: 'bg-indigo-400/75' },
];

const editorTools = ['Trim', 'Impact cuts', 'Zoom hits', 'Text overlays'];

export default function ProductPreview() {
    return (
        <section id="editor-preview" className="px-6 py-24 md:py-32">
            <div className="mx-auto max-w-7xl">
                <SectionHeading
                    eyebrow="Editor preview"
                    title="Edit like a pro - without the complexity"
                    description="ClutchClip gives you a clean visual editor with timeline controls, effect blocks, and preview playback so you can polish the montage instead of building it from scratch."
                />

                <GlassPanel className="overflow-hidden p-3">
                    <div className="grid gap-4 rounded-[1.6rem] border border-white/8 bg-slate-950/85 p-4 lg:grid-cols-[1.15fr_0.85fr]">
                        <div className="rounded-[1.5rem] border border-white/8 bg-[radial-gradient(circle_at_top_left,rgba(124,58,237,0.16),transparent_35%),linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,0.92))] p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-white">Preview player</p>
                                    <p className="text-xs text-slate-400">Auto-generated montage with manual controls</p>
                                </div>
                                <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                                    00:42 / 01:18
                                </div>
                            </div>

                            <div className="mt-4 aspect-video overflow-hidden rounded-[1.5rem] border border-white/8 bg-[radial-gradient(circle_at_70%_20%,rgba(34,211,238,0.16),transparent_22%),radial-gradient(circle_at_25%_80%,rgba(217,70,239,0.14),transparent_24%),linear-gradient(160deg,rgba(2,6,23,0.95),rgba(15,23,42,0.92))]">
                                <div className="flex h-full flex-col justify-between p-5">
                                    <div className="flex items-center justify-between">
                                        <div className="rounded-full border border-violet-400/20 bg-violet-400/10 px-3 py-1 text-xs text-violet-200">
                                            Montage draft v1
                                        </div>
                                        <div className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-slate-200">
                                            Auto transitions on
                                        </div>
                                    </div>

                                    <div className="flex flex-1 items-center justify-center">
                                        <div className="flex h-20 w-20 items-center justify-center rounded-full border border-white/10 bg-white/10 shadow-[0_0_60px_rgba(124,58,237,0.2)] backdrop-blur-sm">
                                            <svg className="ml-1 h-8 w-8 text-white" viewBox="0 0 20 20" fill="currentColor">
                                                <path d="M6 4.5v11l9-5.5-9-5.5Z" />
                                            </svg>
                                        </div>
                                    </div>

                                    <div className="rounded-2xl border border-white/10 bg-black/30 p-4 backdrop-blur-sm">
                                        <div className="flex items-center justify-between text-xs text-slate-300">
                                            <span>Effects timeline</span>
                                            <span>Zoom hit on kill frame</span>
                                        </div>
                                        <div className="mt-3 flex items-center gap-2">
                                            <div className="h-2 flex-1 rounded-full bg-white/10" />
                                            <div className="h-2 w-12 rounded-full bg-violet-400" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="rounded-[1.5rem] border border-white/8 bg-white/[0.03] p-5">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-white">Timeline</p>
                                        <p className="text-xs text-slate-400">Drag effects and reorder moments</p>
                                    </div>
                                    <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-300">
                                        Live update
                                    </div>
                                </div>

                                <div className="mt-5 space-y-3">
                                    <div className="rounded-2xl border border-white/8 bg-slate-950/80 p-3">
                                        <div className="mb-3 flex items-center justify-between text-xs text-slate-400">
                                            <span>Gameplay track</span>
                                            <span>3 clips merged</span>
                                        </div>
                                        <div className="flex gap-2">
                                            <div className="h-10 flex-1 rounded-xl bg-violet-500/35" />
                                            <div className="h-10 w-24 rounded-xl bg-cyan-500/25" />
                                            <div className="h-10 flex-1 rounded-xl bg-fuchsia-500/25" />
                                        </div>
                                    </div>

                                    <div className="rounded-2xl border border-white/8 bg-slate-950/80 p-3">
                                        <div className="mb-3 flex items-center justify-between text-xs text-slate-400">
                                            <span>Effects track</span>
                                            <span>4 blocks applied</span>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {effectBlocks.map((block) => (
                                                <div
                                                    key={block.label}
                                                    className={`${block.width} ${block.tone} flex h-9 items-center justify-center rounded-xl px-3 text-xs font-medium text-slate-950`}
                                                >
                                                    {block.label}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-[1.5rem] border border-white/8 bg-gradient-to-br from-violet-500/10 via-white/[0.03] to-cyan-500/10 p-5">
                                <p className="text-sm font-medium text-white">What you can tweak</p>
                                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                    {editorTools.map((tool) => (
                                        <div key={tool} className="rounded-2xl border border-white/8 bg-slate-950/70 px-4 py-3 text-sm text-slate-200">
                                            {tool}
                                        </div>
                                    ))}
                                </div>
                                <p className="mt-4 text-sm leading-7 text-slate-300">
                                    Drag effects, control slow motion, accent key moments with zoom hits, and add text overlays only where they improve the final edit.
                                </p>
                            </div>
                        </div>
                    </div>
                </GlassPanel>
            </div>
        </section>
    );
}
