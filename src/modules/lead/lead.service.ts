import prisma from '../../infra/prisma';
import type { Lead } from '@prisma/client';

export type LeadStage = 'mới' | 'tiềm_năng' | 'đang_tư_vấn' | 'chốt_đơn' | 'khách_hàng' | 'từ_chối';

interface ListLeadsQuery {
    workspaceId: string;
    stage?: LeadStage;
    source?: string;
    search?: string;
    tag?: string;
    assignedTo?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

export const leadService = {
    async list(query: ListLeadsQuery) {
        const { workspaceId, stage, source, search, tag, assignedTo, page = 1, limit = 50, sortBy = 'createdAt', sortOrder = 'desc' } = query;
        const where: any = { workspaceId };

        if (stage) where.stage = stage;
        if (source) where.source = source;
        if (assignedTo) where.assignedTo = assignedTo;
        if (search) {
            where.OR = [
                { name: { contains: search } },
                { phone: { contains: search } },
                { email: { contains: search } },
            ];
        }

        const [leads, total] = await Promise.all([
            prisma.lead.findMany({
                where,
                orderBy: { [sortBy]: sortOrder },
                skip: (page - 1) * limit,
                take: limit,
                include: { assignedUser: { select: { id: true, name: true, email: true, avatarUrl: true } } },
            }),
            prisma.lead.count({ where }),
        ]);

        return { leads, total, page, limit, totalPages: Math.ceil(total / limit) };
    },

    async getById(leadId: string) {
        return prisma.lead.findUnique({
            where: { id: leadId },
            include: { assignedUser: { select: { id: true, name: true, email: true, avatarUrl: true } } },
        });
    },

    async create(data: {
        workspaceId: string;
        name: string;
        phone?: string;
        email?: string;
        avatar?: string;
        stage?: string;
        source?: string;
        tags?: string[];
        assignedTo?: string;
        zaloUserId?: string;
        fbUserId?: string;
    }) {
        return prisma.lead.create({ data: data as any });
    },

    async update(leadId: string, data: Partial<Omit<Lead, 'id' | 'createdAt' | 'updatedAt'>>) {
        return prisma.lead.update({ where: { id: leadId }, data: data as any });
    },

    async updateStage(leadId: string, stage: LeadStage) {
        return prisma.lead.update({ where: { id: leadId }, data: { stage } });
    },

    async addNote(leadId: string, text: string, createdBy: string) {
        const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { notes: true } });
        const notes = (lead?.notes as any[]) || [];
        notes.push({ text, createdAt: new Date(), createdBy });
        return prisma.lead.update({ where: { id: leadId }, data: { notes } });
    },

    async delete(leadId: string) {
        return prisma.lead.delete({ where: { id: leadId } });
    },

    async getStats(workspaceId: string) {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const last7Days = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        const last30Days = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

        const [total, stageResults, sourceResults, scoreAgg, recentToday, recent7d, recent30d, hotLeads] = await Promise.all([
            prisma.lead.count({ where: { workspaceId } }),
            prisma.lead.groupBy({ by: ['stage'], where: { workspaceId }, _count: true }),
            prisma.lead.groupBy({ by: ['source'], where: { workspaceId }, _count: true }),
            prisma.lead.aggregate({ where: { workspaceId }, _avg: { score: true }, _max: { score: true }, _min: { score: true } }),
            prisma.lead.count({ where: { workspaceId, createdAt: { gte: today } } }),
            prisma.lead.count({ where: { workspaceId, createdAt: { gte: last7Days } } }),
            prisma.lead.count({ where: { workspaceId, createdAt: { gte: last30Days } } }),
            prisma.lead.count({ where: { workspaceId, score: { gte: 70 } } }),
        ]);

        // Score distribution buckets
        const [scoreLow, scoreMid, scoreHigh] = await Promise.all([
            prisma.lead.count({ where: { workspaceId, score: { lt: 40 } } }),
            prisma.lead.count({ where: { workspaceId, score: { gte: 40, lt: 70 } } }),
            prisma.lead.count({ where: { workspaceId, score: { gte: 70 } } }),
        ]);

        // Funnel: conversion rates between stages
        const byStage = Object.fromEntries(stageResults.map(s => [s.stage, s._count]));
        const funnelStages = ['mới', 'tiềm_năng', 'đang_tư_vấn', 'chốt_đơn', 'khách_hàng'];
        const funnel = funnelStages.map((stage, i) => {
            const count = byStage[stage] || 0;
            const prevCount = i > 0 ? (byStage[funnelStages[i - 1]] || 0) : total;
            return {
                stage,
                count,
                conversionRate: prevCount > 0 ? Math.round((count / prevCount) * 100) : 0,
            };
        });

        return {
            total,
            byStage,
            bySource: Object.fromEntries(sourceResults.map(s => [s.source, s._count])),
            funnel,
            scoring: {
                avg: Math.round(scoreAgg._avg?.score || 0),
                max: scoreAgg._max?.score || 0,
                min: scoreAgg._min?.score || 0,
                distribution: { low: scoreLow, mid: scoreMid, high: scoreHigh },
            },
            activity: {
                today: recentToday,
                last7Days: recent7d,
                last30Days: recent30d,
            },
            hotLeads,
        };
    },

    async convertFromContact(workspaceId: string, contactData: { name: string; phone?: string; avatar?: string; zaloUserId?: string; source?: string }) {
        if (contactData.zaloUserId) {
            const existing = await prisma.lead.findFirst({ where: { workspaceId, zaloUserId: contactData.zaloUserId } });
            if (existing) return existing;
        }

        return prisma.lead.create({
            data: {
                workspaceId,
                name: contactData.name,
                phone: contactData.phone || '',
                avatar: contactData.avatar || '',
                zaloUserId: contactData.zaloUserId || '',
                source: contactData.source || 'zalo',
                stage: 'mới',
            },
        });
    },

    async bulkConvertFromGroup(workspaceId: string, data: {
        groupId: string;
        groupName: string;
        members: Array<{ userId: string; displayName: string; avatar?: string }>;
    }) {
        const { groupId, groupName, members } = data;
        let created = 0, skipped = 0;
        const results: any[] = [];

        for (const member of members) {
            const existing = await prisma.lead.findFirst({ where: { workspaceId, zaloUserId: member.userId } });

            if (existing) {
                const groupTag = `group:${groupName}`;
                const tags = (existing.tags as string[]) || [];
                if (!tags.includes(groupTag)) {
                    tags.push(groupTag);
                    await prisma.lead.update({ where: { id: existing.id }, data: { tags } });
                }
                skipped++;
                results.push({ userId: member.userId, status: 'skipped', leadId: existing.id });
                continue;
            }

            const lead = await prisma.lead.create({
                data: {
                    workspaceId,
                    name: member.displayName || `Thành viên ${member.userId.slice(-6)}`,
                    avatar: member.avatar || '',
                    zaloUserId: member.userId,
                    source: 'zalo',
                    stage: 'mới',
                    tags: [`group:${groupName}`],
                },
            });
            created++;
            results.push({ userId: member.userId, status: 'created', leadId: lead.id });
        }

        return { total: members.length, created, skipped, groupId, groupName, results };
    },

    async bulkConvertFromGroupEnriched(workspaceId: string, data: {
        groupId: string;
        groupName: string;
        members: Array<{ userId: string; displayName: string; avatar?: string; phone?: string; email?: string }>;
    }) {
        const { groupId, groupName, members } = data;
        let created = 0, skipped = 0, updated = 0;
        const results: any[] = [];

        for (const member of members) {
            const existing = await prisma.lead.findFirst({ where: { workspaceId, zaloUserId: member.userId } });

            if (existing) {
                const updates: any = {};
                const groupTag = `group:${groupName}`;
                if (member.phone && !existing.phone) updates.phone = member.phone;
                if (member.email && !existing.email) updates.email = member.email;
                if (member.avatar && !existing.avatar) updates.avatar = member.avatar;

                const tags = (existing.tags as string[]) || [];
                const needsTag = !tags.includes(groupTag);
                const hasUpdates = Object.keys(updates).length > 0;

                if (hasUpdates || needsTag) {
                    if (needsTag) { tags.push(groupTag); updates.tags = tags; }
                    await prisma.lead.update({ where: { id: existing.id }, data: updates });
                    if (hasUpdates) updated++;
                }

                skipped++;
                results.push({ userId: member.userId, status: hasUpdates ? 'updated' : 'skipped', leadId: existing.id });
                continue;
            }

            const lead = await prisma.lead.create({
                data: {
                    workspaceId,
                    name: member.displayName || `Thành viên ${member.userId.slice(-6)}`,
                    phone: member.phone || '',
                    email: member.email || '',
                    avatar: member.avatar || '',
                    zaloUserId: member.userId,
                    source: 'zalo',
                    stage: 'mới',
                    tags: [`group:${groupName}`],
                },
            });
            created++;
            results.push({ userId: member.userId, status: 'created', leadId: lead.id });
        }

        return { total: members.length, created, skipped, updated, groupId, groupName, results };
    },

    /**
     * Find duplicate leads in workspace (same phone or email or zaloUserId)
     */
    async findDuplicates(workspaceId: string): Promise<{
        duplicateGroups: Array<{ key: string; field: string; leads: any[] }>;
        totalDuplicates: number;
    }> {
        const allLeads = await prisma.lead.findMany({
            where: { workspaceId },
            orderBy: { createdAt: 'asc' },
        });

        const groups = new Map<string, { field: string; leads: any[] }>();

        // Check phone duplicates
        const phoneCounts = new Map<string, any[]>();
        const emailCounts = new Map<string, any[]>();

        for (const lead of allLeads) {
            if (lead.phone && lead.phone.length >= 9) {
                const normalizedPhone = lead.phone.replace(/[\s.-]/g, '');
                if (!phoneCounts.has(normalizedPhone)) phoneCounts.set(normalizedPhone, []);
                phoneCounts.get(normalizedPhone)!.push(lead);
            }
            if (lead.email && lead.email.includes('@')) {
                const normalizedEmail = lead.email.toLowerCase().trim();
                if (!emailCounts.has(normalizedEmail)) emailCounts.set(normalizedEmail, []);
                emailCounts.get(normalizedEmail)!.push(lead);
            }
        }

        // Collect duplicates
        for (const [phone, leads] of phoneCounts) {
            if (leads.length > 1) {
                groups.set(`phone:${phone}`, { field: 'phone', leads });
            }
        }
        for (const [email, leads] of emailCounts) {
            if (leads.length > 1) {
                groups.set(`email:${email}`, { field: 'email', leads });
            }
        }

        const duplicateGroups = Array.from(groups.entries()).map(([key, val]) => ({
            key, field: val.field, leads: val.leads,
        }));

        return {
            duplicateGroups,
            totalDuplicates: duplicateGroups.reduce((sum, g) => sum + g.leads.length - 1, 0),
        };
    },

    /**
     * Merge two leads into one (keep primary, merge data from secondary)
     */
    async mergeLeads(primaryId: string, secondaryId: string): Promise<any> {
        const primary = await prisma.lead.findUnique({ where: { id: primaryId } });
        const secondary = await prisma.lead.findUnique({ where: { id: secondaryId } });
        if (!primary || !secondary) throw new Error('Lead không tồn tại');
        if (primary.workspaceId !== secondary.workspaceId) throw new Error('Leads không cùng workspace');

        // Merge: fill missing info from secondary into primary
        const updates: any = {};
        if (!primary.phone && secondary.phone) updates.phone = secondary.phone;
        if (!primary.email && secondary.email) updates.email = secondary.email;
        if (!primary.avatar && secondary.avatar) updates.avatar = secondary.avatar;
        if (!primary.zaloUserId && secondary.zaloUserId) updates.zaloUserId = secondary.zaloUserId;
        if (!primary.fbUserId && secondary.fbUserId) updates.fbUserId = secondary.fbUserId;
        if (primary.name.startsWith('Thành viên') && !secondary.name.startsWith('Thành viên')) {
            updates.name = secondary.name;
        }

        // Merge tags
        const primaryTags = (primary.tags as string[]) || [];
        const secondaryTags = (secondary.tags as string[]) || [];
        updates.tags = [...new Set([...primaryTags, ...secondaryTags])];

        // Merge notes
        const primaryNotes = (primary.notes as any[]) || [];
        const secondaryNotes = (secondary.notes as any[]) || [];
        updates.notes = [...primaryNotes, ...secondaryNotes].sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );

        // Take higher score
        if (secondary.score > primary.score) updates.score = secondary.score;

        // Sum conversationCount
        updates.conversationCount = primary.conversationCount + secondary.conversationCount;

        // Update primary, delete secondary
        const merged = await prisma.lead.update({ where: { id: primaryId }, data: updates });
        await prisma.lead.delete({ where: { id: secondaryId } });

        console.log(`[LeadService] Merged lead ${secondaryId} into ${primaryId}`);
        return merged;
    },

    /**
     * Dashboard overview: comprehensive workspace CRM metrics
     */
    async getDashboard(workspaceId: string) {
        const stats = await this.getStats(workspaceId);
        const duplicates = await this.findDuplicates(workspaceId);

        // Top leads by score
        const topLeads = await prisma.lead.findMany({
            where: { workspaceId, score: { gt: 0 } },
            orderBy: { score: 'desc' },
            take: 5,
            select: { id: true, name: true, score: true, stage: true, source: true, avatar: true, phone: true },
        });

        // Recent leads
        const recentLeads = await prisma.lead.findMany({
            where: { workspaceId },
            orderBy: { createdAt: 'desc' },
            take: 5,
            select: { id: true, name: true, stage: true, source: true, avatar: true, createdAt: true },
        });

        return {
            ...stats,
            topLeads,
            recentLeads,
            duplicateCount: duplicates.totalDuplicates,
        };
    },
};
