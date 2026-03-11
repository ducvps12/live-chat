import { conversationRepo } from './repos/conversation.repo';
import { messageRepo } from './repos/message.repo';
import { visitorRepo } from './repos/visitor.repo';
import { widgetRepo } from '../workspace/repos/widget.repo';
import { AppError } from '../../middlewares/errorHandler';
import { security } from '../../infra/security';
import { sanitizeMessage, sanitizeFilename } from '../../infra/sanitize';
import { emitToConversation, emitToWorkspace } from '../../infra/socket';

export const conversationService = {
    /**
     * Find existing open conversation for visitor, or create a new one.
     * Also upserts visitor profile.
     */
    async findOrCreate(widgetId: string, visitorId: string, visitorInfo: Record<string, any> = {}, metadata: Record<string, any> = {}) {
        const widget = await widgetRepo.findById(widgetId);
        if (!widget || !widget.isActive) throw new AppError('Widget không tồn tại', 404, 'NOT_FOUND');

        // Upsert visitor profile
        const { visitor } = await visitorRepo.findOrCreate(
            visitorId,
            widgetId,
            (widget.workspaceId as any).toString(),
            visitorInfo
        );

        // Try to find existing open conversation
        let conversation = await conversationRepo.findActiveByVisitor(visitorId, widgetId);
        let isNew = false;

        if (!conversation) {
            conversation = await conversationRepo.create({
                workspaceId: widget.workspaceId,
                widgetId: widget._id as any,
                visitorId,
                visitorInfo,
                status: 'open',
                lastMessageAt: new Date(),
                metadata,
            });
            isNew = true;
            await visitorRepo.incrementConversations(visitorId, widgetId);
        }

        const msgResult = await messageRepo.findByConversation(conversation._id.toString(), { limit: 30, excludeInternal: true });
        const messages = msgResult.items;

        // Generate visitor token for socket auth
        const visitorToken = security.generateVisitorToken(visitorId, widgetId);

        // Emit workspace event for new conversations
        if (isNew) {
            try {
                emitToWorkspace((widget.workspaceId as any).toString(), 'conversation:new', {
                    conversation, visitor, visitorInfo,
                });
            } catch { /* socket may not be initialized yet */ }
        }

        return { conversation, messages, totalMessages: msgResult.total, visitor, visitorToken, isNew };
    },

    /**
     * Resume conversation — get conversation + messages
     */
    async resume(conversationId: string, visitorId: string) {
        const conversation = await conversationRepo.findById(conversationId);
        if (!conversation) throw new AppError('Cuộc hội thoại không tồn tại', 404, 'NOT_FOUND');
        if (conversation.visitorId !== visitorId) throw new AppError('Không có quyền', 403, 'FORBIDDEN');

        const msgResult = await messageRepo.findByConversation(conversation._id.toString(), { limit: 30, excludeInternal: true });
        return { conversation, messages: msgResult.items, totalMessages: msgResult.total };
    },

    /**
     * Add a message to a conversation.
     */
    async addMessage(
        conversationId: string,
        sender: { type: 'visitor' | 'agent' | 'system'; id: string; name?: string },
        content: string,
        msgType: 'text' | 'image' | 'file' | 'system' = 'text',
        attachments?: Array<{ data: string; filename: string; mimeType: string; size: number }>,
        clientMessageId?: string
    ) {
        const conversation = await conversationRepo.findById(conversationId);
        if (!conversation) throw new AppError('Cuộc hội thoại không tồn tại', 404, 'NOT_FOUND');

        // ── Idempotency check ──
        if (clientMessageId) {
            const existing = await messageRepo.findByClientMessageId(conversationId, clientMessageId);
            if (existing) return existing; // already processed — return same message
        }

        // ── Visitor checks ──
        if (sender.type === 'visitor') {
            if (conversation.visitorId !== sender.id) {
                throw new AppError('Không có quyền gửi tin nhắn', 403, 'FORBIDDEN');
            }
            if (conversation.status !== 'open') {
                await conversationRepo.updateStatus(conversationId, 'open');
            }
        }

        // ── Agent checks ──
        if (sender.type === 'agent') {
            if (conversation.status === 'closed') {
                throw new AppError('Cuộc hội thoại đã đóng. Vui lòng mở lại trước khi gửi tin nhắn.', 400, 'CONVERSATION_CLOSED');
            }
        }

        // ── Sanitize content ──
        let sanitizedContent = content;
        let sanitizeFlags: string[] = [];
        if (content && sender.type !== 'system') {
            const result = sanitizeMessage(content);
            if (result.blocked) {
                throw new AppError('Nội dung tin nhắn chứa mã độc hoặc spam', 400, 'CONTENT_BLOCKED');
            }
            sanitizedContent = result.sanitized;
            sanitizeFlags = result.flags;
        }

        // ── Sanitize attachment filenames ──
        const safeAttachments = (attachments || []).map((att) => ({
            ...att,
            filename: sanitizeFilename(att.filename),
        }));

        const message = await messageRepo.create({
            conversationId: conversation._id as any,
            clientMessageId: clientMessageId || undefined,
            sender,
            content: sanitizedContent,
            type: msgType,
            attachments: safeAttachments,
            sanitizeFlags: sanitizeFlags.length > 0 ? sanitizeFlags : undefined,
        });

        // ── Build conversation summary snippet ──
        const snippet = msgType === 'image' ? '📷 Hình ảnh'
            : msgType === 'file' ? '📎 Tệp đính kèm'
            : sanitizedContent.length > 80 ? sanitizedContent.slice(0, 80) + '…'
            : sanitizedContent;

        await conversationRepo.updateLastMessage(conversationId, {
            snippet,
            sender: { type: sender.type, name: sender.name },
            incrementUnread: sender.type !== 'agent', // visitor/system msgs count as unread for agents
        });

        // Emit to conversation room (both visitor + agents watching this conv)
        try {
            emitToConversation(conversationId, 'message:new', message);
            emitToWorkspace((conversation.workspaceId as any).toString(), 'conversation:updated', {
                conversationId, lastMessage: { content: sanitizedContent, sender, type: msgType, createdAt: message.createdAt },
            });
        } catch { /* socket may not be initialized */ }

        return message;
    },

    async getMessages(conversationId: string, options?: { page?: number; limit?: number }) {
        return messageRepo.findByConversation(conversationId, options);
    },

    async getMessageContextPage(conversationId: string, messageId: string, limit: number = 30) {
        const page = await messageRepo.getMessagePage(conversationId, messageId, limit);
        if (!page) throw new AppError('Message not found', 404, 'NOT_FOUND');
        return { page };
    },

    async markRead(conversationId: string, requester?: { userId: string; type: 'visitor' | 'agent' }) {
        if (!requester?.userId) {
            await conversationRepo.markRead(conversationId);
            return;
        }

        const latestMsg = await messageRepo.findLatest(conversationId);
        if (!latestMsg) {
            await conversationRepo.markRead(conversationId);
            return;
        }

        const latestMsgId = (latestMsg._id as any).toString();

        await conversationRepo.updateReadCursor(
            conversationId,
            requester.userId,
            requester.type,
            latestMsgId
        );

        if (requester.type === 'agent') {
            await messageRepo.markAsReadUpTo(conversationId, latestMsgId, 'visitor');
            await conversationRepo.markRead(conversationId);
        } else {
            await messageRepo.markAsReadUpTo(conversationId, latestMsgId, 'agent');
        }

        try {
            emitToConversation(conversationId, 'messages:read', {
                conversationId,
                lastReadMessageId: latestMsgId,
                participantId: requester.userId,
                participantType: requester.type
            });

            if (requester.type === 'agent') {
                const conv = await conversationRepo.findById(conversationId);
                if (conv) {
                    emitToWorkspace((conv.workspaceId as any).toString(), 'conversation:updated', {
                        conversationId,
                        unreadCount: 0
                    });
                }
            }
        } catch { /* socket might be missing during testing */ }
    },

    async getMessagesSince(conversationId: string, since: string) {
        return messageRepo.findSince(conversationId, new Date(since));
    },

    /**
     * Return up-to-date receipts for a conversation so a reconnecting client can backfill.
     * Returns:
     * - readCursors: per-participant read positions
     * - statuses: map of messageId -> current status for recent messages
     */
    async getReceipts(conversationId: string, limit: number = 100) {
        const conv = await conversationRepo.findById(conversationId);
        if (!conv) throw new AppError('Cuộc hội thoại không tồn tại', 404, 'NOT_FOUND');

        const recentMessages = await messageRepo.getLatest(conversationId, limit);
        const statuses: Record<string, string> = {};
        for (const msg of recentMessages) {
            statuses[(msg._id as any).toString()] = msg.status || 'sent';
        }

        return {
            readCursors: conv.readContext || [],
            statuses,
        };
    },

    async assignConversation(conversationId: string, agentId: string, agentName: string, expectUnassigned = false) {
        const conv = await conversationRepo.assignTo(conversationId, agentId, expectUnassigned);
        if (!conv && expectUnassigned) {
            // Collision: someone else already grabbed it
            throw new AppError(
                'Cuộc hội thoại đã được agent khác nhận trước. Vui lòng chọn cuộc hội thoại khác.',
                409,
                'ASSIGN_COLLISION'
            );
        }
        if (!conv) throw new AppError('Cuộc hội thoại không tồn tại', 404, 'NOT_FOUND');

        // Add system message
        await this.addMessage(
            conversationId,
            { type: 'system', id: 'system', name: 'System' },
            `${agentName} đã nhận cuộc hội thoại này`,
            'text'
        );

        // Notify workspace
        try {
            emitToWorkspace((conv.workspaceId as any).toString(), 'conversation:assigned', {
                conversationId,
                assignedTo: { id: agentId, name: agentName },
            });
        } catch { /* socket may not be initialized */ }

        return conv;
    },

    async unassignConversation(conversationId: string, agentName: string) {
        const conv = await conversationRepo.unassign(conversationId);
        if (!conv) throw new AppError('Cuộc hội thoại không tồn tại', 404, 'NOT_FOUND');

        await this.addMessage(
            conversationId,
            { type: 'system', id: 'system', name: 'System' },
            `${agentName} đã bỏ nhận cuộc hội thoại này`,
            'text'
        );

        try {
            emitToWorkspace((conv.workspaceId as any).toString(), 'conversation:assigned', {
                conversationId,
                assignedTo: null,
            });
        } catch { /* socket may not be initialized */ }

        return conv;
    },

    async transferConversation(
        conversationId: string,
        fromAgentName: string,
        toAgentId: string,
        toAgentName: string
    ) {
        const conv = await conversationRepo.assignTo(conversationId, toAgentId);
        if (!conv) throw new AppError('Cuộc hội thoại không tồn tại', 404, 'NOT_FOUND');

        // System message: "A đã chuyển cuộc hội thoại cho B"
        await this.addMessage(
            conversationId,
            { type: 'system', id: 'system', name: 'System' },
            `${fromAgentName} đã chuyển cuộc hội thoại cho ${toAgentName}`,
            'text'
        );

        // Notify workspace
        try {
            emitToWorkspace((conv.workspaceId as any).toString(), 'conversation:assigned', {
                conversationId,
                assignedTo: { id: toAgentId, name: toAgentName },
            });
        } catch { /* socket may not be initialized */ }

        return conv;
    },

    async closeConversation(conversationId: string, agentName?: string) {
        const conv = await conversationRepo.updateStatus(conversationId, 'closed');
        if (!conv) throw new AppError('Cuộc hội thoại không tồn tại', 404, 'NOT_FOUND');

        // System message
        const who = agentName || 'Hệ thống';
        await this.addMessage(
            conversationId,
            { type: 'system', id: 'system', name: 'System' },
            `${who} đã đóng cuộc hội thoại`,
            'text'
        );

        // Notify workspace + conversation room
        try {
            emitToConversation(conversationId, 'conversation:closed', { conversationId });
            emitToWorkspace((conv.workspaceId as any).toString(), 'conversation:closed', { conversationId });
        } catch { /* socket may not be initialized */ }

        return conv;
    },

    async reopenConversation(conversationId: string, agentName?: string) {
        const conv = await conversationRepo.updateStatus(conversationId, 'open');
        if (!conv) throw new AppError('Cuộc hội thoại không tồn tại', 404, 'NOT_FOUND');

        const who = agentName || 'Hệ thống';
        await this.addMessage(
            conversationId,
            { type: 'system', id: 'system', name: 'System' },
            `${who} đã mở lại cuộc hội thoại`,
            'text'
        );

        // Notify workspace + conversation room
        try {
            emitToConversation(conversationId, 'conversation:reopened', { conversationId });
            emitToWorkspace((conv.workspaceId as any).toString(), 'conversation:reopened', { conversationId });
        } catch { /* socket may not be initialized */ }

        return conv;
    },

    async setPendingConversation(conversationId: string, agentName?: string) {
        const conv = await conversationRepo.updateStatus(conversationId, 'pending');
        if (!conv) throw new AppError('Cuộc hội thoại không tồn tại', 404, 'NOT_FOUND');

        const who = agentName || 'Hệ thống';
        await this.addMessage(
            conversationId,
            { type: 'system', id: 'system', name: 'System' },
            `${who} đã chuyển cuộc hội thoại sang chờ xử lý`,
            'text'
        );

        try {
            emitToConversation(conversationId, 'conversation:statusChanged', { conversationId, status: 'pending' });
            emitToWorkspace((conv.workspaceId as any).toString(), 'conversation:statusChanged', { conversationId, status: 'pending' });
        } catch { /* socket may not be initialized */ }

        return conv;
    },

    // ── Priority / SLA ──

    async setPriority(conversationId: string, priority: string, slaDeadline?: Date, agentName?: string) {
        const conv = await conversationRepo.setPriority(conversationId, priority, slaDeadline);
        if (!conv) throw new AppError('Cuộc hội thoại không tồn tại', 404, 'NOT_FOUND');

        const priorityLabels: Record<string, string> = {
            urgent: '🔴 Khẩn cấp', high: '🟠 Cao', normal: '🟢 Bình thường', low: '⚪ Thấp'
        };
        const label = priorityLabels[priority] || priority;
        const who = agentName || 'Hệ thống';
        let msg = `${who} đã đặt mức ưu tiên: ${label}`;
        if (slaDeadline) {
            msg += ` — SLA: ${new Date(slaDeadline).toLocaleString('vi-VN')}`;
        }

        await this.addMessage(
            conversationId,
            { type: 'system', id: 'system', name: 'System' },
            msg,
            'text'
        );

        try {
            emitToWorkspace((conv.workspaceId as any).toString(), 'conversation:priorityChanged', {
                conversationId,
                priority,
                slaDeadline: slaDeadline || null,
            });
        } catch { /* socket may not be initialized */ }

        return conv;
    },

    /**
     * Check for conversations approaching SLA breach (within next 15 minutes).
     * Returns list of breaching conversations for notification.
     */
    async checkSLABreaching(withinMs = 15 * 60 * 1000) {
        const approaching = await conversationRepo.findBreachingSLA(withinMs);
        const breached = await conversationRepo.findBreachedSLA();

        // Emit warnings to respective workspaces
        for (const conv of approaching) {
            try {
                emitToWorkspace((conv.workspaceId as any).toString(), 'sla:warning', {
                    conversationId: conv._id,
                    slaDeadline: conv.slaDeadline,
                    priority: conv.priority,
                    type: 'approaching',
                });
            } catch { /* ignore */ }
        }
        for (const conv of breached) {
            try {
                emitToWorkspace((conv.workspaceId as any).toString(), 'sla:warning', {
                    conversationId: conv._id,
                    slaDeadline: conv.slaDeadline,
                    priority: conv.priority,
                    type: 'breached',
                });
            } catch { /* ignore */ }
        }

        return { approaching, breached };
    },

    /**
     * Requeue all conversations from a disconnected agent back to the queue.
     */
    async requeueByAgent(agentId: string, workspaceId?: string) {
        const count = await conversationRepo.requeueByAgent(agentId);
        if (count > 0 && workspaceId) {
            try {
                emitToWorkspace(workspaceId, 'conversation:requeued', {
                    agentId,
                    count,
                });
            } catch { /* ignore */ }
        }
        return count;
    },

    async updateTracking(conversationId: string, visitorId: string, tracking: Record<string, any>) {
        const conv = await conversationRepo.findById(conversationId);
        if (!conv) throw new AppError('Cuộc hội thoại không tồn tại', 404, 'NOT_FOUND');
        if (conv.visitorId !== visitorId) throw new AppError('Không có quyền', 403, 'FORBIDDEN');

        const merged = { ...(conv.metadata || {}), ...tracking };
        return conversationRepo.updateMetadata(conversationId, merged);
    },

    async getByWorkspace(
        workspaceId: string, 
        options?: { 
            status?: string; 
            assignee?: string;
            tags?: string | string[];
            channel?: string;
            dateFrom?: string;
            dateTo?: string;
            sortBy?: string;
            page?: number; 
            limit?: number 
        },
        requester?: { userId: string; type: 'visitor' | 'agent' }
    ) {
        const result = await conversationRepo.findByWorkspace(workspaceId, options);

        if (requester && result.items.length > 0) {
            const items = await Promise.all(
                result.items.map(async (conv) => {
                    const convObj = conv.toObject ? conv.toObject() : { ...conv };
                    const readCtx = conv.readContext?.find(
                        (ctx: any) => ctx.participantId === requester.userId && ctx.participantType === requester.type
                    );
                    const unreadCount = await messageRepo.countUnreadSince(
                        (conv._id as any).toString(),
                        requester.type,
                        readCtx ? readCtx.lastReadMessageId : null
                    );
                    return { ...convObj, unreadCount };
                })
            );

            // If we are sorting by unread, we should at least sort the current page by the dynamic count
            if (options?.sortBy === 'unread') {
                items.sort((a: any, b: any) => {
                    if (b.unreadCount !== a.unreadCount) return b.unreadCount - a.unreadCount;
                    return new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime();
                });
            }

            return { items, total: result.total };
        }

        return result;
    },

    async getOne(conversationId: string, requester?: { userId: string; type: 'visitor' | 'agent' }) {
        const conv = await conversationRepo.findById(conversationId);
        if (!conv) throw new AppError('Cuộc hội thoại không tồn tại', 404, 'NOT_FOUND');
        
        let convObj = conv.toObject ? conv.toObject() : { ...conv };
        
        if (requester) {
            const readCtx = conv.readContext?.find(
                (ctx: any) => ctx.participantId === requester.userId && ctx.participantType === requester.type
            );
            const unreadCount = await messageRepo.countUnreadSince(
                (conv._id as any).toString(),
                requester.type,
                readCtx ? readCtx.lastReadMessageId : null
            );
            convObj = { ...convObj, unreadCount };
        }
        
        return convObj;
    },

    async getTotalUnreadCount(workspaceId: string, requester: { userId: string; type: 'visitor' | 'agent' }) {
        // Find all open conversations for this workspace that this requester should see
        // For agents, we could filter by assignedTo if they are restrictive, but for now we look at all or their assigned ones.
        // Let's get all open conversations for the workspace since agents can view unassigned ones.
        
        const filter: any = { workspaceId, status: 'open' };
        
        const convs = await (conversationRepo as any).ConversationModel.find(filter).exec();
        
        let totalUnread = 0;
        
        await Promise.all(
            convs.map(async (conv: any) => {
                const readCtx = conv.readContext?.find(
                    (ctx: any) => ctx.participantId === requester.userId && ctx.participantType === requester.type
                );
                const count = await messageRepo.countUnreadSince(
                    conv._id.toString(),
                    requester.type,
                    readCtx ? readCtx.lastReadMessageId : null
                );
                totalUnread += count;
            })
        );
        
        return { totalUnread };
    },

    // ── Visitor profile methods ──

    async getVisitors(workspaceId: string, options?: { page?: number; limit?: number; search?: string }) {
        return visitorRepo.findByWorkspace(workspaceId, options);
    },

    async getVisitor(visitorId: string, widgetId: string) {
        const visitor = await visitorRepo.findOne(visitorId, widgetId);
        if (!visitor) throw new AppError('Visitor không tồn tại', 404, 'NOT_FOUND');
        return visitor;
    },

    async enrichVisitor(
        visitorId: string,
        widgetId: string,
        data: { name?: string; email?: string; phone?: string; attributes?: Record<string, any> }
    ) {
        const visitor = await visitorRepo.enrichProfile(visitorId, widgetId, data);
        if (!visitor) throw new AppError('Visitor không tồn tại', 404, 'NOT_FOUND');
        return visitor;
    },

    async getVisitorByWorkspace(workspaceId: string, visitorId: string) {
        const visitor = await visitorRepo.findOneByWorkspaceAndVisitorId(workspaceId, visitorId);
        if (!visitor) throw new AppError('Visitor không tồn tại', 404, 'NOT_FOUND');
        return visitor;
    },

    async updateVisitorByWorkspace(
        workspaceId: string,
        visitorId: string,
        data: { name?: string; email?: string; phone?: string; attributes?: Record<string, any> }
    ) {
        const visitor = await visitorRepo.updateByWorkspaceAndVisitorId(workspaceId, visitorId, data);
        if (!visitor) throw new AppError('Visitor không tồn tại', 404, 'NOT_FOUND');
        return visitor;
    },

    // ── Tags on conversation ──

    async addTagToConversation(conversationId: string, tag: string, agentName?: string) {
        const conv = await conversationRepo.addTag(conversationId, tag);
        if (!conv) throw new AppError('Cuộc hội thoại không tồn tại', 404, 'NOT_FOUND');

        const who = agentName || 'Hệ thống';
        await this.addMessage(
            conversationId,
            { type: 'system', id: 'system', name: 'System' },
            `${who} đã gắn tag: ${tag}`,
            'text'
        );

        try {
            emitToWorkspace((conv.workspaceId as any).toString(), 'conversation:tagsChanged', {
                conversationId,
                tags: conv.tags,
            });
        } catch { /* ignore */ }

        return conv;
    },

    async removeTagFromConversation(conversationId: string, tag: string, agentName?: string) {
        const conv = await conversationRepo.removeTag(conversationId, tag);
        if (!conv) throw new AppError('Cuộc hội thoại không tồn tại', 404, 'NOT_FOUND');

        const who = agentName || 'Hệ thống';
        await this.addMessage(
            conversationId,
            { type: 'system', id: 'system', name: 'System' },
            `${who} đã gỡ tag: ${tag}`,
            'text'
        );

        try {
            emitToWorkspace((conv.workspaceId as any).toString(), 'conversation:tagsChanged', {
                conversationId,
                tags: conv.tags,
            });
        } catch { /* ignore */ }

        return conv;
    },

    // ── Internal notes ──

    async addInternalNote(
        conversationId: string,
        sender: { id: string; name?: string },
        content: string
    ) {
        const conversation = await conversationRepo.findById(conversationId);
        if (!conversation) throw new AppError('Cuộc hội thoại không tồn tại', 404, 'NOT_FOUND');

        const note = await messageRepo.create({
            conversationId: conversation._id as any,
            sender: { type: 'agent', id: sender.id, name: sender.name },
            content,
            type: 'text',
            isInternal: true,
        });

        // Only emit to agent namespace (not visitor)
        try {
            emitToWorkspace((conversation.workspaceId as any).toString(), 'note:new', {
                conversationId,
                note,
            });
        } catch { /* ignore */ }

        return note;
    },
};
