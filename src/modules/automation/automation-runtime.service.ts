import type { Conversation, Message } from '@prisma/client';
import prisma from '../../infra/prisma';
import { emitToConversation } from '../../infra/socket';
import { chatbotRepo } from '../chatbot/repos/chatbot.repo';
import { chatbotService } from '../chatbot/chatbot.service';
import { buildAutoReplyHistory } from '../chatbot/auto-reply.helpers';
import { messageRepo } from '../conversation/repos/message.repo';
import { subscriptionService } from '../subscription/subscription.service';

type RunStatus = 'completed' | 'needs_review' | 'skipped' | 'failed';

function runtimeChannel(channel: string): 'website' | 'messenger' | 'zalo' | 'instagram' {
    const value = String(channel || 'website').toLowerCase();
    if (value === 'facebook' || value === 'messenger') return 'messenger';
    if (value === 'zalo') return 'zalo';
    if (value === 'instagram') return 'instagram';
    return 'website';
}

function workflowTag(name: string): string {
    const compact = String(name || 'workflow')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 36) || 'workflow';
    return `auto:${compact}`;
}

async function beginRun(workflow: { id: string; workspaceId: string; actionType: string }, message: Message) {
    try {
        return await prisma.automationRun.create({
            data: {
                workflowId: workflow.id,
                workspaceId: workflow.workspaceId,
                eventId: message.id,
                conversationId: message.conversationId,
                actionType: workflow.actionType,
                status: 'queued',
                output: {},
            },
        });
    } catch (error: any) {
        if (error?.code === 'P2002') return null;
        throw error;
    }
}

async function finishRun(id: string, status: RunStatus, summary: string, output: Record<string, unknown> = {}) {
    await prisma.automationRun.update({
        where: { id },
        data: { status, summary: summary.slice(0, 500), output: output as any },
    });
}

async function createDraft(
    workflow: { id: string; workspaceId: string; name: string },
    conversation: Conversation,
    message: Message,
) {
    const channel = runtimeChannel(conversation.channel);
    const activeBot = (await chatbotRepo.findActive(workflow.workspaceId, channel))[0];
    if (!activeBot) return { ok: false, reason: 'No active bot is configured for this channel.' };

    const quota = await subscriptionService.getAIReplyQuota(workflow.workspaceId);
    if (!quota.allowed) return { ok: false, reason: 'AI reply quota is exhausted.' };

    const recent = await messageRepo.getLatest(conversation.id, 36, { excludeInternal: true });
    const history = buildAutoReplyHistory(recent, message.id, 12);
    const response = await chatbotService.processIncomingMessage(
        workflow.workspaceId,
        message.content,
        channel,
        history,
        undefined,
        { preview: true, botId: activeBot.id },
    );
    if (!response) return { ok: false, reason: 'The configured bot could not produce a draft.' };

    // Preview mode deliberately skips quota accounting. Charge only a true model
    // generation; scenario/knowledge replies do not consume an LLM turn.
    if (response.source === 'ai') {
        const consumed = await subscriptionService.consumeAIReplyQuota(workflow.workspaceId);
        if (!consumed.allowed) return { ok: false, reason: 'AI reply quota became unavailable.' };
    }

    const note = await messageRepo.create({
        conversationId: conversation.id,
        clientMessageId: `automation-draft:${workflow.id}:${message.id}`,
        senderType: 'system',
        senderId: `automation_${workflow.id}`,
        senderName: 'AI Workflow',
        content: `AI draft - review required\n\n${response.response}`,
        type: 'system',
        isInternal: true,
    });
    emitToConversation(conversation.id, 'message:new', note);
    return { ok: true, source: response.source, noteId: note.id };
}

/**
 * Executes only the bounded automation actions allowed by policy. This runs
 * after an inbound message is durable and never delivers outbound messages.
 */
export async function runMessageWorkflows(conversation: Conversation, message: Message): Promise<void> {
    const workflows = await prisma.automationWorkflow.findMany({
        where: {
            workspaceId: conversation.workspaceId,
            isActive: true,
            triggerType: 'message_received',
        },
        orderBy: { createdAt: 'asc' },
    });

    for (const workflow of workflows) {
        let run: { id: string } | null = null;
        try {
            run = await beginRun(workflow, message);
            if (!run) continue;

            if (workflow.actionType === 'draft_reply') {
                const draft = await createDraft(workflow, conversation, message);
                await finishRun(
                    run.id,
                    draft.ok ? 'needs_review' : 'skipped',
                    draft.ok ? 'AI draft created for human review.' : (draft.reason || 'Draft was not created.'),
                    draft.ok ? { noteId: draft.noteId, source: draft.source } : {},
                );
                continue;
            }

            if (workflow.actionType === 'tag_conversation' && workflow.approvalMode === 'automatic_safe') {
                const current = Array.isArray(conversation.tags) ? conversation.tags.map(String) : [];
                const tag = workflowTag(workflow.name);
                const tags = current.includes(tag) ? current : [...current, tag];
                await prisma.conversation.update({ where: { id: conversation.id }, data: { tags } });
                await finishRun(run.id, 'completed', `Applied safe tag: ${tag}.`, { tag });
                continue;
            }

            // Leads and Telegram alerts deliberately stay in the review queue
            // until the workspace provides a confirmed mapping/destination.
            await finishRun(run.id, 'needs_review', 'This action is queued for human approval.', { actionType: workflow.actionType });
        } catch (error: any) {
            if (run) {
                await finishRun(run.id, 'failed', 'Workflow execution failed.', { code: error?.code || 'UNKNOWN' }).catch(() => undefined);
            }
            console.warn('[Automation] Workflow execution skipped', error?.message || error);
        }
    }
}
