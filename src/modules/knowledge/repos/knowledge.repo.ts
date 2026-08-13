import prisma from '../../../infra/prisma';
import type { KnowledgeEntry } from '@prisma/client';
import { normalizeKnowledgeQuery } from '../knowledge-ranking';

export type KnowledgeSearchOptions = {
    allowStopwordFallback?: boolean;
    minScore?: number;
};

export type KnowledgeScoredResult = {
    entry: KnowledgeEntry;
    score: number;
};

const MAX_SEARCH_LIMIT = 20;
const MAX_SEARCH_CANDIDATES = 100;
const MAX_SEARCH_TOKENS = 12;

const KNOWLEDGE_SEARCH_STOP_WORDS = new Set([
    'xin', 'chào', 'dạ', 'ạ', 'thì', 'mà', 'là', 'bị', 'cho', 'được', 'có', 'không',
    'và', 'hoặc', 'của', 'để', 'trong', 'ngoài', 'tại', 'với', 'như', 'những', 'các',
    'này', 'kia', 'đó', 'nào', 'ai', 'gì', 'sao', 'vậy', 'shop', 'admin',
    'tôi', 'mình', 'bạn', 'anh', 'chị', 'em', 'tớ', 'tui', 'tao',
    'cần', 'muốn', 'mua', 'đang', 'định', 'giúp', 'hỏi', 'xem', 'tìm', 'kiếm',
]);

function keywordList(entry: KnowledgeEntry): string[] {
    if (!Array.isArray(entry.keywords)) return [];
    return entry.keywords
        .filter((value): value is string => typeof value === 'string')
        .map(value => value.normalize('NFC').toLocaleLowerCase('vi-VN'));
}

function entryTimestamp(entry: KnowledgeEntry) {
    const timestamp = entry.updatedAt instanceof Date
        ? entry.updatedAt.getTime()
        : new Date(entry.updatedAt).getTime();
    return Number.isFinite(timestamp) ? timestamp : 0;
}

async function searchScored(
    workspaceId: string,
    queryText: string,
    limit = 5,
    options: KnowledgeSearchOptions = {},
): Promise<KnowledgeScoredResult[]> {
    const safeLimit = Math.min(MAX_SEARCH_LIMIT, Math.max(1, Number.isFinite(limit) ? Math.trunc(limit) : 5));
    const normalized = normalizeKnowledgeQuery(queryText, 500, MAX_SEARCH_TOKENS);
    const queryLower = normalized.query;
    const meaningfulWords = normalized.tokens.filter(word => !KNOWLEDGE_SEARCH_STOP_WORDS.has(word));
    const words = meaningfulWords.length > 0
        ? meaningfulWords
        : options.allowStopwordFallback === false
            ? []
            : normalized.tokens;
    if (!queryLower || words.length === 0) return [];

    const orConditions = words.flatMap(word => [
        { question: { contains: word } },
        { answer: { contains: word } },
        { product: { contains: word } },
    ]);
    const candidates = await prisma.knowledgeEntry.findMany({
        where: { workspaceId, OR: orConditions },
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        take: MAX_SEARCH_CANDIDATES,
    });

    const scored = candidates.map(entry => {
        let score = 0;
        const question = (entry.question || '').normalize('NFC').toLocaleLowerCase('vi-VN');
        const answer = (entry.answer || '').normalize('NFC').toLocaleLowerCase('vi-VN');
        const product = (entry.product || '').normalize('NFC').toLocaleLowerCase('vi-VN');
        const keywords = keywordList(entry);

        if (question === queryLower) score += 40;
        else if (question.includes(queryLower)) score += 30;
        if (product === queryLower) score += 25;
        else if (product.includes(queryLower)) score += 20;
        if (answer.includes(queryLower)) score += 10;
        for (const word of words) {
            if (product.includes(word)) score += 5;
            if (question.includes(word)) score += 3;
            if (answer.includes(word)) score += 1;
            if (keywords.includes(word)) score += 2;
        }
        return { entry, score };
    });

    const minScore = Math.max(0, options.minScore ?? 0);
    return scored
        .filter(({ score }) => score >= minScore)
        .sort((left, right) => (
            right.score - left.score
            || entryTimestamp(right.entry) - entryTimestamp(left.entry)
            || left.entry.id.localeCompare(right.entry.id)
        ))
        .slice(0, safeLimit);
}

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

    async replaceSourceSnapshot(workspaceId: string, source: string, entries: Array<{
        workspaceId: string;
        product: string;
        question: string;
        answer: string;
        upsaleText?: string;
        keywords?: string[];
        source?: string;
        sheetRowIndex?: number;
    }>) {
        if (entries.some(entry => entry.workspaceId !== workspaceId || entry.source !== source)) {
            throw new Error('Knowledge snapshot contains an invalid workspace or source');
        }
        return prisma.$transaction(async transaction => {
            await transaction.knowledgeEntry.deleteMany({ where: { workspaceId, source } });
            if (entries.length === 0) return 0;
            const result = await transaction.knowledgeEntry.createMany({ data: entries as any[] });
            return result.count;
        });
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

    async searchScored(workspaceId: string, queryText: string, limit = 5, options: KnowledgeSearchOptions = {}) {
        return searchScored(workspaceId, queryText, limit, options);
    },

    async search(workspaceId: string, queryText: string, limit = 5, options: KnowledgeSearchOptions = {}) {
        const results = await searchScored(workspaceId, queryText, limit, options);
        return results.map(({ entry }) => entry);
    },

    async findByIdsForWorkspace(workspaceId: string, ids: string[]) {
        const safeIds = [...new Set(ids.filter(Boolean))].slice(0, MAX_SEARCH_CANDIDATES);
        if (safeIds.length === 0) return [];
        return prisma.knowledgeEntry.findMany({
            where: { workspaceId, id: { in: safeIds } },
        });
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
