import crypto from 'node:crypto';
import type { CampaignRecipient } from '@prisma/client';
import { campaignRepo } from './repos/campaign.repo';
import type { CampaignStatus } from './repos/campaign.repo';
import { zaloService } from '../zalo/zalo.service';
import { getZaloGroupMembers } from '../../infra/zaloService';
import { zaloAccountRepo } from '../zalo/repos/zalo-account.repo';
import { isZaloSessionConnected } from '../../infra/zaloService';
import prisma from '../../infra/prisma';
import { AppError } from '../../middlewares/errorHandler';
import { env } from '../../config/env';
import {
    normalizeSmtpConfig,
    sendSmtpMail,
    smtpService,
    type SmtpConfig,
} from '../email/smtp.service';
import { revealEmailTransportConfig } from '../email/email-account-secrets';
import { systemNotificationService } from '../notification/system-notification.service';
import { telegramNotifier, TelegramNotifierError } from '../notification/telegram-notifier.service';
import { decryptSecret } from '../../infra/secretVault';

// ── Types (aligned with Prisma JSON fields) ──

interface CampaignAudience {
    type: 'all' | 'filter' | 'manual' | 'group';
    filters?: {
        source?: string;
        minMessages?: number;
        lastActiveWithinDays?: number;
        tags?: string[];
    };
    manualIds?: string[];
    groupId?: string;
}

export interface CampaignSchedule {
    startAt?: Date | string;
    sendWindow?: { startHour: number; endHour: number };
}

interface CampaignAntiSpam {
    delayBetweenMs: number;
    messageDelayMs: number;
    maxPerHour: number;
    randomizeDelay: boolean;
    batchSize: number;
}

type CampaignChannel = 'zalo' | 'telegram' | 'email';

interface TelegramDestination {
    chatId: string;
    messageThreadId?: number;
}

interface TelegramCampaignConfig {
    enabled: true;
    botToken: string;
    chatId?: string;
}

interface EmailCampaignContent {
    subject: string;
    html: string;
    text: string;
}

interface ResolvedEmailRecipient {
    leadId: string;
    email: string;
    displayName: string;
    suppressed: boolean;
}

const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

interface CampaignProgress {
    campaignId: string;
    status: CampaignStatus;
    sent: number;
    failed: number;
    total: number;
    currentRecipient?: string;
    estimatedRemainingMs?: number;
}

interface CampaignJobState {
    paused: boolean;
    abortController: AbortController;
    progress: CampaignProgress;
    hourlySent: number; // Individual message attempts, not completed recipients.
    hourlyResetAt: number;
}

export const normalizeRecipientIds = (value: unknown): string[] => {
    if (!Array.isArray(value)) return [];

    const uniqueIds = new Set<string>();
    value.forEach(rawId => {
        if (typeof rawId !== 'string') return;
        const id = rawId.trim();
        if (id) uniqueIds.add(id);
    });
    return Array.from(uniqueIds);
};

export const normalizeTelegramDestination = (value: unknown): string | null => {
    if (typeof value !== 'string' && typeof value !== 'number') return null;
    const raw = String(value).trim();
    const match = raw.match(/^(-?\d{1,20}|@[A-Za-z][A-Za-z0-9_]{4,31})(?:#(\d{1,10}))?$/);
    if (!match) return null;
    const topicId = match[2] ? Number(match[2]) : undefined;
    if (topicId !== undefined && (!Number.isSafeInteger(topicId) || topicId <= 0)) return null;
    return topicId ? `${match[1]}#${topicId}` : match[1];
};

export const normalizeTelegramDestinations = (value: unknown): string[] => {
    if (!Array.isArray(value)) return [];
    const unique = new Set<string>();
    value.forEach(item => {
        const destination = normalizeTelegramDestination(item);
        if (destination) unique.add(destination);
    });
    return Array.from(unique);
};

const parseTelegramDestination = (value: string): TelegramDestination => {
    const normalized = normalizeTelegramDestination(value);
    if (!normalized) throw new AppError('Đích Telegram không hợp lệ', 400, 'CAMPAIGN_TELEGRAM_DESTINATION_INVALID');
    const [chatId, topic] = normalized.split('#');
    return { chatId, ...(topic ? { messageThreadId: Number(topic) } : {}) };
};

const normalizeEmails = (value: unknown): string[] => {
    if (!Array.isArray(value)) return [];
    const emails = new Set<string>();
    value.forEach(rawEmail => {
        if (typeof rawEmail !== 'string') return;
        const email = rawEmail.trim().toLowerCase();
        if (EMAIL_RE.test(email)) emails.add(email);
    });
    return Array.from(emails);
};

export const getFutureScheduleStart = (
    schedule: CampaignSchedule | null | undefined,
    nowMs = Date.now(),
): Date | null => {
    if (!schedule?.startAt) return null;
    const startAt = new Date(schedule.startAt);
    if (Number.isNaN(startAt.getTime()) || startAt.getTime() <= nowMs) return null;
    return startAt;
};

const normalizeCampaignAudience = (
    audience: CampaignAudience | null | undefined,
    channel: CampaignChannel = 'zalo',
): CampaignAudience => {
    if (!audience || !['all', 'filter', 'manual', 'group'].includes(audience.type)) {
        throw new AppError('Đối tượng chiến dịch không hợp lệ', 400, 'CAMPAIGN_INVALID_AUDIENCE');
    }

    if (audience.type === 'manual') {
        const manualIds = channel === 'email'
            ? normalizeEmails(audience.manualIds)
            : channel === 'telegram'
                ? normalizeTelegramDestinations(audience.manualIds)
                : normalizeRecipientIds(audience.manualIds);
        if (manualIds.length === 0) {
            throw new AppError(
                channel === 'email'
                    ? 'Cần ít nhất 1 email hợp lệ khi chọn đối tượng thủ công'
                    : channel === 'telegram'
                        ? 'Cần ít nhất 1 Chat ID Telegram; topic dùng dạng chat_id#topic_id'
                    : 'Cần ít nhất 1 Zalo User ID khi chọn đối tượng thủ công',
                400,
                'CAMPAIGN_MANUAL_AUDIENCE_EMPTY',
            );
        }
        return { ...audience, manualIds };
    }

    if (audience.type === 'group') {
        if (channel !== 'zalo') {
            throw new AppError('Nhóm Zalo chỉ áp dụng cho campaign Zalo', 400, 'CAMPAIGN_GROUP_UNSUPPORTED');
        }
        const groupId = audience.groupId?.trim();
        if (!groupId) throw new AppError('Cần chọn nhóm Zalo cho chiến dịch', 400, 'CAMPAIGN_GROUP_REQUIRED');
        return { ...audience, groupId };
    }

    if (channel === 'telegram') {
        throw new AppError('Campaign Telegram cần danh sách Chat ID thủ công', 400, 'CAMPAIGN_TELEGRAM_MANUAL_REQUIRED');
    }

    return audience;
};

const normalizeChannel = (value: unknown): CampaignChannel => {
    if (value === undefined || value === null || value === '') return 'zalo';
    if (value === 'zalo' || value === 'telegram' || value === 'email') return value;
    throw new AppError('Kênh campaign không hợp lệ', 400, 'CAMPAIGN_INVALID_CHANNEL');
};

const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
}[character] || character));

class CampaignService {
    // In-memory tracking for running campaigns
    private activeJobs = new Map<string, CampaignJobState>();

