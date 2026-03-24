import { Head, usePage } from '@inertiajs/react';
import AuthModal from '../Components/Auth/AuthModal';

export default function Register() {
    const { errors = {} } = usePage().props;

    return (
        <>
            <Head title="Create Account" />
            <div className="relative min-h-screen overflow-hidden bg-gray-950">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(124,58,237,0.2),transparent_32%),radial-gradient(circle_at_80%_20%,rgba(34,211,238,0.12),transparent_25%),linear-gradient(180deg,rgba(2,6,23,0.92),rgba(2,6,23,1))]" />
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:88px_88px] [mask-image:radial-gradient(circle_at_center,black,transparent_82%)]" />
                <AuthModal mode="register" errors={errors} closeHref="/" />
            </div>
        </>
    );
}
