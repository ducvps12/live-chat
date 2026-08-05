import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Spin, message } from 'antd';
import io, { Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import {
    ResponsiveContainer,
    AreaChart,
    Area,
    CartesianGrid,
    XAxis,
    YAxis,
    Tooltip as RechartsTooltip,
} from 'recharts';
import {
    AlertTriangle,
    ArrowRight,
    Bot,
    CheckCircle2,
    Clock3,
    Globe2,
    Inbox,
    MessageSquare,
    Settings,
    ShieldCheck,
    Smartphone,
    Sparkles,
    Timer,
    TrendingUp,
    Users,
    Zap,
    type LucideIcon,
} from 'lucide-react';
import { useAgentPerformance, useWorkspace, useWorkspaceDashboard, workspaceKeys } from '../../../domains/workspace/workspace.hooks';
import { httpClient } from '../../../lib/http/client';

interface Props {
    workspaceId: string;
}

type Period = 'today' | '7d' | '30d';

type RealtimeState = {
    connected: boolean;
    fallback: boolean;
    lastEvent: string;
    eventCount: number;
    updatedAt: Date;
};

const DASHBOARD_REALTIME_EVENTS = [
    'conversation:new',
    'conversation:updated',
    'conversation:closed',
    'conversation:reopened',
    'conversation:assigned',
    'conversation:statusChanged',
    'conversation:priorityChanged',
    'message:new',
    'message:sent',
    'message:delivered',
    'presence:agentStatus',
] as const;

const periodLabels: Record<Period, string> = {
    today: 'Hôm nay',
    '7d': '7 ngày',
    '30d': '30 ngày',
};

const buildChartData = (open: number, closed: number, period: Period) => {
    if (period === 'today') {
        return Array.from({ length: 12 }, (_, index) => {
            const hour = index + 8;
            return {
                name: `${hour}h`,
                open: Math.max(0, Math.round(open * 0.08 + (index % 4))),
                closed: Math.max(0, Math.round(closed * 0.08 + ((index + 2) % 5))),
            };
        });
    }

    const total = period === '7d' ? 7 : 30;
    return Array.from({ length: total }, (_, index) => {
        const dayIndex = total - index - 1;
        const date = new Date();
        date.setDate(date.getDate() - dayIndex);
        return {
            name: `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`,
            open: Math.max(0, Math.round(open / Math.max(total / 2.4, 1)) + (index % 3)),
            closed: Math.max(0, Math.round(closed / Math.max(total / 2.2, 1)) + ((index + 1) % 4)),
        };
    });
};

export default function WorkspaceDashboard({ workspaceId }: Props) {
    const [period, setPeriod] = useState<Period>('7d');
    const [provisioningStarter, setProvisioningStarter] = useState(false);
    const queryClient = useQueryClient();
    const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [liveState, setLiveState] = useState<RealtimeState>({
        connected: false,
        fallback: true,
        lastEvent: 'initial-load',
        eventCount: 0,
        updatedAt: new Date(),
    });
    const { data: workspaceData, isLoading: workspaceLoading } = useWorkspace(workspaceId);
    const { data: dashboardData, isLoading: dashboardLoading, error } = useWorkspaceDashboard(workspaceId);
    const { data: agentData, isLoading: agentsLoading } = useAgentPerformance(workspaceId);

    const refreshDashboard = useCallback((eventName = 'manual') => {
        setLiveState((previous) => ({
            ...previous,
            lastEvent: eventName,
            eventCount: previous.eventCount + 1,
            updatedAt: new Date(),
        }));

        if (refreshTimerRef.current) {
            clearTimeout(refreshTimerRef.current);
        }

        refreshTimerRef.current = setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: workspaceKeys.dashboard(workspaceId) });
            queryClient.invalidateQueries({ queryKey: workspaceKeys.agentPerformance(workspaceId) });
        }, 300);
    }, [queryClient, workspaceId]);

    const provisionStarterKit = useCallback(async () => {
        setProvisioningStarter(true);
        try {
            await httpClient.post(`/workspaces/${workspaceId}/starter-kit`);
            await queryClient.invalidateQueries({ queryKey: workspaceKeys.dashboard(workspaceId) });
            message.success('Đã chuẩn bị starter kit cho workspace');
        } catch {
            message.error('Không tạo được starter kit. Kiểm tra quyền workspace hoặc thử lại sau.');
        } finally {
            setProvisioningStarter(false);
        }
    }, [queryClient, workspaceId]);

    useEffect(() => {
        if (!workspaceId || typeof window === 'undefined') return;

        const token = localStorage.getItem('nemark_token');
        if (!token) {
            return;
        }

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4010';
        const baseUrl = apiUrl.replace(/\/api$/, '');
        const socket: Socket = io(`${baseUrl}/agent`, {
            auth: { token },
            query: { workspaceId },
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionDelay: 1500,
            reconnectionDelayMax: 20000,
        });

        socket.on('connect', () => {
            socket.emit('join:workspace', { workspaceId });
            setLiveState((previous) => ({
                ...previous,
                connected: true,
                fallback: false,
                lastEvent: 'socket:connected',
                updatedAt: new Date(),
            }));
            refreshDashboard('socket:connected');
        });

        socket.on('disconnect', () => {
            setLiveState((previous) => ({
                ...previous,
                connected: false,
                fallback: true,
                lastEvent: 'socket:disconnected',
                updatedAt: new Date(),
            }));
        });

        DASHBOARD_REALTIME_EVENTS.forEach((eventName) => {
            socket.on(eventName, () => refreshDashboard(eventName));
        });

        return () => {
            DASHBOARD_REALTIME_EVENTS.forEach((eventName) => socket.off(eventName));
            socket.off('connect');
            socket.off('disconnect');
            socket.disconnect();
            if (refreshTimerRef.current) {
                clearTimeout(refreshTimerRef.current);
                refreshTimerRef.current = null;
            }
        };
    }, [workspaceId, refreshDashboard]);

    useEffect(() => {
        if (!workspaceId || typeof window === 'undefined') return;

        const intervalId = window.setInterval(() => {
            if (document.visibilityState === 'hidden') return;

            queryClient.invalidateQueries({ queryKey: workspaceKeys.dashboard(workspaceId) });
            queryClient.invalidateQueries({ queryKey: workspaceKeys.agentPerformance(workspaceId) });
            setLiveState((previous) => previous.connected
                ? previous
                : {
                    ...previous,
                    fallback: true,
                    lastEvent: 'poll:fallback',
                    eventCount: previous.eventCount + 1,
                    updatedAt: new Date(),
                });
        }, 30000);

        return () => window.clearInterval(intervalId);
    }, [queryClient, workspaceId]);

    const workspace = workspaceData?.data;
    const stats = dashboardData?.data;
    const agents = agentData?.data || [];

    const chartData = useMemo(() => {
        const open = stats?.conversations?.open ?? 0;
        const closed = stats?.conversations?.closed ?? 0;
        return buildChartData(open, closed, period);
    }, [period, stats]);

    if (workspaceLoading || dashboardLoading) {
        return (
            <div style={{ minHeight: '68vh', display: 'grid', placeItems: 'center' }}>
                <Spin size="large" />
            </div>
        );
    }

    if (error || !workspace || !stats) {
        return (
            <div className="enterprise-section" style={{ margin: 24, padding: 44, textAlign: 'center' }}>
                <AlertTriangle size={34} color="var(--ent-rose)" />
                <h2 style={{ margin: '14px 0 8px', fontSize: 20, fontWeight: 900 }}>Không thể tải dashboard</h2>
                <p style={{ margin: 0, color: 'var(--ent-text-muted)' }}>Vui lòng kiểm tra kết nối máy chủ hoặc thử lại sau.</p>
            </div>
        );
    }

    const closeRate = stats.conversations.total > 0
        ? Math.round((stats.conversations.closed / stats.conversations.total) * 100)
        : 0;
    const openConversations = stats.conversations.open || 0;
    const missed = stats.conversations.missed || 0;
    const visitors = stats.customers.totalVisitors || 0;
    const members = stats.overview.totalMembers || 0;
    const updatedTime = liveState.updatedAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const realtimeColor = liveState.connected ? '#12b76a' : '#f79009';
    const totalWidgets = stats.config?.totalWidgets || 0;
    const totalBots = stats.config?.totalBots || 0;
    const activeBots = stats.config?.activeBots || 0;
    const totalKnowledge = stats.config?.totalKnowledge || 0;
    const realtimeLabel = liveState.connected ? 'Realtime socket' : 'Polling dự phòng';

    return (
        <div className="enterprise-page">
            <div className="enterprise-container">
                <section className="enterprise-section" style={{ padding: 26 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', minWidth: 0 }}>
                            <div style={{ width: 54, height: 54, borderRadius: 8, background: 'var(--ent-primary)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 22, fontWeight: 950, flexShrink: 0 }}>
                                {workspace.name.charAt(0).toUpperCase()}
                            </div>
                            <div style={{ minWidth: 0 }}>
                                <span className="enterprise-kicker">
                                    <span style={{ width: 7, height: 7, borderRadius: 999, background: workspace.isActive ? '#12b76a' : '#f79009' }} />
                                    {workspace.isActive ? 'Workspace đang hoạt động' : 'Workspace tạm dừng'}
                                </span>
                                <h1 style={{ margin: '12px 0 8px', color: 'var(--ent-text)', fontSize: 32, lineHeight: 1.14, fontWeight: 950, letterSpacing: 0 }}>
                                    {workspace.name}
                                </h1>
                                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', color: 'var(--ent-text-muted)', fontSize: 13, fontWeight: 700 }}>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                        <Globe2 size={15} />
                                        {stats.overview.domain || 'Chưa gắn domain'}
                                    </span>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                        <Clock3 size={15} />
                                        Cập nhật {updatedTime}
                                    </span>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                        <ShieldCheck size={15} />
                                        Plan {workspace.plan || 'free'}
                                    </span>
                                    <span
                                        title={`Sự kiện cuối: ${liveState.lastEvent}`}
                                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: realtimeColor }}
                                    >
                                        <Zap size={15} />
                                        {realtimeLabel} · {liveState.eventCount} cập nhật
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                            <Link href={`/workspace/${workspaceId}/settings`} className="enterprise-button">
                                <Settings size={16} />
                                Thiết lập
                            </Link>
                            <Link href={`/workspace/${workspaceId}/inbox`} className="enterprise-button enterprise-button-primary">
                                <Inbox size={16} />
                                Mở Inbox
                            </Link>
                        </div>
                    </div>
                </section>

                <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 14, marginTop: 16 }} className="dashboard-metric-grid">
                    <MetricCard icon={MessageSquare} label="Hội thoại đang xử lý" value={String(openConversations)} hint={openConversations > 0 ? 'Cần theo dõi SLA realtime' : 'Không có hội thoại tồn'} tone="blue" href={`/workspace/${workspaceId}/inbox`} />
                    <MetricCard icon={Users} label="Khách hàng" value={String(visitors)} hint="Tổng khách đã ghi nhận" tone="violet" href={`/workspace/${workspaceId}/contacts`} />
                    <MetricCard icon={AlertTriangle} label="Bỏ lỡ" value={String(missed)} hint={missed > 0 ? 'Cần gọi lại hoặc nhắn lại' : 'Không có cảnh báo'} tone={missed > 0 ? 'rose' : 'green'} href={`/workspace/${workspaceId}/inbox`} />
                    <MetricCard icon={CheckCircle2} label="Tỷ lệ xử lý" value={`${closeRate}%`} hint={`${stats.conversations.closed || 0} hội thoại đã đóng`} tone="green" href={`/workspace/${workspaceId}/analytics`} />
                </section>

                <StarterChecklist
                    workspaceId={workspaceId}
                    totalWidgets={totalWidgets}
                    totalBots={totalBots}
                    activeBots={activeBots}
                    totalKnowledge={totalKnowledge}
                    provisioning={provisioningStarter}
                    onProvision={provisionStarterKit}
                />

                <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 360px', gap: 16, marginTop: 16 }} className="dashboard-main-grid">
                    <div className="enterprise-section" style={{ padding: 22 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 18 }}>
                            <div>
                                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 950, color: 'var(--ent-text)' }}>Lưu lượng hội thoại</h2>
                                <p style={{ margin: '6px 0 0', color: 'var(--ent-text-muted)', fontSize: 13 }}>Theo dõi tải vận hành để phân phối agent và AI hợp lý.</p>
                            </div>
                            <div style={{ display: 'flex', gap: 6, padding: 4, border: '1px solid var(--ent-border)', borderRadius: 8, background: '#f8fafc' }}>
                                {(Object.keys(periodLabels) as Period[]).map((item) => (
                                    <button
                                        key={item}
                                        onClick={() => setPeriod(item)}
                                        style={{
                                            height: 30,
                                            padding: '0 11px',
                                            border: 0,
                                            borderRadius: 6,
                                            background: period === item ? '#fff' : 'transparent',
                                            color: period === item ? 'var(--ent-primary)' : 'var(--ent-text-muted)',
                                            boxShadow: period === item ? 'var(--ent-shadow-soft)' : 'none',
                                            fontSize: 12,
                                            fontWeight: 850,
                                            cursor: 'pointer',
                                        }}
                                    >
                                        {periodLabels[item]}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div style={{ height: 330 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="closed" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#2563eb" stopOpacity={0.2} />
                                            <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="open" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#0f766e" stopOpacity={0.18} />
                                            <stop offset="100%" stopColor="#0f766e" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid vertical={false} stroke="#e4e7ec" strokeDasharray="4 4" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#98a2b3' }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#98a2b3' }} />
                                    <RechartsTooltip contentStyle={{ borderRadius: 8, border: '1px solid #dde4ef', boxShadow: 'var(--ent-shadow)' }} />
                                    <Area type="monotone" dataKey="closed" name="Đã xử lý" stroke="#2563eb" strokeWidth={2.4} fill="url(#closed)" />
                                    <Area type="monotone" dataKey="open" name="Đang mở" stroke="#0f766e" strokeWidth={2.4} fill="url(#open)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gap: 16 }}>
                        <OperationalScore closeRate={closeRate} members={members} responseRate={stats.reports.responseRate} csat={stats.reports.csat} />
                        <NextActions workspaceId={workspaceId} />
                    </div>
                </section>

                <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 360px', gap: 16, marginTop: 16 }} className="dashboard-main-grid">
                    <AgentTable agents={agents} isLoading={agentsLoading} />
                    <ChannelReadiness workspaceId={workspaceId} />
                </section>
            </div>

            <style jsx global>{`
                @media (max-width: 1100px) {
                    .dashboard-metric-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
                    .dashboard-main-grid { grid-template-columns: 1fr !important; }
                }
                @media (max-width: 620px) {
                    .dashboard-metric-grid { grid-template-columns: 1fr !important; }
                }
            `}</style>
        </div>
    );
}

function MetricCard({ icon: Icon, label, value, hint, tone, href }: { icon: LucideIcon; label: string; value: string; hint: string; tone: 'blue' | 'green' | 'violet' | 'rose'; href: string }) {
    const colors = {
        blue: ['#eff6ff', '#2563eb'],
        green: ['#ecfdf5', '#0f766e'],
        violet: ['#f5f3ff', '#6d28d9'],
        rose: ['#fff1f2', '#be123c'],
    }[tone];

    return (
        <Link href={href} className="enterprise-card" style={{ padding: 18, textDecoration: 'none', display: 'block' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ color: 'var(--ent-text-muted)', fontSize: 12, fontWeight: 850, textTransform: 'uppercase' }}>{label}</div>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: colors[0], color: colors[1], display: 'grid', placeItems: 'center' }}>
                    <Icon size={18} />
                </div>
            </div>
            <div style={{ marginTop: 12, color: 'var(--ent-text)', fontSize: 30, fontWeight: 950 }}>{value}</div>
            <div style={{ marginTop: 6, color: 'var(--ent-text-muted)', fontSize: 13, lineHeight: 1.5 }}>{hint}</div>
        </Link>
    );
}

function OperationalScore({ closeRate, members, responseRate, csat }: { closeRate: number; members: number; responseRate: string; csat: number }) {
    return (
        <div className="enterprise-section" style={{ padding: 20 }}>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 950 }}>Sức khỏe vận hành</h2>
            <p style={{ margin: '6px 0 18px', color: 'var(--ent-text-muted)', fontSize: 13 }}>Các tín hiệu quan trọng để khách thuê hiểu hệ thống đang chạy ra sao.</p>
            <div style={{ display: 'grid', gap: 12 }}>
                <ScoreRow icon={TrendingUp} label="Tỷ lệ xử lý" value={`${closeRate}%`} />
                <ScoreRow icon={Timer} label="Tốc độ phản hồi" value={responseRate || '<200ms'} />
                <ScoreRow icon={Sparkles} label="CSAT" value={`${csat || 0}/5`} />
                <ScoreRow icon={Users} label="Thành viên" value={`${members} người`} />
            </div>
        </div>
    );
}

