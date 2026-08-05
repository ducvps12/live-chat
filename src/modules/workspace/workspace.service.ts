import { workspaceRepo } from './repos/workspace.repo';
import { widgetRepo } from './repos/widget.repo';
import { offlineMessageRepo } from './repos/offlineMessage.repo';
import { AppError } from '../../middlewares/errorHandler';
import { userRepo } from '../auth/repos/user.repo';
import { conversationRepo } from '../conversation/repos/conversation.repo';
import { getAIAPIKey, getAIBaseUrl, getAIModel, isMaskedAIKey, maskAIKey, normalizeAIBaseUrl } from '../../config/ai';
import { aiService } from '../ai/ai.service';
import { subscriptionService } from '../subscription/subscription.service';
import prisma from '../../infra/prisma';
import crypto from 'crypto';
import { env } from '../../config/env';
import { smtpService } from '../email/smtp.service';
import { SETTINGS_KEYS, settingsService } from '../admin/settings.service';

export type AIRuntimeSettings = {
    enabled: boolean;
    provider: 'openai-compatible' | 'local-vllm' | 'disabled';
    baseUrl: string;
    apiKey?: string;
    model: string;
    temperature: number;
    maxTokens: number;
    timeoutMs: number;
    updatedAt?: string;
};

type WorkspaceSettingsShape = Record<string, unknown> & {
    aiRuntime?: Partial<AIRuntimeSettings>;
};

const DEFAULT_AI_RUNTIME: AIRuntimeSettings = {
    enabled: true,
    provider: 'openai-compatible',
    baseUrl: getAIBaseUrl(),
    apiKey: getAIAPIKey(),
    model: getAIModel(),
    temperature: 0.55,
    maxTokens: 700,
    timeoutMs: 60000,
};

const normalizeWidgetApiBase = (value?: string) => {
    const raw = (value || '').trim();
    if (!raw) return '';
    return raw.replace(/\/api\/?$/, '').replace(/\/+$/, '');
};

const DEFAULT_STARTER_KNOWLEDGE = [
    {
        product: 'NemarkChat',
        question: 'Doanh nghiệp nên bắt đầu dùng NemarkChat như thế nào?',
        answer: 'Bạn có thể bắt đầu bằng cách tạo workspace, bật widget website, thêm thông tin doanh nghiệp vào Kho tri thức và thử một cuộc chat mẫu. Nếu cần kết nối Zalo/Facebook, hãy vào mục Kết nối kênh để đồng bộ hội thoại.',
        keywords: ['bắt đầu', 'onboarding', 'workspace', 'widget'],
    },
    {
        product: 'Gói dịch vụ',
        question: 'NemarkChat có những gói nào?',
        answer: 'NemarkChat có gói Dùng thử, Khởi đầu, Chuyên nghiệp và Doanh nghiệp. Gói Khởi đầu phù hợp để trải nghiệm CSKH đa kênh, còn gói Chuyên nghiệp mở thêm tuỳ chỉnh widget, nhiều agent và quota AI cao hơn.',
        keywords: ['gói', 'giá', 'starter', 'pro'],
    },
    {
        product: 'AI tự động phản hồi',
        question: 'AI sẽ trả lời khách hàng như thế nào?',
        answer: 'AI dùng dữ liệu trong Kho tri thức, lịch sử hội thoại và cấu hình bot của workspace để gợi ý hoặc tự trả lời. Khi thiếu thông tin, AI nên hỏi lại hoặc chuyển cho nhân viên thật để tránh trả lời sai.',
        keywords: ['ai', 'auto reply', 'tự động', 'chuyển người thật'],
    },
    {
        product: 'Bảo mật dữ liệu',
        question: 'Dữ liệu khách hàng có được bảo vệ không?',
        answer: 'Dữ liệu được tách theo từng workspace, truyền qua HTTPS và chỉ thành viên được phân quyền mới xem được hội thoại. Với khách cần riêng tư hơn, hệ thống có thể cấu hình gateway AI riêng hoặc mô hình local/private.',
        keywords: ['bảo mật', 'dữ liệu', 'workspace', 'private'],
    },
    {
        product: 'Hỗ trợ',
        question: 'Khi AI không đủ thông tin thì xử lý thế nào?',
        answer: 'AI cần nói rõ là chưa đủ thông tin, đặt thêm câu hỏi để làm rõ hoặc chuyển cuộc hội thoại sang nhân viên phụ trách. Đây là cách giữ trải nghiệm tự nhiên nhưng vẫn an toàn cho doanh nghiệp.',
        keywords: ['handoff', 'agent', 'không đủ thông tin', 'hỗ trợ'],
    },
];

