import { Head, useForm, router } from '@inertiajs/react';
import { useState } from 'react';
import DashboardHeader from '../Components/Dashboard/DashboardHeader';

function Avatar({ src, name, className }) {
    const [broken, setBroken] = useState(false);
    const initials = name
        ? name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)
        : '?';

    if (src && !broken) {
        return (
            <img
                src={src}
                alt={name}
                onError={() => setBroken(true)}
                className={className}
            />
        );
    }

    return (
        <div className="h-10 w-10 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-sm font-bold text-violet-300 shrink-0 select-none">
            {initials}
        </div>
    );
}

// ─── Primitive: option card (radio replacement) ───────────────────────────────

function OptionCard({ selected, onClick, title, desc, badge }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={[
                'relative text-left w-full rounded-xl border px-4 py-3.5',
                'transition-all duration-200',
                selected
                    ? 'border-violet-500/50 bg-violet-500/8 shadow-sm shadow-violet-500/10'
                    : 'border-white/8 bg-gray-800/40 hover:border-white/15 hover:bg-gray-800/70',
            ].join(' ')}
        >
            <div className="flex items-start justify-between gap-3 pr-6">
                <div>
                    <p className={`text-sm font-semibold leading-snug ${selected ? 'text-white' : 'text-gray-300'}`}>
                        {title}
                    </p>
                    {desc && (
                        <p className="mt-0.5 text-xs text-gray-500 leading-relaxed">{desc}</p>
                    )}
                </div>
                {badge && (
                    <span className="shrink-0 text-[10px] font-bold text-violet-400/80 bg-violet-500/10 px-1.5 py-0.5 rounded border border-violet-500/20 whitespace-nowrap">
                        {badge}
                    </span>
                )}
            </div>
            {/* Radio dot */}
            <div className={`absolute top-3.5 right-3.5 h-4 w-4 rounded-full border flex items-center justify-center transition-all duration-200 ${
                selected ? 'border-violet-500/60 bg-violet-500/15' : 'border-gray-700 bg-gray-800'
            }`}>
                {selected && <div className="h-1.5 w-1.5 rounded-full bg-violet-400" />}
            </div>
        </button>
    );
}

// ─── Primitive: stepper input ─────────────────────────────────────────────────

function StepInput({ value, onChange, min = 0, max = 30, step = 1, unit = 's' }) {
    return (
        <div className="flex items-center gap-2.5">
            <button
                type="button"
                onClick={() => onChange(Math.max(min, value - step))}
                disabled={value <= min}
                className="h-7 w-7 rounded-lg bg-gray-800 border border-white/10 text-gray-400 hover:text-white hover:border-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-150 flex items-center justify-center text-base leading-none"
            >
                −
            </button>
            <span className="min-w-[3rem] text-center text-sm font-semibold text-white tabular-nums">
                {value}
                <span className="text-xs text-gray-600 ml-0.5">{unit}</span>
            </span>
            <button
                type="button"
                onClick={() => onChange(Math.min(max, value + step))}
                disabled={value >= max}
                className="h-7 w-7 rounded-lg bg-gray-800 border border-white/10 text-gray-400 hover:text-white hover:border-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-150 flex items-center justify-center text-base leading-none"
            >
                +
            </button>
        </div>
    );
}

// ─── Primitive: section card wrapper ─────────────────────────────────────────

function SectionCard({ title, desc, children }) {
    return (
        <div className="bg-gray-900 border border-white/8 rounded-2xl p-6 transition-all duration-200 hover:border-white/[0.13]">
            <div className="mb-5 pb-4 border-b border-white/5">
                <h2 className="text-sm font-semibold text-white">{title}</h2>
                {desc && <p className="mt-0.5 text-xs text-gray-500">{desc}</p>}
            </div>
            {children}
        </div>
    );
}

// ─── Primitive: field row ─────────────────────────────────────────────────────

function FieldRow({ label, desc, children }) {
    return (
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 py-3.5 border-b border-white/5 last:border-0 last:pb-0">
            <div className="sm:max-w-[55%]">
                <p className="text-sm font-medium text-gray-200">{label}</p>
                {desc && <p className="mt-0.5 text-xs text-gray-600 leading-relaxed">{desc}</p>}
            </div>
            <div className="shrink-0">
                {children}
            </div>
        </div>
    );
}

// ─── Primitive: segmented control (2-option toggle) ──────────────────────────