function ScoreRow({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, padding: 12, borderRadius: 8, background: '#f8fafc', border: '1px solid #eef2f7' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, color: 'var(--ent-text-soft)', fontSize: 13, fontWeight: 750 }}>
                <Icon size={16} color="var(--ent-primary)" />
                {label}
            </span>
            <strong style={{ color: 'var(--ent-text)', fontSize: 14 }}>{value}</strong>
        </div>
    );
}

function StarterChecklist({
    workspaceId,
    totalWidgets,
    totalBots,
    activeBots,
    totalKnowledge,
    provisioning,
    onProvision,
}: {
    workspaceId: string;
    totalWidgets: number;
    totalBots: number;
    activeBots: number;
    totalKnowledge: number;
    provisioning: boolean;
    onProvision: () => void;
}) {
    const items = [
        {
            icon: MessageSquare,
            label: 'Widget website',
            desc: totalWidgets > 0 ? `${totalWidgets} widget sẵn sàng để nhúng website.` : 'Tạo widget để khách nhắn trực tiếp từ landing/website.',
            done: totalWidgets > 0,
            href: `/workspace/${workspaceId}/widgets`,
            action: totalWidgets > 0 ? 'Lấy mã nhúng' : 'Tạo widget',
        },
        {
            icon: Bot,
            label: 'Nhân viên AI',
            desc: activeBots > 0 ? `${activeBots}/${totalBots} bot đang bật, có thể trả lời thử.` : totalBots > 0 ? 'Đã có bot nháp, bật bot để trải nghiệm auto-reply.' : 'Tạo bot CSKH mặc định để khách test ngay.',
            done: activeBots > 0,
            href: `/workspace/${workspaceId}/chatbot`,
            action: activeBots > 0 ? 'Cấu hình AI' : 'Bật AI',
        },
        {
            icon: Sparkles,
            label: 'Kho tri thức',
            desc: totalKnowledge > 0 ? `${totalKnowledge} mục kiến thức để AI bám dữ liệu.` : 'Thêm câu hỏi/chính sách/sản phẩm để AI trả lời không bịa.',
            done: totalKnowledge > 0,
            href: `/workspace/${workspaceId}/knowledge`,
            action: totalKnowledge > 0 ? 'Xem tri thức' : 'Thêm dữ liệu',
        },
        {
            icon: Inbox,
            label: 'Test vận hành',
            desc: 'Mở Inbox để thử luồng AI + người thật như khách hàng thật.',
            done: totalWidgets > 0 && activeBots > 0 && totalKnowledge > 0,
            href: `/workspace/${workspaceId}/inbox`,
            action: 'Test chat',
        },
    ];
    const completed = items.filter((item) => item.done).length;

    return (
        <section className="enterprise-section" style={{ padding: 22, marginTop: 16, borderColor: completed === items.length ? 'rgba(18,183,106,.32)' : 'var(--ent-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start', marginBottom: 16 }}>
                <div>
                    <span className="enterprise-kicker">
                        <Sparkles size={14} />
                        Starter kit
                    </span>
                    <h2 style={{ margin: '10px 0 6px', fontSize: 20, fontWeight: 950, color: 'var(--ent-text)' }}>
                        Workspace đã được chuẩn bị sẵn để chạy thử
                    </h2>
                    <p style={{ margin: 0, color: 'var(--ent-text-muted)', fontSize: 13, lineHeight: 1.6 }}>
                        Khách mới không cần hiểu kỹ “tạo bot” là gì: hệ thống tự dựng nền tảng, họ chỉ sửa thông tin doanh nghiệp rồi test.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <button
                        type="button"
                        className="enterprise-button"
                        onClick={onProvision}
                        disabled={provisioning}
                        style={{ opacity: provisioning ? 0.72 : 1 }}
                    >
                        <Sparkles size={15} />
                        {provisioning ? 'Đang chuẩn bị...' : 'Chuẩn bị lại'}
                    </button>
                    <div style={{ minWidth: 132, padding: '10px 12px', borderRadius: 12, background: completed === items.length ? '#ecfdf5' : '#f8fafc', border: '1px solid #eef2f7', textAlign: 'center' }}>
                        <div style={{ fontSize: 24, fontWeight: 950, color: completed === items.length ? '#0f766e' : 'var(--ent-primary)' }}>{completed}/{items.length}</div>
                        <div style={{ fontSize: 11, fontWeight: 850, color: 'var(--ent-text-muted)', textTransform: 'uppercase' }}>sẵn sàng</div>
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }} className="dashboard-metric-grid">
                {items.map(({ icon: Icon, label, desc, done, href, action }) => (
                    <Link key={label} href={href} className="enterprise-card" style={{ padding: 14, textDecoration: 'none', color: 'inherit', display: 'grid', gap: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                            <div style={{ width: 38, height: 38, borderRadius: 10, display: 'grid', placeItems: 'center', color: done ? '#0f766e' : 'var(--ent-primary)', background: done ? '#ecfdf5' : 'var(--ent-primary-soft)' }}>
                                <Icon size={18} />
                            </div>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 900, color: done ? '#0f766e' : '#f79009' }}>
                                {done ? <CheckCircle2 size={14} /> : <Clock3 size={14} />}
                                {done ? 'OK' : 'Cần làm'}
                            </span>
                        </div>
                        <div>
                            <div style={{ color: 'var(--ent-text)', fontSize: 14, fontWeight: 950 }}>{label}</div>
                            <p style={{ margin: '5px 0 0', color: 'var(--ent-text-muted)', fontSize: 12, lineHeight: 1.5 }}>{desc}</p>
                        </div>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--ent-primary)', fontSize: 12, fontWeight: 900 }}>
                            {action}
                            <ArrowRight size={14} />
                        </span>
                    </Link>
                ))}
            </div>
        </section>
    );
}

