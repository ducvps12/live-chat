import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { Badge, Input, Select, Spin, Switch, Table, Tag, Tooltip, message } from 'antd';
import {
    Activity,
    AlertTriangle,
    ArrowDownLeft,
    ArrowUpRight,
    Banknote,
    BarChart3,
    Bell,
    Bot,
    CheckCircle,
    Clock,
    Copy,
    Cpu,
    CreditCard,
    Database,
    DollarSign,
    ExternalLink,
    Eye,
    Globe,
    HardDrive,
    Landmark,
    Layers,
    Link2,
    KeyRound,
    Mail,
    MessageSquare,
    Monitor,
    Pause,
    Play,
    Receipt,
    RefreshCw,
    Search,
    Send,
    Server,
    Settings,
    Shield,
    Target,
    Timer,
    TrendingDown,
    TrendingUp,
    UserCheck,
    Users,
    UserX,
    Wallet,
    XCircle,
    Zap,
    type LucideIcon,
} from 'lucide-react';
import { httpClient } from '../../lib/http/client';
import { useGetMe } from '../../domains/auth/auth.hooks';

type PanelTab = 'dashboard' | 'revenue' | 'invoices' | 'users' | 'workspaces' | 'bank' | 'system' | 'traffic' | 'cron' | 'settings';
type Tone = 'blue' | 'teal' | 'amber' | 'rose' | 'slate' | 'violet';
type Severity = 'good' | 'watch' | 'danger' | 'info';

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

interface OverviewData {
    collections?: Record<string, number>;
    conversationStats?: { open?: number; closed?: number; pending?: number; total?: number };
    botStats?: { total?: number; active?: number };
    recentActivity?: { messagesToday?: number; conversationsToday?: number; visitorsToday?: number };
    server?: {
        uptimeFormatted?: string;
        memoryUsed?: number;
        memoryTotal?: number;
        platform?: string;
        hostname?: string;
        nodeVersion?: string;
        cpus?: number;
        totalRAM?: number;
        freeRAM?: number;
    };
    ai?: { apiUrl?: string; model?: string };
}

interface TrendPoint {
    date: string;
    messages?: number;
    conversations?: number;
    visitors?: number;
}

interface WorkspaceRow {
    id: string;
    name?: string;
    slug?: string;
    plan?: string;
    isActive?: boolean;
    createdAt?: string;
    memberCount?: number;
    conversationCount?: number;
    widgetCount?: number;
    visitorCount?: number;
}

interface SupportWidgetRow {
    id: string;
    name?: string;
    isActive?: boolean;
    domainRules?: unknown;
    config?: Record<string, unknown>;
}

interface DeepData {
    trends?: TrendPoint[];
    workspaces?: WorkspaceRow[];
    orders?: { total?: number; pending?: number; revenue?: number };
    leads?: { total?: number; new?: number };
    subscriptions?: { active?: number; invoices?: number; paidInvoices?: number };
    zalo?: { accounts?: number; contacts?: number; messages?: number };
    sessions?: { total?: number; active?: number };
}

interface WorkspaceMembership {
    id?: string;
    name?: string;
    slug?: string;
    plan?: string;
    role?: string;
}

interface UserRow {
    id: string;
    name?: string;
    email?: string;
    role?: string;
    isActive?: boolean;
    createdAt?: string;
    workspaceCount?: number;
    workspaces?: WorkspaceMembership[];
    lastLogin?: string | null;
    lastIP?: string | null;
    lastDevice?: string | null;
    orderCount?: number;
    macroCount?: number;
    campaignCount?: number;
    productCount?: number;
    totalRevenue?: number;
    totalInvoicePaid?: number;
}

interface BankTransaction {
    id?: string;
    refNo?: string;
    tranId?: string;
    postingDate?: string | number;
    transactionDate?: string;
    creditAmount?: number;
    debitAmount?: number;
    description?: string;
    addDescription?: string;
    availableBalance?: number;
    type?: string;
}

interface BankData {
    account?: { bank?: string; number?: string; holder?: string };
    balance?: number;
    totalCredit?: number;
    totalDebit?: number;
    transactionCount?: number;
    transactions?: BankTransaction[];
}

interface AcbTransaction {
    amount?: number;
    description?: string;
    postingDate?: string | number;
    senderName?: string;
}

interface AcbData {
    account?: { bank?: string; number?: string; holder?: string };
    totalRevenue?: number;
    monthlyRevenue?: number;
    transactionCount?: number;
    monthlyCount?: number;
    transactions?: AcbTransaction[];
}

interface PaymentConfig {
    bank?: string;
    bankName?: string;
    number?: string;
    holder?: string;
    apiUrl?: string;
    apiToken?: string;
}

interface TrafficData {
    cpu?: { model?: string; cores?: number; usagePercent?: number };
    memory?: { total?: number; free?: number; used?: number; usedPercent?: number };
    disk?: { total?: number; used?: number; usedPercent?: number };
    network?: { rxSec?: number; txSec?: number; connections?: number };
    uptimeFormatted?: string;
}

interface AlertItem {
    label: string;
    detail: string;
    severity: Severity;
    actionLabel?: string;
    actionTab?: PanelTab;
}

const fmtNum = (n?: number | null) => new Intl.NumberFormat('vi-VN').format(Number(n || 0));
const fmtVND = (n?: number | null) => `${new Intl.NumberFormat('vi-VN').format(Number(n || 0))} VND`;
const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const pct = (value?: number, total?: number) => (Number(total || 0) > 0 ? Math.round((Number(value || 0) / Number(total)) * 100) : 0);

const formatDateTime = (value?: string | number | null) => {
    if (!value) return 'Chưa có';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString('vi-VN');
};

const formatShortDate = (value?: string | number | null) => {
    if (!value) return 'Chưa có';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
};

const copyText = async (text?: string) => {
    if (!text) return;
    try {
        await navigator.clipboard.writeText(text);
        message.success('Đã sao chép');
    } catch {
        message.error('Không thể sao chép');
    }
};

const sideItems: { key: PanelTab; icon: LucideIcon; label: string; section?: string }[] = [
    { key: 'dashboard', icon: BarChart3, label: 'Dashboard', section: 'Tổng quan' },
    { key: 'revenue', icon: TrendingUp, label: 'Doanh thu' },
    { key: 'invoices', icon: Receipt, label: 'Hóa đơn' },
    { key: 'users', icon: Users, label: 'Users', section: 'Quản lý' },
    { key: 'workspaces', icon: Layers, label: 'Workspaces' },
    { key: 'bank', icon: Landmark, label: 'Auto Bank', section: 'Tài chính' },
    { key: 'system', icon: Server, label: 'Hệ thống', section: 'Kỹ thuật' },
    { key: 'traffic', icon: Activity, label: 'Traffic' },
    { key: 'cron', icon: Timer, label: 'Cron Link' },
    { key: 'settings', icon: Settings, label: 'Cài đặt' },
];

const getPanelTabFromQuery = (value: unknown): PanelTab | null => {
    const key = Array.isArray(value) ? value[0] : value;
    return sideItems.some((item) => item.key === key) ? (key as PanelTab) : null;
};

