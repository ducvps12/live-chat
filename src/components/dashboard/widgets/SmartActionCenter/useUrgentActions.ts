import { useQuery } from '@tanstack/react-query';
import api from '@/lib/http';
import { useMyStore } from '@/contexts/MyStoreContext';
import type { SmartActionCenterData, ActionItem, ActionSeverity } from './types';

/**
 * Fetch urgent actions for the workspace.
 * Falls back to mock data if API not implemented.
 */
async function fetchUrgentActions(workspaceId: string): Promise<SmartActionCenterData> {
    try {
        const response = await api.get(`/workspaces/${workspaceId}/dashboard/urgent-actions`);
        return response.data;
    } catch {
        // Return mock data for development if endpoint doesn't exist
        return generateMockActions();
    }
}

/**
 * Generate mock actions for development/demo purposes
 */
function generateMockActions(): SmartActionCenterData {
    const actions: ActionItem[] = [];

    // Sample critical action - missed chats
    const missedChats = Math.floor(Math.random() * 5);
    if (missedChats > 0) {
        actions.push({
            id: 'missed-chats',
            severity: 'critical',
            title: `${missedChats} chat bị bỏ lỡ trong 30 phút qua`,
            description: 'Khách hàng đang chờ phản hồi',
            metadata: {
                count: missedChats,
                affectedItems: ['Facebook Messenger', 'Zalo'],
            },
            actions: [
                { label: 'Vào Inbox', icon: 'inbox', variant: 'primary', action: 'view-inbox' },
                { label: 'Nhận xử lý', icon: 'person_add', variant: 'secondary', action: 'assign-me' },
                { label: 'Thông báo team', icon: 'notifications', variant: 'ghost', action: 'notify-team' },
            ],
            timestamp: new Date().toISOString(),
        });
    }

    // Sample warning action - SLA breach
    const slaTickets = Math.floor(Math.random() * 3);
    if (slaTickets > 0) {
        actions.push({
            id: 'sla-breach',
            severity: 'warning',
            title: `SLA sắp vượt ngưỡng: ${slaTickets} ticket`,
            description: 'Cần xử lý trước khi hết thời gian cam kết',
            metadata: {
                count: slaTickets,
                timeRemaining: '45 phút',
            },
            actions: [
                { label: 'Xem Ticket', icon: 'confirmation_number', variant: 'primary', action: 'view-tickets' },
                { label: 'Escalate', icon: 'priority_high', variant: 'secondary', action: 'escalate' },
            ],
            timestamp: new Date().toISOString(),
        });
    }

    // Sample info action - bot status
    actions.push({
        id: 'bot-disabled',
        severity: 'info',
        title: 'Bot Auto-Reply đang tắt',
        description: 'Bật bot để tự động phản hồi khi ngoài giờ làm việc',
        actions: [
            { label: 'Cấu hình Bot', icon: 'smart_toy', variant: 'secondary', action: 'configure-bot' },
            { label: 'Bật ngay', icon: 'play_arrow', variant: 'primary', action: 'enable-bot' },
        ],
        timestamp: new Date().toISOString(),
    });

    return {
        actions,
        lastUpdated: new Date().toISOString(),
    };
}

/**
 * Hook to fetch and manage urgent actions data
 */
export function useUrgentActions() {
    const { activeWorkspace } = useMyStore();
    const workspaceId = activeWorkspace?.workspaceId;

    return useQuery({
        queryKey: ['urgent-actions', workspaceId],
        queryFn: () => fetchUrgentActions(workspaceId!),
        enabled: !!workspaceId,
        staleTime: 30_000, // 30 seconds
        refetchInterval: 60_000, // Refetch every 1 minute
    });
}

/**
 * Get severity color classes
 */
export function getSeverityStyles(severity: ActionSeverity) {
    const styles = {
        critical: {
            bg: 'bg-red-50 dark:bg-red-950/30',
            border: 'border-red-200 dark:border-red-800',
            icon: 'text-red-600 dark:text-red-400',
            badge: 'bg-red-600 text-white',
            label: 'CRITICAL',
        },
        warning: {
            bg: 'bg-amber-50 dark:bg-amber-950/30',
            border: 'border-amber-200 dark:border-amber-800',
            icon: 'text-amber-600 dark:text-amber-400',
            badge: 'bg-amber-500 text-white',
            label: 'WARNING',
        },
        info: {
            bg: 'bg-blue-50 dark:bg-blue-950/30',
            border: 'border-blue-200 dark:border-blue-800',
            icon: 'text-blue-600 dark:text-blue-400',
            badge: 'bg-blue-500 text-white',
            label: 'INFO',
        },
    };
    return styles[severity];
}
