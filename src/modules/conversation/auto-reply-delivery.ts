export type ExternalAutoReplyChannel = 'facebook' | 'messenger' | 'zalo';

export interface DurableAutoReplyPlan {
    version: 1;
    targetMessageId: string;
    botId: string;
    botName: string;
    agentCondition: string;
    source: string;
    handoffRequested: boolean;
    parts: string[];
    interMessageDelayMs: number;
    nextPartIndex: number;
}

export function isExternalAutoReplyChannel(channel: unknown): channel is ExternalAutoReplyChannel {
    const value = String(channel || '').toLowerCase();
    return value === 'facebook' || value === 'messenger' || value === 'zalo';
}

export function autoReplyPartClientMessageId(targetMessageId: string, partIndex: number): string {
    const base = `ai-auto-reply:${targetMessageId}`;
    return partIndex === 0 ? base : `${base}:${partIndex + 1}`;
}

export function createDurableAutoReplyPlan(input: Omit<DurableAutoReplyPlan, 'version' | 'nextPartIndex'>): DurableAutoReplyPlan {
    return {
        ...input,
        version: 1,
        parts: input.parts.map(part => part.trim()).filter(Boolean),
        nextPartIndex: 0,
    };
}

export function readDurableAutoReplyPlan(metadata: unknown): DurableAutoReplyPlan | null {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
    const raw = (metadata as Record<string, unknown>).autoReplyDelivery;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const value = raw as Record<string, unknown>;
    const parts = Array.isArray(value.parts)
        ? value.parts.filter((part): part is string => typeof part === 'string' && part.trim().length > 0).map(part => part.trim())
        : [];
    const nextPartIndex = typeof value.nextPartIndex === 'number' ? value.nextPartIndex : -1;
    if (
        value.version !== 1
        || typeof value.targetMessageId !== 'string' || !value.targetMessageId
        || typeof value.botId !== 'string' || !value.botId
        || typeof value.botName !== 'string' || !value.botName
        || typeof value.agentCondition !== 'string'
        || typeof value.source !== 'string'
        || typeof value.handoffRequested !== 'boolean'
        || typeof value.interMessageDelayMs !== 'number'
        || !Number.isFinite(value.interMessageDelayMs)
        || parts.length === 0
        || !Number.isInteger(nextPartIndex)
        || nextPartIndex < 0
        || nextPartIndex > parts.length
    ) return null;
    return {
        version: 1,
        targetMessageId: value.targetMessageId,
        botId: value.botId,
        botName: value.botName,
        agentCondition: value.agentCondition,
        source: value.source,
        handoffRequested: value.handoffRequested,
        parts,
        interMessageDelayMs: Math.max(0, Math.min(2500, Math.round(value.interMessageDelayMs))),
        nextPartIndex,
    };
}

export function withDurableAutoReplyPlan(metadata: unknown, plan: DurableAutoReplyPlan | null): Record<string, unknown> {
    const base = metadata && typeof metadata === 'object' && !Array.isArray(metadata)
        ? { ...(metadata as Record<string, unknown>) }
        : {};
    if (plan) base.autoReplyDelivery = plan;
    else delete base.autoReplyDelivery;
    return base;
}

export async function attemptExternalAutoReplyDelivery(input: {
    channel: unknown;
    messageStatus: string | null | undefined;
    isCurrent: () => Promise<boolean>;
    send: () => Promise<void>;
    markStatus: (status: 'delivered' | 'error') => Promise<void>;
}): Promise<'not_required' | 'already_delivered' | 'stale' | 'delivered' | 'retry'> {
    if (!isExternalAutoReplyChannel(input.channel)) return 'not_required';
    if (input.messageStatus === 'delivered' || input.messageStatus === 'read') return 'already_delivered';
    if (!(await input.isCurrent())) return 'stale';
    try {
        await input.send();
        await input.markStatus('delivered');
        return 'delivered';
    } catch {
        await input.markStatus('error');
        return 'retry';
    }
}