export default function AdminPanelPage() {
    const router = useRouter();
    const { data: meData, isLoading: meLoading } = useGetMe(true);
    const user = meData?.data?.user;

    const [tab, setTab] = useState<PanelTab>('dashboard');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [overviewData, setOverviewData] = useState<OverviewData | null>(null);
    const [deepData, setDeepData] = useState<DeepData | null>(null);
    const [users, setUsers] = useState<UserRow[]>([]);
    const [bankData, setBankData] = useState<BankData | null>(null);
    const [acbData, setAcbData] = useState<AcbData | null>(null);
    const [paymentConfig, setPaymentConfig] = useState<PaymentConfig | null>(null);
    const [trafficData, setTrafficData] = useState<TrafficData | null>(null);
    const [lastSync, setLastSync] = useState<Date | null>(null);

    const [invoiceFilter, setInvoiceFilter] = useState('');
    const [bankFilter, setBankFilter] = useState('');
    const [userSearch, setUserSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState<string | undefined>();
    const [workspaceSearch, setWorkspaceSearch] = useState('');

    useEffect(() => {
        const nextTab = getPanelTabFromQuery(router.query.tab);
        if (nextTab && nextTab !== tab) setTab(nextTab);
    }, [router.query.tab, tab]);

    const selectPanelTab = useCallback((nextTab: PanelTab) => {
        setTab(nextTab);
        router.replace({ pathname: '/panel', query: { tab: nextTab } }, undefined, { shallow: true });
    }, [router]);

    const fetchDashboard = useCallback(async () => {
        setRefreshing(true);
        try {
            const [ov, userList, bank, acb, payment, deep, metrics] = await Promise.all([
                httpClient.get('/admin/overview').then((r) => r.data?.data as OverviewData).catch(() => null),
                httpClient.get('/admin/users').then((r) => (r.data?.data || []) as UserRow[]).catch(() => []),
                httpClient.get('/bank/transactions').then((r) => r.data?.data as BankData).catch(() => null),
                httpClient.get('/admin/acb-transactions').then((r) => r.data?.data as AcbData).catch(() => null),
                httpClient.get('/admin/payment-config').then((r) => r.data?.data as PaymentConfig).catch(() => null),
                httpClient.get('/admin/deep-stats').then((r) => r.data?.data as DeepData).catch(() => null),
                httpClient.get('/admin/system-metrics').then((r) => r.data?.data as TrafficData).catch(() => null),
            ]);

            setOverviewData(ov);
            setUsers(userList);
            setBankData(bank);
            setAcbData(acb);
            setPaymentConfig(payment);
            setDeepData(deep);
            setTrafficData(metrics);
            setLastSync(new Date());

            if (ov) {
                setStats({
                    totalRevenue: acb?.totalRevenue || deep?.orders?.revenue || 0,
                    monthlyRevenue: acb?.monthlyRevenue || 0,
                    totalUsers: ov.collections?.users || userList.length || 0,
                    activeUsers: userList.filter((u) => u.isActive !== false).length,
                    totalWorkspaces: ov.collections?.workspaces || deep?.workspaces?.length || 0,
                    totalConversations: ov.conversationStats?.total || 0,
                    totalMessages: ov.collections?.messages || 0,
                    totalBots: ov.botStats?.total || 0,
                });
            }
        } catch {
            message.error('Không thể tải dữ liệu admin');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        if (!meLoading && user) {
            if (user.role !== 'admin') {
                message.error('Không có quyền truy cập');
                router.push('/');
                return;
            }
            const timer = window.setTimeout(() => {
                fetchDashboard();
            }, 0);
            return () => window.clearTimeout(timer);
        }
        return undefined;
    }, [meLoading, user, fetchDashboard, router]);

    useEffect(() => {
        if (tab !== 'traffic') return undefined;
        const fetchMetrics = async () => {
            try {
                const res = await httpClient.get('/admin/system-metrics');
                if (res.data?.success) setTrafficData(res.data.data as TrafficData);
            } catch {
                // Keep the last known metrics visible.
            }
        };
        fetchMetrics();
        const interval = setInterval(fetchMetrics, 3000);
        return () => clearInterval(interval);
    }, [tab]);

    const filteredUsers = useMemo(() => {
        const q = userSearch.trim().toLowerCase();
        return users.filter((row) => {
            const roleOk = !roleFilter || row.role === roleFilter;
            const textOk = !q || [row.name, row.email, row.id, row.role].some((value) => String(value || '').toLowerCase().includes(q));
            return roleOk && textOk;
        });
    }, [roleFilter, userSearch, users]);

    const filteredWorkspaces = useMemo(() => {
        const q = workspaceSearch.trim().toLowerCase();
        const rows = deepData?.workspaces || [];
        if (!q) return rows;
        return rows.filter((row) => [row.name, row.slug, row.plan, row.id].some((value) => String(value || '').toLowerCase().includes(q)));
    }, [deepData?.workspaces, workspaceSearch]);

    const invoiceRows = useMemo(() => {
        const q = invoiceFilter.trim().toLowerCase();
        const rows = (bankData?.transactions || []).map((tx, index) => ({
            ...tx,
            invoiceId: `INV-${String(index + 1).padStart(4, '0')}`,
            amount: tx.creditAmount || tx.debitAmount || 0,
            status: tx.creditAmount ? 'paid' : 'outgoing',
        }));
        if (!q) return rows;
        return rows.filter((row) => [row.invoiceId, row.description, row.addDescription, row.refNo].some((value) => String(value || '').toLowerCase().includes(q)));
    }, [bankData?.transactions, invoiceFilter]);

    const openUserEditor = (row: UserRow) => {
        router.push(`/panel/users/${row.id}`);
    };

    if (meLoading || !user) {
        return <FullPageSpin />;
    }

    if (user.role !== 'admin') return null;

    const currentTab = sideItems.find((item) => item.key === tab);

    return (
        <>
            <Head><title>Admin Panel | NemarkChat</title></Head>
            <div className="panel-root">
                <aside className="panel-sidebar">
                    <div className="panel-brand">
                        <div className="panel-brand-mark"><Shield size={18} /></div>
                        <div className="panel-brand-copy">
                            <strong>Admin Panel</strong>
                            <span>NemarkChat</span>
                        </div>
                    </div>

                    <nav className="panel-nav">
                        {sideItems.map((item) => {
                            const Icon = item.icon;
                            const active = tab === item.key;
                            return (
                                <React.Fragment key={item.key}>
                                    {item.section && <div className="panel-nav-section">{item.section}</div>}
                                    <button className={`panel-nav-item ${active ? 'active' : ''}`} onClick={() => selectPanelTab(item.key)}>
                                        <Icon size={17} />
                                        <span>{item.label}</span>
                                    </button>
                                </React.Fragment>
                            );
                        })}
                    </nav>

                    <div className="panel-sidebar-footer">
                        <div className="panel-user-email">{user.email}</div>
                        <div className="panel-sidebar-footer-buttons">
                            <button className="panel-link-button" onClick={() => router.push('/')}>
                                <Globe size={14} />
                                Về Client
                            </button>
                            <button className="panel-link-button" onClick={() => router.push('/workspace')}>
                                <ArrowDownLeft size={14} />
                                Về Workspace
                            </button>
                        </div>
                    </div>
                </aside>

                <main className="panel-main">
                    <header className="panel-page-header">
                        <div>
                            <div className="panel-kicker">
                                <Activity size={14} />
                                Trung tâm vận hành
                            </div>
                            <h1>{currentTab?.label || 'Dashboard'}</h1>
                            <p>Quản trị tenant, doanh thu, vận hành và hạ tầng NemarkChat.</p>
                        </div>
                        <div className="panel-header-actions">
                            <span className="panel-sync-text">Cập nhật: {lastSync ? lastSync.toLocaleTimeString('vi-VN') : 'Đang chờ'}</span>
                            <button className="panel-primary-button" onClick={fetchDashboard} disabled={refreshing}>
                                <RefreshCw size={15} className={refreshing ? 'spin-icon' : ''} />
                                Làm mới
                            </button>
                        </div>
                    </header>

                    {loading || !stats ? (
                        <div className="panel-loading"><Spin size="large" /></div>
                    ) : (
                        <>
                            {tab === 'dashboard' && (
                                <CommandDashboard
                                    stats={stats}
                                    overviewData={overviewData}
                                    deepData={deepData}
                                    users={users}
                                    acbData={acbData}
                                    bankData={bankData}
                                    trafficData={trafficData}
                                    lastSync={lastSync}
                                    onTabChange={selectPanelTab}
                                />
                            )}
                            {tab === 'revenue' && <RevenueTab acbData={acbData} />}
                            {tab === 'invoices' && <InvoicesTab rows={invoiceRows} filter={invoiceFilter} onFilter={setInvoiceFilter} />}
                            {tab === 'users' && (
                                <UsersTab
                                    users={users}
                                    rows={filteredUsers}
                                    search={userSearch}
                                    roleFilter={roleFilter}
                                    onSearch={setUserSearch}
                                    onRoleFilter={setRoleFilter}
                                    onOpenUser={openUserEditor}
                                />
                            )}
                            {tab === 'workspaces' && (
                                <WorkspacesTab
                                    rows={filteredWorkspaces}
                                    allRows={deepData?.workspaces || []}
                                    search={workspaceSearch}
                                    onSearch={setWorkspaceSearch}
                                />
                            )}
                            {tab === 'bank' && (
                                <AutoBankTab
                                    bankData={bankData}
                                    paymentConfig={paymentConfig}
                                    bankFilter={bankFilter}
                                    setBankFilter={setBankFilter}
                                    fetchDashboard={fetchDashboard}
                                />
                            )}
                            {tab === 'system' && <SystemTab overviewData={overviewData} deepData={deepData} />}
                            {tab === 'traffic' && <TrafficTab trafficData={trafficData} />}
                            {tab === 'cron' && <CronTab />}
                            {tab === 'settings' && <SettingsTab />}
                        </>
                    )}
                </main>
            </div>

            <PanelStyles />
        </>
    );
}

const FullPageSpin = () => (
    <div className="panel-full-spin">
        <Spin size="large" />
    </div>
);

const CommandDashboard = ({
    stats,
    overviewData,
    deepData,
    users,
    acbData,
    bankData,
    trafficData,
    lastSync,
    onTabChange,
}: {
    stats: DashboardStats;
    overviewData: OverviewData | null;
    deepData: DeepData | null;
    users: UserRow[];
    acbData: AcbData | null;
    bankData: BankData | null;
    trafficData: TrafficData | null;
    lastSync: Date | null;
    onTabChange: (tab: PanelTab) => void;
}) => {
    const alerts = buildAlerts(stats, overviewData, deepData, bankData, acbData, trafficData, users);
    const healthScore = getHealthScore(alerts);
    const open = overviewData?.conversationStats?.open || 0;
    const pending = overviewData?.conversationStats?.pending || 0;
    const activeBots = overviewData?.botStats?.active || 0;
    const activeSubs = deepData?.subscriptions?.active || 0;

    return (
        <div className="panel-stack">
            <section className="command-hero">
                <div className="command-copy">
                    <span className="panel-kicker dark">
                        <Zap size={14} />
                        Health score {healthScore}/100
                    </span>
                    <h2>Command Center</h2>
                    <p>Theo dõi doanh thu, người dùng, hội thoại và tín hiệu hạ tầng trên cùng một màn hình.</p>
                    <div className="command-actions">
                        <button className="panel-light-button" onClick={() => onTabChange('users')}>
                            <Users size={15} />
                            Kiểm tra users
                        </button>
                        <button className="panel-light-button" onClick={() => onTabChange('traffic')}>
                            <Activity size={15} />
                            Xem traffic
                        </button>
                    </div>
                </div>
                <div className="command-health">
                    <div className="health-ring" style={{ ['--score' as string]: `${healthScore}%` }}>
                        <span>{healthScore}</span>
                        <small>/100</small>
                    </div>
                    <div>
                        <strong>Trạng thái tổng thể</strong>
                        <span>{alerts.length ? `${alerts.length} cảnh báo cần xem` : 'Các tín hiệu chính đang ổn định'}</span>
                        <em>Cập nhật {lastSync ? lastSync.toLocaleTimeString('vi-VN') : 'đang chờ'}</em>
                    </div>
                </div>
            </section>

            <div className="panel-kpi-grid">
                <MetricCard icon={DollarSign} tone="teal" label="Tổng doanh thu" value={fmtVND(stats.totalRevenue)} meta={`${fmtVND(stats.monthlyRevenue)} tháng này`} />
                <MetricCard icon={Users} tone="blue" label="Users hoạt động" value={`${fmtNum(stats.activeUsers)}/${fmtNum(stats.totalUsers)}`} meta={`${fmtNum(users.filter((u) => u.role === 'admin').length)} admin`} />
                <MetricCard icon={MessageSquare} tone="amber" label="Hội thoại mở" value={fmtNum(open)} meta={`${fmtNum(pending)} đang chờ xử lý`} />
                <MetricCard icon={Bot} tone="violet" label="AI Bots" value={`${fmtNum(activeBots)}/${fmtNum(stats.totalBots)}`} meta="Bot đang bật / tổng bot" />
                <MetricCard icon={Layers} tone="slate" label="Workspaces" value={fmtNum(stats.totalWorkspaces)} meta={`${fmtNum(activeSubs)} subscription active`} />
                <MetricCard icon={Landmark} tone="teal" label="Số dư MB" value={fmtVND(bankData?.balance || 0)} meta={`${fmtNum(bankData?.transactionCount || 0)} giao dịch`} />
            </div>

            <div className="panel-dashboard-grid">
                <TrendCard trends={deepData?.trends || []} />
                <PriorityAlerts alerts={alerts} onTabChange={onTabChange} />
            </div>

            <div className="panel-grid-2">
                <RecentRevenue acbData={acbData} onOpen={() => onTabChange('revenue')} />
                <OperationsSnapshot overviewData={overviewData} deepData={deepData} trafficData={trafficData} />
            </div>

            <div className="panel-grid-2">
                <TopWorkspaces rows={deepData?.workspaces || []} onOpen={() => onTabChange('workspaces')} />
                <RecentUsers users={users} onOpen={() => onTabChange('users')} />
            </div>
        </div>
    );
};

const buildAlerts = (
    stats: DashboardStats,
    overviewData: OverviewData | null,
    deepData: DeepData | null,
    bankData: BankData | null,
    acbData: AcbData | null,
    trafficData: TrafficData | null,
    users: UserRow[],
): AlertItem[] => {
    const alerts: AlertItem[] = [];
    const pending = overviewData?.conversationStats?.pending || 0;
    const inactiveUsers = users.filter((row) => row.isActive === false).length;
    const inactiveBots = Math.max(0, stats.totalBots - (overviewData?.botStats?.active || 0));
    const memoryPct = trafficData?.memory?.usedPercent || pct(overviewData?.server?.memoryUsed, overviewData?.server?.memoryTotal);

    if (!bankData) alerts.push({ label: 'MB Bank chưa phản hồi', detail: 'Nguồn giao dịch Auto Bank đang trống hoặc lỗi kết nối.', severity: 'danger', actionLabel: 'Mở Auto Bank', actionTab: 'bank' });
    if (!acbData) alerts.push({ label: 'ACB revenue chưa phản hồi', detail: 'Không lấy được dữ liệu doanh thu hệ thống.', severity: 'watch', actionLabel: 'Xem doanh thu', actionTab: 'revenue' });
    if (pending > 0) alerts.push({ label: `${fmtNum(pending)} hội thoại đang chờ`, detail: 'Nên rà soát hàng đợi chăm sóc khách hàng.', severity: pending > 20 ? 'danger' : 'watch', actionLabel: 'Xem hệ thống', actionTab: 'system' });
    if (inactiveUsers > 0) alerts.push({ label: `${fmtNum(inactiveUsers)} user bị vô hiệu`, detail: 'Kiểm tra các tài khoản bị khóa hoặc chưa kích hoạt.', severity: 'info', actionLabel: 'Mở users', actionTab: 'users' });
    if (inactiveBots > 0) alerts.push({ label: `${fmtNum(inactiveBots)} bot đang tắt`, detail: 'Một số bot không tự động phản hồi.', severity: 'watch', actionLabel: 'Xem hệ thống', actionTab: 'system' });
    if (memoryPct >= 80) alerts.push({ label: `RAM dùng ${memoryPct}%`, detail: 'Tài nguyên máy chủ đang cao, nên quan sát traffic.', severity: 'danger', actionLabel: 'Xem traffic', actionTab: 'traffic' });
    if ((deepData?.sessions?.active || 0) === 0 && (deepData?.sessions?.total || 0) > 0) alerts.push({ label: 'Không có Zalo session active', detail: 'Các phiên remote hiện không kết nối.', severity: 'watch', actionLabel: 'Xem hệ thống', actionTab: 'system' });

    return alerts.slice(0, 6);
};

const getHealthScore = (alerts: AlertItem[]) => {
    const penalty = alerts.reduce((sum, item) => {
        if (item.severity === 'danger') return sum + 22;
        if (item.severity === 'watch') return sum + 12;
        return sum + 6;
    }, 0);
    return clamp(100 - penalty, 45, 100);
};

const TrendCard = ({ trends }: { trends: TrendPoint[] }) => {
    const maxValue = Math.max(1, ...trends.flatMap((point) => [point.messages || 0, point.conversations || 0, point.visitors || 0]));

    return (
        <PanelCard
            title="Hoạt động 7 ngày"
            subtitle="Tin nhắn, hội thoại và visitor mới"
            actions={<MiniLegend />}
        >
            {trends.length ? (
                <div className="trend-chart">
                    {trends.map((point) => (
                        <div className="trend-day" key={point.date}>
                            <div className="trend-bars">
                                <span className="bar messages" style={{ height: `${Math.max(8, ((point.messages || 0) / maxValue) * 142)}px` }} />
                                <span className="bar conversations" style={{ height: `${Math.max(8, ((point.conversations || 0) / maxValue) * 142)}px` }} />
                                <span className="bar visitors" style={{ height: `${Math.max(8, ((point.visitors || 0) / maxValue) * 142)}px` }} />
                            </div>
                            <strong>{fmtNum(point.messages || 0)}</strong>
                            <span>{formatShortDate(point.date)}</span>
                        </div>
                    ))}
                </div>
            ) : (
                <EmptyBlock icon={BarChart3} title="Chưa có dữ liệu trend" />
            )}
        </PanelCard>
    );
};

const MiniLegend = () => (
    <div className="mini-legend">
        <span><i className="dot messages" />Tin</span>
        <span><i className="dot conversations" />Hội thoại</span>
        <span><i className="dot visitors" />Visitor</span>
    </div>
);

const PriorityAlerts = ({ alerts, onTabChange }: { alerts: AlertItem[]; onTabChange: (tab: PanelTab) => void }) => (
    <PanelCard title="Cảnh báo ưu tiên" subtitle="Các điểm nên xử lý trước">
        {alerts.length ? (
            <div className="alert-list">
                {alerts.map((item) => (
                    <div className={`alert-row ${item.severity}`} key={`${item.label}-${item.detail}`}>
                        <div className="alert-icon">{item.severity === 'danger' ? <AlertTriangle size={16} /> : item.severity === 'watch' ? <Clock size={16} /> : <CheckCircle size={16} />}</div>
                        <div>
                            <strong>{item.label}</strong>
                            <span>{item.detail}</span>
                        </div>
                        {item.actionTab && (
                            <button className="panel-ghost-button" onClick={() => onTabChange(item.actionTab!)}>
                                <Eye size={14} />
                                {item.actionLabel || 'Xem'}
                            </button>
                        )}
                    </div>
                ))}
            </div>
        ) : (
            <EmptyBlock icon={CheckCircle} title="Không có cảnh báo lớn" />
        )}
    </PanelCard>
);

const RecentRevenue = ({ acbData, onOpen }: { acbData: AcbData | null; onOpen: () => void }) => {
    const rows = acbData?.transactions?.slice(0, 6) || [];
    return (
        <PanelCard
            title="Doanh thu gần đây"
            subtitle={`Nguồn: ${acbData?.account?.bank || 'ACB'}`}
            actions={<button className="panel-ghost-button" onClick={onOpen}><ArrowUpRight size={14} />Chi tiết</button>}
        >
            {rows.length ? (
                <div className="compact-list">
                    {rows.map((tx, index) => (
                        <div className="compact-row" key={`${tx.postingDate}-${index}`}>
                            <div className="row-icon teal"><Banknote size={15} /></div>
                            <div className="compact-row-main">
                                <strong>{tx.senderName || 'Giao dịch ACB'}</strong>
                                <span>{tx.description || 'Không có nội dung'}</span>
                            </div>
                            <div className="compact-row-value">
                                <strong>{fmtVND(tx.amount || 0)}</strong>
                                <span>{formatDateTime(tx.postingDate)}</span>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <EmptyBlock icon={Receipt} title="Chưa có giao dịch doanh thu" />
            )}
        </PanelCard>
    );
};

const OperationsSnapshot = ({ overviewData, deepData, trafficData }: { overviewData: OverviewData | null; deepData: DeepData | null; trafficData: TrafficData | null }) => {
    const server = overviewData?.server;
    const memoryPct = trafficData?.memory?.usedPercent || pct(server?.memoryUsed, server?.memoryTotal);
    const conversationStats = overviewData?.conversationStats;
    return (
        <PanelCard title="Vận hành hệ thống" subtitle={`${server?.hostname || 'Server'} - ${server?.platform || 'runtime'}`}>
            <div className="snapshot-grid">
                <MetricLine label="Open conversations" value={fmtNum(conversationStats?.open || 0)} icon={MessageSquare} tone="blue" />
                <MetricLine label="Pending orders" value={fmtNum(deepData?.orders?.pending || 0)} icon={CreditCard} tone="amber" />
                <MetricLine label="Active sessions" value={`${fmtNum(deepData?.sessions?.active || 0)}/${fmtNum(deepData?.sessions?.total || 0)}`} icon={SmartphoneIcon} tone="teal" />
                <MetricLine label="Memory usage" value={`${memoryPct}%`} icon={HardDrive} tone={memoryPct >= 80 ? 'rose' : 'slate'} />
            </div>
            <ProgressLine label="Memory" value={memoryPct} tone={memoryPct >= 80 ? 'rose' : 'blue'} />
            <ProgressLine label="CPU" value={trafficData?.cpu?.usagePercent || 0} tone="teal" />
        </PanelCard>
    );
};

const SmartphoneIcon = ({ size = 16 }: { size?: number }) => <Monitor size={size} />;

const TopWorkspaces = ({ rows, onOpen }: { rows: WorkspaceRow[]; onOpen: () => void }) => {
    const topRows = [...rows].sort((a, b) => (b.conversationCount || 0) - (a.conversationCount || 0)).slice(0, 6);
    return (
        <PanelCard title="Workspaces nổi bật" subtitle="Sắp xếp theo hội thoại" actions={<button className="panel-ghost-button" onClick={onOpen}><Layers size={14} />Tất cả</button>}>
            {topRows.length ? (
                <div className="compact-table-wrap">
                    <table className="compact-table">
                        <thead>
                            <tr>
                                <th>Tên</th>
                                <th>Plan</th>
                                <th>Members</th>
                                <th>Hội thoại</th>
                                <th>Trạng thái</th>
                            </tr>
                        </thead>
                        <tbody>
                            {topRows.map((row) => (
                                <tr key={row.id}>
                                    <td>
                                        <strong>{row.name || 'Workspace'}</strong>
                                        <span>{row.slug || row.id}</span>
                                    </td>
                                    <td>{row.plan || 'free'}</td>
                                    <td>{fmtNum(row.memberCount || 0)}</td>
                                    <td>{fmtNum(row.conversationCount || 0)}</td>
                                    <td><StatusPill active={row.isActive !== false} /></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <EmptyBlock icon={Layers} title="Chưa có workspace" />
            )}
        </PanelCard>
    );
};

const RecentUsers = ({ users, onOpen }: { users: UserRow[]; onOpen: () => void }) => {
    const rows = [...users].slice(0, 6);
    return (
        <PanelCard title="Users mới nhất" subtitle="Tài khoản gần đây" actions={<button className="panel-ghost-button" onClick={onOpen}><Users size={14} />Quản lý</button>}>
            {rows.length ? (
                <div className="compact-list">
                    {rows.map((row) => (
                        <div className="compact-row" key={row.id}>
                            <InitialAvatar name={row.name || row.email || 'U'} />
                            <div className="compact-row-main">
                                <strong>{row.name || 'Chưa đặt tên'}</strong>
                                <span>{row.email || row.id}</span>
                            </div>
                            <div className="compact-row-value">
                                <Tag color={row.role === 'admin' ? 'blue' : 'default'}>{row.role || 'member'}</Tag>
                                <span>{formatShortDate(row.createdAt)}</span>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <EmptyBlock icon={Users} title="Chưa có user" />
            )}
        </PanelCard>
    );
};

const RevenueTab = ({ acbData }: { acbData: AcbData | null }) => {
    const rows = acbData?.transactions || [];
    return (
        <div className="panel-stack">
            <div className="panel-kpi-grid three">
                <MetricCard icon={TrendingUp} tone="teal" label="Doanh thu NemarkChat" value={fmtVND(acbData?.totalRevenue || 0)} meta="Tổng tiền vào ACB" />
                <MetricCard icon={Wallet} tone="blue" label="Doanh thu tháng này" value={fmtVND(acbData?.monthlyRevenue || 0)} meta={`${fmtNum(acbData?.monthlyCount || 0)} giao dịch`} />
                <MetricCard icon={Receipt} tone="amber" label="Số giao dịch" value={fmtNum(acbData?.transactionCount || rows.length)} meta={acbData?.account?.number || 'Chưa cấu hình STK'} />
            </div>
            <PanelCard title="Chi tiết doanh thu" subtitle={`${acbData?.account?.bank || 'ACB'} - ${acbData?.account?.holder || 'Tài khoản nhận'}`}>
                <Table<AcbTransaction>
                    dataSource={rows}
                    rowKey={(_, index) => String(index || 0)}
                    size="small"
                    pagination={{ pageSize: 12, showSizeChanger: true }}
                    scroll={{ x: 760 }}
                    columns={[
                        { title: 'Thời gian', dataIndex: 'postingDate', width: 190, render: (value: AcbTransaction['postingDate']) => <span className="mono-text">{formatDateTime(value)}</span> },
                        { title: 'Người gửi', dataIndex: 'senderName', width: 180, render: (value: string) => value || 'Không rõ' },
                        { title: 'Nội dung', dataIndex: 'description', render: (value: string) => <span className="table-description">{value || 'Không có nội dung'}</span> },
                        { title: 'Số tiền', dataIndex: 'amount', width: 160, align: 'right' as const, render: (value: number) => <strong className="money-positive">{fmtVND(value || 0)}</strong> },
                    ]}
                />
            </PanelCard>
        </div>
    );
};

const InvoicesTab = ({ rows, filter, onFilter }: { rows: Array<BankTransaction & { invoiceId: string; amount: number; status: string }>; filter: string; onFilter: (value: string) => void }) => (
    <div className="panel-stack">
        <div className="panel-kpi-grid three">
            <MetricCard icon={CreditCard} tone="blue" label="Hóa đơn suy luận" value={fmtNum(rows.length)} meta="Từ giao dịch MB Bank" />
            <MetricCard icon={CheckCircle} tone="teal" label="Đã thu" value={fmtVND(rows.filter((row) => row.status === 'paid').reduce((sum, row) => sum + row.amount, 0))} meta={`${fmtNum(rows.filter((row) => row.status === 'paid').length)} khoản vào`} />
            <MetricCard icon={TrendingDown} tone="rose" label="Khoản ra" value={fmtVND(rows.filter((row) => row.status === 'outgoing').reduce((sum, row) => sum + row.amount, 0))} meta="Giao dịch debit" />
        </div>
        <PanelCard
            title="Quản lý hóa đơn"
            subtitle="Theo dõi giao dịch đã map sang mã hóa đơn tạm"
            actions={<SearchBox value={filter} onChange={onFilter} placeholder="Tìm mã, nội dung, ref..." />}
        >
            <Table
                dataSource={rows}
                rowKey={(row) => row.id || row.refNo || row.invoiceId}
                size="small"
                pagination={{ pageSize: 12, showSizeChanger: true }}
                scroll={{ x: 780 }}
                columns={[
                    { title: 'Mã HĐ', dataIndex: 'invoiceId', width: 120, render: (value: string) => <Tag color="blue">{value}</Tag> },
                    { title: 'Ngày', dataIndex: 'transactionDate', width: 170, render: (value: string) => <span className="mono-text">{value || 'Chưa có'}</span> },
                    { title: 'Nội dung', dataIndex: 'description', render: (value: string, row) => <span className="table-description">{value || row.addDescription || 'Không có nội dung'}</span> },
                    { title: 'Số tiền', dataIndex: 'amount', width: 150, align: 'right' as const, render: (value: number, row) => <strong className={row.status === 'paid' ? 'money-positive' : 'money-negative'}>{row.status === 'paid' ? '+' : '-'}{fmtVND(value)}</strong> },
                    { title: 'Trạng thái', dataIndex: 'status', width: 130, render: (value: string) => <Tag color={value === 'paid' ? 'green' : 'default'}>{value === 'paid' ? 'Đã thu' : 'Khoản ra'}</Tag> },
                ]}
            />
        </PanelCard>
    </div>
);

const UsersTab = ({
    users,
    rows,
    search,
    roleFilter,
    onSearch,
    onRoleFilter,
    onOpenUser,
}: {
    users: UserRow[];
    rows: UserRow[];
    search: string;
    roleFilter?: string;
    onSearch: (value: string) => void;
    onRoleFilter: (value: string | undefined) => void;
    onOpenUser: (row: UserRow) => void;
}) => (
    <div className="panel-stack">
        <div className="panel-kpi-grid four">
            <MetricCard icon={Users} tone="blue" label="Tổng thành viên" value={fmtNum(users.length)} meta="Toàn hệ thống" />
            <MetricCard icon={UserCheck} tone="teal" label="Đang hoạt động" value={fmtNum(users.filter((row) => row.isActive !== false).length)} meta="isActive khác false" />
            <MetricCard icon={Shield} tone="violet" label="Admin" value={fmtNum(users.filter((row) => row.role === 'admin').length)} meta="Quyền cao nhất" />
            <MetricCard icon={UserX} tone="rose" label="Bị vô hiệu" value={fmtNum(users.filter((row) => row.isActive === false).length)} meta="Cần rà soát" />
        </div>

        <PanelCard
            title="Quản lý users"
            subtitle={`${fmtNum(rows.length)} kết quả`}
            actions={
                <div className="toolbar-row">
                    <SearchBox value={search} onChange={onSearch} placeholder="Tên, email, ID..." />
                    <Select
                        allowClear
                        value={roleFilter}
                        onChange={(value) => onRoleFilter(value)}
                        placeholder="Role"
                        style={{ width: 150 }}
                        options={[
                            { value: 'admin', label: 'Admin' },
                            { value: 'agent', label: 'Agent' },
                            { value: 'member', label: 'Member' },
                        ]}
                    />
                    <button className="panel-ghost-button" onClick={() => { onSearch(''); onRoleFilter(undefined); }}>
                        <XCircle size={14} />
                        Reset
                    </button>
                </div>
            }
        >
            <Table<UserRow>
                dataSource={rows}
                rowKey="id"
                size="small"
                pagination={{ pageSize: 12, showSizeChanger: true }}
                scroll={{ x: 1050 }}
                columns={[
                    {
                        title: 'User',
                        dataIndex: 'name',
                        width: 280,
                        render: (_value: string, row) => (
                            <div className="table-user">
                                <InitialAvatar name={row.name || row.email || 'U'} />
                                <div>
                                    <strong>{row.name || 'Chưa đặt tên'}</strong>
                                    <span>{row.email || row.id}</span>
                                </div>
                            </div>
                        ),
                    },
                    { title: 'Role', dataIndex: 'role', width: 110, render: (value: string) => <Tag color={value === 'admin' ? 'blue' : 'default'}>{value || 'member'}</Tag> },
                    { title: 'Trạng thái', dataIndex: 'isActive', width: 130, render: (value: boolean | undefined) => <Badge status={value === false ? 'error' : 'success'} text={value === false ? 'Tắt' : 'Active'} /> },
                    {
                        title: 'Workspaces',
                        dataIndex: 'workspaceCount',
                        width: 130,
                        align: 'center' as const,
                        render: (value: number, row) => (
                            <Tooltip title={row.workspaces?.map((workspace) => workspace.name).join(', ') || 'Không có workspace'}>
                                <strong className="linkish">{fmtNum(value || 0)}</strong>
                            </Tooltip>
                        ),
                    },
                    { title: 'Đơn hàng', dataIndex: 'orderCount', width: 110, align: 'right' as const, render: (value: number) => fmtNum(value || 0) },
                    { title: 'Login cuối', dataIndex: 'lastLogin', width: 190, render: (value: string | null) => <span className="mono-text">{formatDateTime(value)}</span> },
                    { title: 'IP', dataIndex: 'lastIP', width: 150, render: (value: string) => value || 'Chưa có' },
                    {
                        title: '',
                        key: 'action',
                        width: 110,
                        fixed: 'right' as const,
                        render: (_value: unknown, row) => (
                            <button className="panel-ghost-button" onClick={() => onOpenUser(row)}>
                                <ExternalLink size={14} />
                                Quản lý
                            </button>
                        ),
                    },
                ]}
            />
        </PanelCard>
    </div>
);

const WorkspacesTab = ({ rows, allRows, search, onSearch }: { rows: WorkspaceRow[]; allRows: WorkspaceRow[]; search: string; onSearch: (value: string) => void }) => {
    const activeRows = allRows.filter((row) => row.isActive !== false);
    const members = allRows.reduce((sum, row) => sum + (row.memberCount || 0), 0);
    const conversations = allRows.reduce((sum, row) => sum + (row.conversationCount || 0), 0);
    const visitors = allRows.reduce((sum, row) => sum + (row.visitorCount || 0), 0);

    return (
        <div className="panel-stack">
            <div className="panel-kpi-grid four">
                <MetricCard icon={Layers} tone="blue" label="Tổng workspaces" value={fmtNum(allRows.length)} meta={`${fmtNum(activeRows.length)} active`} />
                <MetricCard icon={Users} tone="teal" label="Members" value={fmtNum(members)} meta="Tổng thành viên" />
                <MetricCard icon={MessageSquare} tone="amber" label="Hội thoại" value={fmtNum(conversations)} meta="Trên workspace" />
                <MetricCard icon={Eye} tone="violet" label="Visitors" value={fmtNum(visitors)} meta="Khách đã ghi nhận" />
            </div>

            <PanelCard title="Danh sách workspaces" subtitle={`${fmtNum(rows.length)} kết quả`} actions={<SearchBox value={search} onChange={onSearch} placeholder="Tên, slug, plan..." />}>
                <Table<WorkspaceRow>
                    dataSource={rows}
                    rowKey="id"
                    size="small"
                    pagination={{ pageSize: 12, showSizeChanger: true }}
                    scroll={{ x: 900 }}
                    columns={[
                        {
                            title: 'Workspace',
                            dataIndex: 'name',
                            render: (value: string, row) => (
                                <div className="table-title">
                                    <strong>{value || 'Workspace'}</strong>
                                    <span>{row.slug || row.id}</span>
                                </div>
                            ),
                        },
                        { title: 'Plan', dataIndex: 'plan', width: 120, render: (value: string) => <Tag color={value === 'pro' ? 'blue' : 'default'}>{value || 'free'}</Tag> },
                        { title: 'Members', dataIndex: 'memberCount', width: 110, align: 'right' as const, render: (value: number) => fmtNum(value || 0) },
                        { title: 'Widgets', dataIndex: 'widgetCount', width: 110, align: 'right' as const, render: (value: number) => fmtNum(value || 0) },
                        { title: 'Visitors', dataIndex: 'visitorCount', width: 110, align: 'right' as const, render: (value: number) => fmtNum(value || 0) },
                        { title: 'Hội thoại', dataIndex: 'conversationCount', width: 120, align: 'right' as const, render: (value: number) => <strong className="linkish">{fmtNum(value || 0)}</strong> },
                        { title: 'Tạo lúc', dataIndex: 'createdAt', width: 160, render: (value: string) => <span className="mono-text">{formatShortDate(value)}</span> },
                        { title: 'Trạng thái', dataIndex: 'isActive', width: 130, render: (value: boolean | undefined) => <StatusPill active={value !== false} /> },
                    ]}
                />
            </PanelCard>
        </div>
    );
};

const AutoBankTab = ({
    bankData,
    paymentConfig,
    bankFilter,
    setBankFilter,
    fetchDashboard,
}: {
    bankData: BankData | null;
    paymentConfig: PaymentConfig | null;
    bankFilter: string;
    setBankFilter: (value: string) => void;
    fetchDashboard: () => Promise<void>;
}) => {
    const [autoRefresh, setAutoRefresh] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [savingPaymentConfig, setSavingPaymentConfig] = useState(false);
    const [paymentDraft, setPaymentDraft] = useState<PaymentConfig>({});
    const [configTab, setConfigTab] = useState<'monitor' | 'mbbank' | 'acb' | 'general'>('monitor');

    useEffect(() => {
        setPaymentDraft(paymentConfig || {});
    }, [paymentConfig]);

    useEffect(() => {
        if (!autoRefresh) return undefined;
        const interval = setInterval(() => { fetchDashboard(); }, 15000);
        return () => clearInterval(interval);
    }, [autoRefresh, fetchDashboard]);

    const transactions = bankData?.transactions || [];
    const filtered = transactions.filter((tx) => {
        const q = bankFilter.trim().toLowerCase();
        if (!q) return true;
        return [tx.description, tx.addDescription, tx.refNo, tx.tranId, tx.creditAmount, tx.debitAmount].some((value) => String(value || '').toLowerCase().includes(q));
    });
    const totalCredit = bankData?.totalCredit ?? transactions.reduce((sum, tx) => sum + (tx.creditAmount || 0), 0);
    const totalDebit = bankData?.totalDebit ?? transactions.reduce((sum, tx) => sum + (tx.debitAmount || 0), 0);
    const creditCount = transactions.filter((tx) => (tx.creditAmount || 0) > 0).length;
    const debitCount = transactions.filter((tx) => (tx.debitAmount || 0) > 0).length;

    const handleRefresh = async () => {
        setRefreshing(true);
        await fetchDashboard();
        setRefreshing(false);
    };

    const savePaymentConfig = async () => {
        if (!paymentDraft.bankName || !paymentDraft.number || !paymentDraft.holder) {
            message.warning('Vui lòng nhập đủ ngân hàng, số tài khoản và chủ tài khoản');
            return;
        }
        setSavingPaymentConfig(true);
        try {
            await httpClient.put('/admin/payment-config', paymentDraft);
            message.success('Đã lưu cấu hình tài khoản nhận thanh toán');
            await fetchDashboard();
        } catch (error: unknown) {
            const err = error as { response?: { data?: { error?: string } } };
            message.error(err.response?.data?.error || 'Không thể lưu cấu hình thanh toán');
        } finally {
            setSavingPaymentConfig(false);
        }
    };

    const tabs = [
        { key: 'monitor', label: 'Giám sát' },
        { key: 'mbbank', label: 'MB Bank Auto' },
        { key: 'acb', label: 'ACB Auto' },
        { key: 'general', label: 'Cài đặt chung' },
    ] as const;

    return (
        <div className="panel-stack">
            <div className="segmented-tabs">
                {tabs.map((item) => (
                    <button key={item.key} className={configTab === item.key ? 'active' : ''} onClick={() => setConfigTab(item.key)}>
                        {item.label}
                    </button>
                ))}
            </div>

            {configTab === 'monitor' && (
                <>
                    <div className="bank-overview-grid">
                        <section className="bank-account-panel">
                            <div>
                                <span>MB Bank</span>
                                <strong>{bankData?.account?.number || 'Chưa tải số tài khoản'}</strong>
                            </div>
                            <button className="panel-light-button" onClick={() => copyText(bankData?.account?.number)}>
                                <Copy size={14} />
                                Copy STK
                            </button>
                            <p>Chủ tài khoản</p>
                            <h3>{bankData?.account?.holder || 'Đang tải...'}</h3>
                            <p>Số dư khả dụng</p>
                            <h2>{fmtVND(bankData?.balance || 0)}</h2>
                        </section>
                        <MetricCard icon={Banknote} tone="teal" label="Tổng tiền vào" value={fmtVND(totalCredit)} meta={`${fmtNum(creditCount)} giao dịch`} />
                        <MetricCard icon={TrendingDown} tone="rose" label="Tổng tiền ra" value={fmtVND(totalDebit)} meta={`${fmtNum(debitCount)} giao dịch`} />
                    </div>

                    <PanelCard
                        title="Lịch sử giao dịch"
                        subtitle={`${fmtNum(transactions.length)} giao dịch`}
                        actions={
                            <div className="toolbar-row">
                                <SearchBox value={bankFilter} onChange={setBankFilter} placeholder="Tìm giao dịch..." />
                                <button className={`panel-ghost-button ${autoRefresh ? 'active' : ''}`} onClick={() => setAutoRefresh((value) => !value)}>
                                    <Activity size={14} />
                                    {autoRefresh ? 'Auto 15s' : 'Auto Refresh'}
                                </button>
                                <button className="panel-ghost-button" onClick={handleRefresh}>
                                    <RefreshCw size={14} className={refreshing ? 'spin-icon' : ''} />
                                    Làm mới
                                </button>
                            </div>
                        }
                    >
                        <Table<BankTransaction>
                            dataSource={filtered}
                            rowKey={(row) => row.id || row.refNo || row.tranId || `${row.transactionDate}-${row.description}`}
                            size="small"
                            pagination={{ pageSize: 20, showSizeChanger: true }}
                            scroll={{ x: 900 }}
                            columns={[
                                {
                                    title: '',
                                    dataIndex: 'type',
                                    width: 52,
                                    render: (_value: string, row) => (
                                        <div className={`direction-icon ${(row.creditAmount || 0) > 0 ? 'in' : 'out'}`}>
                                            {(row.creditAmount || 0) > 0 ? <ArrowDownLeft size={15} /> : <ArrowUpRight size={15} />}
                                        </div>
                                    ),
                                },
                                {
                                    title: 'Nội dung',
                                    dataIndex: 'description',
                                    render: (value: string, row) => (
                                        <div className="table-title">
                                            <strong>{value || row.addDescription || 'Không có nội dung'}</strong>
                                            <span>Mã GD: {row.refNo || row.tranId || 'N/A'}</span>
                                        </div>
                                    ),
                                },
                                { title: 'Thời gian', dataIndex: 'transactionDate', width: 170, render: (value: string) => <span className="mono-text">{value || 'Chưa có'}</span> },
                                {
                                    title: 'Số tiền',
                                    key: 'amount',
                                    width: 160,
                                    align: 'right' as const,
                                    render: (_value: unknown, row) => {
                                        const credit = row.creditAmount || 0;
                                        const debit = row.debitAmount || 0;
                                        return <strong className={credit > 0 ? 'money-positive' : 'money-negative'}>{credit > 0 ? '+' : '-'}{fmtVND(credit || debit)}</strong>;
                                    },
                                },
                                { title: 'Số dư', dataIndex: 'availableBalance', width: 150, align: 'right' as const, render: (value: number) => fmtVND(value || 0) },
                            ]}
                        />
                    </PanelCard>
                </>
            )}

            {configTab === 'mbbank' && (
                <PanelCard title="Cấu hình MB Bank Auto" subtitle="Thông tin nguồn giao dịch đang dùng cho Auto Bank">
                    <ConfigGrid
                        items={[
                            ['Ngân hàng', bankData?.account?.bank || 'MB Bank'],
                            ['Số tài khoản', bankData?.account?.number || '070028386'],
                            ['Chủ tài khoản', bankData?.account?.holder || 'PHAM TRONG DUONG'],
                            ['API Provider', 'api.sieuthicode.net'],
                            ['Trạng thái', bankData ? 'Đang hoạt động' : 'Chưa có dữ liệu'],
                            ['Tần suất đề xuất', '5 phút'],
                            ['Số dư hiện tại', fmtVND(bankData?.balance || 0)],
                            ['Tổng giao dịch', fmtNum(transactions.length)],
                        ]}
                    />
                </PanelCard>
            )}

            {configTab === 'acb' && (
                <PanelCard
                    title="Cấu hình tài khoản nhận thanh toán"
                    subtitle="Nguồn dùng chung cho QR client, payment-info và Auto Bank xác nhận hóa đơn"
                    actions={
                        <button className="panel-primary-button" onClick={savePaymentConfig} disabled={savingPaymentConfig}>
                            <CheckCircle size={14} />
                            {savingPaymentConfig ? 'Đang lưu...' : 'Lưu cấu hình'}
                        </button>
                    }
                >
                    <div className="panel-grid-2">
                        <div className="config-form-grid">
                            <label>
                                <span>Mã bank VietQR</span>
                                <Input value={paymentDraft.bank || ''} onChange={(event) => setPaymentDraft((draft) => ({ ...draft, bank: event.target.value }))} placeholder="ACB" />
                            </label>
                            <label>
                                <span>Tên ngân hàng</span>
                                <Input value={paymentDraft.bankName || ''} onChange={(event) => setPaymentDraft((draft) => ({ ...draft, bankName: event.target.value }))} placeholder="ACB - Ngân hàng Á Châu" />
                            </label>
                            <label>
                                <span>Số tài khoản</span>
                                <Input value={paymentDraft.number || ''} onChange={(event) => setPaymentDraft((draft) => ({ ...draft, number: event.target.value }))} placeholder="24488671" />
                            </label>
                            <label>
                                <span>Chủ tài khoản</span>
                                <Input value={paymentDraft.holder || ''} onChange={(event) => setPaymentDraft((draft) => ({ ...draft, holder: event.target.value }))} placeholder="NEMARK DIGITAL" />
                            </label>
                            <label>
                                <span>API lịch sử giao dịch</span>
                                <Input value={paymentDraft.apiUrl || ''} onChange={(event) => setPaymentDraft((draft) => ({ ...draft, apiUrl: event.target.value }))} placeholder="https://api.sieuthicode.net/historyapiacb" />
                            </label>
                            <label>
                                <span>API token</span>
                                <Input.Password value={paymentDraft.apiToken || ''} onChange={(event) => setPaymentDraft((draft) => ({ ...draft, apiToken: event.target.value }))} placeholder="Giữ nguyên nếu đang bị mask" />
                            </label>
                        </div>
                        <PanelCard title="Đồng bộ client" subtitle="Thông tin này sẽ xuất hiện trong trang thanh toán của khách">
                            <ConfigGrid
                                items={[
                                    ['Ngân hàng', paymentDraft.bankName || 'Chưa cấu hình'],
                                    ['Số tài khoản', paymentDraft.number || 'Chưa cấu hình'],
                                    ['Chủ tài khoản', paymentDraft.holder || 'Chưa cấu hình'],
                                    ['VietQR bankId', paymentDraft.bank || 'ACB'],
                                    ['Tự động xác nhận', 'Bật qua payment service'],
                                    ['Nguồn dữ liệu', paymentDraft.apiUrl || 'Fallback .env'],
                                ]}
                            />
                        </PanelCard>
                    </div>
                </PanelCard>
            )}

            {configTab === 'general' && (
                <div className="panel-grid-2">
                    <PanelCard title="Cài đặt Auto Bank" subtitle="Tổng hợp hành vi vận hành hiện tại">
                        <ConfigGrid
                            items={[
                                ['Auto Refresh', autoRefresh ? 'Đang bật trong panel' : 'Tắt trong panel'],
                                ['Timeout API', 'Theo backend route'],
                                ['Múi giờ', 'Asia/Ho_Chi_Minh'],
                                ['Cảnh báo giao dịch lớn', 'Trên 5.000.000 VND'],
                            ]}
                        />
                    </PanelCard>
                    <MonthlyBankSummary transactions={transactions} />
                </div>
            )}
        </div>
    );
};

const MonthlyBankSummary = ({ transactions }: { transactions: BankTransaction[] }) => {
    const rows = Object.values(transactions.reduce<Record<string, { month: string; year: string; total: number; count: number }>>((acc, tx) => {
        const raw = tx.transactionDate || tx.postingDate || '';
        const parts = String(raw).split(/[ /:-]/).filter(Boolean);
        const month = parts.length >= 2 ? parts[1] : 'N/A';
        const year = parts.length >= 3 ? parts[2] : 'N/A';
        const key = `${month}-${year}`;
        acc[key] ||= { month, year, total: 0, count: 0 };
        acc[key].total += tx.creditAmount || 0;
        acc[key].count += tx.creditAmount ? 1 : 0;
        return acc;
    }, {}));

    return (
        <PanelCard title="Thống kê nạp tiền" subtitle="Tổng hợp theo tháng từ MB Bank">
            <Table
                dataSource={rows}
                rowKey={(row) => `${row.month}-${row.year}`}
                size="small"
                pagination={false}
                columns={[
                    { title: 'Tháng', dataIndex: 'month', render: (value: string) => <Tag color="blue">{value}</Tag> },
                    { title: 'Năm', dataIndex: 'year' },
                    { title: 'Tổng tiền', dataIndex: 'total', align: 'right' as const, render: (value: number) => <strong className="money-positive">{fmtVND(value)}</strong> },
                    { title: 'Số GD', dataIndex: 'count', align: 'right' as const },
                ]}
            />
        </PanelCard>
    );
};

const SystemTab = ({ overviewData, deepData }: { overviewData: OverviewData | null; deepData: DeepData | null }) => {
    const server = overviewData?.server;
    const memPct = pct(server?.memoryUsed, server?.memoryTotal);
    const collections = Object.entries(overviewData?.collections || {}).sort((a, b) => b[1] - a[1]);

    return (
        <div className="panel-stack">
            <div className="panel-kpi-grid four">
                <MetricCard icon={Server} tone="teal" label="Server Status" value="Online" meta={server?.hostname || 'runtime'} />
                <MetricCard icon={Clock} tone="blue" label="Uptime" value={server?.uptimeFormatted || 'Chưa có'} meta={server?.nodeVersion || 'Node.js'} />
                <MetricCard icon={Cpu} tone="amber" label="CPU Cores" value={fmtNum(server?.cpus || 0)} meta={server?.platform || 'platform'} />
                <MetricCard icon={HardDrive} tone={memPct >= 80 ? 'rose' : 'slate'} label="Heap Memory" value={`${memPct}%`} meta={`${server?.memoryUsed || 0}MB / ${server?.memoryTotal || 0}MB`} />
            </div>
            <div className="panel-grid-2">
                <PanelCard title="Server information" subtitle="Thông tin runtime hiện tại">
                    <ConfigGrid
                        items={[
                            ['Hostname', server?.hostname || 'Chưa có'],
                            ['Platform', server?.platform || 'Chưa có'],
                            ['Node.js', server?.nodeVersion || 'Chưa có'],
                            ['System RAM', `${Math.max(0, (server?.totalRAM || 0) - (server?.freeRAM || 0))}GB / ${server?.totalRAM || 0}GB used`],
                            ['AI model', overviewData?.ai?.model || 'Chưa có'],
                            ['AI API', overviewData?.ai?.apiUrl || 'Chưa có'],
                        ]}
                    />
                </PanelCard>
                <PanelCard title="Module snapshot" subtitle="Dữ liệu nghiệp vụ mở rộng">
                    <div className="snapshot-grid">
                        <MetricLine label="Orders" value={fmtNum(deepData?.orders?.total || 0)} icon={CreditCard} tone="blue" />
                        <MetricLine label="Leads mới" value={fmtNum(deepData?.leads?.new || 0)} icon={Target} tone="amber" />
                        <MetricLine label="Zalo messages" value={fmtNum(deepData?.zalo?.messages || 0)} icon={Globe} tone="teal" />
                        <MetricLine label="Paid invoices" value={`${fmtNum(deepData?.subscriptions?.paidInvoices || 0)}/${fmtNum(deepData?.subscriptions?.invoices || 0)}`} icon={Receipt} tone="violet" />
                    </div>
                </PanelCard>
            </div>
            <PanelCard title="Database collections" subtitle="Số lượng records theo model chính">
                <div className="collection-grid">
                    {collections.map(([key, value]) => (
                        <div className="collection-cell" key={key}>
                            <span>{key}</span>
                            <strong>{fmtNum(value)}</strong>
                        </div>
                    ))}
                </div>
            </PanelCard>
        </div>
    );
};

const TrafficTab = ({ trafficData }: { trafficData: TrafficData | null }) => {
    const memory = trafficData?.memory;
    const disk = trafficData?.disk;
    return (
        <div className="panel-stack">
            <div className="panel-kpi-grid four">
                <MetricCard icon={Cpu} tone="blue" label="CPU Usage" value={`${trafficData?.cpu?.usagePercent || 0}%`} meta={`${trafficData?.cpu?.cores || 0} cores`} />
                <MetricCard icon={HardDrive} tone="amber" label="RAM Usage" value={`${memory?.usedPercent || 0}%`} meta={`${bytesToGb(memory?.used)} / ${bytesToGb(memory?.total)}`} />
                <MetricCard icon={Database} tone="violet" label="Disk Usage" value={`${disk?.usedPercent || 0}%`} meta={`${bytesToGb(disk?.used)} / ${bytesToGb(disk?.total)}`} />
                <MetricCard icon={Globe} tone="teal" label="Connections" value={fmtNum(trafficData?.network?.connections || 0)} meta="Realtime monitor" />
            </div>
            <div className="panel-grid-2">
                <PanelCard title="System performance" subtitle={trafficData?.cpu?.model || 'Realtime Node.js metrics'}>
                    <ProgressLine label="CPU" value={trafficData?.cpu?.usagePercent || 0} tone="blue" />
                    <ProgressLine label="RAM" value={memory?.usedPercent || 0} tone={(memory?.usedPercent || 0) >= 80 ? 'rose' : 'amber'} />
                    <ProgressLine label="Disk" value={disk?.usedPercent || 0} tone="violet" />
                    <ConfigGrid
                        items={[
                            ['Uptime', trafficData?.uptimeFormatted || 'Chưa có'],
                            ['CPU cores', fmtNum(trafficData?.cpu?.cores || 0)],
                            ['RAM free', bytesToGb(memory?.free)],
                        ]}
                    />
                </PanelCard>
                <PanelCard title="Network traffic" subtitle="Bandwidth hiện tại">
                    <div className="network-grid">
                        <div className="network-card in">
                            <ArrowDownLeft size={24} />
                            <span>Downstream</span>
                            <strong>{((trafficData?.network?.rxSec || 0) / 1024).toFixed(2)} KB/s</strong>
                        </div>
                        <div className="network-card out">
                            <ArrowUpRight size={24} />
                            <span>Upstream</span>
                            <strong>{((trafficData?.network?.txSec || 0) / 1024).toFixed(2)} KB/s</strong>
                        </div>
                    </div>
                </PanelCard>
            </div>
        </div>
    );
};

const CronTab = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const rows = [
        { name: 'Auto Bank Check', desc: 'Kiểm tra giao dịch ngân hàng và xác nhận thanh toán.', url: `${origin}/api/bank/transactions`, interval: '5 phút', active: true },
        { name: 'Health Check', desc: 'Theo dõi endpoint health của hệ thống.', url: `${origin}/api/health`, interval: '1 phút', active: true },
        { name: 'Session Watchdog', desc: 'Giám sát và khôi phục phiên remote.', url: `${origin}/api/admin/zalo-health`, interval: '10 phút', active: true },
        { name: 'SLA Monitor', desc: 'Kiểm tra SLA và gửi cảnh báo vận hành.', url: `${origin}/api/admin/sla-check`, interval: '5 phút', active: false },
    ];

    return (
        <div className="panel-stack">
            <PanelCard title="Cron Link quản lý" subtitle="Các endpoint nên đưa vào monitor ngoài">
                <div className="cron-list">
                    {rows.map((row) => (
                        <div className="cron-row" key={row.name}>
                            <div className={`direction-icon ${row.active ? 'in' : 'idle'}`}>{row.active ? <Play size={15} /> : <Pause size={15} />}</div>
                            <div className="cron-main">
                                <div>
                                    <strong>{row.name}</strong>
                                    <Tag color={row.active ? 'green' : 'default'}>{row.active ? 'Active' : 'Inactive'}</Tag>
                                    <span><Timer size={12} />{row.interval}</span>
                                </div>
                                <p>{row.desc}</p>
                                <div className="copy-line">
                                    <Link2 size={13} />
                                    <span>{row.url}</span>
                                    <button className="panel-ghost-button" onClick={() => copyText(row.url)}>
                                        <Copy size={13} />
                                        Copy
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </PanelCard>

            <PanelCard title="Dịch vụ monitor phù hợp" subtitle="Một số lựa chọn ngoài hệ thống">
                <div className="service-grid">
                    {[
                        ['cron-job.org', 'Hỗ trợ lịch chạy ngắn, dễ cấu hình', 'https://cron-job.org'],
                        ['UptimeRobot', 'Phù hợp health check và cảnh báo uptime', 'https://uptimerobot.com'],
                        ['EasyCron', 'Giao diện đơn giản cho cron HTTP', 'https://easycron.com'],
                    ].map(([name, desc, url]) => (
                        <a className="service-link" key={name} href={url} target="_blank" rel="noopener noreferrer">
                            <div>
                                <strong>{name}</strong>
                                <span>{desc}</span>
                            </div>
                            <ExternalLink size={15} />
                        </a>
                    ))}
                </div>
            </PanelCard>
        </div>
    );
};

type SettingsSubTab = 'general' | 'support_widget' | 'ai' | 'smtp' | 'telegram' | 'facebook' | 'zalo' | 'recaptcha' | 'google_oauth';
type AIProviderMode = 'auto' | 'ollama' | 'openai';
type SettingsTestState = {
    tone: 'success' | 'error';
    message: string;
    latency?: number;
};

interface AIHealthState {
    status: 'online' | 'degraded' | 'offline';
    provider: 'ollama' | 'openai';
    model: string;
    baseUrl: string;
    latency: number;
    models: Array<{ id: string; owned_by?: string }>;
    message?: string;
}

interface FacebookConfigStatus {
    enabled: boolean;
    oauthReady: boolean;
    webhookReady: boolean;
    redirectUri: string;
    webhookUrl: string;
    missing: string[];
}

interface ZaloConnectorStatus {
    connector: string;
    officialApi: boolean;
    apiCredentialsRequired: boolean;
    enabled: boolean;
    autoReconnect: boolean;
    noticeAccepted: boolean;
    accounts: number;
    activeAccounts: number;
}

const isMaskedSetting = (value?: string) => Boolean(value && (value.includes('••••') || /^\*{4,}/.test(value)));
const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
const isValidTelegramChatId = (value: string) => /^-?\d+$/.test(value.trim()) || /^@[A-Za-z0-9_]{5,}$/.test(value.trim());
const getSettingsError = (error: unknown, fallback: string) => {
    const responseError = (error as { response?: { data?: { error?: string; message?: string } } })?.response?.data;
    return responseError?.error || responseError?.message || fallback;
};
const normalizeSupportApiBase = (value: string) => value.trim().replace(/\/api\/?$/, '').replace(/\/+$/, '');

const SettingsTab = () => {
    const [subTab, setSubTab] = useState<SettingsSubTab>('general');
    const [loadingSettings, setLoadingSettings] = useState(true);
    const [saving, setSaving] = useState(false);
    const [recaptchaEnabled, setRecaptchaEnabled] = useState(false);
    const [recaptchaSiteKey, setRecaptchaSiteKey] = useState('');
    const [recaptchaSecretKey, setRecaptchaSecretKey] = useState('');
    const [googleEnabled, setGoogleEnabled] = useState(true);
    const [googleClientId, setGoogleClientId] = useState('');
    const [googleClientSecret, setGoogleClientSecret] = useState('');
    const [googleCallbackUrl, setGoogleCallbackUrl] = useState('');
    const [aiProvider, setAiProvider] = useState<AIProviderMode>('ollama');
    const [aiOpenAIKey, setAiOpenAIKey] = useState('');
    const [aiOpenAIModel, setAiOpenAIModel] = useState('gpt-5');
    const [aiOllamaBaseUrl, setAiOllamaBaseUrl] = useState('http://127.0.0.1:11434');
    const [aiOllamaModel, setAiOllamaModel] = useState('qwen2.5:7b');
    const [aiGatewayToken, setAiGatewayToken] = useState('');
    const [aiHealth, setAiHealth] = useState<AIHealthState | null>(null);
    const [checkingAI, setCheckingAI] = useState(false);
    const [smtpEnabled, setSmtpEnabled] = useState(false);
    const [smtpHost, setSmtpHost] = useState('');
    const [smtpPort, setSmtpPort] = useState('587');
    const [smtpSecure, setSmtpSecure] = useState(false);
    const [smtpUsername, setSmtpUsername] = useState('');
    const [smtpPassword, setSmtpPassword] = useState('');
    const [smtpPasswordConfigured, setSmtpPasswordConfigured] = useState(false);
    const [smtpFromName, setSmtpFromName] = useState('NemarkChat');
    const [smtpFromEmail, setSmtpFromEmail] = useState('');
    const [smtpTestRecipient, setSmtpTestRecipient] = useState('');
    const [testingSmtp, setTestingSmtp] = useState<'connection' | 'send' | null>(null);
    const [smtpTestState, setSmtpTestState] = useState<SettingsTestState | null>(null);
    const [telegramEnabled, setTelegramEnabled] = useState(false);
    const [telegramBotToken, setTelegramBotToken] = useState('');
    const [telegramTokenConfigured, setTelegramTokenConfigured] = useState(false);
    const [telegramChatId, setTelegramChatId] = useState('');
    const [telegramNotifyNewWorkspace, setTelegramNotifyNewWorkspace] = useState(true);
    const [telegramNotifyPayment, setTelegramNotifyPayment] = useState(true);
    const [telegramNotifySystemError, setTelegramNotifySystemError] = useState(true);
    const [telegramTestMessage, setTelegramTestMessage] = useState('NemarkChat đã kết nối Telegram thành công.');
    const [testingTelegram, setTestingTelegram] = useState(false);
    const [telegramTestState, setTelegramTestState] = useState<SettingsTestState | null>(null);
    const [supportWidgetEnabled, setSupportWidgetEnabled] = useState(true);
    const [supportWorkspaceId, setSupportWorkspaceId] = useState('');
    const [supportWidgetId, setSupportWidgetId] = useState('');
    const [supportWidgetApiBase, setSupportWidgetApiBase] = useState('https://nemarkchat.com');
    const [supportWorkspaces, setSupportWorkspaces] = useState<WorkspaceRow[]>([]);
    const [supportWidgets, setSupportWidgets] = useState<SupportWidgetRow[]>([]);
    const [loadingSupportWidgets, setLoadingSupportWidgets] = useState(false);
    const [facebookEnabled, setFacebookEnabled] = useState(true);
    const [facebookAppId, setFacebookAppId] = useState('');
    const [facebookAppSecret, setFacebookAppSecret] = useState('');
    const [facebookAppSecretConfigured, setFacebookAppSecretConfigured] = useState(false);
    const [facebookVerifyToken, setFacebookVerifyToken] = useState('');
    const [facebookVerifyTokenConfigured, setFacebookVerifyTokenConfigured] = useState(false);
    const [facebookRedirectUri, setFacebookRedirectUri] = useState('https://nemarkchat.com/api/facebook/callback');
    const [facebookStatus, setFacebookStatus] = useState<FacebookConfigStatus | null>(null);
    const [zaloEnabled, setZaloEnabled] = useState(true);
    const [zaloAutoReconnect, setZaloAutoReconnect] = useState(true);
    const [zaloNoticeAccepted, setZaloNoticeAccepted] = useState(false);
    const [zaloStatus, setZaloStatus] = useState<ZaloConnectorStatus | null>(null);
    const [loadingChannelStatus, setLoadingChannelStatus] = useState(false);

    const refreshChannelStatus = useCallback(async (showToast = false) => {
        setLoadingChannelStatus(true);
        try {
            const [facebookRes, zaloRes] = await Promise.all([
                httpClient.get('/admin/settings/facebook/status'),
                httpClient.get('/admin/settings/zalo/status'),
            ]);
            const nextFacebookStatus = facebookRes.data?.data as FacebookConfigStatus;
            const nextZaloStatus = zaloRes.data?.data as ZaloConnectorStatus;
            setFacebookStatus(nextFacebookStatus);
            setZaloStatus(nextZaloStatus);
            if (showToast) message.success('Đã làm mới trạng thái Facebook và Zalo');
        } catch {
            if (showToast) message.error('Không tải được trạng thái kênh');
        } finally {
            setLoadingChannelStatus(false);
        }
    }, []);

    const refreshAIHealth = useCallback(async (showToast = false) => {
        setCheckingAI(true);
        try {
            const res = await httpClient.get('/admin/ai/health');
            const health = res.data?.data as AIHealthState;
            setAiHealth(health);
            if (showToast) {
                if (health.status === 'online') message.success(`AI ${health.provider} hoạt động (${health.latency}ms)`);
                else message.warning(health.message || 'AI provider chưa sẵn sàng');
            }
        } catch {
            setAiHealth({
                status: 'offline',
                provider: 'ollama',
                model: 'Chưa xác định',
                baseUrl: '',
                latency: -1,
                models: [],
                message: 'Không gọi được API kiểm tra AI',
            });
            if (showToast) message.error('Không kiểm tra được AI provider');
        } finally {
            setCheckingAI(false);
        }
    }, []);

    useEffect(() => {
        const loadSettings = async () => {
            setLoadingSettings(true);
            try {
                const res = await httpClient.get('/admin/settings');
                if (res.data?.success) {
                    const settings = res.data.data as Record<string, string>;
                    setRecaptchaEnabled(settings.recaptcha_enabled === 'true');
                    setRecaptchaSiteKey(settings.recaptcha_site_key || '');
                    setRecaptchaSecretKey(settings.recaptcha_secret_key || '');
                    setGoogleEnabled((settings.google_auth_enabled ?? 'true') === 'true');
                    setGoogleClientId(settings.google_client_id || '');
                    setGoogleClientSecret(settings.google_client_secret || '');
                    setGoogleCallbackUrl(settings.google_callback_url || '');
                    const provider = settings.ai_provider;
                    setAiProvider(provider === 'auto' || provider === 'openai' || provider === 'ollama' ? provider : 'ollama');
                    setAiOpenAIKey(settings.ai_openai_api_key || '');
                    setAiOpenAIModel(settings.ai_openai_model || 'gpt-5');
                    setAiOllamaBaseUrl(settings.ai_ollama_base_url || 'http://127.0.0.1:11434');
                    setAiOllamaModel(settings.ai_ollama_model || 'qwen2.5:7b');
                    setAiGatewayToken(settings.ai_gateway_token || '');
                    setSmtpEnabled(settings.smtp_enabled === 'true');
                    setSmtpHost(settings.smtp_host || '');
                    setSmtpPort(settings.smtp_port || '587');
                    setSmtpSecure(settings.smtp_secure === 'true');
                    setSmtpUsername(settings.smtp_username || '');
                    setSmtpPasswordConfigured(Boolean(settings.smtp_password) || settings.smtp_password_configured === 'true');
                    setSmtpPassword('');
                    setSmtpFromName(settings.smtp_from_name || 'NemarkChat');
                    setSmtpFromEmail(settings.smtp_from_email || '');
                    setSmtpTestRecipient(settings.smtp_from_email || '');
                    setTelegramEnabled(settings.telegram_enabled === 'true');
                    setTelegramTokenConfigured(Boolean(settings.telegram_bot_token) || settings.telegram_bot_token_configured === 'true');
                    setTelegramBotToken('');
                    setTelegramChatId(settings.telegram_chat_id || '');
                    setTelegramNotifyNewWorkspace((settings.telegram_notify_new_workspace ?? 'true') === 'true');
                    setTelegramNotifyPayment((settings.telegram_notify_payment ?? 'true') === 'true');
                    setTelegramNotifySystemError((settings.telegram_notify_system_error ?? 'true') === 'true');
                    setSupportWidgetEnabled((settings.system_support_widget_enabled ?? 'true') === 'true');
                    setSupportWorkspaceId(settings.system_support_workspace_id || '');
                    setSupportWidgetId(settings.system_support_widget_id || '');
                    setSupportWidgetApiBase(normalizeSupportApiBase(settings.system_support_widget_api_base || 'https://nemarkchat.com'));
                    setFacebookEnabled((settings.facebook_enabled ?? 'true') === 'true');
                    setFacebookAppId(settings.facebook_app_id || '');
                    setFacebookAppSecretConfigured(Boolean(settings.facebook_app_secret));
                    setFacebookAppSecret('');
                    setFacebookVerifyTokenConfigured(Boolean(settings.facebook_verify_token));
                    setFacebookVerifyToken('');
                    setFacebookRedirectUri(settings.facebook_redirect_uri || 'https://nemarkchat.com/api/facebook/callback');
                    setZaloEnabled((settings.zalo_personal_enabled ?? 'true') === 'true');
                    setZaloAutoReconnect((settings.zalo_auto_reconnect ?? 'true') === 'true');
                    setZaloNoticeAccepted(settings.zalo_connector_notice_accepted === 'true');
                }
                const workspaceRes = await httpClient.get('/admin/workspaces');
                if (workspaceRes.data?.success) {
                    setSupportWorkspaces(workspaceRes.data.data || []);
                }
            } catch {
                message.warning('Không tải được cấu hình hệ thống');
            } finally {
                setLoadingSettings(false);
            }
        };
        loadSettings();
        refreshAIHealth();
        refreshChannelStatus();
    }, [refreshAIHealth, refreshChannelStatus]);

    useEffect(() => {
        if (!supportWorkspaceId) {
            setSupportWidgets([]);
            return;
        }

        let cancelled = false;
        const loadWidgets = async () => {
            setLoadingSupportWidgets(true);
            try {
                const res = await httpClient.get(`/admin/workspaces/${supportWorkspaceId}/widgets`);
                if (cancelled) return;
                const rows = (res.data?.data || []) as SupportWidgetRow[];
                setSupportWidgets(rows);
                if (rows.length > 0 && !rows.some((widget) => widget.id === supportWidgetId)) {
                    setSupportWidgetId(rows[0].id);
                }
            } catch {
                if (!cancelled) {
                    setSupportWidgets([]);
                    message.warning('Không tải được danh sách widget của workspace');
                }
            } finally {
                if (!cancelled) setLoadingSupportWidgets(false);
            }
        };

        void loadWidgets();
        return () => {
            cancelled = true;
        };
    }, [supportWorkspaceId, supportWidgetId]);

    const saveSettings = async (payload: Record<string, string>, successMessage: string) => {
        setSaving(true);
        try {
            await httpClient.put('/admin/settings', payload);
            message.success(successMessage);
            return true;
        } catch {
            message.error('Lỗi lưu cài đặt');
            return false;
        } finally {
            setSaving(false);
        }
    };

    const supportWidgetSnippet = useMemo(() => {
        const apiBase = normalizeSupportApiBase(supportWidgetApiBase || 'https://nemarkchat.com');
        if (!supportWidgetId) return '';
        return `<script src="${apiBase}/widget/loader.js" data-widget-id="${supportWidgetId}" data-api-base="${apiBase}" async></script>`;
    }, [supportWidgetApiBase, supportWidgetId]);

    const selectedSupportWorkspace = supportWorkspaces.find((workspace) => workspace.id === supportWorkspaceId);
    const selectedSupportWidget = supportWidgets.find((widget) => widget.id === supportWidgetId);

    const copySupportSnippet = async (value: string, successText: string) => {
        if (!value) {
            message.warning('Chưa có nội dung để copy.');
            return;
        }
        try {
            await navigator.clipboard.writeText(value);
            message.success(successText);
        } catch {
            message.error('Trình duyệt chưa cho phép copy tự động, bạn copy thủ công giúp mình nhé.');
        }
    };

    const saveSupportWidgetSettings = async () => {
        if (supportWidgetEnabled && (!supportWorkspaceId || !supportWidgetId)) {
            message.warning('Chọn workspace và widget CSKH trước khi bật cấu hình.');
            return;
        }

        await saveSettings({
            system_support_widget_enabled: supportWidgetEnabled ? 'true' : 'false',
            system_support_workspace_id: supportWorkspaceId,
            system_support_widget_id: supportWidgetId,
            system_support_widget_api_base: normalizeSupportApiBase(supportWidgetApiBase || 'https://nemarkchat.com'),
        }, 'Đã lưu widget CSKH hệ thống');
    };

    const saveAISettings = async () => {
        const saved = await saveSettings({
            ai_provider: aiProvider,
            ai_openai_api_key: aiOpenAIKey,
            ai_openai_model: aiOpenAIModel.trim() || 'gpt-5',
            ai_ollama_base_url: aiOllamaBaseUrl.trim() || 'http://127.0.0.1:11434',
            ai_ollama_model: aiOllamaModel.trim() || 'qwen2.5:7b',
            ai_gateway_token: aiGatewayToken,
        }, 'Đã lưu cấu hình AI Gateway');
        if (saved) await refreshAIHealth(true);
    };

    const generateGatewayToken = () => {
        const bytes = window.crypto.getRandomValues(new Uint8Array(32));
        setAiGatewayToken(Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join(''));
    };

    const smtpSettingsPayload = () => {
        const payload: Record<string, string> = {
            smtp_enabled: smtpEnabled ? 'true' : 'false',
            smtp_host: smtpHost.trim(),
            smtp_port: smtpPort.trim(),
            smtp_secure: smtpSecure ? 'true' : 'false',
            smtp_username: smtpUsername.trim(),
            smtp_from_name: smtpFromName.trim(),
            smtp_from_email: smtpFromEmail.trim(),
        };
        if (smtpPassword.trim() && !isMaskedSetting(smtpPassword)) payload.smtp_password = smtpPassword;
        return payload;
    };

    const validateSmtp = (requireRecipient = false) => {
        const port = Number(smtpPort);
        if (!smtpHost.trim()) return 'Nhập SMTP host trước khi tiếp tục.';
        if (!Number.isInteger(port) || port < 1 || port > 65535) return 'SMTP port phải là số từ 1 đến 65535.';
        if (!smtpFromEmail.trim() || !isValidEmail(smtpFromEmail)) return 'Email người gửi chưa đúng định dạng.';
        if (smtpUsername.trim() && !smtpPasswordConfigured && !smtpPassword.trim()) return 'Nhập mật khẩu SMTP cho tài khoản này.';
        if (smtpPassword.trim() && !smtpUsername.trim()) return 'Nhập username tương ứng với mật khẩu SMTP.';
        if (requireRecipient && !isValidEmail(smtpTestRecipient)) return 'Nhập email nhận thử hợp lệ.';
        return null;
    };

    const saveSmtpSettings = async () => {
        if (smtpEnabled) {
            const validation = validateSmtp();
            if (validation) {
                message.warning(validation);
                return;
            }
        }
        const saved = await saveSettings(smtpSettingsPayload(), 'Đã lưu cấu hình Email SMTP');
        if (saved && smtpPassword.trim()) {
            setSmtpPasswordConfigured(true);
            setSmtpPassword('');
        }
    };

    const testSmtp = async (mode: 'connection' | 'send') => {
        const validation = validateSmtp(mode === 'send');
        if (validation) {
            message.warning(validation);
            return;
        }
        setTestingSmtp(mode);
        setSmtpTestState(null);
        try {
            const startedAt = Date.now();
            const res = await httpClient.post('/admin/settings/smtp/test', {
                mode,
                recipient: mode === 'send' ? smtpTestRecipient.trim() : undefined,
                config: {
                    host: smtpHost.trim(),
                    port: Number(smtpPort),
                    secure: smtpSecure,
                    username: smtpUsername.trim(),
                    password: smtpPassword || undefined,
                    fromName: smtpFromName.trim(),
                    fromEmail: smtpFromEmail.trim(),
                },
            });
            const latency = Number(res.data?.data?.latency ?? Date.now() - startedAt);
            const resultMessage = res.data?.message || (mode === 'send' ? 'Đã gửi email kiểm tra.' : 'Kết nối SMTP thành công.');
            setSmtpTestState({ tone: 'success', message: resultMessage, latency });
            message.success(resultMessage);
        } catch (error: unknown) {
            const resultMessage = getSettingsError(error, 'Không thể kết nối SMTP. Kiểm tra host, port và tài khoản.');
            setSmtpTestState({ tone: 'error', message: resultMessage });
            message.error(resultMessage);
        } finally {
            setTestingSmtp(null);
        }
    };

    const telegramSettingsPayload = () => {
        const payload: Record<string, string> = {
            telegram_enabled: telegramEnabled ? 'true' : 'false',
            telegram_chat_id: telegramChatId.trim(),
            telegram_notify_new_workspace: telegramNotifyNewWorkspace ? 'true' : 'false',
            telegram_notify_payment: telegramNotifyPayment ? 'true' : 'false',
            telegram_notify_system_error: telegramNotifySystemError ? 'true' : 'false',
        };
        if (telegramBotToken.trim() && !isMaskedSetting(telegramBotToken)) payload.telegram_bot_token = telegramBotToken.trim();
        return payload;
    };

    const validateTelegram = () => {
        if (!telegramTokenConfigured && !telegramBotToken.trim()) return 'Nhập Bot Token do @BotFather cung cấp.';
        if (telegramBotToken.trim() && !/^\d+:[A-Za-z0-9_-]{20,}$/.test(telegramBotToken.trim())) return 'Bot Token chưa đúng định dạng Telegram.';
        if (!telegramChatId.trim() || !isValidTelegramChatId(telegramChatId)) return 'Chat ID phải là số (có thể âm với nhóm) hoặc @channel_username.';
        return null;
    };

    const saveTelegramSettings = async () => {
        if (telegramEnabled) {
            const validation = validateTelegram();
            if (validation) {
                message.warning(validation);
                return;
            }
        }
        const saved = await saveSettings(telegramSettingsPayload(), 'Đã lưu cấu hình Telegram');
        if (saved && telegramBotToken.trim()) {
            setTelegramTokenConfigured(true);
            setTelegramBotToken('');
        }
    };

    const testTelegram = async () => {
        const validation = validateTelegram();
        if (validation) {
            message.warning(validation);
            return;
        }
        if (!telegramTestMessage.trim()) {
            message.warning('Nhập nội dung tin nhắn thử.');
            return;
        }
        setTestingTelegram(true);
        setTelegramTestState(null);
        try {
            const startedAt = Date.now();
            const res = await httpClient.post('/admin/settings/telegram/test', {
                message: telegramTestMessage.trim(),
                config: {
                    botToken: telegramBotToken || undefined,
                    chatId: telegramChatId.trim(),
                },
            });
            const latency = Number(res.data?.data?.latency ?? Date.now() - startedAt);
            const resultMessage = res.data?.message || 'Đã gửi tin nhắn thử tới Telegram.';
            setTelegramTestState({ tone: 'success', message: resultMessage, latency });
            message.success(resultMessage);
        } catch (error: unknown) {
            const resultMessage = getSettingsError(error, 'Không gửi được Telegram. Kiểm tra Bot Token, Chat ID và quyền của bot.');
            setTelegramTestState({ tone: 'error', message: resultMessage });
            message.error(resultMessage);
        } finally {
            setTestingTelegram(false);
        }
    };

    const generateFacebookVerifyToken = () => {
        const bytes = window.crypto.getRandomValues(new Uint8Array(24));
        setFacebookVerifyToken(Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join(''));
    };

    const saveFacebookSettings = async () => {
        if (facebookEnabled) {
            if (!facebookAppId.trim()) {
                message.warning('Nhập Facebook App ID trước khi bật kết nối.');
                return;
            }
            if (!facebookAppSecretConfigured && !facebookAppSecret.trim()) {
                message.warning('Nhập Facebook App Secret trước khi bật kết nối.');
                return;
            }
            if (!facebookVerifyTokenConfigured && !facebookVerifyToken.trim()) {
                message.warning('Tạo Facebook Verify Token trước khi bật webhook.');
                return;
            }
        }
        const payload: Record<string, string> = {
            facebook_enabled: facebookEnabled ? 'true' : 'false',
            facebook_app_id: facebookAppId.trim(),
            facebook_redirect_uri: facebookRedirectUri.trim() || 'https://nemarkchat.com/api/facebook/callback',
        };
        if (facebookAppSecret.trim()) payload.facebook_app_secret = facebookAppSecret.trim();
        if (facebookVerifyToken.trim()) payload.facebook_verify_token = facebookVerifyToken.trim();
        const saved = await saveSettings(payload, 'Đã lưu cấu hình Facebook hệ thống');
        if (saved) {
            if (facebookAppSecret.trim()) setFacebookAppSecretConfigured(true);
            if (facebookVerifyToken.trim()) setFacebookVerifyTokenConfigured(true);
            setFacebookAppSecret('');
            setFacebookVerifyToken('');
            await refreshChannelStatus();
        }
    };

    const saveZaloSettings = async () => {
        if (zaloEnabled && !zaloNoticeAccepted) {
            message.warning('Bạn cần xác nhận đã hiểu connector Zalo cá nhân trước khi bật.');
            return;
        }
        const saved = await saveSettings({
            zalo_personal_enabled: zaloEnabled ? 'true' : 'false',
            zalo_auto_reconnect: zaloAutoReconnect ? 'true' : 'false',
            zalo_connector_notice_accepted: zaloNoticeAccepted ? 'true' : 'false',
        }, 'Đã lưu cấu hình Zalo cá nhân');
        if (saved) await refreshChannelStatus();
    };

    if (loadingSettings) {
        return <div className="panel-loading"><Spin size="large" /></div>;
    }

    return (
        <div className="panel-stack">
            <div className="segmented-tabs">
                {[
                    { key: 'general' as const, label: 'Thông tin chung' },
                    { key: 'support_widget' as const, label: 'Livechat hệ thống' },
                    { key: 'ai' as const, label: 'AI Gateway' },
                    { key: 'smtp' as const, label: 'Email SMTP' },
                    { key: 'telegram' as const, label: 'Telegram' },
                    { key: 'facebook' as const, label: 'Facebook' },
                    { key: 'zalo' as const, label: 'Zalo' },
                    { key: 'recaptcha' as const, label: 'reCAPTCHA' },
                    { key: 'google_oauth' as const, label: 'Google OAuth' },
                ].map((item) => (
                    <button key={item.key} className={subTab === item.key ? 'active' : ''} onClick={() => setSubTab(item.key)}>
                        {item.label}
                    </button>
                ))}
            </div>

            {subTab === 'general' && (
                <div className="panel-grid-2">
                    <PanelCard title="Thông tin hệ thống" subtitle="Cấu hình chung">
                        <ConfigGrid
                            items={[
                                ['Tên hệ thống', 'NemarkChat'],
                                ['Phiên bản', 'v3.0.0'],
                                ['Ngôn ngữ', 'Tiếng Việt'],
                                ['Múi giờ', 'Asia/Ho_Chi_Minh'],
                                ['Hotline', '0964 543 556'],
                                ['Email hỗ trợ', 'support@nemarkchat.com'],
                            ]}
                        />
                    </PanelCard>
                    <PanelCard title="Trạng thái dịch vụ" subtitle="Bật tắt các lớp đăng nhập và bảo vệ">
                        <div className="service-state-list">
                            {[
                                ['Google OAuth', googleEnabled],
                                ['reCAPTCHA', recaptchaEnabled],
                                ['Auto Bank MB', true],
                                ['ACB Revenue', true],
                                ['Zalo Integration', Boolean(zaloStatus?.enabled && zaloStatus?.noticeAccepted)],
                                ['Facebook Integration', Boolean(facebookStatus?.oauthReady && facebookStatus?.webhookReady)],
                                ['AI Auto-response', aiHealth?.status === 'online'],
                                ['Livechat hệ thống', supportWidgetEnabled && Boolean(supportWorkspaceId && supportWidgetId)],
                                ['Email SMTP', smtpEnabled && Boolean(smtpHost && smtpFromEmail)],
                                ['Telegram cảnh báo', telegramEnabled && telegramTokenConfigured && Boolean(telegramChatId)],
                            ].map(([label, enabled]) => (
                                <div className="service-state-row" key={String(label)}>
                                    <span><i className={enabled ? 'ok' : 'off'} />{label}</span>
                                    <Tag color={enabled ? 'green' : 'red'}>{enabled ? 'Đang bật' : 'Đang tắt'}</Tag>
                                </div>
                            ))}
                        </div>
                    </PanelCard>
                </div>
            )}

            {subTab === 'support_widget' && (
                <div className="panel-grid-2 communications-settings-grid">
                    <PanelCard
                        title="Livechat CSKH hệ thống"
                        subtitle="Dùng một widget nội bộ làm kênh hỗ trợ chung cho landing, panel admin và các trang vận hành của NemarkChat"
                        actions={
                            <Tag color={supportWidgetEnabled ? (supportWorkspaceId && supportWidgetId ? 'green' : 'orange') : 'default'}>
                                {supportWidgetEnabled ? (supportWorkspaceId && supportWidgetId ? 'Đã bật' : 'Thiếu cấu hình') : 'Đang tắt'}
                            </Tag>
                        }
                    >
                        <div className="settings-form">
                            <div className="settings-toggle-row">
                                <div>
                                    <strong>Bật livechat hệ thống</strong>
                                    <span>Landing sẽ tự đọc cấu hình này qua endpoint public, không cần sửa code mỗi lần đổi widget.</span>
                                </div>
                                <Switch checked={supportWidgetEnabled} onChange={setSupportWidgetEnabled} checkedChildren="ON" unCheckedChildren="OFF" />
                            </div>

                            <label>Workspace CSKH nội bộ</label>
                            <Select
                                showSearch
                                value={supportWorkspaceId || undefined}
                                onChange={(value) => {
                                    setSupportWorkspaceId(value);
                                    setSupportWidgetId('');
                                }}
                                placeholder="Chọn workspace dùng để nhận chat hỗ trợ"
                                optionFilterProp="label"
                                options={supportWorkspaces.map((workspace) => ({
                                    value: workspace.id,
                                    label: `${workspace.name || workspace.slug || workspace.id}${workspace.isActive === false ? ' · inactive' : ''}`,
                                }))}
                            />

                            <label>Widget website</label>
                            <Select
                                showSearch
                                loading={loadingSupportWidgets}
                                value={supportWidgetId || undefined}
                                onChange={setSupportWidgetId}
                                disabled={!supportWorkspaceId}
                                placeholder={supportWorkspaceId ? 'Chọn widget để nhúng landing/panel' : 'Chọn workspace trước'}
                                optionFilterProp="label"
                                options={supportWidgets.map((widget) => ({
                                    value: widget.id,
                                    label: `${widget.name || widget.id}${widget.isActive === false ? ' · inactive' : ''}`,
                                }))}
                            />

                            <label>API/Base URL widget</label>
                            <Input
                                value={supportWidgetApiBase}
                                onChange={(event) => setSupportWidgetApiBase(event.target.value)}
                                placeholder="https://nemarkchat.com"
                            />
                            <span className="settings-field-help">Nhập domain gốc, ví dụ <code>https://nemarkchat.com</code>. Hệ thống tự bỏ phần <code>/api</code> nếu bạn dán nhầm.</span>

                            <div className="support-widget-preview">
                                <div>
                                    <span>Workspace</span>
                                    <strong>{selectedSupportWorkspace?.name || selectedSupportWorkspace?.slug || 'Chưa chọn'}</strong>
                                </div>
                                <div>
                                    <span>Widget</span>
                                    <strong>{selectedSupportWidget?.name || selectedSupportWidget?.id || 'Chưa chọn'}</strong>
                                </div>
                                <div>
                                    <span>Public config</span>
                                    <strong>{normalizeSupportApiBase(supportWidgetApiBase || 'https://nemarkchat.com')}/api/workspaces/public/system-support-widget</strong>
                                </div>
                            </div>

                            <div className="notice-box">
                                <MessageSquare size={16} />
                                <span>Nếu bật cấu hình này, landing NemarkChat sẽ ưu tiên widget được chọn. Khi chưa chọn đủ, landing fallback về biến môi trường cũ.</span>
                            </div>

                            <div className="toolbar-row">
                                <button className="panel-primary-button" disabled={saving} onClick={saveSupportWidgetSettings}>
                                    <CheckCircle size={15} />
                                    Lưu livechat hệ thống
                                </button>
                                <button
                                    className="panel-ghost-button"
                                    type="button"
                                    onClick={() => copySupportSnippet(supportWidgetSnippet, 'Đã copy snippet nhúng widget')}
                                    disabled={!supportWidgetSnippet}
                                >
                                    <Copy size={15} />
                                    Copy snippet
                                </button>
                            </div>
                        </div>
                    </PanelCard>

                    <PanelCard
                        title="Dán nhanh vào landing"
                        subtitle="Dùng khi cần nhúng thủ công ở trang ngoài hoặc kiểm tra cấu hình realtime"
                        actions={<Link2 size={18} color="#2563eb" />}
                    >
                        <div className="settings-form">
                            <label>Snippet nhúng</label>
                            <Input.TextArea value={supportWidgetSnippet || 'Chọn workspace và widget để tạo snippet'} autoSize={{ minRows: 4, maxRows: 7 }} readOnly />
                            <button
                                className="panel-ghost-button settings-wide-button"
                                type="button"
                                onClick={() => copySupportSnippet(supportWidgetSnippet, 'Đã copy snippet')}
                                disabled={!supportWidgetSnippet}
                            >
                                <Copy size={15} />
                                Copy mã nhúng
                            </button>

                            <label>Endpoint cấu hình public</label>
                            <Input
                                readOnly
                                value={`${normalizeSupportApiBase(supportWidgetApiBase || 'https://nemarkchat.com')}/api/workspaces/public/system-support-widget`}
                            />
                            <button
                                className="panel-ghost-button settings-wide-button"
                                type="button"
                                onClick={() => copySupportSnippet(`${normalizeSupportApiBase(supportWidgetApiBase || 'https://nemarkchat.com')}/api/workspaces/public/system-support-widget`, 'Đã copy endpoint public')}
                            >
                                <Copy size={15} />
                                Copy endpoint
                            </button>

                            <div className="settings-checklist">
                                <div><span>1</span><p><strong>Tạo workspace CSKH nhà mình</strong><small>Dùng để nhận mọi chat support từ landing/panel.</small></p></div>
                                <div><span>2</span><p><strong>Tạo widget trong workspace đó</strong><small>Đặt domain allow-all hoặc domain nemarkchat.com.</small></p></div>
                                <div><span>3</span><p><strong>Lưu cấu hình tại đây</strong><small>Landing tự dùng config mới, không cần build lại nếu endpoint ổn.</small></p></div>
                            </div>
                        </div>
                    </PanelCard>
                </div>
            )}

            {subTab === 'ai' && (
                <div className="panel-grid-2 ai-settings-grid">
                    <PanelCard title="AI Gateway" subtitle="Chọn provider và model dùng chung cho toàn hệ thống">
                        <div className="settings-form">
                            <label>Provider mặc định</label>
                            <Select
                                value={aiProvider}
                                onChange={(value) => setAiProvider(value as AIProviderMode)}
                                options={[
                                    { value: 'ollama', label: 'Ollama local (khuyến nghị cho máy chủ này)' },
                                    { value: 'openai', label: 'OpenAI Cloud' },
                                    { value: 'auto', label: 'Tự động: OpenAI khi có key, nếu không dùng Ollama' },
                                ]}
                            />

                            {(aiProvider === 'ollama' || aiProvider === 'auto') && (
                                <>
                                    <label>Ollama Base URL</label>
                                    <Input value={aiOllamaBaseUrl} onChange={(event) => setAiOllamaBaseUrl(event.target.value)} placeholder="http://127.0.0.1:11434" />
                                    <label>Model local</label>
                                    <Input value={aiOllamaModel} onChange={(event) => setAiOllamaModel(event.target.value)} placeholder="qwen2.5:7b" />
                                </>
                            )}

                            {(aiProvider === 'openai' || aiProvider === 'auto') && (
                                <>
                                    <label>OpenAI API key</label>
                                    <Input.Password value={aiOpenAIKey} onChange={(event) => setAiOpenAIKey(event.target.value)} placeholder="sk-..." />
                                    <label>OpenAI model</label>
                                    <Input value={aiOpenAIModel} onChange={(event) => setAiOpenAIModel(event.target.value)} placeholder="gpt-5" />
                                </>
                            )}

                            <label>Bearer token bảo vệ API `/v1`</label>
                            <div className="settings-secret-row">
                                <Input.Password value={aiGatewayToken} onChange={(event) => setAiGatewayToken(event.target.value)} placeholder="Tạo token trước khi mở gateway cho client ngoài" />
                                <Tooltip title="Tạo token ngẫu nhiên 256-bit">
                                    <button className="panel-ghost-button" type="button" onClick={generateGatewayToken}>
                                        <Zap size={15} />
                                        Tạo token
                                    </button>
                                </Tooltip>
                            </div>

                            <div className="notice-box">
                                <Shield size={16} />
                                <span>Workspace gọi `https://api.nemarkchat.com/v1`; backend tự chuyển sang provider đã chọn. Secret được che khi đọc lại và không gửi xuống client workspace.</span>
                            </div>

                            <div className="toolbar-row">
                                <button className="panel-primary-button" disabled={saving} onClick={saveAISettings}>
                                    <CheckCircle size={15} />
                                    Lưu cấu hình AI
                                </button>
                                <button className="panel-ghost-button" disabled={checkingAI} onClick={() => refreshAIHealth(true)}>
                                    <RefreshCw size={15} className={checkingAI ? 'spin-icon' : ''} />
                                    Kiểm tra kết nối
                                </button>
                            </div>
                        </div>
                    </PanelCard>

                    <PanelCard
                        title="Sức khỏe AI"
                        subtitle="Kết quả đọc trực tiếp từ provider"
                        actions={<Tag color={aiHealth?.status === 'online' ? 'green' : aiHealth?.status === 'degraded' ? 'orange' : 'red'}>{aiHealth?.status || 'unknown'}</Tag>}
                    >
                        <ConfigGrid
                            items={[
                                ['Provider đang chạy', aiHealth?.provider || 'Chưa xác định'],
                                ['Model đang dùng', aiHealth?.model || 'Chưa xác định'],
                                ['Base URL nội bộ', aiHealth?.baseUrl || 'Chưa xác định'],
                                ['Độ trễ health check', aiHealth && aiHealth.latency >= 0 ? `${aiHealth.latency}ms` : 'Không có'],
                                ['Số model khả dụng', String(aiHealth?.models?.length || 0)],
                            ]}
                        />
                        <div className={`notice-box ${aiHealth?.status === 'online' ? '' : 'amber'}`} style={{ marginTop: 14 }}>
                            {aiHealth?.status === 'online' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                            <span>{aiHealth?.status === 'online' ? `Sẵn sàng auto-response bằng ${aiHealth.model}.` : (aiHealth?.message || 'Provider chưa sẵn sàng.')}</span>
                        </div>
                        {Boolean(aiHealth?.models?.length) && (
                            <div className="ai-model-list">
                                {aiHealth?.models.map((model) => <Tag key={model.id}>{model.id}</Tag>)}
                            </div>
                        )}
                    </PanelCard>
                </div>
            )}

            {subTab === 'smtp' && (
                <div className="panel-grid-2 communications-settings-grid">
                    <PanelCard
                        title="Email SMTP hệ thống"
                        subtitle="Dùng cho email xác thực, khôi phục mật khẩu và thông báo vận hành"
                        actions={
                            <Tag color={smtpEnabled ? (smtpHost && smtpFromEmail ? 'green' : 'orange') : 'default'}>
                                {smtpEnabled ? (smtpHost && smtpFromEmail ? 'Đã bật' : 'Thiếu cấu hình') : 'Đang tắt'}
                            </Tag>
                        }
                    >
                        <div className="settings-form">
                            <div className="settings-toggle-row">
                                <div>
                                    <strong>Bật gửi email hệ thống</strong>
                                    <span>Chỉ bật sau khi kiểm tra kết nối thành công.</span>
                                </div>
                                <Switch checked={smtpEnabled} onChange={setSmtpEnabled} checkedChildren="ON" unCheckedChildren="OFF" />
                            </div>

                            <div className="settings-field-grid">
                                <label>
                                    <span>SMTP host</span>
                                    <Input value={smtpHost} onChange={(event) => setSmtpHost(event.target.value)} placeholder="smtp.gmail.com" />
                                </label>
                                <label>
                                    <span>Port</span>
                                    <Input
                                        type="number"
                                        min={1}
                                        max={65535}
                                        inputMode="numeric"
                                        value={smtpPort}
                                        onChange={(event) => setSmtpPort(event.target.value)}
                                        placeholder="587"
                                    />
                                </label>
                            </div>

                            <div className="settings-toggle-row compact">
                                <div>
                                    <strong>Dùng SSL/TLS trực tiếp</strong>
                                    <span>Thường bật với port 465; port 587 thường dùng STARTTLS.</span>
                                </div>
                                <Switch checked={smtpSecure} onChange={setSmtpSecure} />
                            </div>

                            <div className="settings-field-grid">
                                <label>
                                    <span>Username</span>
                                    <Input
                                        value={smtpUsername}
                                        onChange={(event) => setSmtpUsername(event.target.value)}
                                        autoComplete="username"
                                        placeholder="support@nemarkchat.com"
                                    />
                                </label>
                                <label>
                                    <span>Mật khẩu / App Password</span>
                                    <Input.Password
                                        value={smtpPassword}
                                        onChange={(event) => setSmtpPassword(event.target.value)}
                                        autoComplete="new-password"
                                        placeholder={smtpPasswordConfigured ? 'Để trống để giữ mật khẩu hiện tại' : 'Nhập mật khẩu SMTP'}
                                    />
                                </label>
                            </div>

                            <div className={`secret-config-status ${smtpPasswordConfigured ? 'configured' : ''}`}>
                                <KeyRound size={15} />
                                <span>
                                    {smtpPassword.trim()
                                        ? 'Có mật khẩu mới, chưa lưu.'
                                        : smtpPasswordConfigured
                                            ? 'Mật khẩu đã được lưu an toàn; hệ thống không trả secret về trình duyệt.'
                                            : 'Chưa có mật khẩu SMTP được lưu.'}
                                </span>
                            </div>

                            <div className="settings-field-grid">
                                <label>
                                    <span>Tên người gửi</span>
                                    <Input value={smtpFromName} onChange={(event) => setSmtpFromName(event.target.value)} placeholder="NemarkChat" />
                                </label>
                                <label>
                                    <span>Email người gửi</span>
                                    <Input value={smtpFromEmail} onChange={(event) => setSmtpFromEmail(event.target.value)} placeholder="no-reply@nemarkchat.com" />
                                </label>
                            </div>

                            <div className="notice-box">
                                <Shield size={16} />
                                <span>Mật khẩu chỉ được gửi khi bạn nhập giá trị mới. Lưu lại với ô trống sẽ giữ nguyên secret đang có.</span>
                            </div>

                            <button className="panel-primary-button" disabled={saving} onClick={saveSmtpSettings}>
                                <CheckCircle size={15} />
                                Lưu cấu hình SMTP
                            </button>
                        </div>
                    </PanelCard>

                    <PanelCard
                        title="Kiểm tra gửi mail"
                        subtitle="Xác minh kết nối trước, sau đó gửi một email thật để kiểm tra hộp thư"
                        actions={<Mail size={18} color="#2563eb" />}
                    >
                        <div className="settings-form">
                            <div className="settings-checklist">
                                <div><span>1</span><p><strong>Kết nối máy chủ</strong><small>Kiểm tra DNS, port, TLS và xác thực.</small></p></div>
                                <div><span>2</span><p><strong>Gửi email thử</strong><small>Xác nhận From, nội dung và khả năng nhận mail.</small></p></div>
                            </div>

                            <button
                                className="panel-ghost-button settings-wide-button"
                                disabled={Boolean(testingSmtp)}
                                onClick={() => testSmtp('connection')}
                            >
                                <RefreshCw size={15} className={testingSmtp === 'connection' ? 'spin-icon' : ''} />
                                {testingSmtp === 'connection' ? 'Đang kiểm tra...' : 'Kiểm tra kết nối SMTP'}
                            </button>

                            <label>Email nhận thử</label>
                            <Input
                                value={smtpTestRecipient}
                                onChange={(event) => setSmtpTestRecipient(event.target.value)}
                                placeholder="admin@nemarkchat.com"
                            />
                            <button
                                className="panel-primary-button settings-wide-button"
                                disabled={Boolean(testingSmtp)}
                                onClick={() => testSmtp('send')}
                            >
                                <Send size={15} />
                                {testingSmtp === 'send' ? 'Đang gửi...' : 'Gửi email thử'}
                            </button>

                            {smtpTestState && (
                                <div className={`settings-test-result ${smtpTestState.tone}`}>
                                    {smtpTestState.tone === 'success' ? <CheckCircle size={17} /> : <XCircle size={17} />}
                                    <div>
                                        <strong>{smtpTestState.tone === 'success' ? 'Kiểm tra thành công' : 'Kiểm tra thất bại'}</strong>
                                        <span>{smtpTestState.message}{smtpTestState.latency !== undefined ? ` · ${smtpTestState.latency}ms` : ''}</span>
                                    </div>
                                </div>
                            )}

                            <div className="notice-box amber">
                                <AlertTriangle size={16} />
                                <span>Nếu dùng Gmail, hãy tạo App Password; không nhập mật khẩu đăng nhập Google thông thường.</span>
                            </div>
                        </div>
                    </PanelCard>
                </div>
            )}

            {subTab === 'telegram' && (
                <div className="panel-grid-2 communications-settings-grid">
                    <PanelCard
                        title="Cảnh báo Telegram"
                        subtitle="Đẩy sự kiện quan trọng tới admin hoặc nhóm vận hành"
                        actions={
                            <Tag color={telegramEnabled ? (telegramTokenConfigured && telegramChatId ? 'green' : 'orange') : 'default'}>
                                {telegramEnabled ? (telegramTokenConfigured && telegramChatId ? 'Đã bật' : 'Thiếu cấu hình') : 'Đang tắt'}
                            </Tag>
                        }
                    >
                        <div className="settings-form">
                            <div className="settings-toggle-row">
                                <div>
                                    <strong>Bật thông báo Telegram</strong>
                                    <span>Bot chỉ gửi các nhóm sự kiện bạn chọn bên dưới.</span>
                                </div>
                                <Switch checked={telegramEnabled} onChange={setTelegramEnabled} checkedChildren="ON" unCheckedChildren="OFF" />
                            </div>

                            <label>Bot Token</label>
                            <Input.Password
                                value={telegramBotToken}
                                onChange={(event) => setTelegramBotToken(event.target.value)}
                                autoComplete="new-password"
                                placeholder={telegramTokenConfigured ? 'Để trống để giữ token hiện tại' : '123456789:AA...'}
                            />
                            <div className={`secret-config-status ${telegramTokenConfigured ? 'configured' : ''}`}>
                                <KeyRound size={15} />
                                <span>
                                    {telegramBotToken.trim()
                                        ? 'Có Bot Token mới, chưa lưu.'
                                        : telegramTokenConfigured
                                            ? 'Bot Token đã được lưu; chỉ nhập lại khi cần thay bot.'
                                            : 'Chưa có Bot Token được lưu.'}
                                </span>
                            </div>

                            <label>Chat ID nhận cảnh báo</label>
                            <Input
                                value={telegramChatId}
                                onChange={(event) => setTelegramChatId(event.target.value)}
                                placeholder="-1001234567890 hoặc @channel_username"
                            />
                            <span className="settings-field-help">Chat cá nhân thường là số dương; group/supergroup thường bắt đầu bằng <code>-100</code>.</span>

                            <div className="settings-section-label">Sự kiện cần báo</div>
                            <div className="notification-option-list">
                                <div>
                                    <span><Users size={15} /> Workspace hoặc tài khoản mới</span>
                                    <Switch size="small" checked={telegramNotifyNewWorkspace} onChange={setTelegramNotifyNewWorkspace} />
                                </div>
                                <div>
                                    <span><CreditCard size={15} /> Thanh toán / gia hạn gói</span>
                                    <Switch size="small" checked={telegramNotifyPayment} onChange={setTelegramNotifyPayment} />
                                </div>
                                <div>
                                    <span><AlertTriangle size={15} /> Lỗi hệ thống cần xử lý</span>
                                    <Switch size="small" checked={telegramNotifySystemError} onChange={setTelegramNotifySystemError} />
                                </div>
                            </div>

                            <button className="panel-primary-button" disabled={saving} onClick={saveTelegramSettings}>
                                <CheckCircle size={15} />
                                Lưu cấu hình Telegram
                            </button>
                        </div>
                    </PanelCard>

                    <div className="panel-stack compact-stack">
                        <PanelCard
                            title="Tìm Chat ID"
                            subtitle="Làm theo đúng thứ tự để bot nhìn thấy cuộc trò chuyện"
                            actions={<Bell size={18} color="#2563eb" />}
                        >
                            <ol className="chat-id-steps">
                                <li>
                                    <span>1</span>
                                    <div>
                                        <strong>Tạo bot và lấy token</strong>
                                        <p>Mở <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer">@BotFather <ExternalLink size={12} /></a>, chọn <code>/newbot</code>.</p>
                                    </div>
                                </li>
                                <li>
                                    <span>2</span>
                                    <div>
                                        <strong>Cho bot thấy tin nhắn</strong>
                                        <p>Chat cá nhân: mở bot và gửi <code>/start</code>. Nhóm: thêm bot vào nhóm rồi gửi một tin nhắn.</p>
                                    </div>
                                </li>
                                <li>
                                    <span>3</span>
                                    <div>
                                        <strong>Lấy đúng ID</strong>
                                        <p>Mở <a href="https://t.me/userinfobot" target="_blank" rel="noopener noreferrer">@userinfobot <ExternalLink size={12} /></a> để xem ID cá nhân. Với nhóm, chuyển tiếp một tin nhắn nhóm vào bot này.</p>
                                    </div>
                                </li>
                            </ol>
                        </PanelCard>

                        <PanelCard title="Gửi tin nhắn thử" subtitle="Gửi tới đúng Chat ID đang nhập, không cần bật thông báo trước">
                            <div className="settings-form">
                                <Input.TextArea
                                    value={telegramTestMessage}
                                    onChange={(event) => setTelegramTestMessage(event.target.value)}
                                    autoSize={{ minRows: 3, maxRows: 5 }}
                                    maxLength={500}
                                    showCount
                                    placeholder="Nội dung tin nhắn thử"
                                />
                                <button className="panel-primary-button settings-wide-button" disabled={testingTelegram} onClick={testTelegram}>
                                    <Send size={15} />
                                    {testingTelegram ? 'Đang gửi...' : 'Gửi tới Telegram'}
                                </button>

                                {telegramTestState && (
                                    <div className={`settings-test-result ${telegramTestState.tone}`}>
                                        {telegramTestState.tone === 'success' ? <CheckCircle size={17} /> : <XCircle size={17} />}
                                        <div>
                                            <strong>{telegramTestState.tone === 'success' ? 'Bot đã gửi thành công' : 'Bot chưa gửi được'}</strong>
                                            <span>{telegramTestState.message}{telegramTestState.latency !== undefined ? ` · ${telegramTestState.latency}ms` : ''}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </PanelCard>
                    </div>
                </div>
            )}

            {subTab === 'facebook' && (
                <div className="panel-grid-2 communications-settings-grid">
                    <PanelCard
                        title="Facebook Fanpage hệ thống"
                        subtitle="Một Meta App dùng chung; khách hàng chỉ cần bấm kết nối và chọn Fanpage trong workspace"
                        actions={<Tag color={facebookStatus?.oauthReady && facebookStatus?.webhookReady ? 'green' : 'orange'}>{facebookStatus?.oauthReady && facebookStatus?.webhookReady ? 'Sẵn sàng' : 'Thiếu cấu hình'}</Tag>}
                    >
                        <div className="settings-form">
                            <div className="settings-toggle-row">
                                <div><strong>Bật Facebook Integration</strong><span>Tắt công tắc để chặn tạo OAuth mới mà không xoá các Fanpage đã lưu.</span></div>
                                <Switch checked={facebookEnabled} onChange={setFacebookEnabled} checkedChildren="ON" unCheckedChildren="OFF" />
                            </div>
                            <label>Facebook App ID</label>
                            <Input value={facebookAppId} onChange={(event) => setFacebookAppId(event.target.value)} placeholder="ID ứng dụng trên Meta for Developers" />
                            <label>Facebook App Secret</label>
                            <Input.Password
                                value={facebookAppSecret}
                                onChange={(event) => setFacebookAppSecret(event.target.value)}
                                placeholder={facebookAppSecretConfigured ? 'Đã lưu an toàn · để trống nếu không đổi' : 'Nhập App Secret'}
                            />
                            <label>Webhook Verify Token</label>
                            <div className="settings-secret-row">
                                <Input.Password
                                    value={facebookVerifyToken}
                                    onChange={(event) => setFacebookVerifyToken(event.target.value)}
                                    placeholder={facebookVerifyTokenConfigured ? 'Đã lưu an toàn · để trống nếu không đổi' : 'Tạo hoặc nhập verify token'}
                                />
                                <button className="panel-ghost-button" type="button" onClick={generateFacebookVerifyToken}><KeyRound size={15} /> Tạo token</button>
                            </div>
                            <label>OAuth Redirect URI</label>
                            <Input value={facebookRedirectUri} onChange={(event) => setFacebookRedirectUri(event.target.value)} placeholder="https://nemarkchat.com/api/facebook/callback" />
                            <button className="panel-primary-button" disabled={saving} onClick={saveFacebookSettings}><CheckCircle size={15} /> Lưu cấu hình Facebook</button>
                        </div>
                    </PanelCard>

                    <PanelCard title="Thiết lập trong Meta App" subtitle="Các URL phải trùng chính xác với cấu hình production" actions={<button className="panel-ghost-button" disabled={loadingChannelStatus} onClick={() => refreshChannelStatus(true)}><RefreshCw size={15} /> Kiểm tra</button>}>
                        <div className="settings-form">
                            <label>Valid OAuth Redirect URI</label>
                            <div className="settings-secret-row">
                                <Input readOnly value={facebookStatus?.redirectUri || facebookRedirectUri} />
                                <button className="panel-ghost-button" onClick={() => copySupportSnippet(facebookStatus?.redirectUri || facebookRedirectUri, 'Đã copy Redirect URI')}><Copy size={15} /></button>
                            </div>
                            <label>Webhook Callback URL</label>
                            <div className="settings-secret-row">
                                <Input readOnly value={facebookStatus?.webhookUrl || 'https://nemarkchat.com/api/facebook/webhook'} />
                                <button className="panel-ghost-button" onClick={() => copySupportSnippet(facebookStatus?.webhookUrl || 'https://nemarkchat.com/api/facebook/webhook', 'Đã copy Webhook URL')}><Copy size={15} /></button>
                            </div>
                            <div className="notice-box">
                                <Shield size={16} />
                                <span>Thêm sản phẩm Messenger, khai báo OAuth Redirect URI, webhook Callback URL và cùng Verify Token. Đăng ký các field <code>messages</code> và <code>messaging_postbacks</code>.</span>
                            </div>
                            {facebookStatus?.missing?.length ? (
                                <div className="notice-box amber"><AlertTriangle size={16} /><span>Còn thiếu: {facebookStatus.missing.join(', ')}</span></div>
                            ) : (
                                <div className="settings-test-result success"><CheckCircle size={17} /><div><strong>OAuth và webhook đã sẵn sàng</strong><span>Workspace có thể bắt đầu kết nối Fanpage.</span></div></div>
                            )}
                        </div>
                    </PanelCard>
                </div>
            )}

            {subTab === 'zalo' && (
                <div className="panel-grid-2 communications-settings-grid">
                    <PanelCard
                        title="Zalo cá nhân qua QR"
                        subtitle="Connector hiện tại dùng phiên đăng nhập Zalo cá nhân; không yêu cầu App ID hoặc API key"
                        actions={<Tag color={zaloStatus?.enabled && zaloStatus?.noticeAccepted ? 'green' : 'orange'}>{zaloStatus?.activeAccounts || 0} tài khoản hoạt động</Tag>}
                    >
                        <div className="settings-form">
                            <div className="settings-toggle-row">
                                <div><strong>Bật kết nối Zalo cá nhân</strong><span>Cho phép workspace tạo QR đăng nhập Zalo.</span></div>
                                <Switch checked={zaloEnabled} onChange={setZaloEnabled} checkedChildren="ON" unCheckedChildren="OFF" />
                            </div>
                            <div className="settings-toggle-row">
                                <div><strong>Tự khôi phục sau khi server khởi động</strong><span>Dùng session đã mã hoá/lưu trên server để kết nối lại.</span></div>
                                <Switch checked={zaloAutoReconnect} onChange={setZaloAutoReconnect} />
                            </div>
                            <div className="settings-toggle-row">
                                <div><strong>Xác nhận cơ chế connector</strong><span>Tôi hiểu đây là connector Zalo cá nhân qua thư viện zca-js, không phải Zalo OA OpenAPI chính thức.</span></div>
                                <Switch checked={zaloNoticeAccepted} onChange={setZaloNoticeAccepted} />
                            </div>
                            <div className="notice-box amber"><AlertTriangle size={16} /><span>Connector cá nhân phụ thuộc thay đổi phía Zalo và có thể cần quét QR lại. Nên dùng tài khoản vận hành riêng, không dùng tài khoản cá nhân quan trọng.</span></div>
                            <button className="panel-primary-button" disabled={saving} onClick={saveZaloSettings}><CheckCircle size={15} /> Lưu cấu hình Zalo</button>
                        </div>
                    </PanelCard>
                    <PanelCard title="Zalo login hoạt động thế nào?" subtitle="Luồng người dùng trong workspace">
                        <ol className="chat-id-steps">
                            <li><span>1</span><div><strong>Bấm “Thêm tài khoản Zalo”</strong><p>Backend tạo một phiên đăng nhập và trả mã QR về giao diện.</p></div></li>
                            <li><span>2</span><div><strong>Quét QR bằng ứng dụng Zalo</strong><p>Zalo xác nhận phiên đăng nhập; NemarkChat không cần người dùng nhập mật khẩu.</p></div></li>
                            <li><span>3</span><div><strong>Lưu phiên và đồng bộ</strong><p>Server giữ thông tin phiên, tải hội thoại và nhận tin nhắn realtime.</p></div></li>
                            <li><span>4</span><div><strong>Tự kết nối lại</strong><p>Khi VPS khởi động lại, backend phục hồi các tài khoản đang hoạt động.</p></div></li>
                        </ol>
                        <div className="notice-box"><MessageSquare size={16} /><span>Nếu muốn Zalo OA chính thức, đó là module khác: cần tạo ứng dụng tại developers.zalo.me, OA ID, App ID/Secret, callback, webhook và quyền được Zalo duyệt.</span></div>
                        <button className="panel-ghost-button" disabled={loadingChannelStatus} onClick={() => refreshChannelStatus(true)}><RefreshCw size={15} /> Làm mới trạng thái</button>
                    </PanelCard>
                </div>
            )}

            {subTab === 'recaptcha' && (
                <PanelCard title="Cấu hình reCAPTCHA" subtitle="Bảo vệ đăng nhập và đăng ký khỏi bot tự động">
                    <div className="settings-form">
                        <label>Trạng thái</label>
                        <Switch checked={recaptchaEnabled} onChange={setRecaptchaEnabled} checkedChildren="ON" unCheckedChildren="OFF" />
                        <label>reCAPTCHA Site Key</label>
                        <Input value={recaptchaSiteKey} onChange={(event) => setRecaptchaSiteKey(event.target.value)} placeholder="6Lc..." />
                        <label>reCAPTCHA Secret Key</label>
                        <Input.Password value={recaptchaSecretKey} onChange={(event) => setRecaptchaSecretKey(event.target.value)} placeholder="6Lc..." />
                        <div className="notice-box">
                            <Shield size={16} />
                            <span>Khi deploy production trên nemarkchat.com, bật reCAPTCHA sau khi kiểm tra đủ Site Key và Secret Key.</span>
                        </div>
                        <button
                            className="panel-primary-button"
                            disabled={saving}
                            onClick={() => saveSettings({
                                recaptcha_enabled: recaptchaEnabled ? 'true' : 'false',
                                recaptcha_site_key: recaptchaSiteKey,
                                recaptcha_secret_key: recaptchaSecretKey,
                            }, 'Đã lưu cấu hình reCAPTCHA')}
                        >
                            <CheckCircle size={15} />
                            Lưu cấu hình
                        </button>
                    </div>
                </PanelCard>
            )}

            {subTab === 'google_oauth' && (
                <PanelCard title="Cấu hình Google OAuth" subtitle="Cho phép người dùng đăng nhập bằng tài khoản Google">
                    <div className="settings-form">
                        <label>Trạng thái</label>
                        <Switch checked={googleEnabled} onChange={setGoogleEnabled} checkedChildren="ON" unCheckedChildren="OFF" />
                        <label>Client ID</label>
                        <Input value={googleClientId} onChange={(event) => setGoogleClientId(event.target.value)} placeholder="xxxx.apps.googleusercontent.com" />
                        <label>Client Secret</label>
                        <Input.Password value={googleClientSecret} onChange={(event) => setGoogleClientSecret(event.target.value)} placeholder="GOCSPX..." />
                        <label>Callback URL</label>
                        <Input value={googleCallbackUrl} onChange={(event) => setGoogleCallbackUrl(event.target.value)} placeholder="https://api.nemarkchat.com/api/google-auth" />
                        <div className="notice-box amber">
                            <AlertTriangle size={16} />
                            <span>Nếu để trống Client ID hoặc Secret, backend sẽ fallback về biến môi trường.</span>
                        </div>
                        <button
                            className="panel-primary-button"
                            disabled={saving}
                            onClick={() => saveSettings({
                                google_auth_enabled: googleEnabled ? 'true' : 'false',
                                google_client_id: googleClientId,
                                google_client_secret: googleClientSecret,
                                google_callback_url: googleCallbackUrl,
                            }, 'Đã lưu cấu hình Google OAuth')}
                        >
                            <CheckCircle size={15} />
                            Lưu cấu hình
                        </button>
                    </div>
                </PanelCard>
            )}
        </div>
    );
};

const MetricCard = ({ icon: Icon, tone, label, value, meta }: { icon: LucideIcon; tone: Tone; label: string; value: string; meta?: string }) => (
    <div className={`metric-card tone-${tone}`}>
        <div className="metric-icon"><Icon size={19} /></div>
        <div>
            <span>{label}</span>
            <strong>{value}</strong>
            {meta && <small>{meta}</small>}
        </div>
    </div>
);

const PanelCard = ({ title, subtitle, actions, children }: { title: string; subtitle?: string; actions?: React.ReactNode; children: React.ReactNode }) => (
    <section className="panel-card">
        <div className="panel-card-header">
            <div>
                <h3>{title}</h3>
                {subtitle && <p>{subtitle}</p>}
            </div>
            {actions && <div className="panel-card-actions">{actions}</div>}
        </div>
        {children}
    </section>
);

const MetricLine = ({ label, value, icon: Icon, tone }: { label: string; value: string; icon: LucideIcon | React.FC<{ size?: number }>; tone: Tone }) => (
    <div className={`metric-line tone-${tone}`}>
        <div className="metric-line-icon"><Icon size={15} /></div>
        <span>{label}</span>
        <strong>{value}</strong>
    </div>
);

const ProgressLine = ({ label, value, tone }: { label: string; value: number; tone: Tone }) => (
    <div className="progress-line">
        <div>
            <span>{label}</span>
            <strong>{clamp(value)}%</strong>
        </div>
        <div className="progress-track">
            <span className={`tone-${tone}`} style={{ width: `${clamp(value)}%` }} />
        </div>
    </div>
);

const SearchBox = ({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) => (
    <Input
        allowClear
        prefix={<Search size={14} color="#667085" />}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        style={{ width: 280 }}
    />
);

const StatusPill = ({ active }: { active: boolean }) => (
    <span className={`status-pill ${active ? 'active' : 'inactive'}`}>
        {active ? <CheckCircle size={13} /> : <XCircle size={13} />}
        {active ? 'Active' : 'Inactive'}
    </span>
);

const InitialAvatar = ({ name }: { name: string }) => (
    <span className="initial-avatar">{name.charAt(0).toUpperCase()}</span>
);

const EmptyBlock = ({ icon: Icon, title }: { icon: LucideIcon; title: string }) => (
    <div className="empty-block">
        <Icon size={22} />
        <span>{title}</span>
    </div>
);

const ConfigGrid = ({ items }: { items: Array<[string, string]> }) => (
    <div className="config-grid">
        {items.map(([label, value]) => (
            <div className="config-row" key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
            </div>
        ))}
    </div>
);

const bytesToGb = (value?: number) => `${Math.round(((value || 0) / 1024 / 1024 / 1024) * 10) / 10}GB`;

const PanelStyles = () => (
    <style jsx global>{`
        .panel-root {
            min-height: 100vh;
            background: #f5f7fb;
            color: #101828;
            font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        .panel-sidebar {
            position: fixed;
            inset: 0 auto 0 0;
            z-index: 100;
            display: flex;
            width: 264px;
            height: 100vh;
            flex-direction: column;
            border-right: 1px solid rgba(255, 255, 255, 0.08);
            background: #101828;
            color: #fff;
        }

        .panel-brand {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 22px 18px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        .panel-brand-mark {
            display: grid;
            width: 38px;
            height: 38px;
            place-items: center;
            border-radius: 8px;
            background: #2563eb;
            color: #fff;
        }

        .panel-brand-copy {
            display: grid;
            min-width: 0;
        }

        .panel-brand-copy strong {
            font-size: 15px;
            line-height: 1.2;
        }

        .panel-brand-copy span,
        .panel-user-email {
            color: #98a2b3;
            font-size: 12px;
        }

        .panel-sidebar-footer-buttons {
            display: flex;
            flex-direction: column;
            gap: 4px;
            margin-top: 6px;
        }

        .panel-sidebar-footer-buttons .panel-link-button:hover {
            color: #60a5fa;
        }

        .panel-nav {
            flex: 1;
            overflow-y: auto;
            padding: 12px;
        }

        .panel-nav-section {
            padding: 14px 10px 6px;
            color: #667085;
            font-size: 11px;
            font-weight: 800;
            text-transform: uppercase;
        }

        .panel-nav-item {
            display: flex;
            width: 100%;
            height: 40px;
            align-items: center;
            gap: 10px;
            border: 1px solid transparent;
            border-radius: 8px;
            background: transparent;
            color: #cbd5e1;
            cursor: pointer;
            font-size: 14px;
            font-weight: 700;
            padding: 0 10px;
            text-align: left;
        }

        .panel-nav-item:hover,
        .panel-nav-item.active {
            border-color: rgba(96, 165, 250, 0.32);
            background: rgba(37, 99, 235, 0.2);
            color: #fff;
        }

        .panel-sidebar-footer {
            display: grid;
            gap: 10px;
            padding: 16px;
            border-top: 1px solid rgba(255, 255, 255, 0.08);
        }

        .panel-main {
            min-height: 100vh;
            margin-left: 264px;
            padding: 24px 32px 56px;
        }

        .panel-page-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 20px;
            margin-bottom: 24px;
        }

        .panel-page-header h1 {
            margin: 8px 0 4px;
            color: #101828;
            font-size: 26px;
            font-weight: 850;
            line-height: 1.15;
        }

        .panel-page-header p {
            margin: 0;
            color: #667085;
            font-size: 14px;
        }

        .panel-kicker {
            display: inline-flex;
            min-height: 28px;
            align-items: center;
            gap: 7px;
            border: 1px solid #d0d5dd;
            border-radius: 999px;
            background: #fff;
            color: #475467;
            font-size: 12px;
            font-weight: 800;
            padding: 0 10px;
        }

        .panel-kicker.dark {
            border-color: rgba(255, 255, 255, 0.2);
            background: rgba(255, 255, 255, 0.1);
            color: #fff;
        }

        .panel-header-actions,
        .toolbar-row,
        .panel-card-actions,
        .command-actions {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: 10px;
        }

        .panel-sync-text {
            color: #667085;
            font-size: 12px;
            font-weight: 700;
        }

        .panel-primary-button,
        .panel-light-button,
        .panel-ghost-button,
        .panel-danger-button,
        .panel-link-button {
            display: inline-flex;
            height: 38px;
            align-items: center;
            justify-content: center;
            gap: 8px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 800;
            padding: 0 14px;
            transition: background 160ms ease, border-color 160ms ease, color 160ms ease;
            white-space: nowrap;
        }

        .panel-primary-button {
            border: 1px solid #2563eb;
            background: #2563eb;
            color: #fff;
        }

        .panel-primary-button:hover {
            border-color: #1d4ed8;
            background: #1d4ed8;
        }

        .panel-primary-button:disabled {
            cursor: not-allowed;
            opacity: 0.68;
        }

        .panel-light-button {
            border: 1px solid rgba(255, 255, 255, 0.24);
            background: rgba(255, 255, 255, 0.12);
            color: #fff;
        }

        .panel-ghost-button {
            border: 1px solid #d0d5dd;
            background: #fff;
            color: #344054;
        }

        .panel-ghost-button:hover,
        .panel-ghost-button.active {
            border-color: #93c5fd;
            background: #eff6ff;
            color: #1d4ed8;
        }

        .panel-danger-button {
            border: 1px solid #fecdd3;
            background: #fff1f2;
            color: #be123c;
        }

        .panel-link-button {
            height: 32px;
            justify-content: flex-start;
            border: 0;
            background: transparent;
            color: #93c5fd;
            padding: 0;
        }

        .panel-stack {
            display: grid;
            gap: 18px;
        }

        .panel-loading,
        .panel-full-spin {
            display: grid;
            min-height: 360px;
            place-items: center;
        }

        .panel-full-spin {
            min-height: 100vh;
            background: #f5f7fb;
        }

        .panel-loading.tight {
            min-height: 160px;
        }

        .command-hero {
            display: grid;
            grid-template-columns: minmax(0, 1fr) 330px;
            gap: 22px;
            overflow: hidden;
            border-radius: 8px;
            background: linear-gradient(135deg, #0f766e 0%, #1d4ed8 64%, #111827 100%);
            color: #fff;
            padding: 28px;
        }

        .command-copy h2 {
            margin: 14px 0 8px;
            font-size: 30px;
            font-weight: 880;
            line-height: 1.12;
        }

        .command-copy p {
            max-width: 660px;
            margin: 0 0 18px;
            color: rgba(255, 255, 255, 0.82);
            font-size: 14px;
            line-height: 1.6;
        }

        .command-health {
            display: flex;
            min-width: 0;
            align-items: center;
            gap: 16px;
            border: 1px solid rgba(255, 255, 255, 0.14);
            border-radius: 8px;
            background: rgba(255, 255, 255, 0.1);
            padding: 18px;
        }

        .command-health strong,
        .command-health span,
        .command-health em {
            display: block;
        }

        .command-health span {
            margin-top: 4px;
            color: rgba(255, 255, 255, 0.78);
            font-size: 13px;
        }

        .command-health em {
            margin-top: 8px;
            color: rgba(255, 255, 255, 0.62);
            font-size: 12px;
            font-style: normal;
        }

        .health-ring {
            display: grid;
            width: 96px;
            height: 96px;
            flex: 0 0 auto;
            place-items: center;
            border-radius: 50%;
            background: conic-gradient(#22c55e var(--score), rgba(255, 255, 255, 0.18) 0);
            position: relative;
        }

        .health-ring::after {
            position: absolute;
            inset: 9px;
            border-radius: 50%;
            background: #0f172a;
            content: "";
        }

        .health-ring span,
        .health-ring small {
            position: relative;
            z-index: 1;
        }

        .health-ring span {
            align-self: end;
            font-size: 25px;
            font-weight: 900;
            line-height: 1;
        }

        .health-ring small {
            align-self: start;
            color: #cbd5e1;
            font-size: 11px;
        }

        .panel-kpi-grid {
            display: grid;
            grid-template-columns: repeat(6, minmax(0, 1fr));
            gap: 14px;
        }

        .panel-kpi-grid.three {
            grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .panel-kpi-grid.four {
            grid-template-columns: repeat(4, minmax(0, 1fr));
        }

        .metric-card,
        .panel-card {
            border: 1px solid #dde4ef;
            border-radius: 8px;
            background: #fff;
            box-shadow: 0 1px 2px rgba(16, 24, 40, 0.04);
        }

        .metric-card {
            display: flex;
            min-width: 0;
            align-items: center;
            gap: 12px;
            min-height: 112px;
            padding: 16px;
        }

        .metric-card span {
            display: block;
            color: #667085;
            font-size: 12px;
            font-weight: 800;
            text-transform: uppercase;
        }

        .metric-card strong {
            display: block;
            overflow: hidden;
            margin-top: 6px;
            color: #101828;
            font-size: 21px;
            font-weight: 880;
            line-height: 1.1;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .metric-card small {
            display: block;
            overflow: hidden;
            margin-top: 7px;
            color: #667085;
            font-size: 12px;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .metric-icon,
        .metric-line-icon,
        .row-icon,
        .direction-icon {
            display: grid;
            flex: 0 0 auto;
            place-items: center;
            border-radius: 8px;
        }

        .metric-icon {
            width: 42px;
            height: 42px;
        }

        .tone-blue .metric-icon,
        .tone-blue.metric-line,
        .tone-blue.metric-line .metric-line-icon {
            background: #eff6ff;
            color: #2563eb;
        }

        .tone-teal .metric-icon,
        .tone-teal.metric-line,
        .tone-teal.metric-line .metric-line-icon {
            background: #ecfdf5;
            color: #0f766e;
        }

        .tone-amber .metric-icon,
        .tone-amber.metric-line,
        .tone-amber.metric-line .metric-line-icon {
            background: #fffbeb;
            color: #b45309;
        }

        .tone-rose .metric-icon,
        .tone-rose.metric-line,
        .tone-rose.metric-line .metric-line-icon {
            background: #fff1f2;
            color: #be123c;
        }

        .tone-violet .metric-icon,
        .tone-violet.metric-line,
        .tone-violet.metric-line .metric-line-icon {
            background: #f5f3ff;
            color: #6d28d9;
        }

        .tone-slate .metric-icon,
        .tone-slate.metric-line,
        .tone-slate.metric-line .metric-line-icon {
            background: #f1f5f9;
            color: #475467;
        }

        .panel-card {
            min-width: 0;
            padding: 18px;
        }

        .panel-card-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 14px;
            margin-bottom: 16px;
        }

        .panel-card h3 {
            margin: 0;
            color: #101828;
            font-size: 16px;
            font-weight: 850;
            line-height: 1.25;
        }

        .panel-card p {
            margin: 4px 0 0;
            color: #667085;
            font-size: 12px;
        }

        .panel-dashboard-grid {
            display: grid;
            grid-template-columns: minmax(0, 1.7fr) minmax(340px, 0.8fr);
            gap: 18px;
        }

        .panel-grid-2 {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 18px;
        }

        .trend-chart {
            display: grid;
            min-height: 220px;
            grid-template-columns: repeat(7, minmax(54px, 1fr));
            align-items: end;
            gap: 12px;
            overflow-x: auto;
            padding-top: 8px;
        }

        .trend-day {
            display: grid;
            justify-items: center;
            gap: 6px;
            color: #667085;
            font-size: 12px;
        }

        .trend-day strong {
            color: #344054;
            font-size: 12px;
        }

        .trend-bars {
            display: flex;
            height: 150px;
            align-items: end;
            gap: 4px;
        }

        .bar {
            width: 9px;
            border-radius: 6px 6px 0 0;
        }

        .messages,
        .dot.messages {
            background: #2563eb;
        }

        .conversations,
        .dot.conversations {
            background: #0f766e;
        }

        .visitors,
        .dot.visitors {
            background: #b45309;
        }

        .mini-legend {
            display: flex;
            gap: 10px;
            color: #667085;
            font-size: 12px;
            font-weight: 700;
        }

        .mini-legend span {
            display: inline-flex;
            align-items: center;
            gap: 5px;
        }

        .dot {
            display: inline-block;
            width: 8px;
            height: 8px;
            border-radius: 50%;
        }

        .alert-list,
        .compact-list,
        .cron-list,
        .service-state-list,
        .config-grid,
        .settings-form {
            display: grid;
            gap: 10px;
        }

        .config-form-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 12px;
        }

        .config-form-grid label {
            display: grid;
            gap: 6px;
            min-width: 0;
        }

        .config-form-grid label span {
            color: #667085;
            font-size: 12px;
            font-weight: 800;
        }

        .alert-row,
        .compact-row,
        .cron-row,
        .config-row,
        .service-state-row,
        .metric-line {
            display: flex;
            min-width: 0;
            align-items: center;
            gap: 12px;
            border: 1px solid #eef2f7;
            border-radius: 8px;
            background: #f8fafc;
            padding: 12px;
        }

        .alert-row > div:nth-child(2),
        .compact-row-main,
        .cron-main,
        .table-user > div,
        .table-title {
            min-width: 0;
        }

        .alert-row strong,
        .alert-row span,
        .compact-row strong,
        .compact-row span,
        .table-user strong,
        .table-user span,
        .table-title strong,
        .table-title span {
            display: block;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .alert-row strong,
        .compact-row strong,
        .table-user strong,
        .table-title strong {
            color: #101828;
            font-size: 13px;
            font-weight: 800;
        }

        .alert-row span,
        .compact-row span,
        .table-user span,
        .table-title span {
            margin-top: 2px;
            color: #667085;
            font-size: 12px;
        }

        .alert-icon {
            display: grid;
            width: 34px;
            height: 34px;
            flex: 0 0 auto;
            place-items: center;
            border-radius: 8px;
        }

        .alert-row.danger .alert-icon {
            background: #fff1f2;
            color: #be123c;
        }

        .alert-row.watch .alert-icon {
            background: #fffbeb;
            color: #b45309;
        }

        .alert-row.info .alert-icon,
        .alert-row.good .alert-icon {
            background: #eff6ff;
            color: #2563eb;
        }

        .compact-row-value {
            margin-left: auto;
            text-align: right;
        }

        .row-icon {
            width: 36px;
            height: 36px;
        }

        .row-icon.teal {
            background: #ecfdf5;
            color: #0f766e;
        }

        .snapshot-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
            margin-bottom: 14px;
        }

        .metric-line {
            justify-content: space-between;
            padding: 10px;
        }

        .metric-line span {
            flex: 1;
            color: #475467;
            font-size: 12px;
            font-weight: 700;
        }

        .metric-line strong {
            color: #101828;
            font-size: 13px;
        }

        .metric-line-icon {
            width: 30px;
            height: 30px;
        }

        .progress-line {
            display: grid;
            gap: 7px;
            margin-top: 12px;
        }

        .progress-line > div:first-child {
            display: flex;
            justify-content: space-between;
            color: #667085;
            font-size: 12px;
            font-weight: 800;
        }

        .progress-track {
            height: 8px;
            overflow: hidden;
            border-radius: 999px;
            background: #eef2f7;
        }

        .progress-track span {
            display: block;
            height: 100%;
            border-radius: inherit;
        }

        .progress-track .tone-blue {
            background: #2563eb;
        }

        .progress-track .tone-teal {
            background: #0f766e;
        }

        .progress-track .tone-amber {
            background: #b45309;
        }

        .progress-track .tone-violet {
            background: #6d28d9;
        }

        .progress-track .tone-rose {
            background: #be123c;
        }

        .compact-table-wrap {
            overflow-x: auto;
        }

        .compact-table {
            width: 100%;
            border-collapse: collapse;
        }

        .compact-table th,
        .compact-table td {
            border-bottom: 1px solid #eef2f7;
            padding: 10px;
            text-align: left;
            white-space: nowrap;
        }

        .compact-table th {
            color: #667085;
            font-size: 11px;
            font-weight: 850;
            text-transform: uppercase;
        }

        .compact-table td {
            color: #344054;
            font-size: 13px;
        }

        .compact-table td span {
            display: block;
            color: #667085;
            font-size: 12px;
        }

        .status-pill {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            height: 26px;
            border-radius: 999px;
            font-size: 12px;
            font-weight: 800;
            padding: 0 10px;
        }

        .status-pill.active {
            background: #ecfdf5;
            color: #0f766e;
        }

        .status-pill.inactive {
            background: #fff1f2;
            color: #be123c;
        }

        .segmented-tabs {
            display: inline-flex;
            width: fit-content;
            max-width: 100%;
            overflow-x: auto;
            border: 1px solid #d0d5dd;
            border-radius: 8px;
            background: #fff;
            padding: 4px;
        }

        .segmented-tabs button {
            height: 34px;
            border: 0;
            border-radius: 6px;
            background: transparent;
            color: #667085;
            cursor: pointer;
            font-size: 13px;
            font-weight: 800;
            padding: 0 14px;
            white-space: nowrap;
        }

        .segmented-tabs button.active {
            background: #eff6ff;
            color: #1d4ed8;
        }

        .bank-overview-grid {
            display: grid;
            grid-template-columns: minmax(0, 2fr) minmax(180px, 1fr) minmax(180px, 1fr);
            gap: 14px;
        }

        .bank-account-panel {
            display: grid;
            gap: 10px;
            border-radius: 8px;
            background: linear-gradient(135deg, #0f766e, #1d4ed8);
            color: #fff;
            padding: 20px;
        }

        .bank-account-panel > div {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 12px;
        }

        .bank-account-panel span,
        .bank-account-panel p {
            margin: 0;
            color: rgba(255, 255, 255, 0.68);
            font-size: 12px;
            font-weight: 800;
        }

        .bank-account-panel strong {
            font-size: 22px;
            font-weight: 900;
        }

        .bank-account-panel h2,
        .bank-account-panel h3 {
            margin: 0;
            color: #fff;
        }

        .bank-account-panel h2 {
            font-size: 28px;
            font-weight: 900;
        }

        .bank-account-panel h3 {
            font-size: 16px;
        }

        .direction-icon {
            width: 32px;
            height: 32px;
        }

        .direction-icon.in {
            background: #ecfdf5;
            color: #0f766e;
        }

        .direction-icon.out {
            background: #fff1f2;
            color: #be123c;
        }

        .direction-icon.idle {
            background: #f1f5f9;
            color: #667085;
        }

        .table-user {
            display: flex;
            min-width: 0;
            align-items: center;
            gap: 10px;
        }

        .initial-avatar {
            display: grid;
            width: 34px;
            height: 34px;
            flex: 0 0 auto;
            place-items: center;
            border-radius: 8px;
            background: #eff6ff;
            color: #1d4ed8;
            font-size: 13px;
            font-weight: 900;
        }

        .linkish {
            color: #2563eb;
        }

        .mono-text {
            color: #475467;
            font-family: "SFMono-Regular", Consolas, monospace;
            font-size: 12px;
        }

        .table-description {
            display: block;
            max-width: 560px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .money-positive {
            color: #0f766e;
        }

        .money-negative {
            color: #be123c;
        }

        .collection-grid {
            display: grid;
            grid-template-columns: repeat(6, minmax(0, 1fr));
            gap: 10px;
        }

        .collection-cell {
            display: grid;
            gap: 4px;
            border: 1px solid #eef2f7;
            border-radius: 8px;
            background: #f8fafc;
            padding: 12px;
        }

        .collection-cell span {
            overflow: hidden;
            color: #667085;
            font-size: 12px;
            font-weight: 800;
            text-overflow: ellipsis;
            text-transform: uppercase;
            white-space: nowrap;
        }

        .collection-cell strong {
            color: #101828;
            font-size: 20px;
            font-weight: 900;
        }

        .network-grid,
        .service-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 12px;
        }

        .network-card {
            display: grid;
            gap: 8px;
            min-height: 170px;
            place-items: center;
            border: 1px solid #eef2f7;
            border-radius: 8px;
            background: #f8fafc;
            padding: 18px;
            text-align: center;
        }

        .network-card.in {
            color: #0f766e;
        }

        .network-card.out {
            color: #be123c;
        }

        .network-card span {
            color: #667085;
            font-size: 12px;
            font-weight: 800;
            text-transform: uppercase;
        }

        .network-card strong {
            color: #101828;
            font-size: 24px;
            font-weight: 900;
        }

        .cron-row {
            align-items: flex-start;
        }

        .cron-main {
            display: grid;
            flex: 1;
            gap: 8px;
        }

        .cron-main > div:first-child {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: 8px;
        }

        .cron-main strong {
            color: #101828;
            font-size: 14px;
        }

        .cron-main span {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            color: #667085;
            font-size: 12px;
            font-weight: 700;
        }

        .copy-line {
            display: flex;
            min-width: 0;
            align-items: center;
            gap: 8px;
            border: 1px solid #dde4ef;
            border-radius: 8px;
            background: #fff;
            padding: 7px 8px;
        }

        .copy-line span {
            flex: 1;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .service-link {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            border: 1px solid #dde4ef;
            border-radius: 8px;
            background: #fff;
            color: inherit;
            padding: 14px;
            text-decoration: none;
        }

        .service-link:hover {
            border-color: #93c5fd;
            color: #1d4ed8;
        }

        .service-link strong,
        .service-link span {
            display: block;
        }

        .service-link strong {
            color: #101828;
            font-size: 14px;
        }

        .service-link span {
            margin-top: 3px;
            color: #667085;
            font-size: 12px;
        }

        .config-row {
            justify-content: space-between;
        }

        .config-row span {
            color: #667085;
            font-size: 13px;
            font-weight: 700;
        }

        .config-row strong {
            min-width: 0;
            overflow-wrap: anywhere;
            color: #101828;
            font-size: 13px;
            text-align: right;
        }

        .service-state-row {
            justify-content: space-between;
        }

        .service-state-row span {
            display: inline-flex;
            align-items: center;
            gap: 9px;
            color: #101828;
            font-size: 13px;
            font-weight: 800;
        }

        .service-state-row i {
            width: 8px;
            height: 8px;
            border-radius: 50%;
        }

        .service-state-row i.ok {
            background: #0f766e;
        }

        .service-state-row i.off {
            background: #be123c;
        }

        .settings-form {
            width: 100%;
            max-width: 760px;
        }

        .settings-form label {
            color: #344054;
            font-size: 13px;
            font-weight: 850;
        }

        .settings-secret-row {
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto;
            gap: 10px;
        }

        .communications-settings-grid {
            align-items: start;
            grid-template-columns: minmax(0, 1.15fr) minmax(320px, 0.85fr);
        }

        .compact-stack {
            gap: 14px;
        }

        .settings-toggle-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 18px;
            border: 1px solid #dbeafe;
            border-radius: 8px;
            background: linear-gradient(135deg, #eff6ff, #f8fafc);
            padding: 13px 14px;
        }

        .settings-toggle-row.compact {
            border-color: #e4e7ec;
            background: #f8fafc;
        }

        .settings-toggle-row > div {
            display: grid;
            min-width: 0;
            gap: 3px;
        }

        .settings-toggle-row strong {
            color: #101828;
            font-size: 13px;
            font-weight: 850;
        }

        .settings-toggle-row span {
            color: #667085;
            font-size: 12px;
            line-height: 1.45;
        }

        .settings-field-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
        }

        .settings-field-grid label {
            display: grid;
            min-width: 0;
            gap: 7px;
        }

        .settings-field-help {
            margin-top: -4px;
            color: #667085;
            font-size: 12px;
            line-height: 1.5;
        }

        .settings-field-help code,
        .chat-id-steps code {
            border-radius: 4px;
            background: #eef2ff;
            color: #3730a3;
            font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
            font-size: 11px;
            padding: 1px 4px;
        }

        .secret-config-status {
            display: flex;
            align-items: flex-start;
            gap: 8px;
            margin-top: -2px;
            color: #667085;
            font-size: 12px;
            line-height: 1.45;
        }

        .secret-config-status.configured {
            color: #047857;
        }

        .secret-config-status svg {
            flex: 0 0 auto;
            margin-top: 1px;
        }

        .settings-section-label {
            margin-top: 3px;
            color: #344054;
            font-size: 12px;
            font-weight: 900;
            letter-spacing: 0.04em;
            text-transform: uppercase;
        }

        .notification-option-list {
            display: grid;
            overflow: hidden;
            border: 1px solid #e4e7ec;
            border-radius: 8px;
            background: #fff;
        }

        .notification-option-list > div {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            padding: 11px 13px;
        }

        .notification-option-list > div + div {
            border-top: 1px solid #eef2f7;
        }

        .notification-option-list span {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            color: #344054;
            font-size: 12px;
            font-weight: 750;
        }

        .support-widget-preview {
            display: grid;
            gap: 8px;
            border: 1px solid #e4e7ec;
            border-radius: 10px;
            background: #f8fafc;
            padding: 12px;
        }

        .support-widget-preview > div {
            display: grid;
            grid-template-columns: 120px minmax(0, 1fr);
            gap: 12px;
            align-items: start;
        }

        .support-widget-preview span {
            color: #667085;
            font-size: 12px;
            font-weight: 800;
        }

        .support-widget-preview strong {
            min-width: 0;
            color: #101828;
            font-size: 12px;
            overflow-wrap: anywhere;
        }

        .settings-checklist {
            display: grid;
            gap: 8px;
        }

        .settings-checklist > div {
            display: flex;
            align-items: flex-start;
            gap: 10px;
            border: 1px solid #e4e7ec;
            border-radius: 8px;
            background: #f8fafc;
            padding: 11px;
        }

        .settings-checklist > div > span {
            display: grid;
            flex: 0 0 26px;
            width: 26px;
            height: 26px;
            place-items: center;
            border-radius: 7px;
            background: #dbeafe;
            color: #1d4ed8;
            font-size: 12px;
            font-weight: 900;
        }

        .settings-checklist p {
            display: grid;
            gap: 2px;
            margin: 0;
        }

        .settings-checklist strong {
            color: #101828;
            font-size: 12px;
        }

        .settings-checklist small {
            color: #667085;
            font-size: 11px;
            line-height: 1.45;
        }

        .settings-wide-button {
            width: 100%;
        }

        .settings-test-result {
            display: flex;
            align-items: flex-start;
            gap: 9px;
            border: 1px solid;
            border-radius: 8px;
            padding: 11px 12px;
        }

        .settings-test-result.success {
            border-color: #a7f3d0;
            background: #ecfdf5;
            color: #047857;
        }

        .settings-test-result.error {
            border-color: #fecdd3;
            background: #fff1f2;
            color: #be123c;
        }

        .settings-test-result > div {
            display: grid;
            min-width: 0;
            gap: 2px;
        }

        .settings-test-result strong {
            font-size: 12px;
        }

        .settings-test-result span {
            font-size: 12px;
            line-height: 1.45;
            overflow-wrap: anywhere;
        }

        .chat-id-steps {
            display: grid;
            gap: 12px;
            margin: 0;
            padding: 0;
            list-style: none;
        }

        .chat-id-steps li {
            display: flex;
            align-items: flex-start;
            gap: 11px;
        }

        .chat-id-steps li > span {
            display: grid;
            flex: 0 0 28px;
            width: 28px;
            height: 28px;
            place-items: center;
            border-radius: 50%;
            background: #eff6ff;
            color: #1d4ed8;
            font-size: 12px;
            font-weight: 900;
        }

        .chat-id-steps li > div {
            display: grid;
            gap: 3px;
        }

        .chat-id-steps strong {
            color: #101828;
            font-size: 12px;
        }

        .chat-id-steps p {
            margin: 0;
            color: #667085;
            font-size: 12px;
            line-height: 1.55;
        }

        .chat-id-steps a {
            display: inline-flex;
            align-items: center;
            gap: 3px;
            color: #2563eb;
            font-weight: 800;
        }

        .ai-model-list {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-top: 14px;
        }

        .notice-box {
            display: flex;
            align-items: flex-start;
            gap: 10px;
            border: 1px solid #bfdbfe;
            border-radius: 8px;
            background: #eff6ff;
            color: #1e40af;
            font-size: 13px;
            line-height: 1.5;
            padding: 12px;
        }

        .notice-box.amber {
            border-color: #fed7aa;
            background: #fff7ed;
            color: #9a3412;
        }

        .user-modal-grid {
            display: grid;
            grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
            gap: 18px;
        }

        .empty-block {
            display: grid;
            min-height: 160px;
            place-items: center;
            gap: 8px;
            color: #667085;
            text-align: center;
        }

        .empty-block span {
            font-size: 13px;
            font-weight: 800;
        }

        .spin-icon {
            animation: panel-spin 900ms linear infinite;
        }

        @keyframes panel-spin {
            to {
                transform: rotate(360deg);
            }
        }

        @media (max-width: 1280px) {
            .panel-kpi-grid,
            .panel-kpi-grid.four {
                grid-template-columns: repeat(3, minmax(0, 1fr));
            }

            .collection-grid {
                grid-template-columns: repeat(4, minmax(0, 1fr));
            }
        }

        @media (max-width: 1040px) {
            .panel-sidebar {
                position: sticky;
                top: 0;
                width: 100%;
                height: auto;
                max-height: 44vh;
            }

            .panel-brand,
            .panel-sidebar-footer {
                display: none;
            }

            .panel-nav {
                display: flex;
                gap: 8px;
                overflow-x: auto;
                padding: 10px;
            }

            .panel-nav-section {
                display: none;
            }

            .panel-nav-item {
                flex: 0 0 auto;
                width: auto;
            }

            .panel-main {
                margin-left: 0;
                padding: 18px 16px 42px;
            }

            .command-hero,
            .panel-dashboard-grid,
            .panel-grid-2,
            .bank-overview-grid,
            .user-modal-grid {
                grid-template-columns: 1fr;
            }
        }

        @media (max-width: 760px) {
            .panel-page-header {
                display: grid;
            }

            .panel-kpi-grid,
            .panel-kpi-grid.three,
            .panel-kpi-grid.four,
            .snapshot-grid,
            .network-grid,
            .service-grid,
            .collection-grid {
                grid-template-columns: 1fr;
            }

            .command-health,
            .compact-row,
            .alert-row,
            .config-row,
            .service-state-row {
                align-items: flex-start;
            }

            .compact-row-value {
                margin-left: 0;
                text-align: left;
            }

            .panel-card-header {
                display: grid;
            }

            .ant-input-affix-wrapper,
            .toolbar-row .ant-select {
                width: 100% !important;
            }

            .settings-secret-row {
                grid-template-columns: 1fr;
            }

            .settings-field-grid {
                grid-template-columns: 1fr;
            }

            .settings-toggle-row {
                align-items: flex-start;
            }

            .settings-secret-row .panel-ghost-button,
            .settings-form .toolbar-row,
            .settings-form .toolbar-row button {
                width: 100%;
            }
        }
    `}</style>
);
