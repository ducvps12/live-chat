import prisma from '../../infra/prisma';
import type { Subscription, Invoice, Prisma } from '@prisma/client';
import { paymentService } from './payment.service';

export interface PlanTier {
    id: string;
    name: string;
    nameVi: string;
    price: number;
    priceYearly: number;
    features: string[];
    aiReplyLimit?: number | null;
    widgetWhiteLabel?: boolean;
    widgetCustomCss?: boolean;
    publicApi?: {
        enabled: boolean;
        maxProjects: number;
        monthlyRequestLimit: number;
        rateLimitPerMinute: number;
        concurrencyLimit: number;
    };
}

export const PLAN_TIERS: PlanTier[] = [
    { id: 'trial', name: 'Trial', nameVi: 'Dùng thử', price: 0, priceYearly: 0, aiReplyLimit: 100, publicApi: { enabled: true, maxProjects: 1, monthlyRequestLimit: 100, rateLimitPerMinute: 5, concurrencyLimit: 1 }, features: ['14 ngày dùng thử', '1 agent', '100 conversations/tháng', '100 lượt AI auto-reply cloud', 'Public AI API: 100 lượt test/tháng', 'Radar tín hiệu: 2 nguồn / kiểm tra mỗi ngày'] },
    { id: 'starter', name: 'Starter', nameVi: 'Khởi đầu', price: 299000, priceYearly: 2990000, aiReplyLimit: 500, widgetWhiteLabel: true, widgetCustomCss: true, publicApi: { enabled: true, maxProjects: 1, monthlyRequestLimit: 1000, rateLimitPerMinute: 12, concurrencyLimit: 1 }, features: ['3 agents', '500 conversations/tháng', '500 lượt AI auto-reply cloud', 'Widget tùy chỉnh & bỏ thương hiệu', 'Tích hợp Zalo cá nhân', 'Macros / trả lời nhanh', 'Public AI API: 1 app / 1.000 lượt/tháng', 'Radar tín hiệu: 10 nguồn + Telegram riêng'] },
    { id: 'pro', name: 'Professional', nameVi: 'Chuyên nghiệp', price: 799000, priceYearly: 7990000, aiReplyLimit: null, widgetWhiteLabel: true, widgetCustomCss: true, publicApi: { enabled: true, maxProjects: 3, monthlyRequestLimit: 5000, rateLimitPerMinute: 30, concurrencyLimit: 2 }, features: ['10 agents', 'Unlimited conversations', 'AI auto-reply đa kênh không giới hạn', 'White-label & tự code CSS widget', 'Analytics', 'Đồng bộ lịch sử Zalo', 'Export data CSV', 'Public AI API: 3 app / 5.000 lượt/tháng', 'Radar tín hiệu: 50 nguồn / kiểm tra mỗi giờ'] },
    { id: 'enterprise', name: 'Enterprise', nameVi: 'Doanh nghiệp', price: -1, priceYearly: -1, aiReplyLimit: null, widgetWhiteLabel: true, widgetCustomCss: true, publicApi: { enabled: true, maxProjects: 10, monthlyRequestLimit: 25000, rateLimitPerMinute: 60, concurrencyLimit: 3 }, features: ['Unlimited agents', 'Gateway AI riêng / SLA', 'White-label & giao diện widget riêng', 'Custom integrations', 'SLA support', 'Public AI API theo SLA: 10 app / 25.000 lượt/tháng', 'Radar tín hiệu: 250 nguồn / 15 phút'] },
];

export const SIGNAL_RADAR_TIERS: Record<string, {
    enabled: boolean;
    maxMonitors: number;
    minIntervalMinutes: number;
    snapshotRetention: number;
}> = {
    trial: { enabled: true, maxMonitors: 2, minIntervalMinutes: 1440, snapshotRetention: 10 },
    starter: { enabled: true, maxMonitors: 10, minIntervalMinutes: 360, snapshotRetention: 30 },
    pro: { enabled: true, maxMonitors: 50, minIntervalMinutes: 60, snapshotRetention: 100 },
    enterprise: { enabled: true, maxMonitors: 250, minIntervalMinutes: 15, snapshotRetention: 500 },
};

type AIQuotaMetadata = {
    periodKey?: string;
    used?: number;
    limit?: number | null;
    planId?: string;
    updatedAt?: string;
};