const createDefaultWidgetConfig = (workspaceName: string) => ({
    primaryColor: '#2563EB',
    position: 'bottom-right',
    language: 'vi',
    name: `${workspaceName} Hỗ trợ`,
    greeting: `Chào bạn 👋 ${workspaceName} có thể hỗ trợ bạn điều gì hôm nay?`,
    placeholder: 'Nhập câu hỏi của bạn...',
    offlineMessage: 'Hiện tại chưa có nhân viên trực tuyến. Bạn để lại lời nhắn, đội ngũ sẽ phản hồi sớm nhất.',
    autoReply: 'Mình đã nhận được tin nhắn. Cho mình thêm ít phút để kiểm tra thông tin nhé.',
    launcherStyle: 'bubble',
    launcherText: 'Chat với chúng tôi',
    greetingPopup: {
        enabled: true,
        message: 'Bạn cần tư vấn hoặc báo giá? Nhắn mình ở đây nhé.',
        ctaText: 'Gửi tin nhắn',
        delaySeconds: 3,
    },
    preChatForm: {
        enabled: false,
        fields: [
            { key: 'name', label: 'Họ tên', type: 'text', required: true },
            { key: 'phone', label: 'Số điện thoại', type: 'tel', required: false },
        ],
    },
    brandingMode: 'nemark',
    showBranding: true,
    themePreset: 'modern',
});

const createDefaultBotPayload = (workspaceId: string, workspaceName: string) => ({
    workspaceId,
    name: `${workspaceName} AI Copilot`,
    brandName: workspaceName,
    brandDescription: `${workspaceName} dùng NemarkChat để tư vấn và chăm sóc khách hàng đa kênh.`,
    aiModel: getAIModel(),
    mainTask: 'customer_care',
    conversationStyle: 'friendly',
    messageLength: 'medium',
    customGreeting: `Chào bạn 👋 Mình là trợ lý CSKH của ${workspaceName}. Bạn cần mình hỗ trợ gì hôm nay?`,
    welcomeMessage: `Chào bạn 👋 Mình là trợ lý CSKH của ${workspaceName}. Bạn cần mình hỗ trợ gì hôm nay?`,
    channels: {
        website: true,
        zalo: false,
        facebook: false,
        messenger: false,
        instagram: false,
        email: false,
    },
    agentCondition: 'when_confident',
    scenarios: [
        {
            id: 'missing_info',
            title: 'Thiếu thông tin',
            instruction: 'Nếu Kho tri thức chưa đủ dữ liệu, hãy hỏi lại một câu ngắn hoặc chuyển nhân viên thật. Không tự bịa giá, chính sách hoặc trạng thái đơn hàng.',
        },
        {
            id: 'handoff',
            title: 'Chuyển người thật',
            instruction: 'Khi khách yêu cầu khiếu nại, hoàn tiền, thông tin nhạy cảm hoặc câu hỏi ngoài dữ liệu, hãy xin phép chuyển nhân viên phụ trách.',
        },
    ],
    quickReplies: [
        { id: 'pricing', label: 'Báo giá', message: 'Bạn muốn mình gửi thông tin gói dịch vụ/phí sử dụng đúng không ạ?' },
        { id: 'consulting', label: 'Tư vấn', message: 'Bạn mô tả nhu cầu hiện tại, mình sẽ gợi ý hướng phù hợp nhé.' },
        { id: 'human', label: 'Gặp nhân viên', message: 'Mình sẽ chuyển cuộc trò chuyện này cho nhân viên phụ trách hỗ trợ bạn.' },
    ],
    followUp: {
        enabled: true,
        delaySeconds: 90,
        message: 'Bạn còn cần mình hỗ trợ thêm thông tin nào không ạ?',
    },
    personaConfig: {
        version: 1,
        identityPolicy: 'transparent_when_asked',
        confidenceMode: 'safe_auto_reply',
        handoffWhen: ['missing_knowledge', 'complaint', 'refund', 'sensitive_data', 'low_confidence'],
        tone: 'warm_concise_vietnamese',
        guardrails: [
            'Không tự bịa giá, chính sách, tồn kho hoặc trạng thái đơn hàng.',
            'Nếu chưa chắc, hỏi lại hoặc chuyển nhân viên thật.',
            'Trả lời tự nhiên, ngắn gọn, ưu tiên giải quyết vấn đề của khách.',
        ],
    },
    isActive: true,
    isDraft: false,
});

const provisionDefaultWorkspaceStarterKit = async (workspaceId: string, workspaceName: string) => {
    const [widgetCount, botCount, knowledgeCount] = await Promise.all([
        prisma.widget.count({ where: { workspaceId } }),
        prisma.aIBot.count({ where: { workspaceId } }),
        prisma.knowledgeEntry.count({ where: { workspaceId } }),
    ]);

    await prisma.$transaction(async (tx) => {
        if (widgetCount === 0) {
            await tx.widget.create({
                data: {
                    workspaceId,
                    name: `${workspaceName} Website Chat`,
                    config: createDefaultWidgetConfig(workspaceName),
                    domainRules: { mode: 'allow_all', domains: [] },
                    isActive: true,
                } as any,
            });
        }

        if (botCount === 0) {
            await tx.aIBot.create({
                data: createDefaultBotPayload(workspaceId, workspaceName) as any,
            });
        }

        if (knowledgeCount === 0) {
            for (const entry of DEFAULT_STARTER_KNOWLEDGE) {
                await tx.knowledgeEntry.create({
                    data: {
                        workspaceId,
                        ...entry,
                        source: 'starter_template',
                    } as any,
                });
            }
        }
    });
};

const readWorkspaceSettings = (settings: unknown): WorkspaceSettingsShape => {
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return {};
    return settings as WorkspaceSettingsShape;
};

