import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezonePlugin from 'dayjs/plugin/timezone';
import prisma from '../../infra/prisma';
import { AppError } from '../../middlewares/errorHandler';
import { workspaceRepo } from './repos/workspace.repo';

dayjs.extend(utc);
dayjs.extend(timezonePlugin);

export const ANALYTICS_PERIODS = ['today', '7d', '30d', '90d'] as const;
export type AnalyticsPeriod = (typeof ANALYTICS_PERIODS)[number];

const LIVE_WINDOW_MINUTES = 5;
const RECENT_VISITOR_LIMIT = 30;
const ATTENTION_CONVERSATION_LIMIT = 12;
const SLA_AT_RISK_MINUTES = 30;

type JsonRecord = Record<string, unknown>;

export type AnalyticsMessageEvent = {
    conversationId: string;
    senderType: string;
    senderId?: string;
    createdAt: Date;
};

type FirstResponse = {
    conversationId: string;
    seconds: number;
    agentId?: string;
};

type MetricComparison = {
    current: number | null;
    previous: number | null;
    changePercent: number | null;
    direction: 'up' | 'down' | 'flat';
};

type AnalyticsBucket = {
    key: string;
    bucketStart: string;
    label: string;
    conversations: number;
    visitors: number;
    newVisitors: number;
    messages: number;
    resolved: number;
};

const asRecord = (value: unknown): JsonRecord => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return value as JsonRecord;
};

const firstString = (records: JsonRecord[], keys: string[]): string | null => {
    const nestedKeys = ['location', 'geo', 'utm', 'device', 'session', 'page'];
    for (const record of records) {
        for (const key of keys) {
            const value = record[key];
            if (typeof value === 'string' && value.trim()) return value.trim();
        }
        for (const nestedKey of nestedKeys) {
            const nested = asRecord(record[nestedKey]);
            for (const key of keys) {
                const value = nested[key];
                if (typeof value === 'string' && value.trim()) return value.trim();
            }
        }
    }
    return null;
};

const deriveDomain = (pageUrl: string | null, explicitDomain: string | null): string | null => {
    if (explicitDomain) return explicitDomain;
    if (!pageUrl) return null;
    try {
        return new URL(pageUrl).hostname || null;
    } catch {
        return null;
    }
};

const normalizeChannel = (channel: string | null | undefined): string => {
    const normalized = String(channel || 'unknown').trim().toLowerCase();
    if (['widget', 'web', 'website', 'webchat'].includes(normalized)) return 'website';
    if (['fb', 'facebook', 'messenger'].includes(normalized)) return 'facebook';
    if (normalized.startsWith('zalo')) return 'zalo';
    return normalized || 'unknown';
};

const safeTimezone = (timezoneName: unknown): string => {
    const candidate = typeof timezoneName === 'string' && timezoneName.trim()
        ? timezoneName.trim()
        : 'Asia/Ho_Chi_Minh';
    try {
        dayjs().tz(candidate).format();
        return candidate;
    } catch {
        return 'Asia/Ho_Chi_Minh';
    }
};

export function normalizeAnalyticsPeriod(value: unknown): AnalyticsPeriod {
    const period = String(value || '7d') as AnalyticsPeriod;
    if (!ANALYTICS_PERIODS.includes(period)) {
        throw new AppError('Khoảng thời gian analytics không hợp lệ', 400, 'INVALID_ANALYTICS_PERIOD');
    }
    return period;
}

export function resolveAnalyticsRange(
    period: AnalyticsPeriod,
    timezoneName: string,
    now: Date = new Date(),
) {
    const localNow = dayjs(now).tz(timezoneName);
    const daysBack = period === '7d' ? 6 : period === '30d' ? 29 : 89;
    const start = period === 'today'
        ? localNow.startOf('day')
        : localNow.subtract(daysBack, 'day').startOf('day');

    return {
        start: start.toDate(),
        end: now,
        granularity: period === 'today' ? 'hour' as const : 'day' as const,
    };
}

const bucketKey = (value: Date, timezoneName: string, granularity: 'hour' | 'day') => {
    const local = dayjs(value).tz(timezoneName);
    return granularity === 'hour'
        ? local.format('YYYY-MM-DD HH')
        : local.format('YYYY-MM-DD');
};

