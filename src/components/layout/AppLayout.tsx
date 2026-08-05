import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { Avatar, Badge, Dropdown, Spin } from 'antd';
import { useQuery } from '@tanstack/react-query';
import {
    BarChart3,
    Bell,
    Bot,
    Box,
    ChevronDown,
    CreditCard,
    GitBranch,
    Globe2,
    Headphones,
    Inbox,
    LayoutDashboard,
    LogOut,
    Megaphone,
    Menu as MenuIcon,
    Package,
    PanelTop,
    PanelLeftClose,
    PanelLeftOpen,
    Radar,
    Search,
    Settings,
    Shield,
    ShoppingBag,
    Sparkles,
    Target,
    Users,
    Workflow,
    X,
    Zap,
    type LucideIcon,
} from 'lucide-react';
import { useGetMe, useLogout } from '../../domains/auth/auth.hooks';
import { useTotalUnreadCount } from '../../domains/conversation';
import { useMyWorkspaces } from '../../domains/workspace/workspace.hooks';
import { signalRadarAPI } from '../../services/signal-radar.service';

interface AppLayoutProps {
    children: React.ReactNode;
    hideHeader?: boolean;
    headerTitle?: React.ReactNode;
    headerExtra?: React.ReactNode;
}

type NavItem = {
    key: string;
    label: string;
    href: string;
    icon: LucideIcon;
    badge?: number;
};

type NavSection = {
    label: string;
    items: NavItem[];
};

type WorkspaceSummary = {
    id?: string;
    _id?: string;
    name: string;
    ownerId?: string;
    plan?: string;
    members?: Array<{
        userId: string;
        role: string;
    }>;
};

const getWorkspaceSummaryId = (workspace: WorkspaceSummary) => workspace.id || workspace._id || '';

const navLabelStyle: React.CSSProperties = {
    margin: '18px 14px 8px',
    color: 'rgba(226, 232, 240, 0.52)',
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
};

