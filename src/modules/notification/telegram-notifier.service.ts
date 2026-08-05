import { SETTINGS_KEYS, settingsService } from '../admin/settings.service';

const TELEGRAM_API_BASE = 'https://api.telegram.org';
const DEFAULT_TIMEOUT_MS = 8_000;
const MIN_TIMEOUT_MS = 500;
const MAX_TIMEOUT_MS = 30_000;
const MAX_MESSAGE_LENGTH = 4_096;

type FetchImplementation = typeof fetch;

export type TelegramErrorCode =
    | 'TELEGRAM_NOT_CONFIGURED'
    | 'TELEGRAM_INVALID_CONFIG'
    | 'TELEGRAM_INVALID_MESSAGE'
    | 'TELEGRAM_TIMEOUT'
    | 'TELEGRAM_NETWORK_ERROR'
    | 'TELEGRAM_API_ERROR'
    | 'TELEGRAM_INVALID_RESPONSE';

export class TelegramNotifierError extends Error {
    readonly code: TelegramErrorCode;
    readonly status?: number;
    readonly retryable: boolean;
    readonly retryAfterSeconds?: number;

    constructor(
        code: TelegramErrorCode,
        message: string,
        options: {
            status?: number;
            retryable?: boolean;
            retryAfterSeconds?: number;
        } = {},
    ) {
        super(message);
        this.name = 'TelegramNotifierError';
        this.code = code;
        this.status = options.status;
        this.retryable = options.retryable === true;
        this.retryAfterSeconds = options.retryAfterSeconds;
    }
}

export interface TelegramConfigOverrides {
    enabled?: unknown;
    botToken?: unknown;
    chatId?: unknown;
    timeoutMs?: unknown;
}

export interface ResolvedTelegramConfig {
    enabled: boolean;
    botToken: string;
    chatId: string;
    timeoutMs: number;
    configured: boolean;
}

export interface TelegramConfigStatus {
    enabled: boolean;
    configured: boolean;
    hasBotToken: boolean;
    hasChatId: boolean;
    chatId: string;
    timeoutMs: number;
}

interface TelegramApiEnvelope<T> {
    ok: boolean;
    result?: T;
    description?: string;
    error_code?: number;
    parameters?: {
        retry_after?: number;
    };
}

interface TelegramChatRecord {
    id: number | string;
    type?: string;
    title?: string;
    username?: string;
    first_name?: string;
    last_name?: string;
}

interface TelegramMessageRecord {
    message_id?: number;
    date?: number;
    chat?: TelegramChatRecord;
}

interface TelegramUpdateRecord {
    update_id: number;
    message?: TelegramMessageRecord;
    edited_message?: TelegramMessageRecord;
    channel_post?: TelegramMessageRecord;
    edited_channel_post?: TelegramMessageRecord;
    callback_query?: {
        message?: TelegramMessageRecord;
    };
    my_chat_member?: {
        chat?: TelegramChatRecord;
        date?: number;
    };
    chat_member?: {
        chat?: TelegramChatRecord;
        date?: number;
    };
}

interface TelegramSentMessage {
    message_id: number;
    date?: number;
    chat: TelegramChatRecord;
}

export interface TelegramDiscoveredChat {
    id: string;
    type: string;
    title: string;
    username?: string;
    lastUpdateId: number;
    lastActivityAt?: string;
}

export interface TelegramChatDiscoveryResult {
    chats: TelegramDiscoveredChat[];
    updateCount: number;
    nextOffset?: number;
}

export interface TelegramDeliveryResult {
    sent: boolean;
    reason?: 'disabled' | 'not_configured';
    messageId?: number;
    chatId?: string;
}

export interface TelegramRequestOptions {
    config?: TelegramConfigOverrides;
    env?: NodeJS.ProcessEnv;
    fetchImpl?: FetchImplementation;
    /**
     * Defaults to the system settings service. Pass false for env-only
     * resolution (useful for isolated jobs and tests).
     */
    settings?: TelegramSettingsReader | false;
}

export interface TelegramSendOptions extends TelegramRequestOptions {
    chatId?: unknown;
    messageThreadId?: unknown;
    disableNotification?: boolean;
}

export interface TelegramDiscoveryOptions extends TelegramRequestOptions {
    offset?: unknown;
    limit?: unknown;
}

export interface TelegramSettingsReader {
    get(key: string, fallback?: string): Promise<string>;
    getSecret?(key: string, fallback?: string): Promise<string>;
}

function cleanString(value: unknown, maxLength: number): string {
    if (typeof value !== 'string' && typeof value !== 'number') return '';
    return String(value)
        .replace(/[\u0000-\u001f\u007f]/g, '')
        .trim()
        .slice(0, maxLength);
}

function firstDefined(...values: unknown[]): unknown {
    return values.find(value => value !== undefined && value !== null);
}

