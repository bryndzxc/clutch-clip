import { useForm, usePage } from '@inertiajs/react';
import { useEffect } from 'react';

const TYPES = [
    { value: 'bug_report',      label: 'Bug Report' },
    { value: 'feature_request', label: 'Feature Request' },
    { value: 'general',         label: 'General Feedback' },
];

export default function FeedbackModal({ open, onClose, defaultPage = '' }) {
    const { flash } = usePage().props;

    const { data, setData, post, processing, errors, reset, wasSuccessful } = useForm({
        type:               'general',
        subject:            '',
        message:            '',
        page:               defaultPage,
        related_project_id: '',
    });

    // Close on success
    useEffect(() => {
        if (flash?.feedback_sent) {
            reset();
            onClose();
        }
    }, [flash?.feedback_sent]);

    function handleSubmit(e) {
        e.preventDefault();
        post('/feedback', { preserveScroll: true });
    }

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

            <div className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-gray-950 shadow-2xl">
                <div className="flex items-center justify-between border-b border-white/8 px-6 py-4">
                    <h2 className="text-base font-semibold text-white">Send Feedback</h2>
                    <button
                        onClick={onClose}
                        className="rounded-md p-1 text-gray-500 hover:text-gray-300 transition-colors"
                    >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Type */}
                    <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1.5">Type</label>
                        <div className="flex gap-2 flex-wrap">
                            {TYPES.map(({ value, label }) => (
                                <button
                                    key={value}
                                    type="button"
                                    onClick={() => setData('type', value)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                                        data.type === value
                                            ? 'border-violet-500/60 bg-violet-500/20 text-violet-300'
                                            : 'border-white/10 bg-white/5 text-gray-400 hover:border-white/20 hover:text-gray-300'
                                    }`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Subject */}
                    <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1.5">Subject</label>
                        <input
                            type="text"
                            value={data.subject}
                            onChange={e => setData('subject', e.target.value)}
                            placeholder="Brief summary…"
                            maxLength={200}
                            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/30"
                        />
                        {errors.subject && <p className="mt-1 text-xs text-red-400">{errors.subject}</p>}
                    </div>

                    {/* Message */}
                    <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1.5">Message</label>
                        <textarea
                            value={data.message}
                            onChange={e => setData('message', e.target.value)}
                            placeholder="Describe the issue or idea in detail…"
                            rows={4}
                            maxLength={3000}
                            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/30 resize-none"
                        />
                        {errors.message && <p className="mt-1 text-xs text-red-400">{errors.message}</p>}
                    </div>

                    {/* Page (auto-filled, editable) */}
                    <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1.5">
                            Page / module <span className="text-gray-600">(optional)</span>
                        </label>
                        <input
                            type="text"
                            value={data.page}
                            onChange={e => setData('page', e.target.value)}
                            placeholder="/montage-editor"
                            maxLength={300}
                            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/30"
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-lg border border-white/10 px-4 py-2 text-sm text-gray-400 hover:border-white/20 hover:text-gray-300 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={processing}
                            className="rounded-lg bg-violet-600 px-5 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50 transition-colors"
                        >
                            {processing ? 'Sending…' : 'Send Feedback'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
