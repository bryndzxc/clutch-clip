import { Head } from '@inertiajs/react';
import { useState, useEffect, useRef } from 'react';

// Status badge component
function StatusBadge({ status }) {
    const styles = {
        pending:    'bg-yellow-500/20 text-yellow-300',
        processing: 'bg-indigo-500/20 text-indigo-300',
        done:       'bg-green-500/20 text-green-300',
        failed:     'bg-red-500/20 text-red-300',
    };
    return (
        <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${styles[status] || styles.pending}`}>
            {status === 'processing' ? 'Analyzing video…' : status}
        </span>
    );
}

// Processing animation
function ProcessingSpinner() {
    return (
        <div className="flex flex-col items-center py-16">
            <div className="relative h-16 w-16">
                <div className="absolute inset-0 rounded-full border-4 border-gray-700" />
                <div className="absolute inset-0 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin" />
            </div>
            <p className="mt-6 text-gray-300 text-sm">Detecting highlights…</p>
            <p className="mt-1 text-gray-500 text-xs">This may take a few minutes for longer videos.</p>
        </div>
    );
}

// Single clip card
function ClipCard({ clip, index }) {
    const videoRef = useRef(null);

    return (
        <div className="rounded-xl bg-gray-800/60 border border-gray-700 overflow-hidden">
            {/* Video player */}
            <div className="relative aspect-video bg-black">
                <video
                    ref={videoRef}
                    src={clip.url}
                    controls
                    preload="metadata"
                    className="w-full h-full object-contain"
                />
            </div>

            {/* Info bar */}
            <div className="flex items-center justify-between px-4 py-3">
                <div>
                    <p className="text-sm font-medium text-white">
                        Highlight #{index + 1}
                    </p>
                    <p className="text-xs text-gray-400">
                        {formatTime(clip.start_time)} – {formatTime(clip.end_time)}
                        <span className="ml-2 text-gray-500">({clip.duration}s)</span>
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    {/* Score */}
                    <span className="text-xs font-mono px-2 py-1 rounded bg-indigo-500/20 text-indigo-300">
                        Score: {clip.score}
                    </span>

                    {/* Download */}
                    <a
                        href={clip.url}
                        download={`clutchclip_highlight_${index + 1}.mp4`}
                        className="rounded-lg bg-gray-700 hover:bg-gray-600 px-3 py-1.5 text-xs font-medium text-white transition"
                    >
                        Download
                    </a>
                </div>
            </div>
        </div>
    );
}

// Format seconds → "1:23" or "0:05"
function formatTime(totalSeconds) {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function Results({ videoId, status: initialStatus }) {
    const [status, setStatus] = useState(initialStatus);
    const [clips, setClips] = useState([]);
    const [error, setError] = useState(null);

    // Poll for status while processing
    useEffect(() => {
        if (status === 'done' || status === 'failed') return;

        const interval = setInterval(async () => {
            try {
                const res = await fetch(`/api/videos/${videoId}/status`);
                const data = await res.json();
                setStatus(data.status);

                if (data.status === 'failed') {
                    setError(data.error_message || 'Processing failed.');
                    clearInterval(interval);
                }

                if (data.status === 'done') {
                    clearInterval(interval);
                }
            } catch {
                // Silently retry on network error
            }
        }, 2000); // Poll every 2 seconds

        return () => clearInterval(interval);
    }, [status, videoId]);

    // Fetch clips once status is "done"
    useEffect(() => {
        if (status !== 'done') return;

        fetch(`/api/videos/${videoId}/clips`)
            .then((res) => res.json())
            .then((data) => setClips(data.clips || []))
            .catch(() => setError('Failed to load clips.'));
    }, [status, videoId]);

    return (
        <>
            <Head title={status === 'done' ? 'Your Highlights' : 'Processing'} />
            <div className="min-h-screen px-4 py-12">
                <div className="mx-auto max-w-3xl">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h1 className="text-2xl font-bold">
                                <span className="text-indigo-400">Clutch</span>
                                <span className="text-white">Clip</span>
                            </h1>
                        </div>
                        <StatusBadge status={status} />
                    </div>

                    {/* Processing state */}
                    {(status === 'pending' || status === 'processing') && (
                        <ProcessingSpinner />
                    )}

                    {/* Error state */}
                    {status === 'failed' && (
                        <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-6 text-center">
                            <p className="text-red-300 font-medium">Processing failed</p>
                            <p className="mt-2 text-sm text-red-400/80">{error}</p>
                            <a
                                href="/"
                                className="mt-4 inline-block rounded-lg bg-gray-700 hover:bg-gray-600 px-4 py-2 text-sm text-white transition"
                            >
                                Try another video
                            </a>
                        </div>
                    )}

                    {/* Results */}
                    {status === 'done' && clips.length > 0 && (
                        <div className="space-y-6">
                            <p className="text-gray-400 text-sm">
                                Found <span className="text-white font-medium">{clips.length}</span> highlights — ranked by intensity.
                            </p>

                            {clips.map((clip, i) => (
                                <ClipCard key={clip.id} clip={clip} index={i} />
                            ))}

                            <div className="pt-4 text-center">
                                <a
                                    href="/"
                                    className="text-sm text-indigo-400 hover:text-indigo-300 transition"
                                >
                                    Upload another video
                                </a>
                            </div>
                        </div>
                    )}

                    {status === 'done' && clips.length === 0 && (
                        <div className="rounded-xl bg-gray-800/60 border border-gray-700 p-6 text-center">
                            <p className="text-gray-300">No highlights detected in this video.</p>
                            <a
                                href="/"
                                className="mt-4 inline-block text-sm text-indigo-400 hover:text-indigo-300 transition"
                            >
                                Try another video
                            </a>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