function parseBoolean(value: unknown, fallback: boolean): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value !== 'string' && typeof value !== 'number') return fallback;
    const normalized = String(value).trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
    return fallback;
}

function boundedInteger(value: unknown, fallback: number, min: number, max: number): number {
    const parsed = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, Math.round(parsed)));
}

function validBotToken(value: string): boolean {
    return /^\d{5,20}:[A-Za-z0-9_-]{20,200}$/.test(value);
}

function validChatId(value: string): boolean {
    return /^-?\d{1,20}$/.test(value)
        || /^@[A-Za-z][A-Za-z0-9_]{4,31}$/.test(value);
}

export function redactTelegramSecrets(value: unknown, botToken = ''): string {
    let redacted = String(value ?? '');
    if (botToken) redacted = redacted.split(botToken).join('[REDACTED]');
    return redacted
        .replace(/\/bot\d{5,20}:[A-Za-z0-9_-]{10,200}/g, '/bot[REDACTED]')
        .replace(/\b\d{5,20}:[A-Za-z0-9_-]{20,200}\b/g, '[REDACTED]')
        .slice(0, 600);
}

export function resolveTelegramConfig(
    overrides: TelegramConfigOverrides = {},
    envSource: NodeJS.ProcessEnv = process.env,
): ResolvedTelegramConfig {
    const botToken = cleanString(
        firstDefined(overrides.botToken, envSource.TELEGRAM_BOT_TOKEN),
        256,
    );
    const chatId = cleanString(
        firstDefined(overrides.chatId, envSource.TELEGRAM_CHAT_ID),
        64,
    );
    const timeoutMs = boundedInteger(
        firstDefined(overrides.timeoutMs, envSource.TELEGRAM_API_TIMEOUT_MS),
        DEFAULT_TIMEOUT_MS,
        MIN_TIMEOUT_MS,
        MAX_TIMEOUT_MS,
    );
    const configured = validBotToken(botToken) && validChatId(chatId);
    const enabled = parseBoolean(
        firstDefined(overrides.enabled, envSource.TELEGRAM_NOTIFICATIONS_ENABLED),
        configured,
    );

    const config = {
        enabled,
        botToken: '',
        chatId,
        timeoutMs,
        configured,
    } as ResolvedTelegramConfig;

    // Keep the token usable by the HTTP client but out of JSON.stringify,
    // object spread and routine structured logs.
    Object.defineProperty(config, 'botToken', {
        configurable: false,
        enumerable: false,
        writable: false,
        value: botToken,
    });
    return config;
}

function nonEmptySetting(value: string): string | undefined {
    const cleaned = value.trim();
    return cleaned ? cleaned : undefined;
}

/**
 * Resolve runtime config with deterministic precedence:
 * explicit overrides -> encrypted system settings -> environment.
 *
 * A settings outage falls back to environment configuration so a notification
 * cannot break the business operation that attempted to send it.
 */
export async function resolveTelegramRuntimeConfig(
    options: TelegramRequestOptions = {},
): Promise<ResolvedTelegramConfig> {
    const reader = options.settings === false
        ? undefined
        : options.settings || settingsService;
    let stored: TelegramConfigOverrides = {};

    if (reader) {
        try {
            const readSecret = reader.getSecret
                ? (key: string, fallback = '') => reader.getSecret!.call(reader, key, fallback)
                : (key: string, fallback = '') => reader.get.call(reader, key, fallback);
            const [enabled, legacyEnabled, botToken, chatId, timeoutMs] = await Promise.all([
                reader.get(
                    SETTINGS_KEYS.TELEGRAM_ENABLED,
                    '',
                ),
                reader.get(
                    SETTINGS_KEYS.TELEGRAM_NOTIFICATIONS_ENABLED,
                    '',
                ),
                readSecret(SETTINGS_KEYS.TELEGRAM_BOT_TOKEN, ''),
                reader.get(SETTINGS_KEYS.TELEGRAM_CHAT_ID, ''),
                reader.get(SETTINGS_KEYS.TELEGRAM_API_TIMEOUT_MS, ''),
            ]);

            stored = {
                enabled: nonEmptySetting(enabled) || nonEmptySetting(legacyEnabled),
                botToken: nonEmptySetting(botToken),
                chatId: nonEmptySetting(chatId),
                timeoutMs: nonEmptySetting(timeoutMs),
            };
        } catch {
            // Environment fallback is intentional. Callers still receive a
            // safe "not configured" result when neither source is usable.
            stored = {};
        }
    }

    return resolveTelegramConfig(
        {
            enabled: firstDefined(options.config?.enabled, stored.enabled),
            botToken: firstDefined(options.config?.botToken, stored.botToken),
            chatId: firstDefined(options.config?.chatId, stored.chatId),
            timeoutMs: firstDefined(options.config?.timeoutMs, stored.timeoutMs),
        },
        options.env,
    );
}

