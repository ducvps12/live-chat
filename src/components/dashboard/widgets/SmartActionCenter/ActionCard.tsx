import React from 'react';
import { useRouter } from 'next/router';
import type { ActionItem, ActionButton } from './types';
import { getSeverityStyles } from './useUrgentActions';

interface ActionCardProps {
    action: ActionItem;
    onActionClick: (actionType: string, actionId: string) => void;
}

/**
 * Individual action card within the Smart Action Center.
 * Displays severity-coded urgent actions with contextual CTAs.
 */
export function ActionCard({ action, onActionClick }: ActionCardProps) {
    const styles = getSeverityStyles(action.severity);
    const router = useRouter();

    const handleButtonClick = (btn: ActionButton) => {
        if (btn.href) {
            router.push(btn.href);
        } else {
            onActionClick(btn.action, action.id);
        }
    };

    const getSeverityIcon = () => {
        switch (action.severity) {
            case 'critical':
                return 'error';
            case 'warning':
                return 'warning';
            case 'info':
                return 'info';
        }
    };

    return (
        <div className={`rounded-lg border p-4 ${styles.bg} ${styles.border}`}>
            <div className="flex items-start gap-4">
                {/* Severity Icon */}
                <div className={`flex-shrink-0 ${styles.icon}`}>
                    <span className="material-symbols-outlined text-2xl">
                        {getSeverityIcon()}
                    </span>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${styles.badge}`}>
                            {styles.label}
                        </span>
                    </div>
                    <h4 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-1">
                        {action.title}
                    </h4>
                    <p className="text-xs text-neutral-600 dark:text-neutral-400 mb-3">
                        {action.description}
                        {action.metadata?.affectedItems && (
                            <span className="block mt-1 text-neutral-500">
                                Nguồn: {action.metadata.affectedItems.join(', ')}
                            </span>
                        )}
                        {action.metadata?.timeRemaining && (
                            <span className="block mt-1 font-medium text-amber-600 dark:text-amber-400">
                                ⏱️ Còn {action.metadata.timeRemaining}
                            </span>
                        )}
                    </p>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap items-center gap-2">
                        {action.actions.map((btn, idx) => (
                            <button
                                key={idx}
                                onClick={() => handleButtonClick(btn)}
                                className={`
                  inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium
                  transition-colors cursor-pointer
                  ${btn.variant === 'primary'
                                        ? 'bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-200'
                                        : btn.variant === 'secondary'
                                            ? 'bg-white dark:bg-neutral-700 text-neutral-700 dark:text-neutral-200 border border-neutral-300 dark:border-neutral-600 hover:bg-neutral-50 dark:hover:bg-neutral-600'
                                            : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-700'
                                    }
                `}
                            >
                                {btn.icon && (
                                    <span className="material-symbols-outlined text-[14px]">
                                        {btn.icon}
                                    </span>
                                )}
                                {btn.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ActionCard;
