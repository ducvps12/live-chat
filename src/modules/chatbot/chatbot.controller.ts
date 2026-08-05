import { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import { chatbotService } from './chatbot.service';
import { aiService } from '../ai/ai.service';

export const chatbotController = {
    listTemplates: asyncHandler(async (_req: Request, res: Response) => {
        res.json({ success: true, data: chatbotService.listTemplates() });
    }),

    applyTemplate: asyncHandler(async (req: Request, res: Response) => {
        const workspaceId = req.params.workspaceId as string;
        const templateKey = req.params.templateKey as string;
        const bot = await chatbotService.applyTemplate(workspaceId, templateKey, req.body || {});
        res.status(201).json({ success: true, data: bot });
    }),

    previewShopeeAffiliate: asyncHandler(async (req: Request, res: Response) => {
        res.json({ success: true, data: chatbotService.previewShopeeAffiliate(req.body || {}) });
    }),

    list: asyncHandler(async (req: Request, res: Response) => {
        const workspaceId = req.params.workspaceId as string;
        const bots = await chatbotService.list(workspaceId);
        res.json({ success: true, data: bots });
    }),

    getOne: asyncHandler(async (req: Request, res: Response) => {
        const workspaceId = req.params.workspaceId as string;
        const botId = req.params.botId as string;
        const bot = await chatbotService.getOne(workspaceId, botId);
        res.json({ success: true, data: bot });
    }),

    create: asyncHandler(async (req: Request, res: Response) => {
        const workspaceId = req.params.workspaceId as string;
        const bot = await chatbotService.create(workspaceId, req.body);
        res.status(201).json({ success: true, data: bot });
    }),

    update: asyncHandler(async (req: Request, res: Response) => {
        const workspaceId = req.params.workspaceId as string;
        const botId = req.params.botId as string;
        const bot = await chatbotService.update(workspaceId, botId, req.body);
        res.json({ success: true, data: bot });
    }),

    remove: asyncHandler(async (req: Request, res: Response) => {
        const workspaceId = req.params.workspaceId as string;
        const botId = req.params.botId as string;
        await chatbotService.remove(workspaceId, botId);
        res.json({ success: true, message: 'Bot đã được xóa' });
    }),

    toggleActive: asyncHandler(async (req: Request, res: Response) => {
        const workspaceId = req.params.workspaceId as string;
        const botId = req.params.botId as string;
        const { isActive } = req.body;
        const bot = await chatbotService.toggleActive(workspaceId, botId, isActive);
        res.json({ success: true, data: bot });
    }),

    getStats: asyncHandler(async (req: Request, res: Response) => {
        const workspaceId = req.params.workspaceId as string;
        const stats = await chatbotService.getStats(workspaceId);
        res.json({ success: true, data: stats });
    }),

    previewReply: asyncHandler(async (req: Request, res: Response) => {
        const workspaceId = req.params.workspaceId as string;
        const { message, channel, botId, context } = req.body || {};
        const cleanMessage = typeof message === 'string' ? message.trim() : '';
        const cleanContext = typeof context === 'string' ? context.trim().slice(0, 4000) : '';
        const cleanChannel = typeof channel === 'string' ? channel.toLowerCase().trim() : 'website';
        const allowedChannels = new Set(['website', 'web', 'facebook', 'messenger', 'zalo', 'instagram']);

        if (!cleanMessage || cleanMessage.length > 4000) {
            res.status(400).json({ success: false, error: 'Tin nhắn phải có từ 1 đến 4000 ký tự' });
            return;
        }
        if (!allowedChannels.has(cleanChannel)) {
            res.status(400).json({ success: false, error: 'Kênh hội thoại không hợp lệ' });
            return;
        }

        const history = cleanContext
            ? [{ role: 'user', content: cleanContext }]
            : undefined;
        const result = await chatbotService.processIncomingMessage(
            workspaceId,
            cleanMessage,
            cleanChannel,
            history,
            undefined,
            {
                preview: true,
                botId: typeof botId === 'string' && botId.trim() ? botId.trim() : undefined,
            },
        );

        res.json({ success: true, data: result });
    }),

    // Public endpoint: bot processes a message (called from widget/socket)
    processMessage: asyncHandler(async (req: Request, res: Response) => {
        const workspaceId = req.params.workspaceId as string;
        const { message, channel } = req.body;
        const cleanMessage = typeof message === 'string' ? message.trim() : '';
        const allowedChannels = new Set(['website', 'web', 'facebook', 'messenger', 'zalo', 'email', 'instagram']);
        const cleanChannel = typeof channel === 'string' ? channel.toLowerCase().trim() : 'website';

        if (!cleanMessage || cleanMessage.length > 4000) {
            res.status(400).json({ success: false, error: 'Tin nhắn phải có từ 1 đến 4000 ký tự' });
            return;
        }
        if (!allowedChannels.has(cleanChannel)) {
            res.status(400).json({ success: false, error: 'Kênh hội thoại không hợp lệ' });
            return;
        }

        const result = await chatbotService.processIncomingMessage(workspaceId, cleanMessage, cleanChannel);
        res.json({ success: true, data: result });
    }),

    // List available AI models from the custom API
    listModels: asyncHandler(async (_req: Request, res: Response) => {
        try {
            const models = (await aiService.listModels() as Array<{ id: string; owned_by: string }>).map((model) => ({
                ...model,
                name: model.id,
            }));
            res.json({ success: true, data: models });
        } catch (error: unknown) {
            const err = error as { response?: { status?: number }; message?: string };
            console.error('[AI] Failed to list models:', err.response?.status, err.message);
            res.json({ success: true, data: [] });
        }
    }),
};