const FREE_AI_REPLY_LIMIT = 100;

function readMetadata(metadata: unknown): Record<string, unknown> {
    return metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata as Record<string, unknown> : {};
}

function getAIReplyLimit(planId: string): number | null {
    const plan = PLAN_TIERS.find(p => p.id === planId);
    if (plan) return plan.aiReplyLimit ?? null;
    return planId === 'free' ? FREE_AI_REPLY_LIMIT : FREE_AI_REPLY_LIMIT;
}

function getPeriodKey(sub: Subscription): string {
    return `${sub.currentPeriodStart.toISOString()}_${sub.currentPeriodEnd.toISOString()}`;
}

export class SubscriptionService {
    getPlans(): PlanTier[] {
        return PLAN_TIERS;
    }

    async getWidgetEntitlements(workspaceId: string) {
        const subscription = await this.getSubscription(workspaceId);
        const plan = PLAN_TIERS.find((item) => item.id === subscription.planId);
        const paidAndActive = subscription.status === 'active' && Boolean(plan && plan.price !== 0);
        return {
            planId: subscription.planId,
            whiteLabel: paidAndActive && plan?.widgetWhiteLabel === true,
            customCss: paidAndActive && plan?.widgetCustomCss === true,
        };
    }

    async getPublicApiEntitlements(workspaceId: string) {
        const subscription = await this.getSubscription(workspaceId);
        const plan = PLAN_TIERS.find((item) => item.id === subscription.planId);
        const publicApi = plan?.publicApi;
        const active = subscription.status === 'active' && Boolean(publicApi?.enabled);
        return {
            planId: subscription.planId,
            active,
            ...(publicApi || { enabled: false, maxProjects: 0, monthlyRequestLimit: 0, rateLimitPerMinute: 0, concurrencyLimit: 0 }),
            periodEnd: subscription.currentPeriodEnd,
        };
    }

    async getSignalRadarEntitlements(workspaceId: string) {
        const subscription = await this.getSubscription(workspaceId);
        const radar = SIGNAL_RADAR_TIERS[subscription.planId];
        return {
            planId: subscription.planId,
            active: subscription.status === 'active' && Boolean(radar?.enabled),
            ...(radar || { enabled: false, maxMonitors: 0, minIntervalMinutes: 1440, snapshotRetention: 0 }),
            periodEnd: subscription.currentPeriodEnd,
        };
    }

    async getSubscription(workspaceId: string): Promise<Subscription> {
        let sub = await prisma.subscription.findUnique({ where: { workspaceId } });

        if (!sub) {
            const now = new Date();
            const trialEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
            sub = await prisma.subscription.create({
                data: {
                    workspaceId,
                    planId: 'trial',
                    status: 'active',
                    currentPeriodStart: now,
                    currentPeriodEnd: trialEnd,
                    trialEndsAt: trialEnd,
                    billingCycle: 'monthly',
                },
            });
        }

        if (sub.status === 'active' && new Date(sub.currentPeriodEnd) < new Date()) {
            await prisma.subscription.update({ where: { id: sub.id }, data: { status: 'expired' } });
            sub.status = 'expired';
        }

        return sub;
    }