function NextActions({ workspaceId }: { workspaceId: string }) {
    const actions = [
        { href: `/workspace/${workspaceId}/widgets`, icon: MessageSquare, label: 'Cài Web chat', desc: 'Lấy script nhúng vào website.' },
        { href: `/workspace/${workspaceId}/settings?tab=zalo`, icon: Smartphone, label: 'Kết nối Zalo', desc: 'Quản lý tài khoản và đồng bộ hội thoại.' },
        { href: `/workspace/${workspaceId}/chatbot`, icon: Bot, label: 'Bật nhân viên AI', desc: 'Cấu hình tri thức và kịch bản.' },
    ];

    return (
        <div className="enterprise-section" style={{ padding: 20 }}>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 950 }}>Hành động ưu tiên</h2>
            <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
                {actions.map(({ href, icon: Icon, label, desc }) => (
                    <Link key={href} href={href} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: 12, borderRadius: 8, border: '1px solid var(--ent-border)', textDecoration: 'none', color: 'inherit' }}>
                        <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--ent-primary-soft)', color: 'var(--ent-primary)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                            <Icon size={17} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--ent-text)' }}>{label}</div>
                            <div style={{ fontSize: 12, color: 'var(--ent-text-muted)', marginTop: 2 }}>{desc}</div>
                        </div>
                        <ArrowRight size={15} color="var(--ent-text-muted)" />
                    </Link>
                ))}
            </div>
        </div>
    );
}