    /**
     * Create a new campaign (draft)
     */
    async create(workspaceId: string, userId: string, data: {
        name: string;
        channel?: CampaignChannel;
        messages?: string[];
        subject?: string;
        emailHtml?: string;
        emailText?: string;
        emailAccountId?: string;
        audience: CampaignAudience;
        schedule?: CampaignSchedule;
        antiSpam?: Partial<CampaignAntiSpam>;
    }) {
        const channel = normalizeChannel(data.channel);
        if (!data.name?.trim()) throw new AppError('Cần đặt tên campaign', 400, 'CAMPAIGN_NAME_REQUIRED');
        const audience = normalizeCampaignAudience(data.audience, channel);
        const messages = (data.messages || []).map(item => item.trim()).filter(Boolean);
        const subject = (data.subject || '').trim();
        const emailHtml = (data.emailHtml || '').trim();
        const emailText = (data.emailText || '').trim();

        if (channel !== 'email') {
            if (!messages.length) throw new AppError('Cần ít nhất 1 tin nhắn', 400, 'CAMPAIGN_MESSAGES_EMPTY');
            if (messages.length > 10) throw new AppError('Tối đa 10 tin nhắn mỗi campaign', 400, 'CAMPAIGN_MESSAGES_LIMIT');
            if (messages.some(item => item.length > 4000)) throw new AppError('Mỗi tin nhắn tối đa 4.000 ký tự', 400, 'CAMPAIGN_MESSAGE_LIMIT');
            if (channel === 'telegram') await this.resolveTelegramConfig(workspaceId);
        } else {
            if (!subject) throw new AppError('Campaign Email cần tiêu đề', 400, 'CAMPAIGN_EMAIL_SUBJECT_REQUIRED');
            if (subject.length > 240) throw new AppError('Tiêu đề Email tối đa 240 ký tự', 400, 'CAMPAIGN_EMAIL_SUBJECT_LIMIT');
            if (!emailHtml && !emailText) {
                throw new AppError('Campaign Email cần nội dung HTML hoặc văn bản', 400, 'CAMPAIGN_EMAIL_BODY_REQUIRED');
            }
            if (!data.emailAccountId) {
                throw new AppError('Cần chọn tài khoản gửi Email', 400, 'CAMPAIGN_EMAIL_ACCOUNT_REQUIRED');
            }
            await this.resolveEmailAccount(workspaceId, data.emailAccountId);
        }

        const minDelayMs = channel === 'zalo' ? 5000 : 1000;
        const maxHourlyLimit = channel === 'email' ? 500 : channel === 'telegram' ? 300 : 100;

        const campaign = await campaignRepo.create({
            workspaceId,
            name: data.name.trim(),
            channel,
            status: 'draft',
            messages,
            subject,
            emailHtml: emailHtml || null,
            emailText: emailText || null,
            emailAccountId: channel === 'email' ? data.emailAccountId : null,
            audience,
            schedule: data.schedule || { startAt: new Date() },
            antiSpam: {
                delayBetweenMs: Math.max(data.antiSpam?.delayBetweenMs || (channel === 'email' ? 2000 : 8000), minDelayMs),
                messageDelayMs: Math.min(Math.max(data.antiSpam?.messageDelayMs || 1200, 500), 10_000),
                maxPerHour: Math.min(Math.max(data.antiSpam?.maxPerHour || (channel === 'email' ? 100 : 30), 5), maxHourlyLimit),
                randomizeDelay: data.antiSpam?.randomizeDelay !== false,
                batchSize: Math.min(Math.max(data.antiSpam?.batchSize || 10, 1), 25),
            },
            recipientIds: [],
            createdById: userId,
        });

        return campaign;
    }

    /**
     * Update a draft campaign
     */
    async update(campaignId: string, workspaceId: string, data: Partial<{
        name: string;
        channel: CampaignChannel;
        messages: string[];
        subject: string;
        emailHtml: string;
        emailText: string;
        emailAccountId: string;
        audience: CampaignAudience;
        schedule: CampaignSchedule;
        antiSpam: Partial<CampaignAntiSpam>;
    }>) {
        const campaign = await campaignRepo.findById(campaignId);
        if (!campaign) throw new Error('Campaign không tồn tại');
        if (campaign.workspaceId !== workspaceId) throw new Error('Không có quyền');
        if (campaign.status !== 'draft') throw new Error('Chỉ có thể chỉnh sửa campaign ở trạng thái nháp');

        const current = campaign as any;
        const channel = normalizeChannel(current.channel || 'zalo');
        if (data.channel && data.channel !== channel) {
            throw new AppError('Không thể đổi kênh sau khi tạo campaign', 400, 'CAMPAIGN_CHANNEL_IMMUTABLE');
        }

        const updateData: any = {};
        if (data.name) updateData.name = data.name.trim();
        if (data.messages) updateData.messages = data.messages.map(item => item.trim()).filter(Boolean);
        if (data.subject !== undefined) updateData.subject = data.subject.trim();
        if (data.emailHtml !== undefined) updateData.emailHtml = data.emailHtml.trim() || null;
        if (data.emailText !== undefined) updateData.emailText = data.emailText.trim() || null;
        if (data.emailAccountId !== undefined) updateData.emailAccountId = data.emailAccountId;
        if (data.audience) updateData.audience = normalizeCampaignAudience(data.audience, channel);
        if (data.schedule) updateData.schedule = data.schedule;
        if (data.antiSpam) {
            const currentAntiSpam = (campaign.antiSpam as any) || {};
            const minDelayMs = channel === 'zalo' ? 5000 : 1000;
            const maxHourlyLimit = channel === 'email' ? 500 : channel === 'telegram' ? 300 : 100;
            updateData.antiSpam = {
                delayBetweenMs: Math.max(data.antiSpam.delayBetweenMs || currentAntiSpam.delayBetweenMs || 8000, minDelayMs),
                messageDelayMs: Math.min(Math.max(data.antiSpam.messageDelayMs || currentAntiSpam.messageDelayMs || 1200, 500), 10_000),
                maxPerHour: Math.min(Math.max(data.antiSpam.maxPerHour || currentAntiSpam.maxPerHour || 30, 5), maxHourlyLimit),
                randomizeDelay: data.antiSpam.randomizeDelay ?? currentAntiSpam.randomizeDelay ?? true,
                batchSize: Math.min(Math.max(data.antiSpam.batchSize || currentAntiSpam.batchSize || 10, 1), 25),
            };
        }

        if (channel === 'email') {
            const subject = updateData.subject ?? current.subject ?? '';
            const emailHtml = updateData.emailHtml ?? current.emailHtml ?? '';
            const emailText = updateData.emailText ?? current.emailText ?? '';
            const emailAccountId = updateData.emailAccountId ?? current.emailAccountId;
            if (!subject.trim()) throw new AppError('Campaign Email cần tiêu đề', 400, 'CAMPAIGN_EMAIL_SUBJECT_REQUIRED');
            if (subject.length > 240) throw new AppError('Tiêu đề Email tối đa 240 ký tự', 400, 'CAMPAIGN_EMAIL_SUBJECT_LIMIT');
            if (!emailHtml && !emailText) throw new AppError('Campaign Email cần nội dung', 400, 'CAMPAIGN_EMAIL_BODY_REQUIRED');
            if (!emailAccountId) throw new AppError('Cần chọn tài khoản gửi Email', 400, 'CAMPAIGN_EMAIL_ACCOUNT_REQUIRED');
            await this.resolveEmailAccount(workspaceId, emailAccountId);
        }

        return campaignRepo.update(campaignId, updateData);
    }

