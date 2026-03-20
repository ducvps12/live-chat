import { ConversationModel, IConversation } from './conversation.model';

export const conversationRepo = {
    async create(data: Partial<IConversation>): Promise<IConversation> {
        return ConversationModel.create(data);
    },

    async findById(id: string): Promise<IConversation | null> {
        return ConversationModel.findById(id).populate('assignedTo', 'name email').exec();
    },

    async findActiveByVisitor(visitorId: string, widgetId: string): Promise<IConversation | null> {
        return ConversationModel.findOne({
            visitorId,
            widgetId,
            status: 'open',
        })
            .sort({ lastMessageAt: -1 })
            .exec();
    },

    async getDistinctDomains(workspaceId: string): Promise<string[]> {
        return ConversationModel.distinct('metadata.domain', { workspaceId, 'metadata.domain': { $exists: true, $ne: null } }).exec() as Promise<string[]>;
    },

    async findByWorkspace(
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
            limit?: number;
            domain?: string | string[];
        }
    ): Promise<{ items: IConversation[]; total: number }> {
        const filter: any = { workspaceId };
        
        if (options?.status && options.status !== 'all') filter.status = options.status;
        
        if (options?.assignee) {
            if (options.assignee === 'unassigned') filter.assignedTo = { $exists: false };
            else filter.assignedTo = options.assignee;
        }
        
        if (options?.channel && options.channel !== 'all') filter.channel = options.channel;
        
        if (options?.tags) {
            const tagsArray = Array.isArray(options.tags) ? options.tags : [options.tags];
            if (tagsArray.length > 0) {
                filter.tags = { $in: tagsArray }; // match any of the provided tags
            }
        }
        
        if (options?.dateFrom || options?.dateTo) {
            filter.createdAt = {};
            if (options?.dateFrom) filter.createdAt.$gte = new Date(options.dateFrom);
            if (options?.dateTo) filter.createdAt.$lte = new Date(options.dateTo);
        }

        if (options?.domain) {
            const domainArray = Array.isArray(options.domain) ? options.domain : [options.domain];
            if (domainArray.length > 0) {
                filter['metadata.domain'] = { $in: domainArray };
            }
        }

        const page = options?.page || 1;
        const limit = options?.limit || 20;
        const skip = (page - 1) * limit;

        let sortCriteria: any = { lastMessageAt: -1 };
        if (options?.sortBy === 'oldest') {
            sortCriteria = { lastMessageAt: 1 };
        } else if (options?.sortBy === 'unread') {
            sortCriteria = { unreadCount: -1, lastMessageAt: -1 };
        }

        const [items, total] = await Promise.all([
            ConversationModel.find(filter)
                .populate('assignedTo', 'name email')
                .sort(sortCriteria)
                .skip(skip)
                .limit(limit)
                .exec(),
            ConversationModel.countDocuments(filter).exec(),
        ]);
        return { items, total };
    },

    async updateStatus(id: string, status: string): Promise<IConversation | null> {
        return ConversationModel.findByIdAndUpdate(id, { status }, { new: true }).exec();
    },

    /**
     * Update conversation summary when a new message arrives.
     * Atomically sets lastMessageAt, snippet, lastSender, and increments unreadCount.
     */
    async updateLastMessage(
        id: string,
        summary: {
            snippet: string;
            sender: { type: 'visitor' | 'agent' | 'system'; name?: string };
            incrementUnread?: boolean;
        }
    ): Promise<void> {
        const update: any = {
            $set: {
                lastMessageAt: new Date(),
                lastMessageSnippet: summary.snippet,
                lastSender: { type: summary.sender.type, name: summary.sender.name },
            },
        };
        // Increment unread only for visitor/system messages (agent's own don't count)
        if (summary.incrementUnread) {
            update.$inc = { unreadCount: 1 };
        }
        await ConversationModel.findByIdAndUpdate(id, update).exec();
    },

    /**
     * Reset unread count (agent opened/read the conversation).
     */
    async markRead(id: string): Promise<void> {
        await ConversationModel.findByIdAndUpdate(id, { unreadCount: 0 }).exec();
    },

    /**
     * Update the read cursor for a specific participant in the conversation.
     */
    async updateReadCursor(
        conversationId: string,
        participantId: string,
        participantType: 'visitor' | 'agent',
        lastReadMessageId: string
    ): Promise<void> {
        // Remove old entry for this participant if exists
        await ConversationModel.updateOne(
            { _id: conversationId },
            { $pull: { readContext: { participantId } as any } }
        ).exec();
        
        // Push the new read cursor
        await ConversationModel.updateOne(
            { _id: conversationId },
            { 
                $push: { 
                    readContext: { participantId, participantType, lastReadMessageId } 
                } 
            }
        ).exec();
    },

    async updateMetadata(id: string, metadata: Record<string, any>): Promise<IConversation | null> {
        return ConversationModel.findByIdAndUpdate(id, { metadata }, { new: true }).exec();
    },

    async countByWorkspace(workspaceId: string, status?: string): Promise<number> {
        const filter: any = { workspaceId };
        if (status) filter.status = status;
        return ConversationModel.countDocuments(filter).exec();
    },

    /**
     * Assign conversation to an agent.
     * @param expectUnassigned If true, only assigns if conversation is currently unassigned (atomic CAS).
     *   Returns null if someone else already took it (collision).
     */
    async assignTo(id: string, agentId: string, expectUnassigned = false): Promise<IConversation | null> {
        if (expectUnassigned) {
            // Atomic: only assign if assignedTo is null/undefined (prevents race condition)
            return ConversationModel.findOneAndUpdate(
                { _id: id, $or: [{ assignedTo: null }, { assignedTo: { $exists: false } }] },
                { assignedTo: agentId },
                { new: true }
            ).exec();
        }
        // Admin/transfer override: always assign regardless of current state
        return ConversationModel.findByIdAndUpdate(id, { assignedTo: agentId }, { new: true }).exec();
    },

    async unassign(id: string): Promise<IConversation | null> {
        return ConversationModel.findByIdAndUpdate(id, { $unset: { assignedTo: 1 } }, { new: true }).exec();
    },

    async setPriority(id: string, priority: string, slaDeadline?: Date): Promise<IConversation | null> {
        const update: any = { priority };
        if (slaDeadline) update.slaDeadline = slaDeadline;
        else update.$unset = { slaDeadline: 1 };
        return ConversationModel.findByIdAndUpdate(id, update, { new: true }).exec();
    },

    /**
     * Find conversations with SLA deadline approaching (within `withinMs` milliseconds).
     */
    async findBreachingSLA(withinMs: number): Promise<IConversation[]> {
        const now = new Date();
        const threshold = new Date(now.getTime() + withinMs);
        return ConversationModel.find({
            slaDeadline: { $lte: threshold, $gt: now },
            status: { $in: ['open', 'pending'] },
        }).populate('assignedTo', 'name email').exec();
    },

    /**
     * Find conversations already past SLA deadline.
     */
    async findBreachedSLA(): Promise<IConversation[]> {
        return ConversationModel.find({
            slaDeadline: { $lte: new Date() },
            status: { $in: ['open', 'pending'] },
        }).populate('assignedTo', 'name email').exec();
    },

    /**
     * Requeue all open/pending conversations assigned to a specific agent.
     * Used when agent disconnects unexpectedly.
     */
    async requeueByAgent(agentId: string): Promise<number> {
        const result = await ConversationModel.updateMany(
            { assignedTo: agentId, status: { $in: ['open', 'pending'] } },
            { $unset: { assignedTo: 1 } }
        ).exec();
        return result.modifiedCount;
    },

    // ── Tags ──

    async addTag(id: string, tag: string): Promise<IConversation | null> {
        return ConversationModel.findByIdAndUpdate(
            id,
            { $addToSet: { tags: tag } },
            { new: true }
        ).exec();
    },

    async removeTag(id: string, tag: string): Promise<IConversation | null> {
        return ConversationModel.findByIdAndUpdate(
            id,
            { $pull: { tags: tag } },
            { new: true }
        ).exec();
    },
};
