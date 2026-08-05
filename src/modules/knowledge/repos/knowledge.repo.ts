import prisma from '../../../infra/prisma';
import type { KnowledgeEntry } from '@prisma/client';

type KnowledgeSearchOptions = {
    allowStopwordFallback?: boolean;
    minScore?: number;
};

const KNOWLEDGE_SEARCH_STOP_WORDS = new Set([
    'xin', 'chào', 'dạ', 'ạ', 'thì', 'mà', 'là', 'bị', 'cho', 'được', 'có', 'không',
    'và', 'hoặc', 'của', 'để', 'trong', 'ngoài', 'tại', 'với', 'như', 'những', 'các',
    'này', 'kia', 'đó', 'nào', 'ai', 'gì', 'sao', 'vậy', 'shop', 'admin',
    'tôi', 'mình', 'bạn', 'anh', 'chị', 'em', 'tớ', 'tui', 'tao',
    'cần', 'muốn', 'mua', 'đang', 'định', 'giúp', 'hỏi', 'xem', 'tìm', 'kiếm',
]);

export const knowledgeRepo = {
    async create(data: {
        workspaceId: string;
        product: string;
        question: string;
        answer: string;
        upsaleText?: string;
        keywords?: string[];
        source?: string;
        sheetRowIndex?: number;
    }) {
        return prisma.knowledgeEntry.create({ data: data as any });
    },

    async createMany(entries: Array<{
        workspaceId: string;
        product: string;
        question: string;
        answer: string;
        upsaleText?: string;
        keywords?: string[];
        source?: string;
        sheetRowIndex?: number;
    }>) {
        if (entries.length === 0) return 0;

        let count = 0;
        for (const entry of entries) {
            if (entry.source === 'google_sheets' && entry.sheetRowIndex !== undefined) {
                // Upsert by workspace + source + sheetRowIndex
                const existing = await prisma.knowledgeEntry.findFirst({
                    where: { workspaceId: entry.workspaceId, source: 'google_sheets', sheetRowIndex: entry.sheetRowIndex },
                });
                if (existing) {
                    await prisma.knowledgeEntry.update({ where: { id: existing.id }, data: entry as any });
                } else {
                    await prisma.knowledgeEntry.create({ data: entry as any });
                }
            } else {
                await prisma.knowledgeEntry.create({ data: entry as any });
            }
            count++;
        }
        return count;
    },

    async findByWorkspace(workspaceId: string, filters?: { product?: string; source?: string }) {
        const where: any = { workspaceId };
        if (filters?.product) where.product = filters.product;
        if (filters?.source) where.source = filters.source;
        return prisma.knowledgeEntry.findMany({
            where,
            orderBy: [{ product: 'asc' }, { createdAt: 'desc' }],
        });
    },

    async search(workspaceId: string, queryText: string, limit = 5, options: KnowledgeSearchOptions = {}) {
        const queryLower = queryText.toLowerCase().trim();
        const words = [...new Set(queryLower
            .split(/\s+/)
            .map(w => w.trim())
            .filter(w => w.length > 1 && !KNOWLEDGE_SEARCH_STOP_WORDS.has(w)))];

        if (words.length === 0) {
            if (options.allowStopwordFallback === false) return [];

            const fallbackWords = queryLower.split(/\s+/).filter(w => w.length > 1);
            if (fallbackWords.length === 0) return [];
            words.push(...fallbackWords);
        }

        // Build OR conditions: each word matches any of question/answer/product
        const orConditions = words.flatMap(w => [
            { question: { contains: w } },
            { answer: { contains: w } },
            { product: { contains: w } },
        ]);

        const candidates = await prisma.knowledgeEntry.findMany({
            where: { workspaceId, OR: orConditions },
        });

        // Score candidates based on relevance
        const scored = candidates.map(entry => {
            let score = 0;
            const q = (entry.question || '').toLowerCase();
            const a = (entry.answer || '').toLowerCase();
            const p = (entry.product || '').toLowerCase();

            // Exact phrase match bonus
            if (q.includes(queryLower)) score += 30;
            if (p.includes(queryLower)) score += 20;
            if (a.includes(queryLower)) score += 10;

            // Word matching
            words.forEach(w => {
                if (p.includes(w)) score += 5;
                if (q.includes(w)) score += 3;
                if (a.includes(w)) score += 1;
            });

            return { entry, score };
        });

        // Sort by score desc
        scored.sort((a, b) => b.score - a.score);

        const minScore = Math.max(0, options.minScore ?? 0);
        return scored
            .filter(({ score }) => score >= minScore)
            .slice(0, limit)
            .map(({ entry }) => entry);
    },

    async findById(id: string) {
        return prisma.knowledgeEntry.findUnique({ where: { id } });
    },

    async update(id: string, data: Partial<Omit<KnowledgeEntry, 'id' | 'createdAt' | 'updatedAt'>>) {
        return prisma.knowledgeEntry.update({ where: { id }, data: data as any });
    },

    async remove(id: string) {
        return prisma.knowledgeEntry.delete({ where: { id } });
    },

    async removeByWorkspaceAndSource(workspaceId: string, source: string) {
        return prisma.knowledgeEntry.deleteMany({ where: { workspaceId, source } });
    },

    async getProducts(workspaceId: string) {
        const results = await prisma.knowledgeEntry.findMany({
            where: { workspaceId },
            select: { product: true },
            distinct: ['product'],
        });
        return results.map(r => r.product);
    },

    async count(workspaceId: string) {
        return prisma.knowledgeEntry.count({ where: { workspaceId } });
    },
};