    private async resolveEmailAccount(workspaceId: string, emailAccountId: string): Promise<{
        config: SmtpConfig;
        account: { id: string; email: string; displayName: string };
    }> {
        const account = await prisma.emailAccount.findFirst({
            where: {
                id: emailAccountId,
                workspaceId,
                isActive: true,
                allowSend: true,
            },
        });
        if (!account) {
            throw new AppError(
                'Tài khoản Email không tồn tại, đã tắt hoặc không cho phép gửi',
                400,
                'CAMPAIGN_EMAIL_ACCOUNT_UNAVAILABLE',
            );
        }

        const smtp = revealEmailTransportConfig(account.smtp);
        const config = normalizeSmtpConfig({
            enabled: true,
            host: typeof smtp.host === 'string' ? smtp.host : undefined,
            port: typeof smtp.port === 'string' || typeof smtp.port === 'number' ? smtp.port : undefined,
            secure: typeof smtp.secure === 'string' || typeof smtp.secure === 'boolean' ? smtp.secure : undefined,
            requireTls: typeof smtp.requireTls === 'string' || typeof smtp.requireTls === 'boolean' ? smtp.requireTls : undefined,
            user: typeof smtp.user === 'string' ? smtp.user : undefined,
            password: typeof smtp.password === 'string' ? smtp.password : undefined,
            fromEmail: account.email,
            fromName: account.displayName,
        });
        if (!config.enabled) {
            throw new AppError('SMTP của tài khoản Email đang tắt', 400, 'CAMPAIGN_SMTP_DISABLED');
        }
        return {
            config,
            account: { id: account.id, email: account.email, displayName: account.displayName },
        };
    }

    private async resolveEmailAudience(
        workspaceId: string,
        audience: CampaignAudience,
    ): Promise<ResolvedEmailRecipient[]> {
        const normalizedAudience = normalizeCampaignAudience(audience, 'email');
        const where: any = {
            workspaceId,
            marketingConsent: true,
            email: { not: '' },
        };

        if (normalizedAudience.type === 'manual') {
            where.email = { in: normalizedAudience.manualIds! };
        } else if (normalizedAudience.type === 'filter' && normalizedAudience.filters) {
            if (normalizedAudience.filters.source) where.source = normalizedAudience.filters.source;
            if (normalizedAudience.filters.minMessages) {
                where.conversationCount = { gte: normalizedAudience.filters.minMessages };
            }
            if (normalizedAudience.filters.lastActiveWithinDays) {
                const cutoff = new Date();
                cutoff.setDate(cutoff.getDate() - normalizedAudience.filters.lastActiveWithinDays);
                where.lastContactedAt = { gte: cutoff };
            }
        }

        const leads = await prisma.lead.findMany({
            where,
            orderBy: { updatedAt: 'desc' },
            select: { id: true, email: true, name: true },
        });
        const unique = new Map<string, { id: string; email: string; name: string }>();
        for (const lead of leads) {
            const email = lead.email.trim().toLowerCase();
            if (!EMAIL_RE.test(email) || unique.has(email)) continue;
            unique.set(email, { ...lead, email });
        }
        if (unique.size === 0) return [];

        const suppressions = await prisma.emailSuppression.findMany({
            where: { workspaceId, email: { in: Array.from(unique.keys()) } },
            select: { email: true },
        });
        const suppressedEmails = new Set(suppressions.map(item => item.email.trim().toLowerCase()));
        return Array.from(unique.values()).map(lead => ({
            leadId: lead.id,
            email: lead.email,
            displayName: lead.name.trim().slice(0, 120),
            suppressed: suppressedEmails.has(lead.email),
        }));
    }

    private async resolveTelegramConfig(workspaceId: string): Promise<TelegramCampaignConfig> {
        const setting = await prisma.signalAlertSetting.findUnique({ where: { workspaceId } });
        if (!setting?.telegramBotTokenEncrypted) {
            throw new AppError(
                'Chưa cấu hình Telegram Bot Token. Hãy cấu hình tại Radar tín hiệu trước.',
                400,
                'CAMPAIGN_TELEGRAM_NOT_CONFIGURED',
            );
        }
        return {
            enabled: true,
            botToken: decryptSecret(setting.telegramBotTokenEncrypted),
            chatId: setting.telegramChatId || undefined,
        };
    }

    async getTelegramStatus(workspaceId: string) {
        const setting = await prisma.signalAlertSetting.findUnique({ where: { workspaceId } });
        return {
            configured: Boolean(setting?.telegramBotTokenEncrypted),
            defaultChatId: setting?.telegramChatId || '',
            enabledForAlerts: setting?.telegramEnabled || false,
        };
    }

    async discoverTelegramDestinations(workspaceId: string) {
        const config = await this.resolveTelegramConfig(workspaceId);
        try {
            return await telegramNotifier.discoverChats({ config, limit: 100 });
        } catch (error) {
            const detail = error instanceof Error ? error.message : 'Không thể đọc danh sách chat';
            throw new AppError(
                `Không thể tự dò chat Telegram: ${detail}`,
                400,
                'CAMPAIGN_TELEGRAM_DISCOVERY_FAILED',
            );
        }
    }

    /**
     * Resolve audience → list of Zalo threadIds (uses Prisma Lead/ZaloContact)
     */
    private async resolveAudience(workspaceId: string, audience: CampaignAudience): Promise<string[]> {
        const normalizedAudience = normalizeCampaignAudience(audience);

        if (normalizedAudience.type === 'manual') {
            return normalizedAudience.manualIds!;
        }

        // Group audience: fetch members directly from Zalo session
        if (normalizedAudience.type === 'group') {
            const accounts = await zaloAccountRepo.findByWorkspaceId(workspaceId);
            const connected = accounts.find(a => isZaloSessionConnected(a.id));
            if (!connected) throw new Error('Tài khoản Zalo chưa kết nối');
            const sessionId = connected.id;
            const members = await getZaloGroupMembers(sessionId, normalizedAudience.groupId!);
            return normalizeRecipientIds(members.map(m => m.userId));
        }

        // For 'all' or 'filter': query Leads from Prisma
        const where: any = { workspaceId, zaloUserId: { not: '' } };

        if (normalizedAudience.type === 'filter' && normalizedAudience.filters) {
            if (normalizedAudience.filters.source) {
                where.source = normalizedAudience.filters.source;
            }
            if (normalizedAudience.filters.lastActiveWithinDays) {
                const cutoff = new Date();
                cutoff.setDate(cutoff.getDate() - normalizedAudience.filters.lastActiveWithinDays);
                where.lastContactedAt = { gte: cutoff };
            }
        }

        const leads = await prisma.lead.findMany({
            where,
            select: { zaloUserId: true },
        });

        return normalizeRecipientIds(leads.map(l => l.zaloUserId));
    }

