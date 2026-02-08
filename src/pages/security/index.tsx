import { ReactElement } from 'react';
import type { NextPageWithLayout } from '../_app';
import PublicLayout from '@/components/layout/PublicLayout';
import SeoHead from '@/components/common/SeoHead';
import SecurityHeroSection from '@/components/pages/security/sections/SecurityHeroSection';
import SecurityOverviewSection from '@/components/pages/security/sections/SecurityOverviewSection';
import DataProtectionSection from '@/components/pages/security/sections/DataProtectionSection';
import SecurityFAQCTASection from '@/components/pages/security/sections/SecurityFAQCTASection';

const SecurityPage: NextPageWithLayout = () => {
    return (
        <>
            <SeoHead
                title="Bảo mật Nemark Inbox - Security Overview"
                description="Nemark Inbox được xây dựng với triết lý bảo mật từ thiết kế. RBAC chi tiết, mã hóa đầu cuối, audit logs, và tuân thủ tiêu chuẩn quốc tế."
                canonical="https://nemark.com/security"
            />

            {/* All Security Page Sections */}
            <SecurityHeroSection />
            <SecurityOverviewSection />
            <DataProtectionSection />
            {/* Combined FAQ + Contact + CTA */}
            <SecurityFAQCTASection />
        </>
    );
};

SecurityPage.getLayout = function getLayout(page: ReactElement) {
    return <PublicLayout>{page}</PublicLayout>;
};

export default SecurityPage;
