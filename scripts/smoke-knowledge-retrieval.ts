import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
    normalizeKnowledgeQuery,
    rankHybridKnowledge,
} from '../src/modules/knowledge/knowledge-ranking';
import { createKnowledgeRetrievalService } from '../src/modules/knowledge/knowledge-retrieval.service';
import { buildKnowledgeVectorSearchRequest } from '../src/modules/knowledge/knowledge-vector.client';

type KnowledgeEntryFixture = {
    id: string;
    workspaceId: string;
    product: string;
    question: string;
    answer: string;
    upsaleText: string | null;
    keywords: string[];
    source: string;
    sheetRowIndex: number | null;
    createdAt: Date;
    updatedAt: Date;
};

function entry(
    id: string,
    workspaceId = 'workspace-a',
    updatedAt = '2026-08-13T00:00:00.000Z',
): KnowledgeEntryFixture {
    return {
        id,
        workspaceId,
        product: `Product ${id}`,
        question: `Question ${id}`,
        answer: `Answer ${id}`,
        upsaleText: null,
        keywords: [],
        source: 'manual',
        sheetRowIndex: null,
        createdAt: new Date(updatedAt),
        updatedAt: new Date(updatedAt),
    };
}

function fakeRepo(
    lexical: Array<{ entry: KnowledgeEntryFixture; score: number }>,
    authoritative: KnowledgeEntryFixture[] = [],
    capture?: {
        lexical?: Array<{ workspaceId: string; query: string; limit: number; options: unknown }>;
        hydrate?: Array<{ workspaceId: string; ids: string[] }>;
    },
) {
    return {
        async searchScored(workspaceId: string, query: string, limit: number, options: unknown) {
            capture?.lexical?.push({ workspaceId, query, limit, options });
            return lexical;
        },
        async findByIdsForWorkspace(workspaceId: string, ids: string[]) {
            capture?.hydrate?.push({ workspaceId, ids: [...ids] });
            const allowed = new Set(ids);
            return authoritative.filter(item => item.workspaceId === workspaceId && allowed.has(item.id));
        },
    };
}

async function withoutExpectedSemanticWarning<T>(run: () => Promise<T>) {
    const originalWarn = console.warn;
    console.warn = (...args: unknown[]) => {
        if (!String(args[0] || '').includes('[KnowledgeRetrieval]')) originalWarn(...args);
    };
    try {
        return await run();
    } finally {
        console.warn = originalWarn;
    }
}

