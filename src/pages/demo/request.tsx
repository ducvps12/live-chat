import { ReactElement } from 'react';
import type { NextPageWithLayout } from '../_app';
import PublicLayout from '@/components/layout/PublicLayout';
import SeoHead from '@/components/common/SeoHead';
import DemoHeroSection from '@/components/pages/demo/sections/DemoHeroSection';
import DemoBenefitsSection from '@/components/pages/demo/sections/DemoBenefitsSection';
import DemoTargetAudienceSection from '@/components/pages/demo/sections/DemoTargetAudienceSection';
import DemoSocialProofSection from '@/components/pages/demo/sections/DemoSocialProofSection';
import DemoFAQSection from '@/components/pages/demo/sections/DemoFAQSection';
import DemoCTASection from '@/components/pages/demo/sections/DemoCTASection';

const DemoRequestPage: NextPageWithLayout = () => {
    return (
        <>
            <SeoHead
                title="Yêu cầu Demo Nemark Inbox - Tư vấn giải pháp Live Chat doanh nghiệp"
                description="Nhận buổi demo cá nhân hóa theo ngành và quy mô doanh nghiệp của bạn. Khám phá cách Nemark Inbox giúp tăng 35% conversion và tự động hóa 60% hội thoại."
                canonical="https://nemark.com/demo/request"
            />

            {/* All Demo Request Page Sections */}
            <DemoHeroSection />
            <DemoBenefitsSection />
            <DemoTargetAudienceSection />
            <DemoSocialProofSection />
            <DemoFAQSection />
            <DemoCTASection />
        </>
    );
};

DemoRequestPage.getLayout = function getLayout(page: ReactElement) {
    return <PublicLayout>{page}</PublicLayout>;
};

export default DemoRequestPage;
