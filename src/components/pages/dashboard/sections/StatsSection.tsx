import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Spin } from 'antd';
import { useMyStore } from '@/contexts/MyStoreContext';
import api from '@/lib/http';
import {
  MessageSquare,
  Mail,
  Clock,
  Bot,
  TrendingUp,
  TrendingDown,
  Users,
  UserCheck,
  Zap
} from 'lucide-react';

interface DashboardData {
  summary: {
    totalConversations: number;
    activeConversations: number;
    closedConversations: number;
    newToday: number;
    newThisWeek: number;
    totalMessages: number;
    visitorMessages: number;
    agentMessages: number;
    botMessages: number;
  };
  responseTime: {
    average: string;
    min: string;
    max: string;
    respondedCount: number;
  };
  bot: {
    messages: number;
    responseRate: number;
  };
}

// Animated counter hook
const useAnimatedCounter = (targetValue: number, duration: number = 1000) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (targetValue === 0) {
      setCount(0);
      return;
    }

    const startTime = Date.now();
    const startValue = 0;

    const animate = () => {
      const now = Date.now();
      const progress = Math.min((now - startTime) / duration, 1);
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      const currentValue = Math.floor(startValue + (targetValue - startValue) * easeOutQuart);

      setCount(currentValue);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [targetValue, duration]);

  return count;
};

// Stat Card Component
interface StatCardProps {
  icon: React.ReactNode;
  iconClass: string;
  label: string;
  value: number | string;
  subtext: string | React.ReactNode;
  badge?: {
    text: string;
    variant: 'success' | 'warning' | 'info';
  };
  delay?: number;
}

const StatCard: React.FC<StatCardProps> = ({ icon, iconClass, label, value, subtext, badge, delay = 0 }) => {
  const animatedValue = useAnimatedCounter(typeof value === 'number' ? value : 0, 1200);

  return (
    <div
      className={`stat-card-premium card-3d animate-fade-in-up${delay > 0 ? `-delay-${delay}` : ''}`}
      style={{ animationDelay: `${delay * 0.1}s` }}
    >
      <div className="flex justify-between items-start mb-4">
        <div className={`icon-container-gradient ${iconClass}`}>
          {icon}
        </div>
        {badge && (
          <span className={`badge-premium badge-${badge.variant}`}>
            {badge.variant === 'success' && <TrendingUp className="w-3 h-3" />}
            {badge.variant === 'warning' && <TrendingDown className="w-3 h-3" />}
            {badge.text}
          </span>
        )}
      </div>

      <p className="text-sm font-medium text-neutral-500 mb-1">
        {label}
      </p>

      <h3 className="stat-number text-3xl text-neutral-900 mb-2">
        {typeof value === 'number' ? animatedValue.toLocaleString() : value}
      </h3>

      <p className="text-xs text-neutral-400">
        {subtext}
      </p>
    </div>
  );
};

export const StatsSection = () => {
  const { t } = useTranslation();
  const { activeWorkspace } = useMyStore();
  const workspaceId = activeWorkspace?.workspaceId;

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    if (!workspaceId) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/workspaces/${workspaceId}/analytics/dashboard?range=last30days`);
        setData(res.data?.data || null);
      } catch (error) {
        console.error('Failed to fetch analytics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [workspaceId]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="stat-card-premium flex items-center justify-center h-40">
            <div className="relative">
              <div className="w-10 h-10 border-3 border-neutral-200 border-t-primary-500 rounded-full animate-spin"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  const summary = data?.summary || { totalConversations: 0, activeConversations: 0, newToday: 0, totalMessages: 0, visitorMessages: 0, agentMessages: 0, botMessages: 0 };
  const responseTime = data?.responseTime || { average: 'N/A', respondedCount: 0 };
  const bot = data?.bot || { messages: 0, responseRate: 0 };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {/* Card 1: Total Conversations */}
      <StatCard
        icon={<MessageSquare className="w-5 h-5" />}
        iconClass=""
        label={t('dashboard.stats.totalConversations')}
        value={summary.totalConversations}
        subtext={`${summary.activeConversations} đang hoạt động`}
        badge={{
          text: `+${summary.newToday} hôm nay`,
          variant: 'success'
        }}
        delay={0}
      />

      {/* Card 2: Messages */}
      <StatCard
        icon={<Mail className="w-5 h-5" />}
        iconClass="icon-container-gold"
        label="Tổng tin nhắn"
        value={summary.totalMessages}
        subtext={
          <span className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3 text-blue-500" />
              <span>{summary.visitorMessages}</span>
            </span>
            <span className="flex items-center gap-1">
              <UserCheck className="w-3 h-3 text-green-500" />
              <span>{summary.agentMessages}</span>
            </span>
            <span className="flex items-center gap-1">
              <Bot className="w-3 h-3 text-purple-500" />
              <span>{summary.botMessages}</span>
            </span>
          </span>
        }
        badge={{
          text: '30 ngày',
          variant: 'info'
        }}
        delay={1}
      />

      {/* Card 3: Response Time */}
      <StatCard
        icon={<Clock className="w-5 h-5" />}
        iconClass="icon-container-success"
        label={t('dashboard.stats.firstResponse')}
        value={responseTime.average}
        subtext={`${responseTime.respondedCount} cuộc hội thoại đã phản hồi`}
        badge={{
          text: 'Trung bình',
          variant: 'success'
        }}
        delay={2}
      />

      {/* Card 4: Bot Performance */}
      <StatCard
        icon={<Zap className="w-5 h-5" />}
        iconClass="icon-container-purple"
        label="Bot Auto-Reply"
        value={bot.messages}
        subtext="Tỷ lệ tự động phản hồi"
        badge={{
          text: `${bot.responseRate}% tự động`,
          variant: bot.responseRate > 50 ? 'success' : 'warning'
        }}
        delay={3}
      />
    </div>
  );
};
