import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Spin, Select } from 'antd';
import { useMyStore } from '@/contexts/MyStoreContext';
import api from '@/lib/http';
import { BarChart3, Calendar } from 'lucide-react';

interface ChartDataPoint {
  date: string;
  count: number;
  visitorCount?: number;
  agentCount?: number;
  botCount?: number;
}

export const ChartSection = () => {
  const { t } = useTranslation();
  const { activeWorkspace } = useMyStore();
  const workspaceId = activeWorkspace?.workspaceId;

  const [loading, setLoading] = useState(false);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [days, setDays] = useState(7);
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);

  useEffect(() => {
    if (!workspaceId) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/workspaces/${workspaceId}/analytics/chart?type=conversations&days=${days}`);
        setChartData(res.data?.data?.chartData || []);
      } catch (error) {
        console.error('Failed to fetch chart data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [workspaceId, days]);

  const maxCount = Math.max(...chartData.map(d => d.count), 1);
  const displayData = chartData.slice(-days);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('vi-VN', { weekday: 'short', day: 'numeric' });
  };

  const formatFullDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('vi-VN', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    });
  };

  return (
    <div className="lg:col-span-2 glass-card-enterprise p-6 animate-fade-in-up-delay-1">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="icon-container-gradient">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-neutral-900">
              {t('dashboard.charts.conversationTrend')}
            </h3>
            <p className="text-sm text-neutral-500">
              Số cuộc hội thoại theo ngày
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-neutral-400" />
          <Select
            value={days}
            onChange={setDays}
            style={{ width: 120 }}
            className="rounded-lg"
            options={[
              { value: 7, label: '7 ngày' },
              { value: 14, label: '14 ngày' },
              { value: 30, label: '30 ngày' },
            ]}
          />
        </div>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <div className="w-8 h-8 border-3 border-neutral-200 border-t-primary-500 rounded-full animate-spin"></div>
        </div>
      ) : displayData.length === 0 ? (
        <div className="h-64 flex flex-col items-center justify-center text-neutral-400">
          <BarChart3 className="w-12 h-12 mb-3 opacity-30" />
          <p className="text-sm">Chưa có dữ liệu</p>
        </div>
      ) : (
        <>
          <div className="h-64 flex items-end justify-between gap-2 px-2 relative">
            {/* Y-axis labels */}
            <div className="absolute left-0 top-0 bottom-0 w-10 flex flex-col justify-between text-[10px] text-neutral-400 font-medium">
              <span>{maxCount}</span>
              <span>{Math.floor(maxCount / 2)}</span>
              <span>0</span>
            </div>

            {/* Grid lines */}
            <div className="absolute left-12 right-2 top-0 bottom-0 flex flex-col justify-between pointer-events-none">
              {[0, 1, 2].map(i => (
                <div key={i} className="border-t border-dashed border-neutral-100 w-full h-0" />
              ))}
            </div>

            {/* Bars */}
            <div className="flex-1 flex items-end justify-between gap-1 ml-12">
              {displayData.map((d, i) => {
                const height = maxCount > 0 ? (d.count / maxCount) * 100 : 0;
                const isHovered = hoveredBar === i;

                return (
                  <div
                    key={i}
                    className="flex-1 relative group"
                    onMouseEnter={() => setHoveredBar(i)}
                    onMouseLeave={() => setHoveredBar(null)}
                  >
                    {/* Bar */}
                    <div
                      className={`chart-bar-premium w-full transition-all duration-300 ${isHovered ? 'glow-blue' : ''}`}
                      style={{
                        height: `${Math.max(height, 3)}%`,
                        minHeight: '8px'
                      }}
                    />

                    {/* Tooltip */}
                    <div
                      className={`absolute -top-16 left-1/2 transform -translate-x-1/2 z-20 transition-all duration-200 ${isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
                        }`}
                    >
                      <div className="bg-neutral-900 text-white text-xs py-2 px-3 rounded-lg shadow-xl whitespace-nowrap">
                        <div className="font-semibold text-sm">{d.count} cuộc hội thoại</div>
                        <div className="text-neutral-400 mt-0.5">{formatFullDate(d.date)}</div>
                      </div>
                      <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-l-transparent border-r-transparent border-t-neutral-900 mx-auto" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* X-axis labels */}
          <div className="flex justify-between mt-3 text-[10px] text-neutral-400 font-medium pl-12 pr-2">
            {displayData.map((d, i) => (
              <span
                key={i}
                className={`truncate text-center flex-1 transition-colors ${hoveredBar === i ? 'text-neutral-700 font-semibold' : ''}`}
              >
                {formatDate(d.date)}
              </span>
            ))}
          </div>

          {/* Chart legend */}
          <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-neutral-100">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm gradient-animated" />
              <span className="text-xs text-neutral-500">Hội thoại</span>
            </div>
            <div className="text-xs text-neutral-400">
              Tổng: <span className="font-semibold text-neutral-700">{displayData.reduce((acc, d) => acc + d.count, 0)}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