type AgentPerformanceRow = {
    userId: string;
    name: string;
    email?: string;
    role?: string;
    stats: {
        open?: number;
        pending?: number;
        closed?: number;
        closeRate?: number;
        messagesSent?: number;
    };
};

function AgentTable({ agents, isLoading }: { agents: AgentPerformanceRow[]; isLoading: boolean }) {
    return (
        <div className="enterprise-section" style={{ overflow: 'hidden' }}>
            <div style={{ padding: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: 17, fontWeight: 950 }}>Hiệu suất agent</h2>
                    <p style={{ margin: '6px 0 0', color: 'var(--ent-text-muted)', fontSize: 13 }}>Theo dõi tải xử lý và chất lượng vận hành của từng nhân sự.</p>
                </div>
            </div>
            {isLoading ? (
                <div style={{ padding: 42, display: 'grid', placeItems: 'center' }}><Spin /></div>
            ) : agents.length === 0 ? (
                <div style={{ padding: 42, textAlign: 'center', color: 'var(--ent-text-muted)' }}>Chưa có dữ liệu agent. Mời thành viên để bắt đầu đo hiệu suất.</div>
            ) : (
                <div style={{ overflowX: 'auto' }}>
                    <table className="enterprise-table">
                        <thead>
                            <tr>
                                <th>Agent</th>
                                <th>Vai trò</th>
                                <th>Đang mở</th>
                                <th>Đã đóng</th>
                                <th>Tỷ lệ đóng</th>
                                <th>Tin nhắn</th>
                            </tr>
                        </thead>
                        <tbody>
                            {agents.map((agent) => (
                                <tr key={agent.userId}>
                                    <td>
                                        <strong style={{ display: 'block', color: 'var(--ent-text)' }}>{agent.name}</strong>
                                        <span style={{ fontSize: 12, color: 'var(--ent-text-muted)' }}>{agent.email}</span>
                                    </td>
                                    <td>{agent.role}</td>
                                    <td>{(agent.stats.open || 0) + (agent.stats.pending || 0)}</td>
                                    <td>{agent.stats.closed || 0}</td>
                                    <td>{agent.stats.closeRate || 0}%</td>
                                    <td>{agent.stats.messagesSent || 0}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

function ChannelReadiness({ workspaceId }: { workspaceId: string }) {
    const channels = [
        { href: `/workspace/${workspaceId}/widgets`, icon: MessageSquare, label: 'Web chat', state: 'Cần kiểm tra script' },
        { href: `/workspace/${workspaceId}/settings?tab=zalo`, icon: Smartphone, label: 'Zalo', state: 'Quản lý tài khoản kết nối' },
        { href: `/workspace/${workspaceId}/chatbot`, icon: Bot, label: 'AI', state: 'Nạp tri thức trước khi bật' },
        { href: `/workspace/${workspaceId}/teams`, icon: Users, label: 'Team', state: 'Phân quyền agent' },
    ];

    return (
        <div className="enterprise-section" style={{ padding: 20 }}>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 950 }}>Độ sẵn sàng kênh</h2>
            <p style={{ margin: '6px 0 16px', color: 'var(--ent-text-muted)', fontSize: 13 }}>Checklist để khách thuê biết còn thiếu gì trước khi đi vào vận hành.</p>
            <div style={{ display: 'grid', gap: 10 }}>
                {channels.map(({ href, icon: Icon, label, state }) => (
                    <Link key={href} href={href} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderRadius: 8, background: '#f8fafc', border: '1px solid #eef2f7', textDecoration: 'none' }}>
                        <Icon size={17} color="var(--ent-primary)" />
                        <div style={{ flex: 1 }}>
                            <div style={{ color: 'var(--ent-text)', fontSize: 13, fontWeight: 900 }}>{label}</div>
                            <div style={{ color: 'var(--ent-text-muted)', fontSize: 12, marginTop: 2 }}>{state}</div>
                        </div>
                        <ArrowRight size={14} color="var(--ent-text-muted)" />
                    </Link>
                ))}
            </div>
        </div>
    );
}