function SegmentedControl({ value, onChange, options }) {
    return (
        <div className="flex items-center gap-1 bg-gray-800/60 rounded-lg p-1 border border-white/8">
            {options.map((opt) => (
                <button
                    key={opt.value}
                    type="button"
                    onClick={() => onChange(opt.value)}
                    className={[
                        'px-4 py-1.5 rounded-md text-sm font-semibold transition-all duration-150',
                        value === opt.value
                            ? 'bg-violet-600 text-white shadow-sm shadow-violet-500/25'
                            : 'text-gray-400 hover:text-white',
                    ].join(' ')}
                >
                    {opt.label}
                </button>
            ))}
        </div>
    );
}

// ─── Section: Highlight Generation ───────────────────────────────────────────

function HighlightSettings({ data, setData }) {
    return (
        <SectionCard
            title="Highlight Generation"
            desc="Controls how the AI detects and extracts clips from your footage."
        >
            <FieldRow
                label="Clip count"
                desc="Maximum number of highlights to generate per video."
            >
                <SegmentedControl
                    value={data.clip_count}
                    onChange={(v) => setData('clip_count', v)}
                    options={[
                        { value: 3, label: '3 clips' },
                        { value: 5, label: '5 clips' },
                    ]}
                />
            </FieldRow>

            <FieldRow
                label="Pre-roll"
                desc="Seconds of footage included before each detected peak."
            >
                <StepInput
                    value={data.pre_roll}
                    onChange={(v) => setData('pre_roll', v)}
                    min={0}
                    max={15}
                    unit="s"
                />
            </FieldRow>

            <FieldRow
                label="Post-roll"
                desc="Seconds of footage included after each detected peak."
            >
                <StepInput
                    value={data.post_roll}
                    onChange={(v) => setData('post_roll', v)}
                    min={0}
                    max={15}
                    unit="s"
                />
            </FieldRow>

            <FieldRow
                label="Merge gap"
                desc="Adjacent highlights closer than this are merged into one clip."
            >
                <StepInput
                    value={data.merge_gap}
                    onChange={(v) => setData('merge_gap', v)}
                    min={0}
                    max={60}
                    unit="s"
                />
            </FieldRow>

            <FieldRow
                label="Minimum score"
                desc="Only moments scoring above this threshold are included. Higher = stricter."
            >
                <div className="flex items-center gap-4">
                    <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={data.min_score}
                        onChange={(e) => setData('min_score', parseInt(e.target.value))}
                        className="w-32 accent-violet-500 cursor-pointer"
                    />
                    <span className="w-10 text-sm font-semibold text-white tabular-nums text-right">
                        {data.min_score}
                        <span className="text-xs text-gray-600 ml-px">%</span>
                    </span>
                </div>
            </FieldRow>
        </SectionCard>
    );
}

// ─── Section: Output Settings ─────────────────────────────────────────────────

function OutputSettings({ data, setData }) {
    return (
        <SectionCard
            title="Output Settings"
            desc="Controls the quality, resolution, and format of generated clip files."
        >
            {/* Quality */}
            <div className="mb-5">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Quality</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <OptionCard
                        selected={data.output_quality === 'standard'}
                        onClick={() => setData('output_quality', 'standard')}
                        title="Standard"
                        desc="Good quality, balanced file size."
                    />
                    <OptionCard
                        selected={data.output_quality === 'high'}
                        onClick={() => setData('output_quality', 'high')}
                        title="High"
                        desc="Best visual quality output."
                        badge="Default"
                    />
                    <OptionCard
                        selected={data.output_quality === 'smaller'}
                        onClick={() => setData('output_quality', 'smaller')}
                        title="Smaller file"
                        desc="Compressed for easy sharing."
                    />
                </div>
            </div>

            {/* Resolution */}
            <div className="mb-5">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Resolution</p>
                <div className="grid grid-cols-2 gap-2.5">
                    <OptionCard
                        selected={data.resolution === '720p'}
                        onClick={() => setData('resolution', '720p')}
                        title="720p"
                        desc="HD — smaller output files."
                    />
                    <OptionCard
                        selected={data.resolution === '1080p'}
                        onClick={() => setData('resolution', '1080p')}
                        title="1080p"
                        desc="Full HD — sharper clips."
                        badge="Default"
                    />
                </div>
            </div>

            {/* Aspect ratio */}
            <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Aspect ratio</p>
                <div className="grid grid-cols-2 gap-2.5">
                    <OptionCard
                        selected={data.aspect_ratio === 'original'}
                        onClick={() => setData('aspect_ratio', 'original')}
                        title="Original"
                        desc="Keep the source video's ratio."
                        badge="Default"
                    />
                    <OptionCard
                        selected={data.aspect_ratio === 'vertical'}
                        onClick={() => setData('aspect_ratio', 'vertical')}
                        title="Vertical 9:16"
                        desc="Cropped for mobile / TikTok / Reels."
                    />
                </div>
            </div>
        </SectionCard>
    );
}

