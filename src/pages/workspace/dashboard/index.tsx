import React, { ReactElement } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DashboardPage } from '@/components/pages/dashboard/DashboardPage';
import SeoHead from '@/components/common/SeoHead';

import { useTranslation } from 'react-i18next';

const Dashboard = () => {
  const { t } = useTranslation();

  return (
    <>
      <SeoHead 
        title={t('dashboard.title')} 
        description={t('dashboard.seoDescription')}
      />
      <DashboardPage />
    </>
  );
};

Dashboard.getLayout = function getLayout(page: ReactElement) {
  return <DashboardLayout>{page}</DashboardLayout>;
};

export default Dashboard;
