import { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import type { NextPageWithLayout } from '../_app';
import PublicLayout from '@/components/layout/PublicLayout';
import SeoHead from '@/components/common/SeoHead';
import DemoHero from '@/components/pages/demo/sections/DemoHero';
import DemoPreview from '@/components/pages/demo/sections/DemoPreview';
import DemoControls from '@/components/pages/demo/sections/DemoControls';
import DemoSteps from '@/components/pages/demo/sections/DemoSteps';
import DemoResults from '@/components/pages/demo/sections/DemoResults';
import DemoCTA from '@/components/pages/demo/sections/DemoCTA';
import { DemoProvider } from '@/contexts/DemoContext';

const DemoPage: NextPageWithLayout = () => {
    const { t } = useTranslation();

    return (
        <DemoProvider>
            <SeoHead
                title="Demo Tương Tác - Trải nghiệm Widget Nemark Inbox"
                description={t('demo.hero.subtitle')}
                canonical="https://nemark.com/demo"
            />

            {/* Hero Section */}
            <div className="pt-32 pb-16">
                <DemoHero />
            </div>

            {/* Preview + Controls Section */}
            <section className="max-w-[1400px] mx-auto px-4 lg:px-6 pb-16">
                {/* Decorative Line */}
                <div className="relative mb-6">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-10 bg-gradient-to-b from-transparent to-electric-blue/50"></div>
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[60%] h-px bg-gradient-to-r from-transparent via-electric-blue/30 to-transparent"></div>
                </div>

                {/* Grid Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Preview - 8 columns */}
                    <div className="lg:col-span-8">
                        <DemoPreview />
                    </div>

                    {/* Controls - 4 columns */}
                    <div className="lg:col-span-4">
                        <DemoControls />
                    </div>
                </div>

                {/* Steps */}
                <DemoSteps />
            </section>

            {/* Results Section */}
            <DemoResults />

            {/* CTA Section */}
            <DemoCTA />
        </DemoProvider>
    );
};

DemoPage.getLayout = function getLayout(page: ReactElement) {
    return <PublicLayout variant="light">{page}</PublicLayout>;
};

export default DemoPage;
