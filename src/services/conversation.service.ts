/**
 * Conversation API service
 */
import api from '@/lib/http';

export interface Conversation {
  conversationId: string;
  conversationKey: number;
  visitorId: string;
  visitorName: string | null;
  widgetId: string;
  widgetName: string;
  siteKey: string;
  workspaceName?: string;
  workspaceId?: string;
  domain?: string;
  status: number;
  messageCount: number;
  unreadCount?: number; // New field
  lastMessageContent: string | null;
  // Rename to match backend or map it?
  // Backend returns: lastMessagePreview (mapped to lastMessageContent?), lastMessageAt
  // Backend: lastMessagePreview (string)
  // Frontend: lastMessageContent
  lastMessagePreview?: string;
  lastMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
  assignedUserKey?: number;
  assignedAgentName?: string;
}

export interface Message {
  id: string;
  seq: number;
  text: string;
  sender: 'visitor' | 'agent';
  senderType: number;
  senderId: string;
  createdAt: string;
  clientMsgId?: string;
}

export interface ConversationListResponse {
  conversations: Conversation[];
  count: number; // Updated from total
}

export interface MessageListResponse {
  items: Message[];
  nextCursor?: number | null;
  hasMore?: boolean; // Frontend helper
}

/**
 * Get conversations for workspace
 * Uses new workspace-scoped endpoint: GET /embed/workspaces/:workspaceId/conversations
 */
export const getConversations = async (
  workspaceId: string,
  options?: { status?: 'open' | 'closed'; page?: number; limit?: number }
): Promise<ConversationListResponse> => {
  const params = new URLSearchParams();
  if (options?.status) params.append('status', options.status);
  if (options?.page) params.append('offset', String((options.page - 1) * (options.limit || 50)));
  if (options?.limit) params.append('limit', String(options.limit));

  const response = await api.get<{ status: string; data: ConversationListResponse }>(
    `/embed/workspaces/${workspaceId}/conversations?${params.toString()}`
  );
  return response.data.data;
};

/**
 * Get workspace statistics (conversation counts, unread totals)
 * GET /embed/workspaces/:workspaceId/stats
 */
export interface WorkspaceStats {
  workspaceId: string;
  totalConversations: number;
  activeConversations: number;
  conversationsWithUnread: number;
  totalUnreadMessages: number;
}

export const getWorkspaceStats = async (workspaceId: string): Promise<WorkspaceStats> => {
  const response = await api.get<{ status: string; data: WorkspaceStats }>(
    `/embed/workspaces/${workspaceId}/stats`
  );
  return response.data.data;
};

/**
 * Get messages for a conversation
 * Supports cursor-based pagination
 */
export const getMessages = async (
  workspaceId: string,
  conversationId: string,
  options?: { limit?: number; beforeSeq?: number; before?: string } // before for legacy
): Promise<MessageListResponse> => {
  const params = new URLSearchParams();
  if (options?.limit) params.append('limit', String(options.limit));
  if (options?.beforeSeq) params.append('cursorSeq', String(options.beforeSeq)); // Map to backend param
  if (options?.before) params.append('before', options.before);

  const response = await api.get<{ status: string; data: any }>(
    `/embed/conversations/${conversationId}/messages?${params.toString()}`,
    {
      headers: { 'x-workspace-id': workspaceId },
    }
  );

  // Normalize response
  const data = response.data.data;
  if (Array.isArray(data)) {
    // Legacy mapping or specific endpoint return
    return { items: data, nextCursor: null };
  } else if (data.messages) {
    // Legacy Controller getMessages format
    return { items: data.messages, nextCursor: null };
  }

  // New format { items, nextCursor }
  return data;
};

/**
 * Mark conversation as read
 */
export const markRead = async (
  workspaceId: string,
  conversationId: string
): Promise<{ unreadCount: number }> => {
  const response = await api.post<{ status: string; data: { unreadCount: number } }>(
    `/embed/conversations/${conversationId}/read`,
    {},
    {
      headers: { 'x-workspace-id': workspaceId },
    }
  );
  return response.data.data;
};

/**
 * Send message as agent (HTTP fallback)
 */
export const sendMessage = async (
  workspaceId: string,
  conversationId: string,
  text: string
): Promise<Message> => {
  const response = await api.post<{ status: string; data: Message }>(
    `/embed/conversations/${conversationId}/messages`,
    { text },
    {
      headers: { 'x-workspace-id': workspaceId },
    }
  );
  return response.data.data;
};

/**
 * Update conversation status
 */
export const updateConversationStatus = async (
  workspaceId: string,
  conversationId: string,
  status: 'open' | 'closed'
): Promise<void> => {
  await api.patch(
    `/embed/conversations/${conversationId}`,
    { status: status === 'open' ? 1 : 2 },
    {
      headers: { 'x-workspace-id': workspaceId },
    }
  );
};

/**
 * Assign conversation to agent
 * POST /embed/conversations/:conversationId/assign
 */
export const assignConversation = async (
  workspaceId: string,
  conversationId: string,
  agentId?: string // UserKey is string in frontend types usually? Backend expects number?
  // Backend repo says: input('userKey', sql.BigInt, userKey)
  // Frontend UserKey is string in auth.ts (UserKey: string).
  // I should pass string, backend handles conversion or keep as string.
  // Wait, backend `assignConversation` controller expects `agentId`.
  // Repos uses `BigInt`.
): Promise<void> => {
  await api.post(
    `/embed/conversations/${conversationId}/assign`,
    { agentId },
    {
      headers: { 'x-workspace-id': workspaceId },
    }
  );
};

/**
 * Update visitor contact info (email, phone, name)
 * PATCH /embed/conversations/:conversationId/contact
 */
export const updateVisitorContact = async (
  workspaceId: string,
  conversationId: string,
  contactInfo: { name?: string; email?: string; phone?: string }
): Promise<{ updated: boolean }> => {
  const response = await api.patch<{ status: string; data: { updated: boolean } }>(
    `/embed/conversations/${conversationId}/contact`,
    contactInfo,
    {
      headers: { 'x-workspace-id': workspaceId },
    }
  );
  return response.data.data;
};
