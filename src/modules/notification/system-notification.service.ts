import crypto from 'node:crypto';
import os from 'node:os';
import { SETTINGS_KEYS, settingsService } from '../admin/settings.service';
import {
    redactTelegramSecrets,
    telegramNotifier,
    TelegramNotifierError,
} from './telegram-notifier.service';
import {
    NotificationOutboxDispatcher,
    prismaNotificationOutboxStore,
} from './notification-outbox';

const DEFAULT_DEDUP_WINDOW_MS = 5 * 60_000;
const DEFAULT_RATE_LIMIT = 12;
const RATE_WINDOW_MS = 60_000;

export type OperationalNotificationOutcome =
    | 'sent'
    | 'disabled'
    | 'not_configured'
    | 'queued'
    | 'duplicate'
    | 'rate_limited'
    | 'failed';

type GateDecision =
    | { allowed: true; ticket: string }
    | { allowed: false; reason: 'duplicate' | 'rate_limited' };

function boundedInteger(value: unknown, fallback: number, min: number, max: number): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, Math.round(parsed)));
}

function parseBoolean(value: unknown, fallback: boolean): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value !== 'string' && typeof value !== 'number') return fallback;
    const normalized = String(value).trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
    return fallback;
}

function maskEmail(value: string): string {
    const [local, domain] = value.split('@');
    if (!local || !domain) return '[REDACTED_EMAIL]';
    return `${local.slice(0, 2)}***@${domain}`;
}

/** Remove credentials and control characters before data reaches Telegram or logs. */
export function redactOperationalText(value: unknown, maxLength = 600): string {
    return redactTelegramSecrets(value)
        .replace(/\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi, 'Bearer [REDACTED]')
        .replace(/\bAUTH\s+(PLAIN|LOGIN)\s+\S+/gi, 'AUTH $1 [REDACTED]')
        .replace(
            /\b(password|passwd|secret|token|api[_-]?key|cookie|authorization)\s*[:=]\s*([^\s,;]+)/gi,
            '$1=[REDACTED]',
        )
        .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, match => maskEmail(match))
        .replace(/[\u0000-\u001f\u007f]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, maxLength);
}

function safeField(value: unknown, maxLength = 180): string {
    return redactOperationalText(value, maxLength) || '-';
}

function formatMoney(amount: number, currency = 'VND'): string {
    try {
        return new Intl.NumberFormat('vi-VN', {
            style: 'currency',
            currency,
            maximumFractionDigits: 0,
        }).format(amount);
    } catch {
        return `${Number.isFinite(amount) ? amount : 0} ${safeField(currency, 8)}`;
    }
}

function formatEvent(title: string, fields: Record<string, unknown>): string {
    const lines = [`NemarkChat | ${safeField(title, 100)}`];
    for (const [label, value] of Object.entries(fields)) {
        if (value === undefined || value === null || value === '') continue;
        lines.push(`${safeField(label, 40)}: ${safeField(value, 320)}`);
    }
    lines.push(`Time: ${new Date().toISOString()}`);
    return lines.join('\n');
}

/**
 * Process-local protection against notification storms. Production can still
 * run this safely on multiple nodes; cross-node aggregation belongs in the
 * external alerting layer.
 */
export class OperationalAlertGate {
    private readonly lastSentAt = new Map<string, number>();
    private readonly inFlight = new Set<string>();
    private attemptedAt: number[] = [];

    constructor(
        private readonly maxPerWindow = DEFAULT_RATE_LIMIT,
        private readonly rateWindowMs = RATE_WINDOW_MS,
    ) {}

    begin(key: string, dedupWindowMs = DEFAULT_DEDUP_WINDOW_MS, now = Date.now()): GateDecision {
        if (this.lastSentAt.size > 500) {
            const retentionMs = 24 * 60 * 60_000;
            for (const [storedKey, timestamp] of this.lastSentAt) {
                if (now - timestamp >= retentionMs) this.lastSentAt.delete(storedKey);
            }
        }
        const ticket = crypto.createHash('sha256').update(key).digest('base64url');
        const lastSent = this.lastSentAt.get(ticket);
        if (this.inFlight.has(ticket) || (lastSent !== undefined && now - lastSent < dedupWindowMs)) {
            return { allowed: false, reason: 'duplicate' };
        }

        this.attemptedAt = this.attemptedAt.filter(timestamp => now - timestamp < this.rateWindowMs);
        if (this.attemptedAt.length >= this.maxPerWindow) {
            return { allowed: false, reason: 'rate_limited' };
        }

        this.inFlight.add(ticket);
        // Failed provider calls also consume the rate budget so an outage does
        // not turn into a retry storm against Telegram.
        this.attemptedAt.push(now);
        return { allowed: true, ticket };
    }

