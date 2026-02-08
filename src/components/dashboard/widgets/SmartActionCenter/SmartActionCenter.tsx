import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';
import { ActionCard } from './ActionCard';
import { useUrgentActions } from './useUrgentActions';
import { WidgetSkeleton } from '../../shared/WidgetSkeleton';
import { WidgetEmptyState } from '../../shared/WidgetEmptyState';
import {
    Bell,
    ChevronDown,
    ChevronUp,
    CheckCircle2,
    AlertCircle
} from 'lucide-react';

/**
 * Smart Action Center - Displays urgent actions requiring immediate attention.
 * Actions are severity-coded (critical/warning/info) with contextual CTAs.
 */
export function SmartActionCenter() {
    const { t } = useTranslation();
    const router = useRouter();
    const { data, isLoading, error, refetch } = useUrgentActions();
    const [isCollapsed, setIsCollapsed] = useState(false);

    const handleActionClick = useCallback((actionType: string, actionId: string) => {
        console.log('Action clicked:', actionType, actionId);

        // Handle different action types
        switch (actionType) {
            case 'view-inbox':
                router.push('/workspace/inbox');
                break;
            case 'assign-me':
                // TODO: Implement assign to self API
                console.log('Assign to me:', actionId);
                break;
            case 'notify-team':
                // TODO: Implement team notification
                console.log('Notify team:', actionId);
                break;
            case 'view-tickets':
                router.push('/workspace/tickets');
                break;
            case 'escalate':
                // TODO: Implement escalation flow
                console.log('Escalate:', actionId);
                break;
            case 'configure-bot':
                router.push('/workspace/settings/bot');
                break;
            case 'enable-bot':
                // TODO: Implement quick enable bot API
                console.log('Enable bot');
                break;
            default:
                console.log('Unknown action:', actionType);
        }
    }, [router]);

    // Loading state
    if (isLoading) {
        return (
            <div className="space-y-3">
                <WidgetSkeleton variant="action-center" />
                <WidgetSkeleton variant="action-center" />
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="glass-card-enterprise p-4">
                <WidgetEmptyState
                    type="loading-failed"
                    title="Không thể tải thông báo"
                    description="Đã xảy ra lỗi khi tải danh sách cần xử lý"
                    illustration="inbox"
                    action={{
                        label: 'Thử lại',
                        onClick: () => refetch(),
                    }}
                />
            </div>
        );
    }

    // No actions state - Premium success banner
    if (!data?.actions || data.actions.length === 0) {
        return (
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-green-50 via-emerald-50 to-teal-50 border border-green-200 p-6">
                {/* Background decoration */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-green-100 rounded-full blur-3xl opacity-50 -translate-y-1/2 translate-x-1/2" />

                <div className="relative flex items-center gap-4">
                    <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-green-400 to-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-green-500/25">
                        <CheckCircle2 className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h3 className="text-base font-bold text-green-800">
                            Mọi thứ đang ổn!
                        </h3>
                        <p className="text-sm text-green-600 mt-0.5">
                            Không có hành động nào cần xử lý ngay lúc này
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // Filter actions by severity for ordering
    const criticalActions = data.actions.filter((a) => a.severity === 'critical');
    const warningActions = data.actions.filter((a) => a.severity === 'warning');
    const infoActions = data.actions.filter((a) => a.severity === 'info');
    const sortedActions = [...criticalActions, ...warningActions, ...infoActions];

    return (
        <div className="glass-card-enterprise overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-neutral-50 to-neutral-100/50 border-b border-neutral-200">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-100 rounded-lg">
                        <Bell className="w-5 h-5 text-amber-600" />
                    </div>
                    <h2 className="text-sm font-bold text-neutral-900">
                        Trung tâm Hành động
                    </h2>
                    {criticalActions.length > 0 && (
                        <span className="flex items-center gap-1.5 bg-red-600 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-lg shadow-red-500/25">
                            <AlertCircle className="w-3 h-3" />
                            {criticalActions.length}
                        </span>
                    )}
                </div>
                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="p-2 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-lg transition-all cursor-pointer"
                >
                    {isCollapsed ? (
                        <ChevronDown className="w-5 h-5" />
                    ) : (
                        <ChevronUp className="w-5 h-5" />
                    )}
                </button>
            </div>

            {/* Actions List */}
            {!isCollapsed && (
                <div className="p-4 space-y-3">
                    {sortedActions.map((action) => (
                        <ActionCard
                            key={action.id}
                            action={action}
                            onActionClick={handleActionClick}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

export default SmartActionCenter;