async function main() {

// Query normalization is deterministic and bounded before it reaches either backend.
const manyTokens = Array.from({ length: 40 }, (_, index) => `token${index}`).join(' ');
const normalized = normalizeKnowledgeQuery(`${manyTokens} ${'x'.repeat(600)}`);
assert.equal(normalized.query.length, 500, 'normalized query must be capped at 500 characters');
assert.equal(normalized.tokens.length, 12, 'normalized query must expose at most 12 unique tokens');
assert.deepEqual(
    normalizeKnowledgeQuery('  VẬT-LÝ, vật-lý!  ').tokens,
    normalizeKnowledgeQuery('vật-lý').tokens,
    'normalization must be stable for casing, punctuation, and duplicate tokens',
);

// Vector search must contain an exact tenant predicate and bounded candidate count.
const vectorRequest = buildKnowledgeVectorSearchRequest('workspace-a', [0.1, 0.2], 1_000);
assert.deepEqual(vectorRequest.filter, {
    must: [{ key: 'workspaceId', match: { value: 'workspace-a' } }],
});
assert.equal(vectorRequest.limit, 100);

// Semantic payload is untrusted: cross-tenant and stale IDs cannot become answers.
const lexicalEntry = entry('lexical');
const semanticEntry = entry('semantic');
const foreignEntry = entry('foreign', 'workspace-b');
const isolationCapture = { lexical: [] as any[], hydrate: [] as any[] };
const isolationService = createKnowledgeRetrievalService({
    repo: fakeRepo(
        [
            { entry: lexicalEntry, score: 9 },
            { entry: foreignEntry, score: 100 },
        ],
        [semanticEntry, foreignEntry],
        isolationCapture,
    ) as any,
    semanticSearch: async () => [
        { entryId: foreignEntry.id, workspaceId: 'workspace-b', score: 0.99 },
        { entryId: 'stale-id', workspaceId: 'workspace-a', score: 0.98 },
        { entryId: semanticEntry.id, workspaceId: 'workspace-a', score: 0.9 },
    ],
});
const isolated = await isolationService.retrieve({
    workspaceId: 'workspace-a',
    query: 'product support',
    limit: 5,
});
assert.deepEqual(
    isolationCapture.hydrate,
    [{ workspaceId: 'workspace-a', ids: ['stale-id', semanticEntry.id] }],
    'foreign tenant IDs must be discarded before authoritative hydration',
);
assert.deepEqual(
    new Set(isolated.results.map(result => result.entry.id)),
    new Set([lexicalEntry.id, semanticEntry.id]),
    'only authoritative rows belonging to the requested workspace may be ranked',
);
assert.equal(isolated.mode, 'hybrid');
assert.ok(isolated.results.every(result => result.entry.workspaceId === 'workspace-a'));

// A disabled, throwing, or timed-out vector dependency is fail-open to lexical retrieval.
for (const semanticError of [
    new Error('vector unavailable'),
    Object.assign(new Error('vector timeout'), { name: 'AbortError' }),
]) {
    const fallbackService = createKnowledgeRetrievalService({
        repo: fakeRepo([{ entry: lexicalEntry, score: 9 }]) as any,
        semanticSearch: async () => { throw semanticError; },
    });
    const fallback = await withoutExpectedSemanticWarning(() => fallbackService.retrieve({
        workspaceId: 'workspace-a',
        query: 'product support',
    }));
    assert.equal(fallback.mode, 'lexical');
    assert.equal(fallback.results[0]?.entry.id, lexicalEntry.id);
}

// One incidental lexical token is evidence, not permission for a direct confident answer.
const weakService = createKnowledgeRetrievalService({
    repo: fakeRepo([{ entry: entry('weak'), score: 1 }]) as any,
    semanticSearch: async () => [],
});
const weak = await weakService.retrieve({
    workspaceId: 'workspace-a',
    query: 'support',
});
assert.equal(weak.topConfidence, 'low');
assert.notEqual(weak.topConfidence, 'high');

// Hybrid merge is deterministic, deduplicates IDs, and clamps result count.
const sameTimestamp = '2026-08-13T00:00:00.000Z';
const tieA = entry('a', 'workspace-a', sameTimestamp);
const tieB = entry('b', 'workspace-a', sameTimestamp);
const duplicate = entry('duplicate', 'workspace-a', '2026-08-13T00:00:01.000Z');
const lexicalCandidates = [
    { entry: tieB as any, score: 3 },
    { entry: duplicate as any, score: 2 },
    { entry: duplicate as any, score: 4 },
    { entry: tieA as any, score: 3 },
];
const semanticCandidates = [
    { entry: duplicate as any, score: 0.3 },
    { entry: duplicate as any, score: 0.5 },
    { entry: tieB as any, score: 0 },
    { entry: tieA as any, score: 0 },
];
const firstRanking = rankHybridKnowledge('workspace-a', lexicalCandidates, semanticCandidates, 100);
const secondRanking = rankHybridKnowledge(
    'workspace-a',
    [...lexicalCandidates].reverse(),
    [...semanticCandidates].reverse(),
    100,
);
assert.deepEqual(
    firstRanking.map(result => result.entry.id),
    secondRanking.map(result => result.entry.id),
    'ranking must not depend on backend candidate order',
);
assert.equal(firstRanking.filter(result => result.entry.id === duplicate.id).length, 1);
assert.deepEqual(firstRanking.map(result => result.entry.id), ['duplicate', 'a', 'b']);
assert.ok(firstRanking.length <= 20);

// Retrieval clamps query, lexical limit, vector candidates, hydration candidates, and final limit.
const clampCapture = { lexical: [] as any[], hydrate: [] as any[] };
const manySemanticHits = Array.from({ length: 150 }, (_, index) => ({
    entryId: `semantic-${index}`,
    workspaceId: 'workspace-a',
    score: 0.9,
}));
const clampService = createKnowledgeRetrievalService({
    repo: fakeRepo([], [], clampCapture) as any,
    semanticSearch: async (_workspaceId, _query, limit) => {
        assert.equal(limit, 100, 'vector candidate request must be capped at 100');
        return manySemanticHits;
    },
});
await clampService.retrieve({
    workspaceId: 'workspace-a',
    query: 'q'.repeat(700),
    limit: 999,
});
assert.equal(clampCapture.lexical[0]?.query.length, 500);
assert.equal(clampCapture.lexical[0]?.limit, 20);
assert.equal(clampCapture.hydrate[0]?.ids.length, 100);
assert.deepEqual(clampCapture.hydrate[0]?.ids, manySemanticHits.slice(0, 100).map(hit => hit.entryId));

const minimumClampCapture = { lexical: [] as any[], hydrate: [] as any[] };
const minimumClampService = createKnowledgeRetrievalService({
    repo: fakeRepo([], [], minimumClampCapture) as any,
    semanticSearch: async () => [],
});
await minimumClampService.retrieve({ workspaceId: 'workspace-a', query: 'ok', limit: -10 });
assert.equal(minimumClampCapture.lexical[0]?.limit, 4, 'limit=1 requests four lexical candidates');

// Static guardrails cover implementation details that cannot be exercised without a DB/browser.
const repoRoot = process.cwd();
const repoSource = readFileSync(`${repoRoot}/src/modules/knowledge/repos/knowledge.repo.ts`, 'utf8');
assert.match(repoSource, /const MAX_SEARCH_LIMIT = 20;/);
assert.match(repoSource, /const MAX_SEARCH_CANDIDATES = 100;/);
assert.match(repoSource, /const MAX_SEARCH_TOKENS = 12;/);
assert.match(repoSource, /where:\s*\{\s*workspaceId,\s*OR:\s*orConditions\s*\}/s);
assert.match(repoSource, /take:\s*MAX_SEARCH_CANDIDATES/);
assert.match(repoSource, /where:\s*\{\s*workspaceId,\s*id:\s*\{\s*in:\s*safeIds\s*\}\s*\}/s);

const chatbotSource = readFileSync(`${repoRoot}/src/modules/chatbot/chatbot.service.ts`, 'utf8');
const retrievalCalls = chatbotSource.match(/knowledgeService\.retrieveForAutoReply\s*\(/g) || [];
assert.equal(
    retrievalCalls.length,
    1,
    'chatbot must retrieve knowledge once and reuse the same snapshot for context and fallback',
);
assert.match(
    chatbotSource,
    /topConfidence\s*===\s*['"]high['"]/,
    'direct knowledge fallback must require high confidence',
);

const knowledgeSource = readFileSync(`${repoRoot}/src/modules/knowledge/knowledge.service.ts`, 'utf8');
const sourceIdentityMatch = knowledgeSource.match(
    /export function buildSheetSourceIdentity[\s\S]*?^\}/m,
);
assert.ok(sourceIdentityMatch, 'sheet imports must expose a deterministic source identity helper');
const buildSheetSourceIdentity = new Function(
    `${sourceIdentityMatch![0]
        .replace('export function', 'function')
        .replace('(sheetUrl: string, gid?: string): string', '(sheetUrl, gid)')}; return buildSheetSourceIdentity;`,
)() as (sheetUrl: string, gid?: string) => string;
assert.notEqual(
    buildSheetSourceIdentity('https://docs.google.com/spreadsheets/d/sheet-a/edit#gid=0'),
    buildSheetSourceIdentity('https://docs.google.com/spreadsheets/d/sheet-b/edit#gid=0'),
    'different sheets must not share a replacement source identity',
);
assert.notEqual(
    buildSheetSourceIdentity('https://docs.google.com/spreadsheets/d/sheet-a/edit#gid=0'),
    buildSheetSourceIdentity('https://docs.google.com/spreadsheets/d/sheet-a/edit#gid=123'),
    'different tabs of the same sheet must not share a replacement source identity',
);

console.log('Knowledge/RAG regression smoke tests passed.');
console.log('Verified: tenant isolation, vector filter, fail-open fallback, confidence gate, deterministic merge, clamps, sheet identity, and single retrieval.');
}

void main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
