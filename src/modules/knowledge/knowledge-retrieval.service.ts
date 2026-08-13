import { rankHybridKnowledge, type KnowledgeConfidence } from './knowledge-ranking';
import { knowledgeRepo } from './repos/knowledge.repo';
import { knowledgeSemanticSearch, type KnowledgeSemanticHit } from './knowledge-vector.client';

type KnowledgeRepository = Pick<typeof knowledgeRepo, 'searchScored' | 'findByIdsForWorkspace'>;

export type KnowledgeRetrievalResult = {
    results: ReturnType<typeof rankHybridKnowledge>;
    topConfidence: KnowledgeConfidence | 'none';
    mode: 'lexical' | 'hybrid' | 'none';
};

type RetrievalDependencies = {
    repo?: KnowledgeRepository;
    semanticSearch?: (workspaceId: string, query: string, limit?: number) => Promise<KnowledgeSemanticHit[]>;
};

export function createKnowledgeRetrievalService(dependencies: RetrievalDependencies = {}) {
    const repo = dependencies.repo || knowledgeRepo;
    const semanticSearch = dependencies.semanticSearch || knowledgeSemanticSearch;

    return {
        async retrieve(input: { workspaceId: string; query: string; limit?: number }): Promise<KnowledgeRetrievalResult> {
            const workspaceId = String(input.workspaceId || '').trim();
            const query = String(input.query || '').trim().slice(0, 500);
            const limit = Math.min(20, Math.max(1, Math.trunc(Number(input.limit) || 5)));
            if (!workspaceId || query.length < 2) {
                return { results: [], topConfidence: 'none', mode: 'none' };
            }

            const lexical = await repo.searchScored(workspaceId, query, Math.min(20, limit * 4), {
                allowStopwordFallback: false,
                minScore: 1,
            });

            let semanticHits: KnowledgeSemanticHit[] = [];
            try {
                semanticHits = await semanticSearch(workspaceId, query, Math.min(100, limit * 8));
            } catch (error) {
                // Semantic infrastructure is an optional accelerator. Retrieval must
                // remain available and tenant-safe when it times out or is disabled.
                console.warn('[KnowledgeRetrieval] Semantic search unavailable; using lexical fallback:', error);
            }

            const acceptedHits = semanticHits
                .filter(hit => hit.workspaceId === workspaceId && hit.entryId)
                .slice(0, 100);
            const authoritativeEntries = await repo.findByIdsForWorkspace(
                workspaceId,
                acceptedHits.map(hit => hit.entryId),
            );
            const authoritativeById = new Map(authoritativeEntries.map(entry => [entry.id, entry]));
            const semantic = acceptedHits.flatMap(hit => {
                const entry = authoritativeById.get(hit.entryId);
                return entry ? [{ entry, score: hit.score }] : [];
            });

            const results = rankHybridKnowledge(workspaceId, lexical, semantic, limit);
            return {
                results,
                topConfidence: results[0]?.confidence || 'none',
                mode: results.length === 0 ? 'none' : semantic.length > 0 ? 'hybrid' : 'lexical',
            };
        },
    };
}

export const knowledgeRetrievalService = createKnowledgeRetrievalService();