    /**
     * Start a campaign execution
     */
    async start(campaignId: string, workspaceId: string): Promise<{ total: number; scheduledAt?: string }> {
        const campaign = await campaignRepo.findById(campaignId);
        if (!campaign) throw new Error('Campaign không tồn tại');
        if (campaign.workspaceId !== workspaceId) throw new Error('Không có quyền');
        if (!['draft', 'scheduled', 'paused'].includes(campaign.status)) {
            throw new AppError(`Không thể bắt đầu campaign ở trạng thái: ${campaign.status}`, 409, 'CAMPAIGN_STATE_CONFLICT');
        }

        const scheduledStart = getFutureScheduleStart(campaign.schedule as unknown as CampaignSchedule);
        if (scheduledStart) {
            if (campaign.status === 'scheduled') {
                return { total: 0, scheduledAt: scheduledStart.toISOString() };
            }
            if (campaign.status === 'draft') {
                const scheduled = await campaignRepo.claimForSchedule(campaignId, workspaceId);
                if (!scheduled) throw new AppError('Trạng thái campaign vừa thay đổi; vui lòng tải lại', 409, 'CAMPAIGN_SCHEDULE_CONFLICT');
                return { total: 0, scheduledAt: scheduledStart.toISOString() };
            }
            throw new AppError(
                `Campaign đang tạm dừng và thời gian chạy là ${scheduledStart.toLocaleString('vi-VN')}`,
                409,
                'CAMPAIGN_SCHEDULE_NOT_DUE',
            );
        }

        const storedCampaign = campaign as any;
        const channel = normalizeChannel(storedCampaign.channel || 'zalo');
        const audience = normalizeCampaignAudience(campaign.audience as unknown as CampaignAudience, channel);
        let startIndex = campaign.currentIndex || 0;
        let recipientIds = normalizeRecipientIds(campaign.recipientIds);
        let resolvedEmailRecipients: ResolvedEmailRecipient[] = [];
        let smtpConfig: SmtpConfig | null = null;
        let emailContent: EmailCampaignContent | null = null;
        let telegramConfig: TelegramCampaignConfig | null = null;
        const shouldPersistRecipients = campaign.status === 'draft' || recipientIds.length === 0;

        if (channel === 'email') {
            if (!storedCampaign.emailAccountId) {
                throw new AppError('Cần chọn tài khoản gửi Email', 400, 'CAMPAIGN_EMAIL_ACCOUNT_REQUIRED');
            }
            const resolvedAccount = await this.resolveEmailAccount(workspaceId, storedCampaign.emailAccountId);
            smtpConfig = resolvedAccount.config;
            emailContent = {
                subject: String(storedCampaign.subject || '').trim(),
                html: String(storedCampaign.emailHtml || '').trim(),
                text: String(storedCampaign.emailText || '').trim(),
            };
            if (!emailContent.subject || (!emailContent.html && !emailContent.text)) {
                throw new AppError('Nội dung campaign Email chưa hợp lệ', 400, 'CAMPAIGN_EMAIL_CONTENT_INVALID');
            }
            if (shouldPersistRecipients) {
                resolvedEmailRecipients = await this.resolveEmailAudience(workspaceId, audience);
                recipientIds = resolvedEmailRecipients.map(recipient => recipient.email);
                startIndex = 0;
            }
        } else if (channel === 'telegram') {
            telegramConfig = await this.resolveTelegramConfig(workspaceId);
            if (shouldPersistRecipients) {
                recipientIds = normalizeTelegramDestinations(audience.manualIds);
                startIndex = 0;
            }
        } else if (shouldPersistRecipients) {
            recipientIds = await this.resolveAudience(workspaceId, audience);
            startIndex = 0;
        }

        recipientIds = channel === 'email'
            ? normalizeEmails(recipientIds)
            : channel === 'telegram'
                ? normalizeTelegramDestinations(recipientIds)
                : normalizeRecipientIds(recipientIds);
        if (recipientIds.length === 0) {
            throw new AppError(
                channel === 'email'
                    ? 'Không có lead nào vừa có email hợp lệ vừa đồng ý nhận marketing'
                    : 'Không tìm thấy người nhận nào phù hợp',
                400,
                'CAMPAIGN_AUDIENCE_EMPTY',
            );
        }

        const previousStatus = campaign.status as 'draft' | 'scheduled' | 'paused';
        const claimed = await campaignRepo.claimForStart(campaignId, workspaceId, previousStatus);
        if (!claimed) {
            throw new AppError(
                'Campaign đã được bắt đầu hoặc trạng thái vừa thay đổi; vui lòng tải lại',
                409,
                'CAMPAIGN_START_CONFLICT',
            );
        }

        try {
            if (channel === 'email' && shouldPersistRecipients) {
                await campaignRepo.prepareEmailRecipients(
                    campaignId,
                    workspaceId,
                    resolvedEmailRecipients.map(recipient => ({
                        leadId: recipient.leadId,
                        recipient: recipient.email,
                        normalizedRecipient: recipient.email,
                        displayName: recipient.displayName,
                        status: recipient.suppressed ? 'suppressed' : 'pending',
                        idempotencyKey: crypto
                            .createHash('sha256')
                            .update(`${campaignId}:${recipient.email}`)
                            .digest('hex'),
                        unsubscribeToken: crypto.randomBytes(32).toString('base64url'),
                    })),
                );
            } else if (channel === 'telegram' && shouldPersistRecipients) {
                await campaignRepo.prepareMessageRecipients(
                    campaignId,
                    workspaceId,
                    'telegram',
                    recipientIds.map(recipient => ({
                        recipient,
                        normalizedRecipient: recipient,
                        displayName: recipient,
                        idempotencyKey: crypto
                            .createHash('sha256')
                            .update(`${campaignId}:telegram:${recipient}`)
                            .digest('hex'),
                    })),
                );
            } else if (shouldPersistRecipients) {
                await campaignRepo.setRecipientIds(campaignId, recipientIds, recipientIds.length);
            }

            const storedAntiSpam = (campaign.antiSpam as Partial<CampaignAntiSpam> | null) || {};
            const antiSpam: CampaignAntiSpam = {
                delayBetweenMs: storedAntiSpam.delayBetweenMs || (channel === 'email' ? 2000 : 8000),
                messageDelayMs: storedAntiSpam.messageDelayMs || 1200,
                maxPerHour: storedAntiSpam.maxPerHour || (channel === 'email' ? 100 : 30),
                randomizeDelay: storedAntiSpam.randomizeDelay !== false,
                batchSize: Math.min(Math.max(storedAntiSpam.batchSize || 10, 1), 25),
            };

            if (channel === 'email') {
                const recipients = await prisma.campaignRecipient.findMany({
                    where: { campaignId, workspaceId },
                    orderBy: { createdAt: 'asc' },
                });
                if (recipients.length === 0 || !smtpConfig || !emailContent) {
                    throw new AppError('Không thể chuẩn bị danh sách gửi Email', 500, 'CAMPAIGN_EMAIL_PREPARE_FAILED');
                }
                this.executeEmailInBackground(
                    campaignId,
                    workspaceId,
                    recipients,
                    startIndex,
                    antiSpam,
                    smtpConfig,
                    emailContent,
                );
            } else {
                const messages = Array.isArray(campaign.messages)
                    ? campaign.messages.filter((message): message is string => typeof message === 'string' && message.trim().length > 0)
                    : [];
                if (messages.length === 0) {
                    throw new AppError('Campaign không có nội dung tin nhắn hợp lệ', 400, 'CAMPAIGN_MESSAGES_EMPTY');
                }
                this.executeInBackground(campaignId, workspaceId, channel, messages, recipientIds, startIndex, antiSpam, telegramConfig);
            }
        } catch (error) {
            await campaignRepo.releaseStartClaim(campaignId, workspaceId, previousStatus);
            throw error;
        }

        return { total: recipientIds.length };
    }

    /**
     * Pause a running campaign
     */
    async pause(campaignId: string, workspaceId: string): Promise<void> {
        const campaign = await campaignRepo.findById(campaignId);
        if (!campaign) throw new Error('Campaign không tồn tại');
        if (campaign.workspaceId !== workspaceId) throw new Error('Không có quyền');
        if (campaign.status !== 'running') throw new Error('Campaign không đang chạy');

        const job = this.activeJobs.get(campaignId);
        if (job) {
            job.paused = true;
        }
        await campaignRepo.setStatus(campaignId, 'paused');
    }

    /**
     * Resume a paused campaign
     */
    async resume(campaignId: string, workspaceId: string): Promise<void> {
        return this.start(campaignId, workspaceId).then(() => {});
    }

    /**
     * Cancel/delete a campaign
     */
    async cancel(campaignId: string, workspaceId: string): Promise<void> {
        const campaign = await campaignRepo.findById(campaignId);
        if (!campaign) throw new Error('Campaign không tồn tại');
        if (campaign.workspaceId !== workspaceId) throw new Error('Không có quyền');

        // Abort if running
        const job = this.activeJobs.get(campaignId);
        if (job) {
            job.abortController.abort();
            this.activeJobs.delete(campaignId);
        }

        if (['draft', 'completed', 'failed'].includes(campaign.status)) {
            await campaignRepo.delete(campaignId);
        } else {
            await campaignRepo.setStatus(campaignId, 'failed');
        }
    }

    /**
     * Get live progress
     */
    getProgress(campaignId: string): CampaignProgress | null {
        const job = this.activeJobs.get(campaignId);
        return job?.progress || null;
    }

