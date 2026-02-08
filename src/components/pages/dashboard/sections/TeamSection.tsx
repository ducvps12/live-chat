import React from 'react';
import { useTranslation } from 'react-i18next';
import { Users, UserPlus, AlertTriangle, TrendingUp } from 'lucide-react';

export const TeamSection = () => {
  const { t } = useTranslation();

  // SVG Donut Chart values
  const totalAgents = 10;
  const onlineAgents = 8;
  const percentage = (onlineAgents / totalAgents) * 100;
  const circumference = 2 * Math.PI * 45; // radius = 45
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="glass-card-enterprise p-6 flex flex-col animate-fade-in-up-delay-2">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
          <Users className="w-5 h-5 text-neutral-500" />
          {t('dashboard.team.title')}
        </h3>
        <span className="badge-premium badge-danger">
          <AlertTriangle className="w-3 h-3" />
          {t('dashboard.team.overloaded')}
        </span>
      </div>

      <div className="flex-1 flex flex-col justify-center items-center py-6">
        {/* Animated SVG Donut Chart */}
        <div className="relative w-36 h-36">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
            {/* Background circle */}
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="#e5e7eb"
              strokeWidth="8"
            />
            {/* Progress circle with gradient */}
            <defs>
              <linearGradient id="donutGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#3b5998" />
                <stop offset="100%" stopColor="#1e3a6e" />
              </linearGradient>
            </defs>
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="url(#donutGradient)"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="donut-chart-ring"
              style={{
                transition: 'stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
            />
          </svg>
          {/* Center content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="stat-number text-3xl text-neutral-900">{onlineAgents}/{totalAgents}</span>
            <span className="text-[10px] text-neutral-400 uppercase font-semibold tracking-wider">
              {t('dashboard.team.agentOnline')}
            </span>
          </div>
        </div>

        <div className="mt-8 text-center">
          <p className="text-sm font-medium text-neutral-600">
            {t('dashboard.team.avgPerformance')}
          </p>
          <p className="stat-number text-2xl text-neutral-900 mt-1">
            4.8 <span className="text-sm font-normal text-neutral-400">{t('dashboard.team.chatsPerAgent')}</span>
          </p>
          <div className="mt-3 inline-flex items-center gap-1.5 text-xs text-red-600 bg-red-50 px-3 py-1.5 rounded-full">
            <TrendingUp className="w-3.5 h-3.5" />
            {t('dashboard.team.higherThanRecommended', { value: '+1.2' })}
          </div>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-neutral-100 flex flex-col gap-2">
        <button className="w-full py-2.5 text-sm text-neutral-600 hover:bg-neutral-50 rounded-lg transition-all font-medium hover:shadow-sm">
          {t('dashboard.team.viewDetails')}
        </button>
        <button className="w-full py-2.5 text-sm text-white rounded-lg transition-all font-semibold gradient-animated flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-blue-500/25">
          <UserPlus className="w-4 h-4" />
          {t('dashboard.team.inviteAgent')}
        </button>
      </div>
    </div>
  );
};
