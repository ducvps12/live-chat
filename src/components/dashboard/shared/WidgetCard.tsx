import React from 'react';

interface WidgetCardProps {
    title: string;
    subtitle?: string;
    action?: React.ReactNode;
    children: React.ReactNode;
    className?: string;
    noPadding?: boolean;
}

/**
 * Consistent card wrapper for all dashboard widgets.
 * Provides unified styling, header, and optional action slot.
 */
export function WidgetCard({
    title,
    subtitle,
    action,
    children,
    className = '',
    noPadding = false,
}: WidgetCardProps) {
    return (
        <div
            className={`
        bg-white dark:bg-neutral-800 
        rounded-xl border border-neutral-200 dark:border-neutral-700 
        shadow-sm
        ${className}
      `}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 dark:border-neutral-700">
                <div>
                    <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                        {title}
                    </h3>
                    {subtitle && (
                        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
                            {subtitle}
                        </p>
                    )}
                </div>
                {action && <div className="flex-shrink-0">{action}</div>}
            </div>

            {/* Content */}
            <div className={noPadding ? '' : 'p-6'}>{children}</div>
        </div>
    );
}

export default WidgetCard;
