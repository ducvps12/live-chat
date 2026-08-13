import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
    DEFAULT_FACEBOOK_GRAPH_API_VERSION,
    FACEBOOK_OAUTH_MAX_CLOCK_SKEW_MS,
    FACEBOOK_OAUTH_STATE_TTL_MS,
    assertFacebookGraphResponse,
    connectFacebookPageTwoPhase,
    connectFacebookPages,
    facebookGraphUrl,
    facebookOAuthDialogUrl,
    getFacebookOAuthFailure,
    isFacebookOAuthTimestampValid,
    isValidFacebookWebhookSignature,
    resolveFacebookGraphApiVersion,
    sanitizeFacebookProviderError,
} from '../src/modules/facebook/facebook-production.helpers';

function hasErrorCode(value: unknown, code: string): boolean {
    return Boolean(
        value
        && typeof value === 'object'
        && 'code' in value
        && (value as { code?: unknown }).code === code,
    );
}

function getErrorMessage(value: unknown): string {
    return value instanceof Error ? value.message : String(value);
}

async function main(): Promise<void> {
    assert.equal(resolveFacebookGraphApiVersion(), DEFAULT_FACEBOOK_GRAPH_API_VERSION);
    assert.equal(resolveFacebookGraphApiVersion(' v23.0 '), 'v23.0');
    assert.throws(
        () => resolveFacebookGraphApiVersion('23.0'),
        (error: unknown) => hasErrorCode(error, 'FACEBOOK_GRAPH_VERSION_INVALID'),
    );
    assert.equal(
        facebookGraphUrl('v23.0', '/me/accounts'),
        'https://graph.facebook.com/v23.0/me/accounts',
    );
    assert.equal(
        facebookOAuthDialogUrl('v23.0'),
        'https://www.facebook.com/v23.0/dialog/oauth',
    );

    const issuedAtMs = 1_700_000_000_000;
    assert.equal(isFacebookOAuthTimestampValid(issuedAtMs, issuedAtMs), true);
    assert.equal(
        isFacebookOAuthTimestampValid(issuedAtMs, issuedAtMs + FACEBOOK_OAUTH_STATE_TTL_MS),
        true,
    );
    assert.equal(
        isFacebookOAuthTimestampValid(issuedAtMs, issuedAtMs + FACEBOOK_OAUTH_STATE_TTL_MS + 1),
        false,
    );
    assert.equal(
        isFacebookOAuthTimestampValid(
            issuedAtMs + FACEBOOK_OAUTH_MAX_CLOCK_SKEW_MS,
            issuedAtMs,
        ),
        true,
    );
    assert.equal(
        isFacebookOAuthTimestampValid(
            issuedAtMs + FACEBOOK_OAUTH_MAX_CLOCK_SKEW_MS + 1,
            issuedAtMs,
        ),
        false,
    );

    const secret = 'EAATOPSECRET';
    const oauthCode = 'OAUTH-CODE-SECRET';
    const sanitized = sanitizeFacebookProviderError({
        error: {
            message: `Graph rejected https://graph.facebook.com/v23.0/me?access_token=${secret}&code=${oauthCode} client_secret=${secret} Bearer ${secret}`,
        },
    });
    assert.equal(sanitized.includes(secret), false);
    assert.equal(sanitized.includes(oauthCode), false);
    assert.match(sanitized, /\[REDACTED\]/);

    assert.deepEqual(
        assertFacebookGraphResponse<{ id: string }>(
            { ok: true, status: 200 },
            { id: 'page-1' },
            'Facebook page lookup',
        ),
        { id: 'page-1' },
    );
    assert.throws(
        () => assertFacebookGraphResponse(
            { ok: false, status: 401 },
            { error: { message: `Invalid access_token=${secret}` } },
            'Facebook page lookup',
        ),
        (error: unknown) => (
            hasErrorCode(error, 'FACEBOOK_GRAPH_REQUEST_FAILED')
            && !getErrorMessage(error).includes(secret)
        ),
    );
    assert.throws(
        () => assertFacebookGraphResponse(
            { ok: true, status: 200 },
            { success: false },
            'Facebook webhook subscription',
            { requireSuccess: true },
        ),
        (error: unknown) => hasErrorCode(error, 'FACEBOOK_GRAPH_REQUEST_FAILED'),
    );

    const order: string[] = [];
    const persisted = await connectFacebookPageTwoPhase({
        subscribe: async () => { order.push('subscribe'); },
        persist: async () => {
            order.push('persist');
            return { id: 'saved-page' };
        },
    });
    assert.deepEqual(order, ['subscribe', 'persist']);
    assert.deepEqual(persisted, { id: 'saved-page' });

    let storedToken = 'OLD_TOKEN';
    let persistCalls = 0;
    await assert.rejects(
        connectFacebookPageTwoPhase({
            subscribe: async () => { throw new Error('Meta subscription failed'); },
            persist: async () => {
                persistCalls += 1;
                storedToken = 'NEW_TOKEN';
            },
        }),
        /Meta subscription failed/,
    );
    assert.equal(persistCalls, 0);
    assert.equal(storedToken, 'OLD_TOKEN');

    const batch = await connectFacebookPages(
        [{ id: 'page-ok' }, { id: 'page-failed' }, { id: 'page-ok-2' }],
        async (page) => {
            if (page.id === 'page-failed') {
                throw new Error(`Invalid access_token=${secret}`);
            }
            return { id: `saved-${page.id}` };
        },
    );
    assert.deepEqual(batch.connected, [
        { id: 'saved-page-ok' },
        { id: 'saved-page-ok-2' },
    ]);
    assert.equal(batch.failed.length, 1);
    assert.equal(batch.failed[0].pageId, 'page-failed');
    assert.equal(batch.failed[0].error.includes(secret), false);

    assert.equal(getFacebookOAuthFailure({}), null);
    assert.equal(
        getFacebookOAuthFailure({
            error: 'access_denied',
            error_description: `Denied access_token=${secret}`,
        }),
        'Denied access_token=[REDACTED]',
    );

    const webhookSecret = 'facebook-webhook-secret';
    const rawBody = Buffer.from(JSON.stringify({ object: 'page', entry: [{ id: 'page-1' }] }));
    const validSignature = `sha256=${createHmac('sha256', webhookSecret).update(rawBody).digest('hex')}`;
    assert.equal(isValidFacebookWebhookSignature(rawBody, validSignature, webhookSecret), true);
    assert.equal(isValidFacebookWebhookSignature(Buffer.from('{}'), validSignature, webhookSecret), false);
    assert.equal(isValidFacebookWebhookSignature(rawBody, 'sha256=invalid', webhookSecret), false);
    assert.equal(isValidFacebookWebhookSignature(rawBody, undefined, webhookSecret), false);

    const controllerSource = readFileSync('src/modules/facebook/facebook.controller.ts', 'utf8');
    const verifyOffset = controllerSource.indexOf('verifyWebhookSignature(rawBody, signature)');
    const ackOffset = controllerSource.indexOf('res.sendStatus(200)');
    assert.ok(verifyOffset >= 0, 'Facebook webhook controller must verify the raw-body signature');
    assert.ok(ackOffset > verifyOffset, 'Facebook webhook must verify before acknowledging Meta');

    for (const bootstrapPath of ['src/bootstrap/index.ts', 'src/bootstrap/production.ts']) {
        const bootstrapSource = readFileSync(bootstrapPath, 'utf8');
        assert.match(bootstrapSource, /express\.json\(\{[\s\S]*verify:/);
        assert.match(bootstrapSource, /\/facebook\/webhook/);
        assert.match(bootstrapSource, /rawBody/);
    }

    console.log('FACEBOOK_PRODUCTION_SMOKE_OK');
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
