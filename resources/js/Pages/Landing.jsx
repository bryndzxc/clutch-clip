import { Head } from '@inertiajs/react';
import { useState } from 'react';
import AuthModal from '../Components/Auth/AuthModal';
import Navbar from '../Components/Landing/Navbar';
import Hero from '../Components/Landing/Hero';
import AiMontage from '../Components/Landing/AiMontage';
import HowItWorks from '../Components/Landing/HowItWorks';
import Features from '../Components/Landing/Features';
import ProductPreview from '../Components/Landing/ProductPreview';
import UseCases from '../Components/Landing/UseCases';
import FAQ from '../Components/Landing/FAQ';
import CTASection from '../Components/Landing/CTASection';
import LandingFooter from '../Components/Landing/LandingFooter';

export default function Landing() {
    const [authModalMode, setAuthModalMode] = useState(null);

    return (
        <>
            <Head>
                <title>ClutchClip - AI Gaming Highlight Generator</title>
                <meta name="description" content="Automatically generate gaming highlights using AI. Upload your gameplay and get clips instantly for TikTok, YouTube, and Facebook." />
                <meta name="keywords" content="gaming highlights, AI video editor, montage maker, valorant clips, clutch clips, gaming montage" />
            </Head>
            <div className="min-h-screen bg-gray-950 text-white">
                <Navbar onOpenAuthModal={setAuthModalMode} />
                <main>
                    <Hero onOpenAuthModal={setAuthModalMode} />
                    <AiMontage />
                    <HowItWorks />
                    <Features />
                    <ProductPreview />
                    <UseCases />
                    <FAQ />
                    <CTASection onOpenAuthModal={setAuthModalMode} />
                </main>
                <LandingFooter onOpenAuthModal={setAuthModalMode} />
            </div>
            <AuthModal
                mode={authModalMode ?? 'login'}
                open={Boolean(authModalMode)}
                onClose={() => setAuthModalMode(null)}
            />
        </>
    );
}
