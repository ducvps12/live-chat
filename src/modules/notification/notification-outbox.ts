import crypto from 'node:crypto';
import prisma from '../../infra/prisma';

export const NOTIFICATION_OUTBOX_PREFIX = 'notification_outbox:';

export type NotificationOutboxStatus = 'pending' | 'sent';

export interface NotificationOutboxRecord {
    id: string;
    event: string;
    dedupKey: string;
    text: string;
    envOnly: boolean;
    status: NotificationOutboxStatus;
    attempts: number;
    createdAt: string;
    nextAttemptAt: string;
    sentAt?: string;
    lastErrorCode?: string;
}

export interface NotificationOutboxStore {
    get(id: string): Promise<NotificationOutboxRecord | null>;
    create(record: NotificationOutboxRecord): Promise<NotificationOutboxRecord>;
    save(record: NotificationOutboxRecord): Promise<void>;
    listDue(now: Date, limit: number): Promise<NotificationOutboxRecord[]>;
}

export interface NotificationOutboxSender {
    send(record: NotificationOutboxRecord): Promise<{
        sent: boolean;
        reason?: 'disabled' | 'not_configured';
    }>;
}

function keyFor(id: string): string {
    return `${NOTIFICATION_OUTBOX_PREFIX}${id}`;
}

function parseRecord(value: string): NotificationOutboxRecord | null {
    try {
        const parsed = JSON.parse(value) as NotificationOutboxRecord;
        if (!parsed?.id || !parsed.event || !parsed.dedupKey || !parsed.status) return null;
        return parsed;
    } catch {
        return null;
    }
}

export const prismaNotificationOutboxStore: NotificationOutboxStore = {
    async get(id) {
        const row = await prisma.systemSetting.findUnique({ where: { key: keyFor(id) } });
        return row ? parseRecord(row.value) : null;
    },

    async create(record) {
        try {
            await prisma.systemSetting.create({
                data: { key: keyFor(record.id), value: JSON.stringify(record) },
            });
            return record;
        } catch {
            // A concurrent process may have created the same idempotency bucket.
            const existing = await this.get(record.id);
            if (existing) return existing;
            throw new Error('NOTIFICATION_OUTBOX_CREATE_FAILED');
        }
    },

    async save(record) {
        await prisma.systemSetting.upsert({
            where: { key: keyFor(record.id) },
            update: { value: JSON.stringify(record) },
            create: { key: keyFor(record.id), value: JSON.stringify(record) },
        });
    },

    async listDue(now, limit) {
        const rows = await prisma.systemSetting.findMany({
            where: { key: { startsWith: NOTIFICATION_OUTBOX_PREFIX } },
            orderBy: { updatedAt: 'asc' },
        });
        return rows
            .map(row => parseRecord(row.value))
            .filter((record): record is NotificationOutboxRecord => Boolean(
                record
                && record.status === 'pending'
                && new Date(record.nextAttemptAt).getTime() <= now.getTime(),
            ))
            .slice(0, limit);
    },
};

function retryDelayMs(attempts: number): number {
    return Math.min(15 * 60_000, 5_000 * (2 ** Math.max(0, attempts - 1)));
}

export class NotificationOutboxDispatcher {
    constructor(
        private readonly store: NotificationOutboxStore,
        private readonly sender: NotificationOutboxSender,
        private readonly now: () => Date = () => new Date(),
    ) {}

    async enqueue(input: {
        event: string;
        dedupKey: string;
        text: string;
        envOnly?: boolean;
        dedupWindowMs: number;
    }): Promise<NotificationOutboxRecord> {
        const now = this.now();
        const bucket = Math.floor(now.getTime() / input.dedupWindowMs);
        const id = crypto
            .createHash('sha256')
            .update(`${input.event}:${input.dedupKey}:${bucket}`)
            .digest('base64url');
        const existing = await this.store.get(id);
        if (existing) return existing;
        return this.store.create({
            id,
            event: input.event,
            dedupKey: input.dedupKey,
            text: input.text,
            envOnly: Boolean(input.envOnly),
            status: 'pending',
            attempts: 0,
            createdAt: now.toISOString(),
            nextAttemptAt: now.toISOString(),
        });
    }

    async dispatch(record: NotificationOutboxRecord): Promise<NotificationOutboxRecord> {
        if (record.status === 'sent') return record;
        const now = this.now();
        try {
            const result = await this.sender.send(record);
            if (result.sent) {
                const sent = { ...record, status: 'sent' as const, sentAt: now.toISOString() };
                await this.store.save(sent);
                return sent;
            }
            const attempts = record.attempts + 1;
            const pending = {
                ...record,
                attempts,
                lastErrorCode: result.reason || 'NOT_SENT',
                nextAttemptAt: new Date(now.getTime() + retryDelayMs(attempts)).toISOString(),
            };
            await this.store.save(pending);
            return pending;
        } catch (error) {
            const attempts = record.attempts + 1;
            const pending = {
                ...record,
                attempts,
                lastErrorCode: error instanceof Error ? error.name : 'SEND_FAILED',
                nextAttemptAt: new Date(now.getTime() + retryDelayMs(attempts)).toISOString(),
            };
            await this.store.save(pending);
            return pending;
        }
    }

    async flushDue(limit = 20): Promise<{ sent: number; pending: number }> {
        const due = await this.store.listDue(this.now(), limit);
        let sent = 0;
        let pending = 0;
        for (const record of due) {
            const result = await this.dispatch(record);
            if (result.status === 'sent') sent += 1;
            else pending += 1;
        }
        return { sent, pending };
    }
}
