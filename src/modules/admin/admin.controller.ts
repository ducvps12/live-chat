import { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import prisma from '../../infra/prisma';
import os from 'os';
import { trafficMonitor } from '../../infra/trafficMonitor';
import { aiClient } from '../../lib/ai/aiClient';

export const adminController = {
    overview: asyncHandler(async (_req: Request, res: Response) => {
        const [
            workspaces, users, conversations, messages,
            visitors, widgets, aiBots, leads,
            campaigns, knowledge, macros,
        ] = await Promise.all([
            prisma.workspace.count(),
            prisma.user.count(),
            prisma.conversation.count(),
            prisma.message.count(),
            prisma.visitor.count(),
            prisma.widget.count(),
            prisma.aIBot.count(),
            prisma.lead.count().catch(() => 0),
            prisma.campaign.count().catch(() => 0),
            prisma.knowledgeEntry.count().catch(() => 0),
            prisma.macro.count().catch(() => 0),
        ]);

        const [openConvs, closedConvs, pendingConvs] = await Promise.all([
            prisma.conversation.count({ where: { status: 'open' } }),
            prisma.conversation.count({ where: { status: 'closed' } }),
            prisma.conversation.count({ where: { status: 'pending' } }),
        ]);

        const activeBots = await prisma.aIBot.count({ where: { isActive: true } });

        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const [msgsToday, convsToday, visitorsToday] = await Promise.all([
            prisma.message.count({ where: { createdAt: { gte: oneDayAgo } } }),
            prisma.conversation.count({ where: { createdAt: { gte: oneDayAgo } } }),
            prisma.visitor.count({ where: { createdAt: { gte: oneDayAgo } } }),
        ]);

        const uptime = process.uptime();
        const memUsage = process.memoryUsage();

        res.json({
            success: true,
            data: {
                collections: {
                    workspaces, users, conversations, messages,
                    visitors, widgets, aiBots, leads,
                    campaigns, knowledge, macros, labels: 0,
                },
                conversationStats: {
                    open: openConvs, closed: closedConvs, pending: pendingConvs, total: conversations,
                },
                botStats: { total: aiBots, active: activeBots },
                recentActivity: { messagesToday: msgsToday, conversationsToday: convsToday, visitorsToday },
                server: {
                    uptime: Math.floor(uptime),
                    uptimeFormatted: formatUptime(uptime),
                    memoryUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
                    memoryTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
                    platform: os.platform(),
                    hostname: os.hostname(),
                    nodeVersion: process.version,
                    cpus: os.cpus().length,
                    totalRAM: Math.round(os.totalmem() / 1024 / 1024 / 1024),
                    freeRAM: Math.round(os.freemem() / 1024 / 1024 / 1024),
                },
                database: { name: 'MySQL (Prisma)', collections: 0, dataSize: 0, storageSize: 0, indexes: 0 },
                ai: { apiUrl: aiClient.baseUrl, model: aiClient.defaultModel },
            },
        });
    }),

    listWorkspaces: asyncHandler(async (_req: Request, res: Response) => {
        const workspaces = await prisma.workspace.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                members: true,
                _count: { select: { conversations: true, widgets: true } },
            },
        });

        const enriched = workspaces.map(ws => ({
            ...ws,
            _convCount: (ws as any)._count.conversations,
            _memberCount: ws.members.length,
            _widgetCount: (ws as any)._count.widgets,
        }));

        res.json({ success: true, data: enriched });
    }),

    listUsers: asyncHandler(async (_req: Request, res: Response) => {
        const users = await prisma.user.findMany({
            orderBy: { createdAt: 'desc' },
            omit: { passwordHash: true },
            include: {
                workspaceMembers: {
                    include: { workspace: { select: { id: true, name: true, slug: true, plan: true } } },
                },
                sessions: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    select: { ipAddress: true, userAgent: true, createdAt: true, expiresAt: true, revokedAt: true },
                },
                _count: {
                    select: { orders: true, macros: true, campaigns: true, products: true },
                },
            },
        });
        const enriched = users.map(u => {
            const lastSession = u.sessions?.[0] || null;
            return {
                ...u,
                sessions: undefined,
                workspaces: u.workspaceMembers?.map(wm => ({ ...wm.workspace, role: wm.role })) || [],
                workspaceMembers: undefined,
                workspaceCount: u.workspaceMembers?.length || 0,
                lastLogin: lastSession?.createdAt || null,
                lastIP: lastSession?.ipAddress || null,
                lastDevice: lastSession?.userAgent || null,
                orderCount: (u as any)._count?.orders || 0,
                macroCount: (u as any)._count?.macros || 0,
                campaignCount: (u as any)._count?.campaigns || 0,
                productCount: (u as any)._count?.products || 0,
            };
        });
        res.json({ success: true, data: enriched });
    }),

    getUser: asyncHandler(async (req: Request, res: Response) => {
        const userId = req.params.userId as string;
        const user = await prisma.user.findUnique({
            where: { id: userId },
            omit: { passwordHash: true },
            include: {
                workspaceMembers: {
                    include: { workspace: { select: { id: true, name: true, slug: true, plan: true } } },
                },
                sessions: {
                    orderBy: { createdAt: 'desc' },
                    take: 20,
                    select: { id: true, ipAddress: true, userAgent: true, createdAt: true, expiresAt: true, revokedAt: true },
                },
                orders: {
                    orderBy: { createdAt: 'desc' },
                    take: 50,
                    select: { id: true, orderNumber: true, customerName: true, total: true, status: true, createdAt: true },
                },
                _count: {
                    select: { orders: true, macros: true, campaigns: true, products: true, leads: true },
                },
            },
        });
        if (!user) { res.status(404).json({ success: false, message: 'User không tồn tại' }); return; }

        // Get invoices from user's workspaces
        const wsIds = user.workspaceMembers?.map(wm => wm.workspace.id) || [];
        const invoices = wsIds.length > 0 ? await prisma.invoice.findMany({
            where: { workspaceId: { in: wsIds } },
            orderBy: { createdAt: 'desc' },
            take: 50,
        }) : [];
        const subscriptions = wsIds.length > 0 ? await prisma.subscription.findMany({
            where: { workspaceId: { in: wsIds } },
            include: { workspace: { select: { name: true } } },
        }) : [];

        const totalRevenue = (user.orders || []).reduce((s: number, o: any) => s + (o.status !== 'cancelled' ? o.total : 0), 0);
        const totalInvoicePaid = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.amount, 0);

        res.json({ success: true, data: { ...user, invoices, subscriptions, totalRevenue, totalInvoicePaid } });
    }),

    updateUser: asyncHandler(async (req: Request, res: Response) => {
        const userId = req.params.userId as string;
        const { name, email, role, isActive } = req.body;
        const existing = await prisma.user.findUnique({ where: { id: userId } });
        if (!existing) { res.status(404).json({ success: false, message: 'User không tồn tại' }); return; }
        const updated = await prisma.user.update({
            where: { id: userId },
            data: {
                ...(name !== undefined && { name }),
                ...(email !== undefined && { email }),
                ...(role !== undefined && { role }),
                ...(isActive !== undefined && { isActive }),
            },
            omit: { passwordHash: true },
        });
        console.log(`[Admin] User ${updated.email} updated: role=${updated.role}, isActive=${updated.isActive}`);
        res.json({ success: true, data: updated, message: 'Cập nhật thành công' });
    }),

    revokeSessions: asyncHandler(async (req: Request, res: Response) => {
        const userId = req.params.userId as string;
        const result = await prisma.session.updateMany({
            where: { userId, revokedAt: null },
            data: { revokedAt: new Date() },
        });
        console.log(`[Admin] Revoked ${result.count} sessions for user ${userId}`);
        res.json({ success: true, data: { revokedCount: result.count }, message: `Đã thu hồi ${result.count} phiên đăng nhập` });
    }),

    deleteUser: asyncHandler(async (req: Request, res: Response) => {
        const userId = req.params.userId as string;
        const existing = await prisma.user.findUnique({ where: { id: userId } });
        if (!existing) { res.status(404).json({ success: false, message: 'User không tồn tại' }); return; }
        await prisma.user.delete({ where: { id: userId } });
        console.log(`[Admin] User ${existing.email} deleted`);
        res.json({ success: true, message: `Đã xóa user ${existing.email}` });
    }),

    listBots: asyncHandler(async (_req: Request, res: Response) => {
        const bots = await prisma.aIBot.findMany({ orderBy: { createdAt: 'desc' } });
        res.json({ success: true, data: bots });
    }),

    toggleBot: asyncHandler(async (req: Request, res: Response) => {
        const botId = req.params.botId as string;
        const { isActive } = req.body;

        // Validate bot exists first
        const existing = await prisma.aIBot.findUnique({ where: { id: botId as string } });
        if (!existing) {
            res.status(404).json({ success: false, message: 'Bot không tồn tại' });
            return;
        }

        const bot = await prisma.aIBot.update({
            where: { id: botId as string },
            data: { isActive: !!isActive, isDraft: !isActive },
        });
        console.log(`[Admin] Bot ${bot.name} toggled: isActive=${isActive} by admin`);
        res.json({ success: true, data: bot, message: isActive ? 'Bot activated' : 'Bot deactivated' });
    }),

    aiHealth: asyncHandler(async (_req: Request, res: Response) => {
        const result = await aiClient.listModels();
        res.json({
            success: true,
            data: {
                status: result.status,
                latency: result.latencyMs,
                models: result.models.map((m) => ({ id: m.id, owned_by: m.owned_by })),
                modelCount: result.models.length,
                baseUrl: aiClient.baseUrl,
                defaultModel: aiClient.defaultModel,
                ...(result.error ? { error: result.error } : {}),
            },
        });
    }),

    recentMessages: asyncHandler(async (_req: Request, res: Response) => {
        const msgs = await prisma.message.findMany({
            orderBy: { createdAt: 'desc' },
            take: 50,
        });
        res.json({ success: true, data: msgs });
    }),

    collections: asyncHandler(async (_req: Request, res: Response) => {
        // List all Prisma model counts
        const counts = await Promise.all([
            prisma.user.count().then(c => ({ name: 'User', count: c })),
            prisma.workspace.count().then(c => ({ name: 'Workspace', count: c })),
            prisma.conversation.count().then(c => ({ name: 'Conversation', count: c })),
            prisma.message.count().then(c => ({ name: 'Message', count: c })),
            prisma.visitor.count().then(c => ({ name: 'Visitor', count: c })),
            prisma.widget.count().then(c => ({ name: 'Widget', count: c })),
            prisma.aIBot.count().then(c => ({ name: 'AIBot', count: c })),
            prisma.lead.count().then(c => ({ name: 'Lead', count: c })),
            prisma.campaign.count().then(c => ({ name: 'Campaign', count: c })),
            prisma.knowledgeEntry.count().then(c => ({ name: 'KnowledgeEntry', count: c })),
            prisma.macro.count().then(c => ({ name: 'Macro', count: c })),
            prisma.order.count().then(c => ({ name: 'Order', count: c })),
            prisma.product.count().then(c => ({ name: 'Product', count: c })),
            prisma.zaloAccount.count().then(c => ({ name: 'ZaloAccount', count: c })),
            prisma.zaloContact.count().then(c => ({ name: 'ZaloContact', count: c })),
            prisma.zaloMessage.count().then(c => ({ name: 'ZaloMessage', count: c })),
        ]);
        counts.sort((a, b) => b.count - a.count);
        res.json({ success: true, data: counts });
    }),
    deepStats: asyncHandler(async (_req: Request, res: Response) => {
        // 7-day trends
        const days: { date: string; messages: number; conversations: number; visitors: number }[] = [];
        for (let i = 6; i >= 0; i--) {
            const start = new Date(); start.setHours(0,0,0,0); start.setDate(start.getDate() - i);
            const end = new Date(start); end.setDate(end.getDate() + 1);
            const [msgs, convs, vis] = await Promise.all([
                prisma.message.count({ where: { createdAt: { gte: start, lt: end } } }),
                prisma.conversation.count({ where: { createdAt: { gte: start, lt: end } } }),
                prisma.visitor.count({ where: { createdAt: { gte: start, lt: end } } }),
            ]);
            days.push({ date: start.toISOString().slice(0, 10), messages: msgs, conversations: convs, visitors: vis });
        }

        // Workspace breakdown
        const workspaces = await prisma.workspace.findMany({
            orderBy: { createdAt: 'desc' },
            include: { members: { select: { userId: true, role: true } }, _count: { select: { conversations: true, widgets: true, visitors: true } } },
        });

        // Order stats
        const [totalOrders, pendingOrders, orderRevenue] = await Promise.all([
            prisma.order.count(),
            prisma.order.count({ where: { status: { in: ['pending', 'confirmed'] } } }),
            prisma.order.aggregate({ _sum: { total: true }, where: { status: { in: ['delivered', 'confirmed', 'shipping'] } } }),
        ]);

        // Lead stats
        const [totalLeads, newLeads] = await Promise.all([
            prisma.lead.count(),
            prisma.lead.count({ where: { stage: 'mới' } }),
        ]);

        // Subscription stats
        const [activeSubs, totalInvoices, paidInvoices] = await Promise.all([
            prisma.subscription.count({ where: { status: 'active' } }).catch(() => 0),
            prisma.invoice.count().catch(() => 0),
            prisma.invoice.count({ where: { status: 'paid' } }).catch(() => 0),
        ]);

        // Zalo stats
        const [zaloAccounts, zaloContacts, zaloMessages] = await Promise.all([
            prisma.zaloAccount.count(),
            prisma.zaloContact.count(),
            prisma.zaloMessage.count(),
        ]);

        // External sessions (Zalo remote)
        const [totalSessions, activeSessions] = await Promise.all([
            prisma.externalSession.count(),
            prisma.externalSession.count({ where: { status: 'connected' } }),
        ]);

        res.json({
            success: true,
            data: {
                trends: days,
                workspaces: workspaces.map(ws => ({
                    id: ws.id, name: ws.name, slug: ws.slug, plan: ws.plan, isActive: ws.isActive,
                    createdAt: ws.createdAt,
                    memberCount: ws.members.length,
                    conversationCount: (ws as any)._count.conversations,
                    widgetCount: (ws as any)._count.widgets,
                    visitorCount: (ws as any)._count.visitors,
                })),
                orders: { total: totalOrders, pending: pendingOrders, revenue: orderRevenue._sum?.total || 0 },
                leads: { total: totalLeads, new: newLeads },
                subscriptions: { active: activeSubs, invoices: totalInvoices, paidInvoices },
                zalo: { accounts: zaloAccounts, contacts: zaloContacts, messages: zaloMessages },
                sessions: { total: totalSessions, active: activeSessions },
            },
        });
    }),

    systemMetrics: asyncHandler(async (_req: Request, res: Response) => {
        const uptime = process.uptime();
        const memUsage = process.memoryUsage();

        // Real network/traffic data from in-memory monitor
        const tStats = trafficMonitor.getStats();
        const realNetwork = {
            rxSec: tStats.current.rxSec,
            txSec: tStats.current.txSec,
            connections: tStats.current.connections,
            rps: tStats.current.rps,
            activeIps: tStats.current.activeIps,
        };

        const totalRAM = os.totalmem();
        const freeRAM = os.freemem();
        const usedRAM = totalRAM - freeRAM;

        // CPU usage: rough proxy via load average / cores (Linux only); fallback to small value
        const load1 = (os.loadavg && os.loadavg()[0]) || 0;
        const cpuPct = Math.min(100, Math.round((load1 / Math.max(os.cpus().length, 1)) * 100));

        res.json({
            success: true,
            data: {
                cpu: {
                    model: os.cpus()[0]?.model || 'unknown',
                    cores: os.cpus().length,
                    usagePercent: cpuPct || 1,
                    load1,
                },
                memory: {
                    total: totalRAM,
                    free: freeRAM,
                    used: usedRAM,
                    usedPercent: Math.round((usedRAM / totalRAM) * 100),
                    heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
                    heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
                },
                disk: {
                    // Node.js doesn't natively give disk usage without spawn — kept as estimate
                    total: 100 * 1024 * 1024 * 1024,
                    used: 45 * 1024 * 1024 * 1024,
                    usedPercent: 45,
                },
                network: realNetwork,
                uptime: uptime,
                uptimeFormatted: formatUptime(uptime),
                ddos: tStats.ddos,
            },
        });
    }),
};

function formatUptime(seconds: number): string {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const parts: string[] = [];
    if (d > 0) parts.push(`${d}d`);
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    parts.push(`${s}s`);
    return parts.join(' ');
}
