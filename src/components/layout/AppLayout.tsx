import React, { useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import { Layout, Menu, Dropdown, Avatar, Spin, Badge } from 'antd';
import { 
    MessageSquare, Settings, Users, Box, User, LogOut, Code, ChevronDown, CheckCircle, ChevronLeft, ChevronRight, LayoutDashboard, Contact2, CreditCard, Target, BarChart3, Bot, Megaphone, Shield, Palette,
    Smartphone, BookOpen, Zap, ShoppingBag, Package, GitBranch, Clock, Mail, FileText, Menu as MenuIcon, X
} from 'lucide-react';
import Link from 'next/link';
import { useGetMe, useLogout } from '../../domains/auth/auth.hooks';
import { useTotalUnreadCount } from '../../domains/conversation';
import { useMyWorkspaces } from '../../domains/workspace/workspace.hooks';
import { playNotificationSound } from '../../utils/audio';
import { useQueryClient } from '@tanstack/react-query';
import io, { Socket } from 'socket.io-client';
import { useEffect, useRef } from 'react';

const { Header, Sider, Content } = Layout;

interface AppLayoutProps {
    children: React.ReactNode;
    hideHeader?: boolean;
    headerTitle?: React.ReactNode;
    headerExtra?: React.ReactNode;
}

export default function AppLayout({ children, hideHeader = false, headerTitle, headerExtra }: AppLayoutProps) {
    const [collapsed, setCollapsed] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('sidebar-collapsed');
            return saved === null ? false : saved === 'true';
        }
        return false;
    });
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
    const handleToggleCollapse = () => {
        setCollapsed(prev => {
            const next = !prev;
            localStorage.setItem('sidebar-collapsed', String(next));
            return next;
        });
    };
    const closeMobileSidebar = useCallback(() => setMobileSidebarOpen(false), []);
    const router = useRouter();
    const { workspaceId: queryWsId } = router.query;
    const workspaceId = queryWsId as string | undefined;

    const { data: meData, isLoading: meLoading } = useGetMe(true);
    const { mutateAsync: logout } = useLogout();
    const { data: unreadCounts } = useTotalUnreadCount(workspaceId || '', !!workspaceId && !!meData);
    const unreadCount = unreadCounts?.totalUnread || 0;
    const { data: wsData } = useMyWorkspaces();

    const queryClient = useQueryClient();
    const socketRef = useRef<Socket | null>(null);

    // Global Socket for unread counts and generic notification sounds outside chat pages
    useEffect(() => {
        if (!workspaceId) return;

        const token = localStorage.getItem('token');
        if (!token) return;

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4010';
        const baseUrl = apiUrl.replace(/\/api$/, '');

        const socket = io(baseUrl, {
            auth: { token },
            transports: ['websocket'],
        });
        socketRef.current = socket;

        socket.on('connect', () => {
            socket.emit('agent:join', { workspaceId });
        });

        socket.on('conversation:updated', (data: any) => {
            const isFromVisitor = data.lastMessage?.sender?.type === 'visitor';
            if (isFromVisitor) {
                const p = window.location.pathname;
                const isChatPage = p.includes('/inbox') || p.includes('/remote-session');
                
                if (!isChatPage) {
                    playNotificationSound();
                    queryClient.invalidateQueries({ queryKey: ['conversations', workspaceId, 'unread-count'] });
                }
            }
        });

        socket.on('conversation:new', (data: any) => {
            const p = window.location.pathname;
            const isChatPage = p.includes('/inbox') || p.includes('/remote-session');
            if (!isChatPage) {
                playNotificationSound();
                queryClient.invalidateQueries({ queryKey: ['conversations', workspaceId, 'unread-count'] });
            }
        });

        return () => {
            socket.disconnect();
            socketRef.current = null;
        };
    }, [workspaceId, queryClient]);

    const user = meData?.data?.user;
    const workspaces = wsData?.data || [];
    const currentWorkspace = workspaces.find((w: any) => w.id === workspaceId);

    const handleLogout = async () => {
        await logout();
        router.push('/auth/login');
    };

    const isPathActive = (path: string) => {
        if (path === '/workspace' && router.pathname === '/workspace') return true;
        return router.pathname.startsWith(path) && path !== '/workspace';
    };

    // Sidebar Menu Items — grouped by section (must be before early return to respect React hooks rules)
    const menuSections = useMemo(() => {
        if (!workspaceId) {
            return [{ label: '', items: [{ key: '/workspace', icon: <Box size={20} />, label: <Link href="/workspace">Workspaces</Link> }] }];
        }
        return [
            {
                label: 'Chính',
                items: [
                    { key: `/workspace/${workspaceId}`, icon: <LayoutDashboard size={20} />, label: <Link href={`/workspace/${workspaceId}`}>Tổng quan</Link> },
                    { key: `/workspace/${workspaceId}/inbox`, icon: <Badge count={unreadCount} size="small" offset={[10, 0]}><MessageSquare size={20} /></Badge>, label: <Link href={`/workspace/${workspaceId}/inbox`}>Hộp thư</Link> },
                    { key: `/workspace/${workspaceId}/remote-session`, icon: <Smartphone size={20} />, label: <Link href={`/workspace/${workspaceId}/remote-session`}>Zalo cá nhân</Link> },
                    { key: `/workspace/${workspaceId}/contacts`, icon: <Contact2 size={20} />, label: <Link href={`/workspace/${workspaceId}/contacts`}>Người dùng</Link> },
                    { key: `/workspace/${workspaceId}/leads`, icon: <Target size={20} />, label: <Link href={`/workspace/${workspaceId}/leads`}>Leads</Link> },
                ]
            },
            {
                label: 'Công cụ',
                items: [
                    { key: `/workspace/${workspaceId}/analytics`, icon: <BarChart3 size={20} />, label: <Link href={`/workspace/${workspaceId}/analytics`}>Thống kê</Link> },
                    { key: `/workspace/${workspaceId}/chatbot`, icon: <Bot size={20} />, label: <Link href={`/workspace/${workspaceId}/chatbot`}>Nhân viên AI</Link> },
                    { key: `/workspace/${workspaceId}/campaigns`, icon: <Megaphone size={20} />, label: <Link href={`/workspace/${workspaceId}/campaigns`}>Campaigns</Link> },
                    { key: `/workspace/${workspaceId}/knowledge`, icon: <BookOpen size={20} />, label: <Link href={`/workspace/${workspaceId}/knowledge`}>Kiến thức</Link> },
                    { key: `/workspace/${workspaceId}/macros`, icon: <Zap size={20} />, label: <Link href={`/workspace/${workspaceId}/macros`}>Phản hồi nhanh</Link> },
                ]
            },
            {
                label: 'Bán hàng',
                items: [
                    { key: `/workspace/${workspaceId}/products`, icon: <Package size={20} />, label: <Link href={`/workspace/${workspaceId}/products`}>Sản phẩm</Link> },
                    { key: `/workspace/${workspaceId}/orders`, icon: <ShoppingBag size={20} />, label: <Link href={`/workspace/${workspaceId}/orders`}>Đơn hàng</Link> },
                ]
            },
            {
                label: 'Kênh liên lạc',
                items: [
                    { key: `/workspace/${workspaceId}/widgets`, icon: <Code size={20} />, label: <Link href={`/workspace/${workspaceId}/widgets`}>Widgets</Link> },
                    { key: `/workspace/${workspaceId}/popups`, icon: <Palette size={20} />, label: <Link href={`/workspace/${workspaceId}/popups`}>Tiện ích Web</Link> },
                    { key: `/workspace/${workspaceId}/email`, icon: <Mail size={20} />, label: <Link href={`/workspace/${workspaceId}/email`}>Email</Link> },
                ]
            },
            {
                label: 'Quản lý',
                items: [
                    { key: `/workspace/${workspaceId}/distribution`, icon: <GitBranch size={20} />, label: <Link href={`/workspace/${workspaceId}/distribution`}>Phân phối</Link> },
                    { key: `/workspace/${workspaceId}/business-hours`, icon: <Clock size={20} />, label: <Link href={`/workspace/${workspaceId}/business-hours`}>Giờ làm việc</Link> },
                    { key: `/workspace/${workspaceId}/teams`, icon: <Users size={20} />, label: <Link href={`/workspace/${workspaceId}/teams`}>Thành viên</Link> },
                    { key: `/workspace/${workspaceId}/settings`, icon: <Settings size={20} />, label: <Link href={`/workspace/${workspaceId}/settings`}>Cài đặt</Link> },
                    { key: `/workspace/${workspaceId}/billing`, icon: <CreditCard size={20} />, label: <Link href={`/workspace/${workspaceId}/billing`}>Thanh toán</Link> },
                ]
            }
        ];
    }, [workspaceId, unreadCount]);

    if (meLoading || !user) {
        return (
            <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg-soft)' }}>
                <Spin size="large" />
            </div>
        );
    }

    // Determine selected key
    let selectedKey = router.pathname;
    if (workspaceId) {
        if (router.pathname.includes('/inbox')) selectedKey = `/workspace/${workspaceId}/inbox`;
        else if (router.pathname.includes('/remote-session')) selectedKey = `/workspace/${workspaceId}/remote-session`;
        else if (router.pathname.includes('/contacts')) selectedKey = `/workspace/${workspaceId}/contacts`;
        else if (router.pathname.includes('/leads')) selectedKey = `/workspace/${workspaceId}/leads`;
        else if (router.pathname.includes('/analytics')) selectedKey = `/workspace/${workspaceId}/analytics`;
        else if (router.pathname.includes('/chatbot')) selectedKey = `/workspace/${workspaceId}/chatbot`;
        else if (router.pathname.includes('/campaigns')) selectedKey = `/workspace/${workspaceId}/campaigns`;
        else if (router.pathname.includes('/knowledge')) selectedKey = `/workspace/${workspaceId}/knowledge`;
        else if (router.pathname.includes('/macros')) selectedKey = `/workspace/${workspaceId}/macros`;
        else if (router.pathname.includes('/products')) selectedKey = `/workspace/${workspaceId}/products`;
        else if (router.pathname.includes('/orders')) selectedKey = `/workspace/${workspaceId}/orders`;

        else if (router.pathname.includes('/email')) selectedKey = `/workspace/${workspaceId}/email`;
        else if (router.pathname.includes('/distribution')) selectedKey = `/workspace/${workspaceId}/distribution`;
        else if (router.pathname.includes('/business-hours')) selectedKey = `/workspace/${workspaceId}/business-hours`;
        else if (router.pathname.includes('/teams')) selectedKey = `/workspace/${workspaceId}/teams`;
        else if (router.pathname.includes('/billing')) selectedKey = `/workspace/${workspaceId}/billing`;
        else if (router.pathname.includes('/settings')) selectedKey = `/workspace/${workspaceId}/settings`;
        else if (router.pathname.includes('/widgets')) selectedKey = `/workspace/${workspaceId}/widgets`;
        else if (router.pathname.includes('/popups')) selectedKey = `/workspace/${workspaceId}/popups`;
        else selectedKey = `/workspace/${workspaceId}`;
    }

    // Workspace Switcher Dropdown
    const wsMenu = {
        items: [
            ...workspaces.map((w: any) => ({
                key: w.id,
                label: (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                        <span style={{ fontWeight: 500 }}>{w.name}</span>
                        {w.id === workspaceId && <CheckCircle size={16} color="var(--color-primary)" />}
                    </div>
                ),
                onClick: () => router.push(`/workspace/${w.id}`)
            })),
            { type: 'divider' },
            {
                key: 'all',
                label: 'View all workspaces',
                icon: <Box size={16} />,
                onClick: () => router.push('/workspace')
            }
        ] as any[]
    };

    return (
        <Layout style={{ minHeight: '100vh', background: 'var(--color-bg-soft)' }}>
            <style>{`
                /* ── Sidebar Flex + Scroll Fix ── */
                .app-sider-nav {
                    overflow: hidden !important;
                }
                .app-sider-nav > .ant-layout-sider-children {
                    display: flex !important;
                    flex-direction: column !important;
                    overflow: hidden !important;
                    height: 100% !important;
                }

                /* ── Sidebar Scrollbar ── */
                .sidebar-nav-scroll::-webkit-scrollbar { width: 4px; }
                .sidebar-nav-scroll::-webkit-scrollbar-track { background: transparent; }
                .sidebar-nav-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 4px; }
                .sidebar-nav-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.25); }
                .sidebar-nav-scroll { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.12) transparent; }

                /* ── Mobile header ── */
                .mobile-top-header { display: none !important; }

                /* ── Mobile sidebar overlay ── */
                .mobile-sidebar-overlay {
                    display: none !important;
                    background: rgba(0,0,0,0.5);
                    backdrop-filter: blur(4px);
                    -webkit-backdrop-filter: blur(4px);
                    transition: opacity 0.3s;
                }
                .mobile-sidebar-drawer {
                    display: none !important;
                    width: 280px; z-index: 1000;
                    background: linear-gradient(180deg, #0f172a 0%, #1e293b 100%);
                    box-shadow: 4px 0 24px rgba(0,0,0,0.3);
                    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    display: flex; flex-direction: column;
                    overflow: hidden;
                }
                .mobile-sidebar-drawer .sidebar-nav-scroll::-webkit-scrollbar { width: 3px; }
                .mobile-sidebar-drawer .sidebar-nav-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 3px; }

                @media (max-width: 768px) {
                    .app-sider-nav {
                        display: none !important;
                    }
                    .app-main-content {
                        margin-left: 0 !important;
                        padding-top: 56px !important;
                        padding-bottom: 64px !important;
                    }
                    .app-main-header {
                        display: none !important;
                    }
                    .mobile-top-header {
                        display: flex !important;
                        position: fixed; top: 0; left: 0; right: 0; z-index: 201;
                        height: 56px;
                        background: linear-gradient(180deg, #0f172a, #1e293b);
                        align-items: center; justify-content: space-between;
                        padding: 0 12px;
                        border-bottom: 1px solid rgba(255,255,255,0.06);
                    }
                    .mobile-sidebar-overlay {
                        display: block !important;
                        position: fixed; inset: 0; z-index: 999;
                        background: rgba(0,0,0,0.5);
                        backdrop-filter: blur(4px);
                        -webkit-backdrop-filter: blur(4px);
                    }
                    .mobile-sidebar-drawer {
                        display: flex !important;
                        position: fixed; top: 0; left: 0; bottom: 0;
                        width: 280px; z-index: 1000;
                        background: linear-gradient(180deg, #0f172a 0%, #1e293b 100%);
                        box-shadow: 4px 0 24px rgba(0,0,0,0.3);
                        flex-direction: column;
                        overflow: hidden;
                    }
                    .mobile-bottom-nav {
                        display: flex !important;
                    }
                }
                .mobile-bottom-nav {
                    display: none !important;
                    position: fixed;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    height: 60px;
                    background: rgba(255,255,255,0.95);
                    backdrop-filter: blur(16px);
                    -webkit-backdrop-filter: blur(16px);
                    border-top: 1px solid var(--color-border, #e8e8e8);
                    z-index: 200;
                    align-items: center;
                    justify-content: space-around;
                    padding: 0 4px;
                    padding-bottom: env(safe-area-inset-bottom, 0px);
                }
                .mobile-nav-item {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 2px;
                    padding: 6px 0;
                    cursor: pointer;
                    border: none;
                    background: none;
                    min-width: 48px;
                    transition: color 0.15s;
                }
                .mobile-nav-item span {
                    font-size: 10px;
                    font-weight: 500;
                }
            `}</style>

            {/* ─── MOBILE TOP HEADER ─── */}
            <div className="mobile-top-header">
                <button
                    onClick={() => setMobileSidebarOpen(true)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                    <MenuIcon size={22} color="#e2e8f0" />
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <img src="/images/logo.png" alt="" style={{ width: 28, height: 28, borderRadius: 8 }} />
                    <span style={{ fontWeight: 700, fontSize: 16, color: '#f1f5f9' }}>
                        {currentWorkspace?.name || 'NemarkChat'}
                    </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {unreadCount > 0 && (
                        <Badge count={unreadCount} size="small">
                            <button
                                onClick={() => router.push(`/workspace/${workspaceId}/inbox`)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6 }}
                            >
                                <MessageSquare size={20} color="#e2e8f0" />
                            </button>
                        </Badge>
                    )}
                    <Avatar src={user.avatarUrl} size={30} style={{ background: 'var(--gradient-primary)', cursor: 'pointer' }} onClick={() => setMobileSidebarOpen(true)}>
                        {!user.avatarUrl && (user.name?.charAt(0)?.toUpperCase() || 'U')}
                    </Avatar>
                </div>
            </div>

            {/* ─── MOBILE SIDEBAR DRAWER ─── */}
            {mobileSidebarOpen && (
                <div className="mobile-sidebar-overlay" onClick={closeMobileSidebar} />
            )}
            <div
                className="mobile-sidebar-drawer"
                style={{ transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)', transform: mobileSidebarOpen ? 'translateX(0)' : 'translateX(-100%)' }}
            >
                {/* Drawer Header */}
                <div style={{
                    height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '0 16px', borderBottom: '1px solid rgba(255,255,255,0.06)',
                    background: 'rgba(99, 102, 241, 0.08)', flexShrink: 0,
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <img src="/images/logo.png" alt="" style={{ width: 30, height: 30, borderRadius: 8 }} />
                        <span style={{ fontWeight: 700, fontSize: 16, color: '#f1f5f9' }}>NemarkChat</span>
                    </div>
                    <button onClick={closeMobileSidebar} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 8 }}>
                        <X size={20} color="#94a3b8" />
                    </button>
                </div>

                {/* Workspace Switcher in Drawer */}
                {workspaceId && workspaces.length > 0 && (
                    <div style={{ padding: '12px 14px 6px' }}>
                        <Dropdown menu={wsMenu} trigger={['click']}>
                            <div style={{
                                padding: '10px 14px', background: 'rgba(255,255,255,0.04)',
                                borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                cursor: 'pointer', border: '1px solid rgba(255,255,255,0.06)',
                            }}>
                                <span style={{ fontWeight: 600, fontSize: 14, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {currentWorkspace?.name || 'Workspace'}
                                </span>
                                <ChevronDown size={16} color="#64748b" />
                            </div>
                        </Dropdown>
                    </div>
                )}

                {/* Nav Menu */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '4px 10px' }} className="sidebar-nav-scroll">
                    {menuSections.map((section, idx) => (
                        <div key={idx}>
                            {section.label && (
                                <div className="sidebar-section-label">{section.label}</div>
                            )}
                            <Menu
                                mode="inline"
                                selectedKeys={[selectedKey]}
                                items={section.items.map(item => ({
                                    ...item,
                                    onClick: () => { closeMobileSidebar(); },
                                }))}
                                style={{ borderRight: 'none', background: 'transparent' }}
                                className="app-sidebar-menu"
                            />
                        </div>
                    ))}
                </div>

                {/* Admin buttons in drawer */}
                {user.role === 'admin' && (
                    <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                        <div
                            onClick={() => { closeMobileSidebar(); router.push('/panel'); }}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
                                borderRadius: 12, background: 'linear-gradient(135deg, #0f766e 0%, #0d9488 100%)',
                                cursor: 'pointer',
                            }}
                        >
                            <BarChart3 size={18} color="#fff" />
                            <div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Admin Panel</div>
                                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>Quản lý doanh nghiệp</div>
                            </div>
                        </div>
                        <div
                            onClick={() => { closeMobileSidebar(); router.push('/admin'); }}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
                                borderRadius: 12, background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                                cursor: 'pointer',
                            }}
                        >
                            <Shield size={18} color="#fff" />
                            <div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Super Admin</div>
                                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>Hệ thống kỹ thuật</div>
                            </div>
                        </div>
                    </div>
                )}

                {/* User info in drawer */}
                <div style={{
                    padding: '12px 14px', borderTop: '1px solid rgba(255,255,255,0.06)',
                    background: 'rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
                }}>
                    <Avatar src={user.avatarUrl} size={36} style={{ background: 'var(--gradient-primary)', flexShrink: 0 }}>
                        {!user.avatarUrl && (user.name?.charAt(0)?.toUpperCase() || 'U')}
                    </Avatar>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 14, color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</div>
                        <div style={{ fontSize: 12, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</div>
                    </div>
                    <button
                        onClick={() => { closeMobileSidebar(); handleLogout(); }}
                        style={{ background: 'rgba(239,68,68,0.15)', border: 'none', borderRadius: 8, padding: 8, cursor: 'pointer', flexShrink: 0 }}
                    >
                        <LogOut size={16} color="#ef4444" />
                    </button>
                </div>
            </div>
            {/* ─── LEFT SIDEBAR ─── */}
            <Sider 
                collapsed={collapsed}
                collapsedWidth={80}
                width={260}
                theme="dark" 
                collapsible={false}
                className="app-sider-nav"
                style={{
                    borderRight: '1px solid rgba(255, 255, 255, 0.06)',
                    position: 'fixed',
                    height: '100vh',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    zIndex: 100,
                    display: 'flex',
                    flexDirection: 'column',
                    background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)',
                }}
            >
                {/* Brand / Logo */}
                <div style={{ 
                    height: 64, 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    padding: collapsed ? '0' : '0 20px',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                    gap: 10,
                    background: 'linear-gradient(180deg, rgba(99, 102, 241, 0.08) 0%, transparent 100%)',
                }}>
                    <img src="/images/logo.png" alt="NemarkChat" style={{
                        width: collapsed ? 38 : 32, 
                        height: collapsed ? 38 : 32, 
                        borderRadius: collapsed ? 10 : 8,
                        flexShrink: 0
                    }} />
                    {!collapsed && <span style={{ fontWeight: 700, fontSize: 18, color: '#f1f5f9', whiteSpace: 'nowrap' }}>NemarkChat</span>}
                </div>

                {/* Workspace Switcher */}
                {workspaceId && workspaces.length > 0 && (
                    <div style={{ padding: collapsed ? '16px 0 8px' : '16px 16px 8px', display: 'flex', justifyContent: 'center' }}>
                        <Dropdown menu={wsMenu} trigger={['click']} placement={collapsed ? "bottomLeft" : "bottomCenter"}>
                            <div style={{ 
                                width: collapsed ? 44 : '100%', 
                                height: 44, 
                                padding: collapsed ? 0 : '0 14px',
                                background: 'rgba(255, 255, 255, 0.04)', 
                                borderRadius: collapsed ? 12 : 10, 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: collapsed ? 'center' : 'space-between',
                                cursor: 'pointer',
                                border: '1px solid rgba(255, 255, 255, 0.06)',
                            }} className="ws-switcher">
                                {collapsed ? (
                                    <span style={{ fontWeight: 700, fontSize: 18, color: '#818cf8' }}>
                                        {currentWorkspace?.name?.charAt(0)?.toUpperCase() || 'W'}
                                    </span>
                                ) : (
                                    <>
                                        <span style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#e2e8f0' }}>
                                            {currentWorkspace?.name || 'Loading...'}
                                        </span>
                                        <ChevronDown size={16} color="#64748b" />
                                    </>
                                )}
                            </div>
                        </Dropdown>
                    </div>
                )}

                {/* Navigation Menu — Grouped Sections */}
                <div style={{ flex: 1, overflowY: 'auto', padding: collapsed ? '4px 0' : '4px 10px' }} className="sidebar-nav-scroll">
                    {menuSections.map((section, idx) => (
                        <div key={idx}>
                            {section.label && (
                                <div className={`sidebar-section-label${collapsed ? ' collapsed-label' : ''}`}>
                                    {collapsed ? '•••' : section.label}
                                </div>
                            )}
                            <Menu
                                mode="inline"
                                selectedKeys={[selectedKey]}
                                items={section.items}
                                style={{ borderRight: 'none', background: 'transparent' }}
                                className="app-sidebar-menu"
                            />
                        </div>
                    ))}
                </div>

                {/* ── Admin Panel Button (admin only) ── */}
                {user.role === 'admin' && (
                    <div style={{ padding: collapsed ? '8px 0' : '8px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div
                            onClick={() => router.push('/panel')}
                            style={{
                                display: 'flex', alignItems: 'center',
                                justifyContent: collapsed ? 'center' : 'flex-start',
                                gap: 10, padding: collapsed ? '12px' : '12px 16px',
                                borderRadius: collapsed ? 14 : 16,
                                background: 'linear-gradient(135deg, #0f766e 0%, #0d9488 100%)',
                                cursor: 'pointer', transition: 'all 0.2s',
                                boxShadow: '0 4px 14px rgba(15, 118, 110, 0.25)',
                                width: collapsed ? 48 : '100%',
                                margin: collapsed ? '0 auto' : undefined,
                            }}
                        >
                            <BarChart3 size={collapsed ? 20 : 18} color="#fff" />
                            {!collapsed && (
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>Admin Panel</div>
                                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 1 }}>Quản lý doanh nghiệp</div>
                                </div>
                            )}
                        </div>
                        <div
                            onClick={() => router.push('/admin')}
                            style={{
                                display: 'flex', alignItems: 'center',
                                justifyContent: collapsed ? 'center' : 'flex-start',
                                gap: 10, padding: collapsed ? '12px' : '12px 16px',
                                borderRadius: collapsed ? 14 : 16,
                                background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                                cursor: 'pointer', transition: 'all 0.2s',
                                boxShadow: '0 4px 14px rgba(79, 70, 229, 0.25)',
                                width: collapsed ? 48 : '100%',
                                margin: collapsed ? '0 auto' : undefined,
                            }}
                            className="admin-panel-btn"
                        >
                            <Shield size={collapsed ? 20 : 18} color="#fff" />
                            {!collapsed && (
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>Super Admin</div>
                                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 1 }}>Hệ thống kỹ thuật</div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Bottom User Area */}
                <div style={{ 
                    padding: collapsed ? '16px 0' : '16px', 
                    borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                    background: 'rgba(0, 0, 0, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    position: 'relative'
                }}>
                    {/* Expand/Collapse Toggle Float Button */}
                    <div 
                        onClick={handleToggleCollapse}
                        className="sidebar-toggle-btn"
                        style={{
                            position: 'absolute',
                            right: -14,
                            top: -14,
                            width: 28,
                            height: 28,
                            background: '#1e293b',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            zIndex: 101,
                            color: '#94a3b8',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                        }}
                    >
                        {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                    </div>

                    <Dropdown
                        placement="topRight"
                        menu={{
                            items: [
                                {
                                    key: 'profile',
                                    icon: <User size={16} />,
                                    label: 'Hồ sơ cá nhân',
                                    onClick: () => router.push('/profile')
                                },
                                ...(user.role === 'admin' ? [{
                                    key: 'admin',
                                    icon: <Shield size={16} />,
                                    label: 'Super Admin',
                                    onClick: () => router.push('/admin')
                                }] : []),
                                { type: 'divider' as const },
                                {
                                    key: 'logout',
                                    icon: <LogOut size={16} />,
                                    label: 'Đăng xuất',
                                    danger: true,
                                    onClick: handleLogout
                                }
                            ]
                        }}
                        trigger={['click']}
                    >
                        <div style={{ 
                            padding: collapsed ? '6px' : '10px 12px', 
                            borderRadius: collapsed ? 12 : 10,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            width: collapsed ? 'auto' : '100%',
                        }} className="user-profile-btn">
                            <div style={{ position: 'relative', flexShrink: 0 }}>
                                <Avatar src={user.avatarUrl} size={collapsed ? 42 : 36} style={{ background: 'var(--gradient-primary)' }}>
                                    {!user.avatarUrl && (user.name?.charAt(0)?.toUpperCase() || 'U')}
                                </Avatar>
                                <div className="online-status-dot" />
                            </div>
                            {!collapsed && (
                                <>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 600, fontSize: 14, color: '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {user.name}
                                        </div>
                                        <div style={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {user.email}
                                        </div>
                                    </div>
                                    <Settings size={16} color="#64748b" style={{ flexShrink: 0 }} />
                                </>
                            )}
                        </div>
                    </Dropdown>
                </div>
            </Sider>

            {/* ─── MAIN CONTENT ─── */}
            <Layout className="app-main-content" style={{ marginLeft: collapsed ? 80 : 260, paddingTop: 0, background: 'var(--color-bg-soft)', minHeight: '100vh', display: 'flex', flexDirection: 'column', transition: 'margin-left 0.2s' }}>
                {!hideHeader && (
                    <Header className="app-main-header" style={{ 
                        background: 'rgba(255, 255, 255, 0.85)', 
                        backdropFilter: 'blur(12px)',
                        WebkitBackdropFilter: 'blur(12px)',
                        padding: '0 32px', 
                        height: 64, 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between',
                        borderBottom: '1px solid var(--color-border)',
                        position: 'sticky',
                        top: 0,
                        zIndex: 99,
                        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)',
                    }}>
                        <div style={{ fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center' }}>
                            {headerTitle || ''}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                            {headerExtra || null}
                        </div>
                    </Header>
                )}
                <Content style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
                    {children}
                </Content>
            </Layout>

            {/* ─── MOBILE BOTTOM NAV ─── */}
            {workspaceId && (
                <nav className="mobile-bottom-nav">
                    {[
                        { key: 'dashboard', icon: <LayoutDashboard size={20} />, label: 'Tổng quan', path: `/workspace/${workspaceId}` },
                        { key: 'inbox', icon: <Badge count={unreadCount} size="small" offset={[6, -2]}><MessageSquare size={20} /></Badge>, label: 'Hộp thư', path: `/workspace/${workspaceId}/inbox` },
                        { key: 'contacts', icon: <Contact2 size={20} />, label: 'Liên hệ', path: `/workspace/${workspaceId}/contacts` },
                        { key: 'analytics', icon: <BarChart3 size={20} />, label: 'Thống kê', path: `/workspace/${workspaceId}/analytics` },
                        { key: 'more', icon: <MenuIcon size={20} />, label: 'Menu', path: '' },
                    ].map(item => {
                        const isActive = selectedKey === item.path || (item.key === 'dashboard' && selectedKey === `/workspace/${workspaceId}`);
                        return (
                            <button
                                key={item.key}
                                className="mobile-nav-item"
                                onClick={() => item.key === 'more' ? setMobileSidebarOpen(true) : router.push(item.path)}
                                style={{ color: isActive ? 'var(--color-primary, #4f46e5)' : 'var(--color-text-secondary, #94a3b8)' }}
                            >
                                {item.icon}
                                <span style={{ fontWeight: isActive ? 600 : 500 }}>{item.label}</span>
                            </button>
                        );
                    })}
                </nav>
            )}
        </Layout>
    );
}

