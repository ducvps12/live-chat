import crypto from 'node:crypto';
import { conversationRepo } from './repos/conversation.repo';
import { messageRepo } from './repos/message.repo';
import { visitorRepo } from './repos/visitor.repo';
import { widgetRepo } from '../workspace/repos/widget.repo';
import prisma from '../../infra/prisma';
import { AppError } from '../../middlewares/errorHandler';
import { security } from '../../infra/security';
import { sanitizeMessage, sanitizeFilename } from '../../infra/sanitize';
import { emitToConversation, emitToWorkspace, emitToUser } from '../../infra/socket';
import { presenceStore } from '../../infra/presence';
import {
    buildAutoReplyHistory,
    createLatestOnlyWorker,
    evaluateAutoReplyPolicy,
    guardAutoReplyOutput,
    isHumanAgentSender,
    isZaloGroupConversation,
    type LatestOnlyWorkerResult,
} from '../chatbot/auto-reply.helpers';
import type { Conversation, Message } from '@prisma/client';
import {
    buildZaloConversationIdentity,
    isCompatibleLegacyZaloConversation,
    type ZaloConversationIdentity,
    type ZaloThreadType,
} from './zalo-identity.helpers';
import {
    buildAutoReplyTypingPayload,
    type AutoReplyTypingActor,
    waitForAutoReplyDelivery,
} from './auto-reply-typing';
import {
    appendAutoReplyTrace,
    attemptExternalAutoReplyDelivery,
    autoReplyPartClientMessageId,
    createDurableAutoReplyPlan,
    getAutoReplyConnectorContract,
    readDurableAutoReplyPlan,
    type DurableAutoReplyPlan,
    withDurableAutoReplyPlan,
} from './auto-reply-delivery';
import { summarizeInboxCandidates } from './inbox-summary';
import {
    captureLeadFromWidget,
    normalizeWidgetVisitorInfo,
} from '../lead/lead-auto-capture.service';
import { runMessageWorkflows } from '../automation/automation-runtime.service';

/** Safely get ID string from both Prisma (id) and Mongoose (_id) records */
function getId(obj: any): string {
    if (!obj) return '';
    if (typeof obj === 'string') return obj;
    return (obj._id || obj.id || '')?.toString() || '';
}

/**
 * Anti-spam: Rate limiter for bot replies per conversation.
 * Maps conversationId → last bot reply timestamp.
 */
const _botReplyTimestamps = new Map<string, number>();
// Coalesce quick visitor bubbles and keep only a short inter-reply guard. The
// previous 10s cooldown made a legitimate follow-up feel like the bot stalled.
const BOT_REPLY_COOLDOWN_MS = 900;
const AUTO_REPLY_DEBOUNCE_MS = 700;

interface ActiveAutoReplyTyping {
    targetMessageId: string;
    actor: AutoReplyTypingActor;
}

const _activeAutoReplyTyping = new Map<string, ActiveAutoReplyTyping>();

function emitAutoReplyTypingEvent(
    conversationId: string,
    targetMessageId: string,
    state: 'start' | 'stop',
    actor: AutoReplyTypingActor,
): void {
    try {
        emitToConversation(
            conversationId,
            state === 'start' ? 'typing:start' : 'typing:stop',
            buildAutoReplyTypingPayload(conversationId, targetMessageId, state, actor),
        );
    } catch (error) {
        // Realtime is an enhancement: a missing socket gateway must never make
        // the durable auto-reply worker fail or retry the same customer message.
        console.warn(`[Chatbot] Could not emit typing:${state} for conv ${conversationId}`, error);
    }
}

function startAutoReplyTyping(
    conversationId: string,
    targetMessageId: string,
    actor: AutoReplyTypingActor,
): void {
    const previous = _activeAutoReplyTyping.get(conversationId);
    if (previous && previous.targetMessageId !== targetMessageId) {
        emitAutoReplyTypingEvent(
            conversationId,
            previous.targetMessageId,
            'stop',
            previous.actor,
        );
    }
    _activeAutoReplyTyping.set(conversationId, { targetMessageId, actor });
    emitAutoReplyTypingEvent(conversationId, targetMessageId, 'start', actor);
}

function stopAutoReplyTyping(
    conversationId: string,
    targetMessageId?: string,
): void {
    const active = _activeAutoReplyTyping.get(conversationId);
    if (!active) return;
    // An older worker must never hide a newer worker's composing state.
    if (targetMessageId && active.targetMessageId !== targetMessageId) return;
    _activeAutoReplyTyping.delete(conversationId);
    emitAutoReplyTypingEvent(
        conversationId,
        active.targetMessageId,
        'stop',
        active.actor,
    );
}

function jsonRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {};
}

function serializePublicMessage(message: Message) {
    const recalled = Boolean(message.isDeleted);
    return {
        id: message.id,
        clientMessageId: message.clientMessageId,
        senderType: message.senderType,
        senderName: message.senderName,
        content: recalled ? '' : message.content,
        type: message.type,
        status: message.status,
        attachments: recalled ? [] : message.attachments,
        replyToMessageId: message.replyToMessageId,
        replyToContent: recalled ? '' : message.replyToContent,
        replyToSenderName: message.replyToSenderName,
        isEdited: Boolean(message.editedAt),
        editedAt: message.editedAt,
        isDeleted: recalled,
        isRecalled: recalled,
        createdAt: message.createdAt,
        updatedAt: message.updatedAt,
    };
}

function isReplyableVisitorMessage(message: Message | null): message is Message {
    if (!message || message.senderType !== 'visitor' || message.isDeleted || message.isInternal) {
        return false;
    }
    const msgType = (message as any).type || 'text';
    const hasMedia = Boolean((message as any).stickerUrl)
        || Boolean((message as any).attachments && (message as any).attachments.length > 0);
    const isSupportedType = msgType === 'text'
        || msgType === 'sticker'
        || msgType === 'image'
        || msgType === 'media'
        || hasMedia;

    if (!isSupportedType) return false;
    const content = String(message.content || '').trim();
    return hasMedia || msgType !== 'text' || content.length > 0;
}

function buildHumanTakeoverMetadata(
    metadata: unknown,
    sender: { id: string; name?: string },
): Record<string, unknown> {
    return {
        ...jsonRecord(metadata),
        humanTakeover: true,
        aiPaused: true,
        autoReplyEnabled: false,
        autoReplyDisabled: true,
        aiMode: 'manual',
        lastHumanReplyAt: new Date().toISOString(),
        lastHumanAgentId: sender.id,
        lastHumanAgentName: sender.name || 'Agent',
    };
}

function latestVisitorResult(
    latestVisitor: Message | null,
    targetMessageId: string,
): void | LatestOnlyWorkerResult<string> {
    if (!latestVisitor || getId(latestVisitor) === targetMessageId) return;
    if (isReplyableVisitorMessage(latestVisitor)) {
        return { replacement: getId(latestVisitor) };
    }
    return {}; // A newer non-text visitor message suppresses the stale text reply.
}

async function loadFreshAutoReplyState(conversationId: string): Promise<{
    conversation: Conversation | null;
    latestVisitor: Message | null;
}> {
    const [conversation, latestVisitor] = await Promise.all([
        conversationRepo.findById(conversationId),
        messageRepo.findLatestVisitor(conversationId),
    ]);
    return { conversation, latestVisitor };
}

function conversationAllowsAutoReply(
    conversation: Conversation,
    agentCondition: string,
): boolean {
    if (isZaloGroupConversation(conversation)) return false;
    return evaluateAutoReplyPolicy({
        agentCondition,
        assignedTo: conversation.assignedTo,
        metadata: conversation.metadata,
        onlineAgentCount: presenceStore.countOnlineAgents(conversation.workspaceId),
    }).allowed;
}

async function sendAutoReplyToExternal(
    conversation: Conversation,
    text: string,
): Promise<void> {
    const channel = String(conversation.channel || 'website').toLowerCase();
    const metadata = jsonRecord(conversation.metadata);

    if (channel === 'facebook' || channel === 'messenger') {
        const fbUserId = typeof metadata.fbUserId === 'string' ? metadata.fbUserId : '';
        const pageId = typeof metadata.pageId === 'string' ? metadata.pageId : '';
        if (!fbUserId || !pageId) {
            throw new Error('Facebook auto-reply is missing the recipient or Page identity');
        }
        const { facebookService } = await import('../facebook/facebook.service');
        await facebookService.sendMessage(conversation.workspaceId, fbUserId, text, pageId);
        console.log(`[Chatbot] ✅ Bot reply sent to Facebook user ${fbUserId}`);
        return;
    }

    if (channel === 'zalo' && !isZaloGroupConversation(conversation)) {
        const metadataUserId = typeof metadata.zaloUserId === 'string' ? metadata.zaloUserId : '';
        const zaloThreadId = metadataUserId || String(conversation.visitorId || '').replace(/^zalo_/, '');
        const accountId = typeof metadata.accountId === 'string' ? metadata.accountId : undefined;
        if (!zaloThreadId) {
            throw new Error('Zalo auto-reply is missing the recipient identity');
        }
        const { zaloService } = await import('../zalo/zalo.service');
        await zaloService.sendMessage(
            conversation.workspaceId,
            zaloThreadId,
            text,
            'text',
            undefined,
            accountId,
        );
        console.log(`[Chatbot] ✅ Bot reply sent to Zalo user ${zaloThreadId}`);
    }
}

async function isCurrentAutoReplyDelivery(
    conversationId: string,
    targetMessageId: string,
    agentCondition: string,
    isLatestJob: () => boolean,
): Promise<Conversation | null> {
    const fresh = await loadFreshAutoReplyState(conversationId);
    if (!fresh.conversation || !fresh.latestVisitor) return null;
    if (latestVisitorResult(fresh.latestVisitor, targetMessageId)) return null;
    if (!conversationAllowsAutoReply(fresh.conversation, agentCondition)) return null;
    return isLatestJob() ? fresh.conversation : null;
}

async function completeAutoReplyPlan(
    conversationId: string,
    conversation: Conversation,
    plan: DurableAutoReplyPlan,
): Promise<void> {
    const connector = getAutoReplyConnectorContract(conversation.channel);
    const metadata = appendAutoReplyTrace(
        withDurableAutoReplyPlan(conversation.metadata, null),
        {
            traceId: plan.traceId || `auto-reply:${plan.targetMessageId}`,
            targetMessageId: plan.targetMessageId,
            source: plan.source,
            channel: connector.channel,
            outcome: 'delivered',
            partCount: plan.parts.length,
            generationDurationMs: plan.generationDurationMs ?? null,
            completedAt: new Date().toISOString(),
        },
    );
    if (plan.handoffRequested) {
        Object.assign(metadata, {
            humanTakeover: true,
            aiPaused: true,
            autoReplyEnabled: false,
            autoReplyDisabled: true,
            aiMode: 'manual',
            handoffRequestedAt: new Date().toISOString(),
            handoffReason: plan.source === 'fallback'
                ? 'missing_knowledge'
                : 'bot_requested_human_support',
            handoffBotId: plan.botId,
            handoffBotName: plan.botName,
        });
    }
    await conversationRepo.updateMetadata(conversationId, metadata);
}

