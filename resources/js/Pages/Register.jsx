import { Head, Link, useForm } from '@inertiajs/react';

export default function Register() {
    const { data, setData, post, processing, errors } = useForm({
        name:                  '',
        email:                 '',
        password:              '',
        password_confirmation: '',
    });

    function handleSubmit(e) {
        e.preventDefault();
        post('/register');
    }

    return (
        <>
            <Head title="Create Account" />
            <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-4">
                {/* Logo */}
                <a href="/" className="mb-8 text-3xl font-bold tracking-tight">
                    <span className="text-violet-400">Clutch</span>
                    <span className="text-white">Clip</span>
                </a>

                <div className="w-full max-w-md bg-gray-900 border border-white/10 rounded-2xl p-8">
                    <h1 className="text-xl font-semibold text-white mb-6">Create your account</h1>

                    {/* Google button */}
                    <a
                        href="/auth/google"
                        className="flex items-center justify-center gap-3 w-full rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-white text-sm font-medium py-2.5 transition-colors"
                    >
                        <GoogleIcon />
                        Continue with Google
                    </a>

                    <div className="flex items-center gap-3 my-5">
                        <div className="flex-1 h-px bg-white/10" />
                        <span className="text-xs text-gray-500">or</span>
                        <div className="flex-1 h-px bg-white/10" />
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm text-gray-400 mb-1.5">Name</label>
                            <input
                                type="text"
                                value={data.name}
                                onChange={e => setData('name', e.target.value)}
                                className="w-full rounded-lg bg-gray-800 border border-white/10 text-white px-4 py-2.5 text-sm placeholder-gray-500 focus:outline-none focus:border-violet-500 transition-colors"
                                placeholder="Your name"
                                autoComplete="name"
                            />
                            {errors.name && <p className="mt-1.5 text-xs text-red-400">{errors.name}</p>}
                        </div>

                        <div>
                            <label className="block text-sm text-gray-400 mb-1.5">Email</label>
                            <input
                                type="email"
                                value={data.email}
                                onChange={e => setData('email', e.target.value)}
                                className="w-full rounded-lg bg-gray-800 border border-white/10 text-white px-4 py-2.5 text-sm placeholder-gray-500 focus:outline-none focus:border-violet-500 transition-colors"
                                placeholder="you@example.com"
                                autoComplete="email"
                            />
                            {errors.email && <p className="mt-1.5 text-xs text-red-400">{errors.email}</p>}
                        </div>

                        <div>
                            <label className="block text-sm text-gray-400 mb-1.5">Password</label>
                            <input
                                type="password"
                                value={data.password}
                                onChange={e => setData('password', e.target.value)}
                                className="w-full rounded-lg bg-gray-800 border border-white/10 text-white px-4 py-2.5 text-sm placeholder-gray-500 focus:outline-none focus:border-violet-500 transition-colors"
                                placeholder="Min 8 characters"
                                autoComplete="new-password"
                            />
                            {errors.password && <p className="mt-1.5 text-xs text-red-400">{errors.password}</p>}
                        </div>

                        <div>
                            <label className="block text-sm text-gray-400 mb-1.5">Confirm password</label>
                            <input
                                type="password"
                                value={data.password_confirmation}
                                onChange={e => setData('password_confirmation', e.target.value)}
                                className="w-full rounded-lg bg-gray-800 border border-white/10 text-white px-4 py-2.5 text-sm placeholder-gray-500 focus:outline-none focus:border-violet-500 transition-colors"
                                placeholder="Repeat password"
                                autoComplete="new-password"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={processing}
                            className="w-full rounded-lg bg-violet-600 hover:bg-violet-500 disabled:bg-violet-600/50 text-white text-sm font-semibold py-2.5 transition-colors"
                        >
                            {processing ? 'Creating account…' : 'Create account'}
                        </button>
                    </form>

                    <p className="mt-5 text-center text-sm text-gray-500">
                        Already have an account?{' '}
                        <Link href="/login" className="text-violet-400 hover:text-violet-300 transition-colors">
                            Sign in
                        </Link>
                    </p>
                </div>
            </div>
        </>
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