// ─── Section: Storage & Retention ─────────────────────────────────────────────

function StorageSettings({ data, setData }) {
    return (
        <SectionCard
            title="Storage & Retention"
            desc="Clips are automatically removed after the selected period to keep your storage clean."
        >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <OptionCard
                    selected={data.auto_delete_hours === 24}
                    onClick={() => setData('auto_delete_hours', 24)}
                    title="24 hours"
                    desc="Auto-deleted the next day."
                />
                <OptionCard
                    selected={data.auto_delete_hours === 48}
                    onClick={() => setData('auto_delete_hours', 48)}
                    title="48 hours"
                    desc="Two days to download."
                />
                <OptionCard
                    selected={data.auto_delete_hours === 168}
                    onClick={() => setData('auto_delete_hours', 168)}
                    title="7 days"
                    desc="A full week before removal."
                    badge="Default"
                />
            </div>
            <p className="mt-4 text-xs text-gray-700">
                Source videos are always deleted immediately after processing. Only the generated clips are kept.
            </p>
        </SectionCard>
    );
}

// ─── Section: Account ─────────────────────────────────────────────────────────

function AccountCard({ account, data, setData, errors }) {
    function handleSignOut(e) {
        e.preventDefault();
        router.post('/logout');
    }

    return (
        <div className="space-y-4">
            {/* Account info card */}
            <div className="bg-gray-900 border border-white/8 rounded-2xl p-5 transition-all duration-200 hover:border-white/[0.13]">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-4">
                    Account
                </h3>

                {/* Avatar + name */}
                <div className="flex items-center gap-3 mb-5 pb-4 border-b border-white/5">
                    <Avatar
                        src={account.avatar}
                        name={data.name}
                        className="h-10 w-10 rounded-full ring-1 ring-white/10 object-cover shrink-0"
                    />
                    <div className="min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{data.name}</p>
                        <p className="text-xs text-gray-500 truncate">{account.email}</p>
                    </div>
                </div>

                {/* Name field */}
                <div className="mb-4">
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">
                        Display name
                    </label>
                    <input
                        type="text"
                        value={data.name}
                        onChange={(e) => setData('name', e.target.value)}
                        className="w-full bg-gray-800/60 border border-white/10 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-all duration-150"
                        placeholder="Your name"
                    />
                    {errors.name && (
                        <p className="mt-1 text-xs text-red-400">{errors.name}</p>
                    )}
                </div>

                {/* Email (read-only) */}
                <div className="mb-4">
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">
                        Email
                    </label>
                    <div className="flex items-center gap-2">
                        <input
                            type="email"
                            value={account.email}
                            readOnly
                            className="w-full bg-gray-800/30 border border-white/5 rounded-lg px-3.5 py-2.5 text-sm text-gray-500 cursor-default select-all"
                        />
                    </div>
                </div>

                {/* Google connection */}
                <div className="flex items-center justify-between py-3 border-t border-white/5">
                    <div className="flex items-center gap-2.5">
                        {/* Google G icon */}
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                        </svg>
                        <span className="text-sm text-gray-400">Google login</span>
                    </div>
                    {account.google_connected ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-300 bg-green-500/10 border border-green-500/20 px-2.5 py-1 rounded-full">
                            <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                            Connected
                        </span>
                    ) : (
                        <a
                            href="/auth/google"
                            className="text-xs font-medium text-gray-400 hover:text-white border border-white/10 hover:border-white/20 px-3 py-1 rounded-lg transition-all duration-150"
                        >
                            Connect
                        </a>
                    )}
                </div>
            </div>

            {/* Sign out */}
            <button
                type="button"
                onClick={handleSignOut}
                className="w-full text-sm font-medium text-gray-500 hover:text-gray-300 border border-white/8 hover:border-white/15 rounded-xl py-2.5 transition-all duration-200"
            >
                Sign out
            </button>
        </div>
    );
}

