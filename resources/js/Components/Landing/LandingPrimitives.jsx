function joinClasses(...classes) {
    return classes.filter(Boolean).join(' ');
}

export function SectionHeading({ eyebrow, title, description, align = 'center' }) {
    const alignment = align === 'left' ? 'text-left' : 'text-center';
    const descriptionWidth = align === 'left' ? 'max-w-2xl' : 'mx-auto max-w-2xl';

    return (
        <div className={joinClasses('mb-12 md:mb-16', alignment)}>
            {eyebrow ? (
                <p className="mb-4 text-xs font-semibold uppercase tracking-[0.3em] text-violet-300/80">
                    {eyebrow}
                </p>
            ) : null}
            <h2 className="text-3xl font-semibold tracking-tight text-white md:text-5xl">
                {title}
            </h2>
            {description ? (
                <p className={joinClasses('mt-4 text-base leading-7 text-slate-300 md:text-lg', descriptionWidth)}>
                    {description}
                </p>
            ) : null}
        </div>
    );
}

export function GlassPanel({ children, className = '' }) {
    return (
        <div
            className={joinClasses(
                'rounded-3xl border border-white/10 bg-white/[0.03] shadow-[0_20px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl',
                className,
            )}
        >
            {children}
        </div>
    );
}

const iconShellStyles = {
    violet: 'bg-violet-500/15 text-violet-300 ring-violet-400/20',
    cyan: 'bg-cyan-500/15 text-cyan-300 ring-cyan-400/20',
    fuchsia: 'bg-fuchsia-500/15 text-fuchsia-300 ring-fuchsia-400/20',
    indigo: 'bg-indigo-500/15 text-indigo-300 ring-indigo-400/20',
};

export function IconShell({ children, tone = 'violet', className = '' }) {
    return (
        <div
            className={joinClasses(
                'inline-flex h-12 w-12 items-center justify-center rounded-2xl ring-1 transition-transform duration-300 group-hover:scale-105',
                iconShellStyles[tone] ?? iconShellStyles.violet,
                className,
            )}
        >
            {children}
        </div>
    );
}

export function GridGlow() {
    return (
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
            <div className="absolute inset-y-0 left-0 w-px bg-gradient-to-b from-transparent via-white/15 to-transparent" />
        </div>
    );
}
