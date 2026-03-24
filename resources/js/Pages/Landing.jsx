import { Head } from '@inertiajs/react';
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
    return (
        <>
            <Head title="ClutchClip | AI Montage Generator" />
            <div className="min-h-screen bg-gray-950 text-white">
                <Navbar />
                <main>
                    <Hero />
                    <AiMontage />
                    <HowItWorks />
                    <Features />
                    <ProductPreview />
                    <UseCases />
                    <FAQ />
                    <CTASection />
                </main>
                <LandingFooter />
            </div>
        </>
    );
}