    complete(ticket: string, sent: boolean, now = Date.now()): void {
        this.inFlight.delete(ticket);
        if (!sent) return;
        this.lastSentAt.set(ticket, now);
    }
}

const alertGate = new OperationalAlertGate(
    boundedInteger(process.env.TELEGRAM_ALERT_RATE_LIMIT_PER_MINUTE, DEFAULT_RATE_LIMIT, 1, 120),
    RATE_WINDOW_MS,
);

const notificationOutbox = new NotificationOutboxDispatcher(
    prismaNotificationOutboxStore,
    {
        async send(record) {
            return telegramNotifier.notify(
                record.text,
                record.envOnly ? { settings: false } : {},
            );
        },
    },
);

let outboxFlushInFlight: Promise<unknown> | null = null;

async function flushNotificationOutbox(): Promise<void> {
    if (outboxFlushInFlight) return;
    outboxFlushInFlight = notificationOutbox.flushDue().catch(error => {
        console.warn(`[Telegram] Notification outbox flush failed (${error instanceof Error ? error.name : 'unknown'})`);
    }).finally(() => {
        outboxFlushInFlight = null;
    });
    await outboxFlushInFlight;
}

export function startNotificationOutboxWorker(intervalMs = 30_000): () => void {
    void flushNotificationOutbox();
    const timer = setInterval(() => void flushNotificationOutbox(), intervalMs);
    timer.unref();
    return () => clearInterval(timer);
}

async function settingToggle(
    keys: string[],
    envKey: string,
    fallback = true,
): Promise<boolean> {
    try {
        const settings = await settingsService.getAll();
        for (const key of keys) {
            if (settings[key] !== undefined && settings[key] !== '') {
                return parseBoolean(settings[key], fallback);
            }
        }
    } catch {
        // DB/settings outages deliberately fall through to server-only env.
    }
    return parseBoolean(process.env[envKey], fallback);
}

async function notifySafely(input: {
    event: string;
    dedupKey: string;
    text: string;
    toggleKeys?: string[];
    toggleEnv?: string;
    dedupWindowMs?: number;
    envOnly?: boolean;
}): Promise<OperationalNotificationOutcome> {
    const enabled = input.envOnly
        ? parseBoolean(process.env[input.toggleEnv || 'TELEGRAM_NOTIFY_SYSTEM_ERROR'], true)
        : await settingToggle(
            input.toggleKeys || [SETTINGS_KEYS.TELEGRAM_NOTIFY_SYSTEM_ERROR],
            input.toggleEnv || 'TELEGRAM_NOTIFY_SYSTEM_ERROR',
            true,
        );
    if (!enabled) return 'disabled';

    const dedupWindowMs = input.dedupWindowMs ?? boundedInteger(
        process.env.TELEGRAM_ALERT_DEDUP_WINDOW_MS,
        DEFAULT_DEDUP_WINDOW_MS,
        5_000,
        24 * 60 * 60_000,
    );
    const gate = alertGate.begin(`${input.event}:${input.dedupKey}`, dedupWindowMs);
    if (!gate.allowed) return gate.reason;

    try {
        const record = await notificationOutbox.enqueue({
            event: input.event,
            dedupKey: input.dedupKey,
            text: redactOperationalText(input.text, 4_096),
            envOnly: input.envOnly,
            dedupWindowMs,
        });
        const result = await notificationOutbox.dispatch(record);
        const sent = result.status === 'sent';
        alertGate.complete(gate.ticket, sent);
        if (sent) return 'sent';
        return 'queued';
    } catch (error) {
        alertGate.complete(gate.ticket, false);
        const code = error instanceof TelegramNotifierError
            ? error.code
            : 'TELEGRAM_NOTIFICATION_FAILED';
        // Never include provider error text here: it may contain request data.
        console.warn(`[Telegram] Operational event ${input.event} skipped (${code})`);
        return 'failed';
    }
}

