import React from 'react';
import { useTranslation } from 'react-i18next';
import { TrendingUp, TrendingDown, Target, Users, Percent, DollarSign } from 'lucide-react';

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  change: {
    value: string;
    isPositive: boolean;
  };
}

const MetricCard: React.FC<MetricCardProps> = ({ icon, label, value, change }) => {
  return (
    <div className="flex flex-col p-4 rounded-xl bg-neutral-50/80 hover:bg-neutral-100/80 transition-all group">
      <div className="flex items-center gap-2 mb-3">
        <div className="p-1.5 bg-white rounded-lg shadow-sm text-neutral-500 group-hover:text-neutral-700 transition-colors">
          {icon}
        </div>
        <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wide">
          {label}
        </span>
      </div>
      <span className="stat-number text-2xl text-neutral-900">{value}</span>
      <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${change.isPositive ? 'text-green-600' : 'text-red-500'}`}>
        {change.isPositive ? (
          <TrendingUp className="w-3.5 h-3.5" />
        ) : (
          <TrendingDown className="w-3.5 h-3.5" />
        )}
        <span>{change.value}</span>
      </div>
    </div>
  );
};

export const BusinessResultsSection = () => {
  const { t } = useTranslation();

  return (
    <div className="glass-card-enterprise p-6 animate-fade-in-up-delay-2">
      <div className="flex items-center gap-3 mb-6">
        <div className="icon-container-gold">
          <Target className="w-5 h-5" />
        </div>
        <h3 className="text-lg font-bold text-neutral-900">
          {t('dashboard.business.title')}
        </h3>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          icon={<Users className="w-4 h-4" />}
          label={t('dashboard.business.leadsCaptured')}
          value="128"
          change={{ value: '↑ 12%', isPositive: true }}
        />
        <MetricCard
          icon={<Target className="w-4 h-4" />}
          label={t('dashboard.business.qualifiedLeads')}
          value="42"
          change={{ value: '↑ 8%', isPositive: true }}
        />
        <MetricCard
          icon={<Percent className="w-4 h-4" />}
          label={t('dashboard.business.conversionRate')}
          value="3.5%"
          change={{ value: '↓ 1.2%', isPositive: false }}
        />
        <MetricCard
          icon={<DollarSign className="w-4 h-4" />}
          label={t('dashboard.business.pipelineValue')}
          value="$12,450"
          change={{ value: '↑ 24%', isPositive: true }}
        />
      </div>

      {/* Mini progress bars */}
      <div className="mt-6 pt-4 border-t border-neutral-100">
        <div className="flex items-center justify-between text-xs text-neutral-500 mb-2">
          <span>Tiến độ tháng này</span>
          <span className="font-semibold text-neutral-700">75%</span>
        </div>
        <div className="progress-bar-premium" style={{ '--progress': '75%' } as React.CSSProperties} />
      </div>
    </div>
  );
};
