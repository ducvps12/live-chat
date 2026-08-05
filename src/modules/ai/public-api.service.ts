import { createHash, randomBytes } from 'crypto';
import prisma from '../../infra/prisma';
import { AppError } from '../../middlewares/errorHandler';
import { subscriptionService } from '../subscription/subscription.service';

const PERIOD_KEY = () => new Date().toISOString().slice(0, 7);
const hashKey = (value: string) => createHash('sha256').update(value).digest('hex');
const safeProject = (project: any) => ({
    id: project.id,
    name: project.name,
    isActive: project.isActive,
    monthlyRequestLimit: project.monthlyRequestLimit,
    rateLimitPerMinute: project.rateLimitPerMinute,
    concurrencyLimit: project.concurrencyLimit,
    allowedModels: project.allowedModels,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    keys: Array.isArray(project.keys) ? project.keys.map((key: any) => ({
        id: key.id,
        name: key.name,
        prefix: key.prefix,
        scopes: key.scopes,
        isActive: key.isActive,
        lastUsedAt: key.lastUsedAt,
        expiresAt: key.expiresAt,
        createdAt: key.createdAt,
        revokedAt: key.revokedAt,
    })) : undefined,
});

export const PUBLIC_AI_MODELS = ['qwen2.5:14b', 'deepseek-r1:14b', 'qwen2.5:7b', 'oc/minimax-m2.5-free'] as const;

const normalizeModels = (value: unknown): string[] => {
    const requested = Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
    const valid = requested.filter((model) => (PUBLIC_AI_MODELS as readonly string[]).includes(model)).slice(0, 4);
    return valid.length ? [...new Set(valid)] : ['qwen2.5:14b'];
};