    /**
     * List campaigns
     */
    async list(workspaceId: string, options?: { status?: CampaignStatus; page?: number; limit?: number }) {
        return campaignRepo.findByWorkspace(workspaceId, options);
    }

    /**
     * Get single campaign
     */
    async getById(campaignId: string, workspaceId: string) {
        const campaign = await campaignRepo.findById(campaignId);
        if (!campaign) throw new Error('Campaign không tồn tại');
        if (campaign.workspaceId !== workspaceId) throw new Error('Không có quyền');

        const liveProgress = this.getProgress(campaignId);
        const recipients = ['email', 'telegram'].includes((campaign as any).channel)
            ? await campaignRepo.listRecipients(campaignId)
            : undefined;
        return { ...campaign, liveProgress, recipients };
    }

    /**
     * Get workspace-level campaign stats
     */
    async getStats(workspaceId: string) {
        return campaignRepo.getWorkspaceStats(workspaceId);
    }

    /**
     * A process restart drops in-memory jobs. Move durable recipient jobs to an explicit,
     * resumable state and release recipients that were atomically claimed but
     * not persisted as sent/failed yet. Sent recipients remain idempotently
     * skipped on resume.
     */
    async recoverInterruptedCampaigns(): Promise<number> {
        const interrupted = await prisma.campaign.findMany({
            where: { channel: { in: ['email', 'telegram'] }, status: 'running' },
            select: { id: true, channel: true },
        });
        if (interrupted.length === 0) return 0;
        const campaignIds = interrupted.map(campaign => campaign.id);

        await prisma.$transaction([
            prisma.campaignRecipient.updateMany({
                where: { campaignId: { in: campaignIds }, status: 'sending' },
                data: {
                    status: 'pending',
                    lastError: 'Đã phục hồi sau khi tiến trình gửi khởi động lại',
                    nextAttemptAt: null,
                },
            }),
            prisma.campaign.updateMany({
                where: { id: { in: campaignIds }, status: 'running' },
                data: { status: 'paused' },
            }),
        ]);
        for (const campaign of interrupted) {
            if (campaign.channel === 'email') await campaignRepo.syncEmailStats(campaign.id);
            else await campaignRepo.syncMessageStats(campaign.id);
        }
        return campaignIds.length;
    }

    private async requireUnsubscribeRecipient(unsubscribeToken: string) {
        const token = unsubscribeToken.trim();
        if (!/^[A-Za-z0-9_-]{32,96}$/.test(token)) {
            throw new AppError('Liên kết hủy đăng ký không hợp lệ', 400, 'CAMPAIGN_UNSUBSCRIBE_INVALID');
        }
        const recipient = await campaignRepo.findRecipientByToken(token);
        if (!recipient || recipient.channel !== 'email') {
            throw new AppError('Liên kết hủy đăng ký không tồn tại', 404, 'CAMPAIGN_UNSUBSCRIBE_NOT_FOUND');
        }
        return recipient;
    }

    private maskRecipientEmail(email: string): string {
        const [local, domain = ''] = email.split('@');
        const maskedLocal = local.length <= 2
            ? `${local.slice(0, 1)}*`
            : `${local.slice(0, 2)}${'*'.repeat(Math.min(6, local.length - 2))}`;
        return `${maskedLocal}@${domain}`;
    }

    async getUnsubscribePreview(unsubscribeToken: string): Promise<{ maskedEmail: string }> {
        const recipient = await this.requireUnsubscribeRecipient(unsubscribeToken);
        return { maskedEmail: this.maskRecipientEmail(recipient.normalizedRecipient) };
    }

    async unsubscribe(unsubscribeToken: string): Promise<{ maskedEmail: string }> {
        const recipient = await this.requireUnsubscribeRecipient(unsubscribeToken);

        const email = recipient.normalizedRecipient.trim().toLowerCase();
        const affectedRecipients = await prisma.campaignRecipient.findMany({
            where: {
                workspaceId: recipient.workspaceId,
                normalizedRecipient: email,
                status: { in: ['pending', 'sending', 'failed', 'suppressed'] },
            },
            select: { campaignId: true },
        });

        await prisma.$transaction([
            prisma.emailSuppression.upsert({
                where: {
                    workspaceId_email: { workspaceId: recipient.workspaceId, email },
                },
                create: {
                    workspaceId: recipient.workspaceId,
                    email,
                    reason: 'unsubscribed',
                    sourceCampaignId: recipient.campaignId,
                },
                update: {
                    reason: 'unsubscribed',
                    sourceCampaignId: recipient.campaignId,
                },
            }),
            prisma.lead.updateMany({
                where: { workspaceId: recipient.workspaceId, email },
                data: { marketingConsent: false },
            }),
            prisma.campaignRecipient.updateMany({
                where: {
                    workspaceId: recipient.workspaceId,
                    normalizedRecipient: email,
                    status: { in: ['pending', 'sending', 'failed', 'suppressed'] },
                },
                data: { status: 'unsubscribed', nextAttemptAt: null },
            }),
        ]);

        for (const campaignId of new Set(affectedRecipients.map(item => item.campaignId))) {
            await campaignRepo.syncEmailStats(campaignId);
        }
        return { maskedEmail: this.maskRecipientEmail(email) };
    }

    // ═══════════════════════════════════
    // EXECUTION ENGINE
    // ═══════════════════════════════════

    private executeEmailInBackground(
        campaignId: string,
        workspaceId: string,
        recipients: CampaignRecipient[],
        startIndex: number,
        antiSpam: CampaignAntiSpam,
        smtpConfig: SmtpConfig,
        content: EmailCampaignContent,
    ) {
        const abortController = new AbortController();
        const jobState: CampaignJobState = {
            paused: false,
            abortController,
            progress: {
                campaignId,
                status: 'running',
                sent: 0,
                failed: 0,
                total: recipients.length,
            },
            hourlySent: 0,
            hourlyResetAt: Date.now() + 3600_000,
        };
        this.activeJobs.set(campaignId, jobState);

        this.runEmailCampaignLoop(
            campaignId,
            workspaceId,
            recipients,
            startIndex,
            antiSpam,
            smtpConfig,
            content,
            jobState,
        )
            .catch(async error => {
                console.error(`[CampaignService] Fatal Email campaign ${campaignId} (${error instanceof Error ? error.name : 'unknown'})`);
                await campaignRepo.setStatus(campaignId, 'failed');
                await campaignRepo.syncEmailStats(campaignId);
                jobState.progress.status = 'failed';
                void systemNotificationService.campaignFailed({ campaignId, workspaceId, error });
            })
            .finally(() => {
                setTimeout(() => this.activeJobs.delete(campaignId), 300_000);
            });
    }

