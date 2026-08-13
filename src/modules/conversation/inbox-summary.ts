export interface InboxSummaryCandidate {
    id: string;
    status: string | null;
}

export interface InboxSummary {
    total: number;
    unread: number;
    open: number;
}

export function summarizeInboxCandidates(
    candidates: InboxSummaryCandidate[],
    unreadByConversationId: ReadonlyMap<string, number>
): InboxSummary {
    return candidates.reduce<InboxSummary>(
        (summary, conversation) => {
            summary.total += 1;
            summary.unread += Math.max(0, unreadByConversationId.get(conversation.id) || 0);
            if (conversation.status === 'open') summary.open += 1;
            return summary;
        },
        { total: 0, unread: 0, open: 0 }
    );
}
