import React from 'react';
import { useTranslation } from 'react-i18next';
import Link from 'next/link';
import { CreditCard, Sparkles, Clock, ArrowUpRight } from 'lucide-react';

export const BillingSection = () => {
  const { t } = useTranslation();

  const quotaPercentage = 80;

  return (
    <div className="glass-card-enterprise p-6 animate-fade-in-up-delay-3">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="icon-container-gradient">
            <CreditCard className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-bold text-neutral-900">
            {t('dashboard.billing.title')}
          </h3>
        </div>
        <Link
          href="/workspace/settings/billing"
          className="flex items-center gap-1 text-xs font-semibold text-primary-600 hover:text-primary-700 transition-colors group"
        >
          {t('dashboard.billing.upgrade')}
          <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
        </Link>
      </div>

      {/* Plan card with animated border */}
      <div className="animated-border">
        <div className="p-5 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span className="text-sm font-bold text-neutral-900">
                {t('dashboard.billing.proPlan')}
              </span>
            </div>
            <span className="badge-premium badge-warning">
              {t('dashboard.billing.quotaUsed', { percentage: quotaPercentage })}
            </span>
          </div>

          {/* Progress bar */}
          <div className="relative h-2.5 bg-white rounded-full overflow-hidden shadow-inner">
            <div
              className="absolute inset-y-0 left-0 rounded-full gradient-animated transition-all duration-700"
              style={{ width: `${quotaPercentage}%` }}
            />
            {/* Shimmer effect */}
            <div
              className="absolute inset-y-0 left-0 shimmer-premium rounded-full"
              style={{ width: `${quotaPercentage}%` }}
            />
          </div>

          <div className="flex justify-between items-center mt-4 text-xs">
            <span className="text-neutral-600 font-medium">
              {t('dashboard.billing.mauUsage', { current: '4,102', total: '5,000' })}
            </span>
            <span className="hidden sm:inline text-neutral-500">
              {t('dashboard.billing.storageUsage', { used: '2.5GB', total: '5GB' })}
            </span>
          </div>
        </div>
      </div>

      {/* Expiry warning */}
      <div className="flex items-center gap-2 mt-5 text-xs text-amber-600 bg-amber-50 px-4 py-2.5 rounded-lg border border-amber-100">
        <Clock className="w-4 h-4" />
        <span className="font-medium">{t('dashboard.billing.expiryWarning', { days: 12 })}</span>
      </div>

      {/* Quick actions */}
      <div className="mt-4 flex gap-2">
        <button className="flex-1 py-2.5 text-xs font-medium text-neutral-600 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors">
          Xem lịch sử
        </button>
        <button className="flex-1 py-2.5 text-xs font-semibold text-white rounded-lg gradient-animated hover:shadow-lg hover:shadow-blue-500/25 transition-all">
          Nâng cấp ngay
        </button>
      </div>
    </div>
  );
};
