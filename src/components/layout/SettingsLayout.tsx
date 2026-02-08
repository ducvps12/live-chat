import React, { ReactNode, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';
import { DashboardLayout } from './DashboardLayout';

interface SettingsLayoutProps {
    children: ReactNode;
}

interface MenuItem {
    key: string;
    label: string;
    icon: string;
    href: string;
}

interface MenuGroup {
    title: string;
    items: MenuItem[];
}

const menuGroups: MenuGroup[] = [
    {
        title: 'TÀI KHOẢN',
        items: [
            { key: 'general', label: 'Thông tin', icon: 'info', href: '/workspace/settings' },
            { key: 'agents', label: 'Agents', icon: 'support_agent', href: '/workspace/settings/agents' },
        ],
    },
    {
        title: 'TÍCH HỢP',
        items: [
            { key: 'website', label: 'Website', icon: 'language', href: '/workspace/settings/website' },
            { key: 'facebook', label: 'Facebook', icon: 'facebook', href: '/workspace/settings/facebook' },
            { key: 'instagram', label: 'Instagram', icon: 'photo_camera', href: '/workspace/settings/instagram' },
            { key: 'zalo', label: 'Zalo OA', icon: 'chat', href: '/workspace/settings/zalo' },
            { key: 'zalo-personal', label: 'Zalo cá nhân', icon: 'qr_code_scanner', href: '/workspace/settings/zalo-personal' },
            { key: 'email', label: 'Email', icon: 'email', href: '/workspace/settings/email' },
            { key: 'callcenter', label: 'Tổng đài', icon: 'phone_in_talk', href: '/workspace/settings/callcenter' },
            { key: 'webhook', label: 'Webhook', icon: 'webhook', href: '/workspace/settings/webhook' },
        ],
    },
    {
        title: 'HỘI THOẠI',
        items: [
            { key: 'bot', label: 'Bot', icon: 'smart_toy', href: '/workspace/settings/bot' },
            { key: 'templates', label: 'Mẫu tin nhắn', icon: 'description', href: '/workspace/settings/templates' },
        ],
    },
];

// Get current page title from path
const getPageTitle = (path: string): string => {
    for (const group of menuGroups) {
        for (const item of group.items) {
            if (path === item.href || path.startsWith(item.href + '/')) {
                return item.label;
            }
        }
    }
    return 'Cài đặt';
};

export const SettingsLayout: React.FC<SettingsLayoutProps> = ({ children }) => {
    const router = useRouter();
    const { t } = useTranslation();
    const currentPath = router.pathname;
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // Close menu on route change
    useEffect(() => {
        setIsMobileMenuOpen(false);
    }, [currentPath]);

    // Prevent body scroll when menu is open
    useEffect(() => {
        if (isMobileMenuOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isMobileMenuOpen]);

    const isActive = (href: string) => {
        if (href === '/workspace/settings') {
            return currentPath === '/workspace/settings';
        }
        return currentPath.startsWith(href);
    };

    const pageTitle = getPageTitle(currentPath);

    // Shared sidebar content
    const SidebarContent = ({ onItemClick }: { onItemClick?: () => void }) => (
        <>
            <div className="flex items-center gap-2 mb-4 lg:mb-6">
                <div className="w-2 h-5 lg:h-6 bg-green-500 rounded-full"></div>
                <span className="text-xs text-neutral-500">TRỢ LÝ CÀI ĐẶT</span>
            </div>
            <p className="text-xs text-neutral-500 mb-3 lg:mb-4 hidden lg:block">
                Hoàn thành các cài đặt để sử dụng hiệu quả nhất
            </p>

            {/* Search - hidden on mobile for compactness */}
            <div className="relative mb-4 lg:mb-6 hidden lg:block">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-neutral-400 text-lg">
                    search
                </span>
                <input
                    type="text"
                    placeholder="Tìm kiếm cài đặt"
                    className="w-full pl-10 pr-4 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
            </div>

            {/* Menu Groups */}
            <nav className="space-y-4 lg:space-y-6">
                {menuGroups.map((group) => (
                    <div key={group.title}>
                        <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5 lg:mb-2 px-2">
                            {group.title}
                        </h3>
                        <div className="space-y-0.5 lg:space-y-1">
                            {group.items.map((item) => (
                                <Link
                                    key={item.key}
                                    href={item.href}
                                    onClick={onItemClick}
                                    className={`flex items-center gap-2.5 lg:gap-3 px-2.5 lg:px-3 py-2 rounded-lg text-sm transition-colors ${isActive(item.href)
                                        ? 'bg-primary-50 text-primary-700 font-medium'
                                        : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
                                        }`}
                                >
                                    <span className={`material-symbols-outlined text-lg ${isActive(item.href) ? 'text-primary-600' : 'text-neutral-400'
                                        }`}>
                                        {item.icon}
                                    </span>
                                    {item.label}
                                </Link>
                            ))}
                        </div>
                    </div>
                ))}
            </nav>
        </>
    );

    return (
        <DashboardLayout>
            <div className="flex h-full -m-6 lg:-m-8">
                {/* Mobile Header Bar */}
                <div className="fixed top-14 left-0 right-0 z-30 bg-white border-b border-neutral-200 px-4 py-3 flex items-center gap-3 lg:hidden">
                    <button
                        onClick={() => setIsMobileMenuOpen(true)}
                        className="p-1.5 -ml-1.5 rounded-lg hover:bg-neutral-100 text-neutral-600"
                    >
                        <span className="material-symbols-outlined text-xl">menu</span>
                    </button>
                    <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-lg text-primary-600">settings</span>
                        <span className="font-medium text-neutral-800">{pageTitle}</span>
                    </div>
                </div>

                {/* Mobile Drawer Overlay */}
                {isMobileMenuOpen && (
                    <div
                        className="fixed inset-0 z-40 lg:hidden"
                        onClick={() => setIsMobileMenuOpen(false)}
                    >
                        {/* Backdrop */}
                        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" />

                        {/* Drawer */}
                        <aside
                            className="absolute left-0 top-0 bottom-0 w-72 max-w-[85vw] bg-white shadow-2xl animate-slide-in-left overflow-y-auto"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Close button - prominent position */}
                            <button
                                onClick={() => setIsMobileMenuOpen(false)}
                                className="absolute top-3 right-3 z-50 flex items-center justify-center w-10 h-10 rounded-full bg-neutral-100 hover:bg-neutral-200 active:bg-neutral-300 text-neutral-600 transition-colors"
                                aria-label="Đóng menu"
                            >
                                <span className="material-symbols-outlined text-xl">close</span>
                            </button>
                            <div className="p-4 pt-5">
                                <SidebarContent onItemClick={() => setIsMobileMenuOpen(false)} />
                            </div>
                        </aside>
                    </div>
                )}

                {/* Desktop Sidebar */}
                <aside className="hidden lg:block w-64 bg-white border-r border-neutral-200 flex-shrink-0 overflow-y-auto">
                    <div className="p-4">
                        <SidebarContent />
                    </div>
                </aside>

                {/* Main Content */}
                <main className="flex-1 overflow-y-auto bg-neutral-50 p-4 pt-16 lg:pt-0 lg:p-6 xl:p-8">
                    {children}
                </main>
            </div>
        </DashboardLayout>
    );
};

export default SettingsLayout;
