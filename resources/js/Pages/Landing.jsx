import { Head } from '@inertiajs/react';
import Navbar from '../Components/Landing/Navbar';
import Hero from '../Components/Landing/Hero';
import HowItWorks from '../Components/Landing/HowItWorks';
import Features from '../Components/Landing/Features';
import ProductPreview from '../Components/Landing/ProductPreview';
import FAQ from '../Components/Landing/FAQ';
import LandingFooter from '../Components/Landing/LandingFooter';

export default function Landing() {
    return (
        <>
            <Head title="AI Gaming Highlight Generator" />
            <div className="min-h-screen bg-gray-950 text-white">
                <Navbar />
                <main>
                    <Hero />
                    <HowItWorks />
                    <Features />
                    <ProductPreview />
                    <FAQ />
                </main>
                <LandingFooter />
            </div>
        </>
    );
}
