import { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import type { NextPageWithLayout } from '../_app';
import PublicLayout from '@/components/layout/PublicLayout';
import SeoHead from '@/components/common/SeoHead';
import HeroSection from '@/components/pages/home/sections/HeroSection';
import StatsSection from '@/components/pages/home/sections/StatsSection';
import ProblemsSection from '@/components/pages/home/sections/ProblemsSection';
import WorkflowSection from '@/components/pages/home/sections/WorkflowSection';
import FeaturesSection from '@/components/pages/home/sections/FeaturesSection';
import InboxPreviewSection from '@/components/pages/home/sections/InboxPreviewSection';
import UseCasesSection from '@/components/pages/home/sections/UseCasesSection';
import TestimonialsSection from '@/components/pages/home/sections/TestimonialsSection';
import SecuritySection from '@/components/pages/home/sections/SecuritySection';
import FAQSection from '@/components/pages/home/sections/FAQSection';
import CTASection from '@/components/pages/home/sections/CTASection';

const HomePage: NextPageWithLayout = () => {
  const { t } = useTranslation();

  return (
    <>
      <SeoHead
        title="Future of Customer Connection"
        description={t('landing.hero.subtitle')}
        canonical="https://nemark.com"
      />
      
      {/* All Landing Page Sections */}
      <HeroSection />
      <StatsSection />
      <ProblemsSection />
      <WorkflowSection />
      <FeaturesSection />
      <InboxPreviewSection />
      <UseCasesSection />
      <TestimonialsSection />
      <SecuritySection />
      <FAQSection />
      <CTASection />
    </>
  );
};

HomePage.getLayout = function getLayout(page: ReactElement) {
  return <PublicLayout>{page}</PublicLayout>;
};

export default HomePage;