export function createAnalyticsBuckets(
    start: Date,
    end: Date,
    timezoneName: string,
    granularity: 'hour' | 'day',
): AnalyticsBucket[] {
    const result: AnalyticsBucket[] = [];
    let cursor = dayjs(start).tz(timezoneName).startOf(granularity);
    const last = dayjs(end).tz(timezoneName).startOf(granularity);

    while (cursor.valueOf() <= last.valueOf()) {
        result.push({
            key: granularity === 'hour' ? cursor.format('YYYY-MM-DD HH') : cursor.format('YYYY-MM-DD'),
            bucketStart: cursor.toISOString(),
            label: granularity === 'hour' ? cursor.format('HH:mm') : cursor.format('DD/MM'),
            conversations: 0,
            visitors: 0,
            newVisitors: 0,
            messages: 0,
            resolved: 0,
        });
        cursor = cursor.add(1, granularity);
    }

    return result;
}

export function calculateFirstResponses(
    messages: AnalyticsMessageEvent[],
    conversationIds: Set<string>,
): FirstResponse[] {
    const ordered = [...messages].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const firstVisitorAt = new Map<string, Date>();
    const firstResponses = new Map<string, FirstResponse>();

    for (const message of ordered) {
        if (!conversationIds.has(message.conversationId) || firstResponses.has(message.conversationId)) continue;

        if (message.senderType === 'visitor' && !firstVisitorAt.has(message.conversationId)) {
            firstVisitorAt.set(message.conversationId, message.createdAt);
            continue;
        }

        if (message.senderType === 'agent') {
            const visitorAt = firstVisitorAt.get(message.conversationId);
            if (visitorAt && message.createdAt.getTime() >= visitorAt.getTime()) {
                const response: FirstResponse = {
                    conversationId: message.conversationId,
                    seconds: Math.max(0, Math.round((message.createdAt.getTime() - visitorAt.getTime()) / 1000)),
                };
                if (message.senderId) response.agentId = message.senderId;
                firstResponses.set(message.conversationId, response);
            }
        }
    }

    return [...firstResponses.values()];
}

const buildResponseTimeBuckets = (responses: FirstResponse[]) => {
    const definitions = [
        { key: 'under_1m', label: '< 1 phút', minSeconds: 0, maxSeconds: 60 },
        { key: '1m_5m', label: '1–5 phút', minSeconds: 60, maxSeconds: 300 },
        { key: '5m_15m', label: '5–15 phút', minSeconds: 300, maxSeconds: 900 },
        { key: '15m_1h', label: '15–60 phút', minSeconds: 900, maxSeconds: 3600 },
        { key: 'over_1h', label: '> 1 giờ', minSeconds: 3600, maxSeconds: null },
    ];

    return definitions.map((definition) => {
        const count = responses.filter(({ seconds }) => (
            seconds >= definition.minSeconds
            && (definition.maxSeconds === null || seconds < definition.maxSeconds)
        )).length;
        return {
            ...definition,
            count,
            percent: responses.length ? Math.round((count / responses.length) * 1000) / 10 : 0,
        };
    });
};

const countGroups = (values: Array<string | null>, fallback = 'unknown') => {
    const counts = new Map<string, number>();
    for (const raw of values) {
        const value = raw?.trim() || fallback;
        counts.set(value, (counts.get(value) || 0) + 1);
    }
    const total = values.length;
    return [...counts.entries()]
        .map(([key, count]) => ({
            key,
            count,
            percent: total ? Math.round((count / total) * 1000) / 10 : 0,
        }))
        .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
};

const asStringList = (value: unknown): string[] => {
    if (!Array.isArray(value)) return [];
    return value
        .filter((item): item is string => typeof item === 'string')
        .map(item => item.trim())
        .filter(Boolean);
};

const average = (values: number[]): number | null => (
    values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null
);

const percent = (value: number, total: number): number | null => (
    total ? Math.round((value / total) * 1000) / 10 : null
);

const compareMetric = (current: number | null, previous: number | null): MetricComparison => {
    const currentValue = current ?? 0;
    const previousValue = previous ?? 0;
    const direction = currentValue === previousValue ? 'flat' : currentValue > previousValue ? 'up' : 'down';
    const changePercent = previousValue === 0
        ? (currentValue === 0 ? 0 : null)
        : Math.round(((currentValue - previousValue) / Math.abs(previousValue)) * 1000) / 10;

    return { current, previous, changePercent, direction };
};

