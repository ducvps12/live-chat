import { ReactElement } from 'react';
import type { NextPageWithLayout } from '../_app';
import PublicLayout from '@/components/layout/PublicLayout';
import SeoHead from '@/components/common/SeoHead';
import LegalHeroSection from '@/components/pages/legal/sections/LegalHeroSection';
import PolicyCardsSection from '@/components/pages/legal/sections/PolicyCardsSection';
import LegalSummaryFAQSection from '@/components/pages/legal/sections/LegalSummaryFAQSection';

const LegalPage: NextPageWithLayout = () => {
    return (
        <>
            <SeoHead
                title="Pháp lý Nemark Inbox - Chính sách & Điều khoản"
                description="Trung tâm tài liệu pháp lý minh bạch: Điều khoản sử dụng, Chính sách bảo mật, DPA, Cookie Policy và các chính sách tuân thủ. Hiểu rõ quyền lợi và trách nhiệm của bạn."
                canonical="https://nemark.com/legal"
            />

            {/* All Legal Page Sections */}
            <LegalHeroSection />
            <PolicyCardsSection />
            <LegalSummaryFAQSection />
        </>
    );
};

LegalPage.getLayout = function getLayout(page: ReactElement) {
    return <PublicLayout>{page}</PublicLayout>;
};

export default LegalPage;
