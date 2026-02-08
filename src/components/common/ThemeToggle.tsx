import React, { useState, useEffect, useCallback } from 'react';

export const ThemeToggle: React.FC<{ className?: string }> = ({ className = '' }) => {
    const [isDark, setIsDark] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        const saved = localStorage.getItem('theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const dark = saved === 'dark' || (!saved && prefersDark);
        setIsDark(dark);
        document.documentElement.classList.toggle('dark', dark);
    }, []);

    const toggle = useCallback(() => {
        setIsDark(prev => {
            const next = !prev;
            localStorage.setItem('theme', next ? 'dark' : 'light');
            document.documentElement.classList.toggle('dark', next);
            return next;
        });
    }, []);

    if (!mounted) return null;

    return (
        <button
            onClick={toggle}
            className={`relative w-9 h-9 flex items-center justify-center rounded-lg transition-all duration-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 group ${className}`}
            title={isDark ? 'Chế độ sáng' : 'Chế độ tối'}
            aria-label="Toggle theme"
        >
            {/* Sun icon */}
            <span
                className={`material-symbols-outlined text-[20px] absolute transition-all duration-500 ${isDark
                        ? 'opacity-0 rotate-90 scale-50'
                        : 'opacity-100 rotate-0 scale-100 text-amber-500'
                    }`}
            >
                light_mode
            </span>
            {/* Moon icon */}
            <span
                className={`material-symbols-outlined text-[20px] absolute transition-all duration-500 ${isDark
                        ? 'opacity-100 rotate-0 scale-100 text-blue-300'
                        : 'opacity-0 -rotate-90 scale-50'
                    }`}
            >
                dark_mode
            </span>
        </button>
    );
};
