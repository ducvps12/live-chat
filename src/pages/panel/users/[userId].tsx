import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { Badge, Input, Modal, Select, Spin, Switch, Table, Tag, Tooltip, message } from 'antd';
import {
    Activity,
    ArrowLeft,
    CheckCircle,
    Copy,
    CreditCard,
    BarChart3,
    ExternalLink,
    Layers,
    Mail,
    Megaphone,
    Package,
    Receipt,
    RefreshCw,
    Save,
    Shield,
    Target,
    Trash2,
    UserX,
    Users,
    Landmark,
    Server,
    Settings,
    Timer,
    TrendingUp,
    Globe,
    ArrowDownLeft,
    XCircle,
    type LucideIcon,
} from 'lucide-react';
import { httpClient } from '../../../lib/http/client';
import { useGetMe } from '../../../domains/auth/auth.hooks';

type Tone = 'blue' | 'teal' | 'amber' | 'rose' | 'slate' | 'violet';
type UserEditTab = 'overview' | 'sessions' | 'workspaces' | 'plans' | 'commerce';

interface WorkspaceMini {
    id: string;
    name?: string;
    slug?: string;
}

interface WorkspaceMembership extends WorkspaceMini {
    plan?: string;
    role?: string;
    isActive?: boolean;
    createdAt?: string;
    joinedAt?: string;
    conversationCount?: number;
    widgetCount?: number;
    visitorCount?: number;
}

interface SessionRow {
    id: string;
    ipAddress?: string | null;
    userAgent?: string | null;
    createdAt?: string;
    expiresAt?: string;
    revokedAt?: string | null;
}

interface OrderRow {
    id: string;
    orderNumber?: string;
    customerName?: string;
    total?: number;
    status?: string;
    createdAt?: string;
    workspace?: WorkspaceMini;
}

interface InvoiceRow {
    id: string;
    invoiceNumber?: string;
    planId?: string;
    amount?: number;
    currency?: string;
    status?: string;
    billingCycle?: string;
    paidAt?: string | null;
    paymentMethod?: string | null;
    paymentReference?: string | null;
    description?: string | null;
    createdAt?: string;
    workspace?: WorkspaceMini;
}

interface SubscriptionRow {
    id: string;
    planId?: string;
    status?: string;
    billingCycle?: string;
    currentPeriodStart?: string;
    currentPeriodEnd?: string;
    trialEndsAt?: string | null;
    cancelledAt?: string | null;
    workspace?: WorkspaceMini;
    metadata?: { aiReplyQuota?: { used?: number; limit?: number | null } };
}

interface SubscriptionDraft {
    workspaceId: string;
    planId: string;
    status: string;
    billingCycle: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    aiReplyUsed: number;
}

const ADMIN_PLANS = [
    { value: 'trial', label: 'Dùng thử — 100 AI replies' },
    { value: 'starter', label: 'Khởi đầu — 500 AI replies' },
    { value: 'pro', label: 'Chuyên nghiệp — Không giới hạn' },
    { value: 'enterprise', label: 'Doanh nghiệp — Không giới hạn' },
];

const toDateInput = (value?: string | null) => {
    const date = value ? new Date(value) : new Date();
    return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
};

interface AdminUserDetail {
    id: string;
    name?: string;
    email?: string;
    role?: string;
    avatarUrl?: string | null;
    isActive?: boolean;
    createdAt?: string;
    updatedAt?: string;
    lastLogin?: string | null;
    lastIP?: string | null;
    lastDevice?: string | null;
    workspaceCount?: number;
    workspaces?: WorkspaceMembership[];
    sessions?: SessionRow[];
    sessionStats?: { total?: number; active?: number; revoked?: number; expired?: number };
    orders?: OrderRow[];
    invoices?: InvoiceRow[];
    subscriptions?: SubscriptionRow[];
    orderCount?: number;
    macroCount?: number;
    campaignCount?: number;
    productCount?: number;
    leadCount?: number;
    invoiceCount?: number;
    paidInvoiceCount?: number;
    subscriptionCount?: number;
    totalRevenue?: number;
    totalInvoicePaid?: number;
}

const fmtNum = (value?: number | null) => new Intl.NumberFormat('vi-VN').format(Number(value || 0));
const fmtVND = (value?: number | null) => `${new Intl.NumberFormat('vi-VN').format(Number(value || 0))} VND`;

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
    return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const compactDevice = (value?: string | null) => {
    if (!value) return 'Chưa có device';
    if (value.includes('Chrome')) return 'Chrome / Chromium';
    if (value.includes('Firefox')) return 'Firefox';
    if (value.includes('Safari')) return 'Safari';
    if (value.includes('Postman')) return 'Postman';
    return value.length > 82 ? `${value.slice(0, 82)}...` : value;
};

const sessionState = (row: SessionRow) => {
    if (row.revokedAt) return { label: 'Đã thu hồi', badge: 'error' as const };
    if (row.expiresAt && new Date(row.expiresAt) < new Date()) return { label: 'Hết hạn', badge: 'warning' as const };
    return { label: 'Đang hoạt động', badge: 'success' as const };
};

const copyText = async (value?: string | null) => {
    if (!value) return;
    try {
        await navigator.clipboard.writeText(value);
        message.success('Đã sao chép');
    } catch {
        message.error('Không thể sao chép');
    }
};

