import assert from 'node:assert/strict';
import {
    attemptExternalAutoReplyDelivery,
    autoReplyPartClientMessageId,
    createDurableAutoReplyPlan,
    isExternalAutoReplyChannel,
    readDurableAutoReplyPlan,
    withDurableAutoReplyPlan,
} from '../src/modules/conversation/auto-reply-delivery';
import { evaluateAutoReplyPolicy } from '../src/modules/chatbot/auto-reply.helpers';

const plan = createDurableAutoReplyPlan({
    targetMessageId: 'visitor-1',
    botId: 'bot-1',
    botName: 'Support',
    agentCondition: 'always',
    source: 'ai',
    handoffRequested: true,
    parts: ['First answer.', 'Second answer.'],
    interMessageDelayMs: 600,
});
assert.equal(plan.nextPartIndex, 0);
assert.equal(autoReplyPartClientMessageId('visitor-1', 0), 'ai-auto-reply:visitor-1');
assert.equal(autoReplyPartClientMessageId('visitor-1', 1), 'ai-auto-reply:visitor-1:2');
assert.equal(isExternalAutoReplyChannel('facebook'), true);
assert.equal(isExternalAutoReplyChannel('zalo'), true);
assert.equal(isExternalAutoReplyChannel('website'), false);

const durable = withDurableAutoReplyPlan({ humanTakeover: false }, plan);
assert.deepEqual(readDurableAutoReplyPlan(durable), plan);
assert.equal(readDurableAutoReplyPlan({ autoReplyDelivery: { version: 1 } }), null);
assert.equal(Object.hasOwn(withDurableAutoReplyPlan(durable, null), 'autoReplyDelivery'), false);

// Handoff state is durable metadata, not worker memory. A later retry/new
// inbound event therefore remains blocked even after a process restart.
const handoffMetadata = withDurableAutoReplyPlan({
    humanTakeover: true,
    aiPaused: true,
    autoReplyEnabled: false,
    aiMode: 'manual',
}, null);
assert.equal(evaluateAutoReplyPolicy({ agentCondition: 'always', metadata: handoffMetadata }).allowed, false);

async function run() {
    const statuses: string[] = [];
    let sendAttempts = 0;
    const first = await attemptExternalAutoReplyDelivery({
        channel: 'zalo',
        messageStatus: 'sent',
        isCurrent: async () => true,
        send: async () => {
            sendAttempts += 1;
            throw new Error('temporary upstream failure');
        },
        markStatus: async status => { statuses.push(status); },
    });
    assert.equal(first, 'retry');
    assert.deepEqual(statuses, ['error']);

    // Retry reuses the persisted row/content: no model call is involved and a
    // successful provider acknowledgement transitions the same row to delivered.
    const second = await attemptExternalAutoReplyDelivery({
        channel: 'zalo',
        messageStatus: 'error',
        isCurrent: async () => true,
        send: async () => { sendAttempts += 1; },
        markStatus: async status => { statuses.push(status); },
    });
    assert.equal(second, 'delivered');
    assert.equal(sendAttempts, 2);
    assert.deepEqual(statuses, ['error', 'delivered']);

    const stale = await attemptExternalAutoReplyDelivery({
        channel: 'facebook',
        messageStatus: 'error',
        isCurrent: async () => false,
        send: async () => { throw new Error('must not send stale reply'); },
        markStatus: async () => { throw new Error('must not mutate stale reply'); },
    });
    assert.equal(stale, 'stale');

    const alreadyDelivered = await attemptExternalAutoReplyDelivery({
        channel: 'facebook',
        messageStatus: 'delivered',
        isCurrent: async () => { throw new Error('already delivered should not recheck/send'); },
        send: async () => { throw new Error('already delivered should not send'); },
        markStatus: async () => { throw new Error('already delivered should not mutate'); },
    });
    assert.equal(alreadyDelivered, 'already_delivered');
}

run()
    .then(() => console.log('AUTO_REPLY_DELIVERY_SMOKE_OK'))
    .catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
