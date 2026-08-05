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

const threeParts = splitHumanizedReply(
    'Dạ dùng được ạ. Mình chỉ cần vặn trực tiếp vào vòi có sẵn. Không cần khoan hay lắp đặt phức tạp đâu ạ.',
    natural,
);
assert.deepEqual(threeParts, [
    'Dạ dùng được ạ.',
    'Mình chỉ cần vặn trực tiếp vào vòi có sẵn.',
    'Không cần khoan hay lắp đặt phức tạp đâu ạ.',
]);

const withUrl = splitHumanizedReply(
    'Bạn xem mẫu tại https://nemarkchat.com/products/item-2. Giá hiện tại là 299.000đ. Mình kiểm tra tồn kho giúp bạn nhé.',
    natural,
);
assert.equal(withUrl.some(part => part.includes('https://nemarkchat.com/products/item-2')), true);
assert.equal(withUrl.join(' ').includes('299.000đ'), true);

const capped = splitHumanizedReply(
    'Ý thứ nhất. Ý thứ hai. Ý thứ ba. Ý thứ tư.',
    { ...natural, maxReplyParts: 2 },
);
assert.equal(capped.length, 2);
assert.equal(capped.join(' '), 'Ý thứ nhất. Ý thứ hai. Ý thứ ba. Ý thứ tư.');

const single = splitHumanizedReply(
    'Câu đầu. Câu sau.',
    { ...natural, replyGrouping: 'single' },
);
assert.deepEqual(single, ['Câu đầu. Câu sau.']);

console.log('CHAT_BURST_SMOKE_OK');