    private async runEmailCampaignLoop(
        campaignId: string,
        workspaceId: string,
        recipients: CampaignRecipient[],
        startIndex: number,
        antiSpam: CampaignAntiSpam,
        smtpConfig: SmtpConfig,
        content: EmailCampaignContent,
        jobState: CampaignJobState,
    ): Promise<void> {
        const existing = await campaignRepo.findById(campaignId);
        const existingStats = (existing?.stats as Record<string, number> | null) || {};
        jobState.progress.sent = existingStats.sent || 0;
        jobState.progress.failed = existingStats.failed || 0;

        emailRecipientLoop: for (let i = startIndex; i < recipients.length; i++) {
            if (jobState.abortController.signal.aborted) break;
            if (jobState.paused) {
                const pausedStats = await campaignRepo.syncEmailStats(campaignId, i);
                jobState.progress.sent = pausedStats.sent || 0;
                jobState.progress.failed = pausedStats.failed || 0;
                jobState.progress.status = 'paused';
                return;
            }

            const insideSendWindow = await this.waitForEmailSendWindow(campaignId, jobState);
            if (!insideSendWindow) break;

            const snapshot = recipients[i];
            jobState.progress.currentRecipient = snapshot.recipient;
            let attempted = false;

            if (snapshot.status === 'pending') {
                const claimed = await campaignRepo.claimEmailRecipient(snapshot.id);
                if (claimed) {
                    attempted = true;
                    await this.sendEmailRecipient(
                        campaignId,
                        workspaceId,
                        claimed,
                        antiSpam,
                        smtpConfig,
                        content,
                        jobState,
                    );
                }
            }

            const processedCount = i + 1;
            if (processedCount % antiSpam.batchSize === 0 || processedCount === recipients.length) {
                const stats = await campaignRepo.syncEmailStats(campaignId, processedCount);
                jobState.progress.sent = stats.sent || 0;
                jobState.progress.failed = stats.failed || 0;
            }
            jobState.progress.estimatedRemainingMs = Math.max(
                0,
                (recipients.length - processedCount) * antiSpam.delayBetweenMs,
            );

            if (attempted && i < recipients.length - 1) {
                let delay = antiSpam.delayBetweenMs;
                if (antiSpam.randomizeDelay) {
                    const jitter = delay * 0.2;
                    delay = delay - jitter + Math.random() * jitter * 2;
                }
                const stillActive = await this.waitUntilOrAbort(delay, jobState.abortController.signal);
                if (!stillActive) break emailRecipientLoop;
            }
        }

        if (jobState.abortController.signal.aborted) {
            jobState.progress.status = 'failed';
            return;
        }
        if (jobState.paused) {
            jobState.progress.status = 'paused';
            return;
        }

        const stats = await campaignRepo.syncEmailStats(campaignId, recipients.length);
        jobState.progress.sent = stats.sent || 0;
        jobState.progress.failed = stats.failed || 0;
        await campaignRepo.setStatus(campaignId, 'completed');
        jobState.progress.status = 'completed';
        void systemNotificationService.campaignCompleted({
            campaignId,
            workspaceId,
            sent: stats.sent || 0,
            failed: stats.failed || 0,
            total: stats.total || recipients.length,
        });
        console.log(
            `[CampaignService] ${campaignId}: EMAIL COMPLETED — ${stats.sent || 0} sent, ${stats.failed || 0} failed, ${stats.suppressed || 0} suppressed`,
        );
    }

    private async waitForEmailSendWindow(
        campaignId: string,
        jobState: CampaignJobState,
    ): Promise<boolean> {
        while (!jobState.abortController.signal.aborted && !jobState.paused) {
            const campaign = await campaignRepo.findById(campaignId);
            const schedule = (campaign?.schedule as CampaignSchedule | null) || {};
            if (!schedule.sendWindow) return true;

            const now = new Date();
            const hour = now.getHours();
            const { startHour, endHour } = schedule.sendWindow;
            if (hour >= startHour && hour < endHour) return true;

            const nextStart = new Date();
            if (hour >= endHour) nextStart.setDate(nextStart.getDate() + 1);
            nextStart.setHours(startHour, 0, 0, 0);
            const waitMs = Math.min(Math.max(nextStart.getTime() - Date.now(), 1000), 60_000);
            const active = await this.waitUntilOrAbort(waitMs, jobState.abortController.signal);
            if (!active) return false;
        }
        return false;
    }

    private async sendEmailRecipient(
        campaignId: string,
        workspaceId: string,
        recipient: CampaignRecipient,
        antiSpam: CampaignAntiSpam,
        smtpConfig: SmtpConfig,
        content: EmailCampaignContent,
        jobState: CampaignJobState,
    ): Promise<void> {
        let attempt = recipient.attemptCount;
        const maxAttempts = Math.min(Math.max(recipient.maxAttempts || 3, 1), 5);
        const unsubscribeToken = recipient.unsubscribeToken;
        if (!unsubscribeToken) {
            await campaignRepo.markRecipientFailed(recipient.id, 'Thiếu unsubscribe token');
            return;
        }

        while (attempt <= maxAttempts) {
            if (jobState.abortController.signal.aborted || jobState.paused) {
                await campaignRepo.releaseRecipientClaim(recipient.id, 'Campaign đã tạm dừng');
                return;
            }

            const hasHourlySlot = await this.waitForHourlyMessageSlot(
                campaignId,
                antiSpam.maxPerHour,
                jobState,
            );
            if (!hasHourlySlot) {
                await campaignRepo.releaseRecipientClaim(recipient.id, 'Campaign đã dừng khi chờ rate limit');
                return;
            }
            jobState.hourlySent++;

            try {
                const message = this.buildEmailMessage(content, recipient.displayName, unsubscribeToken);
                const result = await sendSmtpMail(smtpConfig, {
                    to: recipient.recipient,
                    subject: message.subject,
                    text: message.text || undefined,
                    html: message.html || undefined,
                });
                await campaignRepo.markRecipientSent(recipient.id, result.messageId);
                return;
            } catch (error) {
                const safe = smtpService.safeError(error);
                void systemNotificationService.smtpFailure({
                    operation: 'campaign_send',
                    code: safe.code,
                    phase: safe.phase,
                    retryable: safe.retryable,
                });
                const errorMessage = `${safe.code}: ${safe.message}`;
                const shouldSuppress = safe.code === 'SMTP_INVALID_ADDRESS'
                    || safe.code === 'SMTP_RECIPIENT_REJECTED';
                if (shouldSuppress) {
                    await prisma.emailSuppression.upsert({
                        where: {
                            workspaceId_email: {
                                workspaceId,
                                email: recipient.normalizedRecipient,
                            },
                        },
                        create: {
                            workspaceId,
                            email: recipient.normalizedRecipient,
                            reason: 'rejected',
                            sourceCampaignId: campaignId,
                        },
                        update: { reason: 'rejected', sourceCampaignId: campaignId },
                    });
                }

                if (safe.retryable && attempt < maxAttempts) {
                    const retryDelay = Math.min(30_000, 1000 * 2 ** Math.max(0, attempt - 1));
                    const active = await this.waitUntilOrAbort(retryDelay, jobState.abortController.signal);
                    if (!active || jobState.paused) {
                        await campaignRepo.releaseRecipientClaim(recipient.id, errorMessage);
                        return;
                    }
                    await campaignRepo.incrementRecipientAttempt(recipient.id);
                    attempt++;
                    continue;
                }

                await campaignRepo.markRecipientFailed(recipient.id, errorMessage);
                return;
            }
        }
    }

    private buildEmailMessage(
        content: EmailCampaignContent,
        displayName: string,
        unsubscribeToken: string,
    ): EmailCampaignContent {
        const publicBase = (process.env.BASE_URL || env.FRONTEND_URL).replace(/\/+$/, '');
        const unsubscribeUrl = new URL('/api/campaigns/unsubscribe', `${publicBase}/`);
        unsubscribeUrl.searchParams.set('token', unsubscribeToken);
        const url = unsubscribeUrl.toString();
        const plainName = displayName || 'bạn';
        const htmlName = escapeHtml(plainName);
        const htmlHadUnsubscribeVariable = content.html.includes('{{unsubscribe_url}}');
        const textHadUnsubscribeVariable = content.text.includes('{{unsubscribe_url}}');

        let html = content.html
            .replace(/{{\s*customer_name\s*}}/gi, htmlName)
            .replace(/{{\s*unsubscribe_url\s*}}/gi, escapeHtml(url));
        let text = content.text
            .replace(/{{\s*customer_name\s*}}/gi, plainName)
            .replace(/{{\s*unsubscribe_url\s*}}/gi, url);
        const subject = content.subject.replace(/{{\s*customer_name\s*}}/gi, plainName);

        if (html && !htmlHadUnsubscribeVariable) {
            html += `<hr style="border:0;border-top:1px solid #e2e8f0;margin:24px 0 12px"><p style="font-size:12px;line-height:18px;color:#64748b">Bạn nhận email này vì đã đồng ý nhận thông tin. <a href="${escapeHtml(url)}" style="color:#475569">Hủy đăng ký</a>.</p>`;
        }
        if (text && !textHadUnsubscribeVariable) {
            text += `\n\n---\nBạn nhận email này vì đã đồng ý nhận thông tin. Hủy đăng ký: ${url}`;
        }
        return { subject, html, text };
    }

