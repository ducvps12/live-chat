import { AppError } from '../../middlewares/errorHandler';
import { createHmac, timingSafeEqual } from 'crypto';

export const DEFAULT_FACEBOOK_GRAPH_API_VERSION = 'v19.0';
export const FACEBOOK_OAUTH_STATE_TTL_MS = 15 * 60_000;
export const FACEBOOK_OAUTH_MAX_CLOCK_SKEW_MS = 60_000;

export function resolveFacebookGraphApiVersion(rawVersion?: string): string {
    const version = (rawVersion || DEFAULT_FACEBOOK_GRAPH_API_VERSION).trim();
    if (!/^v\d+\.\d+$/.test(version)) {
        throw new AppError('Facebook Graph API version is invalid', 500, 'FACEBOOK_GRAPH_VERSION_INVALID');
    }
    return version;
}

export function facebookGraphUrl(version: string, path: string): string {
    const normalizedVersion = resolveFacebookGraphApiVersion(version);
    const normalizedPath = String(path || '').replace(/^\/+/, '');
    return `https://graph.facebook.com/${normalizedVersion}/${normalizedPath}`;
}

export function facebookOAuthDialogUrl(version: string): string {
    return `https://www.facebook.com/${resolveFacebookGraphApiVersion(version)}/dialog/oauth`;
}

export function isFacebookOAuthTimestampValid(
    issuedAtMs: number,
    nowMs: number,
    ttlMs = FACEBOOK_OAUTH_STATE_TTL_MS,
    maxClockSkewMs = FACEBOOK_OAUTH_MAX_CLOCK_SKEW_MS,
): boolean {
    if (!Number.isFinite(issuedAtMs) || !Number.isFinite(nowMs)) return false;
    const ageMs = nowMs - issuedAtMs;
    return ageMs >= -maxClockSkewMs && ageMs <= ttlMs;
}

function extractProviderMessage(value: unknown): string {
    if (typeof value === 'string') return value;
    if (!value || typeof value !== 'object') return '';
    const record = value as Record<string, unknown>;
    if (record.error && typeof record.error === 'object') {
        const nested = record.error as Record<string, unknown>;
        if (typeof nested.message === 'string') return nested.message;
    }
    if (typeof record.message === 'string') return record.message;
    return '';
}

export function sanitizeFacebookProviderError(
    value: unknown,
    fallback = 'Facebook request failed',
): string {
    const raw = extractProviderMessage(value) || fallback;
    return raw
        .replace(/[\u0000-\u001f\u007f]/g, ' ')
        .replace(/([?&](?:access_token|client_secret|code|fb_exchange_token)=)[^&\s]+/gi, '$1[REDACTED]')
        .replace(/\bBearer\s+[A-Za-z0-9._~+\/-]+/gi, 'Bearer [REDACTED]')
        .replace(/\b(access_token|client_secret|fb_exchange_token)\s*[:=]\s*[^\s,;]+/gi, '$1=[REDACTED]')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 500) || fallback;
}

type GraphResponse = { ok: boolean; status: number };

export function assertFacebookGraphResponse<T>(
    response: GraphResponse,
    data: unknown,
    operation: string,
    options: { requireSuccess?: boolean } = {},
): T {
    const record = data && typeof data === 'object' ? data as Record<string, unknown> : null;
    const providerFailed = Boolean(record?.error);
    const contractFailed = options.requireSuccess === true && record?.success !== true;
    if (!response.ok || providerFailed || contractFailed) {
        const detail = sanitizeFacebookProviderError(data, `HTTP ${response.status}`);
        throw new AppError(`${operation}: ${detail}`, 502, 'FACEBOOK_GRAPH_REQUEST_FAILED');
    }
    return data as T;
}

export async function connectFacebookPageTwoPhase<T>(input: {
    subscribe: () => Promise<void>;
    persist: () => Promise<T>;
}): Promise<T> {
    await input.subscribe();
    return input.persist();
}

export async function connectFacebookPages<T extends { id: string }, R>(
    pages: readonly T[],
    connect: (page: T) => Promise<R>,
): Promise<{ connected: R[]; failed: Array<{ pageId: string; error: string }> }> {
    const connected: R[] = [];
    const failed: Array<{ pageId: string; error: string }> = [];
    for (const page of pages) {
        try {
            connected.push(await connect(page));
        } catch (error) {
            failed.push({ pageId: page.id, error: sanitizeFacebookProviderError(error) });
        }
    }
    return { connected, failed };
}

export function getFacebookOAuthFailure(query: Record<string, unknown>): string | null {
    const error = typeof query.error === 'string' ? query.error : '';
    const description = typeof query.error_description === 'string' ? query.error_description : '';
    const reason = typeof query.error_reason === 'string' ? query.error_reason : '';
    if (!error && !description && !reason) return null;
    return sanitizeFacebookProviderError(description || reason || error, 'Facebook OAuth failed');
}

export function isValidFacebookWebhookSignature(
    rawBody: Buffer,
    signatureHeader: string,
    appSecret: string,
): boolean {
    if (!Buffer.isBuffer(rawBody) || rawBody.length === 0 || !appSecret) return false;
    const match = /^sha256=([a-f0-9]{64})$/i.exec(String(signatureHeader || '').trim());
    if (!match) return false;
    const received = Buffer.from(match[1], 'hex');
    const expected = createHmac('sha256', appSecret).update(rawBody).digest();
    return received.length === expected.length && timingSafeEqual(received, expected);
}
