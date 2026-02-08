import { ReactElement, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';
import type { NextPageWithLayout } from './_app';
import { useUser } from '@/hooks/useAuth';
import { useOnboardingStatus } from '@/hooks/useOnboardingAPI';
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

const IndexPage: NextPageWithLayout = () => {
  const router = useRouter();
  const { t } = useTranslation();
  const hasRedirected = useRef(false);
  const [hasToken, setHasToken] = useState(false);

  // Check for auth token on mount only (avoid hydration mismatch)
  useEffect(() => {
    setHasToken(!!localStorage.getItem('auth_token'));
  }, []);

  const { data: userResponse, isLoading: userLoading } = useUser();
  const { data: onboardingStatus, isLoading: statusLoading } = useOnboardingStatus({
    enabled: !!userResponse && hasToken,
  });

  useEffect(() => {
    // Skip if no token - show landing page directly
    if (!hasToken) return;

    // Wait for data to load
    if (userLoading || statusLoading) return;

    // Prevent multiple redirects
    if (hasRedirected.current) return;

    // If logged in → redirect based on workspace status
    if (userResponse && onboardingStatus) {
      hasRedirected.current = true;
      if (onboardingStatus.needsOnboarding) {
        router.replace('/onboarding?step=1');
      } else {
        router.replace('/workspace/inbox');
      }
    }
  }, [userResponse, userLoading, onboardingStatus, statusLoading, router, hasToken]);

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

IndexPage.getLayout = function getLayout(page: ReactElement) {
  return <PublicLayout>{page}</PublicLayout>;
};

export default IndexPage;