// ─── Save bar ─────────────────────────────────────────────────────────────────

function SaveBar({ processing, recentlySuccessful, isDirty }) {
    if (!isDirty && !recentlySuccessful) return null;

    return (
        <div className="animate-fade-up fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-gray-900/95 backdrop-blur-sm border border-white/10 rounded-2xl px-5 py-3 shadow-2xl shadow-black/50">
            {recentlySuccessful ? (
                <>
                    <div className="h-5 w-5 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center shrink-0">
                        <svg className="h-3 w-3 text-green-400" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                    </div>
                    <span className="text-sm font-medium text-green-300">Settings saved</span>
                </>
            ) : (
                <>
                    <span className="text-sm text-gray-400">You have unsaved changes</span>
                    <button
                        type="submit"
                        form="settings-form"
                        disabled={processing}
                        className="text-sm font-semibold text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-60 px-4 py-1.5 rounded-lg shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 transition-all duration-200"
                    >
                        {processing ? 'Saving…' : 'Save changes'}
                    </button>
                </>
            )}
        </div>
    );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Settings({ settings, account }) {
    const { data, setData, post, processing, errors, isDirty, recentlySuccessful } = useForm({
        // Highlight generation
        clip_count:        settings.clip_count,
        pre_roll:          settings.pre_roll,
        post_roll:         settings.post_roll,
        merge_gap:         settings.merge_gap,
        min_score:         settings.min_score,
        // Output
        output_quality:    settings.output_quality,
        resolution:        settings.resolution,
        aspect_ratio:      settings.aspect_ratio,
        // Storage
        auto_delete_hours: settings.auto_delete_hours,
        // Account
        name:              account.name,
    });

    function handleSubmit(e) {
        e.preventDefault();
        post('/settings', { preserveScroll: true });
    }

    return (
        <>
            <Head title="Settings — ClutchClip" />
            <div className="min-h-screen bg-gray-950 text-white">

                <DashboardHeader active="settings" />

                <form id="settings-form" onSubmit={handleSubmit}>
                    <main className="mx-auto max-w-7xl px-4 sm:px-6 py-8 pb-36 md:pb-28">

                        {/* ── Page header ──────────────────────────────── */}
                        <div className="mb-8 animate-fade-up">
                            <p className="text-xs font-semibold text-violet-400 uppercase tracking-widest mb-1">
                                Settings
                            </p>
                            <h1 className="text-2xl font-bold text-white">Preferences</h1>
                            <p className="mt-1 text-sm text-gray-500">
                                Configure how ClutchClip processes and outputs your highlight clips.
                            </p>
                        </div>

                        {/* ── Main grid ────────────────────────────────── */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-up-1">

                            {/* ── Left: processing + output + storage ──── */}
                            <div className="lg:col-span-2 space-y-6">
                                <HighlightSettings data={data} setData={setData} />
                                <OutputSettings    data={data} setData={setData} />
                                <StorageSettings   data={data} setData={setData} />

                                {/* Save button (inline, below last section) */}
                                <div className="flex items-center justify-between gap-4 pt-2">
                                    <button
                                        type="submit"
                                        disabled={processing}
                                        className="inline-flex items-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white text-sm font-semibold px-6 py-2.5 transition-all duration-200 shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:-translate-y-px"
                                    >
                                        {processing ? (
                                            <>
                                                <span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                                                Saving…
                                            </>
                                        ) : (
                                            'Save settings'
                                        )}
                                    </button>

                                    {recentlySuccessful && (
                                        <span className="flex items-center gap-1.5 text-sm text-green-400 animate-fade-up">
                                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                            </svg>
                                            Saved
                                        </span>
                                    )}

                                    {Object.keys(errors).length > 0 && (
                                        <span className="text-sm text-red-400">
                                            Please fix the errors above.
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* ── Right: account ───────────────────────── */}
                            <div>
                                <AccountCard
                                    account={account}
                                    data={data}
                                    setData={setData}
                                    errors={errors}
                                />
                            </div>

                        </div>
                    </main>
                </form>

                {/* Floating save bar (appears when form is dirty) */}
                <SaveBar
                    processing={processing}
                    recentlySuccessful={recentlySuccessful}
                    isDirty={isDirty}
                />
            </div>
        </>
    );
}
