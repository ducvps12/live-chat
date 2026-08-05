export const AUTO_REPLY_DELIVERY_DELAY_MAX_MS = 12_000;
export const AUTO_REPLY_DELIVERY_POLL_MS = 75;

export function normalizeAutoReplyDeliveryDelayMs(value: unknown): number {
    const delayMs = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(delayMs)) return 0;
    return Math.min(
        AUTO_REPLY_DELIVERY_DELAY_MAX_MS,
        Math.max(0, Math.round(delayMs)),
    );
}

/**
 * Wait in small, bounded slices so a newer visitor turn or human takeover can
 * cancel a pending reply without leaving a stale typing indicator on screen.
 * The sleeper is injectable to keep the lifecycle deterministic in smoke tests.
 */
export async function waitForAutoReplyDelivery(
    delayMs: unknown,
    isCurrent: () => boolean,
    sleep: (ms: number) => Promise<void> = ms => (
        new Promise(resolve => setTimeout(resolve, ms))
    ),
): Promise<boolean> {
    let remainingMs = normalizeAutoReplyDeliveryDelayMs(delayMs);
    while (remainingMs > 0) {
        if (!isCurrent()) return false;
        const sliceMs = Math.min(AUTO_REPLY_DELIVERY_POLL_MS, remainingMs);
        await sleep(sliceMs);
        remainingMs -= sliceMs;
    }
    return isCurrent();
}

function safeInlineText(value: unknown, fallback: string, maxLength: number): string {
    if (typeof value !== 'string') return fallback;
    const cleaned = value
        .replace(/[\u0000-\u001f\u007f]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, maxLength);
    return cleaned || fallback;
}

export interface AutoReplyTypingActor {
    senderId?: string;
    senderName?: string;
    label?: string;
}

export function buildAutoReplyTypingPayload(
    conversationId: string,
    targetMessageId: string,
    state: 'start' | 'stop',
    actor: AutoReplyTypingActor = {},
) {
    return {
        conversationId,
        typingId: `auto-reply:${targetMessageId}`,
        state,
        source: 'auto-reply',
        label: safeInlineText(actor.label, 'Đang phản hồi…', 40),
        sender: {
            type: 'agent' as const,
            id: safeInlineText(actor.senderId, 'auto-reply', 100),
            name: safeInlineText(actor.senderName, 'Hỗ trợ khách hàng', 80),
        },
        timestamp: new Date().toISOString(),
    };
}
