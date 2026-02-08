import { ReactElement } from 'react';
import type { NextPageWithLayout } from '../_app';
import PublicLayout from '@/components/layout/PublicLayout';
import SeoHead from '@/components/common/SeoHead';
import CaseStudyHeroSection from '@/components/pages/customers/sections/CaseStudyHeroSection';
import FeaturedCasesSection from '@/components/pages/customers/sections/FeaturedCasesSection';
import CustomerStatsSection from '@/components/pages/customers/sections/CustomerStatsSection';
import CaseLibrarySection from '@/components/pages/customers/sections/CaseLibrarySection';
import CustomerTestimonialsSection from '@/components/pages/customers/sections/CustomerTestimonialsSection';
import PlaybookModulesSection from '@/components/pages/customers/sections/PlaybookModulesSection';
import CustomerCTASection from '@/components/pages/customers/sections/CustomerCTASection';

const CustomersPage: NextPageWithLayout = () => {
    return (
        <>
            <SeoHead
                title="Khách hàng & Case Study - Nemark Inbox"
                description="Xem cách các đội Sales & CSKH sử dụng Nemark Inbox để phản hồi nhanh và chốt nhiều hơn."
                canonical="https://nemark.com/customers"
            />

            {/* All Customer Page Sections */}
            <CaseStudyHeroSection />
            <FeaturedCasesSection />
            <CustomerStatsSection />
            <CaseLibrarySection />
            <CustomerTestimonialsSection />
            <PlaybookModulesSection />
            <CustomerCTASection />
        </>
    );
};

CustomersPage.getLayout = function getLayout(page: ReactElement) {
    return <PublicLayout>{page}</PublicLayout>;
};

export default CustomersPage;
