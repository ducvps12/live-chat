import assert from 'node:assert/strict';
import {
    telegramNotifier,
    TelegramNotifierError,
} from '../src/modules/notification/telegram-notifier.service';
import {
    OperationalAlertGate,
    redactOperationalText,
} from '../src/modules/notification/system-notification.service';
import { decryptSecret, encryptSecret } from '../src/infra/secretVault';

const testToken = '123456789:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const testChatId = '-1001234567890';

async function run(): Promise<void> {
    process.env.SETTINGS_ENCRYPTION_KEY = 'smoke-only-encryption-key-32-characters-long';
    const vaultPlaintext = 'smoke-secret-never-persisted';
    const vaultCiphertext = encryptSecret(vaultPlaintext);
    assert.match(vaultCiphertext, /^enc:v1:/);
    assert(!vaultCiphertext.includes(vaultPlaintext));
    assert.equal(decryptSecret(vaultCiphertext), vaultPlaintext);

    const requests: Array<{ url: string; body: Record<string, unknown> }> = [];
    const successFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        requests.push({
            url: String(input),
            body: JSON.parse(String(init?.body || '{}')) as Record<string, unknown>,
        });
        return new Response(JSON.stringify({
            ok: true,
            result: {
                message_id: 42,
                chat: { id: testChatId, type: 'group' },
            },
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    }) as typeof fetch;

    const env = {
        NODE_ENV: 'test',
        TELEGRAM_NOTIFICATIONS_ENABLED: 'true',
        TELEGRAM_BOT_TOKEN: testToken,
        TELEGRAM_CHAT_ID: testChatId,
        TELEGRAM_API_TIMEOUT_MS: '1000',
    } as NodeJS.ProcessEnv;

    const result = await telegramNotifier.sendMessage('Telegram smoke test', {
        env,
        settings: false,
        fetchImpl: successFetch,
        messageThreadId: 42,
    });
    assert.equal(result.sent, true);
    assert.equal(result.messageId, 42);
    assert.equal(requests.length, 1);
    assert.match(requests[0].url, /\/sendMessage$/);
    assert.equal(requests[0].body.chat_id, testChatId);
    assert.equal(requests[0].body.text, 'Telegram smoke test');
    assert.equal(requests[0].body.message_thread_id, 42);
    assert(!JSON.stringify(requests[0].body).includes(testToken));

    const resolved = telegramNotifier.resolveConfig({}, env);
    assert.equal(resolved.configured, true);
    assert(!JSON.stringify(resolved).includes(testToken));

    const failingFetch = (async () => new Response(JSON.stringify({
        ok: false,
        error_code: 400,
        description: `Bad Request exposed ${testToken}`,
    }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
    })) as typeof fetch;
    const telegramError = await telegramNotifier.sendMessage('must fail safely', {
        env,
        settings: false,
        fetchImpl: failingFetch,
    }).then(
        () => null,
        error => error,
    );
    assert(telegramError instanceof TelegramNotifierError);
    assert(!telegramError.message.includes(testToken));
    assert.match(telegramError.message, /\[REDACTED\]/);

    const unsafe = `token=${testToken} password=super-secret Authorization: Bearer abc.def email=owner@example.com`;
    const redacted = redactOperationalText(unsafe);
    assert(!redacted.includes(testToken));
    assert(!redacted.includes('super-secret'));
    assert(!redacted.includes('abc.def'));
    assert(!redacted.includes('owner@example.com'));

    const gate = new OperationalAlertGate(2, 60_000);
    const first = gate.begin('same-event', 5_000, 1_000);
    assert.equal(first.allowed, true);
    if (first.allowed) gate.complete(first.ticket, true, 1_000);
    assert.deepEqual(gate.begin('same-event', 5_000, 2_000), {
        allowed: false,
        reason: 'duplicate',
    });
    const second = gate.begin('second-event', 5_000, 2_000);
    assert.equal(second.allowed, true);
    if (second.allowed) gate.complete(second.ticket, true, 2_000);
    assert.deepEqual(gate.begin('third-event', 5_000, 3_000), {
        allowed: false,
        reason: 'rate_limited',
    });

    console.log('telegram notifier smoke checks passed');
}

void run();
