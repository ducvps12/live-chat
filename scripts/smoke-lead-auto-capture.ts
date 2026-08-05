import assert from 'node:assert/strict';
import {
    extractContactFromMessage,
    normalizeLeadEmail,
    normalizeLeadPhone,
    normalizeWidgetVisitorInfo,
} from '../src/modules/lead/lead-auto-capture.service';

assert.equal(normalizeLeadEmail('  Customer@Example.COM  '), 'customer@example.com');
assert.equal(normalizeLeadEmail('not-an-email'), '');
assert.equal(normalizeLeadPhone('+84 912 345 678'), '0912345678');
assert.equal(normalizeLeadPhone('0912.345.678'), '0912345678');
assert.equal(normalizeLeadPhone('123'), '');
assert.deepEqual(
    extractContactFromMessage('Liên hệ mình qua Customer@Example.COM hoặc +84 (912) 345-678 nhé'),
    { email: 'customer@example.com', phone: '0912345678' },
);

const explicitConsent = normalizeWidgetVisitorInfo({
    name: '  Nguyễn Văn A  ',
    email: 'A@EXAMPLE.COM',
    phone: '0912.345.678',
    marketingConsent: true,
    consentText: 'Đồng ý nhận thông tin ưu đãi',
});
assert.deepEqual(explicitConsent, {
    name: 'Nguyễn Văn A',
    email: 'a@example.com',
    phone: '0912345678',
    avatar: '',
    marketingConsent: true,
    consentText: 'Đồng ý nhận thông tin ưu đãi',
});

assert.equal(
    normalizeWidgetVisitorInfo({ email: 'a@example.com', marketingConsent: 'true' }).marketingConsent,
    false,
    'A truthy string must not become marketing consent',
);
assert.equal(
    normalizeWidgetVisitorInfo({ email: 'a@example.com' }).marketingConsent,
    false,
    'Providing contact data alone must not become marketing consent',
);

console.log('lead auto-capture normalization smoke checks passed');