export default function AppLayout({ children, hideHeader = false, headerTitle, headerExtra }: AppLayoutProps) {
    const router = useRouter();
    const [collapsed, setCollapsed] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const workspaceId = typeof router.query.workspaceId === 'string' ? router.query.workspaceId : undefined;

    const { data: meData, isLoading: meLoading } = useGetMe(true);
    const { data: wsData } = useMyWorkspaces();
    const { mutateAsync: logout } = useLogout();
    const { data: unreadData } = useTotalUnreadCount(workspaceId || '', Boolean(workspaceId && meData));

    const user = meData?.data?.user;
    const workspaces = (wsData?.data || []) as unknown as WorkspaceSummary[];
    const unreadCount = unreadData?.totalUnread || 0;
    const currentWorkspace = workspaces.find((workspace) => getWorkspaceSummaryId(workspace) === workspaceId);
    const currentPath = router.asPath.split('?')[0];
    const currentMembership = currentWorkspace?.members?.find((member) => member.userId === user?.id);
    const canManageCurrentWorkspace = Boolean(
        workspaceId
        && (
            user?.role === 'admin'
            || currentWorkspace?.ownerId === user?.id
            || currentMembership?.role === 'owner'
            || currentMembership?.role === 'admin'
        )
    );
    const { data: radarEntitlements } = useQuery({
        queryKey: ['signal-radar', 'navigation-entitlements', workspaceId],
        queryFn: () => signalRadarAPI.entitlements(workspaceId || ''),
        enabled: canManageCurrentWorkspace,
        staleTime: 5 * 60_000,
        retry: false,
    });
    const showWorkspaceRadar = canManageCurrentWorkspace && radarEntitlements?.active === true;

    const navSections = useMemo<NavSection[]>(() => {
        if (!workspaceId) {
            return [
                {
                    label: 'Tài khoản',
                    items: [
                        { key: '/workspace', label: 'Workspaces', href: '/workspace', icon: Box },
                    ],
                },
            ];
        }

        if (user?.role !== 'admin') {
            return [
                {
                    label: 'Vận hành chat',
                    items: [
                        { key: `/workspace/${workspaceId}`, label: 'Tổng quan', href: `/workspace/${workspaceId}`, icon: LayoutDashboard },
                        { key: `/workspace/${workspaceId}/inbox`, label: 'Inbox CSKH', href: `/workspace/${workspaceId}/inbox`, icon: Inbox, badge: unreadCount },
                        { key: `/workspace/${workspaceId}/contacts`, label: 'Khách hàng 360', href: `/workspace/${workspaceId}/contacts`, icon: Users },
                        { key: `/workspace/${workspaceId}/macros`, label: 'Mẫu trả lời', href: `/workspace/${workspaceId}/macros`, icon: Zap },
                    ],
                },
                ...(showWorkspaceRadar
                    ? [{
                        label: 'AI COPILOT',
                        items: [
                            { key: `/workspace/${workspaceId}/radar`, label: 'Radar tín hiệu', href: `/workspace/${workspaceId}/radar`, icon: Radar },
                        ],
                    }]
                    : []),
            ];
        }

        return [
            {
                label: 'Vận hành',
                items: [
                    { key: `/workspace/${workspaceId}`, label: 'Tổng quan', href: `/workspace/${workspaceId}`, icon: LayoutDashboard },
                    { key: `/workspace/${workspaceId}/inbox`, label: 'Inbox CSKH', href: `/workspace/${workspaceId}/inbox`, icon: Inbox, badge: unreadCount },
                    { key: `/workspace/${workspaceId}/contacts`, label: 'Khách hàng 360', href: `/workspace/${workspaceId}/contacts`, icon: Users },
                    { key: `/workspace/${workspaceId}/leads`, label: 'Leads', href: `/workspace/${workspaceId}/leads`, icon: Target },
                    { key: `/workspace/${workspaceId}/analytics`, label: 'Báo cáo', href: `/workspace/${workspaceId}/analytics`, icon: BarChart3 },
                ],
            },
            {
                label: 'AI COPILOT',
                items: [
                    { key: `/workspace/${workspaceId}/chatbot`, label: 'Trung tâm AI', href: `/workspace/${workspaceId}/chatbot`, icon: Bot },
                    { key: `/workspace/${workspaceId}/zalo-bot-studio`, label: 'Zalo Bot Studio', href: `/workspace/${workspaceId}/zalo-bot-studio`, icon: Bot },
                    { key: `/workspace/${workspaceId}/ai-api`, label: 'API & Tự động hoá', href: `/workspace/${workspaceId}/ai-api`, icon: Workflow },
                    { key: `/workspace/${workspaceId}/radar`, label: 'Radar tín hiệu', href: `/workspace/${workspaceId}/radar`, icon: Radar },
                    { key: `/workspace/${workspaceId}/knowledge`, label: 'Kho tri thức', href: `/workspace/${workspaceId}/knowledge`, icon: Sparkles },
                    { key: `/workspace/${workspaceId}/macros`, label: 'Mẫu trả lời', href: `/workspace/${workspaceId}/macros`, icon: Zap },
                    { key: `/workspace/${workspaceId}/campaigns`, label: 'Automation Hub', href: `/workspace/${workspaceId}/campaigns`, icon: Megaphone },
                    { key: `/workspace/${workspaceId}/distribution`, label: 'Phân phối hội thoại', href: `/workspace/${workspaceId}/distribution`, icon: Workflow },
                ],
            },
            {
                label: 'Doanh thu',
                items: [
                    { key: `/workspace/${workspaceId}/products`, label: 'Sản phẩm', href: `/workspace/${workspaceId}/products`, icon: Package },
                    { key: `/workspace/${workspaceId}/orders`, label: 'Đơn hàng', href: `/workspace/${workspaceId}/orders`, icon: ShoppingBag },
                    { key: `/workspace/${workspaceId}/billing`, label: 'Gói & thanh toán', href: `/workspace/${workspaceId}/billing`, icon: CreditCard },
                ],
            },
            {
                label: 'Cấu hình',
                items: [
                    { key: `/workspace/${workspaceId}/channels`, label: 'Kết nối kênh', href: `/workspace/${workspaceId}/channels`, icon: Globe2 },
                    { key: `/workspace/${workspaceId}/widgets`, label: 'Widget website', href: `/workspace/${workspaceId}/widgets`, icon: PanelTop },
                    { key: `/workspace/${workspaceId}/teams`, label: 'Đội ngũ', href: `/workspace/${workspaceId}/teams`, icon: Users },
                    { key: `/workspace/${workspaceId}/business-hours`, label: 'Giờ làm việc', href: `/workspace/${workspaceId}/business-hours`, icon: GitBranch },
                    { key: `/workspace/${workspaceId}/settings`, label: 'Thiết lập', href: `/workspace/${workspaceId}/settings`, icon: Settings },
                ],
            },
        ];
    }, [workspaceId, unreadCount, user?.role, showWorkspaceRadar]);

    const mobileBottomItems = useMemo<NavItem[]>(() => {
        if (!workspaceId) {
            return [
                { key: '/workspace', label: 'Workspace', href: '/workspace', icon: Box },
            ];
        }

        const baseItems: NavItem[] = [
            { key: `/workspace/${workspaceId}`, label: 'Tổng quan', href: `/workspace/${workspaceId}`, icon: LayoutDashboard },
            { key: `/workspace/${workspaceId}/inbox`, label: 'Inbox', href: `/workspace/${workspaceId}/inbox`, icon: Inbox, badge: unreadCount },
            { key: `/workspace/${workspaceId}/contacts`, label: 'Khách', href: `/workspace/${workspaceId}/contacts`, icon: Users },
        ];

        if (user?.role === 'admin') {
            return [
                ...baseItems,
                { key: `/workspace/${workspaceId}/chatbot`, label: 'AI', href: `/workspace/${workspaceId}/chatbot`, icon: Bot },
                { key: `/workspace/${workspaceId}/settings`, label: 'Cài đặt', href: `/workspace/${workspaceId}/settings`, icon: Settings },
            ];
        }

        return [
            ...baseItems,
            { key: `/workspace/${workspaceId}/macros`, label: 'Mẫu', href: `/workspace/${workspaceId}/macros`, icon: Zap },
            { key: `/workspace/${workspaceId}/settings`, label: 'Cài đặt', href: `/workspace/${workspaceId}/settings`, icon: Settings },
        ];
    }, [workspaceId, unreadCount, user?.role]);

    if (meLoading || !user) {
        return (
            <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--ent-bg)' }}>
                <Spin size="large" />
            </div>
        );
    }

    const isActive = (href: string) => {
        if (href === `/workspace/${workspaceId}`) return currentPath === href;
        return currentPath.startsWith(href);
    };

    const handleLogout = async () => {
        try {
            await logout();
        } finally {
            if (typeof window !== 'undefined') {
                localStorage.removeItem('nemark_token');
                sessionStorage.removeItem('nemark_token');
            }
            router.replace('/auth/login');
        }
    };

    const workspaceMenu = {
        items: [
            ...workspaces.filter(getWorkspaceSummaryId).map((workspace) => ({
                key: getWorkspaceSummaryId(workspace),
                label: workspace.name,
                onClick: () => router.push(`/workspace/${getWorkspaceSummaryId(workspace)}`),
            })),
            { type: 'divider' as const },
            {
                key: 'all-workspaces',
                label: 'Quản lý workspace',
                icon: <Box size={15} />,
                onClick: () => router.push('/workspace'),
            },
        ],
    };

    const userMenu = {
        items: [
            {
                key: 'profile',
                label: 'Hồ sơ cá nhân',
                icon: <Users size={15} />,
                onClick: () => router.push('/profile'),
            },
            ...(user.role === 'admin'
                ? [
                    {
                        key: 'admin',
                        label: 'Super Admin',
                        icon: <Shield size={15} />,
                        onClick: () => router.push('/admin'),
                    },
                ]
                : []),
            { type: 'divider' as const },
            {
                key: 'logout',
                label: 'Đăng xuất',
                danger: true,
                icon: <LogOut size={15} />,
                onClick: handleLogout,
            },
        ],
    };

    const sidebar = (
        <aside
            className={`app-sidebar-shell ${collapsed ? 'is-collapsed' : ''}`}
            style={{
                width: collapsed ? 84 : 282,
                height: '100vh',
                position: 'fixed',
                inset: '0 auto 0 0',
                zIndex: 210,
                background: 'linear-gradient(180deg, #111827 0%, #172033 52%, #0f172a 100%)',
                borderRight: '1px solid rgba(255,255,255,0.08)',
                display: 'flex',
                flexDirection: 'column',
                transition: 'width 180ms ease',
            }}
        >
            <div className="app-sidebar-brand" style={{ position: 'relative', height: 70, display: 'flex', alignItems: 'center', gap: 12, padding: collapsed ? '0 18px' : '0 20px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <Image src="/images/logo.png" alt="NemarkChat" width={38} height={38} priority style={{ borderRadius: 8, objectFit: 'contain', background: '#fff' }} />
                {!collapsed && (
                    <div>
                        <div style={{ color: '#fff', fontSize: 18, fontWeight: 850, lineHeight: 1 }}>NemarkChat</div>
                        <div style={{ color: '#94a3b8', fontSize: 12, fontWeight: 600, marginTop: 3 }}>CSKH đa kênh + AI</div>
                    </div>
                )}
                <button
                    className="mobile-sidebar-close app-icon-button"
                    type="button"
                    aria-label="Đóng menu"
                    onClick={() => setMobileOpen(false)}
                >
                    <X size={18} />
                </button>
            </div>

            <div style={{ padding: collapsed ? '14px 12px' : '16px' }}>
                {workspaceId && (
                    <Dropdown menu={workspaceMenu} trigger={['click']}>
                        <button
                            type="button"
                            aria-label="Đổi workspace"
                            className="app-workspace-switcher"
                            style={{
                                width: '100%',
                                height: 48,
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: 8,
                                background: 'rgba(255,255,255,0.06)',
                                color: '#fff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: collapsed ? 'center' : 'space-between',
                                gap: 10,
                                padding: collapsed ? 0 : '0 12px',
                                cursor: 'pointer',
                            }}
                        >
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                                <span style={{ width: 28, height: 28, borderRadius: 8, background: '#2563eb', display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 800, flexShrink: 0 }}>
                                    {(currentWorkspace?.name || 'W').charAt(0).toUpperCase()}
                                </span>
                                {!collapsed && (
                                    <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 14, fontWeight: 800 }}>
                                        {currentWorkspace?.name || 'Workspace'}
                                    </span>
                                )}
                            </span>
                            {!collapsed && <ChevronDown size={16} color="#94a3b8" />}
                        </button>
                    </Dropdown>
                )}
            </div>

            <nav className="app-sidebar-nav" style={{ flex: 1, overflowY: 'auto', padding: collapsed ? '0 10px 12px' : '0 12px 14px' }}>
                {navSections.map((section) => (
                    <div key={section.label}>
                        {!collapsed && <div style={navLabelStyle}>{section.label}</div>}
                        <div style={{ display: 'grid', gap: 4 }}>
                            {section.items.map((item) => {
                                const Icon = item.icon;
                                const active = isActive(item.href);
                                return (
                                    <Link
                                        key={item.key}
                                        href={item.href}
                                        title={collapsed ? item.label : undefined}
                                        onClick={() => setMobileOpen(false)}
                                        className={`app-nav-link ${active ? 'is-active' : ''} ${collapsed ? 'is-collapsed' : ''}`}
                                        style={{
                                            height: 42,
                                            borderRadius: 8,
                                            padding: collapsed ? 0 : '0 12px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: collapsed ? 'center' : 'space-between',
                                            gap: 10,
                                            textDecoration: 'none',
                                            color: active ? '#fff' : '#cbd5e1',
                                            background: active ? 'rgba(37, 99, 235, 0.26)' : 'transparent',
                                            border: active ? '1px solid rgba(96, 165, 250, 0.35)' : '1px solid transparent',
                                            fontSize: 14,
                                            fontWeight: active ? 800 : 650,
                                        }}
                                    >
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                                            <Icon size={18} color={active ? '#93c5fd' : '#94a3b8'} />
                                            {!collapsed && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>}
                                        </span>
                                        {!collapsed && item.badge ? <Badge count={item.badge} size="small" /> : null}
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </nav>

            {user.role === 'admin' && !collapsed && (
                <div style={{ padding: '0 14px 12px' }}>
                    <button
                        onClick={() => router.push('/panel')}
                        type="button"
                        className="app-ops-button"
                        style={{
                            width: '100%',
                            padding: '12px',
                            borderRadius: 8,
                            border: '1px solid rgba(45, 212, 191, 0.28)',
                            background: 'rgba(15, 118, 110, 0.28)',
                            color: '#ccfbf1',
                            cursor: 'pointer',
                            textAlign: 'left',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, fontWeight: 850 }}>
                            <Headphones size={17} />
                            Trung tâm vận hành
                        </div>
                        <div style={{ marginTop: 4, color: '#99f6e4', fontSize: 12 }}>Quản lý khách thuê và gói</div>
                    </button>
                </div>
            )}

            <div style={{ padding: collapsed ? '14px 12px' : '14px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                <Dropdown menu={userMenu} trigger={['click']} placement="topRight">
                    <button
                        type="button"
                        className="app-user-menu-button"
                        style={{
                            width: '100%',
                            border: 0,
                            background: 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: collapsed ? 'center' : 'flex-start',
                            gap: 10,
                            padding: collapsed ? 0 : 8,
                            cursor: 'pointer',
                        }}
                    >
                        <Avatar src={user.avatarUrl} size={38} style={{ background: '#2563eb' }}>
                            {!user.avatarUrl && (user.name?.charAt(0)?.toUpperCase() || 'U')}
                        </Avatar>
                        {!collapsed && (
                            <span style={{ minWidth: 0, textAlign: 'left' }}>
                                <span style={{ display: 'block', color: '#fff', fontSize: 13, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.name}</span>
                                <span style={{ display: 'block', color: '#94a3b8', fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.email}</span>
                            </span>
                        )}
                    </button>
                </Dropdown>
                <button
                    type="button"
                    onClick={handleLogout}
                    title="Đăng xuất"
                    aria-label="Đăng xuất"
                    className="app-sidebar-logout-button"
                    style={{
                        width: '100%',
                        marginTop: 10,
                        height: 38,
                        borderRadius: 8,
                        border: '1px solid rgba(248, 113, 113, 0.28)',
                        background: 'rgba(127, 29, 29, 0.18)',
                        color: '#fecaca',
                        display: collapsed ? 'grid' : 'flex',
                        placeItems: collapsed ? 'center' : undefined,
                        alignItems: collapsed ? undefined : 'center',
                        justifyContent: collapsed ? undefined : 'center',
                        gap: 8,
                        fontSize: 13,
                        fontWeight: 850,
                        cursor: 'pointer',
                    }}
                >
                    <LogOut size={collapsed ? 16 : 15} />
                    {!collapsed && 'Đăng xuất'}
                </button>
            </div>
        </aside>
    );

    return (
        <div style={{ minHeight: '100vh', background: 'var(--ent-bg)' }}>
            <div className="desktop-sidebar">{sidebar}</div>

            {mobileOpen && (
                <>
                    <div onClick={() => setMobileOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 205, background: 'rgba(15,23,42,0.52)' }} />
                    <div className="mobile-sidebar">{sidebar}</div>
                </>
            )}

            <div style={{ marginLeft: collapsed ? 84 : 282, minHeight: '100vh', transition: 'margin-left 180ms ease' }} className="enterprise-main">
                {!hideHeader && (
                    <header
                        className="app-topbar"
                        style={{
                            height: 70,
                            position: 'sticky',
                            top: 0,
                            zIndex: 120,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 16,
                            padding: '0 28px',
                            background: 'rgba(255,255,255,0.9)',
                            backdropFilter: 'blur(16px)',
                            borderBottom: '1px solid var(--ent-border)',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
                            <button className="mobile-menu-btn app-icon-button" type="button" aria-label="Mở menu" onClick={() => { setCollapsed(false); setMobileOpen(true); }} style={{ display: 'none', width: 38, height: 38, borderRadius: 8, border: '1px solid var(--ent-border)', background: '#fff', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                                <MenuIcon size={19} />
                            </button>
                            <button onClick={() => setCollapsed((value) => !value)} type="button" aria-label={collapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'} className="desktop-collapse-btn app-icon-button" style={{ width: 38, height: 38, borderRadius: 8, border: '1px solid var(--ent-border)', background: '#fff', display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
                                {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
                            </button>
                            <div className="app-topbar-title-wrap" style={{ minWidth: 0 }}>
                                <div className="app-topbar-title" style={{ fontSize: 18, fontWeight: 850, color: 'var(--ent-text)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                                    {headerTitle || currentWorkspace?.name || 'NemarkChat'}
                                </div>
                                <div className="app-topbar-subtitle" style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--ent-text-muted)', fontSize: 12, fontWeight: 650 }}>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                                        <span style={{ width: 7, height: 7, borderRadius: 999, background: '#12b76a' }} />
                                        Hệ thống đang hoạt động
                                    </span>
                                    <span>CSKH đa kênh</span>
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div className="top-search app-top-search" role="search" style={{ height: 38, minWidth: 260, border: '1px solid var(--ent-border)', borderRadius: 8, background: '#fff', display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', color: 'var(--ent-text-muted)', fontSize: 13 }}>
                                <Search size={16} />
                                Tìm hội thoại, khách hàng, đơn hàng...
                            </div>
                            {headerExtra}
                            <button className="app-icon-button app-bell-button" type="button" aria-label="Thông báo" style={{ width: 38, height: 38, borderRadius: 8, border: '1px solid var(--ent-border)', background: '#fff', display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
                                <Badge dot={unreadCount > 0} offset={[-2, 4]}>
                                    <Bell size={17} />
                                </Badge>
                            </button>
                        </div>
                    </header>
                )}
                <main>{children}</main>
            </div>

            {mobileBottomItems.length > 0 && (
                <nav className="app-mobile-bottom-nav" aria-label="Điều hướng nhanh trên mobile">
                    {mobileBottomItems.map((item) => {
                        const Icon = item.icon;
                        const active = isActive(item.href);
                        return (
                            <Link
                                key={item.key}
                                href={item.href}
                                className={`app-mobile-bottom-link ${active ? 'is-active' : ''}`}
                                aria-current={active ? 'page' : undefined}
                            >
                                <span className="app-mobile-bottom-icon">
                                    <Badge count={item.badge || 0} size="small" overflowCount={99} offset={[4, -2]}>
                                        <Icon size={20} />
                                    </Badge>
                                </span>
                                <span className="app-mobile-bottom-label">{item.label}</span>
                            </Link>
                        );
                    })}
                </nav>
            )}

            <style jsx global>{`
                .mobile-sidebar { display: none; }
                .mobile-sidebar-close { display: none; }
                .app-mobile-bottom-nav { display: none; }
                @media (max-width: 900px) {
                    .desktop-sidebar { display: none; }
                    .mobile-sidebar { display: block; }
                    .mobile-sidebar .app-sidebar-shell { width: min(86vw, 320px) !important; box-shadow: 18px 0 45px rgba(15, 23, 42, 0.28); }
                    .mobile-sidebar-close { position: absolute; right: 14px; display: grid; width: 36px; height: 36px; place-items: center; border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; background: rgba(255,255,255,0.08); color: #fff; cursor: pointer; }
                    .enterprise-main { margin-left: 0 !important; padding-bottom: 86px; }
                    .mobile-menu-btn { display: inline-flex !important; }
                    .desktop-collapse-btn, .top-search { display: none !important; }
                    .app-topbar { padding: 0 18px !important; }
                    .app-topbar-title-wrap { min-width: 0; max-width: min(52vw, 420px); }
                    .app-topbar-title > div { min-width: 0; }
                    .app-mobile-bottom-nav {
                        position: fixed;
                        left: 10px;
                        right: 10px;
                        bottom: max(10px, env(safe-area-inset-bottom));
                        z-index: 220;
                        display: grid;
                        grid-template-columns: repeat(5, minmax(0, 1fr));
                        gap: 4px;
                        padding: 8px;
                        border: 1px solid rgba(226, 232, 240, 0.92);
                        border-radius: 22px;
                        background: rgba(255, 255, 255, 0.94);
                        box-shadow: 0 18px 44px rgba(15, 23, 42, 0.22);
                        backdrop-filter: blur(18px);
                    }
                    .app-mobile-bottom-link {
                        min-width: 0;
                        min-height: 58px;
                        border-radius: 16px;
                        display: grid;
                        place-items: center;
                        align-content: center;
                        gap: 4px;
                        color: #64748b;
                        text-decoration: none;
                        font-size: 11px;
                        font-weight: 800;
                        -webkit-tap-highlight-color: transparent;
                    }
                    .app-mobile-bottom-link.is-active {
                        color: #2563eb;
                        background: linear-gradient(180deg, rgba(37, 99, 235, 0.14), rgba(37, 99, 235, 0.06));
                    }
                    .app-mobile-bottom-icon {
                        width: 28px;
                        height: 24px;
                        display: grid;
                        place-items: center;
                    }
                    .app-mobile-bottom-label {
                        max-width: 100%;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        white-space: nowrap;
                    }
                }
                @media (max-width: 560px) {
                    .app-topbar { height: 62px !important; gap: 8px !important; padding: 0 10px !important; }
                    .app-topbar-subtitle { display: none !important; }
                    .app-topbar-title { font-size: 15px !important; }
                    .app-topbar-title-wrap { max-width: 50vw; }
                    .app-bell-button { display: none !important; }
                    .app-mobile-bottom-nav { left: 8px; right: 8px; border-radius: 20px; }
                    .app-mobile-bottom-link { min-height: 54px; font-size: 10px; }
                }
            `}</style>
        </div>
    );
}