    async getAIReplyQuota(workspaceId: string): Promise<{
        allowed: boolean;
        planId: string;
        used: number;
        limit: number | null;
        remaining: number | null;
        periodEnd: Date;
        reason?: string;
    }> {
        const sub = await this.getSubscription(workspaceId);
        const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { plan: true } });
        const planId = sub.planId || workspace?.plan || 'free';
        const limit = getAIReplyLimit(planId);
        const periodKey = getPeriodKey(sub);
        const metadata = readMetadata(sub.metadata);
        const quota = readMetadata(metadata.aiReplyQuota) as AIQuotaMetadata;
        const used = quota.periodKey === periodKey ? Number(quota.used || 0) : 0;

        if (sub.status !== 'active') {
            return {
                allowed: false,
                planId,
                used,
                limit,
                remaining: limit === null ? null : Math.max(0, limit - used),
                periodEnd: sub.currentPeriodEnd,
                reason: 'SUBSCRIPTION_INACTIVE',
            };
        }

        if (limit === null) {
            return { allowed: true, planId, used, limit, remaining: null, periodEnd: sub.currentPeriodEnd };
        }

        const remaining = Math.max(0, limit - used);
        return {
            allowed: remaining > 0,
            planId,
            used,
            limit,
            remaining,
            periodEnd: sub.currentPeriodEnd,
            reason: remaining > 0 ? undefined : 'AI_QUOTA_EXCEEDED',
        };
    }

    async consumeAIReplyQuota(workspaceId: string) {
        const quotaStatus = await this.getAIReplyQuota(workspaceId);
        if (!quotaStatus.allowed || quotaStatus.limit === null) return quotaStatus;

        const sub = await this.getSubscription(workspaceId);
        const metadata = readMetadata(sub.metadata);
        const periodKey = getPeriodKey(sub);
        const currentQuota = readMetadata(metadata.aiReplyQuota) as AIQuotaMetadata;
        const currentUsed = currentQuota.periodKey === periodKey ? Number(currentQuota.used || 0) : 0;
        const used = currentUsed + 1;

        await prisma.subscription.update({
            where: { id: sub.id },
            data: {
                metadata: {
                    ...metadata,
                    aiReplyQuota: {
                        periodKey,
                        used,
                        limit: quotaStatus.limit,
                        planId: quotaStatus.planId,
                        updatedAt: new Date().toISOString(),
                    },
                } as Prisma.InputJsonValue,
            },
        });

        return {
            ...quotaStatus,
            used,
            remaining: Math.max(0, quotaStatus.limit - used),
            allowed: used <= quotaStatus.limit,
        };
    }

    async changePlan(workspaceId: string, planId: string, billingCycle: 'monthly' | 'yearly' = 'monthly'): Promise<{ subscription: Subscription; invoice?: Invoice }> {
        const plan = PLAN_TIERS.find(p => p.id === planId);
        if (!plan) throw new Error('Plan không tồn tại');
        if (plan.price < 0) throw new Error('Vui lòng liên hệ sales cho gói Enterprise');

        if (plan.price === 0) {
            const now = new Date();
            const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
            const sub = await prisma.subscription.upsert({
                where: { workspaceId },
                create: {
                    workspaceId, planId, status: 'active',
                    currentPeriodStart: now, currentPeriodEnd: periodEnd, billingCycle,
                },
                update: {
                    planId, status: 'active',
                    currentPeriodStart: now, currentPeriodEnd: periodEnd, billingCycle, cancelledAt: null,
                },
            });
            return { subscription: sub };
        }

        const amount = billingCycle === 'yearly' ? plan.priceYearly : plan.price;
        const invoice = await this.createInvoice(workspaceId, planId, amount, billingCycle);
        const currentSub = await this.getSubscription(workspaceId);
        return { subscription: currentSub, invoice };
    }

    async cancelSubscription(workspaceId: string): Promise<Subscription> {
        const sub = await prisma.subscription.update({
            where: { workspaceId },
            data: { status: 'cancelled', cancelledAt: new Date() },
        });
        if (!sub) throw new Error('Subscription không tồn tại');
        return sub;
    }

    async createInvoice(
        workspaceId: string, planId: string, amount: number, billingCycle: 'monthly' | 'yearly'
    ): Promise<Invoice> {
        const plan = PLAN_TIERS.find(p => p.id === planId);
        const invoiceNumber = `INV-${Date.now()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

        return prisma.invoice.create({
            data: {
                workspaceId, invoiceNumber, planId, amount,
                currency: 'VND', status: 'pending', billingCycle,
                description: `Gói ${plan?.nameVi || planId} — ${billingCycle === 'yearly' ? 'Năm' : 'Tháng'}`,
            },
        });
    }

    async getInvoices(workspaceId: string, page = 1, limit = 20): Promise<{ items: Invoice[]; total: number }> {
        const [items, total] = await Promise.all([
            prisma.invoice.findMany({
                where: { workspaceId },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.invoice.count({ where: { workspaceId } }),
        ]);
        return { items, total };
    }

    async verifyPayment(invoiceId: string): Promise<Invoice> {
        const result = await paymentService.checkPayment(invoiceId);
        if (!result.invoice) throw new Error('Invoice không tồn tại');
        return result.invoice;
    }

    async getPaymentInfo(invoiceId: string) {
        return paymentService.getPaymentInfo(invoiceId);
    }

    async checkPaymentStatus(invoiceId: string) {
        return paymentService.checkPayment(invoiceId);
    }
}

export const subscriptionService = new SubscriptionService();
