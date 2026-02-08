import React from 'react';
import { useTranslation } from 'react-i18next';
import { Activity, Network, Bot, Webhook, CheckCircle2 } from 'lucide-react';

interface StatusItemProps {
  icon: React.ReactNode;
  label: string;
  status: 'connected' | 'running' | 'healthy';
  statusText: string;
}

const StatusItem: React.FC<StatusItemProps> = ({ icon, label, status, statusText }) => {
  return (
    <div className="flex items-center justify-between p-4 bg-neutral-50/80 rounded-xl hover:bg-neutral-100/80 transition-all group">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-white rounded-lg shadow-sm group-hover:shadow transition-shadow">
          {icon}
        </div>
        <span className="font-medium text-sm text-neutral-700">
          {label}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="status-dot status-dot-success" />
        <span className="text-xs font-semibold text-green-600 bg-green-50 px-2.5 py-1 rounded-full border border-green-100">
          {statusText}
        </span>
      </div>
    </div>
  );
};

export const SystemHealthSection = () => {
  const { t } = useTranslation();

  return (
    <div className="glass-card-enterprise p-6 animate-fade-in-up-delay-3">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="icon-container-success">
            <Activity className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-bold text-neutral-900">
            {t('dashboard.system.title')}
          </h3>
        </div>
        <span className="badge-premium badge-success">
          <CheckCircle2 className="w-3.5 h-3.5" />
          {t('dashboard.system.allHealthy')}
        </span>
      </div>

      <div className="space-y-3">
        <StatusItem
          icon={<Network className="w-5 h-5 text-blue-600" />}
          label={t('dashboard.system.channels')}
          status="connected"
          statusText={t('dashboard.system.connected')}
        />
        <StatusItem
          icon={<Bot className="w-5 h-5 text-purple-600" />}
          label={t('dashboard.system.automation')}
          status="running"
          statusText={t('dashboard.system.running')}
        />
        <StatusItem
          icon={<Webhook className="w-5 h-5 text-amber-600" />}
          label={t('dashboard.system.api')}
          status="healthy"
          statusText={t('dashboard.system.healthy')}
        />
      </div>

      {/* System metrics */}
      <div className="mt-6 pt-4 border-t border-neutral-100">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-xs text-neutral-400 mb-1">Uptime</p>
            <p className="stat-number text-lg text-neutral-900">99.9%</p>
          </div>
          <div>
            <p className="text-xs text-neutral-400 mb-1">Latency</p>
            <p className="stat-number text-lg text-neutral-900">45ms</p>
          </div>
          <div>
            <p className="text-xs text-neutral-400 mb-1">Sync</p>
            <p className="stat-number text-lg text-green-600">Live</p>
          </div>
        </div>
      </div>
    </div>
  );
};