export const systemNotificationService = {
    appStartup(input: { port: number | string; mode: string }) {
        return notifySafely({
            event: 'app_startup',
            dedupKey: `${os.hostname()}:${input.port}`,
            dedupWindowMs: 30_000,
            text: formatEvent('Application started', {
                Host: os.hostname(),
                Port: input.port,
                Mode: input.mode,
                PID: process.pid,
            }),
        });
    },

    appShutdown(input: { signal: string }) {
        return notifySafely({
            event: 'app_shutdown',
            dedupKey: `${os.hostname()}:${input.signal}`,
            dedupWindowMs: 15_000,
            text: formatEvent('Application shutting down', {
                Host: os.hostname(),
                Signal: input.signal,
                PID: process.pid,
            }),
        });
    },

    healthDegraded(input: {
        component: string;
        status?: string;
        detail?: unknown;
        envOnly?: boolean;
    }) {
        return notifySafely({
            event: 'health_degraded',
            dedupKey: `${input.component}:${input.status || 'degraded'}`,
            envOnly: input.envOnly,
            text: formatEvent('Health degraded', {
                Component: input.component,
                Status: input.status || 'degraded',
                Detail: input.detail,
                Host: os.hostname(),
            }),
        });
    },

    healthRecovered(input: { component: string }) {
        return notifySafely({
            event: 'health_recovered',
            dedupKey: input.component,
            dedupWindowMs: 60_000,
            text: formatEvent('Health recovered', {
                Component: input.component,
                Host: os.hostname(),
            }),
        });
    },

    campaignCompleted(input: {
        campaignId: string;
        workspaceId: string;
        sent: number;
        failed: number;
        total: number;
    }) {
        return notifySafely({
            event: 'campaign_completed',
            dedupKey: input.campaignId,
            dedupWindowMs: 24 * 60 * 60_000,
            text: formatEvent('Campaign completed', {
                Campaign: input.campaignId,
                Workspace: input.workspaceId,
                Sent: input.sent,
                Failed: input.failed,
                Total: input.total,
            }),
        });
    },

    campaignFailed(input: { campaignId: string; workspaceId: string; error?: unknown }) {
        return notifySafely({
            event: 'campaign_failed',
            dedupKey: input.campaignId,
            text: formatEvent('Campaign failed', {
                Campaign: input.campaignId,
                Workspace: input.workspaceId,
                Error: input.error instanceof Error ? input.error.message : input.error,
            }),
        });
    },

    smtpFailure(input: {
        operation: string;
        code: string;
        phase: string;
        retryable: boolean;
    }) {
        return notifySafely({
            event: 'smtp_failure',
            dedupKey: `${input.operation}:${input.code}:${input.phase}`,
            text: formatEvent('SMTP failure', {
                Operation: input.operation,
                Code: input.code,
                Phase: input.phase,
                Retryable: input.retryable,
                Host: os.hostname(),
            }),
        });
    },

    async newUser(input: { name: string; email: string }): Promise<OperationalNotificationOutcome> {
        return notifySafely({
            event: 'new_user',
            dedupKey: input.email,
            toggleKeys: [
                SETTINGS_KEYS.TELEGRAM_NOTIFY_NEW_WORKSPACE,
                SETTINGS_KEYS.TELEGRAM_NOTIFY_NEW_USER,
            ],
            toggleEnv: 'TELEGRAM_NOTIFY_NEW_WORKSPACE',
            text: formatEvent('New account', {
                Name: input.name,
                Email: input.email,
            }),
        });
    },

    async paymentReceived(input: {
        invoiceNumber: string;
        workspaceId: string;
        planId: string;
        amount: number;
        currency?: string;
    }): Promise<OperationalNotificationOutcome> {
        return notifySafely({
            event: 'payment_received',
            dedupKey: input.invoiceNumber,
            toggleKeys: [SETTINGS_KEYS.TELEGRAM_NOTIFY_PAYMENT],
            toggleEnv: 'TELEGRAM_NOTIFY_PAYMENT',
            text: formatEvent('Payment received', {
                Invoice: input.invoiceNumber,
                Plan: input.planId,
                Amount: formatMoney(input.amount, input.currency),
                Workspace: input.workspaceId,
            }),
        });
    },
};
