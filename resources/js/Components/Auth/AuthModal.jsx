import { Link, router } from '@inertiajs/react';
import { useEffect } from 'react';

export default function AuthModal({
    mode = 'login',
    open = true,
    onClose,
    errors = {},
    showBackdrop = true,
    closeHref = '/',
}) {
    const isRegister = mode === 'register';
    const title = isRegister ? 'Create your account' : 'Sign in to your account';
    const description = isRegister
        ? 'We’re only onboarding with Google right now. Your account will be created automatically after you continue.'
        : 'ClutchClip is currently Google-only. Continue with Google to access your projects and uploads.';
    const helperText = isRegister
        ? 'Using Google keeps onboarding simple and ensures your saved videos and montage projects are tied to one account.'
        : 'We’ll use your Google account for secure sign-in and automatically restore your saved ClutchClip work.';
    const alternateHref = isRegister ? '/login' : '/register';
    const alternateLabel = isRegister ? 'Sign in' : 'Create account';

    const handleDismiss = () => {
        if (onClose) {
            onClose();
            return;
        }

        router.visit(closeHref);
    };

    useEffect(() => {
        if (!open) {
            return undefined;
        }

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                handleDismiss();
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [closeHref, open, onClose]);

    if (!open) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center px-4 py-8">
            {showBackdrop && (
                <button
                    type="button"
                    aria-label="Close authentication modal"
                    onClick={handleDismiss}
                    className="absolute inset-0 bg-gray-950/82 backdrop-blur-md"
                />
            )}

            <div className="relative z-10 w-full max-w-md overflow-hidden rounded-[1.75rem] border border-white/10 bg-gray-900/95 p-8 shadow-[0_30px_120px_rgba(2,6,23,0.7)] backdrop-blur-xl">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(124,58,237,0.2),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.12),transparent_28%)]" />

                <div className="relative pr-12">
                    {onClose ? (
                        <button
                            type="button"
                            aria-label="Close authentication modal"
                            onClick={handleDismiss}
                            className="absolute right-0 top-0 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-gray-400 transition-colors hover:border-white/15 hover:bg-white/10 hover:text-white"
                        >
                            <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M5.22 5.22a.75.75 0 0 1 1.06 0L10 8.94l3.72-3.72a.75.75 0 1 1 1.06 1.06L11.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06L10 11.06l-3.72 3.72a.75.75 0 1 1-1.06-1.06L8.94 10 5.22 6.28a.75.75 0 0 1 0-1.06Z" />
                            </svg>
                        </button>
                    ) : (
                        <Link
                            href={closeHref}
                            aria-label="Close authentication modal"
                            className="absolute right-0 top-0 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-gray-400 transition-colors hover:border-white/15 hover:bg-white/10 hover:text-white"
                        >
                            <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M5.22 5.22a.75.75 0 0 1 1.06 0L10 8.94l3.72-3.72a.75.75 0 1 1 1.06 1.06L11.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06L10 11.06l-3.72 3.72a.75.75 0 1 1-1.06-1.06L8.94 10 5.22 6.28a.75.75 0 0 1 0-1.06Z" />
                            </svg>
                        </Link>
                    )}

                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-violet-200/80">
                            {isRegister ? 'Start free' : 'Welcome back'}
                        </p>
                        <h1 className="mt-3 text-xl font-semibold text-white">{title}</h1>
                        <p className="mt-2 text-sm leading-6 text-gray-400">{description}</p>
                    </div>

                    {errors.auth && (
                        <div className="mt-5 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                            {errors.auth}
                        </div>
                    )}

                    <a
                        href="/auth/google"
                        className="mt-6 flex w-full items-center justify-center gap-3 rounded-xl border border-white/15 bg-white/5 py-3 text-sm font-medium text-white transition-colors hover:bg-white/10"
                    >
                        <GoogleIcon />
                        Continue with Google
                    </a>

                    <p className="mt-4 text-xs leading-6 text-gray-500">
                        {helperText}
                    </p>

                    <p className="mt-5 text-center text-sm text-gray-500">
                        {isRegister ? 'Already have an account?' : 'No account?'}{' '}
                        <Link href={alternateHref} className="text-violet-400 transition-colors hover:text-violet-300">
                            {alternateLabel}
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}

function GoogleIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908C16.658 14.01 17.64 11.8 17.64 9.2z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.859-3.048.859-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
            <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
        </svg>
    );
}
