import { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import type { NextPageWithLayout } from '../_app';
import PublicLayout from '@/components/layout/PublicLayout';
import SeoHead from '@/components/common/SeoHead';
import SolutionsHero from '@/components/pages/solutions/sections/SolutionsHero';
import IndustryFilter from '@/components/pages/solutions/sections/IndustryFilter';
import IndustrySolutions from '@/components/pages/solutions/sections/IndustrySolutions';
import SolutionsCTA from '@/components/pages/solutions/sections/SolutionsCTA';
import RoleSolutions from '@/components/pages/solutions/sections/RoleSolutions';
import PlaybookSection from '@/components/pages/solutions/sections/PlaybookSection';
import StatsSection from '@/components/pages/solutions/sections/StatsSection';
import SolutionsFAQ from '@/components/pages/solutions/sections/SolutionsFAQ';
import FinalCTA from '@/components/pages/solutions/sections/FinalCTA';

const SolutionsPage: NextPageWithLayout = () => {
    const { t } = useTranslation();

    return (
        <>
            <SeoHead
                title="Giải pháp Nemark Inbox - Kịch bản Live Chat cho mọi ngành nghề"
                description={t('solutions.hero.subtitle')}
                canonical="https://nemark.com/solutions"
            />

            {/* Hero Section */}
            <SolutionsHero />

            {/* Filter Panel */}
            <IndustryFilter />

            {/* Industry Solutions */}
            <IndustrySolutions />

            {/* Mid CTA */}
            <SolutionsCTA />

            {/* Role Solutions */}
            <RoleSolutions />

            {/* Playbook Section */}
            <PlaybookSection />

            {/* Stats Section */}
            <StatsSection />

            {/* FAQ Section */}
            <SolutionsFAQ />

            {/* Final CTA */}
            <FinalCTA />
        </>
    );
};

SolutionsPage.getLayout = function getLayout(page: ReactElement) {
    return <PublicLayout variant="light">{page}</PublicLayout>;
};

export default SolutionsPage;