const normalizeAIProvider = (settings?: Partial<AIRuntimeSettings>): AIRuntimeSettings['provider'] => {
    if (settings?.enabled === false || settings?.provider === 'disabled') return 'disabled';
    if (settings?.provider === 'local-vllm') return 'openai-compatible';
    return settings?.provider || DEFAULT_AI_RUNTIME.provider;
};

const normalizeAIRuntime = (settings?: Partial<AIRuntimeSettings>): AIRuntimeSettings => {
    const provider = normalizeAIProvider(settings);
    return {
        enabled: provider !== 'disabled' && (settings?.enabled ?? DEFAULT_AI_RUNTIME.enabled),
        provider,
        baseUrl: normalizeAIBaseUrl(settings?.baseUrl || DEFAULT_AI_RUNTIME.baseUrl),
        apiKey: settings?.apiKey ?? DEFAULT_AI_RUNTIME.apiKey,
        model: settings?.model || DEFAULT_AI_RUNTIME.model,
        temperature: Number(settings?.temperature ?? DEFAULT_AI_RUNTIME.temperature),
        maxTokens: Number(settings?.maxTokens ?? DEFAULT_AI_RUNTIME.maxTokens),
        timeoutMs: Number(settings?.timeoutMs ?? DEFAULT_AI_RUNTIME.timeoutMs),
        updatedAt: settings?.updatedAt,
    };
};

const maskAIRuntime = (settings: AIRuntimeSettings) => ({
    ...settings,
    apiKey: maskAIKey(settings.apiKey),
    hasApiKey: Boolean(settings.apiKey),
});

const normalizeEmail = (email: string) => email.trim().toLowerCase();
const hashInviteToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');
const roleText = (role: string) => ({ admin: 'Quản trị viên', agent: 'Nhân viên hỗ trợ', member: 'Chỉ xem' }[role] || role);

const makeInviteUrl = (token: string, email: string) => {
    const url = new URL('/auth/register', `${env.FRONTEND_URL.replace(/\/+$/, '')}/`);
    url.searchParams.set('invite', token);
    url.searchParams.set('email', email);
    return url.toString();
};

async function sendWorkspaceInviteEmail(input: {
    to: string;
    workspaceName: string;
    role: string;
    link: string;
    invitedByName?: string;
}) {
    const { to, workspaceName, role, link, invitedByName } = input;
    await smtpService.sendMail({
        to,
        subject: `Lời mời tham gia ${workspaceName} trên NemarkChat`,
        text: [
            `${invitedByName || 'Đội ngũ NemarkChat'} vừa mời bạn tham gia workspace ${workspaceName}.`,
            `Vai trò: ${roleText(role)}.`,
            '',
            `Mở liên kết này để đăng nhập/đăng ký và tham gia workspace: ${link}`,
            '',
            'Liên kết có hiệu lực trong 7 ngày. Nếu bạn không mong đợi lời mời này, hãy bỏ qua email.',
        ].join('\n'),
        html: [
            '<div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">',
            `<h2 style="margin:0 0 12px">Bạn được mời tham gia ${workspaceName}</h2>`,
            `<p>${invitedByName || 'Đội ngũ NemarkChat'} vừa mời bạn vào workspace <strong>${workspaceName}</strong>.</p>`,
            `<p>Vai trò: <strong>${roleText(role)}</strong></p>`,
            `<p><a href="${link.replace(/&/g, '&amp;')}" style="display:inline-block;background:#2563eb;color:white;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:700">Tham gia workspace</a></p>`,
            '<p style="color:#64748b;font-size:13px">Liên kết có hiệu lực trong 7 ngày. Nếu bạn không mong đợi lời mời này, hãy bỏ qua email.</p>',
            '</div>',
        ].join(''),
    });
}

export async function getWorkspaceAIRuntime(workspaceId: string): Promise<AIRuntimeSettings> {
    const ws = await workspaceRepo.findById(workspaceId);
    if (!ws || !ws.isActive) throw new AppError('Workspace không tồn tại', 404, 'NOT_FOUND');
    const settings = readWorkspaceSettings(ws.settings);
    return normalizeAIRuntime(settings.aiRuntime || {});
}

