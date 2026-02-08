import React, { ReactNode, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useUser } from '@/hooks/useAuth';
import { Spin } from 'antd';

interface AdminLayoutProps {
    children: ReactNode;
}

interface MenuItem {
    key: string;
    label: string;
    icon: string;
    href: string;
}

const menuItems: MenuItem[] = [
    { key: 'dashboard', label: 'Dashboard', icon: 'dashboard', href: '/admin' },
    { key: 'workspaces', label: 'Workspaces', icon: 'business', href: '/admin/workspaces' },
    { key: 'users', label: 'Users', icon: 'group', href: '/admin/users' },
    { key: 'conversations', label: 'Conversations', icon: 'forum', href: '/admin/conversations' },
    { key: 'channels', label: 'Channels', icon: 'hub', href: '/admin/channels' },
    { key: 'analytics', label: 'Analytics', icon: 'analytics', href: '/admin/analytics' },
    { key: 'audit-logs', label: 'Audit Logs', icon: 'history', href: '/admin/audit-logs' },
    { key: 'settings', label: 'Settings', icon: 'settings', href: '/admin/settings' },
];


export const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
    const router = useRouter();
    const [collapsed, setCollapsed] = useState(false);
    const { data: userData, isLoading, isError } = useUser();

    // Extract user from response
    const user = userData?.user;
    const isSystemAdmin = user?.IsSystemAdmin === true;

    // Redirect non-admins
    useEffect(() => {
        if (!isLoading && !isError) {
            if (!user) {
                // Not logged in
                router.replace('/auth/login');
            } else if (!isSystemAdmin) {
                // Logged in but not admin - redirect to workspace
                router.replace('/workspace/inbox');
            }
        }
    }, [isLoading, isError, user, isSystemAdmin, router]);

    // Show loading while checking auth
    if (isLoading) {
        return (
            <div className="min-h-screen bg-neutral-900 flex items-center justify-center">
                <Spin size="large" />
            </div>
        );
    }

    // Show access denied if not admin (before redirect happens)
    if (!isSystemAdmin) {
        return (
            <div className="min-h-screen bg-neutral-900 flex flex-col items-center justify-center gap-4">
                <div className="text-center">
                    <span className="material-symbols-outlined text-red-500 text-6xl mb-4">block</span>
                    <h1 className="text-2xl font-bold text-white mb-2">Truy cập bị từ chối</h1>
                    <p className="text-neutral-400 mb-6">Bạn không có quyền truy cập trang Admin.</p>
                    <Link
                        href="/workspace/inbox"
                        className="px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors inline-flex items-center gap-2"
                    >
                        <span className="material-symbols-outlined text-sm">arrow_back</span>
                        Quay lại Workspace
                    </Link>
                </div>
            </div>
        );
    }

    const adminName = user?.DisplayName || user?.Email || 'Super Admin';

    const isActive = (href: string) => {
        if (href === '/admin') return router.pathname === '/admin';
        return router.pathname.startsWith(href);
    };

    return (
        <div className="min-h-screen bg-neutral-900 flex">
            {/* Sidebar */}
            <aside className={`bg-neutral-800 border-r border-neutral-700 flex flex-col transition-all duration-300 ${collapsed ? 'w-16' : 'w-64'}`}>
                {/* Logo */}
                <div className="h-16 flex items-center justify-between px-4 border-b border-neutral-700">
                    {!collapsed && (
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-700 rounded-lg flex items-center justify-center">
                                <span className="text-white font-bold text-sm">SA</span>
                            </div>
                            <span className="text-white font-bold text-lg">Super Admin</span>
                        </div>
                    )}
                    <button
                        onClick={() => setCollapsed(!collapsed)}
                        className="p-1.5 hover:bg-neutral-700 rounded-lg transition-colors"
                    >
                        <span className="material-symbols-outlined text-neutral-400 text-xl">
                            {collapsed ? 'chevron_right' : 'chevron_left'}
                        </span>
                    </button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 py-4 space-y-1 px-2">
                    {menuItems.map((item) => (
                        <Link
                            key={item.key}
                            href={item.href}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${isActive(item.href)
                                ? 'bg-primary-600 text-white'
                                : 'text-neutral-400 hover:bg-neutral-700 hover:text-white'
                                }`}
                        >
                            <span className="material-symbols-outlined text-xl">{item.icon}</span>
                            {!collapsed && <span className="font-medium">{item.label}</span>}
                        </Link>
                    ))}
                </nav>

                {/* User Section */}
                <div className="p-4 border-t border-neutral-700">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-gradient-to-br from-orange-500 to-red-600 rounded-full flex items-center justify-center text-white font-semibold">
                            {adminName.charAt(0).toUpperCase()}
                        </div>
                        {!collapsed && (
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-white truncate">
                                    {adminName}
                                </p>
                                <p className="text-xs text-neutral-400 truncate">Super Admin</p>
                            </div>
                        )}
                    </div>
                    {!collapsed && (
                        <div className="mt-3 flex gap-2">
                            <Link
                                href="/workspace/inbox"
                                className="flex-1 py-1.5 text-center text-xs bg-neutral-700 text-neutral-300 rounded hover:bg-neutral-600 transition-colors"
                            >
                                Back to App
                            </Link>
                            <button
                                onClick={() => router.push('/auth/login')}
                                className="px-3 py-1.5 text-xs bg-red-600/20 text-red-400 rounded hover:bg-red-600/30 transition-colors"
                            >
                                Logout
                            </button>
                        </div>
                    )}
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <header className="h-16 bg-neutral-800 border-b border-neutral-700 flex items-center justify-between px-6">
                    <div>
                        <h1 className="text-lg font-semibold text-white">Super Admin Panel</h1>
                        <p className="text-xs text-neutral-400">Quản lý toàn bộ hệ thống LiveChat</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <button className="relative p-2 text-neutral-400 hover:text-white hover:bg-neutral-700 rounded-lg transition-colors">
                            <span className="material-symbols-outlined">notifications</span>
                            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                        </button>
                    </div>
                </header>

                {/* Content */}
                <main className="flex-1 overflow-y-auto p-6 bg-neutral-900">
                    {children}
                </main>
            </div>
        </div>
    );
};

export default AdminLayout;

