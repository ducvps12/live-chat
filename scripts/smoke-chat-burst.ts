import assert from 'node:assert/strict';
import {
    normalizeBotPersonaConfig,
    splitHumanizedReply,
} from '../src/modules/chatbot/persona-config';

const natural = normalizeBotPersonaConfig({
    intelligenceLevel: 'advanced',
    replyGrouping: 'smart_burst',
    maxReplyParts: 3,
    interMessageDelayMs: 700,
});

assert.equal(natural.intelligenceLevel, 'advanced');
assert.equal(natural.maxReplyParts, 3);
assert.equal(natural.interMessageDelayMs, 700);

// Punctuation alone must not produce a machine-gun burst. The model needs to
// explicitly separate deliberate chat bubbles with a blank line.
assert.deepEqual(
    splitHumanizedReply('First sentence. Second sentence. Third sentence.', natural),
    ['First sentence. Second sentence. Third sentence.'],
);

const threeParts = splitHumanizedReply(
    'First deliberate thought.\n\nSecond deliberate thought.\n\nThird deliberate thought.',
    natural,
);
assert.deepEqual(threeParts, [
    'First deliberate thought.',
    'Second deliberate thought.',
    'Third deliberate thought.',
]);

const withUrl = splitHumanizedReply(
    'See https://nemarkchat.com/products/item-2 first.\n\nPrice is 299000.\n\nI will check stock.',
    natural,
);
assert.equal(withUrl.some(part => part.includes('https://nemarkchat.com/products/item-2')), true);
assert.equal(withUrl.join(' ').includes('299000'), true);

const capped = splitHumanizedReply(
    'One.\n\nTwo.\n\nThree.\n\nFour.',
    { ...natural, maxReplyParts: 2 },
);
assert.equal(capped.length, 2);
assert.equal(capped.join(' '), 'One. Two. Three. Four.');

const single = splitHumanizedReply(
    'First.\n\nSecond.',
    { ...natural, replyGrouping: 'single' },
);
assert.deepEqual(single, ['First.\n\nSecond.']);

console.log('CHAT_BURST_SMOKE_OK');
