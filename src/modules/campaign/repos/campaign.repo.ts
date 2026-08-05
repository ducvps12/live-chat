import prisma from '../../../infra/prisma';
import type { Campaign } from '@prisma/client';

export type CampaignStatus = 'draft' | 'scheduled' | 'running' | 'paused' | 'completed' | 'failed';

class CampaignRepo {
    async create(data: {
        workspaceId: string;
        name: string;
        channel?: string;
        status?: string;
        messages?: string[];
        subject?: string;
        emailHtml?: string | null;
        emailText?: string | null;
        emailAccountId?: string | null;
        audience?: any;
        schedule?: any;
        antiSpam?: any;
        recipientIds?: string[];
        createdById?: string;
    }): Promise<Campaign> {
        return prisma.campaign.create({ data: data as any });
    }

    async findByWorkspace(workspaceId: string, options?: {
        status?: CampaignStatus;
        page?: number;
        limit?: number;
    }): Promise<{ items: Campaign[]; total: number }> {
        const where: any = { workspaceId };
        if (options?.status) where.status = options.status;

        const page = options?.page || 1;
        const limit = options?.limit || 20;
        const skip = (page - 1) * limit;

        const [items, total] = await Promise.all([
            prisma.campaign.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
            prisma.campaign.count({ where }),
        ]);

        return { items, total };
    }

    async findById(id: string): Promise<Campaign | null> {
        return prisma.campaign.findUnique({ where: { id } });
    }

