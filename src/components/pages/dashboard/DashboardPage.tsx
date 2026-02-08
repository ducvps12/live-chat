import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActionRequiredSection } from './sections/ActionRequiredSection';
import { StatsSection } from './sections/StatsSection';
import { ChartSection } from './sections/ChartSection';
import { TeamSection } from './sections/TeamSection';
import { BusinessResultsSection } from './sections/BusinessResultsSection';
import { SystemHealthSection } from './sections/SystemHealthSection';
import { BillingSection } from './sections/BillingSection';
import { Download, RefreshCw } from 'lucide-react';

export const DashboardPage = () => {
  const { t } = useTranslation();

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 animate-fade-in-up">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">
            {t('dashboard.title')}
          </h1>
          <p className="text-neutral-500 mt-1">
            {t('dashboard.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="group flex items-center gap-2 bg-white px-4 py-2.5 rounded-xl border border-neutral-200 shadow-sm text-sm font-medium hover:bg-neutral-50 hover:border-neutral-300 text-neutral-600 transition-all">
            <RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
            Làm mới
          </button>
          <button className="group flex items-center gap-2 bg-white px-4 py-2.5 rounded-xl border border-neutral-200 shadow-sm text-sm font-medium hover:bg-neutral-50 hover:border-neutral-300 text-neutral-600 transition-all">
            <Download className="w-4 h-4 group-hover:translate-y-0.5 transition-transform" />
            {t('dashboard.export')}
          </button>
        </div>
      </div>

      <ActionRequiredSection />

      <StatsSection />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ChartSection />
        <TeamSection />
      </div>

      <BusinessResultsSection />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SystemHealthSection />
        <BillingSection />
      </div>

      <div className="flex justify-between items-center pt-4 border-t border-neutral-100">
        <p className="text-xs text-neutral-400">
          {t('dashboard.lastUpdated', { time: t('dashboard.justNow') })}
        </p>
        <div className="flex items-center gap-2">
          <span className="status-dot status-dot-success" />
          <span className="text-xs text-neutral-500">Hệ thống đang hoạt động ổn định</span>
        </div>
      </div>
    </div>
  );
};
