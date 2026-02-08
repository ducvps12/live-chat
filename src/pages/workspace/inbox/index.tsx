import React, { ReactElement } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { InboxPage } from '@/components/pages/inbox/InboxPage';
import SeoHead from '@/components/common/SeoHead';

import { useTranslation } from 'react-i18next';

const Inbox = () => {
  const { t } = useTranslation();

  return (
    <>
      <SeoHead 
        title={t('inbox.title')} 
        description={t('inbox.seoDescription')}
      />
      <InboxPage />
    </>
  );
};

Inbox.getLayout = function getLayout(page: ReactElement) {
  return <DashboardLayout>{page}</DashboardLayout>;
};

export default Inbox;