    private executeInBackground(
        campaignId: string,
        workspaceId: string,
        channel: Exclude<CampaignChannel, 'email'>,
        messages: string[],
        recipientIds: string[],
        startIndex: number,
        antiSpam: CampaignAntiSpam,
        telegramConfig: TelegramCampaignConfig | null,
    ) {
        const abortController = new AbortController();
        const jobState = {
            paused: false,
            abortController,
            progress: {
                campaignId,
                status: 'running' as CampaignStatus,
                sent: 0,
                failed: 0,
                total: recipientIds.length,
            },
            hourlySent: 0,
            hourlyResetAt: Date.now() + 3600_000,
        };

        this.activeJobs.set(campaignId, jobState);

        // Fire-and-forget async execution
        this.runCampaignLoop(
            campaignId,
            workspaceId,
            channel,
            messages,
            recipientIds,
            startIndex,
            antiSpam,
            jobState,
            telegramConfig,
        )
            .catch(err => {
                console.error(`[CampaignService] Fatal error in campaign ${campaignId} (${err instanceof Error ? err.name : 'unknown'})`);
                campaignRepo.setStatus(campaignId, 'failed');
                jobState.progress.status = 'failed';
                void systemNotificationService.campaignFailed({ campaignId, workspaceId, error: err });
            })
            .finally(() => {
                // Cleanup after 5 minutes (keep progress for polling)
                setTimeout(() => this.activeJobs.delete(campaignId), 300_000);
            });
    }

    private async runCampaignLoop(
        campaignId: string,
        workspaceId: string,
        channel: Exclude<CampaignChannel, 'email'>,
        messages: string[],
        recipientIds: string[],
        startIndex: number,
        antiSpam: CampaignAntiSpam,
        jobState: CampaignJobState,
        telegramConfig: TelegramCampaignConfig | null,
    ) {
        let failedCount = 0;

        // Reload stats from DB to get accurate counts after resume
        const existing = await campaignRepo.findById(campaignId);
        if (existing) {
            const stats = (existing.stats as any) || {};
            jobState.progress.sent = stats.sent || 0;
            failedCount = stats.failed || 0;
            jobState.progress.failed = failedCount;
        }

        recipientLoop: for (let i = startIndex; i < recipientIds.length; i++) {
            // Check abort/pause
            if (jobState.abortController.signal.aborted) break;
            if (jobState.paused) {
                if (channel === 'telegram') {
                    await campaignRepo.syncMessageStats(campaignId, i);
                } else {
                    await campaignRepo.updateStats(campaignId, {
                        sent: jobState.progress.sent,
                        failed: failedCount,
                        pending: recipientIds.length - i,
                    }, i);
                }
                jobState.progress.status = 'paused';
                return;
            }

            // Send window check (business hours)
            const now = new Date();
            const hour = now.getHours();
            const campaign = await campaignRepo.findById(campaignId);
            const schedule = (campaign?.schedule as any) || {};
            if (schedule.sendWindow) {
                const { startHour, endHour } = schedule.sendWindow;
                if (hour < startHour || hour >= endHour) {
                    const nextStart = new Date();
                    if (hour >= endHour) nextStart.setDate(nextStart.getDate() + 1);
                    nextStart.setHours(startHour, 0, 0, 0);
                    const waitMs = nextStart.getTime() - Date.now();
                    console.log(`[CampaignService] ${campaignId}: Outside send window, waiting until ${startHour}:00...`);
                    const stillActive = await this.waitUntilOrAbort(
                        Math.min(waitMs, 60000),
                        jobState.abortController.signal,
                    );
                    if (!stillActive) break recipientLoop;
                    i--;
                    continue;
                }
            }

            const recipientId = recipientIds[i];
            jobState.progress.currentRecipient = recipientId;
            const durableRecipient = channel === 'telegram'
                ? await campaignRepo.claimMessageRecipient(campaignId, recipientId)
                : null;
            if (channel === 'telegram' && !durableRecipient) continue;
            let providerMessageId = durableRecipient?.providerMessageId?.replace(/^\d+:/, '') || '';
            const checkpointMatch = durableRecipient?.providerMessageId?.match(/^(\d+):/);
            const completedStepIndex = checkpointMatch ? Number(checkpointMatch[1]) : -1;

            try {
                // Send each message to this recipient
                for (let j = completedStepIndex + 1; j < messages.length; j++) {
                    if (jobState.abortController.signal.aborted) break recipientLoop;
                    if (j > 0) {
                        const stillActive = await this.waitUntilOrAbort(antiSpam.messageDelayMs, jobState.abortController.signal);
                        if (!stillActive) break recipientLoop;
                    }
                    if (channel === 'telegram') {
                        const destination = parseTelegramDestination(recipientId);
                        const config = telegramConfig || await this.resolveTelegramConfig(workspaceId);
                        const delivery = await this.sendTelegramStepWithRetry(
                            campaignId,
                            messages[j],
                            destination,
                            config,
                            antiSpam,
                            jobState,
                            durableRecipient!.id,
                        );
                        providerMessageId = delivery;
                        await campaignRepo.markRecipientStepProgress(durableRecipient!.id, j, delivery);
                    } else {
                        const hasHourlySlot = await this.waitForHourlyMessageSlot(campaignId, antiSpam.maxPerHour, jobState);
                        if (!hasHourlySlot || jobState.abortController.signal.aborted) break recipientLoop;
                        jobState.hourlySent++;
                        await zaloService.sendMessage(workspaceId, recipientId, messages[j]);
                    }
                }

                if (durableRecipient) {
                    await campaignRepo.markRecipientSent(durableRecipient.id, providerMessageId);
                }
                jobState.progress.sent++;

                console.log(`[CampaignService] ${campaignId}: Recipient sent (${i + 1}/${recipientIds.length})`);
            } catch (err: any) {
                if (durableRecipient && err instanceof AppError && err.code === 'CAMPAIGN_PAUSED') {
                    await campaignRepo.releaseRecipientClaim(durableRecipient.id, 'Campaign đã tạm dừng');
                    await campaignRepo.syncMessageStats(campaignId, i);
                    jobState.progress.status = 'paused';
                    return;
                }
                failedCount++;
                jobState.progress.failed = failedCount;
                if (durableRecipient) await campaignRepo.markRecipientFailed(durableRecipient.id, err.message || 'Unknown error');
                await campaignRepo.pushFailedRecipient(campaignId, recipientId, err.message || 'Unknown error');
                console.error(`[CampaignService] ${campaignId}: Recipient failed (${err instanceof Error ? err.name : 'unknown'})`);
            }

            // Update DB every 5 recipients
            if (channel === 'telegram') {
                const stats = await campaignRepo.syncMessageStats(campaignId, i + 1);
                jobState.progress.sent = stats.sent || 0;
                failedCount = stats.failed || 0;
                jobState.progress.failed = failedCount;
            } else if ((i + 1) % 5 === 0 || i === recipientIds.length - 1) {
                await campaignRepo.updateStats(campaignId, {
                    sent: jobState.progress.sent,
                    failed: failedCount,
                    pending: recipientIds.length - (i + 1),
                }, i + 1);
            }

            // Estimated remaining time
            const avgTimePerRecipient = antiSpam.delayBetweenMs + (messages.length * antiSpam.messageDelayMs);
            jobState.progress.estimatedRemainingMs = (recipientIds.length - (i + 1)) * avgTimePerRecipient;

            // Anti-spam delay (skip after last)
            if (i < recipientIds.length - 1) {
                let delay = antiSpam.delayBetweenMs;
                if (antiSpam.randomizeDelay) {
                    const jitter = delay * 0.3;
                    delay = delay - jitter + Math.random() * jitter * 2;
                }
                const stillActive = await this.waitUntilOrAbort(delay, jobState.abortController.signal);
                if (!stillActive) break;
            }
        }

        // cancel() owns the persisted terminal state. Never overwrite it with
        // completed, and never resume sending after an aborted long wait.
        if (jobState.abortController.signal.aborted) {
            jobState.progress.status = 'failed';
            return;
        }

        // Campaign complete
        if (channel === 'telegram') {
            const stats = await campaignRepo.syncMessageStats(campaignId, recipientIds.length);
            jobState.progress.sent = stats.sent || 0;
            failedCount = stats.failed || 0;
            jobState.progress.failed = failedCount;
        } else {
            await campaignRepo.updateStats(campaignId, {
                sent: jobState.progress.sent,
                failed: failedCount,
                pending: 0,
            }, recipientIds.length);
        }
        await campaignRepo.setStatus(campaignId, 'completed');
        jobState.progress.status = 'completed';
        void systemNotificationService.campaignCompleted({
            campaignId,
            workspaceId,
            sent: jobState.progress.sent,
            failed: failedCount,
            total: recipientIds.length,
        });
        console.log(`[CampaignService] ${campaignId}: COMPLETED — ${jobState.progress.sent} sent, ${failedCount} failed`);
    }

