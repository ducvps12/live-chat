export type KnowledgeSemanticHit = {
    entryId: string;
    workspaceId: string;
    score: number;
    contentHash?: string;
};

type VectorClientEnvironment = {
    KNOWLEDGE_VECTOR_ENABLED?: string;
    KNOWLEDGE_QDRANT_URL?: string;
    KNOWLEDGE_QDRANT_API_KEY?: string;
    KNOWLEDGE_QDRANT_COLLECTION?: string;
    KNOWLEDGE_EMBEDDING_BASE_URL?: string;
    KNOWLEDGE_EMBEDDING_API_KEY?: string;
    KNOWLEDGE_EMBEDDING_MODEL?: string;
    KNOWLEDGE_VECTOR_TIMEOUT_MS?: string;
};

const DEFAULT_TIMEOUT_MS = 4_000;

function trimTrailingSlash(value: string) {
    return value.replace(/\/+$/, '');
}

function boundedTimeout(value?: string) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return DEFAULT_TIMEOUT_MS;
    return Math.min(15_000, Math.max(500, Math.trunc(parsed)));
}

async function fetchJson(url: string, init: RequestInit, timeoutMs: number) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, { ...init, signal: controller.signal });
        if (!response.ok) throw new Error(`Knowledge vector request failed (${response.status})`);
        return await response.json() as any;
    } finally {
        clearTimeout(timeout);
    }
}

/**
 * Qdrant requests are always tenant-filtered. Vector payloads only identify rows;
 * answer text is deliberately re-hydrated from MySQL by the retrieval service.
 */
export function buildKnowledgeVectorSearchRequest(workspaceId: string, vector: number[], limit = 20) {
    return {
        vector,
        limit: Math.min(100, Math.max(1, Math.trunc(limit) || 20)),
        with_payload: true,
        filter: {
            must: [{ key: 'workspaceId', match: { value: workspaceId } }],
        },
    };
}

export function createKnowledgeSemanticSearch(
    environment: VectorClientEnvironment = process.env,
) {
    return async (workspaceId: string, query: string, limit = 20): Promise<KnowledgeSemanticHit[]> => {
        if (environment.KNOWLEDGE_VECTOR_ENABLED !== 'true') return [];

        const qdrantUrl = environment.KNOWLEDGE_QDRANT_URL;
        const collection = environment.KNOWLEDGE_QDRANT_COLLECTION;
        const embeddingBaseUrl = environment.KNOWLEDGE_EMBEDDING_BASE_URL;
        const embeddingApiKey = environment.KNOWLEDGE_EMBEDDING_API_KEY;
        const embeddingModel = environment.KNOWLEDGE_EMBEDDING_MODEL;
        if (!qdrantUrl || !collection || !embeddingBaseUrl || !embeddingApiKey || !embeddingModel) {
            throw new Error('Knowledge vector search is enabled but incomplete');
        }

        const timeoutMs = boundedTimeout(environment.KNOWLEDGE_VECTOR_TIMEOUT_MS);
        const embeddingResponse = await fetchJson(
            `${trimTrailingSlash(embeddingBaseUrl)}/embeddings`,
            {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    authorization: `Bearer ${embeddingApiKey}`,
                },
                body: JSON.stringify({ model: embeddingModel, input: query }),
            },
            timeoutMs,
        );
        const vector = embeddingResponse?.data?.[0]?.embedding;
        if (!Array.isArray(vector) || vector.length === 0) throw new Error('Embedding response is invalid');

        const qdrantHeaders: Record<string, string> = { 'content-type': 'application/json' };
        if (environment.KNOWLEDGE_QDRANT_API_KEY) {
            qdrantHeaders['api-key'] = environment.KNOWLEDGE_QDRANT_API_KEY;
        }
        const result = await fetchJson(
            `${trimTrailingSlash(qdrantUrl)}/collections/${encodeURIComponent(collection)}/points/search`,
            {
                method: 'POST',
                headers: qdrantHeaders,
                body: JSON.stringify(buildKnowledgeVectorSearchRequest(workspaceId, vector, limit)),
            },
            timeoutMs,
        );

        const points = Array.isArray(result?.result) ? result.result : [];
        return points.flatMap((point: any) => {
            const payload = point?.payload;
            if (!payload || payload.workspaceId !== workspaceId || typeof payload.entryId !== 'string') return [];
            return [{
                entryId: payload.entryId,
                workspaceId: payload.workspaceId,
                contentHash: typeof payload.contentHash === 'string' ? payload.contentHash : undefined,
                score: Math.min(1, Math.max(0, Number(point.score) || 0)),
            }];
        });
    };
}

export const knowledgeSemanticSearch = createKnowledgeSemanticSearch();
