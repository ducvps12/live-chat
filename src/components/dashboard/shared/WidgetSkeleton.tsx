import React from 'react';

type SkeletonVariant = 'stat-card' | 'chart' | 'list' | 'gauge' | 'heatmap' | 'action-center';

interface WidgetSkeletonProps {
    variant: SkeletonVariant;
    className?: string;
}

/**
 * Universal skeleton loading component for dashboard widgets.
 * Provides consistent loading states to prevent CLS (Cumulative Layout Shift).
 */
export function WidgetSkeleton({ variant, className = '' }: WidgetSkeletonProps) {
    const baseClasses = 'bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 animate-pulse';

    const skeletons: Record<SkeletonVariant, React.ReactNode> = {
        'stat-card': (
            <div className={`${baseClasses} p-6 ${className}`}>
                <div className="flex justify-between items-start">
                    <div className="space-y-2">
                        <div className="h-4 w-24 bg-neutral-200 dark:bg-neutral-700 rounded" />
                        <div className="h-8 w-16 bg-neutral-200 dark:bg-neutral-700 rounded" />
                    </div>
                    <div className="h-10 w-10 bg-neutral-200 dark:bg-neutral-700 rounded-lg" />
                </div>
                <div className="mt-4 h-3 w-32 bg-neutral-100 dark:bg-neutral-700 rounded" />
            </div>
        ),

        'chart': (
            <div className={`${baseClasses} p-6 ${className}`}>
                <div className="h-5 w-40 bg-neutral-200 dark:bg-neutral-700 rounded mb-6" />
                <div className="flex items-end gap-2 h-48">
                    {[40, 60, 30, 80, 50, 70, 45, 55, 35, 65].map((h, i) => (
                        <div
                            key={i}
                            className="flex-1 bg-neutral-100 dark:bg-neutral-700 rounded-t"
                            style={{ height: `${h}%` }}
                        />
                    ))}
                </div>
            </div>
        ),

        'gauge': (
            <div className={`${baseClasses} p-6 ${className}`}>
                <div className="h-5 w-24 bg-neutral-200 dark:bg-neutral-700 rounded mb-4" />
                <div className="flex justify-center">
                    <div className="h-32 w-32 bg-neutral-100 dark:bg-neutral-700 rounded-full" />
                </div>
                <div className="mt-4 space-y-2">
                    <div className="h-4 w-full bg-neutral-100 dark:bg-neutral-700 rounded" />
                    <div className="h-3 w-3/4 bg-neutral-100 dark:bg-neutral-700 rounded mx-auto" />
                </div>
            </div>
        ),

        'list': (
            <div className={`${baseClasses} p-6 ${className}`}>
                <div className="h-5 w-32 bg-neutral-200 dark:bg-neutral-700 rounded mb-4" />
                <div className="space-y-3">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="flex items-center gap-3">
                            <div className="h-10 w-10 bg-neutral-100 dark:bg-neutral-700 rounded-full" />
                            <div className="flex-1 space-y-2">
                                <div className="h-4 w-3/4 bg-neutral-100 dark:bg-neutral-700 rounded" />
                                <div className="h-3 w-1/2 bg-neutral-100 dark:bg-neutral-700 rounded" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        ),

        'heatmap': (
            <div className={`${baseClasses} p-6 ${className}`}>
                <div className="h-5 w-36 bg-neutral-200 dark:bg-neutral-700 rounded mb-4" />
                <div className="grid grid-cols-7 gap-1">
                    {Array(42).fill(0).map((_, i) => (
                        <div
                            key={i}
                            className="aspect-square bg-neutral-100 dark:bg-neutral-700 rounded-sm"
                        />
                    ))}
                </div>
            </div>
        ),

        'action-center': (
            <div className={`${baseClasses} p-4 ${className}`}>
                <div className="flex items-start gap-4">
                    <div className="h-10 w-10 bg-neutral-200 dark:bg-neutral-700 rounded-lg flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                        <div className="h-4 w-3/4 bg-neutral-200 dark:bg-neutral-700 rounded" />
                        <div className="h-3 w-full bg-neutral-100 dark:bg-neutral-700 rounded" />
                    </div>
                    <div className="flex gap-2">
                        <div className="h-8 w-20 bg-neutral-200 dark:bg-neutral-700 rounded" />
                        <div className="h-8 w-20 bg-neutral-200 dark:bg-neutral-700 rounded" />
                    </div>
                </div>
            </div>
        ),
    };

    return <>{skeletons[variant]}</>;
}

/**
 * Grid skeleton for multiple stat cards
 */
export function StatCardGridSkeleton({ count = 4, className = '' }: { count?: number; className?: string }) {
    return (
        <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 ${className}`}>
            {Array(count).fill(0).map((_, i) => (
                <WidgetSkeleton key={i} variant="stat-card" />
            ))}
        </div>
    );
}

export default WidgetSkeleton;