export function getTelegramConfigStatus(config: ResolvedTelegramConfig): TelegramConfigStatus {
    return {
        enabled: config.enabled,
        configured: config.configured,
        hasBotToken: validBotToken(config.botToken),
        hasChatId: validChatId(config.chatId),
        chatId: config.chatId,
        timeoutMs: config.timeoutMs,
    };
}

function requireBotToken(config: ResolvedTelegramConfig): void {
    if (!config.botToken) {
        throw new TelegramNotifierError(
            'TELEGRAM_NOT_CONFIGURED',
            'Telegram bot token is not configured',
        );
    }
    if (!validBotToken(config.botToken)) {
        throw new TelegramNotifierError(
            'TELEGRAM_INVALID_CONFIG',
            'Telegram bot token has an invalid format',
        );
    }
}

function resolveChatId(value: unknown, config: ResolvedTelegramConfig): string {
    const chatId = cleanString(firstDefined(value, config.chatId), 64);
    if (!chatId) {
        throw new TelegramNotifierError(
            'TELEGRAM_NOT_CONFIGURED',
            'Telegram chat ID is not configured',
        );
    }
    if (!validChatId(chatId)) {
        throw new TelegramNotifierError(
            'TELEGRAM_INVALID_CONFIG',
            'Telegram chat ID has an invalid format',
        );
    }
    return chatId;
}

async function telegramRequest<T>(
    method: 'sendMessage' | 'getUpdates',
    payload: Record<string, unknown>,
    config: ResolvedTelegramConfig,
    fetchImpl: FetchImplementation,
): Promise<T> {
    requireBotToken(config);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
    const requestUrl = `${TELEGRAM_API_BASE}/bot${config.botToken}/${method}`;

    try {
        const response = await fetchImpl(requestUrl, {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
            cache: 'no-store',
            redirect: 'error',
            signal: controller.signal,
        });

        let envelope: TelegramApiEnvelope<T>;
        try {
            envelope = await response.json() as TelegramApiEnvelope<T>;
        } catch {
            throw new TelegramNotifierError(
                'TELEGRAM_INVALID_RESPONSE',
                `Telegram returned a non-JSON response (${response.status})`,
                {
                    status: response.status,
                    retryable: response.status >= 500,
                },
            );
        }

        if (!response.ok || envelope.ok !== true || envelope.result === undefined) {
            const status = envelope.error_code || response.status;
            const description = redactTelegramSecrets(
                envelope.description || 'Request rejected',
                config.botToken,
            );
            throw new TelegramNotifierError(
                'TELEGRAM_API_ERROR',
                `Telegram API rejected ${method} (${status}): ${description}`,
                {
                    status,
                    retryable: status === 429 || status >= 500,
                    retryAfterSeconds: envelope.parameters?.retry_after,
                },
            );
        }

        return envelope.result;
    } catch (error: unknown) {
        if (error instanceof TelegramNotifierError) throw error;
        const aborted = controller.signal.aborted
            || (error instanceof Error && error.name === 'AbortError');
        if (aborted) {
            throw new TelegramNotifierError(
                'TELEGRAM_TIMEOUT',
                `Telegram request timed out after ${config.timeoutMs}ms`,
                { retryable: true },
            );
        }
        const detail = redactTelegramSecrets(
            error instanceof Error ? error.message : 'Network request failed',
            config.botToken,
        );
        throw new TelegramNotifierError(
            'TELEGRAM_NETWORK_ERROR',
            `Telegram request failed: ${detail}`,
            { retryable: true },
        );
    } finally {
        clearTimeout(timeout);
    }
}

function messageChat(update: TelegramUpdateRecord): {
    chat?: TelegramChatRecord;
    date?: number;
} {
    const message = update.message
        || update.edited_message
        || update.channel_post
        || update.edited_channel_post
        || update.callback_query?.message;
    if (message?.chat) return { chat: message.chat, date: message.date };
    if (update.my_chat_member?.chat) {
        return { chat: update.my_chat_member.chat, date: update.my_chat_member.date };
    }
    if (update.chat_member?.chat) {
        return { chat: update.chat_member.chat, date: update.chat_member.date };
    }
    return {};
}

function chatTitle(chat: TelegramChatRecord): string {
    const fullName = [chat.first_name, chat.last_name].filter(Boolean).join(' ').trim();
    return cleanString(chat.title || fullName || chat.username || `Chat ${chat.id}`, 160);
}