export const publicAIService = {
    async listProjects(workspaceId: string) {
        const [projects, entitlement] = await Promise.all([
            prisma.apiProject.findMany({
            where: { workspaceId },
            include: { keys: { orderBy: { createdAt: 'desc' } } },
            orderBy: { createdAt: 'desc' },
            }),
            subscriptionService.getPublicApiEntitlements(workspaceId),
        ]);
        return projects.map((project) => safeProject({
            ...project,
            monthlyRequestLimit: entitlement.monthlyRequestLimit,
            rateLimitPerMinute: entitlement.rateLimitPerMinute,
            concurrencyLimit: entitlement.concurrencyLimit,
        }));
    },

    async createProject(workspaceId: string, userId: string, input: { name?: string; allowedModels?: unknown }) {
        const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { id: true } });
        if (!workspace) throw new AppError('Workspace not found', 404, 'NOT_FOUND');
        const entitlement = await subscriptionService.getPublicApiEntitlements(workspaceId);
        if (!entitlement.active) throw new AppError('Public AI API requires an active subscription', 403, 'AI_API_PLAN_REQUIRED');
        const existingProjects = await prisma.apiProject.count({ where: { workspaceId, isActive: true } });
        if (existingProjects >= entitlement.maxProjects) {
            throw new AppError(`Your ${entitlement.planId} plan allows up to ${entitlement.maxProjects} API project(s)`, 403, 'AI_API_PROJECT_LIMIT');
        }
        const name = String(input.name || 'Ứng dụng mới').trim().slice(0, 80) || 'Ứng dụng mới';
        const allowedModels = normalizeModels(input.allowedModels);
        const project = await prisma.apiProject.create({
            data: {
                workspaceId,
                createdById: userId,
                name,
                allowedModels,
                monthlyRequestLimit: entitlement.monthlyRequestLimit,
                rateLimitPerMinute: entitlement.rateLimitPerMinute,
                concurrencyLimit: entitlement.concurrencyLimit,
            },
            include: { keys: true },
        });
        return safeProject(project);
    },

    async issueKey(workspaceId: string, projectId: string, input: { name?: string; scopes?: unknown; expiresAt?: unknown }) {
        const project = await prisma.apiProject.findFirst({ where: { id: projectId, workspaceId } });
        if (!project) throw new AppError('API project not found', 404, 'NOT_FOUND');
        const secret = `nmk_live_${randomBytes(30).toString('base64url')}`;
        const expiresAt = input.expiresAt ? new Date(String(input.expiresAt)) : null;
        if (expiresAt && Number.isNaN(expiresAt.getTime())) throw new AppError('Invalid expiry date', 400, 'VALIDATION_ERROR');
        const scopes = Array.isArray(input.scopes) && input.scopes.includes('chat:generate')
            ? ['chat:generate']
            : ['chat:generate'];
        const key = await prisma.apiKey.create({
            data: {
                projectId,
                name: String(input.name || 'Production key').trim().slice(0, 80) || 'Production key',
                prefix: secret.slice(0, 16),
                secretHash: hashKey(secret),
                scopes,
                ...(expiresAt ? { expiresAt } : {}),
            },
        });
        return { key: { ...safeProject({ keys: [key] }).keys[0] }, secret };
    },

    async revokeKey(workspaceId: string, projectId: string, keyId: string) {
        const result = await prisma.apiKey.updateMany({
            where: { id: keyId, projectId, project: { workspaceId } },
            data: { isActive: false, revokedAt: new Date() },
        });
        if (!result.count) throw new AppError('API key not found', 404, 'NOT_FOUND');
    },

    async authenticate(secret: string) {
        if (!secret.startsWith('nmk_live_')) throw new AppError('Invalid API key', 401, 'AI_API_UNAUTHORIZED');
        const key = await prisma.apiKey.findUnique({
            where: { secretHash: hashKey(secret) },
            include: { project: true },
        });
        if (!key || !key.isActive || !key.project.isActive || (key.expiresAt && key.expiresAt <= new Date())) {
            throw new AppError('Invalid or inactive API key', 401, 'AI_API_UNAUTHORIZED');
        }
        if (!(key.scopes as string[]).includes('chat:generate')) throw new AppError('API key lacks chat:generate scope', 403, 'AI_API_FORBIDDEN');
        const entitlement = await subscriptionService.getPublicApiEntitlements(key.project.workspaceId);
        if (!entitlement.active) throw new AppError('Public AI API is unavailable because the subscription is inactive', 403, 'AI_API_PLAN_REQUIRED');
        return {
            ...key,
            project: {
                ...key.project,
                monthlyRequestLimit: entitlement.monthlyRequestLimit,
                rateLimitPerMinute: entitlement.rateLimitPerMinute,
                concurrencyLimit: entitlement.concurrencyLimit,
            },
        };
    },

    async reserveRequest(apiKey: any, inputChars: number) {
        const periodKey = PERIOD_KEY();
        const existing = await prisma.apiUsage.findUnique({ where: { projectId_periodKey: { projectId: apiKey.projectId, periodKey } } });
        if ((existing?.requestCount || 0) >= apiKey.project.monthlyRequestLimit) {
            throw new AppError('Monthly API quota reached', 429, 'AI_API_QUOTA_EXCEEDED');
        }
        await prisma.$transaction([
            prisma.apiUsage.upsert({
                where: { projectId_periodKey: { projectId: apiKey.projectId, periodKey } },
                create: { projectId: apiKey.projectId, periodKey, requestCount: 1, inputChars },
                update: { requestCount: { increment: 1 }, inputChars: { increment: inputChars } },
            }),
            prisma.apiKey.update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } }),
        ]);
    },

    async recordOutput(projectId: string, outputChars: number) {
        await prisma.apiUsage.updateMany({ where: { projectId, periodKey: PERIOD_KEY() }, data: { outputChars: { increment: outputChars } } });
    },

    async usage(workspaceId: string, projectId: string) {
        const project = await prisma.apiProject.findFirst({ where: { id: projectId, workspaceId } });
        if (!project) throw new AppError('API project not found', 404, 'NOT_FOUND');
        const usage = await prisma.apiUsage.findUnique({ where: { projectId_periodKey: { projectId, periodKey: PERIOD_KEY() } } });
        const entitlement = await subscriptionService.getPublicApiEntitlements(workspaceId);
        return { periodKey: PERIOD_KEY(), requests: usage?.requestCount || 0, limit: entitlement.monthlyRequestLimit, inputChars: usage?.inputChars || 0, outputChars: usage?.outputChars || 0 };
    },
};