    async update(id: string, data: Partial<Omit<Campaign, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Campaign | null> {
        return prisma.campaign.update({ where: { id }, data: data as any });
    }

    async updateStats(id: string, stats: Record<string, number>, currentIndex?: number): Promise<void> {
        const campaign = await prisma.campaign.findUnique({ where: { id }, select: { stats: true } });
        const currentStats = (campaign?.stats as any) || {};
        Object.assign(currentStats, stats);
        const data: any = { stats: currentStats };
        if (currentIndex !== undefined) data.currentIndex = currentIndex;
        await prisma.campaign.update({ where: { id }, data });
    }

    async pushFailedRecipient(id: string, threadId: string, error: string): Promise<void> {
        const campaign = await prisma.campaign.findUnique({
            where: { id },
            select: { failedRecipients: true, stats: true },
        });
        const recipients = (campaign?.failedRecipients as any[]) || [];
        recipients.push({ threadId, error, timestamp: new Date() });
        const stats = (campaign?.stats as any) || {};
        stats.failed = (stats.failed || 0) + 1;
        await prisma.campaign.update({
            where: { id },
            data: { failedRecipients: recipients, stats },
        });
    }

    async setStatus(id: string, status: CampaignStatus): Promise<void> {
        const data: any = { status };
        if (status === 'completed') data.completedAt = new Date();
        await prisma.campaign.update({ where: { id }, data });
    }

    async claimForStart(
        id: string,
        workspaceId: string,
        expectedStatus: 'draft' | 'scheduled' | 'paused',
    ): Promise<boolean> {
        const result = await prisma.campaign.updateMany({
            where: { id, workspaceId, status: expectedStatus },
            data: { status: 'running' },
        });
        return result.count === 1;
    }

    async releaseStartClaim(
        id: string,
        workspaceId: string,
        previousStatus: 'draft' | 'scheduled' | 'paused',
    ): Promise<void> {
        await prisma.campaign.updateMany({
            where: { id, workspaceId, status: 'running' },
            data: { status: previousStatus },
        });
    }

    async claimForSchedule(id: string, workspaceId: string): Promise<boolean> {
        const result = await prisma.campaign.updateMany({
            where: { id, workspaceId, status: 'draft' },
            data: { status: 'scheduled' },
        });
        return result.count === 1;
    }

    async failScheduled(id: string, workspaceId: string): Promise<boolean> {
        const result = await prisma.campaign.updateMany({
            where: { id, workspaceId, status: 'scheduled' },
            data: { status: 'failed' },
        });
        return result.count === 1;
    }

    async setRecipientIds(id: string, recipientIds: string[], total: number): Promise<void> {
        const campaign = await prisma.campaign.findUnique({ where: { id }, select: { stats: true } });
        const stats = (campaign?.stats as any) || {};
        stats.total = total;
        stats.pending = total;
        await prisma.campaign.update({
            where: { id },
            data: { recipientIds, stats },
        });
    }

    async prepareEmailRecipients(
        campaignId: string,
        workspaceId: string,
        recipients: Array<{
            leadId: string | null;
            recipient: string;
            normalizedRecipient: string;
            displayName: string;
            status: 'pending' | 'suppressed';
            idempotencyKey: string;
            unsubscribeToken: string;
        }>,
    ): Promise<void> {
        const suppressed = recipients.filter(recipient => recipient.status === 'suppressed').length;
        const pending = recipients.length - suppressed;

        await prisma.$transaction(async tx => {
            await tx.campaignRecipient.deleteMany({ where: { campaignId, workspaceId } });
            if (recipients.length > 0) {
                await tx.campaignRecipient.createMany({
                    data: recipients.map(recipient => ({
                        ...recipient,
                        campaignId,
                        workspaceId,
                        channel: 'email',
                    })),
                });
            }
            await tx.campaign.update({
                where: { id: campaignId },
                data: {
                    recipientIds: recipients.map(recipient => recipient.normalizedRecipient),
                    currentIndex: 0,
                    stats: {
                        total: recipients.length,
                        sent: 0,
                        failed: 0,
                        pending,
                        suppressed,
                        unsubscribed: 0,
                        retried: 0,
                    },
                },
            });
        });
    }

    async prepareMessageRecipients(
        campaignId: string,
        workspaceId: string,
        channel: 'telegram',
        recipients: Array<{
            recipient: string;
            normalizedRecipient: string;
            displayName: string;
            idempotencyKey: string;
        }>,
    ): Promise<void> {
        await prisma.$transaction(async tx => {
            await tx.campaignRecipient.deleteMany({ where: { campaignId, workspaceId } });
            if (recipients.length > 0) {
                await tx.campaignRecipient.createMany({
                    data: recipients.map(recipient => ({
                        ...recipient,
                        campaignId,
                        workspaceId,
                        channel,
                        status: 'pending',
                        maxAttempts: 3,
                    })),
                });
            }
            await tx.campaign.update({
                where: { id: campaignId },
                data: {
                    recipientIds: recipients.map(recipient => recipient.normalizedRecipient),
                    currentIndex: 0,
                    stats: {
                        total: recipients.length,
                        sent: 0,
                        failed: 0,
                        pending: recipients.length,
                        retried: 0,
                    },
                },
            });
        });
    }

    async listRecipients(campaignId: string, limit = 100) {
        return prisma.campaignRecipient.findMany({
            where: { campaignId },
            orderBy: { createdAt: 'asc' },
            take: Math.min(Math.max(limit, 1), 250),
            select: {
                id: true,
                recipient: true,
                displayName: true,
                status: true,
                attemptCount: true,
                providerMessageId: true,
                lastError: true,
                sentAt: true,
                createdAt: true,
            },
        });
    }

    async findRecipientByToken(unsubscribeToken: string) {
        return prisma.campaignRecipient.findUnique({
            where: { unsubscribeToken },
            include: { campaign: { select: { id: true, name: true } } },
        });
    }

    async claimEmailRecipient(id: string) {
        return prisma.$transaction(async tx => {
            const result = await tx.campaignRecipient.updateMany({
                where: { id, status: 'pending' },
                data: {
                    status: 'sending',
                    attemptCount: { increment: 1 },
                    lastError: null,
                    nextAttemptAt: null,
                },
            });
            if (result.count !== 1) return null;
            return tx.campaignRecipient.findUnique({ where: { id } });
        });
    }

    async claimMessageRecipient(campaignId: string, normalizedRecipient: string) {
        return prisma.$transaction(async tx => {
            const current = await tx.campaignRecipient.findUnique({
                where: { campaignId_normalizedRecipient: { campaignId, normalizedRecipient } },
            });
            if (!current || current.status !== 'pending') return null;
            const result = await tx.campaignRecipient.updateMany({
                where: { id: current.id, status: 'pending' },
                data: {
                    status: 'sending',
                    attemptCount: { increment: 1 },
                    lastError: null,
                    nextAttemptAt: null,
                },
            });
            if (result.count !== 1) return null;
            return tx.campaignRecipient.findUnique({ where: { id: current.id } });
        });
    }

    async incrementRecipientAttempt(id: string): Promise<void> {
        await prisma.campaignRecipient.update({
            where: { id },
            data: { attemptCount: { increment: 1 } },
        });
    }

    async releaseRecipientClaim(id: string, error?: string): Promise<void> {
        await prisma.campaignRecipient.updateMany({
            where: { id, status: 'sending' },
            data: {
                status: 'pending',
                lastError: error ? error.slice(0, 2000) : null,
            },
        });
    }

    async markRecipientSent(id: string, providerMessageId: string): Promise<void> {
        await prisma.campaignRecipient.update({
            where: { id },
            data: {
                status: 'sent',
                providerMessageId,
                sentAt: new Date(),
                lastError: null,
                nextAttemptAt: null,
            },
        });
    }

    async markRecipientStepProgress(id: string, stepIndex: number, providerMessageId: string): Promise<void> {
        await prisma.campaignRecipient.update({
            where: { id },
            data: {
                providerMessageId: `${stepIndex}:${providerMessageId}`,
                lastError: null,
            },
        });
    }

    async markRecipientFailed(id: string, error: string): Promise<void> {
        await prisma.campaignRecipient.update({
            where: { id },
            data: {
                status: 'failed',
                lastError: error.slice(0, 2000),
                nextAttemptAt: null,
            },
        });
    }

    async syncEmailStats(campaignId: string, currentIndex?: number): Promise<Record<string, number>> {
        const [statusGroups, attempts, attemptedRecipients, campaign] = await Promise.all([
            prisma.campaignRecipient.groupBy({
                by: ['status'],
                where: { campaignId },
                _count: { _all: true },
            }),
            prisma.campaignRecipient.aggregate({
                where: { campaignId },
                _sum: { attemptCount: true },
            }),
            prisma.campaignRecipient.count({ where: { campaignId, attemptCount: { gt: 0 } } }),
            prisma.campaign.findUnique({ where: { id: campaignId }, select: { stats: true } }),
        ]);

        const counts = Object.fromEntries(statusGroups.map(group => [group.status, group._count._all]));
        const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
        const stats = {
            ...((campaign?.stats as Record<string, number> | null) || {}),
            total,
            sent: counts.sent || 0,
            failed: counts.failed || 0,
            pending: (counts.pending || 0) + (counts.sending || 0),
            suppressed: counts.suppressed || 0,
            unsubscribed: counts.unsubscribed || 0,
            retried: Math.max(0, (attempts._sum.attemptCount || 0) - attemptedRecipients),
        };
        const data: any = { stats };
        if (currentIndex !== undefined) data.currentIndex = currentIndex;
        await prisma.campaign.update({ where: { id: campaignId }, data });
        return stats;
    }

    async syncMessageStats(campaignId: string, currentIndex?: number): Promise<Record<string, number>> {
        const [statusGroups, attempts, attemptedRecipients, campaign] = await Promise.all([
            prisma.campaignRecipient.groupBy({
                by: ['status'],
                where: { campaignId },
                _count: { _all: true },
            }),
            prisma.campaignRecipient.aggregate({
                where: { campaignId },
                _sum: { attemptCount: true },
            }),
            prisma.campaignRecipient.count({ where: { campaignId, attemptCount: { gt: 0 } } }),
            prisma.campaign.findUnique({ where: { id: campaignId }, select: { stats: true } }),
        ]);
        const counts = Object.fromEntries(statusGroups.map(group => [group.status, group._count._all]));
        const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
        const stats = {
            ...((campaign?.stats as Record<string, number> | null) || {}),
            total,
            sent: counts.sent || 0,
            failed: counts.failed || 0,
            pending: (counts.pending || 0) + (counts.sending || 0),
            retried: Math.max(0, (attempts._sum.attemptCount || 0) - attemptedRecipients),
        };
        const data: any = { stats };
        if (currentIndex !== undefined) data.currentIndex = currentIndex;
        await prisma.campaign.update({ where: { id: campaignId }, data });
        return stats;
    }

    async delete(id: string): Promise<void> {
        await prisma.campaign.delete({ where: { id } });
    }

    async getWorkspaceStats(workspaceId: string): Promise<{
        totalCampaigns: number;
        activeCampaigns: number;
        totalSent: number;
        totalFailed: number;
    }> {
        const [totalCampaigns, activeCampaigns, allCampaigns] = await Promise.all([
            prisma.campaign.count({ where: { workspaceId } }),
            prisma.campaign.count({ where: { workspaceId, status: { in: ['running', 'scheduled'] } } }),
            prisma.campaign.findMany({ where: { workspaceId }, select: { stats: true } }),
        ]);

        let totalSent = 0, totalFailed = 0;
        for (const c of allCampaigns) {
            const s = c.stats as any;
            totalSent += s?.sent || 0;
            totalFailed += s?.failed || 0;
        }

        return { totalCampaigns, activeCampaigns, totalSent, totalFailed };
    }
}

export const campaignRepo = new CampaignRepo();
