import { useQuery } from '@tanstack/react-query';
import { conversationApi } from './conversation.api';

export const conversationKeys = {
    all: ['conversations'] as const,
    unreadCount: (workspaceId: string) => [...conversationKeys.all, workspaceId, 'unread-count'] as const,
};

export function useTotalUnreadCount(workspaceId: string, enabled = true) {
    return useQuery({
        queryKey: conversationKeys.unreadCount(workspaceId),
        queryFn: () => conversationApi.getUnreadCount(workspaceId),
        enabled: !!workspaceId && enabled,
    });
}