async function deliverDurableAutoReplyPlan(
    conversationId: string,
    plan: DurableAutoReplyPlan,
    isLatestJob: () => boolean,
): Promise<void | LatestOnlyWorkerResult<string>> {
    for (let partIndex = plan.nextPartIndex; partIndex < plan.parts.length; partIndex += 1) {
        const conversation = await isCurrentAutoReplyDelivery(
            conversationId,
            plan.targetMessageId,
            plan.agentCondition,
            isLatestJob,
        );
        if (!conversation) return;

        const partClientMessageId = autoReplyPartClientMessageId(plan.targetMessageId, partIndex);
        let localMessage = await messageRepo.findByClientMessageId(conversationId, partClientMessageId);
        if (!localMessage) {
            localMessage = await conversationService.addMessage(
                conversationId,
                { type: 'agent', id: `bot_${plan.botId}`, name: plan.botName },
                plan.parts[partIndex],
                'text',
                undefined,
                partClientMessageId,
            );
            _botReplyTimestamps.set(conversationId, Date.now());
            console.log(`[Chatbot] Auto-replied part ${partIndex + 1}/${plan.parts.length} in conv ${conversationId}`);
        }

        const delivery = await attemptExternalAutoReplyDelivery({
            channel: conversation.channel,
            messageStatus: localMessage.status,
            isCurrent: async () => Boolean(await isCurrentAutoReplyDelivery(
                conversationId,
                plan.targetMessageId,
                plan.agentCondition,
                isLatestJob,
            )),
            send: () => sendAutoReplyToExternal(conversation, plan.parts[partIndex]),
            markStatus: status => messageRepo.updateStatus(localMessage!.id, status),
        });
        if (delivery === 'stale') return;
        if (delivery === 'retry') {
            console.error(`[Chatbot] External auto-reply part ${partIndex + 1} failed after local save; retrying durable row`);
            return { retryAfterMs: 1_500 };
        }

        const afterDelivery = await loadFreshAutoReplyState(conversationId);
        if (!afterDelivery.conversation || !afterDelivery.latestVisitor) return;
        if (latestVisitorResult(afterDelivery.latestVisitor, plan.targetMessageId)) return;
        if (!conversationAllowsAutoReply(afterDelivery.conversation, plan.agentCondition) || !isLatestJob()) return;
        const nextPlan = { ...plan, nextPartIndex: partIndex + 1 };
        await conversationRepo.updateMetadata(
            conversationId,
            withDurableAutoReplyPlan(afterDelivery.conversation.metadata, nextPlan),
        );

        if (partIndex < plan.parts.length - 1) {
            const keepGoing = await waitForAutoReplyDelivery(plan.interMessageDelayMs, isLatestJob);
            if (!keepGoing) return;
        }
    }

    const finalConversation = await isCurrentAutoReplyDelivery(
        conversationId,
        plan.targetMessageId,
        plan.agentCondition,
        isLatestJob,
    );
    if (finalConversation) await completeAutoReplyPlan(conversationId, finalConversation, plan);
}

async function findZaloConversationForIdentity(
    widgetId: string,
    identity: ZaloConversationIdentity,
): Promise<Conversation | null> {
    if (identity.scopedVisitorId) {
        const scoped = await conversationRepo.findLatestByVisitor(identity.scopedVisitorId, widgetId);
        if (scoped && isCompatibleLegacyZaloConversation(scoped.metadata, identity)) return scoped;
    }

    const legacy = await conversationRepo.findLatestByVisitor(identity.legacyVisitorId, widgetId);
    if (legacy && isCompatibleLegacyZaloConversation(legacy.metadata, identity)) return legacy;
    return null;
}

async function processQueuedAutoReply(
    conversationId: string,
    targetMessageId: string,
    isLatestJob: () => boolean,
): Promise<void | LatestOnlyWorkerResult<string>> {
    const initial = await loadFreshAutoReplyState(conversationId);
    if (!initial.conversation || !initial.latestVisitor) return;

    const initialReplacement = latestVisitorResult(initial.latestVisitor, targetMessageId);
    if (initialReplacement) return initialReplacement;
    if (!isReplyableVisitorMessage(initial.latestVisitor)) return;
    if (!conversationAllowsAutoReply(initial.conversation, 'no_condition')) return;

    // Resume a durable delivery plan before ever asking the model again. This
    // makes a retry after a local save safe for Facebook/Zalo outages and keeps
    // multi-bubble bursts ordered without regenerating different wording.
    const pendingPlan = readDurableAutoReplyPlan(initial.conversation.metadata);
    if (pendingPlan?.targetMessageId === targetMessageId) {
        return deliverDurableAutoReplyPlan(conversationId, pendingPlan, isLatestJob);
    }

    // Compatibility recovery for rows created before durable delivery plans.
    // Only retry known failures; a sent row is idempotently complete.
    const botClientMessageId = autoReplyPartClientMessageId(targetMessageId, 0);
    const existingBotMessage = await messageRepo.findByClientMessageId(conversationId, botClientMessageId);
    if (existingBotMessage) {
        _botReplyTimestamps.set(conversationId, new Date(existingBotMessage.createdAt).getTime());
        if (existingBotMessage.status !== 'error') return;
        const recoveryConversation = initial.conversation;
        const recovery = await attemptExternalAutoReplyDelivery({
            channel: recoveryConversation.channel,
            messageStatus: existingBotMessage.status,
            isCurrent: async () => Boolean(await isCurrentAutoReplyDelivery(
                conversationId,
                targetMessageId,
                'no_condition',
                isLatestJob,
            )),
            send: () => sendAutoReplyToExternal(recoveryConversation, existingBotMessage.content),
            markStatus: status => messageRepo.updateStatus(existingBotMessage.id, status),
        });
        return recovery === 'retry' ? { retryAfterMs: 1_500 } : undefined;
    }

    const lastBotReply = _botReplyTimestamps.get(conversationId);
    if (lastBotReply) {
        const cooldownRemaining = BOT_REPLY_COOLDOWN_MS - (Date.now() - lastBotReply);
        if (cooldownRemaining > 0) return { retryAfterMs: cooldownRemaining };
    }

    // Read one chronological snapshot. If a newer visitor is already present,
    // never build the invalid sequence "newer B in history, then current A".
    const recentMessages = await messageRepo.getLatest(
        conversationId,
        36,
        { excludeInternal: true },
    );
    const snapshotLatestVisitor = [...recentMessages]
        .reverse()
        .find(item => item.senderType === 'visitor' && !item.isDeleted && !item.isInternal) || null;
    const snapshotReplacement = latestVisitorResult(snapshotLatestVisitor, targetMessageId);
    if (snapshotReplacement) return snapshotReplacement;
    if (!isLatestJob()) return;

    const conversationHistory = buildAutoReplyHistory(recentMessages, targetMessageId, 12);

    const generationStartedAt = new Date();
    const generationStartedMs = Date.now();
    try {
        const { chatbotService: botService } = await import('../chatbot/chatbot.service');
        const botResult = await botService.processIncomingMessage(
            initial.conversation.workspaceId,
            initial.latestVisitor.content,
            initial.conversation.channel || 'website',
            conversationHistory,
            {
                assignedTo: initial.conversation.assignedTo,
                metadata: initial.conversation.metadata,
                onlineAgentCount: presenceStore.countOnlineAgents(initial.conversation.workspaceId),
            },
            {
                onProcessingStart: event => {
                    if (!event.typingIndicator || !isLatestJob()) return;
                    startAutoReplyTyping(conversationId, targetMessageId, {
                        senderId: `bot_${event.botId}`,
                        senderName: event.botName,
                        label: event.typingLabel,
                    });
                },
            },
        );
        if (!botResult || !isLatestJob()) return;

        // The bot service already accounts for model/RAG time and persona pace.
        // Polling keeps human takeover and newer visitor turns responsive.
        const stillCurrent = await waitForAutoReplyDelivery(
            botResult.deliveryDelayMs,
            isLatestJob,
        );
        if (!stillCurrent) return;

        // Defense in depth: never persist or deliver an unsafe reply even if a
        // future response source bypasses the chatbot service's own guard.
        const outboundGuard = guardAutoReplyOutput({
            candidate: botResult.response,
            currentMessage: initial.latestVisitor.content,
            history: conversationHistory,
        });
        if (!outboundGuard.allowed) {
            console.warn(`[Chatbot] Auto-reply suppressed by final output guard (${outboundGuard.reason})`);
            return;
        }
        botResult.response = outboundGuard.response;
        const normalizedResponse = botResult.response.replace(/\s+/g, ' ').trim();
        const configuredParts = (botResult.responseParts || [])
            .map(part => part.replace(/\s+/g, ' ').trim())
            .filter(Boolean);
        const responseParts = configuredParts.length > 1
            && configuredParts.join(' ') === normalizedResponse
            ? configuredParts
            : [botResult.response];

        const plan = createDurableAutoReplyPlan({
            targetMessageId,
            botId: botResult.botId,
            botName: botResult.botName,
            agentCondition: botResult.agentCondition,
            source: botResult.source || 'ai',
            handoffRequested: Boolean(botResult.handoffRequested),
            parts: responseParts,
            interMessageDelayMs: botResult.interMessageDelayMs || 0,
            traceId: crypto.randomUUID(),
            generationStartedAt: generationStartedAt.toISOString(),
            generationDurationMs: Date.now() - generationStartedMs,
        });
        if (!plan.parts.length) return;
        const beforePlan = await isCurrentAutoReplyDelivery(
            conversationId,
            targetMessageId,
            botResult.agentCondition,
            isLatestJob,
        );
        if (!beforePlan) return;
        await conversationRepo.updateMetadata(
            conversationId,
            withDurableAutoReplyPlan(beforePlan.metadata, plan),
        );
        return deliverDurableAutoReplyPlan(conversationId, plan, isLatestJob);
    } finally {
        stopAutoReplyTyping(conversationId, targetMessageId);
    }
}

const _autoReplyWorker = createLatestOnlyWorker<string>(processQueuedAutoReply, {
    debounceMs: AUTO_REPLY_DEBOUNCE_MS,
    errorRetryMs: 1_500,
    onError: (error, conversationId) => {
        console.error(`[Chatbot] Auto-reply worker failed for conv ${conversationId}; retrying`, error);
    },
});