    private async sendTelegramStepWithRetry(
        campaignId: string,
        message: string,
        destination: TelegramDestination,
        config: TelegramCampaignConfig,
        antiSpam: CampaignAntiSpam,
        jobState: CampaignJobState,
        recipientRowId: string,
    ): Promise<string> {
        const maxAttempts = 3;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            if (jobState.paused) {
                throw new AppError('Campaign đã tạm dừng', 409, 'CAMPAIGN_PAUSED');
            }
            const hasHourlySlot = await this.waitForHourlyMessageSlot(campaignId, antiSpam.maxPerHour, jobState);
            if (!hasHourlySlot && jobState.paused) {
                throw new AppError('Campaign đã tạm dừng', 409, 'CAMPAIGN_PAUSED');
            }
            if (!hasHourlySlot || jobState.abortController.signal.aborted) {
                throw new AppError('Campaign đã dừng khi chờ giới hạn tốc độ', 409, 'CAMPAIGN_STOPPED');
            }
            jobState.hourlySent++;
            try {
                const delivery = await telegramNotifier.sendMessage(message, {
                    config,
                    chatId: destination.chatId,
                    messageThreadId: destination.messageThreadId,
                });
                return delivery.messageId ? String(delivery.messageId) : '';
            } catch (error) {
                const retryable = error instanceof TelegramNotifierError && error.retryable;
                if (!retryable || attempt >= maxAttempts) throw error;
                await campaignRepo.incrementRecipientAttempt(recipientRowId);
                const requestedDelay = error.retryAfterSeconds ? error.retryAfterSeconds * 1000 : 1000 * 2 ** (attempt - 1);
                const active = await this.waitUntilOrAbort(
                    Math.min(Math.max(requestedDelay, 1000), 30_000),
                    jobState.abortController.signal,
                );
                if (!active) throw new AppError('Campaign đã bị dừng', 409, 'CAMPAIGN_STOPPED');
            }
        }
        throw new AppError('Không thể gửi Telegram sau nhiều lần thử', 502, 'CAMPAIGN_TELEGRAM_RETRY_EXHAUSTED');
    }

    private async waitForHourlyMessageSlot(
        campaignId: string,
        configuredMaxPerHour: number,
        jobState: CampaignJobState,
    ): Promise<boolean> {
        const maxPerHour = Math.max(1, configuredMaxPerHour || 30);
        if (Date.now() >= jobState.hourlyResetAt) {
            jobState.hourlySent = 0;
            jobState.hourlyResetAt = Date.now() + 3600_000;
        }
        if (jobState.hourlySent < maxPerHour) return !jobState.abortController.signal.aborted;

        const waitMs = Math.max(0, jobState.hourlyResetAt - Date.now());
        console.log(`[CampaignService] ${campaignId}: Hourly message limit (${maxPerHour}) reached, waiting ${Math.round(waitMs / 60000)}min...`);
        while (Date.now() < jobState.hourlyResetAt) {
            if (jobState.paused || jobState.abortController.signal.aborted) return false;
            const stillActive = await this.waitUntilOrAbort(
                Math.min(60_000, jobState.hourlyResetAt - Date.now()),
                jobState.abortController.signal,
            );
            if (!stillActive) return false;
        }
        jobState.hourlySent = 0;
        jobState.hourlyResetAt = Date.now() + 3600_000;
        return true;
    }

    private waitUntilOrAbort(delayMs: number, signal: AbortSignal): Promise<boolean> {
        if (signal.aborted) return Promise.resolve(false);
        if (delayMs <= 0) return Promise.resolve(true);

        return new Promise(resolve => {
            let settled = false;
            const finish = (active: boolean) => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                signal.removeEventListener('abort', onAbort);
                resolve(active);
            };
            const onAbort = () => finish(false);
            const timer = setTimeout(() => finish(true), delayMs);
            signal.addEventListener('abort', onAbort, { once: true });
        });
    }
}

export const campaignService = new CampaignService();

let campaignSchedulerTimer: NodeJS.Timeout | null = null;
let campaignSchedulerRunning = false;

async function runDueCampaigns(): Promise<void> {
    if (campaignSchedulerRunning) return;
    campaignSchedulerRunning = true;
    try {
        const scheduled = await prisma.campaign.findMany({
            where: { status: 'scheduled' },
            orderBy: { updatedAt: 'asc' },
            take: 100,
            select: { id: true, workspaceId: true, schedule: true },
        });
        const now = Date.now();
        for (const campaign of scheduled) {
            const schedule = (campaign.schedule as CampaignSchedule | null) || {};
            const startAt = schedule.startAt ? new Date(schedule.startAt) : null;
            if (!startAt || Number.isNaN(startAt.getTime())) {
                await campaignRepo.failScheduled(campaign.id, campaign.workspaceId);
                continue;
            }
            if (startAt.getTime() > now) continue;
            try {
                await campaignService.start(campaign.id, campaign.workspaceId);
            } catch (error) {
                if (error instanceof AppError && error.code === 'CAMPAIGN_START_CONFLICT') continue;
                const failed = await campaignRepo.failScheduled(campaign.id, campaign.workspaceId);
                if (failed) {
                    console.error(`[CampaignScheduler] Failed to start ${campaign.id}: ${error instanceof Error ? error.message : 'unknown'}`);
                    void systemNotificationService.campaignFailed({
                        campaignId: campaign.id,
                        workspaceId: campaign.workspaceId,
                        error,
                    });
                }
            }
        }
    } finally {
        campaignSchedulerRunning = false;
    }
}

export function startCampaignScheduler(): () => void {
    if (campaignSchedulerTimer) return () => undefined;
    const invoke = () => void runDueCampaigns().catch(error => {
        console.error(`[CampaignScheduler] tick failed: ${error instanceof Error ? error.message : 'unknown'}`);
    });
    const initial = setTimeout(invoke, 3_000);
    campaignSchedulerTimer = setInterval(invoke, 15_000);
    initial.unref();
    campaignSchedulerTimer.unref();
    return () => {
        clearTimeout(initial);
        if (campaignSchedulerTimer) clearInterval(campaignSchedulerTimer);
        campaignSchedulerTimer = null;
    };
}
