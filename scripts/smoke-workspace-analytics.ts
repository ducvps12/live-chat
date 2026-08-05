import assert from 'node:assert/strict';
import {
    calculateFirstResponses,
    createAnalyticsBuckets,
    normalizeAnalyticsPeriod,
    resolveAnalyticsRange,
} from '../src/modules/workspace/workspace.analytics';

const now = new Date('2026-07-18T05:30:00.000Z'); // 12:30 in Asia/Ho_Chi_Minh
const range = resolveAnalyticsRange('7d', 'Asia/Ho_Chi_Minh', now);

assert.equal(range.start.toISOString(), '2026-07-11T17:00:00.000Z');
assert.equal(range.end.toISOString(), now.toISOString());
assert.equal(range.granularity, 'day');
assert.equal(createAnalyticsBuckets(range.start, range.end, 'Asia/Ho_Chi_Minh', 'day').length, 7);
const todayRange = resolveAnalyticsRange('today', 'Asia/Ho_Chi_Minh', now);
assert.equal(createAnalyticsBuckets(todayRange.start, todayRange.end, 'Asia/Ho_Chi_Minh', 'hour').length, 13);
const monthRange = resolveAnalyticsRange('30d', 'Asia/Ho_Chi_Minh', now);
assert.equal(createAnalyticsBuckets(monthRange.start, monthRange.end, 'Asia/Ho_Chi_Minh', 'day').length, 30);
assert.equal(normalizeAnalyticsPeriod('today'), 'today');
const quarterRange = resolveAnalyticsRange('90d', 'Asia/Ho_Chi_Minh', now);
assert.equal(createAnalyticsBuckets(quarterRange.start, quarterRange.end, 'Asia/Ho_Chi_Minh', 'day').length, 90);
assert.equal(normalizeAnalyticsPeriod('90d'), '90d');
assert.throws(() => normalizeAnalyticsPeriod('365d'));

const base = new Date('2026-07-18T00:00:00.000Z').getTime();
const responses = calculateFirstResponses([
    { conversationId: 'c1', senderType: 'visitor', createdAt: new Date(base) },
    { conversationId: 'c1', senderType: 'agent', senderId: 'agent-1', createdAt: new Date(base + 45_000) },
    { conversationId: 'c1', senderType: 'agent', createdAt: new Date(base + 90_000) },
    { conversationId: 'c2', senderType: 'agent', createdAt: new Date(base) },
    { conversationId: 'c2', senderType: 'visitor', createdAt: new Date(base + 60_000) },
    { conversationId: 'c2', senderType: 'agent', createdAt: new Date(base + 420_000) },
    { conversationId: 'c3', senderType: 'visitor', createdAt: new Date(base) },
], new Set(['c1', 'c2', 'c3']));

assert.deepEqual(responses, [
    { conversationId: 'c1', seconds: 45, agentId: 'agent-1' },
    { conversationId: 'c2', seconds: 360 },
]);

console.log('workspace analytics smoke: ok');
