import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Button, Select, Spin, Switch, Tag } from 'antd';
import {
    Activity,
    ArrowRight,
    BarChart3,
    Bot,
    Clock3,
    ExternalLink,
    Globe2,
    MessageSquare,
    MousePointer2,
    Radio,
    RefreshCw,
    Settings2,
    ShieldCheck,
    Smartphone,
    Users,
    Wifi,
    type LucideIcon,
} from 'lucide-react';
import { isAxiosError } from 'axios';
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip as ChartTooltip,
    XAxis,
    YAxis,
} from 'recharts';
import AppLayout from '../../components/layout/AppLayout';
import { httpClient } from '../../lib/http/client';
import type { AnalyticsReport } from './analytics.types';
import WorkspaceAnalyticsReport from './WorkspaceAnalyticsReport';

export type AnalyticsSurface = 'live' | 'report' | 'settings';
type AnalyticsPeriod = 'today' | '7d' | '30d' | '90d';

type RecentVisitor = {
    id: string;
    visitorId: string;
    name: string;
    email: string;
    firstSeenAt: string;
    lastSeenAt: string;
    totalConversations: number;
    isActive: boolean;
    channel: string;
    pageUrl?: string | null;
    domain?: string | null;
    referrer?: string | null;
    utmSource?: string | null;
    country?: string | null;
    countryCode?: string | null;
    city?: string | null;
    browser?: string | null;
    os?: string | null;
    device?: string | null;
};

type AnalyticsPayload = AnalyticsReport & { recentVisitors: RecentVisitor[] };

type DashboardPreferences = {
    autoRefresh: boolean;
    compactRows: boolean;
    maskVisitorIds: boolean;
};

const EMPTY_ANALYTICS: AnalyticsPayload = {
    generatedAt: '',
    liveWindowMinutes: 5,
    period: { key: '7d', start: '', end: '', timezone: 'Asia/Ho_Chi_Minh', granularity: 'day' },
    kpis: {
        conversations: 0,
        newVisitors: 0,
        messages: 0,
        open: 0,
        resolved: 0,
        totalResolved: 0,
        activeVisitors: 0,
        responseRate: null,
        avgFirstResponseSeconds: null,
    },
    timeSeries: [],
    channels: [],
    recentVisitors: [],
    geography: [],
    sources: [],
    responseTimeBuckets: [],
};

const CHANNEL_META: Record<string, { label: string; color: string }> = {
    website: { label: 'Website', color: '#2563eb' },
    zalo: { label: 'Zalo cá nhân', color: '#06b6d4' },
    facebook: { label: 'Facebook', color: '#6366f1' },
    email: { label: 'Email', color: '#f59e0b' },
    unknown: { label: 'Chưa xác định', color: '#94a3b8' },
};

const COUNTRY_POINTS: Record<string, { x: number; y: number }> = {
    VN: { x: 620, y: 210 },
    VIETNAM: { x: 620, y: 210 },
    US: { x: 155, y: 150 },
    USA: { x: 155, y: 150 },
    'UNITED STATES': { x: 155, y: 150 },
    ES: { x: 390, y: 157 },
    SPAIN: { x: 390, y: 157 },
    FR: { x: 407, y: 138 },
    FRANCE: { x: 407, y: 138 },
    DE: { x: 430, y: 128 },
    GERMANY: { x: 430, y: 128 },
    GB: { x: 392, y: 115 },
    UK: { x: 392, y: 115 },
    JP: { x: 686, y: 151 },
    JAPAN: { x: 686, y: 151 },
    SG: { x: 603, y: 242 },
    SINGAPORE: { x: 603, y: 242 },
    AU: { x: 676, y: 284 },
    AUSTRALIA: { x: 676, y: 284 },
};

const formatAgo = (value?: string | null) => {
    if (!value) return 'Chưa có dữ liệu';
    const diff = Date.now() - new Date(value).getTime();
    if (diff < 60_000) return 'Vừa xong';
    if (diff < 3_600_000) return `${Math.max(1, Math.floor(diff / 60_000))} phút trước`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} giờ trước`;
    return `${Math.floor(diff / 86_400_000)} ngày trước`;
};

const formatDuration = (seconds: number | null) => {
    if (seconds === null || !Number.isFinite(seconds)) return 'Chưa đủ mẫu';
    if (seconds < 60) return `${seconds} giây`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}p ${seconds % 60}s`;
    return `${Math.floor(seconds / 3600)}g ${Math.floor((seconds % 3600) / 60)}p`;
};

const getChannelMeta = (channel?: string | null) => CHANNEL_META[channel || 'unknown'] || {
    label: channel || 'Chưa xác định',
    color: '#64748b',
};

const maskVisitorId = (visitorId: string) => {
    if (visitorId.length <= 9) return visitorId;
    return `${visitorId.slice(0, 5)}•••${visitorId.slice(-4)}`;
};

