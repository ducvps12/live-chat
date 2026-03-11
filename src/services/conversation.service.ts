import { httpClient } from '../lib/http/client';
import { Visitor } from '../types/visitor';
import { ApiResponse } from '../types';

export const conversationService = {
    getVisitor: async (workspaceId: string, visitorId: string): Promise<Visitor> => {
        const res = await httpClient.get<ApiResponse<Visitor>>(`/conversations/workspace/${workspaceId}/visitors/${visitorId}`);
        return res.data.data;
    },
    updateVisitor: async (
        workspaceId: string,
        visitorId: string,
        data: { name?: string; email?: string; phone?: string; attributes?: Record<string, any> }
    ): Promise<Visitor> => {
        const res = await httpClient.patch<ApiResponse<Visitor>>(`/conversations/workspace/${workspaceId}/visitors/${visitorId}`, data);
        return res.data.data;
    },
    getUnreadCount: async (workspaceId: string): Promise<number> => {
        const res = await httpClient.get<ApiResponse<{ unreadCount: number }>>(`/conversations/workspace/${workspaceId}/unread-count`);
        return res.data.data.unreadCount;
    }
};
