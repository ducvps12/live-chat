import React from 'react';

type EmptyStateType = 'no-data' | 'no-channels' | 'loading-failed' | 'no-permission' | 'coming-soon';
type IllustrationType = 'chart' | 'inbox' | 'connect' | 'lock' | 'search' | 'rocket';

interface EmptyStateAction {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
    variant?: 'primary' | 'secondary';
}

interface WidgetEmptyStateProps {
    type: EmptyStateType;
    title: string;
    description: string;
    action?: EmptyStateAction;
    secondaryAction?: EmptyStateAction;
    illustration?: IllustrationType;
    className?: string;
}

/**
 * Empty state component for dashboard widgets.
 * Provides actionable guidance instead of blank states.
 */
export function WidgetEmptyState({
    title,
    description,
    action,
    secondaryAction,
    illustration = 'chart',
    className = '',
}: WidgetEmptyStateProps) {
    return (
        <div className={`flex flex-col items-center justify-center py-12 px-6 text-center ${className}`}>
            {/* Illustration */}
            <EmptyIllustration type={illustration} className="w-24 h-24 mb-6" />

            {/* Content */}
            <h3 className="text-base font-semibold text-neutral-700 dark:text-neutral-200 mb-2">
                {title}
            </h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-xs mb-6">
                {description}
            </p>

            {/* Actions */}
            {(action || secondaryAction) && (
                <div className="flex flex-wrap items-center justify-center gap-3">
                    {action && (
                        <button
                            onClick={action.onClick}
                            className={`
                inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                transition-colors cursor-pointer
                ${action.variant === 'secondary'
                                    ? 'bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-600'
                                    : 'bg-blue-600 text-white hover:bg-blue-700'
                                }
              `}
                        >
                            {action.icon}
                            {action.label}
                        </button>
                    )}
                    {secondaryAction && (
                        <button
                            onClick={secondaryAction.onClick}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-600 transition-colors cursor-pointer"
                        >
                            {secondaryAction.icon}
                            {secondaryAction.label}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

/**
 * SVG illustrations for empty states
 */
function EmptyIllustration({ type, className }: { type: IllustrationType; className?: string }) {
    const illustrations: Record<IllustrationType, React.ReactNode> = {
        chart: (
            <svg className={className} viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="8" y="56" width="16" height="32" rx="2" className="fill-neutral-200 dark:fill-neutral-700" />
                <rect x="28" y="40" width="16" height="48" rx="2" className="fill-neutral-200 dark:fill-neutral-700" />
                <rect x="48" y="24" width="16" height="64" rx="2" className="fill-neutral-300 dark:fill-neutral-600" />
                <rect x="68" y="48" width="16" height="40" rx="2" className="fill-neutral-200 dark:fill-neutral-700" />
                <path d="M8 20L32 32L56 16L88 28" className="stroke-neutral-300 dark:stroke-neutral-600" strokeWidth="2" strokeLinecap="round" strokeDasharray="4 4" />
            </svg>
        ),
        inbox: (
            <svg className={className} viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="16" y="24" width="64" height="48" rx="4" className="fill-neutral-200 dark:fill-neutral-700" />
                <path d="M16 32L48 52L80 32" className="stroke-neutral-300 dark:stroke-neutral-600" strokeWidth="2" strokeLinecap="round" />
                <circle cx="72" cy="28" r="8" className="fill-blue-500" />
                <text x="72" y="32" textAnchor="middle" className="fill-white text-xs font-bold">0</text>
            </svg>
        ),
        connect: (
            <svg className={className} viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="28" cy="48" r="12" className="fill-neutral-200 dark:fill-neutral-700" />
                <circle cx="68" cy="48" r="12" className="fill-neutral-200 dark:fill-neutral-700" />
                <path d="M40 48H56" className="stroke-neutral-300 dark:stroke-neutral-600" strokeWidth="2" strokeLinecap="round" strokeDasharray="4 4" />
                <path d="M48 40V56" className="stroke-blue-500" strokeWidth="2" strokeLinecap="round" />
                <path d="M40 48H56" className="stroke-blue-500" strokeWidth="2" strokeLinecap="round" />
            </svg>
        ),
        lock: (
            <svg className={className} viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="28" y="40" width="40" height="36" rx="4" className="fill-neutral-200 dark:fill-neutral-700" />
                <path d="M36 40V32C36 25.373 41.373 20 48 20C54.627 20 60 25.373 60 32V40" className="stroke-neutral-300 dark:stroke-neutral-600" strokeWidth="4" strokeLinecap="round" />
                <circle cx="48" cy="56" r="4" className="fill-neutral-400 dark:fill-neutral-500" />
            </svg>
        ),
        search: (
            <svg className={className} viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="44" cy="44" r="20" className="stroke-neutral-300 dark:stroke-neutral-600" strokeWidth="4" />
                <path d="M60 60L76 76" className="stroke-neutral-300 dark:stroke-neutral-600" strokeWidth="4" strokeLinecap="round" />
                <path d="M36 44H52" className="stroke-neutral-200 dark:stroke-neutral-700" strokeWidth="2" strokeLinecap="round" />
            </svg>
        ),
        rocket: (
            <svg className={className} viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M48 16C48 16 32 32 32 56C32 72 48 80 48 80C48 80 64 72 64 56C64 32 48 16 48 16Z" className="fill-neutral-200 dark:fill-neutral-700" />
                <circle cx="48" cy="48" r="8" className="fill-blue-500" />
                <path d="M32 64L24 80H40L32 64Z" className="fill-neutral-300 dark:fill-neutral-600" />
                <path d="M64 64L72 80H56L64 64Z" className="fill-neutral-300 dark:fill-neutral-600" />
            </svg>
        ),
    };

    return <>{illustrations[type]}</>;
}

export default WidgetEmptyState;