const resolvePreviousRange = (start: Date, end: Date) => {
    const durationMs = Math.max(1, end.getTime() - start.getTime());
    const previousEnd = new Date(start.getTime() - 1);
    return {
        start: new Date(previousEnd.getTime() - durationMs),
        end: previousEnd,
    };
};

const sentimentKeyFromTags = (tags: string[]): 'positive' | 'neutral' | 'negative' | null => {
    for (const tag of tags) {
        const normalized = tag
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[\s-]+/g, '_');
        if (!normalized.includes('sentiment') && !normalized.includes('cam_xuc')) continue;
        if (normalized.includes('tich_cuc') || normalized.includes('positive')) return 'positive';
        if (normalized.includes('tieu_cuc') || normalized.includes('negative')) return 'negative';
        if (normalized.includes('trung_tinh') || normalized.includes('neutral')) return 'neutral';
    }
    return null;
};

export const workspaceAnalyticsService = {
    async getAnalytics(workspaceId: string, periodInput: unknown) {
        const period = normalizeAnalyticsPeriod(periodInput);
        const workspace = await workspaceRepo.findById(workspaceId);
        if (!workspace || !workspace.isActive) {
            throw new AppError('Workspace không tồn tại', 404, 'NOT_FOUND');
        }

        const settings = asRecord(workspace.settings);
        const timezoneName = safeTimezone(settings.timezone);
        const now = new Date();
        const { start, end, granularity } = resolveAnalyticsRange(period, timezoneName, now);
        const previousRange = resolvePreviousRange(start, end);
        const liveSince = new Date(now.getTime() - LIVE_WINDOW_MINUTES * 60_000);
        const slaAtRiskDeadline = new Date(now.getTime() + SLA_AT_RISK_MINUTES * 60_000);
        const activeStatuses = ['open', 'pending'];

        const [
            periodConversations,
            previousConversations,
            currentStatusGroups,
            periodMessages,
            previousMessages,
            newVisitorRecords,
            previousNewVisitorRecords,
            seenVisitorRecords,
            activeVisitorRecords,
            recentVisitorRecords,
            periodLeads,
            previousLeads,
            periodOrders,
            previousOrders,
            workspaceMembers,
            attentionConversationRecords,
            slaBreached,
            slaAtRisk,
            unassignedOpen,
            unreadOpen,
        ] = await Promise.all([
            prisma.conversation.findMany({
                where: { workspaceId, createdAt: { gte: start, lte: end } },
                select: {
                    id: true,
                    visitorId: true,
                    widgetId: true,
                    channel: true,
                    status: true,
                    priority: true,
                    slaDeadline: true,
                    assignedTo: true,
                    tags: true,
                    createdAt: true,
                },
            }),
            prisma.conversation.findMany({
                where: { workspaceId, createdAt: { gte: previousRange.start, lte: previousRange.end } },
                select: {
                    id: true,
                    visitorId: true,
                    channel: true,
                    status: true,
                    assignedTo: true,
                    createdAt: true,
                },
            }),
            prisma.conversation.groupBy({
                by: ['status'],
                where: { workspaceId },
                _count: true,
            }),
            prisma.message.findMany({
                where: {
                    conversation: { workspaceId },
                    createdAt: { gte: start, lte: end },
                    isDeleted: false,
                    isInternal: false,
                    senderType: { in: ['visitor', 'agent'] },
                },
                select: { conversationId: true, senderType: true, senderId: true, createdAt: true },
                orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
            }),
            prisma.message.findMany({
                where: {
                    conversation: { workspaceId },
                    createdAt: { gte: previousRange.start, lte: previousRange.end },
                    isDeleted: false,
                    isInternal: false,
                    senderType: { in: ['visitor', 'agent'] },
                },
                select: { conversationId: true, senderType: true, senderId: true, createdAt: true },
                orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
            }),
            prisma.visitor.findMany({
                where: { workspaceId, firstSeenAt: { gte: start, lte: end } },
                select: { visitorId: true, firstSeenAt: true },
                orderBy: { firstSeenAt: 'asc' },
            }),
            prisma.visitor.findMany({
                where: { workspaceId, firstSeenAt: { gte: previousRange.start, lte: previousRange.end } },
                select: { visitorId: true },
                distinct: ['visitorId'],
            }),
            prisma.visitor.findMany({
                where: { workspaceId, lastSeenAt: { gte: start, lte: end } },
                select: { visitorId: true, lastSeenAt: true, attributes: true },
                orderBy: { lastSeenAt: 'desc' },
            }),
            prisma.visitor.findMany({
                where: { workspaceId, lastSeenAt: { gte: liveSince, lte: end } },
                select: { visitorId: true },
                distinct: ['visitorId'],
            }),
            prisma.visitor.findMany({
                where: { workspaceId },
                orderBy: { lastSeenAt: 'desc' },
                take: RECENT_VISITOR_LIMIT * 4,
            }),
            prisma.lead.findMany({
                where: { workspaceId, createdAt: { gte: start, lte: end } },
                select: { id: true, stage: true, source: true, tags: true, assignedTo: true, createdAt: true },
            }),
            prisma.lead.findMany({
                where: { workspaceId, createdAt: { gte: previousRange.start, lte: previousRange.end } },
                select: { id: true, stage: true, source: true, createdAt: true },
            }),
            prisma.order.findMany({
                where: { workspaceId, createdAt: { gte: start, lte: end } },
                select: { id: true, status: true, total: true, processedById: true, createdAt: true },
            }),
            prisma.order.findMany({
                where: { workspaceId, createdAt: { gte: previousRange.start, lte: previousRange.end } },
                select: { id: true, status: true, total: true, createdAt: true },
            }),
            prisma.workspaceMember.findMany({
                where: { workspaceId },
                select: {
                    role: true,
                    user: { select: { id: true, name: true, email: true, avatarUrl: true, isActive: true } },
                },
            }),
            prisma.conversation.findMany({
                where: { workspaceId, status: { in: activeStatuses } },
                select: {
                    id: true,
                    visitorId: true,
                    visitorInfo: true,
                    channel: true,
                    status: true,
                    priority: true,
                    slaDeadline: true,
                    assignedTo: true,
                    tags: true,
                    lastMessageAt: true,
                    lastMessageSnippet: true,
                    lastSenderType: true,
                    lastSenderName: true,
                    unreadCount: true,
                    createdAt: true,
                },
                orderBy: [{ slaDeadline: 'asc' }, { lastMessageAt: 'asc' }],
                take: 100,
            }),
            prisma.conversation.count({
                where: { workspaceId, status: { in: activeStatuses }, slaDeadline: { lt: now } },
            }),
            prisma.conversation.count({
                where: {
                    workspaceId,
                    status: { in: activeStatuses },
                    slaDeadline: { gte: now, lte: slaAtRiskDeadline },
                },
            }),
            prisma.conversation.count({
                where: {
                    workspaceId,
                    status: { in: activeStatuses },
                    OR: [{ assignedTo: null }, { assignedTo: '' }],
                },
            }),
            prisma.conversation.count({
                where: { workspaceId, status: { in: activeStatuses }, unreadCount: { gt: 0 } },
            }),
        ]);

        const uniqueRecentVisitors = recentVisitorRecords
            .filter((visitor, index, records) => records.findIndex(item => item.visitorId === visitor.visitorId) === index)
            .slice(0, RECENT_VISITOR_LIMIT);
        const recentVisitorIds = uniqueRecentVisitors.map(visitor => visitor.visitorId);
        const recentConversations = recentVisitorIds.length
            ? await prisma.conversation.findMany({
                where: { workspaceId, visitorId: { in: recentVisitorIds } },
                select: {
                    id: true,
                    visitorId: true,
                    widgetId: true,
                    visitorInfo: true,
                    status: true,
                    channel: true,
                    lastMessageAt: true,
                    metadata: true,
                },
                orderBy: { lastMessageAt: 'desc' },
                take: RECENT_VISITOR_LIMIT * 10,
            })
            : [];

        const latestConversationByVisitor = new Map<string, (typeof recentConversations)[number]>();
        const latestConversationByVisitorWidget = new Map<string, (typeof recentConversations)[number]>();
        for (const conversation of recentConversations) {
            const visitorWidgetKey = `${conversation.visitorId}::${conversation.widgetId}`;
            if (!latestConversationByVisitorWidget.has(visitorWidgetKey)) {
                latestConversationByVisitorWidget.set(visitorWidgetKey, conversation);
            }
            if (!latestConversationByVisitor.has(conversation.visitorId)) {
                latestConversationByVisitor.set(conversation.visitorId, conversation);
            }
        }

        const timeSeries = createAnalyticsBuckets(start, end, timezoneName, granularity);
        const timeSeriesMap = new Map(timeSeries.map(bucket => [bucket.key, bucket]));
        const resolvedStatuses = new Set(['closed', 'resolved']);

        for (const conversation of periodConversations) {
            const bucket = timeSeriesMap.get(bucketKey(conversation.createdAt, timezoneName, granularity));
            if (!bucket) continue;
            bucket.conversations += 1;
            if (resolvedStatuses.has(conversation.status)) bucket.resolved += 1;
        }

        const seenNewVisitors = new Set<string>();
        for (const visitor of newVisitorRecords) {
            if (seenNewVisitors.has(visitor.visitorId)) continue;
            seenNewVisitors.add(visitor.visitorId);
            const bucket = timeSeriesMap.get(bucketKey(visitor.firstSeenAt, timezoneName, granularity));
            if (!bucket) continue;
            bucket.visitors += 1;
            bucket.newVisitors += 1;
        }

        for (const message of periodMessages) {
            const bucket = timeSeriesMap.get(bucketKey(message.createdAt, timezoneName, granularity));
            if (bucket) bucket.messages += 1;
        }

        const periodConversationIds = new Set(periodConversations.map(conversation => conversation.id));
        const firstResponses = calculateFirstResponses(periodMessages, periodConversationIds);
        const conversationsWithVisitorMessage = new Set(
            periodMessages
                .filter(message => message.senderType === 'visitor' && periodConversationIds.has(message.conversationId))
                .map(message => message.conversationId),
        );
        const avgFirstResponseSeconds = average(firstResponses.map(item => item.seconds));
        const responseRate = percent(firstResponses.length, conversationsWithVisitorMessage.size);

        const previousConversationIds = new Set(previousConversations.map(conversation => conversation.id));
        const previousFirstResponses = calculateFirstResponses(previousMessages, previousConversationIds);
        const previousConversationsWithVisitorMessage = new Set(
            previousMessages
                .filter(message => message.senderType === 'visitor' && previousConversationIds.has(message.conversationId))
                .map(message => message.conversationId),
        );
        const previousAvgFirstResponseSeconds = average(previousFirstResponses.map(item => item.seconds));
        const previousResponseRate = percent(previousFirstResponses.length, previousConversationsWithVisitorMessage.size);

        const currentStatusMap = new Map(currentStatusGroups.map(item => [item.status, item._count]));
        const openNow = (currentStatusMap.get('open') || 0) + (currentStatusMap.get('pending') || 0);
        const totalResolved = (currentStatusMap.get('closed') || 0) + (currentStatusMap.get('resolved') || 0);
        const periodResolved = periodConversations.filter(item => resolvedStatuses.has(item.status)).length;
        const previousResolved = previousConversations.filter(item => resolvedStatuses.has(item.status)).length;
        const resolutionRate = percent(periodResolved, periodConversations.length);
        const previousResolutionRate = percent(previousResolved, previousConversations.length);

        const channelGroups = countGroups(periodConversations.map(item => normalizeChannel(item.channel)));
        const channels = channelGroups.map((item) => {
            const conversationIds = new Set(
                periodConversations
                    .filter(conversation => normalizeChannel(conversation.channel) === item.key)
                    .map(conversation => conversation.id),
            );
            const channelResponses = firstResponses.filter(response => conversationIds.has(response.conversationId));
            const channelVisitorConversations = new Set(
                periodMessages
                    .filter(message => message.senderType === 'visitor' && conversationIds.has(message.conversationId))
                    .map(message => message.conversationId),
            );
            return {
                channel: item.key,
                conversations: item.count,
                messages: periodMessages.filter(message => conversationIds.has(message.conversationId)).length,
                resolved: periodConversations.filter(conversation => (
                    conversationIds.has(conversation.id) && resolvedStatuses.has(conversation.status)
                )).length,
                responseRate: percent(channelResponses.length, channelVisitorConversations.size),
                avgFirstResponseSeconds: average(channelResponses.map(response => response.seconds)),
                percent: item.percent,
            };
        });

        const periodOrderValue = periodOrders
            .filter(order => !['cancelled', 'returned'].includes(order.status))
            .reduce((sum, order) => sum + Number(order.total || 0), 0);
        const previousOrderValue = previousOrders
            .filter(order => !['cancelled', 'returned'].includes(order.status))
            .reduce((sum, order) => sum + Number(order.total || 0), 0);
        const leadStages = countGroups(periodLeads.map(lead => lead.stage));
        const leadSources = countGroups(periodLeads.map(lead => normalizeChannel(lead.source)));
        const orderStatuses = countGroups(periodOrders.map(order => order.status));

        const conversationTags = periodConversations.flatMap(conversation => (
            [...new Set(asStringList(conversation.tags))]
                .filter(tag => sentimentKeyFromTags([tag]) === null)
        ));
        const tags = countGroups(conversationTags).slice(0, 12).map(item => ({
            tag: item.key,
            conversations: item.count,
            percent: percent(item.count, periodConversations.length) || 0,
        }));

        const sentimentEntities = [
            ...periodConversations.map(conversation => asStringList(conversation.tags)),
            ...periodLeads.map(lead => asStringList(lead.tags)),
        ];
        const sentimentValues = sentimentEntities
            .map(sentimentKeyFromTags)
            .filter((value): value is 'positive' | 'neutral' | 'negative' => value !== null);
        const sentimentGroups = countGroups(sentimentValues);
        const sentimentMap = new Map(sentimentGroups.map(item => [item.key, item]));
        const sentiment = {
            analyzed: sentimentValues.length,
            totalEntities: sentimentEntities.length,
            coverage: percent(sentimentValues.length, sentimentEntities.length) || 0,
            groups: [
                { key: 'positive', label: 'Tích cực' },
                { key: 'neutral', label: 'Trung tính' },
                { key: 'negative', label: 'Tiêu cực' },
            ].map(item => ({
                ...item,
                count: sentimentMap.get(item.key)?.count || 0,
                percent: sentimentMap.get(item.key)?.percent || 0,
            })),
        };

        const memberById = new Map(workspaceMembers.map(member => [member.user.id, member]));
        const agentIds = new Set<string>();
        periodConversations.forEach(item => item.assignedTo && agentIds.add(item.assignedTo));
        periodMessages.forEach(item => item.senderType === 'agent' && item.senderId && agentIds.add(item.senderId));
        firstResponses.forEach(item => item.agentId && agentIds.add(item.agentId));

        const agentPerformance = [...agentIds].map((agentId) => {
            const member = memberById.get(agentId);
            const assignedConversations = periodConversations.filter(item => item.assignedTo === agentId);
            const agentResponses = firstResponses.filter(item => item.agentId === agentId);
            const resolved = assignedConversations.filter(item => resolvedStatuses.has(item.status)).length;
            return {
                agentId,
                name: member?.user.name || 'Nhân viên không xác định',
                email: member?.user.email || '',
                avatarUrl: member?.user.avatarUrl || null,
                role: member?.role || 'agent',
                isActive: member?.user.isActive ?? false,
                assigned: assignedConversations.length,
                resolved,
                resolutionRate: percent(resolved, assignedConversations.length),
                sentMessages: periodMessages.filter(item => item.senderType === 'agent' && item.senderId === agentId).length,
                firstResponses: agentResponses.length,
                avgFirstResponseSeconds: average(agentResponses.map(item => item.seconds)),
            };
        }).sort((a, b) => (
            (b.assigned + b.sentMessages) - (a.assigned + a.sentMessages) || a.name.localeCompare(b.name)
        ));

        const priorityRank: Record<string, number> = { urgent: 4, high: 3, normal: 2, low: 1 };
        const getSlaState = (deadline: Date | null) => {
            if (!deadline) return 'none' as const;
            if (deadline.getTime() < now.getTime()) return 'breached' as const;
            if (deadline.getTime() <= slaAtRiskDeadline.getTime()) return 'at_risk' as const;
            return 'on_track' as const;
        };
        const attentionConversations = [...attentionConversationRecords]
            .sort((a, b) => {
                const slaRank = { breached: 0, at_risk: 1, on_track: 2, none: 3 };
                const slaDelta = slaRank[getSlaState(a.slaDeadline)] - slaRank[getSlaState(b.slaDeadline)];
                if (slaDelta !== 0) return slaDelta;
                const priorityDelta = (priorityRank[b.priority] || 0) - (priorityRank[a.priority] || 0);
                if (priorityDelta !== 0) return priorityDelta;
                return a.lastMessageAt.getTime() - b.lastMessageAt.getTime();
            })
            .slice(0, ATTENTION_CONVERSATION_LIMIT)
            .map((conversation) => {
                const visitorInfo = asRecord(conversation.visitorInfo);
                const member = conversation.assignedTo ? memberById.get(conversation.assignedTo) : null;
                return {
                    id: conversation.id,
                    visitorId: conversation.visitorId,
                    visitorName: firstString([visitorInfo], ['name']) || conversation.lastSenderName || 'Khách chưa định danh',
                    channel: normalizeChannel(conversation.channel),
                    status: conversation.status,
                    priority: conversation.priority,
                    slaDeadline: conversation.slaDeadline,
                    slaState: getSlaState(conversation.slaDeadline),
                    assignedTo: member ? {
                        id: member.user.id,
                        name: member.user.name,
                        avatarUrl: member.user.avatarUrl,
                    } : null,
                    tags: asStringList(conversation.tags),
                    lastMessageAt: conversation.lastMessageAt,
                    lastMessageSnippet: conversation.lastMessageSnippet || '',
                    lastSenderType: conversation.lastSenderType,
                    unreadCount: conversation.unreadCount,
                    waitingSeconds: conversation.lastSenderType === 'visitor'
                        ? Math.max(0, Math.round((now.getTime() - conversation.lastMessageAt.getTime()) / 1000))
                        : null,
                    ageSeconds: Math.max(0, Math.round((now.getTime() - conversation.createdAt.getTime()) / 1000)),
                };
            });

        const comparison = {
            conversations: compareMetric(periodConversations.length, previousConversations.length),
            newVisitors: compareMetric(seenNewVisitors.size, previousNewVisitorRecords.length),
            messages: compareMetric(periodMessages.length, previousMessages.length),
            resolved: compareMetric(periodResolved, previousResolved),
            resolutionRate: compareMetric(resolutionRate, previousResolutionRate),
            responseRate: compareMetric(responseRate, previousResponseRate),
            avgFirstResponseSeconds: compareMetric(avgFirstResponseSeconds, previousAvgFirstResponseSeconds),
            leads: compareMetric(periodLeads.length, previousLeads.length),
            orders: compareMetric(periodOrders.length, previousOrders.length),
            orderValue: compareMetric(periodOrderValue, previousOrderValue),
        };

        const seenProfiles = seenVisitorRecords.filter((visitor, index, records) => (
            records.findIndex(item => item.visitorId === visitor.visitorId) === index
        ));
        const countries = countGroups(seenProfiles.map((visitor) => {
            const attributes = asRecord(visitor.attributes);
            return firstString([attributes], ['countryCode', 'country_code', 'country']) || 'unknown';
        }));
        const sources = countGroups(seenProfiles.map((visitor) => {
            const attributes = asRecord(visitor.attributes);
            return firstString([attributes], ['utmSource', 'utm_source', 'source', 'referrer']) || 'direct';
        }), 'direct');

        const recentVisitors = uniqueRecentVisitors.map((visitor) => {
            const latestConversation = latestConversationByVisitorWidget.get(`${visitor.visitorId}::${visitor.widgetId}`)
                || latestConversationByVisitor.get(visitor.visitorId)
                || null;
            const attributes = asRecord(visitor.attributes);
            const metadata = asRecord(latestConversation?.metadata);
            const visitorInfo = asRecord(latestConversation?.visitorInfo);
            const pageUrl = firstString([attributes, metadata], ['pageUrl', 'page_url', 'currentUrl', 'current_url', 'url']);
            const domain = deriveDomain(pageUrl, firstString([attributes, metadata], ['domain', 'hostname', 'host']));

            return {
                id: visitor.id,
                visitorId: visitor.visitorId,
                widgetId: visitor.widgetId,
                name: visitor.name || firstString([visitorInfo], ['name']) || '',
                email: visitor.email || firstString([visitorInfo], ['email']) || '',
                phone: visitor.phone || firstString([visitorInfo], ['phone']) || '',
                firstSeenAt: visitor.firstSeenAt,
                lastSeenAt: visitor.lastSeenAt,
                totalConversations: visitor.totalConversations,
                attributes,
                isActive: visitor.lastSeenAt.getTime() >= liveSince.getTime(),
                channel: normalizeChannel(latestConversation?.channel),
                pageUrl,
                domain,
                referrer: firstString([attributes, metadata], ['referrer', 'referrerUrl', 'referrer_url']),
                utmSource: firstString([attributes, metadata], ['utmSource', 'utm_source']),
                country: firstString([attributes, metadata], ['country', 'countryName', 'country_name']),
                countryCode: firstString([attributes, metadata], ['countryCode', 'country_code']),
                city: firstString([attributes, metadata], ['city']),
                browser: firstString([attributes, metadata], ['browser', 'browserName', 'browser_name']),
                os: firstString([attributes, metadata], ['os', 'platform']),
                device: firstString([attributes, metadata], ['device', 'deviceType', 'device_type']),
                latestConversation: latestConversation ? {
                    id: latestConversation.id,
                    status: latestConversation.status,
                    channel: normalizeChannel(latestConversation.channel),
                    lastMessageAt: latestConversation.lastMessageAt,
                    metadata,
                    visitorInfo,
                } : null,
            };
        });

        return {
            generatedAt: now.toISOString(),
            liveWindowMinutes: LIVE_WINDOW_MINUTES,
            period: {
                key: period,
                start: start.toISOString(),
                end: end.toISOString(),
                previousStart: previousRange.start.toISOString(),
                previousEnd: previousRange.end.toISOString(),
                timezone: timezoneName,
                granularity,
            },
            kpis: {
                conversations: periodConversations.length,
                newVisitors: seenNewVisitors.size,
                messages: periodMessages.length,
                open: openNow,
                resolved: periodResolved,
                totalResolved,
                activeVisitors: activeVisitorRecords.length,
                responseRate,
                avgFirstResponseSeconds,
                resolutionRate,
                leads: periodLeads.length,
                orders: periodOrders.length,
                orderValue: periodOrderValue,
                leadToOrderRate: percent(periodOrders.length, periodLeads.length),
                slaBreached,
                slaAtRisk,
                unassignedOpen,
                unreadOpen,
            },
            comparison,
            timeSeries,
            channels,
            leadFunnel: {
                total: periodLeads.length,
                stages: leadStages.map(item => ({ stage: item.key, count: item.count, percent: item.percent })),
                sources: leadSources.map(item => ({ source: item.key, count: item.count, percent: item.percent })),
            },
            orderFunnel: {
                total: periodOrders.length,
                orderValue: periodOrderValue,
                statuses: orderStatuses.map(item => ({ status: item.key, count: item.count, percent: item.percent })),
            },
            operations: {
                slaBreached,
                slaAtRisk,
                unassignedOpen,
                unreadOpen,
                attentionConversations,
            },
            agentPerformance,
            tags,
            sentiment,
            recentVisitors,
            geography: countries.map(item => ({
                country: item.key,
                visitors: item.count,
                percent: item.percent,
            })),
            sources: sources.map(item => ({
                source: item.key,
                visitors: item.count,
                percent: item.percent,
            })),
            responseTimeBuckets: buildResponseTimeBuckets(firstResponses),
            definitions: {
                activeVisitors: `Visitor có lastSeenAt trong ${LIVE_WINDOW_MINUTES} phút gần nhất`,
                open: 'Tổng hội thoại đang open hoặc pending tại thời điểm tạo báo cáo',
                resolved: 'Hội thoại được tạo trong kỳ và hiện có trạng thái closed hoặc resolved',
                responseRate: 'Tỷ lệ hội thoại tạo trong kỳ có tin khách và đã nhận phản hồi agent',
                avgFirstResponseSeconds: 'Thời gian từ tin đầu tiên của khách đến phản hồi agent đầu tiên',
                resolutionRate: 'Tỷ lệ hội thoại tạo trong kỳ hiện có trạng thái closed hoặc resolved',
                orderValue: 'Tổng giá trị đơn trong kỳ, không gồm đơn cancelled hoặc returned',
                slaBreached: 'Hội thoại open hoặc pending có slaDeadline đã quá hạn tại thời điểm tạo báo cáo',
                sentiment: 'Tổng hợp từ tag sentiment/cảm xúc trên hội thoại và lead; không suy diễn khi chưa có tag',
            },
        };
    },
};
