import prisma from '../../../infra/prisma';
import type { Message } from '@prisma/client';
import { Prisma } from '@prisma/client';

export const messageRepo = {
    async create(data: {
        conversationId: string;
        clientMessageId?: string;
        senderType: string;
        senderId: string;
        senderName?: string;
        content: string;
        type?: string;
        status?: string;
        attachments?: any[];
        sanitizeFlags?: string[];
        isInternal?: boolean;
        replyToMessageId?: string;
        replyToContent?: string;
        replyToSenderName?: string;
    }): Promise<Message> {
        return prisma.message.create({
            data: {
                ...data,
                attachments: data.attachments || [],
                sanitizeFlags: data.sanitizeFlags || [],
            } as any,
        });
    },

    async findById(messageId: string): Promise<Message | null> {
        return prisma.message.findUnique({ where: { id: messageId } });
    },

    async findByClientMessageId(conversationId: string, clientMessageId: string): Promise<Message | null> {
        if (!clientMessageId) return null;
        return prisma.message.findFirst({ where: { conversationId, clientMessageId } });
    },

    async findByConversation(
        conversationId: string,
        options?: { page?: number; limit?: number; excludeInternal?: boolean }
    ): Promise<{ items: Message[]; total: number }> {
        const page = options?.page || 1;
        const limit = options?.limit || 50;
        const skip = (page - 1) * limit;

        const where: any = { conversationId };
        if (options?.excludeInternal) {
            where.isInternal = false;
        }

        const [items, total] = await Promise.all([
            prisma.message.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            prisma.message.count({ where }),
        ]);

        return { items: items.reverse(), total };
    },

    async getLatest(conversationId: string, limit: number = 30): Promise<Message[]> {
        const msgs = await prisma.message.findMany({
            where: { conversationId },
            orderBy: { createdAt: 'desc' },
            take: limit,
        });
        return msgs.reverse();
    },

    async getMessagePage(conversationId: string, messageId: string, limit: number = 50): Promise<number | null> {
        const targetMessage = await prisma.message.findFirst({
            where: { id: messageId, conversationId },
        });
        if (!targetMessage) return null;

        const count = await prisma.message.count({
            where: { conversationId, createdAt: { gte: targetMessage.createdAt } },
        });

        if (count === 0) return 1;
        return Math.floor((count - 1) / limit) + 1;
    },

    async findSince(conversationId: string, since: Date, limit: number = 50): Promise<Message[]> {
        return prisma.message.findMany({
            where: { conversationId, createdAt: { gt: since } },
            orderBy: { createdAt: 'asc' },
            take: limit,
        });
    },

    async markAsDelivered(messageIds: string[]): Promise<void> {
        await prisma.message.updateMany({
            where: { id: { in: messageIds }, status: 'sent' },
            data: { status: 'delivered' },
        });
    },

    async markAsReadUpTo(
        conversationId: string,
        messageId: string,
        senderTypeToMatch: 'visitor' | 'agent' | 'system'
    ): Promise<void> {
        const targetMessage = await prisma.message.findFirst({
            where: { id: messageId, conversationId },
        });
        if (!targetMessage) return;

        await prisma.message.updateMany({
            where: {
                conversationId,
                senderType: senderTypeToMatch,
                createdAt: { lte: targetMessage.createdAt },
                status: { not: 'read' },
            },
            data: { status: 'read' },
        });
    },

    async findLatest(conversationId: string): Promise<Message | null> {
        return prisma.message.findFirst({
            where: { conversationId },
            orderBy: { createdAt: 'desc' },
        });
    },

    async countUnreadSince(
        conversationId: string,
        participantType: 'visitor' | 'agent' | 'system',
        lastReadMessageId: string | null
    ): Promise<number> {
        const where: any = {
            conversationId,
            senderType: { not: participantType },
        };

        if (lastReadMessageId) {
            const lastReadMessage = await prisma.message.findFirst({
                where: { id: lastReadMessageId, conversationId },
            });
            if (lastReadMessage) {
                where.createdAt = { gt: lastReadMessage.createdAt };
            }
        }

        return prisma.message.count({ where });
    },

    async searchByContent(
        conversationIds: string[],
        query: string,
        limit: number = 50
    ): Promise<Array<{ conversationId: string; matchedSnippet: string; messageId: string }>> {
        if (!query || query.trim().length === 0 || conversationIds.length === 0) return [];

        const escapedQuery = `%${query}%`;

        const results = await prisma.$queryRaw<any[]>`
            SELECT
                conversationId,
                LEFT(content, 100) as matchedSnippet,
                id as messageId
            FROM Message
            WHERE conversationId IN (${Prisma.join(conversationIds)})
            AND content LIKE ${escapedQuery}
            AND (isDeleted = false OR isDeleted IS NULL)
            AND (isInternal = false OR isInternal IS NULL)
            ORDER BY createdAt DESC
            LIMIT ${limit}
        `;

        return results;
    },

    async countBySender(
        conversationId: string,
        senderType: 'visitor' | 'agent' | 'system'
    ): Promise<number> {
        return prisma.message.count({
            where: {
                conversationId,
                senderType,
                isDeleted: false,
            },
        });
    },
};
