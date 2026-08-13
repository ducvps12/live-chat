import assert from 'node:assert/strict';
import { summarizeInboxCandidates } from '../src/modules/conversation/inbox-summary';
import { buildWorkspaceConversationWhere } from '../src/modules/conversation/repos/conversation.repo';
import {
    appendAutoReplyTrace,
    getAutoReplyConnectorContract,
} from '../src/modules/conversation/auto-reply-delivery';
import {
    NotificationOutboxDispatcher,
    type NotificationOutboxRecord,
    type NotificationOutboxStore,
} from '../src/modules/notification/notification-outbox';

const filteredWhere = buildWorkspaceConversationWhere('workspace-1', {
    status: 'open',
    channel: 'facebook',
    pageId: 'page-1',
    domain: ['shop.example'],
    tags: ['vip'],
    page: 9,
    limit: 50,
});
assert.equal(filteredWhere.workspaceId, 'workspace-1');
assert.equal(filteredWhere.status, 'open');
assert.equal(filteredWhere.channel, 'facebook');
assert.ok(Array.isArray(filteredWhere.AND));
assert.equal((filteredWhere.AND as unknown[]).length, 3);
assert.equal(Object.hasOwn(filteredWhere, 'page'), false);
assert.equal(Object.hasOwn(filteredWhere, 'limit'), false);

const summary = summarizeInboxCandidates([
    { id: 'a', status: 'open' },
    { id: 'b', status: 'pending' },
    { id: 'c', status: 'open' },
], new Map([['a', 2], ['b', 0], ['c', 3]]));
assert.deepEqual(summary, { total: 3, unread: 5, open: 2 });

assert.deepEqual(getAutoReplyConnectorContract('zalo'), {
    channel: 'zalo',
    requiresExternalDelivery: true,
    idempotencyKey: 'clientMessageId',
    deliveredStatuses: ['delivered', 'read'],
});
assert.equal(getAutoReplyConnectorContract('website').requiresExternalDelivery, false);

let metadata: Record<string, unknown> = {};
for (let index = 0; index < 25; index += 1) {
    metadata = appendAutoReplyTrace(metadata, {
        traceId: `trace-${index}`,
        targetMessageId: `message-${index}`,
        source: 'ai',
        channel: 'zalo',
        outcome: 'delivered',
        partCount: 2,
        generationDurationMs: 10,
        completedAt: new Date(index).toISOString(),
    });
}
const traces = metadata.autoReplyTraceHistory as Array<{ traceId: string }>;
assert.equal(traces.length, 20);
assert.equal(traces[0].traceId, 'trace-5');
assert.equal(traces[19].traceId, 'trace-24');

class MemoryOutboxStore implements NotificationOutboxStore {
    readonly records = new Map<string, NotificationOutboxRecord>();
    async get(id: string) { return this.records.get(id) || null; }
    async create(record: NotificationOutboxRecord) {
        const existing = this.records.get(record.id);
        if (existing) return existing;
        this.records.set(record.id, record);
        return record;
    }
    async save(record: NotificationOutboxRecord) { this.records.set(record.id, record); }
    async listDue(now: Date, limit: number) {
        return [...this.records.values()]
            .filter(record => record.status === 'pending' && new Date(record.nextAttemptAt) <= now)
            .slice(0, limit);
    }
}

async function run() {
    let currentTime = new Date('2026-08-11T00:00:00.000Z');
    let attempts = 0;
    const store = new MemoryOutboxStore();
    const dispatcher = new NotificationOutboxDispatcher(store, {
        async send() {
            attempts += 1;
            if (attempts === 1) throw new Error('provider unavailable');
            return { sent: true };
        },
    }, () => currentTime);

    const input = {
        event: 'payment_received',
        dedupKey: 'invoice-1',
        text: 'Payment received',
        dedupWindowMs: 60_000,
    };
    const first = await dispatcher.enqueue(input);
    const duplicate = await dispatcher.enqueue(input);
    assert.equal(first.id, duplicate.id);
    assert.equal(store.records.size, 1);

    const failed = await dispatcher.dispatch(first);
    assert.equal(failed.status, 'pending');
    assert.equal(failed.attempts, 1);
    assert.ok(new Date(failed.nextAttemptAt) > currentTime);

    currentTime = new Date(failed.nextAttemptAt);
    const flushed = await dispatcher.flushDue();
    assert.deepEqual(flushed, { sent: 1, pending: 0 });
    assert.equal(store.records.get(first.id)?.status, 'sent');
    assert.equal(attempts, 2);

    await dispatcher.flushDue();
    assert.equal(attempts, 2, 'sent records must never be delivered twice');
}

run()
    .then(() => console.log('PLATFORM_FOUNDATION_SMOKE_OK'))
    .catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
