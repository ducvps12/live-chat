import dayjs from 'dayjs';
import type { AnalyticsReport, MetricComparison } from './analytics.types';

export const PERIOD_LABELS: Record<AnalyticsReport['period']['key'], string> = {
    today: 'Hôm nay',
    '7d': '7 ngày',
    '30d': '30 ngày',
    '90d': '90 ngày',
};

export const formatNumber = (value?: number | null) => (
    new Intl.NumberFormat('vi-VN').format(value ?? 0)
);

export const formatPercent = (value?: number | null) => (
    value === null || value === undefined
        ? 'Chưa có'
        : `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(value)}%`
);

export const formatCurrency = (value?: number | null) => (
    new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND',
        maximumFractionDigits: 0,
    }).format(value ?? 0)
);

export const formatDuration = (seconds?: number | null) => {
    if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return 'Chưa có';
    if (seconds < 60) return `${Math.round(seconds)} giây`;
    if (seconds < 3600) {
        const minutes = Math.floor(seconds / 60);
        const remainder = Math.round(seconds % 60);
        return remainder ? `${minutes}p ${remainder}s` : `${minutes} phút`;
    }

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return minutes ? `${hours}g ${minutes}p` : `${hours} giờ`;
};

export const formatDateTime = (value?: string | null) => (
    value ? dayjs(value).format('DD/MM/YYYY HH:mm') : 'Chưa có'
);

export const formatShortDateTime = (value?: string | null) => (
    value ? dayjs(value).format('DD/MM HH:mm') : 'Chưa có'
);

export const getComparisonLabel = (comparison?: MetricComparison | null) => {
    if (!comparison) return 'Chưa có kỳ trước';
    if (comparison.changePercent === null) {
        return (comparison.current ?? 0) > 0 ? 'Mới trong kỳ này' : 'Chưa có dữ liệu';
    }
    if (comparison.direction === 'flat') return 'Không đổi so với kỳ trước';

    const sign = comparison.changePercent > 0 ? '+' : '';
    return `${sign}${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(comparison.changePercent)}% so với kỳ trước`;
};

export const getComparisonTone = (
    comparison?: MetricComparison | null,
    lowerIsBetter = false,
): 'positive' | 'negative' | 'neutral' => {
    if (!comparison || comparison.direction === 'flat') return 'neutral';
    if (comparison.changePercent === null) return 'neutral';
    const improved = lowerIsBetter
        ? comparison.direction === 'down'
        : comparison.direction === 'up';
    return improved ? 'positive' : 'negative';
};

const csvCell = (value: string | number | null | undefined) => {
    const text = String(value ?? '');
    return `"${text.replace(/"/g, '""')}"`;
};

export const buildAnalyticsCsv = (report: AnalyticsReport) => {
    const rows: Array<Array<string | number | null | undefined>> = [
        ['BÁO CÁO VẬN HÀNH NEMARKCHAT'],
        ['Khoảng thời gian', formatDateTime(report.period.start), formatDateTime(report.period.end)],
        ['Tạo lúc', formatDateTime(report.generatedAt)],
        [],
        ['CHỈ SỐ TỔNG QUAN', 'Giá trị'],
        ['Hội thoại', report.kpis.conversations],
        ['Tin nhắn', report.kpis.messages],
        ['Đã xử lý', report.kpis.resolved],
        ['Tỷ lệ xử lý', formatPercent(report.kpis.resolutionRate)],
        ['Tỷ lệ phản hồi', formatPercent(report.kpis.responseRate)],
        ['Phản hồi đầu tiên', formatDuration(report.kpis.avgFirstResponseSeconds)],
        ['Lead', report.kpis.leads ?? 0],
        ['Đơn hàng', report.kpis.orders ?? 0],
        ['Doanh thu', report.kpis.orderValue ?? 0],
        ['SLA quá hạn', report.kpis.slaBreached ?? 0],
        ['SLA sắp hạn', report.kpis.slaAtRisk ?? 0],
        [],
        ['THEO THỜI GIAN', 'Hội thoại', 'Tin nhắn', 'Đã xử lý', 'Khách mới'],
        ...report.timeSeries.map(item => [
            item.label,
            item.conversations,
            item.messages,
            item.resolved,
            item.newVisitors,
        ]),
        [],
        ['THEO KÊNH', 'Hội thoại', 'Tin nhắn', 'Đã xử lý', 'Tỷ lệ phản hồi', 'Phản hồi đầu tiên'],
        ...report.channels.map(item => [
            item.channel,
            item.conversations,
            item.messages,
            item.resolved,
            formatPercent(item.responseRate),
            formatDuration(item.avgFirstResponseSeconds),
        ]),
        [],
        ['HIỆU SUẤT AGENT', 'Được giao', 'Đã xử lý', 'Tỷ lệ xử lý', 'Tin đã gửi', 'Phản hồi đầu tiên'],
        ...(report.agentPerformance ?? []).map(item => [
            item.name,
            item.assigned,
            item.resolved,
            formatPercent(item.resolutionRate),
            item.sentMessages,
            formatDuration(item.avgFirstResponseSeconds),
        ]),
    ];

    return `\uFEFF${rows.map(row => row.map(csvCell).join(',')).join('\r\n')}`;
};

export const downloadAnalyticsCsv = (report: AnalyticsReport) => {
    const content = buildAnalyticsCsv(report);
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `nemarkchat-analytics-${report.period.key}-${dayjs().format('YYYYMMDD-HHmm')}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
};
