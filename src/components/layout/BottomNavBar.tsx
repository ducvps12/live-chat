'use client';

import Link from 'next/link';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';

interface BottomNavItem {
    href: string;
    icon: string;
    label: string;
}

export default function BottomNavBar() {
    const { t } = useTranslation();
    const router = useRouter();

    const navItems: BottomNavItem[] = [
        { href: '/', icon: 'home', label: 'Trang chủ' },
        { href: '/demo', icon: 'play_circle', label: 'Demo' },
        { href: '/product', icon: 'inventory_2', label: 'Tính năng' },
        { href: '/pricing', icon: 'payments', label: 'Bảng giá' },
        { href: '/auth/login', icon: 'person', label: 'Tài khoản' },
    ];

    const isActive = (href: string) => {
        if (href === '/') return router.pathname === '/';
        return router.pathname.startsWith(href);
    };

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-40 lg:hidden">
            {/* Gradient border top */}
            <div className="h-px bg-gradient-to-r from-transparent via-electric-blue/50 to-transparent" />

            {/* Nav content */}
            <div className="bg-[#0f1419]/95 backdrop-blur-xl border-t border-white/5">
                <div className="flex items-center justify-around h-16 px-2">
                    {navItems.map((item) => {
                        const active = isActive(item.href);
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`flex flex-col items-center justify-center gap-0.5 px-3 py-2 rounded-xl transition-all duration-200 min-w-[60px] ${active
                                        ? 'text-electric-blue bg-electric-blue/10'
                                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                                    }`}
                            >
                                <span className={`material-symbols-outlined text-xl ${active ? 'text-electric-blue' : ''}`}>
                                    {item.icon}
                                </span>
                                <span className="text-[10px] font-medium truncate">
                                    {item.label}
                                </span>
                            </Link>
                        );
                    })}
                </div>
            </div>

            {/* Safe area for iPhone notch */}
            <div className="bg-[#0f1419] h-[env(safe-area-inset-bottom)]" />
        </nav>
    );
}
