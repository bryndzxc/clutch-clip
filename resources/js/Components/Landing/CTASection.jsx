import { usePage } from '@inertiajs/react';
import { GlassPanel } from './LandingPrimitives';

export default function CTASection({ onOpenAuthModal }) {
    const { auth } = usePage().props;
    const primaryCtaHref = auth.user ? '/upload' : null;

    return (
        <section className="px-6 py-24 md:py-32">
            <div className="mx-auto max-w-5xl">
                <GlassPanel className="relative overflow-hidden px-8 py-14 text-center md:px-14 md:py-16">
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(124,58,237,0.22),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.16),transparent_28%)]" />
                    <div className="relative">
                        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-violet-200/80">
                            Start free
                        </p>
                        <h2 className="mt-5 text-3xl font-semibold tracking-tight text-white md:text-5xl">
                            Ready to turn your clips into a montage?
                        </h2>
                        <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-300 md:text-lg">
                            Upload gameplay, let the AI build the first cut, and export a share-ready montage in minutes.
                        </p>
                        <div className="mt-8 flex justify-center">
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
                        </div>
                    </div>
                </GlassPanel>
            </div>
        </section>
    );
}
