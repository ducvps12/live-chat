import { ReactElement, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { NextPageWithLayout } from '../_app';
import PublicLayout from '@/components/layout/PublicLayout';
import SeoHead from '@/components/common/SeoHead';
import HeroSection from '@/components/pages/pricing/sections/HeroSection';
import PricingCards from '@/components/pages/pricing/sections/PricingCards';
import QuotaExplainer from '@/components/pages/pricing/sections/QuotaExplainer';
import FeatureComparison from '@/components/pages/pricing/sections/FeatureComparison';
import AddOnsSection from '@/components/pages/pricing/sections/AddOnsSection';
import FAQSection from '@/components/pages/pricing/sections/FAQSection';
import SecurityBanner from '@/components/pages/pricing/sections/SecurityBanner';
import CTASection from '@/components/pages/pricing/sections/CTASection';

const PricingPage: NextPageWithLayout = () => {
    const { t } = useTranslation();
    const [isYearly, setIsYearly] = useState(false);

    const handleToggle = () => {
        setIsYearly(!isYearly);
    };

    return (
        <>
            <SeoHead
                title={t('pricing.seo.title', 'Bảng giá Nemark Inbox - Chọn gói phù hợp với quy mô team')}
                description={t('pricing.seo.description', 'Bắt đầu miễn phí. Nâng gói trong 1 click khi tăng trưởng. Không gián đoạn inbox.')}
                canonical="https://nemark.com/pricing"
            />

            {/* Hero with billing toggle */}
            <HeroSection isYearly={isYearly} onToggle={handleToggle} />

            {/* Pricing Cards */}
            <PricingCards isYearly={isYearly} />

            {/* Quota Explainer */}
            <QuotaExplainer />

            {/* Feature Comparison Table */}
            <FeatureComparison />

            {/* Add-ons */}
            <AddOnsSection />

            {/* FAQ */}
            <FAQSection />

            {/* Security Banner */}
            <SecurityBanner />

            {/* Final CTA */}
            <CTASection />
        </>
    );
};

PricingPage.getLayout = function getLayout(page: ReactElement) {
    return <PublicLayout>{page}</PublicLayout>;
};

export default PricingPage;