export default function WorkspaceAnalytics({ surface }: { surface: AnalyticsSurface }) {
    const router = useRouter();
    const workspaceId = typeof router.query.workspaceId === 'string' ? router.query.workspaceId : '';
    const [ready, setReady] = useState(false);
    const [period, setPeriod] = useState<AnalyticsPeriod>('7d');
    const [data, setData] = useState<AnalyticsPayload>(EMPTY_ANALYTICS);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState('');
    const [preferences, setPreferences] = useState<DashboardPreferences>({
        autoRefresh: true,
        compactRows: false,
        maskVisitorIds: false,
    });

    useEffect(() => {
        const token = localStorage.getItem('nemark_token');
        if (!token) router.replace('/auth/login');
        try {
            const saved = localStorage.getItem('nemark_analytics_preferences');
            if (saved) setPreferences((current) => ({ ...current, ...JSON.parse(saved) }));
        } catch { /* keep safe defaults */ }
        setReady(true);
    }, [router]);

    const fetchAnalytics = useCallback(async (silent = false) => {
        if (!workspaceId) return;
        if (silent) setRefreshing(true);
        else setLoading(true);
        try {
            const response = await httpClient.get(`/workspaces/${workspaceId}/analytics?period=${period}`);
            setData(response.data?.data || EMPTY_ANALYTICS);
            setError('');
        } catch (requestError: unknown) {
            const responseMessage = isAxiosError<{ message?: string }>(requestError)
                ? requestError.response?.data?.message
                : undefined;
            setError(responseMessage || 'Không thể tải dữ liệu phân tích.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [period, workspaceId]);

    useEffect(() => {
        if (ready && workspaceId) fetchAnalytics();
    }, [fetchAnalytics, ready, workspaceId]);

    useEffect(() => {
        if (surface !== 'live' || !preferences.autoRefresh || !workspaceId) return undefined;
        const timer = window.setInterval(() => fetchAnalytics(true), 15_000);
        return () => window.clearInterval(timer);
    }, [fetchAnalytics, preferences.autoRefresh, surface, workspaceId]);

    const updatePreference = (key: keyof DashboardPreferences, value: boolean) => {
        const next = { ...preferences, [key]: value };
        setPreferences(next);
        localStorage.setItem('nemark_analytics_preferences', JSON.stringify(next));
    };

    const navigation = [
        { key: 'live', label: 'Trực tiếp', icon: Radio, href: `/workspace/${workspaceId}/analytics/live` },
        { key: 'report', label: 'Báo cáo', icon: BarChart3, href: `/workspace/${workspaceId}/analytics` },
        { key: 'settings', label: 'Cài đặt', icon: Settings2, href: `/workspace/${workspaceId}/analytics/settings` },
    ];

    if (!ready || !workspaceId) {
        return <div className="analytics-loading"><Spin size="large" /></div>;
    }

    return (
        <AppLayout
            headerTitle={(
                <div className="analytics-header-title">
                    <span className="analytics-header-icon"><Activity size={18} /></span>
                    <span>Phân tích vận hành</span>
                </div>
            )}
            headerExtra={(
                <Button
                    icon={<RefreshCw size={15} className={refreshing ? 'analytics-spin' : ''} />}
                    onClick={() => fetchAnalytics(true)}
                    disabled={refreshing}
                    aria-label="Làm mới dữ liệu phân tích"
                >
                    Làm mới
                </Button>
            )}
        >
            <Head><title>Phân tích | NemarkChat</title></Head>
            <style>{analyticsStyles}</style>
            <main className="analytics-shell">
                <section className="analytics-topbar">
                    <nav className="analytics-tabs" aria-label="Khu vực phân tích">
                        {navigation.map((item) => {
                            const Icon = item.icon;
                            return (
                                <Link key={item.key} href={item.href} className={surface === item.key ? 'active' : ''}>
                                    <Icon size={15} />
                                    <span>{item.label}</span>
                                </Link>
                            );
                        })}
                    </nav>
                    {surface !== 'settings' && (
                        <div className="analytics-period">
                            <span>Khoảng thời gian</span>
                            <Select<AnalyticsPeriod>
                                value={period}
                                onChange={setPeriod}
                                options={[
                                    { value: 'today', label: 'Hôm nay' },
                                    { value: '7d', label: '7 ngày' },
                                    { value: '30d', label: '30 ngày' },
                                    { value: '90d', label: '90 ngày' },
                                ]}
                            />
                        </div>
                    )}
                </section>

                {error && (
                    <div className="analytics-error">
                        <strong>Chưa tải được dữ liệu</strong>
                        <span>{error}</span>
                        <Button size="small" onClick={() => fetchAnalytics()}>Thử lại</Button>
                    </div>
                )}

                {loading ? (
                    <div className="analytics-content-loading"><Spin size="large" /></div>
                ) : surface === 'live' ? (
                    <LiveAnalytics data={data} preferences={preferences} />
                ) : surface === 'settings' ? (
                    <AnalyticsSettings
                        data={data}
                        workspaceId={workspaceId}
                        preferences={preferences}
                        updatePreference={updatePreference}
                    />
                ) : (
                    <WorkspaceAnalyticsReport data={data} workspaceId={workspaceId} />
                )}
            </main>
        </AppLayout>
    );
}

function LiveAnalytics({ data, preferences }: { data: AnalyticsPayload; preferences: DashboardPreferences }) {
    const activeVisitors = data.recentVisitors.filter((visitor) => visitor.isActive);
    const mapPoints = useMemo(() => {
        const groups = new Map<string, { key: string; label: string; x: number; y: number; count: number }>();
        for (const visitor of data.recentVisitors) {
            const key = String(visitor.countryCode || visitor.country || '').toUpperCase();
            const point = COUNTRY_POINTS[key];
            if (!point) continue;
            const current = groups.get(key);
            if (current) current.count += 1;
            else groups.set(key, { key, label: visitor.country || visitor.countryCode || key, ...point, count: 1 });
        }
        return [...groups.values()];
    }, [data.recentVisitors]);

    return (
        <div className="analytics-stack">
            <section className="analytics-kpis">
                <MetricCard icon={Wifi} label="Đang hoạt động" value={data.kpis.activeVisitors} tone="green" helper={`${data.liveWindowMinutes} phút gần nhất`} />
                <MetricCard icon={MessageSquare} label="Hội thoại mở" value={data.kpis.open} tone="blue" helper="Open + pending" />
                <MetricCard icon={Users} label="Khách trong kỳ" value={data.kpis.newVisitors} tone="violet" helper={data.period.key === 'today' ? 'Hôm nay' : `${data.timeSeries.length} mốc dữ liệu`} />
                <MetricCard icon={Clock3} label="Phản hồi đầu" value={formatDuration(data.kpis.avgFirstResponseSeconds)} tone="amber" helper="Dữ liệu hội thoại thật" />
            </section>

            <section className="analytics-live-grid">
                <article className="analytics-card analytics-map-card">
                    <CardHeading
                        eyebrow="Live operations"
                        title="Bản đồ phiên gần đây"
                        aside={<span className="live-chip"><i /> Cập nhật {formatAgo(data.generatedAt)}</span>}
                    />
                    <div className="activity-map" role="img" aria-label="Bản đồ phân bổ khách truy cập theo metadata quốc gia">
                        <svg viewBox="0 0 800 360" aria-hidden="true">
                            <defs>
                                <radialGradient id="mapGlow" cx="50%" cy="45%" r="70%">
                                    <stop offset="0%" stopColor="#dbeafe" stopOpacity=".9" />
                                    <stop offset="100%" stopColor="#eff6ff" stopOpacity=".25" />
                                </radialGradient>
                            </defs>
                            <rect width="800" height="360" rx="18" fill="url(#mapGlow)" />
                            <g className="map-grid-lines">
                                {[80, 160, 240, 320].map((y) => <line key={`y${y}`} x1="0" y1={y} x2="800" y2={y} />)}
                                {[100, 200, 300, 400, 500, 600, 700].map((x) => <line key={`x${x}`} x1={x} y1="0" x2={x} y2="360" />)}
                            </g>
                            <g className="map-land">
                                <path d="M72 95l45-37 86 9 50 33-20 38-38 6-17 39-34 25-31-30-18-47z" />
                                <path d="M201 206l36 18 29 53-12 55-25 12-16-57-28-47z" />
                                <path d="M354 93l47-31 89 5 43 29 77 4 80 42-15 46-64 21-39-20-43 18-34-32-54-5-31-40-53-9z" />
                                <path d="M426 181l54 4 34 56-17 74-45 18-35-62-22-57z" />
                                <path d="M640 242l53-16 51 31-7 49-62 16-45-35z" />
                            </g>
                            {mapPoints.map((point) => (
                                <g key={point.key} className="map-point" transform={`translate(${point.x} ${point.y})`}>
                                    <circle r="18" className="map-pulse" />
                                    <circle r="7" />
                                    <text x="12" y="-10">{point.label} · {point.count}</text>
                                </g>
                            ))}
                        </svg>
                        {mapPoints.length === 0 && (
                            <div className="map-empty">
                                <Globe2 size={24} />
                                <strong>Chưa có metadata quốc gia</strong>
                                <span>Dashboard không đoán vị trí. Marker sẽ xuất hiện khi phiên có country/countryCode.</span>
                            </div>
                        )}
                    </div>
                    <div className="map-footnote">
                        <span><i className="dot active" /> {activeVisitors.length} khách đang hoạt động</span>
                        <span><ShieldCheck size={14} /> Không suy diễn vị trí từ dữ liệu thiếu</span>
                    </div>
                </article>

                <article className="analytics-card analytics-feed-card">
                    <CardHeading eyebrow="Activity stream" title="Hoạt động gần nhất" />
                    <div className="live-feed">
                        {data.recentVisitors.slice(0, 8).map((visitor) => {
                            const channel = getChannelMeta(visitor.channel);
                            return (
                                <div className="live-event" key={visitor.id}>
                                    <span className="visitor-avatar" style={{ background: `${channel.color}16`, color: channel.color }}>
                                        {(visitor.name || visitor.visitorId || '?').charAt(0).toUpperCase()}
                                    </span>
                                    <div>
                                        <strong>{visitor.name || 'Khách ẩn danh'}</strong>
                                        <span>{visitor.domain || visitor.pageUrl || channel.label}</span>
                                    </div>
                                    <time>{formatAgo(visitor.lastSeenAt)}</time>
                                </div>
                            );
                        })}
                        {data.recentVisitors.length === 0 && <EmptyBlock icon={Radio} title="Chưa có phiên gần đây" copy="Khi khách mở hội thoại Widget, hoạt động sẽ xuất hiện tại đây." />}
                    </div>
                </article>
            </section>

            <VisitorTable visitors={data.recentVisitors} preferences={preferences} />
        </div>
    );
}

function ReportAnalytics({ data, preferences }: { data: AnalyticsPayload; preferences: DashboardPreferences }) {
    const chartData = data.timeSeries.map((bucket) => ({
        ...bucket,
        'Hội thoại': bucket.conversations,
        'Tin nhắn': bucket.messages,
        'Khách mới': bucket.newVisitors,
    }));
    const channelData = data.channels.map((item) => ({
        ...item,
        name: getChannelMeta(item.channel).label,
        color: getChannelMeta(item.channel).color,
    }));

    return (
        <div className="analytics-stack">
            <section className="analytics-kpis">
                <MetricCard icon={MessageSquare} label="Hội thoại" value={data.kpis.conversations} tone="blue" helper={`${data.kpis.resolved} đã xử lý`} />
                <MetricCard icon={Users} label="Khách mới" value={data.kpis.newVisitors} tone="violet" helper="Visitor duy nhất" />
                <MetricCard icon={MousePointer2} label="Tin nhắn" value={data.kpis.messages} tone="amber" helper="Khách + nhân viên" />
                <MetricCard icon={Bot} label="Tỷ lệ phản hồi" value={data.kpis.responseRate === null ? '—' : `${data.kpis.responseRate}%`} tone="green" helper={formatDuration(data.kpis.avgFirstResponseSeconds)} />
            </section>

            <article className="analytics-card analytics-chart-card">
                <CardHeading eyebrow="Report" title="Nhịp hội thoại theo thời gian" aside={<span className="data-badge">Dữ liệu Prisma thật</span>} />
                <div className="main-chart">
                    {chartData.length ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData} margin={{ top: 12, right: 12, left: -18, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="conversationArea" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#2563eb" stopOpacity=".25" />
                                        <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
                                    </linearGradient>
                                    <linearGradient id="messageArea" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#8b5cf6" stopOpacity=".18" />
                                        <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid vertical={false} stroke="#e8eef6" strokeDasharray="4 5" />
                                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#76839a' }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} />
                                <ChartTooltip contentStyle={{ border: '1px solid #dbe3ef', borderRadius: 10, boxShadow: '0 12px 28px rgba(15,23,42,.10)' }} />
                                <Area type="monotone" dataKey="Tin nhắn" stroke="#8b5cf6" strokeWidth={2} fill="url(#messageArea)" />
                                <Area type="monotone" dataKey="Hội thoại" stroke="#2563eb" strokeWidth={2.5} fill="url(#conversationArea)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : <EmptyBlock icon={BarChart3} title="Chưa có dữ liệu trong kỳ" copy="Hãy đổi khoảng thời gian hoặc bắt đầu nhận hội thoại." />}
                </div>
            </article>

            <section className="analytics-report-grid">
                <article className="analytics-card">
                    <CardHeading eyebrow="Service quality" title="Thời gian phản hồi đầu tiên" />
                    <div className="response-chart">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data.responseTimeBuckets} layout="vertical" margin={{ top: 5, right: 22, left: 16, bottom: 0 }}>
                                <CartesianGrid horizontal={false} stroke="#edf1f6" strokeDasharray="4 4" />
                                <XAxis type="number" axisLine={false} tickLine={false} allowDecimals={false} />
                                <YAxis type="category" dataKey="label" axisLine={false} tickLine={false} width={82} tick={{ fontSize: 11, fill: '#5c697d' }} />
                                <ChartTooltip formatter={(value) => [`${value} hội thoại`, 'Số lượng']} />
                                <Bar dataKey="count" fill="#2563eb" radius={[0, 7, 7, 0]} barSize={22} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </article>

                <article className="analytics-card">
                    <CardHeading eyebrow="Channels" title="Phân bổ hội thoại" />
                    <div className="channel-panel">
                        <div className="channel-donut">
                            {channelData.length ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={channelData} innerRadius={52} outerRadius={78} paddingAngle={3} dataKey="conversations" nameKey="name">
                                            {channelData.map((item) => <Cell key={item.channel} fill={item.color} />)}
                                        </Pie>
                                        <ChartTooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : <div className="donut-empty">0</div>}
                        </div>
                        <div className="channel-legend">
                            {channelData.map((item) => (
                                <div key={item.channel}>
                                    <span><i style={{ background: item.color }} /> {item.name}</span>
                                    <strong>{item.conversations} <small>{item.percent}%</small></strong>
                                </div>
                            ))}
                            {channelData.length === 0 && <span className="muted-copy">Chưa có hội thoại trong kỳ.</span>}
                        </div>
                    </div>
                </article>
            </section>

            <section className="analytics-report-grid">
                <BreakdownCard title="Nguồn truy cập" items={data.sources.map((item) => ({ label: item.source, value: item.visitors, percent: item.percent }))} />
                <BreakdownCard title="Vị trí ghi nhận" items={data.geography.map((item) => ({ label: item.country === 'unknown' ? 'Chưa xác định' : item.country, value: item.visitors, percent: item.percent }))} />
            </section>

            <VisitorTable visitors={data.recentVisitors} preferences={preferences} />
        </div>
    );
}

function AnalyticsSettings({
    data,
    workspaceId,
    preferences,
    updatePreference,
}: {
    data: AnalyticsPayload;
    workspaceId: string;
    preferences: DashboardPreferences;
    updatePreference: (key: keyof DashboardPreferences, value: boolean) => void;
}) {
    return (
        <div className="analytics-settings-grid">
            <section className="analytics-card settings-card">
                <CardHeading eyebrow="Dashboard" title="Tùy chọn hiển thị" />
                <SettingRow
                    icon={RefreshCw}
                    title="Tự làm mới màn Trực tiếp"
                    copy="Nạp dữ liệu mới mỗi 15 giây khi đang mở trang Live."
                    control={<Switch checked={preferences.autoRefresh} onChange={(value) => updatePreference('autoRefresh', value)} />}
                />
                <SettingRow
                    icon={BarChart3}
                    title="Danh sách thu gọn"
                    copy="Giảm chiều cao dòng để quan sát nhiều visitor hơn."
                    control={<Switch checked={preferences.compactRows} onChange={(value) => updatePreference('compactRows', value)} />}
                />
                <SettingRow
                    icon={ShieldCheck}
                    title="Che mã visitor"
                    copy="Ẩn phần giữa visitorId trên dashboard và khi trình chiếu."
                    control={<Switch checked={preferences.maskVisitorIds} onChange={(value) => updatePreference('maskVisitorIds', value)} />}
                />
            </section>

            <section className="analytics-card settings-card">
                <CardHeading eyebrow="Tracking status" title="Nguồn dữ liệu đang dùng" />
                <div className="tracking-status-grid">
                    <StatusTile icon={MessageSquare} label="Hội thoại" value={data.kpis.conversations} status="Đang ghi nhận" />
                    <StatusTile icon={Users} label="Visitor" value={data.kpis.newVisitors} status="Đang ghi nhận" />
                    <StatusTile icon={Globe2} label="UTM / referrer" value={data.sources.filter((item) => item.source !== 'direct').length} status="Theo metadata" />
                    <StatusTile icon={Activity} label="Live window" value={`${data.liveWindowMinutes}p`} status="Theo lastSeenAt" />
                </div>
                <div className="privacy-note">
                    <ShieldCheck size={18} />
                    <div>
                        <strong>Không dựng dữ liệu giả</strong>
                        <span>Vị trí, thiết bị và nguồn chỉ hiển thị khi metadata thực có mặt. Dashboard không tự suy đoán quốc gia từ visitorId.</span>
                    </div>
                </div>
            </section>

            <section className="analytics-card settings-card settings-wide">
                <CardHeading eyebrow="Collection" title="Quản lý điểm thu dữ liệu" />
                <div className="collection-links">
                    <Link href={`/workspace/${workspaceId}/widgets`}>
                        <span className="collection-icon"><Globe2 size={19} /></span>
                        <div><strong>Widget website</strong><span>Thiết kế, domain, pre-chat và mã nhúng versioned.</span></div>
                        <ArrowRight size={17} />
                    </Link>
                    <Link href={`/workspace/${workspaceId}/channels`}>
                        <span className="collection-icon"><Smartphone size={19} /></span>
                        <div><strong>Kết nối kênh</strong><span>Quản lý Website, Zalo cá nhân, Facebook và Email.</span></div>
                        <ArrowRight size={17} />
                    </Link>
                    <Link href={`/workspace/${workspaceId}/settings?tab=webhook`}>
                        <span className="collection-icon"><ExternalLink size={19} /></span>
                        <div><strong>Webhook</strong><span>Đồng bộ sự kiện sang hệ thống phân tích bên ngoài.</span></div>
                        <ArrowRight size={17} />
                    </Link>
                </div>
            </section>
        </div>
    );
}

function VisitorTable({ visitors, preferences }: { visitors: RecentVisitor[]; preferences: DashboardPreferences }) {
    return (
        <article className="analytics-card visitors-card">
            <CardHeading eyebrow="Visitors" title="Khách gần đây" aside={<Tag>{visitors.length} hồ sơ</Tag>} />
            <div className="visitor-table-wrap">
                <table className={preferences.compactRows ? 'compact' : ''}>
                    <thead>
                        <tr>
                            <th>Khách</th>
                            <th>Trạng thái</th>
                            <th>Kênh</th>
                            <th>Nguồn / trang</th>
                            <th>Thiết bị</th>
                            <th>Lần cuối</th>
                        </tr>
                    </thead>
                    <tbody>
                        {visitors.map((visitor) => {
                            const channel = getChannelMeta(visitor.channel);
                            return (
                                <tr key={visitor.id}>
                                    <td>
                                        <div className="table-person">
                                            <span className="visitor-avatar" style={{ background: `${channel.color}16`, color: channel.color }}>
                                                {(visitor.name || visitor.visitorId || '?').charAt(0).toUpperCase()}
                                            </span>
                                            <div>
                                                <strong>{visitor.name || 'Khách ẩn danh'}</strong>
                                                <span>{preferences.maskVisitorIds ? maskVisitorId(visitor.visitorId) : visitor.visitorId}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td><span className={visitor.isActive ? 'visitor-state active' : 'visitor-state'}><i /> {visitor.isActive ? 'Đang online' : 'Đã rời'}</span></td>
                                    <td><span className="channel-tag"><i style={{ background: channel.color }} />{channel.label}</span></td>
                                    <td><strong className="source-main">{visitor.utmSource || visitor.domain || 'Direct / chưa rõ'}</strong><span className="source-sub">{visitor.pageUrl || visitor.referrer || 'Không có page URL'}</span></td>
                                    <td><strong className="source-main">{visitor.device || 'Chưa rõ'}</strong><span className="source-sub">{[visitor.browser, visitor.os].filter(Boolean).join(' · ') || 'Chưa có metadata'}</span></td>
                                    <td><strong className="source-main">{formatAgo(visitor.lastSeenAt)}</strong><span className="source-sub">{visitor.totalConversations} hội thoại</span></td>
                                </tr>
                            );
                        })}
                        {visitors.length === 0 && (
                            <tr><td colSpan={6}><EmptyBlock icon={Users} title="Chưa có visitor" copy="Khách từ Widget sẽ xuất hiện tại đây sau khi mở hội thoại." /></td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </article>
    );
}

function MetricCard({ icon: Icon, label, value, tone, helper }: { icon: LucideIcon; label: string; value: React.ReactNode; tone: string; helper: string }) {
    return (
        <article className={`metric-card ${tone}`}>
            <div className="metric-card-head"><span>{label}</span><Icon size={17} /></div>
            <strong>{value}</strong>
            <small>{helper}</small>
        </article>
    );
}

function CardHeading({ eyebrow, title, aside }: { eyebrow: string; title: string; aside?: React.ReactNode }) {
    return (
        <header className="card-heading">
            <div><span>{eyebrow}</span><h2>{title}</h2></div>
            {aside}
        </header>
    );
}

function EmptyBlock({ icon: Icon, title, copy }: { icon: LucideIcon; title: string; copy: string }) {
    return <div className="empty-block"><Icon size={22} /><strong>{title}</strong><span>{copy}</span></div>;
}

function BreakdownCard({ title, items }: { title: string; items: Array<{ label: string; value: number; percent: number }> }) {
    return (
        <article className="analytics-card">
            <CardHeading eyebrow="Breakdown" title={title} />
            <div className="breakdown-list">
                {items.slice(0, 6).map((item) => (
                    <div key={item.label}>
                        <span>{item.label}</span><strong>{item.value}</strong>
                        <div><i style={{ width: `${Math.max(3, item.percent)}%` }} /></div>
                        <small>{item.percent}%</small>
                    </div>
                ))}
                {!items.length && <EmptyBlock icon={BarChart3} title="Chưa đủ dữ liệu" copy="Breakdown sẽ xuất hiện khi có visitor trong kỳ." />}
            </div>
        </article>
    );
}

function SettingRow({ icon: Icon, title, copy, control }: { icon: LucideIcon; title: string; copy: string; control: React.ReactNode }) {
    return (
        <div className="setting-row">
            <span className="setting-icon"><Icon size={18} /></span>
            <div><strong>{title}</strong><span>{copy}</span></div>
            {control}
        </div>
    );
}

function StatusTile({ icon: Icon, label, value, status }: { icon: LucideIcon; label: string; value: React.ReactNode; status: string }) {
    return (
        <div className="status-tile">
            <span><Icon size={17} /> {label}</span>
            <strong>{value}</strong>
            <small><i /> {status}</small>
        </div>
    );
}

const analyticsStyles = `
    .analytics-loading,.analytics-content-loading{min-height:100vh;display:grid;place-items:center;background:#f4f7fb}
    .analytics-content-loading{min-height:48vh;background:transparent}
    .analytics-header-title{display:flex;align-items:center;gap:9px}.analytics-header-icon{width:32px;height:32px;border:1px solid #cfe0f7;border-radius:9px;display:grid;place-items:center;color:#2563eb;background:#eff6ff}
    .analytics-shell{width:100%;max-width:1540px;margin:0 auto;padding:20px 24px 56px;color:#142033}
    .analytics-topbar{min-height:58px;display:flex;align-items:center;justify-content:space-between;gap:16px;border:1px solid #dce5f1;background:#fff;padding:8px 10px;border-radius:12px;margin-bottom:16px;box-shadow:0 4px 12px rgba(15,23,42,.035)}
    .analytics-tabs{display:flex;align-items:center;gap:4px}.analytics-tabs a{min-height:38px;display:flex;align-items:center;gap:7px;padding:0 14px;border-radius:8px;color:#607087;font-size:13px;font-weight:750;text-decoration:none}.analytics-tabs a:hover{background:#f5f8fc;color:#1f4d8f}.analytics-tabs a.active{background:#eaf2ff;color:#1d4ed8;box-shadow:inset 0 0 0 1px #cfe0ff}
    .analytics-period{display:flex;align-items:center;gap:9px;color:#718096;font-size:12px;font-weight:700}.analytics-period .ant-select{width:116px}
    .analytics-error{display:flex;align-items:center;gap:12px;border:1px solid #fecaca;background:#fff5f5;color:#991b1b;padding:12px 14px;border-radius:10px;margin-bottom:14px}.analytics-error span{flex:1;font-size:12px}
    .analytics-stack{display:grid;gap:16px}.analytics-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
    .metric-card{border:1px solid #dce5f1;background:#fff;border-radius:12px;padding:17px 18px;min-height:122px;box-shadow:0 5px 14px rgba(15,23,42,.035)}.metric-card-head{display:flex;align-items:center;justify-content:space-between;color:#6b778c;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.06em}.metric-card strong{display:block;margin-top:12px;font-size:28px;line-height:1;color:#101828;letter-spacing:-.04em}.metric-card small{display:block;margin-top:8px;color:#7c899d;font-size:11px}.metric-card.blue .metric-card-head svg{color:#2563eb}.metric-card.green .metric-card-head svg{color:#059669}.metric-card.violet .metric-card-head svg{color:#7c3aed}.metric-card.amber .metric-card-head svg{color:#d97706}
    .analytics-card{border:1px solid #dce5f1;background:#fff;border-radius:13px;padding:20px;box-shadow:0 7px 20px rgba(15,23,42,.04);min-width:0}.card-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:18px}.card-heading span{display:block;color:#74829a;font-size:10px;font-weight:850;text-transform:uppercase;letter-spacing:.1em}.card-heading h2{margin:4px 0 0;font-size:17px;line-height:1.2;color:#152033;letter-spacing:-.02em}.card-heading>.ant-tag{margin:0;border-radius:6px}.data-badge{padding:5px 8px;border:1px solid #bbf7d0;background:#f0fdf4;color:#047857!important;border-radius:6px;letter-spacing:0!important;text-transform:none!important}
    .analytics-live-grid{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(310px,.7fr);gap:16px}.analytics-map-card{padding-bottom:14px}.activity-map{position:relative;min-height:360px;overflow:hidden;border:1px solid #dce9f8;border-radius:11px;background:#eff6ff}.activity-map svg{display:block;width:100%;height:360px}.map-grid-lines line{stroke:#d6e5f6;stroke-width:1}.map-land path{fill:#d6e0ec;stroke:#c1cfdd;stroke-width:1.4}.map-point>circle:not(.map-pulse){fill:#2563eb;stroke:#fff;stroke-width:3}.map-pulse{fill:#60a5fa;opacity:.25}.map-point text{font-size:11px;font-weight:750;fill:#1e3a5f}.map-empty{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(320px,80%);display:grid;justify-items:center;text-align:center;padding:18px;border:1px solid rgba(255,255,255,.9);background:rgba(255,255,255,.88);backdrop-filter:blur(8px);border-radius:12px;box-shadow:0 12px 35px rgba(30,64,175,.10);color:#2563eb}.map-empty strong{margin-top:8px;color:#26364c;font-size:13px}.map-empty span{margin-top:5px;color:#708098;font-size:11px;line-height:1.5}.map-footnote{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:11px;color:#65758b;font-size:11px}.map-footnote span{display:flex;align-items:center;gap:6px}.dot{width:7px;height:7px;border-radius:50%;display:inline-block;background:#94a3b8}.dot.active{background:#10b981;box-shadow:0 0 0 4px rgba(16,185,129,.12)}
    .live-chip{display:inline-flex!important;align-items:center;gap:7px;padding:5px 8px;background:#f0fdf4;color:#047857!important;border:1px solid #bbf7d0;border-radius:6px;text-transform:none!important;letter-spacing:0!important}.live-chip i{width:6px;height:6px;background:#10b981;border-radius:50%}.analytics-feed-card{display:flex;flex-direction:column}.live-feed{display:grid;gap:0;overflow:auto;max-height:420px}.live-event{display:grid;grid-template-columns:38px minmax(0,1fr) auto;align-items:center;gap:10px;padding:12px 0;border-bottom:1px solid #edf1f6}.live-event:last-child{border-bottom:0}.visitor-avatar{width:34px;height:34px;border-radius:9px;display:grid;place-items:center;font-size:12px;font-weight:900;flex:0 0 auto}.live-event div{min-width:0}.live-event strong,.live-event span{display:block}.live-event strong{color:#29374b;font-size:12px}.live-event span{margin-top:3px;color:#7c899d;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.live-event time{color:#8a96a8;font-size:10px;white-space:nowrap}
    .analytics-chart-card{padding-bottom:15px}.main-chart{height:310px}.analytics-report-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.response-chart{height:250px}.channel-panel{display:flex;align-items:center;gap:20px;min-height:250px}.channel-donut{width:190px;height:190px;flex:0 0 190px;display:grid;place-items:center}.donut-empty{width:132px;height:132px;border:20px solid #e8eef6;border-radius:50%;display:grid;place-items:center;color:#94a3b8;font-size:22px;font-weight:800}.channel-legend{flex:1;display:grid;gap:12px}.channel-legend>div{display:flex;align-items:center;justify-content:space-between;gap:14px;border-bottom:1px solid #edf1f6;padding-bottom:10px}.channel-legend span{display:flex;align-items:center;gap:7px;color:#5d6b7f;font-size:12px}.channel-legend i{width:8px;height:8px;border-radius:50%}.channel-legend strong{font-size:13px;color:#243044}.channel-legend small{margin-left:5px;color:#8b97a8;font-weight:600}.muted-copy{color:#8a96a8;font-size:12px}
    .breakdown-list{display:grid;gap:11px}.breakdown-list>div{display:grid;grid-template-columns:minmax(110px,1fr) 42px minmax(90px,1.4fr) 40px;align-items:center;gap:9px;color:#59677a;font-size:12px}.breakdown-list strong{text-align:right;color:#263449}.breakdown-list>div>div{height:7px;border-radius:2px;background:#edf2f7;overflow:hidden}.breakdown-list>div>div i{display:block;height:100%;background:#2563eb;border-radius:2px}.breakdown-list small{text-align:right;color:#7c899d}
    .visitors-card{padding-bottom:10px}.visitor-table-wrap{overflow:auto;margin:0 -20px}.visitor-table-wrap table{width:100%;min-width:980px;border-collapse:collapse}.visitor-table-wrap th{padding:10px 16px;border-top:1px solid #edf1f6;border-bottom:1px solid #dfe7f1;background:#f8fafc;color:#77849a;font-size:10px;font-weight:850;letter-spacing:.05em;text-align:left;text-transform:uppercase}.visitor-table-wrap td{padding:13px 16px;border-bottom:1px solid #edf1f6;vertical-align:middle;color:#435167;font-size:11px}.visitor-table-wrap table.compact td{padding-top:7px;padding-bottom:7px}.visitor-table-wrap tr:last-child td{border-bottom:0}.table-person{display:flex;align-items:center;gap:9px}.table-person strong,.table-person span{display:block}.table-person strong{font-size:12px;color:#263449}.table-person span{margin-top:2px;color:#8b97a8;font-size:10px;max-width:170px;overflow:hidden;text-overflow:ellipsis}.visitor-state{display:inline-flex;align-items:center;gap:6px;color:#76839a;white-space:nowrap}.visitor-state i{width:7px;height:7px;border-radius:50%;background:#a8b1bf}.visitor-state.active{color:#047857;font-weight:700}.visitor-state.active i{background:#10b981;box-shadow:0 0 0 3px rgba(16,185,129,.12)}.channel-tag{display:inline-flex;align-items:center;gap:6px;white-space:nowrap}.channel-tag i{width:7px;height:7px;border-radius:50%}.source-main,.source-sub{display:block;max-width:220px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.source-main{font-size:11px;color:#3d4b5f}.source-sub{margin-top:3px;color:#8b97a8;font-size:10px}
    .empty-block{min-height:140px;display:grid;place-items:center;align-content:center;text-align:center;padding:22px;color:#91a0b3}.empty-block strong{margin-top:8px;color:#536278;font-size:12px}.empty-block span{margin-top:4px;max-width:280px;font-size:10px;line-height:1.5}
    .analytics-settings-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.settings-card{padding:22px}.settings-wide{grid-column:1/-1}.setting-row{display:grid;grid-template-columns:40px minmax(0,1fr) auto;align-items:center;gap:12px;padding:15px 0;border-top:1px solid #edf1f6}.setting-icon,.collection-icon{width:38px;height:38px;border:1px solid #dbe6f3;border-radius:9px;background:#f5f9ff;color:#2563eb;display:grid;place-items:center}.setting-row strong,.setting-row span{display:block}.setting-row strong{font-size:12px;color:#29374a}.setting-row div>span{margin-top:4px;color:#7d899b;font-size:10px;line-height:1.45}.tracking-status-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.status-tile{border:1px solid #e1e8f1;background:#f9fbfd;border-radius:10px;padding:13px}.status-tile>span{display:flex;align-items:center;gap:7px;color:#69778c;font-size:10px;font-weight:750}.status-tile strong{display:block;margin-top:10px;color:#1f2c40;font-size:22px}.status-tile small{display:flex;align-items:center;gap:5px;margin-top:6px;color:#5e6d80;font-size:9px}.status-tile small i{width:6px;height:6px;border-radius:50%;background:#10b981}.privacy-note{display:flex;gap:10px;margin-top:14px;padding:12px;border:1px solid #d8e6f7;background:#f5f9ff;border-radius:10px;color:#2563eb}.privacy-note strong,.privacy-note span{display:block}.privacy-note strong{color:#314056;font-size:11px}.privacy-note span{margin-top:4px;color:#718096;font-size:10px;line-height:1.5}.collection-links{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.collection-links a{display:grid;grid-template-columns:40px minmax(0,1fr) auto;align-items:center;gap:10px;padding:14px;border:1px solid #dfe7f0;border-radius:10px;text-decoration:none;color:#263449;transition:.15s ease}.collection-links a:hover{border-color:#9ec2f8;background:#f7faff}.collection-links strong,.collection-links span{display:block}.collection-links strong{font-size:12px}.collection-links div>span{margin-top:4px;color:#7c899d;font-size:10px;line-height:1.4}
    .analytics-spin{animation:analyticsSpin .8s linear infinite}@keyframes analyticsSpin{to{transform:rotate(360deg)}}
    @media(max-width:1100px){.analytics-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.analytics-live-grid{grid-template-columns:1fr}.live-feed{max-height:none}.collection-links{grid-template-columns:1fr}.analytics-settings-grid{grid-template-columns:1fr}.settings-wide{grid-column:auto}}
    @media(max-width:760px){.analytics-shell{padding:14px 12px 42px}.analytics-topbar{align-items:stretch;flex-direction:column}.analytics-tabs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr))}.analytics-tabs a{justify-content:center;padding:0 8px}.analytics-period{justify-content:space-between}.analytics-kpis,.analytics-report-grid{grid-template-columns:1fr}.metric-card{min-height:108px}.activity-map,.activity-map svg{min-height:290px;height:290px}.map-footnote{align-items:flex-start;flex-direction:column}.channel-panel{align-items:flex-start;flex-direction:column}.channel-donut{align-self:center}.channel-legend{width:100%}.analytics-settings-grid{display:grid}.tracking-status-grid{grid-template-columns:1fr}.card-heading{align-items:flex-start}.breakdown-list>div{grid-template-columns:minmax(90px,1fr) 34px minmax(70px,1fr) 36px}}
    @media(max-width:430px){.analytics-tabs span{font-size:11px}.analytics-kpis{gap:9px}.metric-card{padding:14px}.analytics-card{padding:16px}.visitor-table-wrap{margin:0 -16px}.analytics-header-title>span:last-child{display:none}}
`;
