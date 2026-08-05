export type ZaloThreadType = 'user' | 'group';

export interface ZaloConversationIdentity {
    accountId?: string;
    threadId: string;
    threadType: ZaloThreadType;
    legacyVisitorId: string;
    scopedVisitorId?: string;
    preferredVisitorId: string;
}

export type ZaloSendAccountResolution =
    | { accountId: string }
    | { error: 'ACCOUNT_NOT_IN_WORKSPACE' | 'ACCOUNT_OFFLINE' | 'NO_CONNECTED_ACCOUNT' | 'AMBIGUOUS_ACCOUNT' };

function optionalString(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    const normalized = value.trim();
    return normalized || undefined;
}

/**
 * New Zalo visitor ids include the owning personal account and thread type.
 * The legacy id is retained as a lookup candidate so existing single-account
 * conversations keep their history instead of being duplicated.
 */
export function buildZaloConversationIdentity(
    threadId: string,
    accountId: string | undefined,
    threadType: ZaloThreadType,
): ZaloConversationIdentity {
    const normalizedAccountId = optionalString(accountId);
    const legacyVisitorId = `zalo_${threadId}`;
    const scopedVisitorId = normalizedAccountId
        ? `zalo_v2:${encodeURIComponent(normalizedAccountId)}:${threadType}:${encodeURIComponent(threadId)}`
        : undefined;

    return {
        accountId: normalizedAccountId,
        threadId,
        threadType,
        legacyVisitorId,
        scopedVisitorId,
        preferredVisitorId: scopedVisitorId || legacyVisitorId,
    };
}

/**
 * A legacy row is safe to adopt only when its routing metadata is unclaimed or
 * points at the same account. A known conflicting thread type is rejected too.
 */
export function isCompatibleLegacyZaloConversation(
    metadata: unknown,
    identity: Pick<ZaloConversationIdentity, 'accountId' | 'threadType'>,
): boolean {
    const record = metadata && typeof metadata === 'object' && !Array.isArray(metadata)
        ? metadata as Record<string, unknown>
        : {};
    const existingAccountId = optionalString(record.accountId);
    const existingThreadType = record.threadType === 'group' || record.threadType === 'user'
        ? record.threadType
        : undefined;

    // If the row is already owned, an event without an account cannot prove it
    // belongs there; events from a different account must never be merged.
    if (existingAccountId && existingAccountId !== identity.accountId) return false;
    if (existingThreadType && existingThreadType !== identity.threadType) return false;
    return true;
}

/** Selects a send session without ever crossing away from an explicit account. */
export function resolveZaloSendAccount(
    workspaceAccountIds: string[],
    connectedAccountIds: string[],
    requestedAccountId?: string,
): ZaloSendAccountResolution {
    const requested = optionalString(requestedAccountId);
    const workspaceIds = new Set(workspaceAccountIds);
    const connected = [...new Set(connectedAccountIds.filter(id => workspaceIds.has(id)))];

    if (requested) {
        if (!workspaceIds.has(requested)) return { error: 'ACCOUNT_NOT_IN_WORKSPACE' };
        if (!connected.includes(requested)) return { error: 'ACCOUNT_OFFLINE' };
        return { accountId: requested };
    }

    if (connected.length === 0) return { error: 'NO_CONNECTED_ACCOUNT' };
    if (connected.length > 1) return { error: 'AMBIGUOUS_ACCOUNT' };
    return { accountId: connected[0] };
}
