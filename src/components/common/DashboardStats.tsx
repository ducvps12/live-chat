/**
 * Workspace Statistics Dashboard Component
 * Displays conversation counts, unread totals, and agent performance
 */
import { useState, useEffect } from 'react';
import { useMyStore } from '@/contexts/MyStoreContext';
import { getWorkspaceStats, WorkspaceStats } from '@/services/conversation.service';
import { usePermission, IfPermission } from '@/hooks/usePermission';

interface DashboardStatsProps {
    className?: string;
}

export default function DashboardStats({ className = '' }: DashboardStatsProps) {
    const { activeWorkspace } = useMyStore();
    const { canViewReports } = usePermission();
    const [stats, setStats] = useState<WorkspaceStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!activeWorkspace?.workspaceId) {
            setIsLoading(false);
            return;
        }

        const loadStats = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const data = await getWorkspaceStats(activeWorkspace.workspaceId);
                setStats(data);
            } catch (err) {
                console.error('Failed to load workspace stats:', err);
                setError('Failed to load statistics');
            } finally {
                setIsLoading(false);
            }
        };

        loadStats();
    }, [activeWorkspace?.workspaceId]);

    if (!canViewReports) {
        return null;
    }

    if (isLoading) {
        return (
            <div className={`grid grid-cols-1 md:grid-cols-4 gap-4 ${className}`}>
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="bg-white rounded-xl p-6 shadow-sm animate-pulse">
                        <div className="h-4 bg-gray-200 rounded w-24 mb-2" />
                        <div className="h-8 bg-gray-200 rounded w-16" />
                    </div>
                ))}
            </div>
        );
    }

    if (error || !stats) {
        return (
            <div className={`bg-red-50 border border-red-200 rounded-xl p-4 text-red-600 ${className}`}>
                {error || 'No statistics available'}
            </div>
        );
    }

    const statCards = [
        {
            label: 'Total Conversations',
            value: stats.totalConversations,
            icon: '💬',
            color: 'bg-blue-50 text-blue-600',
        },
        {
            label: 'Active Conversations',
            value: stats.activeConversations,
            icon: '🟢',
            color: 'bg-green-50 text-green-600',
        },
        {
            label: 'Unread Messages',
            value: stats.totalUnreadMessages,
            icon: '📩',
            color: stats.totalUnreadMessages > 0 ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-600',
        },
        {
            label: 'Conversations Waiting',
            value: stats.conversationsWithUnread,
            icon: '⏳',
            color: stats.conversationsWithUnread > 0 ? 'bg-orange-50 text-orange-600' : 'bg-gray-50 text-gray-600',
        },
    ];

    return (
        <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 ${className}`}>
            {statCards.map((card, index) => (
                <div
                    key={index}
                    className={`rounded-xl p-6 shadow-sm border border-gray-100 ${card.color.split(' ')[0]}`}
                >
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-600">{card.label}</span>
                        <span className="text-2xl">{card.icon}</span>
                    </div>
                    <div className={`text-3xl font-bold ${card.color.split(' ')[1]}`}>
                        {card.value}
                    </div>
                </div>
            ))}
        </div>
    );
}

/**
 * Minimal stats bar for sidebar/header
 */
export function WorkspaceStatsBadge() {
    const { activeWorkspace } = useMyStore();
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        if (!activeWorkspace?.workspaceId) return;

        const loadStats = async () => {
            try {
                const data = await getWorkspaceStats(activeWorkspace.workspaceId);
                setUnreadCount(data.totalUnreadMessages);
            } catch (err) {
                console.error('Failed to load stats badge:', err);
            }
        };

        loadStats();
        // Refresh every 30 seconds
        const interval = setInterval(loadStats, 30000);
        return () => clearInterval(interval);
    }, [activeWorkspace?.workspaceId]);

    if (unreadCount === 0) return null;

    return (
        <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold text-white bg-red-500 rounded-full">
            {unreadCount > 99 ? '99+' : unreadCount}
        </span>
    );
}
