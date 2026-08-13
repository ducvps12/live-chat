import type { KnowledgeEntry } from '@prisma/client';

const VIETNAMESE_WORD = /[^\p{L}\p{N}_-]+/gu;

export type KnowledgeConfidence = 'high' | 'medium' | 'low';

export type LexicalKnowledgeCandidate = {
    entry: KnowledgeEntry;
    score: number;
};

export type SemanticKnowledgeCandidate = {
    entry: KnowledgeEntry;
    score: number;
};

export type RankedKnowledgeResult = {
    entry: KnowledgeEntry;
    lexicalScore: number;
    semanticScore: number;
    combinedScore: number;
    confidence: KnowledgeConfidence;
    reasons: string[];
};

export function normalizeKnowledgeQuery(input: string, maxChars = 500, maxTokens = 12) {
    const query = String(input || '')
        .normalize('NFC')
        .toLocaleLowerCase('vi-VN')
        .replace(VIETNAMESE_WORD, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, Math.max(1, maxChars));
    const tokens = [...new Set(query.split(' ').filter(token => token.length > 1))]
        .slice(0, Math.max(1, maxTokens));
    return { query, tokens };
}

function confidenceFor(lexicalScore: number, semanticScore: number): KnowledgeConfidence {
    if (
        lexicalScore >= 8
        || (lexicalScore >= 5 && semanticScore >= 0.7)
        || semanticScore >= 0.88
    ) return 'high';
    if (lexicalScore >= 5 || semanticScore >= 0.78) return 'medium';
    return 'low';
}

function updatedAtMs(entry: KnowledgeEntry) {
    const value = entry.updatedAt instanceof Date ? entry.updatedAt : new Date(entry.updatedAt);
    const timestamp = value.getTime();
    return Number.isFinite(timestamp) ? timestamp : 0;
}

/**
 * Merge lexical and semantic candidates without ever trusting vector payload content.
 * The entry must already have been re-hydrated from MySQL for the requested workspace.
 */
export function rankHybridKnowledge(
    workspaceId: string,
    lexical: LexicalKnowledgeCandidate[],
    semantic: SemanticKnowledgeCandidate[],
    limit = 5,
): RankedKnowledgeResult[] {
    const merged = new Map<string, { entry: KnowledgeEntry; lexicalScore: number; semanticScore: number }>();

    for (const candidate of lexical) {
        if (candidate.entry.workspaceId !== workspaceId) continue;
        const existing = merged.get(candidate.entry.id);
        merged.set(candidate.entry.id, {
            entry: existing?.entry || candidate.entry,
            lexicalScore: Math.max(
                existing?.lexicalScore || 0,
                Math.max(0, Number(candidate.score) || 0),
            ),
            semanticScore: existing?.semanticScore || 0,
        });
    }
    for (const candidate of semantic) {
        if (candidate.entry.workspaceId !== workspaceId) continue;
        const existing = merged.get(candidate.entry.id);
        merged.set(candidate.entry.id, {
            entry: existing?.entry || candidate.entry,
            lexicalScore: existing?.lexicalScore || 0,
            semanticScore: Math.max(
                existing?.semanticScore || 0,
                Math.min(1, Math.max(0, Number(candidate.score) || 0)),
            ),
        });
    }

    return [...merged.values()]
        .map(({ entry, lexicalScore, semanticScore }) => {
            // Lexical evidence is deliberately stronger because it comes directly from MySQL text.
            const combinedScore = lexicalScore + semanticScore * 6;
            const confidence = confidenceFor(lexicalScore, semanticScore);
            const reasons: string[] = [];
            if (lexicalScore >= 8) reasons.push('strong_lexical');
            else if (lexicalScore > 0) reasons.push('weak_lexical');
            if (semanticScore >= 0.88) reasons.push('strong_semantic');
            else if (semanticScore > 0) reasons.push('weak_semantic');
            return { entry, lexicalScore, semanticScore, combinedScore, confidence, reasons };
        })
        .sort((left, right) => (
            right.combinedScore - left.combinedScore
            || updatedAtMs(right.entry) - updatedAtMs(left.entry)
            || left.entry.id.localeCompare(right.entry.id)
        ))
        .slice(0, Math.min(20, Math.max(1, limit)));
}