export const workspaceService = {
    async createWorkspace(name: string, slug: string, ownerId: string) {
        const existing = await workspaceRepo.findBySlug(slug);
        if (existing) throw new AppError('Slug đã được sử dụng', 409, 'DUPLICATE_SLUG');

        const workspace = await workspaceRepo.create({
            name,
            slug,
            ownerId,
        });

        const workspaceWithOwner = await workspaceRepo.addMember(workspace.id, { userId: ownerId, role: 'owner' });
        try {
            await provisionDefaultWorkspaceStarterKit(workspace.id, workspace.name);
        } catch (error) {
            console.error('[workspace] failed to provision default starter kit', {
                workspaceId: workspace.id,
                error: error instanceof Error ? error.message : error,
            });
        }
        return workspaceWithOwner || workspace;
    },

    async getWorkspace(id: string) {
        const ws = await workspaceRepo.findById(id);
        if (!ws || !ws.isActive) throw new AppError('Workspace không tồn tại', 404, 'NOT_FOUND');
        return ws;
    },

    async provisionStarterKit(workspaceId: string) {
        const ws = await workspaceRepo.findById(workspaceId);
        if (!ws || !ws.isActive) throw new AppError('Workspace khÃ´ng tá»“n táº¡i', 404, 'NOT_FOUND');

        await provisionDefaultWorkspaceStarterKit(ws.id, ws.name);

        const [totalWidgets, totalBots, activeBots, totalKnowledge] = await Promise.all([
            prisma.widget.count({ where: { workspaceId: ws.id, isActive: true } }),
            prisma.aIBot.count({ where: { workspaceId: ws.id } }),
            prisma.aIBot.count({ where: { workspaceId: ws.id, isActive: true } }),
            prisma.knowledgeEntry.count({ where: { workspaceId: ws.id } }),
        ]);

        return {
            workspaceId: ws.id,
            totalWidgets,
            totalBots,
            activeBots,
            totalKnowledge,
        };
    },

    async getSystemSupportWidget() {
        const settings = await settingsService.getAll();
        const enabled = settings[SETTINGS_KEYS.SYSTEM_SUPPORT_WIDGET_ENABLED] === 'true';
        const widgetId = settings[SETTINGS_KEYS.SYSTEM_SUPPORT_WIDGET_ID] || '';

        if (!enabled || !widgetId) {
            return { enabled: false };
        }

        const widget = await prisma.widget.findUnique({
            where: { id: widgetId },
            select: {
                id: true,
                name: true,
                workspaceId: true,
                isActive: true,
            },
        });

        if (!widget || !widget.isActive) {
            return { enabled: false };
        }

        return {
            enabled: true,
            widgetId: widget.id,
            widgetName: widget.name,
            workspaceId: widget.workspaceId,
            apiBase: normalizeWidgetApiBase(
                settings[SETTINGS_KEYS.SYSTEM_SUPPORT_WIDGET_API_BASE]
                || env.NEXT_PUBLIC_LANDING_WIDGET_API_BASE
                || env.NEXT_PUBLIC_API_URL
            ),
        };
    },

    async getDashboardStats(workspaceId: string) {
        const workspace = await workspaceRepo.findById(workspaceId);
        if (!workspace || !workspace.isActive) throw new AppError('Workspace không tồn tại', 404, 'NOT_FOUND');

        const [
            totalConversations,
            openConversations,
            closedConversations,
            widgets,
            pendingMessages,
            totalBots,
            activeBots,
            totalKnowledge
        ] = await Promise.all([
            conversationRepo.countByWorkspace(workspaceId),
            conversationRepo.countByWorkspace(workspaceId, 'open'),
            conversationRepo.countByWorkspace(workspaceId, 'closed'),
            widgetRepo.findByWorkspace(workspaceId),
            offlineMessageRepo.countPending(workspaceId),
            prisma.aIBot.count({ where: { workspaceId } }),
            prisma.aIBot.count({ where: { workspaceId, isActive: true } }),
            prisma.knowledgeEntry.count({ where: { workspaceId } })
        ]);

        return {
            overview: {
                name: workspace.name,
                domain: workspace.slug,
                status: workspace.isActive ? 'Hoạt động' : 'Tạm dừng',
                totalMembers: workspace.members.length,
                totalConversations,
                totalTickets: 0,
                totalCustomers: 0,
            },
            conversations: {
                total: totalConversations,
                open: openConversations,
                closed: closedConversations,
                missed: pendingMessages,
                transferred: 0,
            },
            customers: {
                totalVisitors: totalConversations, // simple proxy
                totalContacts: 0,
            },
            members: {
                total: workspace.members.length,
                online: 0, // To be hydrated by presence on client
            },
            config: {
                totalWidgets: widgets.length,
                totalBots,
                activeBots,
                totalKnowledge,
                activeRules: 0,
            },
            reports: {
                responseRate: '98%',
                csat: 4.8,
            },
            billing: {
                plan: 'Pro Plan',
                status: 'Active',
            }
        };
    },

    async getMyWorkspaces(userId: string) {
        return workspaceRepo.findByMemberUserId(userId);
    },

    async updateWorkspace(id: string, data: any) {
        const ws = await workspaceRepo.update(id, data);
        if (!ws) throw new AppError('Workspace không tồn tại', 404, 'NOT_FOUND');
        return ws;
    },

    async getAIRuntimeSettings(workspaceId: string) {
        const settings = await getWorkspaceAIRuntime(workspaceId);
        return maskAIRuntime(settings);
    },

    async updateAIRuntimeSettings(workspaceId: string, payload: Partial<AIRuntimeSettings> & { clearApiKey?: boolean }) {
        const ws = await workspaceRepo.findById(workspaceId);
        if (!ws || !ws.isActive) throw new AppError('Workspace không tồn tại', 404, 'NOT_FOUND');

        const currentSettings = readWorkspaceSettings(ws.settings);
        const currentRuntime = normalizeAIRuntime(currentSettings.aiRuntime || {});
        const { clearApiKey, ...runtimePayload } = payload;
        const nextRuntime = normalizeAIRuntime({
            ...currentRuntime,
            ...runtimePayload,
            apiKey: clearApiKey
                ? ''
                : (payload.apiKey && !isMaskedAIKey(payload.apiKey) ? payload.apiKey : currentRuntime.apiKey),
            updatedAt: new Date().toISOString(),
        });

        const updated = await workspaceRepo.update(workspaceId, {
            settings: {
                ...currentSettings,
                aiRuntime: nextRuntime,
            },
        } as Parameters<typeof workspaceRepo.update>[1]);
        const savedSettings = readWorkspaceSettings(updated?.settings);
        return maskAIRuntime(normalizeAIRuntime(savedSettings.aiRuntime || {}));
    },

    async testAIRuntimeSettings(workspaceId: string, payload?: Partial<AIRuntimeSettings>) {
        const current = await getWorkspaceAIRuntime(workspaceId);
        const runtime = normalizeAIRuntime({
            ...current,
            ...(payload || {}),
            apiKey: payload?.apiKey && !isMaskedAIKey(payload.apiKey) ? payload.apiKey : current.apiKey,
        });

        if (!runtime.enabled || runtime.provider === 'disabled') {
            throw new AppError('AI runtime đang tắt', 400, 'AI_DISABLED');
        }

        const startedAt = Date.now();
        const response = await aiService.completeRuntime(
            {
                baseUrl: runtime.baseUrl,
                apiKey: runtime.apiKey,
                timeoutMs: runtime.timeoutMs,
            },
            {
                model: runtime.model,
                messages: [
                    { role: 'system', content: 'Reply with the single word: ok' },
                    { role: 'user', content: 'healthcheck' },
                ],
                max_tokens: 8,
                temperature: 0,
            }
        );

        return {
            ok: Boolean(response.choices?.[0]?.message?.content),
            latencyMs: Date.now() - startedAt,
            model: response.model || runtime.model,
            baseUrl: runtime.baseUrl,
            sample: response.choices?.[0]?.message?.content || '',
            provider: response.provider,
        };
    },

    async addMember(workspaceId: string, email: string, role: string, invitedById?: string) {
        const ws = await workspaceRepo.findById(workspaceId);
        if (!ws) throw new AppError('Workspace không tồn tại', 404, 'NOT_FOUND');

        const normalizedEmail = normalizeEmail(email);
        const user = await userRepo.findByEmail(normalizedEmail);
        const inviter = invitedById ? await userRepo.findById(invitedById) : null;
        if (!user) {
            const rawToken = crypto.randomBytes(32).toString('hex');
            const tokenHash = hashInviteToken(rawToken);
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 7);

            await prisma.workspaceInvitation.deleteMany({ where: { workspaceId, email: normalizedEmail, acceptedAt: null } });
            await prisma.workspaceInvitation.create({
                data: { workspaceId, email: normalizedEmail, role, tokenHash, invitedById, expiresAt },
            });

            try {
                await sendWorkspaceInviteEmail({
                    to: normalizedEmail,
                    workspaceName: ws.name,
                    role,
                    link: makeInviteUrl(rawToken, normalizedEmail),
                    invitedByName: inviter?.name,
                });
            } catch (error) {
                await prisma.workspaceInvitation.deleteMany({ where: { tokenHash } });
                const safe = smtpService.safeError(error);
                console.warn('[Workspace] Invite email failed', { code: safe.code, phase: safe.phase });
                throw new AppError('Không gửi được email mời. Vui lòng kiểm tra SMTP hệ thống.', 503, 'INVITE_EMAIL_FAILED');
            }

            return { invited: true, email: normalizedEmail, role, expiresAt };
        }
        if (!user) throw new AppError('Người dùng chưa đăng ký tài khoản trong hệ thống', 404, 'USER_NOT_FOUND');

        const userId = user.id;

        const alreadyMember = ws.members.find((m) => (m.userId || (m as any).id)?.toString() === userId);
        if (alreadyMember) throw new AppError('Người dùng đã là thành viên', 409, 'ALREADY_MEMBER');

        return workspaceRepo.addMember(workspaceId, { userId, role });
    },

    async updateMemberRole(workspaceId: string, userId: string, role: string, actorId: string) {
        const ws = await workspaceRepo.findById(workspaceId);
        if (!ws) throw new AppError('Workspace khÃ´ng tá»“n táº¡i', 404, 'NOT_FOUND');
        const target = ws.members.find((m) => (m.userId || (m as any).id)?.toString() === userId);
        if (!target) throw new AppError('Thành viên không tồn tại trong workspace', 404, 'MEMBER_NOT_FOUND');
        if (target.role === 'owner') throw new AppError('Không thể đổi vai trò chủ sở hữu workspace', 400, 'OWNER_ROLE_LOCKED');
        if (userId === actorId && role !== target.role) throw new AppError('Bạn không thể tự đổi vai trò của chính mình', 400, 'SELF_ROLE_CHANGE');
        return workspaceRepo.updateMemberRole(workspaceId, userId, role);
    },

    async getInvitation(token: string) {
        const invitation = await prisma.workspaceInvitation.findUnique({
            where: { tokenHash: hashInviteToken(token) },
            include: { workspace: { select: { id: true, name: true, slug: true } } },
        });
        if (!invitation || invitation.acceptedAt || invitation.expiresAt < new Date()) {
            throw new AppError('Lời mời không hợp lệ hoặc đã hết hạn', 400, 'INVALID_INVITATION');
        }
        return {
            email: invitation.email,
            role: invitation.role,
            expiresAt: invitation.expiresAt,
            workspace: invitation.workspace,
        };
    },

    async acceptInvitation(token: string, userId: string) {
        const tokenHash = hashInviteToken(token);
        const user = await userRepo.findById(userId);
        if (!user) throw new AppError('Tài khoản không hợp lệ', 401, 'INVALID_USER');
        const invitation = await prisma.workspaceInvitation.findUnique({
            where: { tokenHash },
            include: { workspace: { select: { id: true, name: true } } },
        });
        if (!invitation || invitation.acceptedAt || invitation.expiresAt < new Date()) {
            throw new AppError('Lời mời không hợp lệ hoặc đã hết hạn', 400, 'INVALID_INVITATION');
        }
        if (normalizeEmail(user.email) !== invitation.email) {
            throw new AppError('Email tài khoản không khớp với email được mời', 403, 'INVITATION_EMAIL_MISMATCH');
        }
        await prisma.$transaction([
            prisma.workspaceMember.upsert({
                where: { workspaceId_userId: { workspaceId: invitation.workspaceId, userId } },
                create: { workspaceId: invitation.workspaceId, userId, role: invitation.role },
                update: { role: invitation.role },
            }),
            prisma.workspaceInvitation.update({
                where: { tokenHash },
                data: { acceptedAt: new Date() },
            }),
        ]);
        return { workspaceId: invitation.workspaceId, workspaceName: invitation.workspace.name, role: invitation.role };
    },

    async listInvitations(workspaceId: string) {
        const ws = await workspaceRepo.findById(workspaceId);
        if (!ws) throw new AppError('Workspace không tồn tại', 404, 'NOT_FOUND');

        const now = new Date();
        const invitations = await prisma.workspaceInvitation.findMany({
            where: { workspaceId, acceptedAt: null },
            include: {
                invitedBy: {
                    select: { id: true, name: true, email: true },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        return invitations.map((invitation) => ({
            id: invitation.id,
            email: invitation.email,
            role: invitation.role,
            invitedBy: invitation.invitedBy,
            expiresAt: invitation.expiresAt,
            createdAt: invitation.createdAt,
            status: invitation.expiresAt < now ? 'expired' : 'pending',
        }));
    },

    async cancelInvitation(workspaceId: string, invitationId: string) {
        const invitation = await prisma.workspaceInvitation.findFirst({
            where: { id: invitationId, workspaceId, acceptedAt: null },
            select: { id: true },
        });
        if (!invitation) throw new AppError('Lời mời không tồn tại hoặc đã được chấp nhận', 404, 'INVITATION_NOT_FOUND');

        await prisma.workspaceInvitation.delete({ where: { id: invitationId } });
        return { id: invitationId, cancelled: true };
    },

    async resendInvitation(workspaceId: string, invitationId: string, invitedById?: string) {
        const invitation = await prisma.workspaceInvitation.findFirst({
            where: { id: invitationId, workspaceId, acceptedAt: null },
            include: { workspace: { select: { name: true } } },
        });
        if (!invitation) throw new AppError('Lời mời không tồn tại hoặc đã được chấp nhận', 404, 'INVITATION_NOT_FOUND');

        const inviter = invitedById ? await userRepo.findById(invitedById) : null;
        const rawToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = hashInviteToken(rawToken);
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        await prisma.workspaceInvitation.update({
            where: { id: invitation.id },
            data: { tokenHash, expiresAt, invitedById },
        });

        try {
            await sendWorkspaceInviteEmail({
                to: invitation.email,
                workspaceName: invitation.workspace.name,
                role: invitation.role,
                link: makeInviteUrl(rawToken, invitation.email),
                invitedByName: inviter?.name,
            });
        } catch (error) {
            const safe = smtpService.safeError(error);
            console.warn('[Workspace] Resend invite email failed', { code: safe.code, phase: safe.phase });
            throw new AppError('Không gửi lại được email mời. Vui lòng kiểm tra SMTP hệ thống.', 503, 'INVITE_EMAIL_FAILED');
        }

        return {
            id: invitation.id,
            email: invitation.email,
            role: invitation.role,
            expiresAt,
            resent: true,
        };
    },

    async removeMember(workspaceId: string, userId: string) {
        return workspaceRepo.removeMember(workspaceId, userId);
    },

    async deleteWorkspace(id: string) {
        await workspaceRepo.delete(id);
    },

    async getMembers(workspaceId: string) {
        return workspaceRepo.getMembers(workspaceId);
    },

    // ── Tag registry CRUD ──

    async getTags(workspaceId: string) {
        return workspaceRepo.getTags(workspaceId);
    },

    async addTag(workspaceId: string, tag: string) {
        if (!tag || tag.trim().length === 0) throw new AppError('Tag không được rỗng', 400, 'VALIDATION_ERROR');
        return workspaceRepo.addTag(workspaceId, tag.trim().toLowerCase());
    },

    async removeTag(workspaceId: string, tag: string) {
        return workspaceRepo.removeTag(workspaceId, tag);
    },

    async updateTag(workspaceId: string, oldTag: string, newTag: string) {
        if (!newTag || newTag.trim().length === 0) throw new AppError('Tag mới không được rỗng', 400, 'VALIDATION_ERROR');
        return workspaceRepo.updateTag(workspaceId, oldTag, newTag.trim().toLowerCase());
    },

    // ── Label registry CRUD (colored tags, Zalo-style) ──

    async getLabels(workspaceId: string) {
        return workspaceRepo.getLabels(workspaceId);
    },

    async addLabel(workspaceId: string, name: string, color: string) {
        if (!name || name.trim().length === 0) throw new AppError('Tên nhãn không được rỗng', 400, 'VALIDATION_ERROR');
        if (!color || color.trim().length === 0) throw new AppError('Màu nhãn không được rỗng', 400, 'VALIDATION_ERROR');
        return workspaceRepo.addLabel(workspaceId, { name: name.trim(), color: color.trim() });
    },

    async removeLabel(workspaceId: string, name: string) {
        return workspaceRepo.removeLabel(workspaceId, name);
    },

    async updateLabel(workspaceId: string, oldName: string, newName: string, color: string) {
        if (!newName || newName.trim().length === 0) throw new AppError('Tên nhãn mới không được rỗng', 400, 'VALIDATION_ERROR');
        return workspaceRepo.updateLabel(workspaceId, oldName, { name: newName.trim(), color: color.trim() });
    },

    async getAgentPerformance(workspaceId: string) {
        const workspace = await workspaceRepo.findById(workspaceId);
        if (!workspace || !workspace.isActive) throw new AppError('Workspace không tồn tại', 404, 'NOT_FOUND');

        const memberIds = workspace.members.map((m) => (m.userId || (m as any).id)?.toString());

        const [convStats, msgCounts, users] = await Promise.all([
            conversationRepo.getAgentConversationStats(workspaceId),
            conversationRepo.getAgentMessageCounts(workspaceId),
            userRepo.findByIds(memberIds),
        ]);

        // Build user info map
        const userMap = new Map<string, { name: string; email: string }>();
        for (const u of users) {
            userMap.set(u.id, { name: u.name || 'Unknown', email: u.email || '' });
        }

        // Build message count map (sender.id is stored as string)
        const msgMap = new Map<string, number>();
        for (const m of msgCounts) {
            msgMap.set(String(m._id), m.messagesSent);
        }

        // Build conv stats map
        const statsMap = new Map<string, {
            total: number; open: number; closed: number; pending: number;
            lastActivity: Date | null;
        }>();
        for (const s of convStats) {
            statsMap.set(String(s._id), s);
        }

        // Merge with workspace members
        const results = workspace.members.map((member) => {
            const memberId = (member.userId || (member as any).id)?.toString();
            const stat = statsMap.get(memberId);
            const userInfo = userMap.get(memberId);

            const total = stat?.total ?? 0;
            const open = stat?.open ?? 0;
            const closed = stat?.closed ?? 0;
            const pending = stat?.pending ?? 0;
            const messagesSent = msgMap.get(memberId) ?? 0;
            const closeRate = total > 0 ? Math.round((closed / total) * 100) : 0;

            return {
                userId: memberId,
                name: userInfo?.name ?? 'Unknown',
                email: userInfo?.email ?? '',
                role: member.role,
                joinedAt: member.joinedAt,
                stats: {
                    total,
                    open,
                    closed,
                    pending,
                    closeRate,
                    messagesSent,
                    lastActivity: stat?.lastActivity ?? null,
                },
            };
        });

        // Sort by total conversations descending
        results.sort((a, b) => b.stats.total - a.stats.total);

        return results;
    },
};

type WidgetEntitlements = { whiteLabel: boolean; customCss: boolean };

const sanitizeWidgetCss = (value: unknown) => {
    const css = typeof value === 'string' ? value.trim().slice(0, 12000) : '';
    if (!css) return '';
    const forbidden = /(?:<\/?style|@import|javascript\s*:|expression\s*\(|behavior\s*:|-moz-binding|url\s*\()/i;
    if (forbidden.test(css)) {
        throw new AppError('CSS widget chứa cú pháp không an toàn', 400, 'WIDGET_CSS_UNSAFE');
    }
    return css;
};

const applyWidgetEntitlements = (rawConfig: unknown, entitlements: WidgetEntitlements) => {
    const config = rawConfig && typeof rawConfig === 'object' && !Array.isArray(rawConfig)
        ? rawConfig as Record<string, unknown>
        : {};
    const requestedMode = String(config.brandingMode || '');
    const brandingMode = entitlements.whiteLabel
        ? (['nemark', 'custom', 'hidden'].includes(requestedMode) ? requestedMode : 'hidden')
        : 'nemark';
    return {
        ...config,
        brandingMode,
        showBranding: brandingMode !== 'hidden',
        brandingName: brandingMode === 'custom' ? String(config.brandingName || '').trim().slice(0, 80) : '',
        brandingUrl: brandingMode === 'custom' ? String(config.brandingUrl || '').trim().slice(0, 500) : '',
        themePreset: entitlements.customCss && ['modern', 'minimal', 'glass', 'compact'].includes(String(config.themePreset))
            ? config.themePreset
            : 'modern',
        customCss: entitlements.customCss ? sanitizeWidgetCss(config.customCss) : '',
        entitlements,
    };
};

export const widgetService = {
    async createWidget(workspaceId: string, data: any) {
        const entitlements = await subscriptionService.getWidgetEntitlements(workspaceId);
        return widgetRepo.create({
            ...data,
            workspaceId: workspaceId as any,
            config: applyWidgetEntitlements(data.config, entitlements),
        });
    },

    async getWidget(id: string) {
        const w = await widgetRepo.findById(id);
        if (!w || !w.isActive) throw new AppError('Widget không tồn tại', 404, 'NOT_FOUND');
        return w;
    },

    async getWidgetsByWorkspace(workspaceId: string) {
        return widgetRepo.findByWorkspace(workspaceId);
    },

    async updateWidget(workspaceId: string, id: string, data: any) {
        const entitlements = await subscriptionService.getWidgetEntitlements(workspaceId);
        const w = await widgetRepo.update(id, {
            ...data,
            ...(data.config ? { config: applyWidgetEntitlements(data.config, entitlements) } : {}),
        });
        if (!w) throw new AppError('Widget không tồn tại', 404, 'NOT_FOUND');
        return w;
    },

    async deleteWidget(id: string) {
        await widgetRepo.delete(id);
    },

    /**
     * Check if a domain is allowed to load the widget.
     * Returns true if allowed, false if blocked.
     */
    async checkDomain(widgetId: string, origin: string): Promise<boolean> {
        const widget = await widgetRepo.findById(widgetId);
        if (!widget || !widget.isActive) return false;

        const domainRules = widget.domainRules && typeof widget.domainRules === 'object' && !Array.isArray(widget.domainRules)
            ? widget.domainRules as Record<string, unknown>
            : {};
        const mode = typeof domainRules.mode === 'string' ? domainRules.mode : 'allow_all';
        const domains = Array.isArray(domainRules.domains) ? domainRules.domains.filter((item): item is string => typeof item === 'string') : [];
        // Normalise: extract hostname from origin
        let hostname: string;
        try {
            hostname = new URL(origin).hostname;
        } catch {
            hostname = origin; // fallback if just a hostname string
        }

        const matches = domains.some((d) => {
            // Support wildcard: *.example.com
            if (d.startsWith('*.')) {
                const suffix = d.slice(2);
                return hostname === suffix || hostname.endsWith('.' + suffix);
            }
            return hostname === d;
        });

        if (mode === 'allowlist') return matches;
        if (mode === 'blocklist') return !matches;
        return true;
    },

    /**
     * Public endpoint to load widget config (no auth needed).
     * Used by the embedded widget script.
     */
    async getPublicConfig(widgetId: string) {
        const widget = await widgetRepo.findById(widgetId);
        if (!widget || !widget.isActive) throw new AppError('Widget không tồn tại', 404, 'NOT_FOUND');

        // Populate workspace for business hours
        const workspace = await workspaceRepo.findById(widget.workspaceId.toString());
        const workspaceSettings = workspace?.settings && typeof workspace.settings === 'object' && !Array.isArray(workspace.settings)
            ? workspace.settings as Record<string, unknown>
            : {};
        const bh = workspaceSettings.businessHours && typeof workspaceSettings.businessHours === 'object' && !Array.isArray(workspaceSettings.businessHours)
            ? workspaceSettings.businessHours as Record<string, unknown>
            : {};
        const tz = typeof workspaceSettings.timezone === 'string' ? workspaceSettings.timezone : 'Asia/Ho_Chi_Minh';

        const entitlements = await subscriptionService.getWidgetEntitlements(widget.workspaceId.toString());
        return {
            id: widget.id,
            workspaceId: widget.workspaceId,
            name: widget.name,
            config: applyWidgetEntitlements(widget.config, entitlements),
            domainRules: widget.domainRules,
            businessHours: {
                enabled: bh.enabled === true,
                timezone: tz,
                schedule: Array.isArray(bh.schedule) ? bh.schedule : [],
                holidays: Array.isArray(bh.holidays) ? bh.holidays : [],
            },
        };
    },
};

export const offlineMessageService = {
    async createOfflineMessage(widgetId: string, data: { name: string; email: string; message: string; visitorId: string }) {
        const widget = await widgetRepo.findById(widgetId);
        if (!widget || !widget.isActive) throw new AppError('Widget không tồn tại', 404, 'NOT_FOUND');

        return offlineMessageRepo.create({
            widgetId: widget.id as any,
            workspaceId: widget.workspaceId,
            visitorId: data.visitorId,
            name: data.name,
            email: data.email,
            message: data.message,
            status: 'pending',
        });
    },

    async getOfflineMessages(workspaceId: string, options?: { status?: string; page?: number; limit?: number }) {
        return offlineMessageRepo.findByWorkspace(workspaceId, options);
    },

    async markAsRead(id: string) {
        const msg = await offlineMessageRepo.updateStatus(id, 'read');
        if (!msg) throw new AppError('Tin nhắn không tồn tại', 404, 'NOT_FOUND');
        return msg;
    },

    async markAsReplied(id: string) {
        const msg = await offlineMessageRepo.updateStatus(id, 'replied');
        if (!msg) throw new AppError('Tin nhắn không tồn tại', 404, 'NOT_FOUND');
        return msg;
    },

    async countPending(workspaceId: string) {
        return offlineMessageRepo.countPending(workspaceId);
    },
};