/**
 * Debounce map for lead auto-sync.
 * Prevents hammering DB on rapid successive messages from the same user.
 * Maps `userId` → last sync timestamp.
 */
const _leadSyncTimestamps = new Map<string, number>();
const LEAD_SYNC_DEBOUNCE_MS = 30_000; // Only sync once per 30 seconds per user

export const conversationService = {
    /**
     * Find existing open conversation for visitor, or create a new one.
     * Also upserts visitor profile.
     */
    async findOrCreate(widgetId: string, visitorId: string, visitorInfo: Record<string, any> = {}, metadata: Record<string, any> = {}, forceNew: boolean = false) {
        const widget = await widgetRepo.findById(widgetId);
        const safeVisitorInfo = normalizeWidgetVisitorInfo(visitorInfo);
        if (!widget || !widget.isActive) throw new AppError('Widget không tồn tại', 404, 'NOT_FOUND');

        // Upsert visitor profile
        const { visitor } = await visitorRepo.findOrCreate(
            visitorId,
            widgetId,
            (widget.workspaceId as any).toString(),
            safeVisitorInfo
        );

        // Try to find existing conversation (any status) unless forceNew is true
        // This prevents creating duplicate conversations when a closed conversation gets a new session
        let conversation = forceNew ? null : await conversationRepo.findLatestByVisitor(visitorId, widgetId);
        if (conversation && !['widget', 'website'].includes(String(conversation.channel || ''))) {
            conversation = null;
        }
        let isNew = false;

        if (!conversation) {
            conversation = await conversationRepo.create({
                workspaceId: widget.workspaceId,
                widgetId: widget.id as any,
                visitorId,
                visitorInfo: safeVisitorInfo,
                status: 'open',
                lastMessageAt: new Date(),
                metadata,
            });
            isNew = true;
            await visitorRepo.incrementConversations(visitorId, widgetId);
        } else if (conversation.status === 'closed' || conversation.status === 'resolved') {
            // Reopen existing closed conversation instead of creating a duplicate
            await conversationRepo.updateStatus(getId(conversation), 'open');
            conversation.status = 'open';
        }

        // Returning visitors can fill the pre-chat form after their first
        // session. Merge only normalized public fields and preserve previously
        // collected identity/consent data.
        const currentVisitorInfo = jsonRecord(conversation.visitorInfo);
        const nextVisitorInfo = {
            ...currentVisitorInfo,
            ...(safeVisitorInfo.name ? { name: safeVisitorInfo.name } : {}),
            ...(safeVisitorInfo.email ? { email: safeVisitorInfo.email } : {}),
            ...(safeVisitorInfo.phone ? { phone: safeVisitorInfo.phone } : {}),
            ...(safeVisitorInfo.avatar ? { avatar: safeVisitorInfo.avatar } : {}),
            ...(safeVisitorInfo.marketingConsent ? {
                marketingConsent: true,
                consentText: safeVisitorInfo.consentText,
                consentAt: new Date().toISOString(),
            } : {}),
        };
        if (JSON.stringify(nextVisitorInfo) !== JSON.stringify(currentVisitorInfo)) {
            const refreshed = await prisma.conversation.update({
                where: { id: getId(conversation) },
                data: { visitorInfo: nextVisitorInfo },
            });
            conversation.visitorInfo = refreshed.visitorInfo;
        }

        const msgResult = await messageRepo.findByConversation(getId(conversation), { limit: 30, excludeInternal: true });
        const messages = msgResult.items;

        // Generate visitor token for socket auth
        const visitorToken = security.generateVisitorToken(visitorId, widgetId);

        // Emit workspace event for new conversations
        if (isNew) {
            try {
                emitToWorkspace((widget.workspaceId as any).toString(), 'conversation:new', {
                    conversation, visitor, visitorInfo: nextVisitorInfo,
                });
            } catch { /* socket may not be initialized yet */ }
        }

        return {
            conversation: {
                id: getId(conversation),
                status: conversation.status,
                updatedAt: conversation.updatedAt,
                lastMessageAt: conversation.lastMessageAt,
            },
            messages: messages.map(serializePublicMessage),
            totalMessages: msgResult.total,
            visitor: {
                visitorId: visitor.visitorId,
            },
            visitorToken,
            isNew,
        };
    },

    /**
     * Handle incoming messages from Zalo. 
     * Creates a visitor and conversation if they don't exist.
     */
    async handleIncomingZaloMessage(
        workspaceId: string, 
        zaloUserId: string, 
        zaloUserName: string, 
        zaloAvatar: string, 
        content: string, 
        msgType: 'text' | 'image' | 'video' | 'file' = 'text',
        attachments: any[] = [],
        clientMessageId?: string,
        groupSenderName?: string, // For group messages: the individual sender's name
        zaloAccountId?: string,
        zaloAccountName?: string,
        zaloThreadType?: ZaloThreadType,
    ) {
        // Find a widget to associate the visitor with (we use the first active widget, or auto-create one for Zalo)
        let widgetList = await widgetRepo.findByWorkspace(workspaceId);
        let targetWidget;
        if (!widgetList || widgetList.length === 0) {
            // Auto-create a Zalo widget for this workspace
            console.log(`[ConvService] Auto-creating Zalo widget for workspace ${workspaceId}`);
            targetWidget = await widgetRepo.create({
                workspaceId: workspaceId as any,
                name: 'Zalo',
                isActive: true,
                config: {
                    primaryColor: '#0068ff',
                    greeting: 'Xin chào! Chúng tôi có thể giúp gì cho bạn?',
                    placeholder: 'Nhập tin nhắn...',
                    position: 'bottom-right',
                    language: 'vi',
                    showBranding: false,
                    offlineMessage: 'Hiện tại không có agent trực tuyến.',
                    preChatForm: {
                        enabled: false,
                        title: '',
                        fields: [],
                    },
                },
                domainRules: { mode: 'allowlist', domains: [] },
            } as any);
        } else {
            targetWidget = widgetList[0];
        }
        const widgetId = getId(targetWidget);
        const threadType: ZaloThreadType = zaloThreadType || (groupSenderName ? 'group' : 'user');
        const identity = buildZaloConversationIdentity(zaloUserId, zaloAccountId, threadType);

        // Prefer the account-scoped identity. Existing legacy history is adopted
        // only while unclaimed or already owned by this exact Zalo account.
        let conversation = await findZaloConversationForIdentity(widgetId, identity);
        const visitorId = conversation?.visitorId || identity.preferredVisitorId;

        // Upsert visitor profile
        const { visitor } = await visitorRepo.findOrCreate(
            visitorId,
            widgetId,
            workspaceId,
            {
                name: zaloUserName,
                avatar: zaloAvatar,
                attributes: {
                    channel: 'zalo',
                    zaloUserId,
                    threadType,
                    ...(identity.accountId ? { accountId: identity.accountId } : {}),
                    ...(zaloAccountName ? { pageName: zaloAccountName } : {}),
                },
            }
        );

        let isNew = false;

        if (!conversation) {
            // No conversation exists at all — create new
            conversation = await conversationRepo.create({
                workspaceId: workspaceId as any,
                widgetId: getId(targetWidget) as any,
                visitorId,
                visitorInfo: { name: zaloUserName, avatar: zaloAvatar },
                channel: 'zalo',
                status: 'open',
                lastMessageAt: new Date(),
                metadata: { 
                    zaloUserId,
                    threadType,
                    ...(identity.accountId ? { accountId: identity.accountId } : {}),
                    ...(zaloAccountName ? { pageName: zaloAccountName } : {}),
                },
            });
            isNew = true;
            await visitorRepo.incrementConversations(visitorId, widgetId);

            try {
                emitToWorkspace(workspaceId, 'conversation:new', {
                    conversation, visitor, visitorInfo: { name: zaloUserName, avatar: zaloAvatar },
                });
            } catch { /* socket may not be initialized yet */ }
        } else if (conversation.status === 'closed' || conversation.status === 'resolved') {
            // Reopen the existing conversation instead of creating a duplicate
            await conversationRepo.updateStatus(getId(conversation), 'open');
            conversation.status = 'open';
            
            try {
                emitToWorkspace(workspaceId, 'conversation:reopened', {
                    conversationId: getId(conversation),
                });
            } catch { /* socket may not be initialized */ }
        }

        // Update visitorInfo avatar/name if we have them now (always overwrite to keep fresh)
        if (conversation && !isNew && zaloAvatar) {
            const currentVisitorInfo = jsonRecord(conversation.visitorInfo);
            const currentAvatar = typeof currentVisitorInfo.avatar === 'string' ? currentVisitorInfo.avatar : '';
            const currentName = typeof currentVisitorInfo.name === 'string' ? currentVisitorInfo.name : '';
            const needsUpdate = (zaloAvatar && zaloAvatar !== currentAvatar)
                || (zaloUserName && zaloUserName !== currentName);
            if (needsUpdate) {
                const updateFields: Record<string, any> = {};
                if (zaloAvatar) {
                    updateFields['visitorInfo.avatar'] = zaloAvatar;
                }
                if (zaloUserName && zaloUserName !== currentName) {
                    updateFields['visitorInfo.name'] = zaloUserName;
                }
                try {
                    const newVisitorInfo = {
                        ...currentVisitorInfo,
                        ...(zaloAvatar ? { avatar: zaloAvatar } : {}),
                        ...(zaloUserName ? { name: zaloUserName } : {}),
                    };
                    await prisma.conversation.update({
                        where: { id: getId(conversation) },
                        data: { visitorInfo: newVisitorInfo }
                    });
                    // Also update in-memory object
                    conversation.visitorInfo = newVisitorInfo;
                } catch { /* silent */ }
            }
        }

        // Backfill routing metadata. Marking an existing group before addMessage
        // also guarantees the auto-reply hook treats it as human-only.
        if (conversation && !isNew) {
            const currentMetadata = ((conversation as any).metadata || {}) as Record<string, any>;
            const metadataPatch: Record<string, any> = {};
            if (!currentMetadata.threadType) metadataPatch.threadType = threadType;
            if (identity.accountId && !currentMetadata.accountId) metadataPatch.accountId = identity.accountId;
            if (zaloAccountName && !currentMetadata.pageName) metadataPatch.pageName = zaloAccountName;

            if (Object.keys(metadataPatch).length > 0) {
                const nextMetadata = { ...currentMetadata, ...metadataPatch };
                try {
                    await prisma.conversation.update({
                        where: { id: getId(conversation) },
                        data: { metadata: nextMetadata },
                    });
                    (conversation as any).metadata = nextMetadata;
                } catch { /* silent - metadata update is best-effort */ }
            }
        }

        // Add message to conversation
        // For group messages: use individual sender name instead of group name
        const messageSenderName = groupSenderName || zaloUserName;
        const result = await this.addMessage(
            getId(conversation),
            { type: 'visitor', id: visitorId, name: messageSenderName },
            content,
            msgType as any,
            attachments,
            clientMessageId
        );

        // ── Auto-Sync Lead from incoming Zalo message ──
        // Non-blocking: runs in background, errors are silently caught
        this.autoSyncLeadFromZalo(workspaceId, zaloUserId, zaloUserName, zaloAvatar, content, 'zalo').catch(
            err => console.error('[ConvService] Auto-sync lead error:', err)
        );

        return result;
    },

    /**
     * Handle self-sent Zalo messages (sent from Zalo app) — route as agent message for 2-way sync
     */
    async handleSelfZaloMessage(
        workspaceId: string,
        zaloThreadId: string,
        conversationName: string,
        zaloAvatar: string,
        content: string,
        msgType: 'text' | 'image' | 'video' | 'file' = 'text',
        attachments: any[] = [],
        clientMessageId?: string,
        zaloAccountId?: string,
        zaloAccountName?: string,
        zaloThreadType: ZaloThreadType = 'user',
    ) {
        // Find the existing conversation for this thread — don't create new one for self-messages
        const widgetList = await widgetRepo.findByWorkspace(workspaceId);
        if (!widgetList || widgetList.length === 0) return; // no widget = no conversation possible

        const widgetId = getId(widgetList[0]);
        const identity = buildZaloConversationIdentity(zaloThreadId, zaloAccountId, zaloThreadType);
        const conversation = await findZaloConversationForIdentity(widgetId, identity);
        if (!conversation) {
            console.log(`[ConvService] No existing conversation for self-msg thread ${zaloThreadId} on account ${identity.accountId || 'legacy'}, skipping`);
            return;
        }

        // Claim unscoped legacy history for this account so another personal
        // account with the same contact/thread can no longer merge into it.
        const currentMetadata = ((conversation as any).metadata || {}) as Record<string, any>;
        const metadataPatch: Record<string, any> = {};
        if (!currentMetadata.threadType) metadataPatch.threadType = zaloThreadType;
        if (identity.accountId && !currentMetadata.accountId) metadataPatch.accountId = identity.accountId;
        if (zaloAccountName && !currentMetadata.pageName) metadataPatch.pageName = zaloAccountName;
        if (Object.keys(metadataPatch).length > 0) {
            const nextMetadata = { ...currentMetadata, ...metadataPatch };
            await conversationRepo.updateMetadata(getId(conversation), nextMetadata);
            (conversation as any).metadata = nextMetadata;
        }

        // Reopen if closed so the message can be added
        if (conversation.status === 'closed' || conversation.status === 'resolved') {
            await conversationRepo.updateStatus(getId(conversation), 'open');
            conversation.status = 'open';
        }

        // Add message as 'agent' type (it was sent by us from the Zalo app)
        return this.addMessage(
            getId(conversation),
            { type: 'agent', id: 'zalo_self', name: '📱 Zalo App' },
            content,
            msgType as any,
            attachments,
            clientMessageId
        );
    },

    /**
     * Handle incoming Facebook Messenger message → Route vào Inbox
     */
    async handleIncomingFacebookMessage(
        workspaceId: string,
        fbUserId: string,
        fbUserName: string,
        fbAvatar: string,
        content: string,
        msgType: 'text' | 'image' | 'video' | 'file' = 'text',
        attachments: any[] = [],
        clientMessageId?: string,
        pageId?: string,
        pageName?: string,
    ) {
        // Find/create widget for Facebook
        let widgetList = await widgetRepo.findByWorkspace(workspaceId);
        let targetWidget = widgetList?.find(w => (w as any).name === 'Facebook') || widgetList?.[0];

        if (!targetWidget) {
            console.log(`[ConvService] Auto-creating Facebook widget for workspace ${workspaceId}`);
            targetWidget = await widgetRepo.create({
                workspaceId: workspaceId as any,
                name: 'Facebook',
                isActive: true,
                config: {
                    primaryColor: '#1877F2',
                    greeting: 'Xin chào! Chúng tôi có thể giúp gì cho bạn?',
                    placeholder: 'Nhập tin nhắn...',
                    position: 'bottom-right',
                    language: 'vi',
                    showBranding: false,
                    offlineMessage: 'Hiện tại không có agent trực tuyến.',
                    preChatForm: { enabled: false, title: '', fields: [] },
                },
                domainRules: { mode: 'allowlist', domains: [] },
            } as any);
        }

        const widgetId = getId(targetWidget);
        const visitorId = `fb_${fbUserId}`;

        // Upsert visitor
        const { visitor } = await visitorRepo.findOrCreate(
            visitorId,
            widgetId,
            workspaceId,
            { name: fbUserName, avatar: fbAvatar, attributes: { channel: 'facebook', fbUserId, pageId, pageName } }
        );

        // Update visitor profile if we now have better data (e.g. avatar fetched later)
        if (fbAvatar) {
            await visitorRepo.enrichProfile(visitorId, widgetId, {
                name: fbUserName,
                attributes: { avatar: fbAvatar, channel: 'facebook', fbUserId, pageId, pageName },
            });
        }

        // Find/create conversation
        let conversation = await conversationRepo.findLatestByVisitor(visitorId, widgetId);
        let isNew = false;

        if (!conversation) {
            conversation = await conversationRepo.create({
                workspaceId: workspaceId as any,
                widgetId: getId(targetWidget) as any,
                visitorId,
                visitorInfo: { name: fbUserName, avatar: fbAvatar },
                channel: 'facebook',
                status: 'open',
                lastMessageAt: new Date(),
                metadata: { fbUserId, pageId, pageName },
            });
            isNew = true;
            await visitorRepo.incrementConversations(visitorId, widgetId);

            try {
                emitToWorkspace(workspaceId, 'conversation:new', {
                    conversation, visitor, visitorInfo: { name: fbUserName, avatar: fbAvatar },
                });
            } catch { /* socket may not be initialized yet */ }
        } else if (conversation.status === 'closed' || conversation.status === 'resolved') {
            await conversationRepo.updateStatus(getId(conversation), 'open');
            conversation.status = 'open';

            try {
                emitToWorkspace(workspaceId, 'conversation:reopened', {
                    conversationId: getId(conversation),
                });
            } catch { /* socket may not be initialized */ }
        }

        // Update visitorInfo on existing conversation if we now have avatar/name
        if (conversation && !isNew) {
            const currentVisitorInfo = jsonRecord(conversation.visitorInfo);
            const currentAvatar = typeof currentVisitorInfo.avatar === 'string' ? currentVisitorInfo.avatar : '';
            const currentName = typeof currentVisitorInfo.name === 'string' ? currentVisitorInfo.name : '';
            const hasNewAvatar = Boolean(fbAvatar && !currentAvatar);
            const hasNewName = Boolean(fbUserName && currentName !== fbUserName && fbUserName !== `FB User ${fbUserId.slice(-4)}`);
            if (hasNewAvatar || hasNewName) {
                try {
                    await conversationRepo.updateVisitorInfo(getId(conversation), {
                        ...(hasNewAvatar ? { avatar: fbAvatar } : {}),
                        ...(hasNewName ? { name: fbUserName } : {}),
                    });
                } catch { /* silent */ }
            }
        }

        const result = await this.addMessage(
            getId(conversation),
            { type: 'visitor', id: visitorId, name: fbUserName },
            content,
            msgType as any,
            attachments,
            clientMessageId
        );

        // ── Auto-Sync Lead from incoming Facebook message ──
        this.autoSyncLeadFromZalo(workspaceId, fbUserId, fbUserName, fbAvatar || '', content, 'facebook').catch(
            err => console.error('[ConvService] Auto-sync FB lead error:', err)
        );

        return result;
    },

    /**
     * Handle self-sent Facebook messages (sent from the page) — route as agent message for 2-way sync
     */
    async handleSelfFacebookMessage(
        workspaceId: string,
        fbUserId: string,
        fbUserName: string,
        fbAvatar: string,
        content: string,
        msgType: 'text' | 'image' | 'video' | 'file' = 'text',
        attachments: any[] = [],
        clientMessageId?: string,
        pageId?: string,
        pageName?: string,
    ) {
        // Skip empty self-messages
        if (!content && (!attachments || attachments.length === 0)) return;

        const visitorId = `fb_${fbUserId}`;
        const widgetList = await widgetRepo.findByWorkspace(workspaceId);
        if (!widgetList || widgetList.length === 0) return;

        const targetWidget = widgetList.find(w => (w as any).name === 'Facebook') || widgetList[0];
        const widgetId = getId(targetWidget);

        // Upsert visitor (without creating a message)
        await visitorRepo.findOrCreate(
            visitorId, widgetId, workspaceId,
            { name: fbUserName, avatar: fbAvatar, attributes: { channel: 'facebook', fbUserId, pageId, pageName } }
        );

        // Find or create conversation without sending an empty message
        let conversation = await conversationRepo.findLatestByVisitor(visitorId, widgetId);
        if (!conversation) {
            conversation = await conversationRepo.create({
                workspaceId: workspaceId as any,
                widgetId: getId(targetWidget) as any,
                visitorId,
                visitorInfo: { name: fbUserName, avatar: fbAvatar },
                channel: 'facebook',
                status: 'open',
                lastMessageAt: new Date(),
                metadata: { fbUserId, pageId, pageName },
            });
            await visitorRepo.incrementConversations(visitorId, widgetId);
        }

        if (conversation.status === 'closed') {
            await conversationRepo.updateStatus(getId(conversation), 'open');
            conversation.status = 'open';
        }

        return this.addMessage(
            getId(conversation),
            { type: 'agent', id: 'fb_page', name: pageName || 'Facebook Page' },
            content,
            msgType as any,
            attachments,
            clientMessageId
        );
    },

    /**
     * Resume conversation — get conversation + messages
     */
    async resume(conversationId: string, visitorId: string) {
        const conversation = await conversationRepo.findById(conversationId);
        if (!conversation) throw new AppError('Cuộc hội thoại không tồn tại', 404, 'NOT_FOUND');
        if (conversation.visitorId !== visitorId) throw new AppError('Không có quyền', 403, 'FORBIDDEN');

        const msgResult = await messageRepo.findByConversation(getId(conversation), { limit: 30, excludeInternal: true });
        return { conversation, messages: msgResult.items, totalMessages: msgResult.total };
    },

    /**
     * Get all conversations for a specific visitor
     */
    async getByVisitor(visitorId: string, widgetId: string) {
        const conversations = await conversationRepo.findByVisitor(visitorId, widgetId);

        // This response is consumed by the unauthenticated widget. Never return
        // workspace-only fields such as assignment, tags, lead/AI metadata or
        // the complete visitor profile. Build the preview from a public message
        // as system events and internal notes must not leak into the launcher.
        return Promise.all(conversations.map(async conversation => {
            const messages = await messageRepo.getLatest(getId(conversation), 30, { excludeInternal: true });
            let previewMessage: Message | undefined;
            for (let index = messages.length - 1; index >= 0; index -= 1) {
                if (messages[index].senderType !== 'system') {
                    previewMessage = messages[index];
                    break;
                }
            }

            const preview = previewMessage
                ? previewMessage.type === 'image'
                    ? '📷 Hình ảnh'
                    : previewMessage.type === 'file'
                        ? '📎 Tệp đính kèm'
                        : previewMessage.content.slice(0, 120)
                : '';

            return {
                id: getId(conversation),
                status: conversation.status,
                updatedAt: conversation.updatedAt,
                lastMessageAt: conversation.lastMessageAt,
                lastMessageSnippet: preview,
            };
        }));
    },

    /**
     * Add a message to a conversation.
     */
    async addMessage(
        conversationId: string,
        sender: { type: 'visitor' | 'agent' | 'system'; id: string; name?: string },
        content: string,
        msgType: 'text' | 'image' | 'file' | 'system' = 'text',
        attachments?: Array<{ data: string; url?: string; filename: string; mimeType: string; size: number }>,
        clientMessageId?: string,
        replyTo?: { messageId: string; content: string; senderName: string }
    ) {
        const conversation = await conversationRepo.findById(conversationId);
        if (!conversation) throw new AppError('Cuộc hội thoại không tồn tại', 404, 'NOT_FOUND');

        // ── Idempotency check ──
        if (clientMessageId) {
            const existing = await messageRepo.findByClientMessageId(conversationId, clientMessageId);
            if (existing) {
                // Recover the narrow save-before-enqueue crash window. The worker's
                // deterministic bot id makes replaying an old inbound event harmless.
                if (isReplyableVisitorMessage(existing) && !isZaloGroupConversation(conversation)) {
                    _autoReplyWorker.enqueue(conversationId, getId(existing));
                }
                return existing;
            }
        }

        // ── Visitor checks ──
        if (sender.type === 'visitor') {
            if (conversation.visitorId !== sender.id) {
                throw new AppError('Không có quyền gửi tin nhắn', 403, 'FORBIDDEN');
            }
            if (conversation.status !== 'open') {
                await conversationRepo.updateStatus(conversationId, 'open');
            }
        }

        // ── Agent checks ──
        if (sender.type === 'agent') {
            if (conversation.status === 'closed') {
                throw new AppError('Cuộc hội thoại đã đóng. Vui lòng mở lại trước khi gửi tin nhắn.', 400, 'CONVERSATION_CLOSED');
            }
        }

        // ── Sanitize content ──
        let sanitizedContent = content;
        let sanitizeFlags: string[] = [];
        if (content && sender.type !== 'system') {
            const result = sanitizeMessage(content);
            if (result.blocked) {
                throw new AppError('Nội dung tin nhắn chứa mã độc hoặc spam', 400, 'CONTENT_BLOCKED');
            }
            sanitizedContent = result.sanitized;
            sanitizeFlags = result.flags;
        }

        // ── Sanitize attachment filenames ──
        const safeAttachments = (attachments || []).map((att) => ({
            ...att,
            filename: sanitizeFilename(att.filename || (att as any).name || 'attachment'),
            url: att.url || undefined,
        }));

        // A reply quote is only a pointer supplied by the client. Derive the
        // quoted copy and author from the durable message so visitors cannot
        // forge a staff quote or reference another workspace's conversation.
        let verifiedReply: { messageId: string; content: string; senderName: string } | undefined;
        if (replyTo?.messageId) {
            const sourceMessage = await messageRepo.findById(replyTo.messageId);
            if (
                !sourceMessage
                || sourceMessage.conversationId !== conversationId
                || sourceMessage.isInternal
                || sourceMessage.isDeleted
            ) {
                throw new AppError('Tin nhắn được trả lời không còn khả dụng', 400, 'REPLY_MESSAGE_UNAVAILABLE');
            }
            const sourceAttachments = Array.isArray(sourceMessage.attachments)
                ? sourceMessage.attachments as Array<{ filename?: unknown }>
                : [];
            const quotedContent = sourceMessage.content.trim()
                || (sourceMessage.type === 'image' ? 'Ảnh' : '')
                || (sourceMessage.type === 'file'
                    ? String(sourceAttachments[0]?.filename || 'Tệp đính kèm')
                    : 'Tin nhắn');
            verifiedReply = {
                messageId: sourceMessage.id,
                content: quotedContent.slice(0, 500),
                senderName: String(
                    sourceMessage.senderName
                    || (sourceMessage.senderType === 'visitor' ? 'Khách hàng' : 'Hỗ trợ'),
                ).slice(0, 120),
            };
        }

        // A real agent reply is an explicit takeover. Only transition after the
        // payload passes validation. clientMessageId is client-supplied and must
        // never be trusted as an automation-origin signal.
        const humanAgentMessage = isHumanAgentSender(sender.type, sender.id);
        if (humanAgentMessage) {
            const takeoverMetadata = buildHumanTakeoverMetadata(conversation.metadata, sender);
            await conversationRepo.updateMetadata(conversationId, takeoverMetadata);
            (conversation as any).metadata = takeoverMetadata;
            stopAutoReplyTyping(conversationId);
            _autoReplyWorker.clear(conversationId);
        }

        const message = await messageRepo.create({
            conversationId: getId(conversation),
            clientMessageId: clientMessageId || undefined,
            senderType: sender.type,
            senderId: sender.id,
            senderName: sender.name,
            content: sanitizedContent,
            type: msgType,
            attachments: safeAttachments,
            sanitizeFlags: sanitizeFlags.length > 0 ? sanitizeFlags : undefined,
            ...(verifiedReply ? {
                replyToMessageId: verifiedReply.messageId,
                replyToContent: verifiedReply.content,
                replyToSenderName: verifiedReply.senderName,
            } : {}),
        });

        // Promote identified web visitors only after a real inbound message.
        // Abandoned or anonymous widget opens remain Visitor records.
        if (sender.type === 'visitor' && ['widget', 'website'].includes(String(conversation.channel || ''))) {
            void captureLeadFromWidget({
                workspaceId: getId(conversation.workspaceId),
                widgetId: getId(conversation.widgetId),
                visitorId: conversation.visitorId,
                conversationId: getId(conversation),
                visitorInfo: conversation.visitorInfo,
                conversationMetadata: conversation.metadata,
                messageContent: sanitizedContent,
            }).catch((error) => {
                const code = typeof (error as any)?.code === 'string' ? (error as any).code : 'UNKNOWN';
                console.warn(`[LeadCapture] Widget lead sync skipped (${code})`);
            });
        }

        // ── Build conversation summary snippet ──
        const snippet = msgType === 'image' ? '📷 Hình ảnh'
            : msgType === 'file' ? '📎 Tệp đính kèm'
            : sanitizedContent.length > 80 ? sanitizedContent.slice(0, 80) + '…'
            : sanitizedContent;

        await conversationRepo.updateLastMessage(conversationId, {
            snippet,
            sender: { type: sender.type, name: sender.name },
            incrementUnread: sender.type !== 'agent', // visitor/system msgs count as unread for agents
        });

        // Emit to conversation room (both visitor + agents watching this conv)
        try {
            console.log(`[MessageService] Emitting message:new to room: ${conversationId}`, message);
            emitToConversation(conversationId, 'message:new', message);
            emitToWorkspace(getId(conversation.workspaceId), 'conversation:updated', {
                conversationId, lastMessage: { content: sanitizedContent, sender, type: msgType, createdAt: message.createdAt },
                ...(humanAgentMessage ? { metadata: conversation.metadata } : {}),
            });
        } catch (e) { console.error('Socket emit error:', e); }

        // Workflow execution is deliberately detached from the request path. It
        // may only create an internal draft or perform allow-listed safe actions.
        if (sender.type === 'visitor' && msgType === 'text' && sanitizedContent.trim().length > 0) {
            void runMessageWorkflows(conversation, message).catch((error) => {
                console.warn('[Automation] Message workflow skipped', error?.message || error);
            });
        }

        // Queue AI work after the inbound row is durable so webhook/socket callers
        // are not held open by RAG or model latency. Bursts coalesce to the latest text.
        if (sender.type === 'visitor' && msgType === 'text' && sanitizedContent.trim().length > 0) {
            if (isZaloGroupConversation(conversation)) {
                console.log(`[Chatbot] Zalo group is human-only — skipping auto-reply for conv ${conversationId}`);
            } else {
                _autoReplyWorker.enqueue(conversationId, getId(message));
            }
        }

        return message;
    },

    /**
     * Ensure a Zalo thread appears in the unified inbox even when Zalo does not
     * expose historical messages for that thread. This creates only the
     * conversation/contact shell; it never invents a Message row.
     */
    async ensureZaloConversationShell(
        workspaceId: string,
        zaloThreadId: string,
        zaloThreadName: string,
        zaloAvatar = '',
        zaloAccountId?: string,
        zaloAccountName?: string,
        zaloThreadType?: ZaloThreadType,
    ) {
        let widgetList = await widgetRepo.findByWorkspace(workspaceId);
        let targetWidget = widgetList?.[0];
        if (!targetWidget) {
            targetWidget = await widgetRepo.create({
                workspaceId: workspaceId as any,
                name: 'Zalo',
                isActive: true,
                config: {
                    primaryColor: '#0068ff',
                    greeting: 'Xin chào! Chúng tôi có thể giúp gì cho bạn?',
                    placeholder: 'Nhập tin nhắn...',
                    position: 'bottom-right',
                    language: 'vi',
                    showBranding: false,
                    offlineMessage: 'Hiện tại không có agent trực tuyến.',
                    preChatForm: { enabled: false, title: '', fields: [] },
                },
                domainRules: { mode: 'allowlist', domains: [] },
            } as any);
        }

        const widgetId = getId(targetWidget);
        const threadType: ZaloThreadType = zaloThreadType || 'user';
        const identity = buildZaloConversationIdentity(zaloThreadId, zaloAccountId, threadType);
        let conversation = await findZaloConversationForIdentity(widgetId, identity);
        const visitorId = conversation?.visitorId || identity.preferredVisitorId;

        await visitorRepo.findOrCreate(
            visitorId,
            widgetId,
            workspaceId,
            {
                name: zaloThreadName || `Zalo ${zaloThreadId}`,
                avatar: zaloAvatar,
                attributes: {
                    channel: 'zalo',
                    zaloUserId: zaloThreadId,
                    threadType,
                    historyUnavailable: true,
                    ...(identity.accountId ? { accountId: identity.accountId } : {}),
                    ...(zaloAccountName ? { pageName: zaloAccountName } : {}),
                },
            }
        );

        if (!conversation) {
            conversation = await conversationRepo.create({
                workspaceId: workspaceId as any,
                widgetId: widgetId as any,
                visitorId,
                visitorInfo: { name: zaloThreadName || `Zalo ${zaloThreadId}`, avatar: zaloAvatar },
                channel: 'zalo',
                status: 'open',
                lastMessageAt: new Date(),
                metadata: {
                    zaloUserId: zaloThreadId,
                    threadType,
                    historyUnavailable: true,
                    syncPlaceholder: true,
                    ...(identity.accountId ? { accountId: identity.accountId } : {}),
                    ...(zaloAccountName ? { pageName: zaloAccountName } : {}),
                },
            });

            try {
                emitToWorkspace(workspaceId, 'conversation:new', {
                    conversation,
                    visitorInfo: { name: zaloThreadName || `Zalo ${zaloThreadId}`, avatar: zaloAvatar },
                });
            } catch { /* socket may not be initialized */ }
        }

        return conversation;
    },

    async getMessages(conversationId: string, options?: { page?: number; limit?: number; excludeInternal?: boolean }) {
        return messageRepo.findByConversation(conversationId, options);
    },

    async assertVisitorAccess(conversationId: string, visitorId: string) {
        if (!visitorId) throw new AppError('Thiếu định danh khách truy cập', 401, 'UNAUTHORIZED');
        const conversation = await conversationRepo.findById(conversationId);
        if (!conversation) throw new AppError('Cuộc hội thoại không tồn tại', 404, 'NOT_FOUND');
        if (conversation.visitorId !== visitorId) throw new AppError('Không có quyền', 403, 'FORBIDDEN');
        if (!['widget', 'website'].includes(String(conversation.channel || ''))) {
            throw new AppError('Kênh hội thoại không hỗ trợ truy cập công khai', 403, 'FORBIDDEN');
        }
        return conversation;
    },

    async getPublicMessages(conversationId: string, options?: { page?: number; limit?: number }) {
        const result = await messageRepo.findByConversation(conversationId, {
            ...options,
            excludeInternal: true,
        });
        return { items: result.items.map(serializePublicMessage), total: result.total };
    },

    async editMessage(conversationId: string, messageId: string, newContent: string, agentId: string) {
        const msg = await messageRepo.findById(messageId);
        if (!msg || msg.conversationId !== conversationId) {
            throw new AppError('Không tìm thấy tin nhắn', 404, 'NOT_FOUND');
        }
        if (msg.senderId !== agentId || msg.senderType !== 'agent') {
            throw new AppError('Bạn chỉ có thể sửa tin nhắn của chính mình', 403, 'FORBIDDEN');
        }
        if (msg.isDeleted) {
            throw new AppError('Không thể sửa tin nhắn đã thu hồi', 400, 'BAD_REQUEST');
        }

        const original = msg.originalContent || msg.content;
        const updatedMsg = await prisma.message.update({
            where: { id: messageId },
            data: { content: newContent, originalContent: original, editedAt: new Date() },
        });
        
        try {
            emitToConversation(conversationId, 'message:edited', updatedMsg);
        } catch { /* socket offline */ }

        return updatedMsg;
    },

    async recallMessage(conversationId: string, messageId: string, agentId: string) {
        const msg = await messageRepo.findById(messageId);
        if (!msg || msg.conversationId !== conversationId) {
            throw new AppError('Không tìm thấy tin nhắn', 404, 'NOT_FOUND');
        }
        if (msg.senderId !== agentId || msg.senderType !== 'agent') {
            throw new AppError('Bạn chỉ có thể thu hồi tin nhắn của chính mình', 403, 'FORBIDDEN');
        }
        if (msg.isDeleted) {
            throw new AppError('Tin nhắn này đã bị thu hồi bới bạn', 400, 'BAD_REQUEST');
        }

        await prisma.message.update({ where: { id: messageId }, data: { isDeleted: true } });

        try {
            emitToConversation(conversationId, 'message:recalled', { messageId, conversationId });
        } catch { /* socket offline */ }

        return { ...msg, isDeleted: true };
    },

    async getMessageContextPage(conversationId: string, messageId: string, limit: number = 30) {
        const page = await messageRepo.getMessagePage(conversationId, messageId, limit);
        if (!page) throw new AppError('Message not found', 404, 'NOT_FOUND');
        return { page };
    },

    async markRead(conversationId: string, requester?: { userId: string; type: 'visitor' | 'agent' }) {
        if (!requester?.userId) {
            await conversationRepo.markRead(conversationId);
            return;
        }

        const latestMsg = await messageRepo.findLatest(conversationId);
        if (!latestMsg) {
            await conversationRepo.markRead(conversationId);
            return;
        }

        const latestMsgId = latestMsg.id;

        await conversationRepo.updateReadCursor(
            conversationId,
            requester.userId,
            requester.type,
            latestMsgId
        );

        if (requester.type === 'agent') {
            await messageRepo.markAsReadUpTo(conversationId, latestMsgId, 'visitor');
            await conversationRepo.markRead(conversationId);
        } else {
            await messageRepo.markAsReadUpTo(conversationId, latestMsgId, 'agent');
        }

        try {
            emitToConversation(conversationId, 'messages:read', {
                conversationId,
                lastReadMessageId: latestMsgId,
                participantId: requester.userId,
                participantType: requester.type
            });

            if (requester.type === 'agent') {
                const conv = await conversationRepo.findById(conversationId);
                if (conv) {
                    emitToWorkspace((conv.workspaceId as any).toString(), 'conversation:updated', {
                        conversationId,
                        unreadCount: 0
                    });
                }
            }
        } catch { /* socket might be missing during testing */ }
    },

    async getMessagesSince(conversationId: string, since: string, excludeInternal: boolean = false) {
        return messageRepo.findSince(conversationId, new Date(since), 50, excludeInternal);
    },

    async getPublicMessagesSince(conversationId: string, since: string) {
        const messages = await messageRepo.findSince(conversationId, new Date(since), 50, true);
        return messages.map(serializePublicMessage);
    },

    /**
     * Return up-to-date receipts for a conversation so a reconnecting client can backfill.
     * Returns:
     * - readCursors: per-participant read positions
     * - statuses: map of messageId -> current status for recent messages
     */
    async getReceipts(conversationId: string, limit: number = 100) {
        const conv = await conversationRepo.findById(conversationId);
        if (!conv) throw new AppError('Cuộc hội thoại không tồn tại', 404, 'NOT_FOUND');

        const recentMessages = await messageRepo.getLatest(conversationId, limit);
        const statuses: Record<string, string> = {};
        for (const msg of recentMessages) {
            statuses[msg.id] = msg.status || 'sent';
        }

        return {
            readCursors: conv.readContext || [],
            statuses,
        };
    },

    async assignConversation(conversationId: string, agentId: string, agentName: string, expectUnassigned = false) {
        const conv = await conversationRepo.assignTo(conversationId, agentId, expectUnassigned);
        if (!conv && expectUnassigned) {
            // Collision: someone else already grabbed it
            throw new AppError(
                'Cuộc hội thoại đã được agent khác nhận trước. Vui lòng chọn cuộc hội thoại khác.',
                409,
                'ASSIGN_COLLISION'
            );
        }
        if (!conv) throw new AppError('Cuộc hội thoại không tồn tại', 404, 'NOT_FOUND');

        // Add system message
        await this.addMessage(
            conversationId,
            { type: 'system', id: 'system', name: 'System' },
            `${agentName} đã nhận cuộc hội thoại này`,
            'text'
        );

        // Notify workspace
        try {
            emitToWorkspace((conv.workspaceId as any).toString(), 'conversation:assigned', {
                conversationId,
                assignedTo: { id: agentId, name: agentName },
            });
        } catch { /* socket may not be initialized */ }

        return conv;
    },

    async unassignConversation(conversationId: string, agentName: string) {
        const conv = await conversationRepo.unassign(conversationId);
        if (!conv) throw new AppError('Cuộc hội thoại không tồn tại', 404, 'NOT_FOUND');

        await this.addMessage(
            conversationId,
            { type: 'system', id: 'system', name: 'System' },
            `${agentName} đã bỏ nhận cuộc hội thoại này`,
            'text'
        );

        try {
            emitToWorkspace((conv.workspaceId as any).toString(), 'conversation:assigned', {
                conversationId,
                assignedTo: null,
            });
        } catch { /* socket may not be initialized */ }

        return conv;
    },

    async transferConversation(
        conversationId: string,
        fromAgentName: string,
        toAgentId: string,
        toAgentName: string
    ) {
        const conv = await conversationRepo.assignTo(conversationId, toAgentId);
        if (!conv) throw new AppError('Cuộc hội thoại không tồn tại', 404, 'NOT_FOUND');

        // System message: "A đã chuyển cuộc hội thoại cho B"
        await this.addMessage(
            conversationId,
            { type: 'system', id: 'system', name: 'System' },
            `${fromAgentName} đã chuyển cuộc hội thoại cho ${toAgentName}`,
            'text'
        );

        // Notify workspace
        try {
            emitToWorkspace((conv.workspaceId as any).toString(), 'conversation:assigned', {
                conversationId,
                assignedTo: { id: toAgentId, name: toAgentName },
            });
        } catch { /* socket may not be initialized */ }

        return conv;
    },

    async closeConversation(conversationId: string, agentName?: string) {
        const conv = await conversationRepo.updateStatus(conversationId, 'closed');
        if (!conv) throw new AppError('Cuộc hội thoại không tồn tại', 404, 'NOT_FOUND');

        // System message
        const who = agentName || 'Hệ thống';
        await this.addMessage(
            conversationId,
            { type: 'system', id: 'system', name: 'System' },
            `${who} đã đóng cuộc hội thoại`,
            'text'
        );

        // Notify workspace + conversation room
        try {
            emitToConversation(conversationId, 'conversation:closed', { conversationId });
            emitToWorkspace((conv.workspaceId as any).toString(), 'conversation:closed', { conversationId });
        } catch { /* socket may not be initialized */ }

        return conv;
    },

    async reopenConversation(conversationId: string, agentName?: string) {
        const conv = await conversationRepo.updateStatus(conversationId, 'open');
        if (!conv) throw new AppError('Cuộc hội thoại không tồn tại', 404, 'NOT_FOUND');

        const who = agentName || 'Hệ thống';
        await this.addMessage(
            conversationId,
            { type: 'system', id: 'system', name: 'System' },
            `${who} đã mở lại cuộc hội thoại`,
            'text'
        );

        // Notify workspace + conversation room
        try {
            emitToConversation(conversationId, 'conversation:reopened', { conversationId });
            emitToWorkspace((conv.workspaceId as any).toString(), 'conversation:reopened', { conversationId });
        } catch { /* socket may not be initialized */ }

        return conv;
    },

    async setPendingConversation(conversationId: string, agentName?: string) {
        const conv = await conversationRepo.updateStatus(conversationId, 'pending');
        if (!conv) throw new AppError('Cuộc hội thoại không tồn tại', 404, 'NOT_FOUND');

        const who = agentName || 'Hệ thống';
        await this.addMessage(
            conversationId,
            { type: 'system', id: 'system', name: 'System' },
            `${who} đã chuyển cuộc hội thoại sang chờ xử lý`,
            'text'
        );

        try {
            emitToConversation(conversationId, 'conversation:statusChanged', { conversationId, status: 'pending' });
            emitToWorkspace((conv.workspaceId as any).toString(), 'conversation:statusChanged', { conversationId, status: 'pending' });
        } catch { /* socket may not be initialized */ }

        return conv;
    },

    // ── Priority / SLA ──

    async setPriority(conversationId: string, priority: string, slaDeadline?: Date, agentName?: string) {
        const conv = await conversationRepo.setPriority(conversationId, priority, slaDeadline);
        if (!conv) throw new AppError('Cuộc hội thoại không tồn tại', 404, 'NOT_FOUND');

        const priorityLabels: Record<string, string> = {
            urgent: '🔴 Khẩn cấp', high: '🟠 Cao', normal: '🟢 Bình thường', low: '⚪ Thấp'
        };
        const label = priorityLabels[priority] || priority;
        const who = agentName || 'Hệ thống';
        let msg = `${who} đã đặt mức ưu tiên: ${label}`;
        if (slaDeadline) {
            msg += ` — SLA: ${new Date(slaDeadline).toLocaleString('vi-VN')}`;
        }

        await this.addMessage(
            conversationId,
            { type: 'system', id: 'system', name: 'System' },
            msg,
            'text'
        );

        try {
            emitToWorkspace((conv.workspaceId as any).toString(), 'conversation:priorityChanged', {
                conversationId,
                priority,
                slaDeadline: slaDeadline || null,
            });
        } catch { /* socket may not be initialized */ }

        return conv;
    },

    /**
     * Check for conversations approaching SLA breach (within next 15 minutes).
     * Returns list of breaching conversations for notification.
     */
    async checkSLABreaching(withinMs = 15 * 60 * 1000) {
        const approaching = await conversationRepo.findBreachingSLA(withinMs);
        const breached = await conversationRepo.findBreachedSLA();

        // Emit warnings to respective workspaces
        for (const conv of approaching) {
            try {
                emitToWorkspace(conv.workspaceId, 'sla:warning', {
                    conversationId: conv.id,
                    slaDeadline: conv.slaDeadline,
                    priority: conv.priority,
                    type: 'approaching',
                });
            } catch { /* ignore */ }
        }
        for (const conv of breached) {
            try {
                emitToWorkspace(conv.workspaceId, 'sla:warning', {
                    conversationId: conv.id,
                    slaDeadline: conv.slaDeadline,
                    priority: conv.priority,
                    type: 'breached',
                });
            } catch { /* ignore */ }
        }

        return { approaching, breached };
    },

    /**
     * Requeue all conversations from a disconnected agent back to the queue.
     */
    async requeueByAgent(agentId: string, workspaceId?: string) {
        const count = await conversationRepo.requeueByAgent(agentId);
        if (count > 0 && workspaceId) {
            try {
                emitToWorkspace(workspaceId, 'conversation:requeued', {
                    agentId,
                    count,
                });
            } catch { /* ignore */ }
        }
        return count;
    },

    async setAutoReplyMode(
        conversationId: string,
        enabled: boolean,
        actor?: { id?: string; name?: string },
        workspaceId?: string,
    ) {
        const conversation = await conversationRepo.findById(conversationId);
        if (!conversation) throw new AppError('Cuộc hội thoại không tồn tại', 404, 'NOT_FOUND');
        if (workspaceId && getId(conversation.workspaceId) !== workspaceId) {
            throw new AppError('Cuộc hội thoại không tồn tại', 404, 'NOT_FOUND');
        }

        const now = new Date().toISOString();
        const metadata = jsonRecord(conversation.metadata);
        const nextMetadata = enabled
            ? {
                ...metadata,
                autoReplyEnabled: true,
                humanTakeover: false,
                aiPaused: false,
                botPaused: false,
                autoReplyDisabled: false,
                aiMode: 'auto',
                autoReplyResumedAt: now,
            }
            : {
                ...buildHumanTakeoverMetadata(metadata, {
                    id: actor?.id || 'manual-takeover',
                    name: actor?.name || 'Agent',
                }),
                autoReplyPausedAt: now,
            };

        if (!enabled) {
            stopAutoReplyTyping(conversationId);
            _autoReplyWorker.clear(conversationId);
        }
        const updated = await conversationRepo.updateMetadata(conversationId, nextMetadata);
        if (!enabled) {
            stopAutoReplyTyping(conversationId);
            _autoReplyWorker.clear(conversationId);
        }

        try {
            emitToWorkspace(getId(conversation.workspaceId), 'conversation:updated', {
                conversationId,
                metadata: nextMetadata,
            });
        } catch { /* socket may not be initialized */ }

        return updated;
    },

    async updateTracking(conversationId: string, visitorId: string, tracking: Record<string, any>) {
        const conv = await conversationRepo.findById(conversationId);
        if (!conv) throw new AppError('Cuộc hội thoại không tồn tại', 404, 'NOT_FOUND');
        if (conv.visitorId !== visitorId) throw new AppError('Không có quyền', 403, 'FORBIDDEN');
        if (!['widget', 'website'].includes(String(conv.channel || ''))) {
            throw new AppError('Kênh hội thoại không hỗ trợ truy cập công khai', 403, 'FORBIDDEN');
        }

        const merged = { ...((conv.metadata as any) || {}), ...tracking };
        return conversationRepo.updateMetadata(conversationId, merged);
    },

    async getDomainsByWorkspace(workspaceId: string) {
        return conversationRepo.getDistinctDomains(workspaceId);
    },

    async getByWorkspace(
        workspaceId: string, 
        options?: { 
            status?: string; 
            assignee?: string;
            tags?: string | string[];
            channel?: string;
            pageId?: string;
            dateFrom?: string;
            dateTo?: string;
            sortBy?: string;
            page?: number; 
            limit?: number;
            domain?: string | string[];
        },
        requester?: { userId: string; type: 'visitor' | 'agent' }
    ) {
        const [result, summaryCandidates] = await Promise.all([
            conversationRepo.findByWorkspace(workspaceId, options),
            requester ? conversationRepo.findSummaryCandidates(workspaceId, options) : Promise.resolve([]),
        ]);

        if (requester) {
            const unreadByConversationId = new Map<string, number>();
            for (let offset = 0; offset < summaryCandidates.length; offset += 25) {
                const batch = summaryCandidates.slice(offset, offset + 25);
                const counts = await Promise.all(batch.map(async conv => {
                    const readCtxArr = (conv.readContext as any[]) || [];
                    const readCtx = readCtxArr.find(
                        (ctx: any) => ctx.participantId === requester.userId && ctx.participantType === requester.type
                    );
                    try {
                        return await messageRepo.countUnreadSince(
                            conv.id,
                            requester.type,
                            readCtx ? readCtx.lastReadMessageId : null
                        );
                    } catch {
                        return 0;
                    }
                }));
                batch.forEach((conv, index) => unreadByConversationId.set(conv.id, counts[index] || 0));
            }

            const items = result.items.map(conv => ({
                ...conv,
                unreadCount: unreadByConversationId.get(conv.id) || 0,
            }));

            // If we are sorting by unread, we should at least sort the current page by the dynamic count
            if (options?.sortBy === 'unread') {
                items.sort((a: any, b: any) => {
                    if (b.unreadCount !== a.unreadCount) return b.unreadCount - a.unreadCount;
                    return new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime();
                });
            }

            return {
                items,
                total: result.total,
                summary: summarizeInboxCandidates(summaryCandidates, unreadByConversationId),
            };
        }

        return result;
    },

    async getOne(conversationId: string, requester?: { userId: string; type: 'visitor' | 'agent' }) {
        const conv = await conversationRepo.findById(conversationId);
        if (!conv) throw new AppError('Cuộc hội thoại không tồn tại', 404, 'NOT_FOUND');
        
        let convObj: any = { ...conv };
        
        if (requester) {
            const readCtxArr = (conv.readContext as any[]) || [];
            const readCtx = readCtxArr.find(
                (ctx: any) => ctx.participantId === requester.userId && ctx.participantType === requester.type
            );
            const unreadCount = await messageRepo.countUnreadSince(
                conv.id,
                requester.type,
                readCtx ? readCtx.lastReadMessageId : null
            );
            convObj = { ...convObj, unreadCount };
        }
        
        return convObj;
    },

    async getTotalUnreadCount(workspaceId: string, requester: { userId: string; type: 'visitor' | 'agent' }) {
        const convs = await conversationRepo.findOpenByWorkspace(workspaceId);
        
        let totalUnread = 0;
        let zaloUnread = 0;
        
        await Promise.all(
            convs.map(async (conv: any) => {
                const readCtxArr = (conv.readContext as any[]) || [];
                const readCtx = readCtxArr.find(
                    (ctx: any) => ctx.participantId === requester.userId && ctx.participantType === requester.type
                );
                const count = await messageRepo.countUnreadSince(
                    getId(conv),
                    requester.type,
                    readCtx ? readCtx.lastReadMessageId : null
                );
                
                totalUnread += count;
                // Determine if this is a Zalo conversation
                const metadata = (conv.metadata as any) || {};
                const isZalo = conv.channel === 'zalo' || metadata.channel === 'zalo';
                if (isZalo) {
                    zaloUnread += count;
                }
            })
        );
        
        return { 
            totalUnread, 
            zaloUnread, 
            inboxUnread: Math.max(0, totalUnread - zaloUnread) 
        };
    },

    // ── Visitor profile methods ──

    async getVisitors(workspaceId: string, options?: { page?: number; limit?: number; search?: string }) {
        return visitorRepo.findByWorkspace(workspaceId, options);
    },

    async getVisitor(visitorId: string, widgetId: string) {
        const visitor = await visitorRepo.findOne(visitorId, widgetId);
        if (!visitor) throw new AppError('Visitor không tồn tại', 404, 'NOT_FOUND');
        return visitor;
    },

    async enrichVisitor(
        visitorId: string,
        widgetId: string,
        data: { name?: string; email?: string; phone?: string; attributes?: Record<string, any> }
    ) {
        const visitor = await visitorRepo.enrichProfile(visitorId, widgetId, data);
        if (!visitor) throw new AppError('Visitor không tồn tại', 404, 'NOT_FOUND');
        return visitor;
    },

    async getVisitorByWorkspace(workspaceId: string, visitorId: string) {
        const visitor = await visitorRepo.findOneByWorkspaceAndVisitorId(workspaceId, visitorId);
        if (!visitor) throw new AppError('Visitor không tồn tại', 404, 'NOT_FOUND');
        return visitor;
    },

    async updateVisitorByWorkspace(
        workspaceId: string,
        visitorId: string,
        data: { name?: string; email?: string; phone?: string; attributes?: Record<string, any> }
    ) {
        const visitor = await visitorRepo.updateByWorkspaceAndVisitorId(workspaceId, visitorId, data);
        if (!visitor) throw new AppError('Visitor không tồn tại', 404, 'NOT_FOUND');
        return visitor;
    },

    // ── Tags on conversation ──

    async addTagToConversation(conversationId: string, tag: string, agentName?: string) {
        const conv = await conversationRepo.addTag(conversationId, tag);
        if (!conv) throw new AppError('Cuộc hội thoại không tồn tại', 404, 'NOT_FOUND');

        const who = agentName || 'Hệ thống';
        await this.addMessage(
            conversationId,
            { type: 'system', id: 'system', name: 'System' },
            `${who} đã gắn tag: ${tag}`,
            'text'
        );

        try {
            emitToWorkspace((conv.workspaceId as any).toString(), 'conversation:tagsChanged', {
                conversationId,
                tags: conv.tags,
            });
        } catch { /* ignore */ }

        return conv;
    },

    async removeTagFromConversation(conversationId: string, tag: string, agentName?: string) {
        const conv = await conversationRepo.removeTag(conversationId, tag);
        if (!conv) throw new AppError('Cuộc hội thoại không tồn tại', 404, 'NOT_FOUND');

        const who = agentName || 'Hệ thống';
        await this.addMessage(
            conversationId,
            { type: 'system', id: 'system', name: 'System' },
            `${who} đã gỡ tag: ${tag}`,
            'text'
        );

        try {
            emitToWorkspace((conv.workspaceId as any).toString(), 'conversation:tagsChanged', {
                conversationId,
                tags: conv.tags,
            });
        } catch { /* ignore */ }

        return conv;
    },

    // ── Internal notes ──

    async addInternalNote(
        conversationId: string,
        sender: { id: string; name?: string },
        content: string,
        mentionedUserIds?: string[]
    ) {
        const conversation = await conversationRepo.findById(conversationId);
        if (!conversation) throw new AppError('Cuộc hội thoại không tồn tại', 404, 'NOT_FOUND');

        const note = await messageRepo.create({
            conversationId: getId(conversation),
            senderType: 'agent',
            senderId: sender.id,
            senderName: sender.name,
            content,
            type: 'text',
            isInternal: true,
        });

        // Only emit to agent namespace (not visitor)
        try {
            emitToWorkspace(getId(conversation.workspaceId), 'note:new', {
                conversationId,
                note,
            });

            if (mentionedUserIds && mentionedUserIds.length > 0) {
                const ids = mentionedUserIds.map(id => id.toString());
                ids.forEach(userId => {
                    if (userId !== sender.id) { // don't notify self
                        emitToUser(userId, 'notification:mention', {
                            conversationId,
                            message: `${sender.name || 'Một đồng nghiệp'} đã nhắc đến bạn trong một ghi chú.`,
                            noteId: note.id,
                            createdAt: new Date().toISOString()
                        });
                    }
                });
            }
        } catch { /* ignore */ }

        return note;
    },

    async forwardMessages(
        workspaceId: string,
        sender: { id: string; name?: string },
        messageIds: string[],
        targetConversationIds: string[],
    ) {
        const [messages, targets] = await Promise.all([
            prisma.message.findMany({
                where: { id: { in: messageIds }, conversation: { workspaceId } },
                orderBy: { createdAt: 'asc' },
            }),
            prisma.conversation.findMany({
                where: { id: { in: targetConversationIds }, workspaceId },
                select: { id: true },
            }),
        ]);
        if (messages.length !== new Set(messageIds).size) {
            throw new AppError('Một hoặc nhiều tin nhắn không tồn tại', 404, 'MESSAGE_NOT_FOUND');
        }
        if (targets.length !== new Set(targetConversationIds).size) {
            throw new AppError('Một hoặc nhiều hội thoại đích không tồn tại', 404, 'CONVERSATION_NOT_FOUND');
        }

        const created = [];
        for (const target of targets) {
            for (const source of messages) {
                const forwarded = await this.addMessage(
                    target.id,
                    { type: 'agent', id: sender.id, name: sender.name || 'Agent' },
                    source.content,
                    (['text', 'image', 'file', 'system'].includes(source.type) ? source.type : 'text') as 'text' | 'image' | 'file' | 'system',
                    Array.isArray(source.attachments) ? source.attachments as Array<{ data: string; url?: string; filename: string; mimeType: string; size: number }> : [],
                    undefined,
                    source.replyToMessageId ? {
                        messageId: source.replyToMessageId,
                        content: source.replyToContent || '',
                        senderName: source.replyToSenderName || '',
                    } : undefined,
                );
                created.push(forwarded);
            }
        }
        return { forwardedCount: created.length, messages: created };
    },

    /**
     * Reset toàn bộ tin nhắn của workspace.
     * - Xóa hết Message docs thuộc các conversations của workspace này.
     * - Xóa hết ZaloMessage docs của workspace.
     * - Reset lastMessage, unreadCount trên Conversation docs.
     * - GIỮ NGUYÊN: Visitor profiles, Conversation metadata (visitorId, assignedTo, tags...).
     */
    async resetWorkspaceMessages(
        workspaceId: string,
        options: { deleteConversations?: boolean } = {},
    ): Promise<{
        deletedMessages: number;
        deletedZaloMessages: number;
        resetConversations: number;
        deletedConversations: number;
    }> {
        return prisma.$transaction(async transaction => {
            const conversations = await transaction.conversation.findMany({
                where: { workspaceId },
                select: { id: true },
            });
            const conversationIds = conversations.map(conversation => conversation.id);

            const messageResult = await transaction.message.deleteMany({
                where: { conversationId: { in: conversationIds } },
            });
            const zaloMessageResult = await transaction.zaloMessage.deleteMany({
                where: { workspaceId },
            });

            if (options.deleteConversations) {
                // Giữ đơn hàng và lịch sử audit, nhưng không để đơn hàng trỏ
                // tới một cuộc hội thoại đã bị xóa.
                await transaction.order.updateMany({
                    where: { workspaceId, conversationId: { in: conversationIds } },
                    data: { conversationId: null },
                });
                const conversationResult = await transaction.conversation.deleteMany({
                    where: { workspaceId },
                });
                await transaction.zaloContact.updateMany({
                    where: { workspaceId },
                    data: { totalMessages: 0, lastMessageAt: null, lastMessagePreview: '' },
                });

                return {
                    deletedMessages: messageResult.count || 0,
                    deletedZaloMessages: zaloMessageResult.count || 0,
                    resetConversations: 0,
                    deletedConversations: conversationResult.count || 0,
                };
            }

            const conversationResult = await transaction.conversation.updateMany({
                where: { workspaceId },
                data: {
                    lastMessageSnippet: null,
                    lastSenderType: null,
                    lastSenderName: null,
                    unreadCount: 0,
                },
            });

            return {
                deletedMessages: messageResult.count || 0,
                deletedZaloMessages: zaloMessageResult.count || 0,
                resetConversations: conversationResult.count || 0,
                deletedConversations: 0,
            };
        });
    },

    /**
     * Search conversations by message content.
     */
    async searchByMessageContent(
        workspaceId: string,
        query: string,
        options?: { status?: string; limit?: number }
    ) {
        return conversationRepo.searchByMessageContent(workspaceId, query, options);
    },

    /**
     * Auto-sync Lead from incoming messages.
     * Creates a new Lead if none exists, or updates lastContactedAt + extracted info.
     * Runs asynchronously (fire-and-forget) to not block message processing.
     */
    async autoSyncLeadFromZalo(
        workspaceId: string,
        userId: string,
        userName: string,
        avatar: string,
        messageContent: string,
        source: 'zalo' | 'facebook' = 'zalo'
    ) {
        try {
            // ── Debounce: skip if synced recently for this user ──
            const lastSync = _leadSyncTimestamps.get(userId);
            if (lastSync && Date.now() - lastSync < LEAD_SYNC_DEBOUNCE_MS) {
                return; // Already synced within debounce window
            }
            _leadSyncTimestamps.set(userId, Date.now());

            // Determine lookup field
            const lookupField = source === 'facebook' ? 'fbUserId' : 'zaloUserId';
            const lookupValue = userId;

            // Check if lead already exists
            const existing = await prisma.lead.findFirst({
                where: { workspaceId, [lookupField]: lookupValue },
            });

            // Extract email/phone from message content (simple regex)
            let extractedEmail = '';
            let extractedPhone = '';
            if (messageContent && messageContent.length > 3) {
                const emailMatch = messageContent.match(/[\w.+-]+@[\w-]+\.[\w.]+/);
                if (emailMatch) extractedEmail = emailMatch[0];
                const phoneMatch = messageContent.match(/(?:^|\s)(0\d{9,10}|(?:\+84)\d{9,10})(?:\s|$)/);
                if (phoneMatch) extractedPhone = phoneMatch[1];
            }

            if (existing) {
                // Update existing lead: lastContactedAt + increment conversationCount + fill missing info
                const updates: any = { lastContactedAt: new Date() };

                // Fill missing info from message content
                if (extractedEmail && !existing.email) updates.email = extractedEmail;
                if (extractedPhone && !existing.phone) updates.phone = extractedPhone;
                if (avatar && !existing.avatar) updates.avatar = avatar;
                if (userName && existing.name !== userName && userName.length > 2) {
                    // Don't overwrite with generic names like "Thành viên xxx"
                    if (!userName.startsWith('Thành viên') && !userName.startsWith('FB User')) {
                        updates.name = userName;
                    }
                }

                await prisma.lead.update({
                    where: { id: existing.id },
                    data: updates,
                });
            } else {
                // Create new lead
                await prisma.lead.create({
                    data: {
                        workspaceId,
                        name: userName || `${source === 'facebook' ? 'FB' : 'Zalo'} User ${userId.slice(-6)}`,
                        phone: extractedPhone,
                        email: extractedEmail,
                        avatar: avatar || '',
                        stage: 'mới',
                        source,
                        [lookupField]: userId,
                        lastContactedAt: new Date(),
                        conversationCount: 1,
                    },
                });
                console.log(`[ConvService] Auto-created Lead for ${source} user ${userId} (${userName})`);
            }
        } catch (err) {
            // Non-critical: log and move on
            console.error(`[ConvService] autoSyncLead error for ${source}/${userId}:`, err);
        }
    },
};
