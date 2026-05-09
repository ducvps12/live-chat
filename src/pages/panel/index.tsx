import React, { useEffect, useState, useCallback } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { Spin, message, Table, Tag, Input, DatePicker, Select, Tooltip, Modal, Switch, Badge, Descriptions } from 'antd';
import { CopyOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import {
    BarChart3, Users, DollarSign, CreditCard, TrendingUp, TrendingDown,
    FileText, Settings, Bell, Search, ArrowUpRight, ArrowDownLeft,
    Shield, RefreshCw, Landmark, Activity, Package, MessageSquare,
    Bot, Globe, Database, Layers, Wallet, Receipt, UserCheck, UserX,
    Timer, Link2, Play, Pause, ExternalLink, Copy, Banknote,
    Monitor, Server, Target, Smartphone, Cpu, HardDrive, Clock,
    Eye, Zap, AlertTriangle, CheckCircle, XCircle, TrendingUp as Growth,
    type LucideIcon,
} from 'lucide-react';
import { httpClient } from '../../lib/http/client';
import { useGetMe } from '../../domains/auth/auth.hooks';

/* ─── Types ─── */
type PanelTab = 'dashboard' | 'revenue' | 'invoices' | 'users' | 'workspaces' | 'bank' | 'system' | 'cron' | 'settings';

interface DashboardStats {
    totalRevenue: number;
    monthlyRevenue: number;
    totalUsers: number;
    activeUsers: number;
    totalWorkspaces: number;
    totalConversations: number;
    totalMessages: number;
    totalBots: number;
}

/* ─── Helpers ─── */
const fmtVND = (n: number) => new Intl.NumberFormat('vi-VN').format(n) + ' ₫';
const fmtNum = (n: number) => new Intl.NumberFormat('vi-VN').format(n);

/* ─── Color Palette ─── */
const COLORS = {
    primary: '#4f46e5',
    primaryLight: '#eef2ff',
    success: '#10b981',
    successLight: '#ecfdf5',
    warning: '#f59e0b',
    warningLight: '#fffbeb',
    danger: '#ef4444',
    dangerLight: '#fef2f2',
    info: '#0ea5e9',
    infoLight: '#f0f9ff',
    purple: '#8b5cf6',
    purpleLight: '#f5f3ff',
};

/* ─── Page ─── */
export default function AdminPanelPage() {
    const router = useRouter();
    const { data: meData, isLoading: meLoading } = useGetMe(true);
    const user = meData?.data?.user;

    const [tab, setTab] = useState<PanelTab>('dashboard');
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [overviewData, setOverviewData] = useState<any>(null);
    const [deepData, setDeepData] = useState<any>(null);
    const [users, setUsers] = useState<any[]>([]);
    const [bankData, setBankData] = useState<any>(null);
    const [acbData, setAcbData] = useState<any>(null);
    const [invoiceFilter, setInvoiceFilter] = useState('');
    const [bankFilter, setBankFilter] = useState('');
    const [userSearch, setUserSearch] = useState('');
    const [selectedUser, setSelectedUser] = useState<any>(null);
    const [userModal, setUserModal] = useState(false);
    const [userModalLoading, setUserModalLoading] = useState(false);
    const [userDetail, setUserDetail] = useState<any>(null);
    const [userDetailLoading, setUserDetailLoading] = useState(false);

    const openUserModal = async (user: any) => {
        setSelectedUser(user);
        setUserModal(true);
        setUserDetailLoading(true);
        try {
            const res = await httpClient.get(`/admin/users/${user.id}`);
            if (res.data?.success) setUserDetail(res.data.data);
        } catch { /* silent */ }
        finally { setUserDetailLoading(false); }
    };

    const fetchDashboard = useCallback(async () => {
        setLoading(true);
        try {
            const [ov, userList, bank, acb, deep] = await Promise.all([
                httpClient.get('/admin/overview').then(r => r.data?.data).catch(() => null),
                httpClient.get('/admin/users').then(r => r.data?.data || []).catch(() => []),
                httpClient.get('/bank/transactions').then(r => r.data?.data).catch(() => null),
                httpClient.get('/admin/acb-transactions').then(r => r.data?.data).catch(() => null),
                httpClient.get('/admin/deep-stats').then(r => r.data?.data).catch(() => null),
            ]);

            if (ov) {
                setOverviewData(ov);
                setStats({
                    totalRevenue: acb?.totalRevenue || 0,
                    monthlyRevenue: acb?.monthlyRevenue || 0,
                    totalUsers: ov.collections?.users || 0,
                    activeUsers: userList.filter?.((u: any) => u.isActive !== false)?.length || userList.length || 0,
                    totalWorkspaces: ov.collections?.workspaces || 0,
                    totalConversations: ov.conversationStats?.total || 0,
                    totalMessages: ov.collections?.messages || 0,
                    totalBots: ov.botStats?.total || 0,
                });
            }
            setUsers(userList);
            setBankData(bank);
            setAcbData(acb);
            setDeepData(deep);
        } catch { /* silent */ }
        setLoading(false);
    }, []);

    useEffect(() => {
        if (!meLoading && user) {
            if (user.role !== 'admin') {
                message.error('Không có quyền truy cập');
                router.push('/');
                return;
            }
            fetchDashboard();
        }
    }, [meLoading, user, fetchDashboard, router]);

    if (meLoading || !user) {
        return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spin size="large" /></div>;
    }
    if (user.role !== 'admin') return null;

    const sideItems: { key: PanelTab; icon: LucideIcon; label: string; section?: string }[] = [
        { key: 'dashboard', icon: BarChart3, label: 'Dashboard', section: 'TỔNG QUAN' },
        { key: 'revenue', icon: TrendingUp, label: 'Doanh thu' },
        { key: 'invoices', icon: Receipt, label: 'Hóa đơn' },
        { key: 'users', icon: Users, label: 'Users', section: 'QUẢN LÝ' },
        { key: 'workspaces', icon: Layers, label: 'Workspaces' },
        { key: 'bank', icon: Landmark, label: 'Auto Bank', section: 'TÀI CHÍNH' },
        { key: 'system', icon: Server, label: 'Hệ thống', section: 'KỸ THUẬT' },
        { key: 'cron', icon: Timer, label: 'Cron Link' },
        { key: 'settings', icon: Settings, label: 'Cài đặt' },
    ];

    return (
        <>
            <Head><title>Admin Panel | NemarkChat</title></Head>
            <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc', fontFamily: "'Inter', -apple-system, sans-serif" }}>
                {/* ─── Sidebar ─── */}
                <aside style={{ width: 240, background: '#0f172a', color: '#fff', padding: '24px 0', display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 100 }}>
                    <div style={{ padding: '0 20px', marginBottom: 32 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Shield size={18} color="#fff" />
                            </div>
                            <div>
                                <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: -0.3 }}>Admin Panel</div>
                                <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 }}>NemarkChat</div>
                            </div>
                        </div>
                    </div>
                    <nav style={{ flex: 1 }}>
                        {sideItems.map(item => {
                            const active = tab === item.key;
                            return (
                                <React.Fragment key={item.key}>
                                    {item.section && (
                                        <div style={{ fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: 1.2, padding: '16px 20px 6px', marginTop: 4 }}>{item.section}</div>
                                    )}
                                    <button
                                        onClick={() => setTab(item.key)}
                                        style={{
                                            width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                                            padding: '10px 20px', border: 'none', cursor: 'pointer',
                                            background: active ? 'rgba(99,102,241,0.15)' : 'transparent',
                                            color: active ? '#a5b4fc' : '#94a3b8',
                                            fontSize: 13, fontWeight: active ? 600 : 400,
                                            borderLeft: active ? '3px solid #6366f1' : '3px solid transparent',
                                            transition: 'all 0.15s',
                                        }}
                                    >
                                        <item.icon size={18} />
                                        {item.label}
                                    </button>
                                </React.Fragment>
                            );
                        })}
                    </nav>
                    <div style={{ padding: '16px 20px', borderTop: '1px solid #1e293b' }}>
                        <div style={{ fontSize: 12, color: '#94a3b8' }}>{user.email}</div>
                        <button onClick={() => router.push('/workspace')} style={{ marginTop: 8, fontSize: 12, color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                            ← Về Workspace
                        </button>
                    </div>
                </aside>

                {/* ─── Main Content ─── */}
                <main style={{ flex: 1, marginLeft: 240, padding: '24px 32px' }}>
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
                        <div>
                            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: '#0f172a' }}>
                                {sideItems.find(s => s.key === tab)?.label || 'Dashboard'}
                            </h1>
                            <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>Quản trị toàn bộ hệ thống NemarkChat</p>
                        </div>
                        <button onClick={fetchDashboard} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, background: '#4f46e5', color: '#fff', border: 'none', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                            <RefreshCw size={14} /> Làm mới
                        </button>
                    </div>

                    {loading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><Spin size="large" /></div>
                    ) : (
                        <>
                            {/* ═══ Dashboard Tab — GOD VIEW ═══ */}
                            {tab === 'dashboard' && stats && (
                                <>
                                    {/* Row 1: Key Metrics */}
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
                                        <StatCard icon={DollarSign} color={COLORS.success} bg={COLORS.successLight} label="Tổng doanh thu" value={fmtVND(stats.totalRevenue)} />
                                        <StatCard icon={Wallet} color={COLORS.warning} bg={COLORS.warningLight} label="Doanh thu tháng" value={fmtVND(stats.monthlyRevenue)} />
                                        <StatCard icon={Users} color={COLORS.primary} bg={COLORS.primaryLight} label="Tổng Users" value={fmtNum(stats.totalUsers)} />
                                        <StatCard icon={Layers} color={COLORS.purple} bg={COLORS.purpleLight} label="Workspaces" value={fmtNum(stats.totalWorkspaces)} />
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
                                        <StatCard icon={MessageSquare} color={COLORS.info} bg={COLORS.infoLight} label="Hội thoại" value={fmtNum(stats.totalConversations)} />
                                        <StatCard icon={FileText} color="#64748b" bg="#f1f5f9" label="Tin nhắn" value={fmtNum(stats.totalMessages)} />
                                        <StatCard icon={Bot} color={COLORS.purple} bg={COLORS.purpleLight} label="AI Bots" value={fmtNum(stats.totalBots)} />
                                        <StatCard icon={UserCheck} color={COLORS.success} bg={COLORS.successLight} label="Users hoạt động" value={fmtNum(stats.activeUsers)} />
                                    </div>

                                    {/* Row 2: Activity Chart + Conversation Breakdown + Server */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 16, marginBottom: 20 }}>
                                        {/* 7-day Activity Chart */}
                                        <PanelCard title="Hoạt động 7 ngày gần nhất" subtitle="Tin nhắn • Hội thoại • Khách truy cập">
                                            {deepData?.trends ? (
                                                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 160, paddingTop: 12 }}>
                                                    {deepData.trends.map((d: any, i: number) => {
                                                        const maxVal = Math.max(...deepData.trends.map((t: any) => t.messages), 1);
                                                        const h = Math.max((d.messages / maxVal) * 130, 4);
                                                        const day = new Date(d.date).toLocaleDateString('vi-VN', { weekday: 'short', day: 'numeric' });
                                                        return (
                                                            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                                                <span style={{ fontSize: 11, fontWeight: 700, color: COLORS.primary }}>{d.messages}</span>
                                                                <div style={{ width: '100%', height: h, borderRadius: 6, background: `linear-gradient(180deg, ${COLORS.primary}, #818cf8)`, transition: 'height 0.3s' }} />
                                                                <span style={{ fontSize: 10, color: '#94a3b8' }}>{day}</span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            ) : <p style={{ color: '#94a3b8', fontSize: 13 }}>Đang tải...</p>}
                                        </PanelCard>

                                        {/* Conversation Status Breakdown */}
                                        <PanelCard title="Trạng thái hội thoại" subtitle="Phân bổ tổng quan">
                                            {overviewData?.conversationStats && (() => {
                                                const cs = overviewData.conversationStats;
                                                const items = [
                                                    { label: 'Đang mở', value: cs.open, color: COLORS.success },
                                                    { label: 'Chờ xử lý', value: cs.pending, color: COLORS.warning },
                                                    { label: 'Đã đóng', value: cs.closed, color: '#94a3b8' },
                                                ];
                                                return (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                                        {items.map((item, idx) => (
                                                            <div key={idx}>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                                                    <span style={{ fontSize: 12, color: '#64748b' }}>{item.label}</span>
                                                                    <span style={{ fontSize: 13, fontWeight: 700, color: item.color }}>{fmtNum(item.value)}</span>
                                                                </div>
                                                                <div style={{ height: 6, borderRadius: 3, background: '#f1f5f9' }}>
                                                                    <div style={{ height: '100%', borderRadius: 3, background: item.color, width: `${cs.total > 0 ? (item.value / cs.total) * 100 : 0}%`, transition: 'width 0.5s' }} />
                                                                </div>
                                                            </div>
                                                        ))}
                                                        <div style={{ textAlign: 'center', marginTop: 8, padding: '10px', background: '#f8fafc', borderRadius: 10 }}>
                                                            <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a' }}>{fmtNum(cs.total)}</div>
                                                            <div style={{ fontSize: 11, color: '#94a3b8' }}>Tổng hội thoại</div>
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                        </PanelCard>

                                        {/* Server Health */}
                                        <PanelCard title="Sức khỏe hệ thống" subtitle={overviewData?.server?.uptimeFormatted || ''}>
                                            {overviewData?.server && (() => {
                                                const sv = overviewData.server;
                                                const memPct = sv.memoryTotal > 0 ? Math.round((sv.memoryUsed / sv.memoryTotal) * 100) : 0;
                                                const ramPct = sv.totalRAM > 0 ? Math.round(((sv.totalRAM - sv.freeRAM) / sv.totalRAM) * 100) : 0;
                                                return (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                            <CheckCircle size={16} color={COLORS.success} />
                                                            <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.success }}>Online</span>
                                                            <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 'auto' }}>{sv.nodeVersion}</span>
                                                        </div>
                                                        {[
                                                            { label: 'Heap Memory', value: `${sv.memoryUsed}MB / ${sv.memoryTotal}MB`, pct: memPct, color: memPct > 80 ? COLORS.danger : COLORS.info },
                                                            { label: 'System RAM', value: `${sv.totalRAM - sv.freeRAM}GB / ${sv.totalRAM}GB`, pct: ramPct, color: ramPct > 80 ? COLORS.danger : COLORS.success },
                                                        ].map((m, idx) => (
                                                            <div key={idx}>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b', marginBottom: 3 }}>
                                                                    <span>{m.label}</span><span>{m.value}</span>
                                                                </div>
                                                                <div style={{ height: 5, borderRadius: 3, background: '#f1f5f9' }}>
                                                                    <div style={{ height: '100%', borderRadius: 3, background: m.color, width: `${m.pct}%` }} />
                                                                </div>
                                                            </div>
                                                        ))}
                                                        <div style={{ fontSize: 11, color: '#94a3b8', display: 'flex', justifyContent: 'space-between' }}>
                                                            <span>CPU: {sv.cpus} cores</span><span>{sv.platform}</span>
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                        </PanelCard>
                                    </div>

                                    {/* Row 3: Quick Stats + Recent Revenue */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16, marginBottom: 20 }}>
                                        {/* Zalo */}
                                        <PanelCard title="Zalo Integration" subtitle="">
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                                {[
                                                    { label: 'Tài khoản Zalo', value: fmtNum(deepData?.zalo?.accounts || 0), color: COLORS.info },
                                                    { label: 'Liên hệ Zalo', value: fmtNum(deepData?.zalo?.contacts || 0), color: COLORS.primary },
                                                    { label: 'Tin nhắn Zalo', value: fmtNum(deepData?.zalo?.messages || 0), color: COLORS.purple },
                                                ].map((item, idx) => (
                                                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#f8fafc', borderRadius: 8 }}>
                                                        <span style={{ fontSize: 12, color: '#64748b' }}>{item.label}</span>
                                                        <span style={{ fontSize: 14, fontWeight: 700, color: item.color }}>{item.value}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </PanelCard>

                                        {/* Leads */}
                                        <PanelCard title="Leads" subtitle="">
                                            <div style={{ textAlign: 'center', padding: '12px 0' }}>
                                                <div style={{ fontSize: 36, fontWeight: 800, color: COLORS.primary }}>{fmtNum(deepData?.leads?.total || 0)}</div>
                                                <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 12 }}>Tổng leads</div>
                                                <div style={{ display: 'flex', justifyContent: 'center', gap: 16 }}>
                                                    <div><span style={{ fontSize: 18, fontWeight: 700, color: COLORS.success }}>{fmtNum(deepData?.leads?.new || 0)}</span><div style={{ fontSize: 10, color: '#94a3b8' }}>Mới</div></div>
                                                    <div><span style={{ fontSize: 18, fontWeight: 700, color: '#64748b' }}>{fmtNum((deepData?.leads?.total || 0) - (deepData?.leads?.new || 0))}</span><div style={{ fontSize: 10, color: '#94a3b8' }}>Đang xử lý</div></div>
                                                </div>
                                            </div>
                                        </PanelCard>

                                        {/* Orders */}
                                        <PanelCard title="Đơn hàng" subtitle="">
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                                {[
                                                    { label: 'Tổng đơn', value: fmtNum(deepData?.orders?.total || 0), color: '#0f172a' },
                                                    { label: 'Chờ xử lý', value: fmtNum(deepData?.orders?.pending || 0), color: COLORS.warning },
                                                    { label: 'Doanh thu đơn', value: fmtVND(deepData?.orders?.revenue || 0), color: COLORS.success },
                                                ].map((item, idx) => (
                                                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#f8fafc', borderRadius: 8 }}>
                                                        <span style={{ fontSize: 12, color: '#64748b' }}>{item.label}</span>
                                                        <span style={{ fontSize: 13, fontWeight: 700, color: item.color }}>{item.value}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </PanelCard>

                                        {/* Subscriptions */}
                                        <PanelCard title="Gói dịch vụ" subtitle="">
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                                {[
                                                    { label: 'Subscriptions active', value: fmtNum(deepData?.subscriptions?.active || 0), color: COLORS.success },
                                                    { label: 'Tổng hóa đơn', value: fmtNum(deepData?.subscriptions?.invoices || 0), color: '#0f172a' },
                                                    { label: 'Đã thanh toán', value: fmtNum(deepData?.subscriptions?.paidInvoices || 0), color: COLORS.info },
                                                ].map((item, idx) => (
                                                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#f8fafc', borderRadius: 8 }}>
                                                        <span style={{ fontSize: 12, color: '#64748b' }}>{item.label}</span>
                                                        <span style={{ fontSize: 13, fontWeight: 700, color: item.color }}>{item.value}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </PanelCard>
                                    </div>

                                    {/* Row 4: Recent Revenue + Workspace Table */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                        <PanelCard title="Doanh thu gần đây" subtitle={`Từ ${acbData?.account?.bank || 'ACB'}`}>
                                            {acbData?.transactions?.slice(0, 6).map((tx: any, idx: number) => (
                                                <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #10b981, #059669)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                            <ArrowDownLeft size={14} color="#fff" />
                                                        </div>
                                                        <div>
                                                            <div style={{ fontSize: 12, fontWeight: 500, color: '#1e293b', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.description}</div>
                                                            <div style={{ fontSize: 10, color: '#94a3b8' }}>{tx.senderName || ''} {tx.postingDate ? `• ${new Date(tx.postingDate).toLocaleString('vi-VN')}` : ''}</div>
                                                        </div>
                                                    </div>
                                                    <span style={{ fontWeight: 700, fontSize: 13, color: COLORS.success }}>+{fmtVND(tx.amount)}</span>
                                                </div>
                                            )) || <p style={{ color: '#94a3b8', fontSize: 13 }}>Chưa có giao dịch</p>}
                                        </PanelCard>

                                        <PanelCard title="Workspaces" subtitle="Tất cả workspaces trong hệ thống">
                                            <Table
                                                dataSource={deepData?.workspaces || []}
                                                rowKey="id" size="small" pagination={false}
                                                columns={[
                                                    { title: 'Tên', dataIndex: 'name', render: (n: string, r: any) => <div><div style={{ fontWeight: 600, fontSize: 13 }}>{n}</div><div style={{ fontSize: 10, color: '#94a3b8' }}>{r.slug} • {r.plan}</div></div> },
                                                    { title: 'Members', dataIndex: 'memberCount', width: 70, align: 'center' as const },
                                                    { title: 'Hội thoại', dataIndex: 'conversationCount', width: 80, align: 'center' as const, render: (c: number) => <span style={{ fontWeight: 600, color: COLORS.primary }}>{fmtNum(c)}</span> },
                                                    { title: 'Visitors', dataIndex: 'visitorCount', width: 70, align: 'center' as const },
                                                    { title: '', dataIndex: 'isActive', width: 40, render: (a: boolean) => a ? <CheckCircle size={14} color={COLORS.success} /> : <XCircle size={14} color={COLORS.danger} /> },
                                                ]}
                                            />
                                        </PanelCard>
                                    </div>
                                </>
                            )}

                            {/* ═══ Revenue Tab (ACB Bank) ═══ */}
                            {tab === 'revenue' && (
                                <>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
                                        <StatCard icon={TrendingUp} color={COLORS.success} bg={COLORS.successLight} label="Doanh thu NemarkChat" value={fmtVND(acbData?.totalRevenue || 0)} />
                                        <StatCard icon={Wallet} color={COLORS.primary} bg={COLORS.primaryLight} label="Doanh thu tháng này" value={fmtVND(acbData?.monthlyRevenue || 0)} />
                                        <StatCard icon={Receipt} color={COLORS.info} bg={COLORS.infoLight} label="Số giao dịch" value={fmtNum(acbData?.transactionCount || 0)} />
                                    </div>
                                    <PanelCard title="Chi tiết doanh thu NemarkChat" subtitle={`Ngân hàng nhận: ${acbData?.account?.bank || 'ACB'} — STK: ${acbData?.account?.number || ''} — ${acbData?.account?.holder || ''}`}>
                                        <Table
                                            dataSource={acbData?.transactions || []}
                                            rowKey={(_, i) => String(i)} size="small" pagination={{ pageSize: 10 }}
                                            columns={[
                                                { title: 'Thời gian', dataIndex: 'postingDate', width: 180, render: (d: number) => <span style={{ fontSize: 12 }}>{d ? new Date(d).toLocaleString('vi-VN') : ''}</span> },
                                                { title: 'Nội dung', dataIndex: 'description', render: (d: string) => <span style={{ fontSize: 12 }}>{d}</span> },
                                                { title: 'Người gửi', dataIndex: 'senderName', width: 160, render: (s: string) => <span style={{ fontSize: 12, color: '#64748b' }}>{s || '—'}</span> },
                                                { title: 'Số tiền', dataIndex: 'amount', width: 130, align: 'right' as const, render: (a: number) => <span style={{ color: COLORS.success, fontWeight: 700 }}>+{fmtVND(a)}</span> },
                                            ]}
                                        />
                                    </PanelCard>
                                </>
                            )}

                            {/* ═══ Invoices Tab ═══ */}
                            {tab === 'invoices' && (
                                <PanelCard title="Quản lý hóa đơn" subtitle="Theo dõi tất cả hóa đơn trong hệ thống">
                                    <div style={{ marginBottom: 16, display: 'flex', gap: 12 }}>
                                        <Input
                                            placeholder="Tìm theo nội dung, mã HĐ..."
                                            prefix={<Search size={14} color="#94a3b8" />}
                                            value={invoiceFilter}
                                            onChange={e => setInvoiceFilter(e.target.value)}
                                            style={{ maxWidth: 360, borderRadius: 10 }}
                                            allowClear
                                        />
                                    </div>
                                    <Table
                                        dataSource={(bankData?.transactions?.map((tx: any, i: number) => ({
                                            ...tx, invoiceId: `INV-${String(i + 1).padStart(4, '0')}`,
                                            status: tx.type === 'credit' ? 'paid' : 'expense',
                                        })) || []).filter((tx: any) => {
                                            if (!invoiceFilter) return true;
                                            const q = invoiceFilter.toLowerCase();
                                            return (tx.description || '').toLowerCase().includes(q) || (tx.invoiceId || '').toLowerCase().includes(q);
                                        })}
                                        rowKey="id" size="small" pagination={{ pageSize: 10 }}
                                        columns={[
                                            { title: 'Mã HĐ', dataIndex: 'invoiceId', width: 100, render: (id: string) => <Tag color="blue">{id}</Tag> },
                                            { title: 'Ngày', dataIndex: 'transactionDate', width: 160 },
                                            { title: 'Nội dung', dataIndex: 'description', ellipsis: true },
                                            { title: 'Số tiền', key: 'amount', width: 130, align: 'right' as const, render: (_: any, r: any) => r.creditAmount > 0 ? <span style={{ color: COLORS.success, fontWeight: 600 }}>+{fmtVND(r.creditAmount)}</span> : <span style={{ color: COLORS.danger, fontWeight: 600 }}>-{fmtVND(r.debitAmount)}</span> },
                                            { title: 'Trạng thái', dataIndex: 'status', width: 100, render: (s: string) => <Tag color={s === 'paid' ? 'green' : 'red'}>{s === 'paid' ? 'Đã thu' : 'Chi'}</Tag> },
                                        ]}
                                    />
                                </PanelCard>
                            )}

                            {/* ═══ Users Tab ═══ */}
                            {tab === 'users' && (
                                <>
                                    {/* User Stats */}
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
                                        <StatCard icon={Users} color={COLORS.primary} bg={COLORS.primaryLight} label="Tổng thành viên" value={fmtNum(users.length)} />
                                        <StatCard icon={UserCheck} color={COLORS.success} bg={COLORS.successLight} label="Đang hoạt động" value={fmtNum(users.filter((u: any) => u.isActive !== false).length)} />
                                        <StatCard icon={Shield} color={COLORS.purple} bg={COLORS.purpleLight} label="Admin" value={fmtNum(users.filter((u: any) => u.role === 'admin').length)} />
                                        <StatCard icon={UserX} color={COLORS.danger} bg={COLORS.dangerLight} label="Bị vô hiệu hóa" value={fmtNum(users.filter((u: any) => u.isActive === false).length)} />
                                    </div>

                                    {/* Search & Filter */}
                                    <PanelCard title="Danh sách thành viên" subtitle={`Hiển thị ${users.filter((u: any) => !userSearch || u.name?.toLowerCase().includes(userSearch.toLowerCase()) || u.email?.toLowerCase().includes(userSearch.toLowerCase())).length} / ${users.length} kết quả`}>
                                        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                                            <Input prefix={<SearchOutlined />} placeholder="Tìm theo tên, email, ID..." value={userSearch} onChange={e => setUserSearch(e.target.value)} style={{ width: 320 }} allowClear />
                                            <Select placeholder="Tất cả Role" allowClear style={{ width: 140 }} onChange={(v: string) => setUserSearch(v || '')} options={[{ value: 'admin', label: 'Admin' }, { value: 'agent', label: 'Agent' }, { value: 'member', label: 'Member' }]} />
                                            <button onClick={() => setUserSearch('')} style={{ padding: '4px 16px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 13, color: '#64748b' }}>Reset</button>
                                            <span style={{ marginLeft: 'auto', fontSize: 13, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}><Users size={14} /> {users.length} kết quả</span>
                                        </div>

                                        <Table
                                            dataSource={users.filter((u: any) => !userSearch || u.name?.toLowerCase().includes(userSearch.toLowerCase()) || u.email?.toLowerCase().includes(userSearch.toLowerCase()) || u.role?.includes(userSearch))}
                                            rowKey={(r: any) => r.id || r.email}
                                            size="small" pagination={{ pageSize: 15, showSizeChanger: true, showTotal: (t: number) => `${t} users` }}
                                            onRow={(record: any) => ({ onClick: () => openUserModal(record), style: { cursor: 'pointer' } })}
                                            columns={[
                                                { title: 'Tài khoản', dataIndex: 'name', render: (n: string, r: any) => (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                        <div style={{ width: 38, height: 38, borderRadius: '50%', background: r.avatarUrl ? `url(${r.avatarUrl}) center/cover` : `linear-gradient(135deg, ${r.role === 'admin' ? '#8b5cf6' : '#3b82f6'}, ${r.role === 'admin' ? '#6366f1' : '#06b6d4'})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
                                                            {!r.avatarUrl && (n || '?')[0].toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <div style={{ fontWeight: 600, fontSize: 13 }}>{n || 'N/A'}</div>
                                                            <div style={{ fontSize: 11, color: '#94a3b8' }}>{r.email}</div>
                                                        </div>
                                                    </div>
                                                )},
                                                { title: 'Workspaces', dataIndex: 'workspaceCount', width: 100, align: 'center' as const, render: (c: number, r: any) => (
                                                    <Tooltip title={r.workspaces?.map((w: any) => w.name).join(', ') || 'Không có'}><span style={{ fontWeight: 600, color: COLORS.primary }}>{c || 0}</span></Tooltip>
                                                )},
                                                { title: 'Bảo mật', key: 'security', width: 220, render: (_: any, r: any) => (
                                                    <div style={{ fontSize: 11 }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                            <span style={{ color: '#94a3b8' }}>IP:</span> <span style={{ fontFamily: 'monospace', color: '#475569' }}>{r.lastIP || '—'}</span>
                                                        </div>
                                                        <div style={{ color: '#94a3b8' }}>Lần đăng nhập: {r.lastLogin ? new Date(r.lastLogin).toLocaleString('vi-VN') : '—'}</div>
                                                    </div>
                                                )},
                                                { title: 'Chức vụ', dataIndex: 'role', width: 100, align: 'center' as const, render: (r: string) => <Tag color={r === 'admin' ? 'purple' : r === 'agent' ? 'blue' : 'default'}>{r}</Tag> },
                                                { title: 'Trạng thái', dataIndex: 'isActive', width: 100, align: 'center' as const, render: (a: boolean) => a !== false ? <Badge status="success" text={<span style={{ fontSize: 12 }}>Hoạt động</span>} /> : <Badge status="error" text={<span style={{ fontSize: 12 }}>Vô hiệu</span>} /> },
                                                { title: 'Ngày tham gia', dataIndex: 'createdAt', width: 120, render: (d: string) => <span style={{ fontSize: 12, color: '#64748b' }}>{d ? new Date(d).toLocaleDateString('vi-VN') : '—'}</span> },
                                                { title: 'Action', key: 'action', width: 80, align: 'center' as const, render: (_: any, r: any) => (
                                                    <button onClick={(e) => { e.stopPropagation(); openUserModal(r); }} style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 11, color: COLORS.primary, fontWeight: 600 }}>Chi tiết</button>
                                                )},
                                            ]}
                                        />
                                    </PanelCard>

                                    {/* User Edit Modal */}
                                    <Modal
                                        open={userModal}
                                        onCancel={() => { setUserModal(false); setSelectedUser(null); setUserDetail(null); }}
                                        footer={null}
                                        width={760}
                                        styles={{ body: { maxHeight: '75vh', overflowY: 'auto', padding: '8px 0' } }}
                                        title={<div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            <div style={{ width: 42, height: 42, borderRadius: '50%', background: `linear-gradient(135deg, ${selectedUser?.role === 'admin' ? '#8b5cf6' : '#3b82f6'}, ${selectedUser?.role === 'admin' ? '#6366f1' : '#06b6d4'})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 16 }}>
                                                {(selectedUser?.name || '?')[0].toUpperCase()}
                                            </div>
                                            <div>
                                                <div style={{ fontSize: 16, fontWeight: 700 }}>Chỉnh sửa: {selectedUser?.name}</div>
                                                <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 400 }}>{selectedUser?.email} • ID: {selectedUser?.id?.substring(0, 8)}...</div>
                                            </div>
                                        </div>}
                                    >
                                        {selectedUser && (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 8 }}>
                                                {/* Section 1: Editable Profile */}
                                                <div style={{ background: '#f8fafc', borderRadius: 12, padding: 20 }}>
                                                    <h4 style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}><Shield size={14} /> CHỈNH SỬA THÔNG TIN</h4>
                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                                        <div>
                                                            <label style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginBottom: 4, display: 'block' }}>Tên hiển thị *</label>
                                                            <Input value={selectedUser.name || ''} onChange={e => setSelectedUser({ ...selectedUser, name: e.target.value })} />
                                                        </div>
                                                        <div>
                                                            <label style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginBottom: 4, display: 'block' }}>Email *</label>
                                                            <Input value={selectedUser.email || ''} onChange={e => setSelectedUser({ ...selectedUser, email: e.target.value })} />
                                                        </div>
                                                        <div>
                                                            <label style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginBottom: 4, display: 'block' }}>Chức vụ (Level)</label>
                                                            <Select value={selectedUser.role} onChange={(v: string) => setSelectedUser({ ...selectedUser, role: v })} style={{ width: '100%' }}
                                                                options={[{ value: 'admin', label: '👑 Admin' }, { value: 'agent', label: '🧑‍💼 Agent' }, { value: 'member', label: '👤 Member' }]} />
                                                        </div>
                                                        <div>
                                                            <label style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginBottom: 4, display: 'block' }}>Trạng thái</label>
                                                            <Select value={selectedUser.isActive !== false ? 'active' : 'banned'} onChange={(v: string) => setSelectedUser({ ...selectedUser, isActive: v === 'active' })} style={{ width: '100%' }}
                                                                options={[{ value: 'active', label: '✅ Hoạt động' }, { value: 'banned', label: '🚫 Vô hiệu hóa' }]} />
                                                        </div>
                                                    </div>
                                                    <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                                                        <button onClick={async () => {
                                                            try {
                                                                setUserModalLoading(true);
                                                                await httpClient.patch(`/admin/users/${selectedUser.id}`, { name: selectedUser.name, email: selectedUser.email, role: selectedUser.role, isActive: selectedUser.isActive });
                                                                message.success('Cập nhật thành công!');
                                                                fetchDashboard();
                                                            } catch { message.error('Lỗi cập nhật'); }
                                                            finally { setUserModalLoading(false); }
                                                        }} disabled={userModalLoading} style={{ padding: '8px 24px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                                                            {userModalLoading ? '...' : '💾 LƯU NGAY'}
                                                        </button>
                                                        <button onClick={() => { setUserModal(false); setSelectedUser(null); }} style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                                                            ↩ TRỞ LẠI
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Section 2: Security & Sessions */}
                                                <div style={{ background: '#f8fafc', borderRadius: 12, padding: 20 }}>
                                                    <h4 style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}><Activity size={14} /> BẢO MẬT & PHIÊN ĐĂNG NHẬP</h4>
                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                                                        {[
                                                            { label: 'IP đăng nhập', value: selectedUser.lastIP || '—', mono: true },
                                                            { label: 'Lần đăng nhập cuối', value: selectedUser.lastLogin ? new Date(selectedUser.lastLogin).toLocaleString('vi-VN') : '—' },
                                                            { label: 'Ngày tạo tài khoản', value: selectedUser.createdAt ? new Date(selectedUser.createdAt).toLocaleString('vi-VN') : '—' },
                                                            { label: 'Cập nhật lần cuối', value: selectedUser.updatedAt ? new Date(selectedUser.updatedAt).toLocaleString('vi-VN') : '—' },
                                                        ].map((item, idx) => (
                                                            <div key={idx} style={{ padding: '10px 14px', background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                                                                <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>{item.label}</div>
                                                                <div style={{ fontSize: 13, fontWeight: 500, color: '#0f172a', fontFamily: item.mono ? 'monospace' : 'inherit' }}>{item.value}</div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    {selectedUser.lastDevice && (
                                                        <div style={{ padding: '10px 14px', background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 14 }}>
                                                            <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>THIẾT BỊ ĐĂNG NHẬP</div>
                                                            <div style={{ fontSize: 11, color: '#475569', wordBreak: 'break-all' }}>{selectedUser.lastDevice}</div>
                                                        </div>
                                                    )}
                                                    <button onClick={async () => {
                                                        try {
                                                            const res = await httpClient.post(`/admin/users/${selectedUser.id}/revoke-sessions`);
                                                            message.success(res.data?.message || 'Đã thu hồi tất cả phiên');
                                                        } catch { message.error('Lỗi thu hồi phiên'); }
                                                    }} style={{ padding: '7px 18px', borderRadius: 8, border: '1px solid #fbbf24', background: '#fffbeb', color: '#92400e', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
                                                        🔒 Thu hồi tất cả phiên đăng nhập
                                                    </button>
                                                </div>

                                                {/* Section 3: Workspaces */}
                                                <div style={{ background: '#f8fafc', borderRadius: 12, padding: 20 }}>
                                                    <h4 style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}><Layers size={14} /> WORKSPACES ({selectedUser.workspaces?.length || 0})</h4>
                                                    {selectedUser.workspaces?.length > 0 ? (
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                            {selectedUser.workspaces.map((ws: any, idx: number) => (
                                                                <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                                        <div style={{ width: 32, height: 32, borderRadius: 8, background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.purple})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 12 }}>{(ws.name || '?')[0].toUpperCase()}</div>
                                                                        <div>
                                                                            <div style={{ fontSize: 13, fontWeight: 600 }}>{ws.name}</div>
                                                                            <div style={{ fontSize: 10, color: '#94a3b8' }}>{ws.slug} • {ws.plan}</div>
                                                                        </div>
                                                                    </div>
                                                                    <Tag color={ws.role === 'owner' ? 'gold' : ws.role === 'admin' ? 'purple' : 'blue'}>{ws.role}</Tag>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : <p style={{ color: '#94a3b8', fontSize: 12, margin: 0 }}>Chưa tham gia workspace nào</p>}
                                                </div>

                                                {/* Section 4: Activity Stats */}
                                                <div style={{ background: '#f8fafc', borderRadius: 12, padding: 20 }}>
                                                    <h4 style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}><BarChart3 size={14} /> HOẠT ĐỘNG</h4>
                                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                                                        {[
                                                            { label: 'Đơn hàng', value: selectedUser.orderCount || 0, color: COLORS.success },
                                                            { label: 'Sản phẩm', value: selectedUser.productCount || 0, color: COLORS.info },
                                                            { label: 'Campaigns', value: selectedUser.campaignCount || 0, color: COLORS.purple },
                                                            { label: 'Macros', value: selectedUser.macroCount || 0, color: '#64748b' },
                                                        ].map((item, idx) => (
                                                            <div key={idx} style={{ textAlign: 'center', padding: '12px 8px', background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                                                                <div style={{ fontSize: 22, fontWeight: 800, color: item.color }}>{item.value}</div>
                                                                <div style={{ fontSize: 10, color: '#94a3b8' }}>{item.label}</div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Section 5: Financial Tracking */}
                                                <div style={{ background: '#f0fdf4', borderRadius: 12, padding: 20, border: '1px solid #bbf7d0' }}>
                                                    <h4 style={{ fontSize: 13, fontWeight: 700, color: '#166534', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}><DollarSign size={14} /> DÒNG TIỀN</h4>
                                                    {userDetailLoading ? <Spin size="small" /> : (
                                                        <>
                                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 14 }}>
                                                                {[
                                                                    { label: 'Tổng doanh thu đơn', value: `${(userDetail?.totalRevenue || 0).toLocaleString('vi-VN')} đ`, color: '#16a34a' },
                                                                    { label: 'Hóa đơn đã thanh toán', value: `${(userDetail?.totalInvoicePaid || 0).toLocaleString('vi-VN')} đ`, color: '#2563eb' },
                                                                    { label: 'Tổng đơn hàng', value: userDetail?.orders?.length || 0, color: '#7c3aed' },
                                                                ].map((item, idx) => (
                                                                    <div key={idx} style={{ textAlign: 'center', padding: '14px 8px', background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                                                                        <div style={{ fontSize: 18, fontWeight: 800, color: item.color }}>{item.value}</div>
                                                                        <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>{item.label}</div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                            {(userDetail?.orders?.length > 0) && (
                                                                <>
                                                                    <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Lịch sử đơn hàng gần nhất</div>
                                                                    <div style={{ maxHeight: 180, overflowY: 'auto', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                                                                        <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
                                                                            <thead><tr style={{ background: '#f8fafc' }}>
                                                                                {['Mã đơn', 'Khách hàng', 'Tổng tiền', 'Trạng thái', 'Ngày tạo'].map(h => <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>{h}</th>)}
                                                                            </tr></thead>
                                                                            <tbody>
                                                                                {userDetail.orders.slice(0, 10).map((o: any) => (
                                                                                    <tr key={o.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                                                        <td style={{ padding: '6px 10px', fontFamily: 'monospace', fontWeight: 600 }}>{o.orderNumber}</td>
                                                                                        <td style={{ padding: '6px 10px' }}>{o.customerName || '—'}</td>
                                                                                        <td style={{ padding: '6px 10px', fontWeight: 600, color: '#16a34a' }}>{o.total?.toLocaleString('vi-VN')} đ</td>
                                                                                        <td style={{ padding: '6px 10px' }}><Tag color={o.status === 'delivered' ? 'green' : o.status === 'cancelled' ? 'red' : o.status === 'pending' ? 'orange' : 'blue'}>{o.status}</Tag></td>
                                                                                        <td style={{ padding: '6px 10px', color: '#94a3b8' }}>{new Date(o.createdAt).toLocaleDateString('vi-VN')}</td>
                                                                                    </tr>
                                                                                ))}
                                                                            </tbody>
                                                                        </table>
                                                                    </div>
                                                                </>
                                                            )}
                                                            {(userDetail?.invoices?.length > 0) && (
                                                                <>
                                                                    <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8, marginTop: 14 }}>Hóa đơn dịch vụ</div>
                                                                    <div style={{ maxHeight: 150, overflowY: 'auto', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                                                                        <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
                                                                            <thead><tr style={{ background: '#f8fafc' }}>
                                                                                {['Mã HĐ', 'Gói', 'Số tiền', 'Trạng thái', 'Ngày'].map(h => <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>{h}</th>)}
                                                                            </tr></thead>
                                                                            <tbody>
                                                                                {userDetail.invoices.slice(0, 10).map((inv: any) => (
                                                                                    <tr key={inv.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                                                        <td style={{ padding: '6px 10px', fontFamily: 'monospace' }}>{inv.invoiceNumber}</td>
                                                                                        <td style={{ padding: '6px 10px' }}>{inv.planId}</td>
                                                                                        <td style={{ padding: '6px 10px', fontWeight: 600, color: '#2563eb' }}>{inv.amount?.toLocaleString('vi-VN')} đ</td>
                                                                                        <td style={{ padding: '6px 10px' }}><Tag color={inv.status === 'paid' ? 'green' : inv.status === 'pending' ? 'orange' : 'red'}>{inv.status}</Tag></td>
                                                                                        <td style={{ padding: '6px 10px', color: '#94a3b8' }}>{new Date(inv.createdAt).toLocaleDateString('vi-VN')}</td>
                                                                                    </tr>
                                                                                ))}
                                                                            </tbody>
                                                                        </table>
                                                                    </div>
                                                                </>
                                                            )}
                                                        </>
                                                    )}
                                                </div>

                                                {/* Section 6: Session History */}
                                                <div style={{ background: '#f8fafc', borderRadius: 12, padding: 20 }}>
                                                    <h4 style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}><Clock size={14} /> NHẬT KÝ ĐĂNG NHẬP ({userDetail?.sessions?.length || 0})</h4>
                                                    {userDetailLoading ? <Spin size="small" /> : (userDetail?.sessions?.length > 0 ? (
                                                        <div style={{ maxHeight: 200, overflowY: 'auto', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                                                            <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
                                                                <thead><tr style={{ background: '#f1f5f9' }}>
                                                                    {['IP', 'Thời gian', 'Hết hạn', 'Trạng thái'].map(h => <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>{h}</th>)}
                                                                </tr></thead>
                                                                <tbody>
                                                                    {userDetail.sessions.map((s: any) => (
                                                                        <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                                            <td style={{ padding: '6px 10px', fontFamily: 'monospace' }}>{s.ipAddress || '—'}</td>
                                                                            <td style={{ padding: '6px 10px' }}>{new Date(s.createdAt).toLocaleString('vi-VN')}</td>
                                                                            <td style={{ padding: '6px 10px', color: '#94a3b8' }}>{new Date(s.expiresAt).toLocaleDateString('vi-VN')}</td>
                                                                            <td style={{ padding: '6px 10px' }}>{s.revokedAt ? <Tag color="red">Thu hồi</Tag> : new Date(s.expiresAt) > new Date() ? <Tag color="green">Active</Tag> : <Tag color="default">Hết hạn</Tag>}</td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    ) : <p style={{ color: '#94a3b8', fontSize: 12, margin: 0 }}>Chưa có lịch sử đăng nhập</p>)}
                                                </div>

                                                {/* Section 5: Danger Zone */}
                                                <div style={{ background: '#fef2f2', borderRadius: 12, padding: 20, border: '1px solid #fecaca' }}>
                                                    <h4 style={{ fontSize: 13, fontWeight: 700, color: '#991b1b', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}><AlertTriangle size={14} /> VÙNG NGUY HIỂM</h4>
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                        <div><span style={{ fontSize: 13, fontWeight: 500, color: '#991b1b' }}>Xóa tài khoản vĩnh viễn</span><div style={{ fontSize: 11, color: '#94a3b8' }}>Hành động không thể hoàn tác, xóa tất cả dữ liệu</div></div>
                                                        <button onClick={async () => {
                                                            if (!confirm(`Bạn chắc chắn muốn xóa user "${selectedUser.name}" (${selectedUser.email})?`)) return;
                                                            try {
                                                                await httpClient.delete(`/admin/users/${selectedUser.id}`);
                                                                message.success('Đã xóa user');
                                                                setUserModal(false); setSelectedUser(null); fetchDashboard();
                                                            } catch { message.error('Lỗi xóa user'); }
                                                        }} style={{ padding: '7px 18px', borderRadius: 8, border: '1px solid #ef4444', background: '#fff', color: '#ef4444', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                                                            🗑 XÓA USER
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </Modal>
                                </>
                            )}

                            {/* ═══ Workspaces Tab ═══ */}
                            {tab === 'workspaces' && (
                                <>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
                                        <StatCard icon={Layers} color={COLORS.primary} bg={COLORS.primaryLight} label="Tổng Workspaces" value={fmtNum(deepData?.workspaces?.length || 0)} />
                                        <StatCard icon={Users} color={COLORS.info} bg={COLORS.infoLight} label="Tổng Members" value={fmtNum(deepData?.workspaces?.reduce((s: number, w: any) => s + (w.memberCount || 0), 0) || 0)} />
                                        <StatCard icon={MessageSquare} color={COLORS.success} bg={COLORS.successLight} label="Tổng Hội thoại" value={fmtNum(deepData?.workspaces?.reduce((s: number, w: any) => s + (w.conversationCount || 0), 0) || 0)} />
                                        <StatCard icon={Eye} color={COLORS.purple} bg={COLORS.purpleLight} label="Tổng Visitors" value={fmtNum(deepData?.workspaces?.reduce((s: number, w: any) => s + (w.visitorCount || 0), 0) || 0)} />
                                    </div>
                                    <PanelCard title="Quản lý Workspaces" subtitle="Tất cả workspaces trong hệ thống">
                                        <Table
                                            dataSource={deepData?.workspaces || []}
                                            rowKey="id" size="small" pagination={{ pageSize: 20 }}
                                            columns={[
                                                { title: 'Workspace', dataIndex: 'name', render: (n: string, r: any) => (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                        <div style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.purple})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 14 }}>
                                                            {(n || '?')[0].toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <div style={{ fontWeight: 600, fontSize: 13 }}>{n}</div>
                                                            <div style={{ fontSize: 11, color: '#94a3b8' }}>{r.slug}</div>
                                                        </div>
                                                    </div>
                                                )},
                                                { title: 'Plan', dataIndex: 'plan', width: 100, render: (p: string) => <Tag color={p === 'enterprise' ? 'purple' : p === 'pro' ? 'blue' : p === 'starter' ? 'green' : 'default'}>{p}</Tag> },
                                                { title: 'Members', dataIndex: 'memberCount', width: 80, align: 'center' as const, render: (c: number) => <span style={{ fontWeight: 600 }}>{c}</span> },
                                                { title: 'Hội thoại', dataIndex: 'conversationCount', width: 90, align: 'center' as const, render: (c: number) => <span style={{ fontWeight: 600, color: COLORS.primary }}>{fmtNum(c)}</span> },
                                                { title: 'Widgets', dataIndex: 'widgetCount', width: 80, align: 'center' as const },
                                                { title: 'Visitors', dataIndex: 'visitorCount', width: 80, align: 'center' as const, render: (c: number) => fmtNum(c) },
                                                { title: 'Ngày tạo', dataIndex: 'createdAt', width: 110, render: (d: string) => <span style={{ fontSize: 12, color: '#64748b' }}>{d ? new Date(d).toLocaleDateString('vi-VN') : ''}</span> },
                                                { title: 'Status', dataIndex: 'isActive', width: 70, align: 'center' as const, render: (a: boolean) => a ? <Tag color="green">Active</Tag> : <Tag color="red">Off</Tag> },
                                            ]}
                                        />
                                    </PanelCard>
                                </>
                            )}

                            {/* ═══ Auto Bank Tab ═══ */}
                            {tab === 'bank' && <AutoBankTab bankData={bankData} bankFilter={bankFilter} setBankFilter={setBankFilter} fetchDashboard={fetchDashboard} />}

                            {/* ═══ System Tab ═══ */}
                            {tab === 'system' && overviewData && (
                                <>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
                                        <StatCard icon={Server} color={COLORS.success} bg={COLORS.successLight} label="Server Status" value="Online" />
                                        <StatCard icon={Clock} color={COLORS.info} bg={COLORS.infoLight} label="Uptime" value={overviewData.server?.uptimeFormatted || '—'} />
                                        <StatCard icon={Cpu} color={COLORS.purple} bg={COLORS.purpleLight} label="CPU Cores" value={String(overviewData.server?.cpus || 0)} />
                                        <StatCard icon={HardDrive} color={COLORS.warning} bg={COLORS.warningLight} label="RAM" value={`${overviewData.server?.totalRAM || 0} GB`} />
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
                                        <PanelCard title="Server Information" subtitle={`${overviewData.server?.hostname || ''} — ${overviewData.server?.platform || ''}`}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                                {[
                                                    { label: 'Node.js Version', value: overviewData.server?.nodeVersion || '—' },
                                                    { label: 'Platform', value: overviewData.server?.platform || '—' },
                                                    { label: 'Hostname', value: overviewData.server?.hostname || '—' },
                                                    { label: 'Heap Memory', value: `${overviewData.server?.memoryUsed || 0} MB / ${overviewData.server?.memoryTotal || 0} MB` },
                                                    { label: 'System RAM', value: `${(overviewData.server?.totalRAM || 0) - (overviewData.server?.freeRAM || 0)} GB / ${overviewData.server?.totalRAM || 0} GB used` },
                                                    { label: 'Database', value: overviewData.database?.name || 'MySQL (Prisma)' },
                                                    { label: 'AI Model', value: overviewData.ai?.model || '—' },
                                                    { label: 'AI API URL', value: overviewData.ai?.apiUrl || '—' },
                                                ].map((item, idx) => (
                                                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#f8fafc', borderRadius: 8 }}>
                                                        <span style={{ fontSize: 12, color: '#64748b' }}>{item.label}</span>
                                                        <span style={{ fontSize: 12, fontWeight: 600, color: '#1e293b', fontFamily: "'JetBrains Mono', monospace" }}>{item.value}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </PanelCard>
                                        <PanelCard title="Database Collections" subtitle="Số lượng records trong từng bảng">
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                                {[
                                                    { label: 'Users', value: overviewData.collections?.users || 0, icon: Users },
                                                    { label: 'Workspaces', value: overviewData.collections?.workspaces || 0, icon: Layers },
                                                    { label: 'Conversations', value: overviewData.collections?.conversations || 0, icon: MessageSquare },
                                                    { label: 'Messages', value: overviewData.collections?.messages || 0, icon: FileText },
                                                    { label: 'Visitors', value: overviewData.collections?.visitors || 0, icon: Eye },
                                                    { label: 'Widgets', value: overviewData.collections?.widgets || 0, icon: Globe },
                                                    { label: 'AI Bots', value: overviewData.collections?.aiBots || 0, icon: Bot },
                                                    { label: 'Leads', value: overviewData.collections?.leads || 0, icon: Target },
                                                    { label: 'Campaigns', value: overviewData.collections?.campaigns || 0, icon: Zap },
                                                    { label: 'Knowledge', value: overviewData.collections?.knowledge || 0, icon: Database },
                                                    { label: 'Macros', value: overviewData.collections?.macros || 0, icon: Copy },
                                                    { label: 'Labels', value: overviewData.collections?.labels || 0, icon: Tag },
                                                ].map((item, idx) => {
                                                    const Ic = item.icon;
                                                    return (
                                                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#f8fafc', borderRadius: 8 }}>
                                                            <Ic size={14} color="#64748b" />
                                                            <span style={{ fontSize: 12, color: '#64748b', flex: 1 }}>{item.label}</span>
                                                            <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{fmtNum(item.value)}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </PanelCard>
                                    </div>
                                    <PanelCard title="Hoạt động hôm nay" subtitle={`Cập nhật lúc ${new Date().toLocaleTimeString('vi-VN')}`}>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                                            {[
                                                { label: 'Tin nhắn hôm nay', value: overviewData.recentActivity?.messagesToday || 0, color: COLORS.primary, icon: MessageSquare },
                                                { label: 'Hội thoại hôm nay', value: overviewData.recentActivity?.conversationsToday || 0, color: COLORS.success, icon: FileText },
                                                { label: 'Khách mới hôm nay', value: overviewData.recentActivity?.visitorsToday || 0, color: COLORS.info, icon: UserCheck },
                                            ].map((item, idx) => {
                                                const Ic = item.icon;
                                                return (
                                                    <div key={idx} style={{ textAlign: 'center', padding: '20px', background: '#f8fafc', borderRadius: 12 }}>
                                                        <Ic size={24} color={item.color} style={{ marginBottom: 8 }} />
                                                        <div style={{ fontSize: 28, fontWeight: 800, color: item.color }}>{fmtNum(item.value)}</div>
                                                        <div style={{ fontSize: 12, color: '#94a3b8' }}>{item.label}</div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </PanelCard>
                                </>
                            )}

                            {/* ═══ Settings Tab ═══ */}
                            {tab === 'settings' && <SettingsTab />}

                            {/* ═══ Cron Link Tab ═══ */}
                            {tab === 'cron' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                    <PanelCard title="Cron Link quản lý" subtitle="Các link cron tự động kiểm tra thanh toán, đồng bộ dữ liệu">
                                        {[
                                            {
                                                name: 'Auto Bank Check',
                                                desc: 'Tự động kiểm tra giao dịch ngân hàng và xác nhận thanh toán hóa đơn',
                                                url: `${typeof window !== 'undefined' ? window.location.origin : ''}/api/bank/transactions`,
                                                interval: 'Mỗi 5 phút',
                                                active: true,
                                            },
                                            {
                                                name: 'Health Check',
                                                desc: 'Kiểm tra trạng thái hoạt động của hệ thống',
                                                url: `${typeof window !== 'undefined' ? window.location.origin : ''}/api/health`,
                                                interval: 'Mỗi 1 phút',
                                                active: true,
                                            },
                                            {
                                                name: 'Session Watchdog',
                                                desc: 'Giám sát và tự động khôi phục Zalo sessions',
                                                url: `${typeof window !== 'undefined' ? window.location.origin : ''}/api/admin/zalo-health`,
                                                interval: 'Mỗi 10 phút',
                                                active: true,
                                            },
                                            {
                                                name: 'SLA Monitor',
                                                desc: 'Kiểm tra SLA vi phạm và gửi cảnh báo',
                                                url: `${typeof window !== 'undefined' ? window.location.origin : ''}/api/admin/sla-check`,
                                                interval: 'Mỗi 5 phút',
                                                active: false,
                                            },
                                        ].map((cron, idx) => (
                                            <div key={idx} style={{
                                                display: 'flex', alignItems: 'center', gap: 16,
                                                padding: '16px 20px', background: '#f8fafc', borderRadius: 14,
                                                border: '1px solid #e2e8f0', marginBottom: 10,
                                                transition: 'all 0.15s',
                                            }}>
                                                <div style={{
                                                    width: 42, height: 42, borderRadius: 12,
                                                    background: cron.active ? COLORS.successLight : '#f1f5f9',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    flexShrink: 0,
                                                }}>
                                                    {cron.active ? <Play size={18} color={COLORS.success} /> : <Pause size={18} color="#94a3b8" />}
                                                </div>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                                        <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{cron.name}</span>
                                                        <Tag color={cron.active ? 'green' : 'default'} style={{ fontSize: 10, borderRadius: 10 }}>
                                                            {cron.active ? 'Active' : 'Inactive'}
                                                        </Tag>
                                                        <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 'auto' }}>
                                                            <Timer size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                                                            {cron.interval}
                                                        </span>
                                                    </div>
                                                    <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>{cron.desc}</div>
                                                    <div style={{
                                                        display: 'flex', alignItems: 'center', gap: 8,
                                                        background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8,
                                                        padding: '6px 12px', fontSize: 12, fontFamily: "'JetBrains Mono', monospace",
                                                        color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                                    }}>
                                                        <Link2 size={12} color="#94a3b8" style={{ flexShrink: 0 }} />
                                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{cron.url}</span>
                                                        <button
                                                            onClick={() => { navigator.clipboard.writeText(cron.url); message.success('Đã sao chép link!'); }}
                                                            style={{
                                                                marginLeft: 'auto', background: COLORS.primaryLight, border: 'none',
                                                                borderRadius: 6, padding: '4px 10px', cursor: 'pointer',
                                                                display: 'flex', alignItems: 'center', gap: 4,
                                                                fontSize: 11, fontWeight: 600, color: COLORS.primary, flexShrink: 0,
                                                            }}
                                                        >
                                                            <Copy size={11} /> Copy
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </PanelCard>

                                    <PanelCard title="Hướng dẫn sử dụng Cron" subtitle="Cài đặt cron job tại các dịch vụ bên ngoài">
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                            {[
                                                ['cron-job.org', 'Dịch vụ miễn phí, hỗ trợ tới mỗi 1 phút', 'https://cron-job.org'],
                                                ['UptimeRobot', 'Miễn phí 50 monitors, mỗi 5 phút', 'https://uptimerobot.com'],
                                                ['EasyCron', 'Miễn phí 1 job, giao diện đơn giản', 'https://easycron.com'],
                                            ].map(([name, desc, url]) => (
                                                <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                                                    <div>
                                                        <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{name}</div>
                                                        <div style={{ fontSize: 11, color: '#94a3b8' }}>{desc}</div>
                                                    </div>
                                                    <a href={url as string} target="_blank" rel="noopener noreferrer" style={{
                                                        display: 'flex', alignItems: 'center', gap: 4,
                                                        fontSize: 12, fontWeight: 600, color: COLORS.primary,
                                                        textDecoration: 'none',
                                                    }}>
                                                        Truy cập <ExternalLink size={12} />
                                                    </a>
                                                </div>
                                            ))}
                                        </div>
                                    </PanelCard>
                                </div>
                            )}
                        </>
                    )}
                </main>
            </div>
        </>
    );
}

/* ─── Sub Components ─── */
const StatCard = ({ icon: Icon, color, bg, label, value }: { icon: LucideIcon; color: string; bg: string; label: string; value: string }) => (
    <div style={{ padding: '20px', background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon size={20} color={color} />
        </div>
        <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, color: '#94a3b8', marginBottom: 2 }}>{label}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
        </div>
    </div>
);

const PanelCard = ({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) => (
    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: '24px', marginBottom: 20 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 4px', color: '#0f172a' }}>{title}</h3>
        {subtitle && <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 20px' }}>{subtitle}</p>}
        {children}
    </div>
);

/* ─── Auto Bank Tab Component ─── */
type BankConfigTab = 'monitor' | 'mbbank' | 'acb' | 'general';

const AutoBankTab = ({ bankData, bankFilter, setBankFilter, fetchDashboard }: {
    bankData: any;
    bankFilter: string;
    setBankFilter: (v: string) => void;
    fetchDashboard: () => void;
}) => {
    const [autoRefresh, setAutoRefresh] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [configTab, setConfigTab] = useState<BankConfigTab>('monitor');

    // Auto refresh every 15s
    useEffect(() => {
        if (!autoRefresh) return;
        const interval = setInterval(() => { fetchDashboard(); }, 15000);
        return () => clearInterval(interval);
    }, [autoRefresh, fetchDashboard]);

    const handleRefresh = async () => {
        setRefreshing(true);
        await fetchDashboard();
        setRefreshing(false);
    };

    const configTabs: { key: BankConfigTab; label: string; icon: string }[] = [
        { key: 'monitor', label: 'GIÁM SÁT', icon: '📊' },
        { key: 'mbbank', label: 'MBBANK AUTO', icon: '🏦' },
        { key: 'acb', label: 'ACB AUTO', icon: '🏧' },
        { key: 'general', label: 'CÀI ĐẶT CHUNG', icon: '⚙️' },
    ];

    const transactions = bankData?.transactions || [];
    const filtered = transactions.filter((tx: any) => {
        if (!bankFilter) return true;
        const q = bankFilter.toLowerCase();
        return (tx.description || '').toLowerCase().includes(q) ||
            (tx.addDescription || '').toLowerCase().includes(q) ||
            (tx.refNo || '').toLowerCase().includes(q) ||
            String(tx.creditAmount).includes(q) ||
            String(tx.debitAmount).includes(q);
    });

    const totalCredit = transactions.reduce((s: number, t: any) => s + (t.creditAmount || 0), 0);
    const totalDebit = transactions.reduce((s: number, t: any) => s + (t.debitAmount || 0), 0);
    const creditCount = transactions.filter((t: any) => t.type === 'credit').length;
    const debitCount = transactions.filter((t: any) => t.type === 'debit').length;

    const formatDate = (d: string) => {
        if (!d) return '';
        const parts = d.split(' ');
        const dateParts = parts[0]?.split('/');
        if (dateParts?.length === 3) return `${dateParts[0]}/${dateParts[1]}/${dateParts[2]} ${parts[1] || ''}`.trim();
        return d;
    };

    const ConfigField = ({ label, value, mono }: { label: string; value: string; mono?: boolean }) => (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>{label}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', fontFamily: mono ? "'JetBrains Mono', monospace" : 'inherit' }}>{value}</span>
        </div>
    );

    return (
        <>
            <style>{`
                .bank-config-tabs { display: flex; gap: 0; background: #f1f5f9; border-radius: 12px; padding: 4px; margin-bottom: 24px; }
                .bank-config-tab {
                    flex: 1; padding: 10px 16px; border: none; cursor: pointer; font-size: 12px; font-weight: 600;
                    background: transparent; color: #64748b; border-radius: 9px; transition: all 0.2s;
                    display: flex; align-items: center; justify-content: center; gap: 6px;
                    text-transform: uppercase; letter-spacing: 0.5px;
                }
                .bank-config-tab.active { background: #fff; color: #0f172a; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
                .bank-config-tab:hover:not(.active) { background: rgba(255,255,255,0.5); color: #475569; }
                .bank-account-card-admin {
                    background: linear-gradient(135deg, #1e3a5f 0%, #0c4a6e 40%, #0369a1 100%);
                    border-radius: 16px; padding: 28px; color: #fff; position: relative; overflow: hidden; min-height: 180px;
                }
                .bank-account-card-admin::before {
                    content: ''; position: absolute; top: -40px; right: -40px; width: 200px; height: 200px;
                    background: rgba(255,255,255,0.04); border-radius: 50%;
                }
                .bank-account-card-admin::after {
                    content: ''; position: absolute; bottom: -60px; left: -20px; width: 180px; height: 180px;
                    background: rgba(255,255,255,0.03); border-radius: 50%;
                }
                .pulse-dot-admin {
                    width: 8px; height: 8px; border-radius: 50%; background: #10b981; display: inline-block;
                    margin-right: 6px; animation: pulseAdmin 2s infinite;
                }
                @keyframes pulseAdmin {
                    0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); }
                    70% { box-shadow: 0 0 0 8px rgba(16, 185, 129, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
                }
                .stat-mini { padding: 16px 20px; background: #fff; border-radius: 12px; border: 1px solid #e2e8f0; }
                .stat-mini-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #94a3b8; font-weight: 600; margin-bottom: 6px; }
                .stat-mini-value { font-size: 22px; font-weight: 800; }
                .stat-mini-sub { font-size: 11px; color: #94a3b8; margin-top: 4px; }
            `}</style>

            {/* Config Tabs */}
            <div className="bank-config-tabs">
                {configTabs.map(t => (
                    <button
                        key={t.key}
                        className={`bank-config-tab ${configTab === t.key ? 'active' : ''}`}
                        onClick={() => setConfigTab(t.key)}
                    >
                        <span>{t.icon}</span> {t.label}
                    </button>
                ))}
            </div>

            {/* ── Monitor Tab ── */}
            {configTab === 'monitor' && (
                <>
                    {/* Account Card + Stats */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16, marginBottom: 24 }}>
                        <div className="bank-account-card-admin" style={{ gridColumn: 'span 2' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, position: 'relative', zIndex: 1 }}>
                                <div>
                                    <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.5, opacity: 0.6, marginBottom: 4 }}>MB BANK</div>
                                    <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: 2 }}>
                                        {bankData?.account?.number || '•••••••••'}
                                    </div>
                                </div>
                                <img src="https://upload.wikimedia.org/wikipedia/commons/2/25/Logo_MB_new.png" alt="MB" style={{ height: 36, filter: 'brightness(10)', opacity: 0.8 }} />
                            </div>
                            <div style={{ position: 'relative', zIndex: 1 }}>
                                <div style={{ fontSize: 12, opacity: 0.5, marginBottom: 2 }}>Chủ tài khoản</div>
                                <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: 0.5 }}>
                                    {bankData?.account?.holder || 'Đang tải...'}
                                    <Tooltip title="Copy STK">
                                        <CopyOutlined
                                            style={{ marginLeft: 12, cursor: 'pointer', opacity: 0.5, fontSize: 14 }}
                                            onClick={() => { navigator.clipboard.writeText(bankData?.account?.number || ''); message.success('Đã copy STK'); }}
                                        />
                                    </Tooltip>
                                </div>
                            </div>
                            <div style={{ position: 'relative', zIndex: 1, marginTop: 20 }}>
                                <div style={{ fontSize: 12, opacity: 0.5, marginBottom: 2 }}>Số dư khả dụng</div>
                                <div style={{ fontSize: 28, fontWeight: 800 }}>
                                    {bankData ? fmtVND(bankData.balance) : '---'}
                                </div>
                            </div>
                        </div>

                        <div className="stat-mini">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <div className="pulse-dot-admin" />
                                <div className="stat-mini-label">Tổng tiền vào</div>
                            </div>
                            <div className="stat-mini-value" style={{ color: COLORS.success }}>{fmtVND(totalCredit)}</div>
                            <div className="stat-mini-sub">{creditCount} giao dịch</div>
                        </div>

                        <div className="stat-mini">
                            <div className="stat-mini-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <div style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS.danger }} />
                                Tổng tiền ra
                            </div>
                            <div className="stat-mini-value" style={{ color: COLORS.danger }}>{fmtVND(totalDebit)}</div>
                            <div className="stat-mini-sub">{debitCount} giao dịch</div>
                        </div>
                    </div>

                    {/* Transaction Table */}
                    <PanelCard title="Lịch sử giao dịch" subtitle={`Tổng cộng ${transactions.length} giao dịch`}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <Input
                                    prefix={<SearchOutlined />}
                                    placeholder="Tìm giao dịch..."
                                    value={bankFilter}
                                    onChange={e => setBankFilter(e.target.value)}
                                    style={{ width: 300, borderRadius: 10 }}
                                    allowClear
                                />
                                <Tag color={filtered.length > 0 ? 'blue' : 'default'}>{filtered.length} giao dịch</Tag>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <button
                                    onClick={() => setAutoRefresh(!autoRefresh)}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 6,
                                        padding: '7px 14px', borderRadius: 8, border: '1px solid #e2e8f0',
                                        background: autoRefresh ? COLORS.success : '#fff', color: autoRefresh ? '#fff' : '#475569',
                                        fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                                    }}
                                >
                                    {autoRefresh && <span className="pulse-dot-admin" style={{ marginRight: 0 }} />}
                                    {autoRefresh ? 'Auto (15s)' : 'Auto Refresh'}
                                </button>
                                <button
                                    onClick={handleRefresh}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 6,
                                        padding: '7px 14px', borderRadius: 8, border: '1px solid #e2e8f0',
                                        background: '#fff', color: '#475569', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                                    }}
                                >
                                    <ReloadOutlined spin={refreshing} /> Làm mới
                                </button>
                            </div>
                        </div>
                        <Table
                            dataSource={filtered}
                            rowKey="id"
                            size="small"
                            pagination={{ pageSize: 20, showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100'] }}
                            columns={[
                                {
                                    title: '', dataIndex: 'type', key: 'type', width: 40,
                                    render: (t: string) => t === 'credit'
                                        ? <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #10b981, #059669)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ArrowDownLeft size={16} color="#fff" /></div>
                                        : <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #ef4444, #dc2626)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ArrowUpRight size={16} color="#fff" /></div>
                                },
                                {
                                    title: 'Nội dung', dataIndex: 'description', key: 'description',
                                    render: (desc: string, record: any) => (
                                        <div>
                                            <div style={{ fontWeight: 500, fontSize: 13, lineHeight: 1.4, maxWidth: 500, wordBreak: 'break-word' as const }}>{desc}</div>
                                            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>Mã GD: {record.refNo}</div>
                                        </div>
                                    )
                                },
                                {
                                    title: 'Thời gian', dataIndex: 'transactionDate', key: 'transactionDate', width: 160,
                                    render: (d: string) => <span style={{ fontSize: 12, color: '#64748b' }}>{formatDate(d)}</span>
                                },
                                {
                                    title: 'Số tiền', key: 'amount', width: 150, align: 'right' as const,
                                    render: (_: any, record: any) => {
                                        if (record.creditAmount > 0) return <span style={{ color: '#10b981', fontWeight: 700, fontSize: 14 }}>+{fmtVND(record.creditAmount)}</span>;
                                        return <span style={{ color: '#ef4444', fontWeight: 700, fontSize: 14 }}>-{fmtVND(record.debitAmount)}</span>;
                                    }
                                },
                                {
                                    title: 'Số dư', dataIndex: 'availableBalance', key: 'availableBalance', width: 140, align: 'right' as const,
                                    render: (b: number) => <span style={{ fontSize: 13, color: '#64748b' }}>{fmtVND(b)}</span>
                                },
                            ]}
                        />
                    </PanelCard>
                </>
            )}

            {/* ── MB Bank Auto Config ── */}
            {configTab === 'mbbank' && (
                <PanelCard title="Cấu hình MB Bank Auto" subtitle="Theo dõi giao dịch MB Bank qua API tự động">
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <ConfigField label="Ngân hàng" value={bankData?.account?.bank || 'MB Bank'} />
                        <ConfigField label="Số tài khoản" value={bankData?.account?.number || '070028386'} mono />
                        <ConfigField label="Chủ tài khoản" value={bankData?.account?.holder || 'PHAM TRONG DUONG'} />
                        <ConfigField label="API Provider" value="api.sieuthicode.net" mono />
                        <ConfigField label="Trạng thái" value="🟢 Đang hoạt động" />
                        <ConfigField label="Tần suất kiểm tra" value="Mỗi 5 phút" />
                        <ConfigField label="Số dư hiện tại" value={bankData ? fmtVND(bankData.balance) : '---'} />
                        <ConfigField label="Tổng giao dịch" value={`${transactions.length} giao dịch`} />
                    </div>
                    <div style={{ marginTop: 20, padding: '16px 20px', background: 'linear-gradient(135deg, #eff6ff, #dbeafe)', borderRadius: 12, border: '1px solid #bfdbfe' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <Landmark size={16} color="#2563eb" />
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#1e40af' }}>API Endpoint</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', padding: '10px 14px', borderRadius: 8, border: '1px solid #dbeafe', fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: '#475569' }}>
                            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>https://api.sieuthicode.net/historyapimbbank/***</span>
                            <button
                                onClick={() => { message.success('API key được bảo mật'); }}
                                style={{ background: COLORS.primaryLight, border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: COLORS.primary, flexShrink: 0 }}
                            >
                                <Shield size={11} /> Bảo mật
                            </button>
                        </div>
                    </div>
                </PanelCard>
            )}

            {/* ── ACB Auto Config ── */}
            {configTab === 'acb' && (
                <PanelCard title="Cấu hình ACB Auto" subtitle="Ngân hàng nhận thanh toán NemarkChat — Doanh thu hệ thống">
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <ConfigField label="Ngân hàng" value="ACB - Ngân hàng Á Châu" />
                        <ConfigField label="Số tài khoản" value="Đã cấu hình qua .env" mono />
                        <ConfigField label="Chủ tài khoản" value="Đã cấu hình qua .env" />
                        <ConfigField label="Mục đích" value="Nhận thanh toán hóa đơn" />
                        <ConfigField label="Trạng thái" value="🟢 Đang hoạt động" />
                        <ConfigField label="Tự động xác nhận" value="Bật" />
                    </div>
                    <div style={{ marginTop: 20, padding: '16px 20px', background: 'linear-gradient(135deg, #fef3c7, #fde68a)', borderRadius: 12, border: '1px solid #fcd34d' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <Shield size={16} color="#92400e" />
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#92400e' }}>Lưu ý bảo mật</span>
                        </div>
                        <p style={{ fontSize: 12, color: '#78350f', margin: 0, lineHeight: 1.6 }}>
                            Thông tin tài khoản ACB được quản lý qua biến môi trường (.env). Để thay đổi, hãy cập nhật <code style={{ background: 'rgba(255,255,255,0.6)', padding: '2px 6px', borderRadius: 4, fontSize: 11 }}>ACB_ACCOUNT_NUMBER</code> và <code style={{ background: 'rgba(255,255,255,0.6)', padding: '2px 6px', borderRadius: 4, fontSize: 11 }}>ACB_ACCOUNT_NAME</code> trong file .env và khởi động lại server.
                        </p>
                    </div>
                </PanelCard>
            )}

            {/* ── General Settings ── */}
            {configTab === 'general' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                    <PanelCard title="Cài đặt Auto Bank" subtitle="Cấu hình chung cho hệ thống theo dõi ngân hàng">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <ConfigField label="Auto Refresh" value="Mỗi 15 giây (khi bật)" />
                            <ConfigField label="Cron Job Interval" value="Mỗi 5 phút" />
                            <ConfigField label="Tự động xác nhận thanh toán" value="Bật" />
                            <ConfigField label="Lưu lịch sử giao dịch" value="Bật" />
                            <ConfigField label="Cảnh báo giao dịch lớn" value="Trên 5.000.000₫" />
                            <ConfigField label="Múi giờ" value="Asia/Ho_Chi_Minh (UTC+7)" />
                        </div>
                    </PanelCard>
                    <PanelCard title="Thống kê nạp tiền" subtitle="Tổng hợp giao dịch theo tháng">
                        <Table
                            dataSource={(() => {
                                const monthMap: Record<string, { month: string; year: number; total: number; count: number }> = {};
                                transactions.filter((t: any) => t.type === 'credit').forEach((t: any) => {
                                    const d = t.transactionDate || '';
                                    const parts = d.split(' ')[0]?.split('/') || [];
                                    if (parts.length === 3) {
                                        const key = `${parts[1]}/${parts[2]}`;
                                        if (!monthMap[key]) monthMap[key] = { month: `Tháng ${parseInt(parts[1])}`, year: parseInt(parts[2]), total: 0, count: 0 };
                                        monthMap[key].total += t.creditAmount || 0;
                                        monthMap[key].count++;
                                    }
                                });
                                return Object.values(monthMap).sort((a, b) => b.year - a.year || parseInt(b.month.replace('Tháng ', '')) - parseInt(a.month.replace('Tháng ', '')));
                            })()}
                            rowKey={(r) => `${r.month}-${r.year}`}
                            size="small"
                            pagination={false}
                            columns={[
                                { title: 'Tháng', dataIndex: 'month', render: (m: string) => <Tag color="blue">{m}</Tag> },
                                { title: 'Năm', dataIndex: 'year' },
                                { title: 'Tổng tiền', dataIndex: 'total', render: (t: number) => <span style={{ color: COLORS.success, fontWeight: 700 }}>{fmtVND(t)}</span> },
                                { title: 'Số GD', dataIndex: 'count' },
                                { title: 'Trung bình', key: 'avg', render: (_: any, r: any) => <span style={{ color: '#64748b' }}>{fmtVND(r.count > 0 ? Math.round(r.total / r.count) : 0)}</span> },
                            ]}
                        />
                    </PanelCard>
                </div>
            )}
        </>
    );
};

/* ─── Settings Tab Component ─── */
type SettingsSubTab = 'general' | 'recaptcha' | 'google_oauth';

const SettingsTab = () => {
    const [subTab, setSubTab] = useState<SettingsSubTab>('general');
    const [settings, setSettings] = useState<Record<string, string>>({});
    const [loadingSettings, setLoadingSettings] = useState(true);
    const [saving, setSaving] = useState(false);

    // Form states for reCAPTCHA
    const [recaptchaEnabled, setRecaptchaEnabled] = useState(false);
    const [recaptchaSiteKey, setRecaptchaSiteKey] = useState('');
    const [recaptchaSecretKey, setRecaptchaSecretKey] = useState('');

    // Form states for Google OAuth
    const [googleEnabled, setGoogleEnabled] = useState(true);
    const [googleClientId, setGoogleClientId] = useState('');
    const [googleClientSecret, setGoogleClientSecret] = useState('');
    const [googleCallbackUrl, setGoogleCallbackUrl] = useState('');

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        setLoadingSettings(true);
        try {
            const res = await httpClient.get('/admin/settings');
            if (res.data?.success) {
                const s = res.data.data;
                setSettings(s);
                setRecaptchaEnabled(s.recaptcha_enabled === 'true');
                setRecaptchaSiteKey(s.recaptcha_site_key || '');
                setRecaptchaSecretKey(s.recaptcha_secret_key || '');
                setGoogleEnabled((s.google_auth_enabled ?? 'true') === 'true');
                setGoogleClientId(s.google_client_id || '');
                setGoogleClientSecret(s.google_client_secret || '');
                setGoogleCallbackUrl(s.google_callback_url || '');
            }
        } catch { /* silent */ }
        setLoadingSettings(false);
    };

    const saveRecaptcha = async () => {
        setSaving(true);
        try {
            await httpClient.put('/admin/settings', {
                recaptcha_enabled: recaptchaEnabled ? 'true' : 'false',
                recaptcha_site_key: recaptchaSiteKey,
                recaptcha_secret_key: recaptchaSecretKey,
            });
            message.success('Đã lưu cấu hình reCAPTCHA!');
        } catch { message.error('Lỗi lưu cài đặt'); }
        setSaving(false);
    };

    const saveGoogleOAuth = async () => {
        setSaving(true);
        try {
            await httpClient.put('/admin/settings', {
                google_auth_enabled: googleEnabled ? 'true' : 'false',
                google_client_id: googleClientId,
                google_client_secret: googleClientSecret,
                google_callback_url: googleCallbackUrl,
            });
            message.success('Đã lưu cấu hình Google OAuth!');
        } catch { message.error('Lỗi lưu cài đặt'); }
        setSaving(false);
    };

    const settingsTabs: { key: SettingsSubTab; label: string; icon: string }[] = [
        { key: 'general', label: 'THÔNG TIN CHUNG', icon: '⚙️' },
        { key: 'recaptcha', label: 'RECAPTCHA', icon: '🛡️' },
        { key: 'google_oauth', label: 'GOOGLE OAUTH', icon: '🔑' },
    ];

    if (loadingSettings) {
        return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spin size="large" /></div>;
    }

    return (
        <>
            <style>{`
                .settings-tabs { display: flex; gap: 0; background: #f1f5f9; border-radius: 12px; padding: 4px; margin-bottom: 24px; }
                .settings-tab {
                    flex: 1; padding: 10px 16px; border: none; cursor: pointer; font-size: 12px; font-weight: 600;
                    background: transparent; color: #64748b; border-radius: 9px; transition: all 0.2s;
                    display: flex; align-items: center; justify-content: center; gap: 6px;
                    text-transform: uppercase; letter-spacing: 0.5px;
                }
                .settings-tab.active { background: #fff; color: #0f172a; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
                .settings-tab:hover:not(.active) { background: rgba(255,255,255,0.5); color: #475569; }
                .settings-field {
                    margin-bottom: 20px;
                }
                .settings-field label {
                    display: block; font-size: 13px; font-weight: 700; color: #1e293b; margin-bottom: 8px;
                }
                .settings-field .hint {
                    font-size: 11px; color: #94a3b8; font-weight: 400; font-style: italic; margin-top: 4px;
                }
            `}</style>

            <div className="settings-tabs">
                {settingsTabs.map(t => (
                    <button
                        key={t.key}
                        className={`settings-tab ${subTab === t.key ? 'active' : ''}`}
                        onClick={() => setSubTab(t.key)}
                    >
                        <span>{t.icon}</span> {t.label}
                    </button>
                ))}
            </div>

            {/* ── General ── */}
            {subTab === 'general' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20 }}>
                    <PanelCard title="Thông tin hệ thống" subtitle="Cấu hình chung">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {[
                                ['Tên hệ thống', 'NemarkChat'],
                                ['Phiên bản', 'v2.0.0'],
                                ['Ngôn ngữ', 'Tiếng Việt'],
                                ['Múi giờ', 'Asia/Ho_Chi_Minh (UTC+7)'],
                                ['Hotline', '0964 543 556'],
                                ['Email hỗ trợ', 'support@nemark.chat'],
                            ].map(([k, v]) => (
                                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#f8fafc', borderRadius: 8, fontSize: 13 }}>
                                    <span style={{ color: '#64748b' }}>{k}</span>
                                    <span style={{ fontWeight: 600, color: '#1e293b' }}>{v}</span>
                                </div>
                            ))}
                        </div>
                    </PanelCard>
                    <PanelCard title="Trạng thái dịch vụ" subtitle="Tổng quan các tính năng">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {[
                                { label: 'Google OAuth', enabled: googleEnabled, color: '#4285f4' },
                                { label: 'reCAPTCHA', enabled: recaptchaEnabled, color: '#4caf50' },
                                { label: 'Auto Bank (MB)', enabled: true, color: '#1976d2' },
                                { label: 'ACB Revenue', enabled: true, color: '#ff9800' },
                                { label: 'Zalo Integration', enabled: true, color: '#0068ff' },
                                { label: 'Facebook Integration', enabled: true, color: '#1877f2' },
                            ].map((item, idx) => (
                                <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#f8fafc', borderRadius: 8, fontSize: 13 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.enabled ? '#10b981' : '#ef4444' }} />
                                        <span style={{ color: '#1e293b', fontWeight: 500 }}>{item.label}</span>
                                    </div>
                                    <Tag color={item.enabled ? 'green' : 'red'} style={{ margin: 0, fontSize: 11 }}>
                                        {item.enabled ? 'Đang bật' : 'Đang tắt'}
                                    </Tag>
                                </div>
                            ))}
                        </div>
                    </PanelCard>
                </div>
            )}

            {/* ── reCAPTCHA ── */}
            {subTab === 'recaptcha' && (
                <PanelCard title="Cấu hình reCAPTCHA" subtitle="Bảo vệ trang đăng nhập và đăng ký khỏi bot tự động">
                    {/* Status Toggle */}
                    <div className="settings-field">
                        <label>Trạng thái</label>
                        <Select
                            value={recaptchaEnabled ? 'ON' : 'OFF'}
                            onChange={(v: string) => setRecaptchaEnabled(v === 'ON')}
                            style={{ width: '100%' }}
                            options={[
                                { value: 'OFF', label: '🔴 OFF — Tắt reCAPTCHA (mặc định khi dev)' },
                                { value: 'ON', label: '🟢 ON — Bật reCAPTCHA (production)' },
                            ]}
                        />
                        {!recaptchaEnabled && (
                            <p className="hint" style={{ color: '#f59e0b' }}>
                                ⚠️ Vui lòng cấu hình thông tin phía dưới trước khi kích hoạt ON reCAPTCHA.
                            </p>
                        )}
                    </div>

                    {/* Site Key */}
                    <div className="settings-field">
                        <label>reCAPTCHA Site Key</label>
                        <Input
                            value={recaptchaSiteKey}
                            onChange={e => setRecaptchaSiteKey(e.target.value)}
                            placeholder="6Lcng-EsAAAAA..."
                            style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }}
                        />
                        <p className="hint">
                            Sử dụng Site Key trong HTML code phía client. Lấy từ{' '}
                            <a href="https://www.google.com/recaptcha/admin" target="_blank" rel="noopener noreferrer" style={{ color: '#6366f1' }}>
                                Google reCAPTCHA Admin Console
                            </a>
                        </p>
                    </div>

                    {/* Secret Key */}
                    <div className="settings-field">
                        <label>reCAPTCHA Secret Key</label>
                        <Input.Password
                            value={recaptchaSecretKey}
                            onChange={e => setRecaptchaSecretKey(e.target.value)}
                            placeholder="6Lcng-EsAAAAA..."
                            style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }}
                        />
                        <p className="hint">
                            Sử dụng Secret Key để xác thực ở phía server. Không chia sẻ key này cho bất kỳ ai.
                        </p>
                    </div>

                    {/* Domain info */}
                    <div style={{ padding: '14px 18px', background: '#eef2ff', borderRadius: 10, border: '1px solid #c7d2fe', marginBottom: 20 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            <Shield size={15} color="#4f46e5" />
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#3730a3' }}>Domain đã đăng ký</span>
                        </div>
                        <p style={{ fontSize: 12, color: '#4338ca', margin: 0, lineHeight: 1.6 }}>
                            <strong>nemark.vn</strong> — Đã được đăng ký với Google reCAPTCHA.
                            Khi dev local, hãy để trạng thái <strong>OFF</strong>. Khi deploy production trên <code style={{ background: 'rgba(99,102,241,0.1)', padding: '2px 6px', borderRadius: 4 }}>nemark.vn</code>, chuyển sang <strong>ON</strong>.
                        </p>
                    </div>

                    {/* Save Button */}
                    <button
                        onClick={saveRecaptcha}
                        disabled={saving}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '10px 28px', borderRadius: 10,
                            background: 'linear-gradient(135deg, #10b981, #059669)',
                            color: '#fff', fontWeight: 700, fontSize: 14,
                            border: 'none', cursor: 'pointer',
                            boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)',
                            transition: 'all 0.2s',
                        }}
                    >
                        {saving ? '⏳ Đang lưu...' : '💾 Lưu Ngay'}
                    </button>
                </PanelCard>
            )}

            {/* ── Google OAuth ── */}
            {subTab === 'google_oauth' && (
                <PanelCard title="Cấu hình Google OAuth" subtitle="Cho phép người dùng đăng nhập bằng tài khoản Google">
                    {/* Status Toggle */}
                    <div className="settings-field">
                        <label>Trạng thái</label>
                        <Select
                            value={googleEnabled ? 'ON' : 'OFF'}
                            onChange={(v: string) => setGoogleEnabled(v === 'ON')}
                            style={{ width: '100%' }}
                            options={[
                                { value: 'OFF', label: '🔴 OFF — Tắt đăng nhập Google' },
                                { value: 'ON', label: '🟢 ON — Bật đăng nhập Google' },
                            ]}
                        />
                    </div>

                    {/* Client ID */}
                    <div className="settings-field">
                        <label>Client ID</label>
                        <Input
                            value={googleClientId}
                            onChange={e => setGoogleClientId(e.target.value)}
                            placeholder="xxxx-xxxx.apps.googleusercontent.com"
                            style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}
                        />
                        <p className="hint">
                            Lấy từ{' '}
                            <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" style={{ color: '#6366f1' }}>
                                Google Cloud Console → APIs → Credentials
                            </a>
                        </p>
                    </div>

                    {/* Client Secret */}
                    <div className="settings-field">
                        <label>Client Secret</label>
                        <Input.Password
                            value={googleClientSecret}
                            onChange={e => setGoogleClientSecret(e.target.value)}
                            placeholder="GOCSPX-..."
                            style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}
                        />
                    </div>

                    {/* Callback URL */}
                    <div className="settings-field">
                        <label>Callback URL</label>
                        <Input
                            value={googleCallbackUrl}
                            onChange={e => setGoogleCallbackUrl(e.target.value)}
                            placeholder="http://localhost/api/google-auth"
                            style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}
                        />
                        <p className="hint">
                            URL callback phải khớp với cấu hình trong Google Cloud Console. 
                            Khi deploy production: <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>https://nemark.vn/api/google-auth</code>
                        </p>
                    </div>

                    {/* Info box */}
                    <div style={{ padding: '14px 18px', background: '#fff7ed', borderRadius: 10, border: '1px solid #fed7aa', marginBottom: 20 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            <AlertTriangle size={15} color="#ea580c" />
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#9a3412' }}>Lưu ý quan trọng</span>
                        </div>
                        <p style={{ fontSize: 12, color: '#9a3412', margin: 0, lineHeight: 1.6 }}>
                            Nếu để trống Client ID hoặc Client Secret ở đây, hệ thống sẽ sử dụng giá trị từ file <code style={{ background: 'rgba(234,88,12,0.1)', padding: '2px 6px', borderRadius: 4 }}>.env</code> làm fallback.
                            Chỉ cần điền ở đây khi muốn thay đổi mà không cần restart server.
                        </p>
                    </div>

                    {/* Save Button */}
                    <button
                        onClick={saveGoogleOAuth}
                        disabled={saving}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '10px 28px', borderRadius: 10,
                            background: 'linear-gradient(135deg, #10b981, #059669)',
                            color: '#fff', fontWeight: 700, fontSize: 14,
                            border: 'none', cursor: 'pointer',
                            boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)',
                            transition: 'all 0.2s',
                        }}
                    >
                        {saving ? '⏳ Đang lưu...' : '💾 Lưu Ngay'}
                    </button>
                </PanelCard>
            )}
        </>
    );
};