function activityIso(timestamp?: number): string | undefined {
    if (!timestamp || !Number.isFinite(timestamp)) return undefined;
    const date = new Date(timestamp * 1_000);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

async function sendResolvedMessage(
    text: string,
    config: ResolvedTelegramConfig,
    options: TelegramSendOptions,
): Promise<TelegramDeliveryResult> {
    requireBotToken(config);
    const chatId = resolveChatId(options.chatId, config);
    const rawThreadId = Number(options.messageThreadId);
    const messageThreadId = Number.isSafeInteger(rawThreadId) && rawThreadId > 0
        ? rawThreadId
        : undefined;
    const message = String(text || '').trim();
    if (!message || message.length > MAX_MESSAGE_LENGTH) {
        throw new TelegramNotifierError(
            'TELEGRAM_INVALID_MESSAGE',
            `Telegram message must contain between 1 and ${MAX_MESSAGE_LENGTH} characters`,
        );
    }

    const sent = await telegramRequest<TelegramSentMessage>(
        'sendMessage',
        {
            chat_id: chatId,
            text: message,
            ...(messageThreadId ? { message_thread_id: messageThreadId } : {}),
            disable_notification: options.disableNotification === true,
        },
        config,
        options.fetchImpl || fetch,
    );

    return {
        sent: true,
        messageId: sent.message_id,
        chatId: String(sent.chat?.id ?? chatId),
    };
}

export const telegramNotifier = {
    resolveConfig(
        overrides: TelegramConfigOverrides = {},
        envSource: NodeJS.ProcessEnv = process.env,
    ) {
        return resolveTelegramConfig(overrides, envSource);
    },

    resolveRuntimeConfig(options: TelegramRequestOptions = {}) {
        return resolveTelegramRuntimeConfig(options);
    },

    async status(options: TelegramRequestOptions = {}) {
        const config = await resolveTelegramRuntimeConfig(options);
        return getTelegramConfigStatus(config);
    },

    async discoverChats(
        options: TelegramDiscoveryOptions = {},
    ): Promise<TelegramChatDiscoveryResult> {
        const config = await resolveTelegramRuntimeConfig(options);
        requireBotToken(config);
        const limit = boundedInteger(options.limit, 100, 1, 100);
        const offsetValue = Number(options.offset);
        const offset = Number.isSafeInteger(offsetValue) && offsetValue >= 0
            ? offsetValue
            : undefined;
        const updates = await telegramRequest<TelegramUpdateRecord[]>(
            'getUpdates',
            {
                timeout: 0,
                limit,
                ...(offset !== undefined ? { offset } : {}),
                allowed_updates: [
                    'message',
                    'edited_message',
                    'channel_post',
                    'edited_channel_post',
                    'callback_query',
                    'my_chat_member',
                    'chat_member',
                ],
            },
            config,
            options.fetchImpl || fetch,
        );

        const chats = new Map<string, TelegramDiscoveredChat>();
        let maxUpdateId: number | undefined;
        for (const update of updates) {
            if (!Number.isSafeInteger(update.update_id)) continue;
            maxUpdateId = maxUpdateId === undefined
                ? update.update_id
                : Math.max(maxUpdateId, update.update_id);
            const { chat, date } = messageChat(update);
            if (!chat || chat.id === undefined || chat.id === null) continue;
            const id = String(chat.id);
            const previous = chats.get(id);
            if (previous && previous.lastUpdateId > update.update_id) continue;
            const lastActivityAt = activityIso(date);
            chats.set(id, {
                id,
                type: cleanString(chat.type || 'unknown', 32) || 'unknown',
                title: chatTitle(chat),
                ...(chat.username ? { username: cleanString(chat.username, 64) } : {}),
                lastUpdateId: update.update_id,
                ...(lastActivityAt ? { lastActivityAt } : {}),
            });
        }

        return {
            chats: [...chats.values()].sort((left, right) => (
                right.lastUpdateId - left.lastUpdateId
            )),
            updateCount: updates.length,
            ...(maxUpdateId !== undefined ? { nextOffset: maxUpdateId + 1 } : {}),
        };
    },

    async sendMessage(
        text: string,
        options: TelegramSendOptions = {},
    ): Promise<TelegramDeliveryResult> {
        const config = await resolveTelegramRuntimeConfig(options);
        return sendResolvedMessage(text, config, options);
    },

    async sendTestMessage(
        options: TelegramSendOptions & { message?: string } = {},
    ): Promise<TelegramDeliveryResult> {
        return this.sendMessage(
            options.message || '✅ NemarkChat đã kết nối Telegram thành công.',
            options,
        );
    },

    async notify(
        text: string,
        options: TelegramSendOptions = {},
    ): Promise<TelegramDeliveryResult> {
        const config = await resolveTelegramRuntimeConfig(options);
        if (!config.enabled) return { sent: false, reason: 'disabled' };
        if (!config.configured) return { sent: false, reason: 'not_configured' };
        return sendResolvedMessage(text, config, options);
    },
};