export default function AdminUserEditPage() {
    const router = useRouter();
    const userId = Array.isArray(router.query.userId) ? router.query.userId[0] : router.query.userId;
    const { data: meData, isLoading: meLoading } = useGetMe(true);
    const me = meData?.data?.user;

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [actionLoading, setActionLoading] = useState<'revoke' | 'delete' | null>(null);
    const [user, setUser] = useState<AdminUserDetail | null>(null);
    const [draft, setDraft] = useState<AdminUserDetail | null>(null);
    const [activeTab, setActiveTab] = useState<UserEditTab>('overview');
    const [planModalOpen, setPlanModalOpen] = useState(false);
    const [planSaving, setPlanSaving] = useState(false);
    const [subscriptionDraft, setSubscriptionDraft] = useState<SubscriptionDraft | null>(null);

    const fetchUser = useCallback(async () => {
        if (!userId) return;
        setLoading(true);
        try {
            const res = await httpClient.get(`/admin/users/${userId}`);
            if (!res.data?.success) throw new Error(res.data?.message || 'Không tải được user');
            const data = res.data.data as AdminUserDetail;
            setUser(data);
            setDraft(data);
        } catch (error: any) {
            message.error(error?.response?.data?.message || 'Không tải được thông tin user');
        } finally {
            setLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        if (!meLoading && me) {
            if (me.role !== 'admin') {
                message.error('Không có quyền truy cập');
                router.push('/');
                return;
            }
            fetchUser();
        }
    }, [meLoading, me, router, fetchUser]);

    const summary = useMemo(() => {
        const sessions = user?.sessionStats;
        return {
            activeSessions: sessions?.active || 0,
            totalSessions: sessions?.total || user?.sessions?.length || 0,
            workspaces: user?.workspaceCount || user?.workspaces?.length || 0,
            paidInvoices: user?.paidInvoiceCount || 0,
        };
    }, [user]);

    const updateDraft = (patch: Partial<AdminUserDetail>) => {
        setDraft((current) => current ? { ...current, ...patch } : current);
    };

    const saveUser = async () => {
        if (!draft?.id) return;
        if (!draft.name?.trim()) {
            message.warning('Tên user không được để trống');
            return;
        }
        if (!draft.email?.trim()) {
            message.warning('Email không được để trống');
            return;
        }

        setSaving(true);
        try {
            await httpClient.patch(`/admin/users/${draft.id}`, {
                name: draft.name.trim(),
                email: draft.email.trim(),
                role: draft.role || 'member',
                isActive: draft.isActive !== false,
            });
            message.success('Đã lưu thay đổi user');
            await fetchUser();
        } catch (error: any) {
            message.error(error?.response?.data?.message || 'Lỗi cập nhật user');
        } finally {
            setSaving(false);
        }
    };

    const revokeSessions = () => {
        if (!user?.id) return;
        Modal.confirm({
            title: 'Thu hồi toàn bộ phiên đăng nhập?',
            content: user.email,
            okText: 'Thu hồi',
            cancelText: 'Hủy',
            onOk: async () => {
                setActionLoading('revoke');
                try {
                    const res = await httpClient.post(`/admin/users/${user.id}/revoke-sessions`);
                    message.success(res.data?.message || 'Đã thu hồi phiên đăng nhập');
                    await fetchUser();
                } catch (error: any) {
                    message.error(error?.response?.data?.message || 'Không thể thu hồi phiên');
                } finally {
                    setActionLoading(null);
                }
            },
        });
    };

    const deleteUser = () => {
        if (!user?.id) return;
        Modal.confirm({
            title: 'Xóa user này?',
            content: user.email,
            okText: 'Xóa user',
            okButtonProps: { danger: true },
            cancelText: 'Hủy',
            onOk: async () => {
                setActionLoading('delete');
                try {
                    await httpClient.delete(`/admin/users/${user.id}`);
                    message.success('Đã xóa user');
                    router.push('/panel?tab=users');
                } catch (error: any) {
                    message.error(error?.response?.data?.message || 'Không thể xóa user');
                } finally {
                    setActionLoading(null);
                }
            },
        });
    };

    const openSubscriptionEditor = (workspace: WorkspaceMembership, subscription?: SubscriptionRow) => {
        const start = subscription?.currentPeriodStart ? new Date(subscription.currentPeriodStart) : new Date();
        const end = subscription?.currentPeriodEnd ? new Date(subscription.currentPeriodEnd) : new Date(Date.now() + 30 * 86400000);
        setSubscriptionDraft({
            workspaceId: workspace.id,
            planId: subscription?.planId || workspace.plan || 'trial',
            status: subscription?.status || 'active',
            billingCycle: subscription?.billingCycle || 'monthly',
            currentPeriodStart: toDateInput(start.toISOString()),
            currentPeriodEnd: toDateInput(end.toISOString()),
            aiReplyUsed: Number(subscription?.metadata?.aiReplyQuota?.used || 0),
        });
        setPlanModalOpen(true);
    };

    const saveSubscription = async () => {
        if (!user?.id || !subscriptionDraft) return;
        setPlanSaving(true);
        try {
            await httpClient.put(`/admin/users/${user.id}/subscriptions/${subscriptionDraft.workspaceId}`, subscriptionDraft);
            message.success('Đã cập nhật gói và quota AI auto-reply');
            setPlanModalOpen(false);
            await fetchUser();
        } catch (error: any) {
            message.error(error?.response?.data?.message || 'Không thể cập nhật gói');
        } finally {
            setPlanSaving(false);
        }
    };

    const removeSubscription = (workspaceId: string) => {
        if (!user?.id) return;
        Modal.confirm({
            title: 'Xóa gói của workspace?',
            content: 'Workspace sẽ trở về gói free và quota AI sẽ được tính lại.',
            okText: 'Xóa gói',
            okButtonProps: { danger: true },
            cancelText: 'Hủy',
            onOk: async () => {
                await httpClient.delete(`/admin/users/${user.id}/subscriptions/${workspaceId}`);
                message.success('Đã xóa gói');
                await fetchUser();
            },
        });
    };

    if (meLoading || !me || loading) {
        return <FullPageSpin />;
    }

    if (me.role !== 'admin') return null;

    if (!user || !draft) {
        return (
            <div className="admin-user-root">
                <EmptyState icon={UserX} title="Không tìm thấy user" />
                <AdminUserStyles />
            </div>
        );
    }

    return (
        <>
            <Head><title>Quản lý user | NemarkChat</title></Head>
            <div className="admin-user-root">
                <aside className="admin-user-sidebar">
                    <div className="admin-user-brand"><span><Shield size={18} /></span><div><strong>Admin Panel</strong><small>NemarkChat</small></div></div>
                    <nav>
                        {[
                            { label: 'Dashboard', icon: BarChart3, tab: 'dashboard' }, { label: 'Doanh thu', icon: TrendingUp, tab: 'revenue' },
                            { label: 'Hóa đơn', icon: Receipt, tab: 'invoices' }, { label: 'Users', icon: Users, tab: 'users', active: true },
                            { label: 'Workspaces', icon: Layers, tab: 'workspaces' }, { label: 'Auto Bank', icon: Landmark, tab: 'bank' },
                            { label: 'Hệ thống', icon: Server, tab: 'system' }, { label: 'Traffic', icon: Activity, tab: 'traffic' },
                            { label: 'Cron Link', icon: Timer, tab: 'cron' }, { label: 'Cài đặt', icon: Settings, tab: 'settings' },
                        ].map((item) => {
                            const Icon = item.icon;
                            return <button key={item.tab} className={item.active ? 'active' : ''} onClick={() => router.push(`/panel?tab=${item.tab}`)}><Icon size={17} />{item.label}</button>;
                        })}
                    </nav>
                    <div className="admin-user-sidebar-footer">
                        <small>{me.email}</small>
                        <button onClick={() => router.push('/')}><Globe size={14} /> Về Client</button>
                        <button onClick={() => router.push('/workspace')}><ArrowDownLeft size={14} /> Về Workspace</button>
                    </div>
                </aside>
                <main className="admin-user-shell">
                    <header className="admin-user-header">
                        <div>
                            <button className="admin-user-link-button" onClick={() => router.push('/panel?tab=users')}>
                                <ArrowLeft size={15} />
                                Users
                            </button>
                            <h1>Quản lý user</h1>
                            <p>{user.email || user.id}</p>
                        </div>
                        <div className="admin-user-actions">
                            <button className="admin-user-ghost-button" onClick={() => copyText(user.id)}>
                                <Copy size={15} />
                                Copy ID
                            </button>
                            <button className="admin-user-ghost-button" onClick={fetchUser}>
                                <RefreshCw size={15} />
                                Làm mới
                            </button>
                            <button className="admin-user-primary-button" onClick={saveUser} disabled={saving}>
                                <Save size={15} />
                                {saving ? 'Đang lưu' : 'Lưu thay đổi'}
                            </button>
                        </div>
                    </header>

                    <section className="admin-user-profile-band">
                        <div className="admin-user-avatar">
                            {user.avatarUrl ? <img src={user.avatarUrl} alt={user.name || user.email || 'User'} /> : <span>{(user.name || user.email || 'U').charAt(0).toUpperCase()}</span>}
                        </div>
                        <div className="admin-user-profile-copy">
                            <div className="admin-user-title-line">
                                <h2>{user.name || 'Chưa đặt tên'}</h2>
                                <StatusPill active={user.isActive !== false} />
                                <Tag color={user.role === 'admin' ? 'blue' : 'default'}>{user.role || 'member'}</Tag>
                            </div>
                            <p>{user.email}</p>
                            <div className="admin-user-mini-meta">
                                <span>Tạo lúc: {formatDateTime(user.createdAt)}</span>
                                <span>Cập nhật: {formatDateTime(user.updatedAt)}</span>
                                <span>Login cuối: {formatDateTime(user.lastLogin)}</span>
                            </div>
                        </div>
                    </section>

                    <div className="admin-user-kpi-grid">
                        <MetricCard icon={Layers} tone="blue" label="Workspaces" value={fmtNum(summary.workspaces)} meta={`${fmtNum(user.workspaces?.filter((row) => row.isActive !== false).length || 0)} active`} />
                        <MetricCard icon={Shield} tone="teal" label="Session active" value={`${fmtNum(summary.activeSessions)}/${fmtNum(summary.totalSessions)}`} meta={user.lastIP || 'Chưa có IP'} />
                        <MetricCard icon={CreditCard} tone="amber" label="Đơn hàng" value={fmtNum(user.orderCount || 0)} meta={fmtVND(user.totalRevenue || 0)} />
                        <MetricCard icon={Receipt} tone="violet" label="Invoice paid" value={`${fmtNum(summary.paidInvoices)}/${fmtNum(user.invoiceCount || 0)}`} meta={fmtVND(user.totalInvoicePaid || 0)} />
                    </div>

                    <div className="admin-user-tabs">
                        {[
                            ['overview', 'Hồ sơ'],
                            ['sessions', 'Theo dõi đăng nhập'],
                            ['workspaces', 'Workspaces'],
                            ['plans', 'Gói & quota AI'],
                            ['commerce', 'Đơn hàng & thanh toán'],
                        ].map(([key, label]) => (
                            <button key={key} className={activeTab === key ? 'active' : ''} onClick={() => setActiveTab(key as UserEditTab)}>
                                {label}
                            </button>
                        ))}
                    </div>

                    {activeTab === 'overview' && (
                        <div className="admin-user-grid">
                            <AdminCard title="Thông tin chỉnh sửa" subtitle="Name, email, role và trạng thái tài khoản">
                                <div className="admin-user-form">
                                    <label>Tên</label>
                                    <Input value={draft.name || ''} onChange={(event) => updateDraft({ name: event.target.value })} />
                                    <label>Email</label>
                                    <Input value={draft.email || ''} onChange={(event) => updateDraft({ email: event.target.value })} prefix={<Mail size={14} color="#667085" />} />
                                    <label>Role hệ thống</label>
                                    <Select
                                        value={draft.role || 'member'}
                                        onChange={(value) => updateDraft({ role: value })}
                                        options={[
                                            { value: 'admin', label: 'Admin' },
                                            { value: 'agent', label: 'Agent' },
                                            { value: 'member', label: 'Member' },
                                        ]}
                                    />
                                    <div className="admin-user-switch-row">
                                        <div>
                                            <strong>Trạng thái tài khoản</strong>
                                            <span>{draft.isActive === false ? 'Đang khóa đăng nhập' : 'Cho phép đăng nhập'}</span>
                                        </div>
                                        <Switch checked={draft.isActive !== false} onChange={(checked) => updateDraft({ isActive: checked })} checkedChildren="Active" unCheckedChildren="Off" />
                                    </div>
                                </div>
                            </AdminCard>

                            <div className="admin-user-stack">
                                <AdminCard title="Chỉ số quản trị" subtitle="Hoạt động nghiệp vụ gắn với user">
                                    <div className="admin-user-metric-list">
                                        <MetricLine icon={Target} label="Leads được gán" value={fmtNum(user.leadCount || 0)} tone="amber" />
                                        <MetricLine icon={Package} label="Products tạo" value={fmtNum(user.productCount || 0)} tone="blue" />
                                        <MetricLine icon={Megaphone} label="Campaigns" value={fmtNum(user.campaignCount || 0)} tone="violet" />
                                        <MetricLine icon={Activity} label="Macros" value={fmtNum(user.macroCount || 0)} tone="teal" />
                                    </div>
                                </AdminCard>

                                <AdminCard title="Hành động bảo mật" subtitle="Tác động trực tiếp tới phiên và tài khoản">
                                    <div className="admin-user-danger-actions">
                                        <button className="admin-user-ghost-button" onClick={revokeSessions} disabled={actionLoading === 'revoke'}>
                                            <Shield size={15} />
                                            {actionLoading === 'revoke' ? 'Đang thu hồi' : 'Thu hồi session'}
                                        </button>
                                        <button className="admin-user-danger-button" onClick={deleteUser} disabled={actionLoading === 'delete'}>
                                            <Trash2 size={15} />
                                            {actionLoading === 'delete' ? 'Đang xóa' : 'Xóa user'}
                                        </button>
                                    </div>
                                </AdminCard>
                            </div>
                        </div>
                    )}

                    {activeTab === 'sessions' && (
                        <AdminCard title="Theo dõi đăng nhập" subtitle={`${fmtNum(user.sessions?.length || 0)} phiên gần nhất`}>
                            <Table<SessionRow>
                                dataSource={user.sessions || []}
                                rowKey="id"
                                size="small"
                                pagination={{ pageSize: 10, showSizeChanger: true }}
                                scroll={{ x: 900 }}
                                columns={[
                                    {
                                        title: 'Trạng thái',
                                        dataIndex: 'revokedAt',
                                        width: 150,
                                        render: (_value: string | null, row) => {
                                            const state = sessionState(row);
                                            return <Badge status={state.badge} text={state.label} />;
                                        },
                                    },
                                    { title: 'Đăng nhập', dataIndex: 'createdAt', width: 180, render: (value: string) => <span className="admin-user-mono">{formatDateTime(value)}</span> },
                                    { title: 'Hết hạn', dataIndex: 'expiresAt', width: 180, render: (value: string) => <span className="admin-user-mono">{formatDateTime(value)}</span> },
                                    { title: 'IP', dataIndex: 'ipAddress', width: 150, render: (value: string) => value || 'Chưa có' },
                                    {
                                        title: 'Device',
                                        dataIndex: 'userAgent',
                                        render: (value: string) => (
                                            <Tooltip title={value || 'Chưa có device'}>
                                                <span className="admin-user-device">{compactDevice(value)}</span>
                                            </Tooltip>
                                        ),
                                    },
                                ]}
                            />
                        </AdminCard>
                    )}

                    {activeTab === 'workspaces' && (
                        <AdminCard title="Workspaces của user" subtitle={`${fmtNum(user.workspaces?.length || 0)} workspace`}>
                            <Table<WorkspaceMembership>
                                dataSource={user.workspaces || []}
                                rowKey="id"
                                size="small"
                                pagination={{ pageSize: 10, showSizeChanger: true }}
                                scroll={{ x: 980 }}
                                columns={[
                                    {
                                        title: 'Workspace',
                                        dataIndex: 'name',
                                        render: (value: string, row) => (
                                            <div className="admin-user-table-title">
                                                <strong>{value || 'Workspace'}</strong>
                                                <span>{row.slug || row.id}</span>
                                            </div>
                                        ),
                                    },
                                    { title: 'Role', dataIndex: 'role', width: 120, render: (value: string) => <Tag color={value === 'owner' || value === 'admin' ? 'blue' : 'default'}>{value || 'member'}</Tag> },
                                    { title: 'Plan', dataIndex: 'plan', width: 120, render: (value: string) => <Tag>{value || 'free'}</Tag> },
                                    { title: 'Hội thoại', dataIndex: 'conversationCount', width: 120, align: 'right' as const, render: (value: number) => fmtNum(value || 0) },
                                    { title: 'Widgets', dataIndex: 'widgetCount', width: 110, align: 'right' as const, render: (value: number) => fmtNum(value || 0) },
                                    { title: 'Visitors', dataIndex: 'visitorCount', width: 110, align: 'right' as const, render: (value: number) => fmtNum(value || 0) },
                                    { title: 'Tham gia', dataIndex: 'joinedAt', width: 150, render: (value: string) => <span className="admin-user-mono">{formatShortDate(value)}</span> },
                                    { title: 'Trạng thái', dataIndex: 'isActive', width: 130, render: (value: boolean | undefined) => <StatusPill active={value !== false} /> },
                                    {
                                        title: '',
                                        key: 'action',
                                        width: 110,
                                        fixed: 'right' as const,
                                        render: (_value: unknown, row) => (
                                            <button className="admin-user-table-button" onClick={() => router.push(`/workspace/${row.id}`)}>
                                                <ExternalLink size={14} />
                                                Mở
                                            </button>
                                        ),
                                    },
                                ]}
                            />
                        </AdminCard>
                    )}

                    {activeTab === 'plans' && (
                        <AdminCard title="Gói thuê bao & quota AI auto-reply" subtitle="Tạo hoặc chỉnh gói sau khi xác nhận khách đã thanh toán">
                            <Table<WorkspaceMembership>
                                dataSource={user.workspaces || []}
                                rowKey="id"
                                size="small"
                                pagination={false}
                                scroll={{ x: 900 }}
                                columns={[
                                    { title: 'Workspace', dataIndex: 'name', render: (value: string, row) => <div className="admin-user-table-title"><strong>{value}</strong><span>{row.slug || row.id}</span></div> },
                                    {
                                        title: 'Gói hiện tại', width: 150, render: (_: unknown, row) => {
                                            const sub = user.subscriptions?.find((item) => item.workspace?.id === row.id);
                                            return <Tag color={sub?.status === 'active' ? 'green' : 'default'}>{sub?.planId || row.plan || 'free'}</Tag>;
                                        },
                                    },
                                    {
                                        title: 'AI auto-reply', width: 180, render: (_: unknown, row) => {
                                            const quota = user.subscriptions?.find((item) => item.workspace?.id === row.id)?.metadata?.aiReplyQuota;
                                            return <strong>{fmtNum(quota?.used || 0)} / {quota?.limit == null ? '∞' : fmtNum(quota.limit)}</strong>;
                                        },
                                    },
                                    { title: 'Hết hạn', width: 140, render: (_: unknown, row) => formatShortDate(user.subscriptions?.find((item) => item.workspace?.id === row.id)?.currentPeriodEnd) },
                                    {
                                        title: '', width: 210, render: (_: unknown, row) => {
                                            const sub = user.subscriptions?.find((item) => item.workspace?.id === row.id);
                                            return <div className="admin-user-row-actions">
                                                <button className="admin-user-table-button" onClick={() => openSubscriptionEditor(row, sub)}>{sub ? 'Sửa gói' : 'Thêm gói'}</button>
                                                {sub && <button className="admin-user-mini-danger" onClick={() => removeSubscription(row.id)}>Xóa</button>}
                                            </div>;
                                        },
                                    },
                                ]}
                            />
                        </AdminCard>
                    )}

                    {activeTab === 'commerce' && (
                        <div className="admin-user-stack">
                            <AdminCard title="Đơn hàng gần đây" subtitle={`${fmtNum(user.orders?.length || 0)} đơn mới nhất`}>
                                <Table<OrderRow>
                                    dataSource={user.orders || []}
                                    rowKey="id"
                                    size="small"
                                    pagination={{ pageSize: 8, showSizeChanger: true }}
                                    scroll={{ x: 840 }}
                                    columns={[
                                        { title: 'Mã đơn', dataIndex: 'orderNumber', width: 140, render: (value: string) => <Tag color="blue">{value || 'N/A'}</Tag> },
                                        { title: 'Khách hàng', dataIndex: 'customerName', render: (value: string, row) => <span>{value || row.workspace?.name || 'Chưa có'}</span> },
                                        { title: 'Workspace', dataIndex: ['workspace', 'name'], width: 180, render: (_value: string, row) => row.workspace?.name || 'Chưa có' },
                                        { title: 'Tổng tiền', dataIndex: 'total', width: 150, align: 'right' as const, render: (value: number) => <strong>{fmtVND(value || 0)}</strong> },
                                        { title: 'Trạng thái', dataIndex: 'status', width: 130, render: (value: string) => <Tag>{value || 'draft'}</Tag> },
                                        { title: 'Tạo lúc', dataIndex: 'createdAt', width: 170, render: (value: string) => <span className="admin-user-mono">{formatDateTime(value)}</span> },
                                    ]}
                                />
                            </AdminCard>

                            <div className="admin-user-grid">
                                <AdminCard title="Invoices" subtitle={`${fmtNum(user.invoices?.length || 0)} hóa đơn workspace`}>
                                    <Table<InvoiceRow>
                                        dataSource={user.invoices || []}
                                        rowKey="id"
                                        size="small"
                                        pagination={{ pageSize: 6 }}
                                        scroll={{ x: 720 }}
                                        columns={[
                                            { title: 'Invoice', dataIndex: 'invoiceNumber', width: 140, render: (value: string) => <Tag color="blue">{value || 'N/A'}</Tag> },
                                            { title: 'Workspace', dataIndex: ['workspace', 'name'], render: (_value: string, row) => row.workspace?.name || 'Chưa có' },
                                            { title: 'Amount', dataIndex: 'amount', width: 140, align: 'right' as const, render: (value: number) => fmtVND(value || 0) },
                                            { title: 'Status', dataIndex: 'status', width: 110, render: (value: string) => <Tag color={value === 'paid' ? 'green' : 'default'}>{value || 'pending'}</Tag> },
                                        ]}
                                    />
                                </AdminCard>

                                <AdminCard title="Subscriptions" subtitle={`${fmtNum(user.subscriptions?.length || 0)} gói đang ghi nhận`}>
                                    <Table<SubscriptionRow>
                                        dataSource={user.subscriptions || []}
                                        rowKey="id"
                                        size="small"
                                        pagination={{ pageSize: 6 }}
                                        scroll={{ x: 680 }}
                                        columns={[
                                            { title: 'Workspace', dataIndex: ['workspace', 'name'], render: (_value: string, row) => row.workspace?.name || 'Chưa có' },
                                            { title: 'Plan', dataIndex: 'planId', width: 120, render: (value: string) => <Tag>{value || 'trial'}</Tag> },
                                            { title: 'Cycle', dataIndex: 'billingCycle', width: 110, render: (value: string) => value || 'monthly' },
                                            { title: 'Status', dataIndex: 'status', width: 120, render: (value: string) => <Tag color={value === 'active' ? 'green' : 'default'}>{value || 'active'}</Tag> },
                                            { title: 'Hết kỳ', dataIndex: 'currentPeriodEnd', width: 150, render: (value: string) => <span className="admin-user-mono">{formatShortDate(value)}</span> },
                                        ]}
                                    />
                                </AdminCard>
                            </div>
                        </div>
                    )}
                </main>
            </div>
            <Modal title="Điều chỉnh gói khách hàng" open={planModalOpen} onCancel={() => setPlanModalOpen(false)}
                onOk={saveSubscription} okText="Lưu gói" cancelText="Hủy" confirmLoading={planSaving}>
                {subscriptionDraft && <div className="admin-user-plan-form">
                    <label>Workspace</label>
                    <Input disabled value={user.workspaces?.find((row) => row.id === subscriptionDraft.workspaceId)?.name || subscriptionDraft.workspaceId} />
                    <label>Loại gói</label>
                    <Select value={subscriptionDraft.planId} options={ADMIN_PLANS} onChange={(planId) => setSubscriptionDraft({ ...subscriptionDraft, planId })} />
                    <div className="admin-user-plan-grid">
                        <div><label>Trạng thái</label><Select value={subscriptionDraft.status} options={[
                            { value: 'active', label: 'Đang hoạt động' }, { value: 'expired', label: 'Hết hạn' },
                            { value: 'past_due', label: 'Chờ thanh toán' }, { value: 'cancelled', label: 'Đã hủy' },
                        ]} onChange={(status) => setSubscriptionDraft({ ...subscriptionDraft, status })} /></div>
                        <div><label>Chu kỳ</label><Select value={subscriptionDraft.billingCycle} options={[
                            { value: 'monthly', label: 'Theo tháng' }, { value: 'yearly', label: 'Theo năm' },
                        ]} onChange={(billingCycle) => setSubscriptionDraft({ ...subscriptionDraft, billingCycle })} /></div>
                    </div>
                    <div className="admin-user-plan-grid">
                        <div><label>Bắt đầu</label><Input type="date" value={subscriptionDraft.currentPeriodStart} onChange={(e) => setSubscriptionDraft({ ...subscriptionDraft, currentPeriodStart: e.target.value })} /></div>
                        <div><label>Hết hạn</label><Input type="date" value={subscriptionDraft.currentPeriodEnd} onChange={(e) => setSubscriptionDraft({ ...subscriptionDraft, currentPeriodEnd: e.target.value })} /></div>
                    </div>
                    <label>Số lượt AI auto-reply đã dùng trong kỳ</label>
                    <Input type="number" min={0} value={subscriptionDraft.aiReplyUsed} onChange={(e) => setSubscriptionDraft({ ...subscriptionDraft, aiReplyUsed: Math.max(0, Number(e.target.value) || 0) })} />
                    <p className="admin-user-plan-note">Giới hạn theo gói: Dùng thử 100, Khởi đầu 500, Chuyên nghiệp/Doanh nghiệp không giới hạn.</p>
                </div>}
            </Modal>
            <AdminUserStyles />
        </>
    );
}

const FullPageSpin = () => (
    <div className="admin-user-full-spin">
        <Spin size="large" />
        <AdminUserStyles />
    </div>
);

const MetricCard = ({ icon: Icon, tone, label, value, meta }: { icon: LucideIcon; tone: Tone; label: string; value: string; meta?: string }) => (
    <div className={`admin-user-metric-card tone-${tone}`}>
        <div className="admin-user-metric-icon"><Icon size={19} /></div>
        <div>
            <span>{label}</span>
            <strong>{value}</strong>
            {meta && <small>{meta}</small>}
        </div>
    </div>
);

const MetricLine = ({ icon: Icon, label, value, tone }: { icon: LucideIcon; label: string; value: string; tone: Tone }) => (
    <div className={`admin-user-metric-line tone-${tone}`}>
        <div><Icon size={15} /></div>
        <span>{label}</span>
        <strong>{value}</strong>
    </div>
);

const AdminCard = ({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) => (
    <section className="admin-user-card">
        <div className="admin-user-card-header">
            <div>
                <h3>{title}</h3>
                {subtitle && <p>{subtitle}</p>}
            </div>
        </div>
        {children}
    </section>
);

const StatusPill = ({ active }: { active: boolean }) => (
    <span className={`admin-user-status-pill ${active ? 'active' : 'inactive'}`}>
        {active ? <CheckCircle size={13} /> : <XCircle size={13} />}
        {active ? 'Active' : 'Inactive'}
    </span>
);

const EmptyState = ({ icon: Icon, title }: { icon: LucideIcon; title: string }) => (
    <div className="admin-user-empty">
        <Icon size={28} />
        <span>{title}</span>
    </div>
);

const AdminUserStyles = () => (
    <style jsx global>{`
        .admin-user-root,
        .admin-user-full-spin {
            min-height: 100vh;
            background: #f5f7fb;
            color: #101828;
            font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        .admin-user-root {
            display: grid;
            grid-template-columns: 264px minmax(0, 1fr);
        }

        .admin-user-sidebar {
            position: sticky;
            top: 0;
            display: flex;
            height: 100vh;
            flex-direction: column;
            background: #101828;
            color: #fff;
        }

        .admin-user-brand {
            display: flex;
            align-items: center;
            gap: 11px;
            min-height: 84px;
            padding: 0 18px;
            border-bottom: 1px solid #273246;
        }

        .admin-user-brand > span {
            display: grid;
            width: 38px;
            height: 38px;
            place-items: center;
            border-radius: 9px;
            background: #2563eb;
        }

        .admin-user-brand div { display: grid; gap: 2px; }
        .admin-user-brand strong { font-size: 15px; }
        .admin-user-brand small { color: #9fb0ca; font-size: 11px; }
        .admin-user-sidebar nav { display: grid; gap: 3px; padding: 20px 13px; }
        .admin-user-sidebar nav button,
        .admin-user-sidebar-footer button {
            display: flex;
            align-items: center;
            gap: 10px;
            min-height: 40px;
            padding: 0 11px;
            border: 1px solid transparent;
            border-radius: 8px;
            background: transparent;
            color: #d5deec;
            cursor: pointer;
            font-size: 13px;
            font-weight: 750;
        }
        .admin-user-sidebar nav button:hover,
        .admin-user-sidebar nav button.active { border-color: #315da4; background: #19335f; color: #fff; }
        .admin-user-sidebar-footer { display: grid; gap: 4px; margin-top: auto; padding: 17px 14px 22px; border-top: 1px solid #273246; }
        .admin-user-sidebar-footer small { overflow: hidden; padding: 0 3px 10px; color: #9fb0ca; text-overflow: ellipsis; white-space: nowrap; }

        .admin-user-full-spin {
            display: grid;
            place-items: center;
        }

        .admin-user-shell {
            display: grid;
            gap: 18px;
            width: min(1480px, calc(100% - 48px));
            margin: 0 auto;
            padding: 24px 0 56px;
        }

        .admin-user-row-actions { display: flex; align-items: center; gap: 8px; }
        .admin-user-mini-danger { border: 0; background: transparent; color: #be123c; cursor: pointer; font-weight: 750; }
        .admin-user-plan-form { display: grid; gap: 9px; padding-top: 8px; }
        .admin-user-plan-form label { color: #344054; font-size: 12px; font-weight: 800; }
        .admin-user-plan-form .ant-select { width: 100%; }
        .admin-user-plan-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .admin-user-plan-grid > div { display: grid; gap: 7px; }
        .admin-user-plan-note { margin: 3px 0 0; color: #667085; font-size: 12px; line-height: 1.5; }

        @media (max-width: 980px) {
            .admin-user-root { grid-template-columns: 1fr; }
            .admin-user-sidebar { position: relative; height: auto; }
            .admin-user-sidebar nav { grid-template-columns: repeat(5, minmax(0, 1fr)); }
            .admin-user-sidebar-footer { display: none; }
        }

        @media (max-width: 640px) {
            .admin-user-sidebar nav { grid-template-columns: repeat(2, minmax(0, 1fr)); }
            .admin-user-plan-grid { grid-template-columns: 1fr; }
        }

        .admin-user-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 18px;
        }

        .admin-user-header h1 {
            margin: 9px 0 4px;
            color: #101828;
            font-size: 28px;
            font-weight: 850;
            line-height: 1.15;
        }

        .admin-user-header p,
        .admin-user-profile-copy p,
        .admin-user-card p {
            margin: 0;
            color: #667085;
            font-size: 13px;
        }

        .admin-user-actions,
        .admin-user-title-line,
        .admin-user-mini-meta,
        .admin-user-danger-actions {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: 10px;
        }

        .admin-user-link-button,
        .admin-user-primary-button,
        .admin-user-ghost-button,
        .admin-user-danger-button,
        .admin-user-table-button {
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
            white-space: nowrap;
        }

        .admin-user-link-button {
            height: 30px;
            border: 0;
            background: transparent;
            color: #2563eb;
            padding: 0;
        }

        .admin-user-primary-button {
            border: 1px solid #2563eb;
            background: #2563eb;
            color: #fff;
        }

        .admin-user-primary-button:hover {
            border-color: #1d4ed8;
            background: #1d4ed8;
        }

        .admin-user-ghost-button,
        .admin-user-table-button {
            border: 1px solid #d0d5dd;
            background: #fff;
            color: #344054;
        }

        .admin-user-ghost-button:hover,
        .admin-user-table-button:hover {
            border-color: #93c5fd;
            background: #eff6ff;
            color: #1d4ed8;
        }

        .admin-user-danger-button {
            border: 1px solid #fecdd3;
            background: #fff1f2;
            color: #be123c;
        }

        .admin-user-primary-button:disabled,
        .admin-user-ghost-button:disabled,
        .admin-user-danger-button:disabled {
            cursor: not-allowed;
            opacity: 0.68;
        }

        .admin-user-profile-band,
        .admin-user-card,
        .admin-user-metric-card {
            border: 1px solid #dde4ef;
            border-radius: 8px;
            background: #fff;
            box-shadow: 0 1px 2px rgba(16, 24, 40, 0.04);
        }

        .admin-user-profile-band {
            display: flex;
            align-items: center;
            gap: 18px;
            padding: 18px;
        }

        .admin-user-avatar {
            display: grid;
            width: 76px;
            height: 76px;
            flex: 0 0 auto;
            overflow: hidden;
            place-items: center;
            border-radius: 8px;
            background: #eff6ff;
            color: #1d4ed8;
            font-size: 30px;
            font-weight: 900;
        }

        .admin-user-avatar img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }

        .admin-user-profile-copy {
            display: grid;
            min-width: 0;
            gap: 6px;
        }

        .admin-user-profile-copy h2 {
            margin: 0;
            color: #101828;
            font-size: 24px;
            font-weight: 880;
            line-height: 1.15;
        }

        .admin-user-mini-meta span {
            color: #667085;
            font-size: 12px;
            font-weight: 700;
        }

        .admin-user-kpi-grid {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 14px;
        }

        .admin-user-metric-card {
            display: flex;
            min-width: 0;
            align-items: center;
            gap: 12px;
            min-height: 112px;
            padding: 16px;
        }

        .admin-user-metric-card span,
        .admin-user-card label {
            display: block;
            color: #667085;
            font-size: 12px;
            font-weight: 800;
            text-transform: uppercase;
        }

        .admin-user-metric-card strong {
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

        .admin-user-metric-card small {
            display: block;
            overflow: hidden;
            margin-top: 7px;
            color: #667085;
            font-size: 12px;
            font-weight: 700;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .admin-user-metric-icon,
        .admin-user-metric-line div {
            display: grid;
            width: 36px;
            height: 36px;
            flex: 0 0 auto;
            place-items: center;
            border-radius: 8px;
        }

        .tone-blue .admin-user-metric-icon,
        .tone-blue.admin-user-metric-line div {
            background: #eff6ff;
            color: #2563eb;
        }

        .tone-teal .admin-user-metric-icon,
        .tone-teal.admin-user-metric-line div {
            background: #ecfdf5;
            color: #0f766e;
        }

        .tone-amber .admin-user-metric-icon,
        .tone-amber.admin-user-metric-line div {
            background: #fffbeb;
            color: #b45309;
        }

        .tone-violet .admin-user-metric-icon,
        .tone-violet.admin-user-metric-line div {
            background: #f5f3ff;
            color: #6d28d9;
        }

        .tone-rose .admin-user-metric-icon,
        .tone-rose.admin-user-metric-line div {
            background: #fff1f2;
            color: #be123c;
        }

        .tone-slate .admin-user-metric-icon,
        .tone-slate.admin-user-metric-line div {
            background: #f1f5f9;
            color: #475467;
        }

        .admin-user-tabs {
            display: inline-flex;
            width: fit-content;
            max-width: 100%;
            overflow-x: auto;
            border: 1px solid #d0d5dd;
            border-radius: 8px;
            background: #fff;
            padding: 4px;
        }

        .admin-user-tabs button {
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

        .admin-user-tabs button.active {
            background: #eff6ff;
            color: #1d4ed8;
        }

        .admin-user-grid {
            display: grid;
            grid-template-columns: minmax(0, 1fr) minmax(360px, 0.82fr);
            gap: 18px;
        }

        .admin-user-stack,
        .admin-user-form,
        .admin-user-metric-list {
            display: grid;
            gap: 12px;
        }

        .admin-user-card {
            min-width: 0;
            padding: 18px;
        }

        .admin-user-card-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 14px;
            margin-bottom: 16px;
        }

        .admin-user-card h3 {
            margin: 0;
            color: #101828;
            font-size: 16px;
            font-weight: 850;
            line-height: 1.25;
        }

        .admin-user-switch-row,
        .admin-user-metric-line {
            display: flex;
            min-width: 0;
            align-items: center;
            gap: 12px;
            border: 1px solid #eef2f7;
            border-radius: 8px;
            background: #f8fafc;
            padding: 12px;
        }

        .admin-user-switch-row {
            justify-content: space-between;
        }

        .admin-user-switch-row strong,
        .admin-user-switch-row span,
        .admin-user-table-title strong,
        .admin-user-table-title span {
            display: block;
        }

        .admin-user-switch-row strong,
        .admin-user-table-title strong {
            color: #101828;
            font-size: 13px;
            font-weight: 800;
        }

        .admin-user-switch-row span,
        .admin-user-table-title span {
            margin-top: 3px;
            color: #667085;
            font-size: 12px;
        }

        .admin-user-metric-line {
            justify-content: space-between;
        }

        .admin-user-metric-line span {
            flex: 1;
            color: #475467;
            font-size: 12px;
            font-weight: 700;
        }

        .admin-user-metric-line strong {
            color: #101828;
            font-size: 13px;
        }

        .admin-user-status-pill {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            height: 26px;
            border-radius: 999px;
            font-size: 12px;
            font-weight: 800;
            padding: 0 10px;
        }

        .admin-user-status-pill.active {
            background: #ecfdf5;
            color: #0f766e;
        }

        .admin-user-status-pill.inactive {
            background: #fff1f2;
            color: #be123c;
        }

        .admin-user-mono {
            color: #475467;
            font-family: "SFMono-Regular", Consolas, monospace;
            font-size: 12px;
        }

        .admin-user-device,
        .admin-user-table-title {
            display: block;
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .admin-user-empty {
            display: grid;
            min-height: 100vh;
            place-items: center;
            gap: 10px;
            color: #667085;
            font-weight: 800;
        }

        @media (max-width: 1040px) {
            .admin-user-shell {
                width: min(100% - 32px, 920px);
                padding-top: 18px;
            }

            .admin-user-header,
            .admin-user-profile-band {
                display: grid;
            }

            .admin-user-kpi-grid,
            .admin-user-grid {
                grid-template-columns: 1fr;
            }
        }

        @media (max-width: 720px) {
            .admin-user-actions,
            .admin-user-actions > button,
            .admin-user-danger-actions,
            .admin-user-danger-actions > button {
                width: 100%;
            }

            .admin-user-tabs {
                width: 100%;
            }

            .admin-user-tabs button {
                flex: 1 0 auto;
            }
        }
    `}</style>
);
