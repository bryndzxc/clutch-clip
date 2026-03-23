import { Head, router } from '@inertiajs/react';
import { useState, useRef } from 'react';

export default function Upload() {
    const [file, setFile] = useState(null);
    const [dragActive, setDragActive] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState(null);
    const inputRef = useRef(null);

    function handleFile(f) {
        setError(null);
        if (f.size > 1536 * 1024 * 1024) {
            setError('File too large. Maximum size is 1.5 GB.');
            return;
        }
        setFile(f);
    }

    function handleDrop(e) {
        e.preventDefault();
        setDragActive(false);
        if (e.dataTransfer.files?.[0]) {
            handleFile(e.dataTransfer.files[0]);
        }
    }

    async function handleSubmit(e) {
        e.preventDefault();
        if (!file || uploading) return;

        setUploading(true);
        setError(null);
        setProgress(0);

        const CHUNK_SIZE  = 50 * 1024 * 1024; // 50 MB per chunk
        const uploadId    = crypto.randomUUID();
        const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
        const token       = document.querySelector('meta[name="csrf-token"]')?.content;

        const baseHeaders = {
            'Accept':            'application/json',
            'X-Requested-With':  'XMLHttpRequest',
            ...(token ? { 'X-CSRF-TOKEN': token } : {}),
        };

        try {
            // Phase 1: Upload each chunk sequentially (0 → 90% of progress bar)
            for (let i = 0; i < totalChunks; i++) {
                const chunk    = file.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
                const formData = new FormData();
                formData.append('upload_id',    uploadId);
                formData.append('chunk_index',  i);
                formData.append('total_chunks', totalChunks);
                formData.append('chunk',        chunk);

                const res = await fetch('/videos/chunks', {
                    method:  'POST',
                    headers: baseHeaders,
                    body:    formData,
                });

                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(err.message || `Chunk ${i + 1} failed to upload.`);
                }

                setProgress(Math.round(((i + 1) / totalChunks) * 90));
            }

            // Phase 2: Ask server to assemble chunks (90 → 100%)
            setProgress(95);

            const assembleRes = await fetch('/videos/assemble', {
                method:  'POST',
                headers: { ...baseHeaders, 'Content-Type': 'application/json' },
                body:    JSON.stringify({
                    upload_id:    uploadId,
                    filename:     file.name,
                    total_chunks: totalChunks,
                }),
            });

            const data = await assembleRes.json();

            if (!assembleRes.ok) {
                throw new Error(data.message || 'Upload failed.');
            }

            router.visit(`/videos/${data.id}`);
        } catch (err) {
            setUploading(false);
            setProgress(0);
            setError(err.message || 'Upload failed. Please try again.');
        }
    }

    return (
        <>
            <Head title="Upload" />
            <div className="min-h-screen flex flex-col items-center justify-center px-4">
                {/* Logo */}
                <div className="mb-8 text-center">
                    <h1 className="text-4xl font-bold tracking-tight">
                        <span className="text-indigo-400">Clutch</span>
                        <span className="text-white">Clip</span>
                    </h1>
                    <p className="mt-2 text-gray-400">
                        Upload gameplay footage — get highlights automatically
                    </p>
                </div>

                {/* Upload card */}
                <div className="w-full max-w-lg">
                    <form onSubmit={handleSubmit}>
                        {/* Drop zone */}
                        <div
                            className={`
                                relative rounded-xl border-2 border-dashed p-10 text-center
                                transition-colors cursor-pointer
                                ${dragActive
                                    ? 'border-indigo-400 bg-indigo-400/10'
                                    : file
                                        ? 'border-green-500 bg-green-500/10'
                                        : 'border-gray-600 hover:border-gray-400'
                                }
                            `}
                            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                            onDragLeave={() => setDragActive(false)}
                            onDrop={handleDrop}
                            onClick={() => inputRef.current?.click()}
                        >
                            <input
                                ref={inputRef}
                                type="file"
                                accept="video/mp4,video/webm,video/x-matroska,video/avi"
                                className="hidden"
                                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                            />

                            {file ? (
                                <div>
                                    <svg className="mx-auto h-10 w-10 text-green-400" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <p className="mt-2 text-sm font-medium text-green-300">{file.name}</p>
                                    <p className="text-xs text-gray-400">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
                                </div>
                            ) : (
                                <div>
                                    <svg className="mx-auto h-10 w-10 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                                    </svg>
                                    <p className="mt-2 text-sm text-gray-300">
                                        Drag & drop your video here, or <span className="text-indigo-400 underline">browse</span>
                                    </p>
                                    <p className="mt-1 text-xs text-gray-500">MP4, WebM, MKV, AVI — max 1.5 GB · 60 min max</p>
                                </div>
                            )}
                        </div>

                        {/* Error */}
                        {error && (
                            <p className="mt-3 text-sm text-red-400 text-center">{error}</p>
                        )}

                        {/* Upload progress */}
                        {uploading && (
                            <div className="mt-4">
                                <div className="h-2 rounded-full bg-gray-700 overflow-hidden">
                                    <div
                                        className="h-full bg-indigo-500 transition-all duration-300"
                                        style={{ width: `${progress}%` }}
                                    />
                                </div>
                                <p className="mt-1 text-xs text-gray-400 text-center">
                                    {progress < 95 ? `Uploading… ${progress}%` : 'Finalizing upload…'}
                                </p>
                            </div>
                        )}

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={!file || uploading}
                            className={`
                                mt-5 w-full rounded-lg py-3 text-sm font-semibold transition
                                ${file && !uploading
                                    ? 'bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer'
                                    : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                                }
                            `}
                        >
                            {uploading ? (progress < 95 ? 'Uploading…' : 'Finalizing…') : 'Generate Highlights'}
                        </button>
                    </form>
                </div>
            </div>
        </>
    );
}
