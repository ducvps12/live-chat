export type AnalyticsPeriod = 'today' | '7d' | '30d' | '90d';

export type MetricComparison = {
    current: number | null;
    previous: number | null;
    changePercent: number | null;
    direction: 'up' | 'down' | 'flat';
};

export type AnalyticsBucket = {
    key: string;
    bucketStart: string;
    label: string;
    conversations: number;
    visitors: number;
    newVisitors: number;
    messages: number;
    resolved: number;
};

export type AnalyticsChannel = {
    channel: string;
    conversations: number;
    messages: number;
    resolved: number;
    responseRate: number | null;
    avgFirstResponseSeconds: number | null;
    percent: number;
};

export type AnalyticsAgentPerformance = {
    agentId: string;
    name: string;
    email: string;
    avatarUrl: string | null;
    role: string;
    isActive: boolean;
    assigned: number;
    resolved: number;
    resolutionRate: number | null;
    sentMessages: number;
    firstResponses: number;
    avgFirstResponseSeconds: number | null;
};

export type AnalyticsAttentionConversation = {
    id: string;
    visitorId: string;
    visitorName: string;
    channel: string;
    status: string;
    priority: string;
    slaDeadline: string | null;
    slaState: 'breached' | 'at_risk' | 'on_track' | 'none';
    assignedTo: { id: string; name: string; avatarUrl?: string | null } | null;
    tags: string[];
    lastMessageAt: string;
    lastMessageSnippet: string;
    lastSenderType: string | null;
    unreadCount: number;
    waitingSeconds: number | null;
    ageSeconds: number;
};

export type AnalyticsReport = {
    generatedAt: string;
    liveWindowMinutes: number;
    period: {
        key: AnalyticsPeriod;
        start: string;
        end: string;
        previousStart?: string;
        previousEnd?: string;
        timezone: string;
        granularity: 'hour' | 'day';
    };
    kpis: {
        conversations: number;
        newVisitors: number;
        messages: number;
        open: number;
        resolved: number;
        totalResolved: number;
        activeVisitors: number;
        responseRate: number | null;
        avgFirstResponseSeconds: number | null;
        resolutionRate?: number | null;
        leads?: number;
        orders?: number;
        orderValue?: number;
        leadToOrderRate?: number | null;
        slaBreached?: number;
        slaAtRisk?: number;
        unassignedOpen?: number;
        unreadOpen?: number;
    };
    comparison?: Record<string, MetricComparison>;
    timeSeries: AnalyticsBucket[];
    channels: AnalyticsChannel[];
    leadFunnel?: {
        total: number;
        stages: Array<{ stage: string; count: number; percent: number }>;
        sources: Array<{ source: string; count: number; percent: number }>;
    };
    orderFunnel?: {
        total: number;
        orderValue: number;
        statuses: Array<{ status: string; count: number; percent: number }>;
    };
    operations?: {
        slaBreached: number;
        slaAtRisk: number;
        unassignedOpen: number;
        unreadOpen: number;
        attentionConversations: AnalyticsAttentionConversation[];
    };
    agentPerformance?: AnalyticsAgentPerformance[];
    tags?: Array<{ tag: string; conversations: number; percent: number }>;
    sentiment?: {
        analyzed: number;
        totalEntities: number;
        coverage: number;
        groups: Array<{ key: string; label: string; count: number; percent: number }>;
    };
    geography: Array<{ country: string; visitors: number; percent: number }>;
    sources: Array<{ source: string; visitors: number; percent: number }>;
    responseTimeBuckets: Array<{
        key: string;
        label: string;
        minSeconds: number;
        maxSeconds: number | null;
        count: number;
        percent: number;
    }>;
    definitions?: Record<string, string>;
};
