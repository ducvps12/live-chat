import assert from 'node:assert/strict';
import {
    AUTO_REPLY_DELIVERY_DELAY_MAX_MS,
    buildAutoReplyTypingPayload,
    normalizeAutoReplyDeliveryDelayMs,
    waitForAutoReplyDelivery,
} from '../src/modules/conversation/auto-reply-typing';

assert.equal(normalizeAutoReplyDeliveryDelayMs(undefined), 0);
assert.equal(normalizeAutoReplyDeliveryDelayMs(-100), 0);
assert.equal(normalizeAutoReplyDeliveryDelayMs(1_234.6), 1_235);
assert.equal(
    normalizeAutoReplyDeliveryDelayMs(AUTO_REPLY_DELIVERY_DELAY_MAX_MS + 5_000),
    AUTO_REPLY_DELIVERY_DELAY_MAX_MS,
);

const actor = {
    senderId: 'bot-1',
    senderName: 'Mai hỗ trợ',
    label: 'Đang kiểm tra giúp bạn…',
};
const startPayload = buildAutoReplyTypingPayload(
    'conversation-1',
    'message-1',
    'start',
    actor,
);
const stopPayload = buildAutoReplyTypingPayload(
    'conversation-1',
    'message-1',
    'stop',
    actor,
);

assert.equal(startPayload.conversationId, 'conversation-1');
assert.equal(startPayload.typingId, 'auto-reply:message-1');
assert.equal(startPayload.sender.type, 'agent');
assert.equal(startPayload.sender.id, 'bot-1');
assert.equal(startPayload.sender.name, 'Mai hỗ trợ');
assert.equal(startPayload.label, 'Đang kiểm tra giúp bạn…');
assert.equal(startPayload.state, 'start');
assert.equal(stopPayload.typingId, startPayload.typingId);
assert.equal(stopPayload.state, 'stop');

const unsafeLabelPayload = buildAutoReplyTypingPayload(
    'conversation-2',
    'message-2',
    'start',
    { label: '  Đang\nphản hồi\u0000…  ' },
);
assert.equal(unsafeLabelPayload.label, 'Đang phản hồi …');

async function run() {
    const completedSlices: number[] = [];
    const completed = await waitForAutoReplyDelivery(
        160,
        () => true,
        async ms => { completedSlices.push(ms); },
    );
    assert.equal(completed, true);
    assert.deepEqual(completedSlices, [75, 75, 10]);

    let current = true;
    const cancelledSlices: number[] = [];
    const completedAfterCancel = await waitForAutoReplyDelivery(
        2_000,
        () => current,
        async ms => {
            cancelledSlices.push(ms);
            current = false;
        },
    );
    assert.equal(completedAfterCancel, false);
    assert.deepEqual(cancelledSlices, [75]);

    console.log('auto-reply typing smoke checks passed');
}

void run();
