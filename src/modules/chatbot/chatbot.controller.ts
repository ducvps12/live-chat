import { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import { chatbotService } from './chatbot.service';
import { aiClient } from '../../lib/ai/aiClient';

export const chatbotController = {
    list: asyncHandler(async (req: Request, res: Response) => {
        const workspaceId = req.params.workspaceId as string;
        const bots = await chatbotService.list(workspaceId);
        res.json({ success: true, data: bots });
    }),

    getOne: asyncHandler(async (req: Request, res: Response) => {
        const botId = req.params.botId as string;
        const bot = await chatbotService.getOne(botId);
        res.json({ success: true, data: bot });
    }),

    create: asyncHandler(async (req: Request, res: Response) => {
        const workspaceId = req.params.workspaceId as string;
        const bot = await chatbotService.create(workspaceId, req.body);
        res.status(201).json({ success: true, data: bot });
    }),

    update: asyncHandler(async (req: Request, res: Response) => {
        const botId = req.params.botId as string;
        const bot = await chatbotService.update(botId, req.body);
        res.json({ success: true, data: bot });
    }),

    remove: asyncHandler(async (req: Request, res: Response) => {
        const botId = req.params.botId as string;
        await chatbotService.remove(botId);
        res.json({ success: true, message: 'Bot đã được xóa' });
    }),

    toggleActive: asyncHandler(async (req: Request, res: Response) => {
        const botId = req.params.botId as string;
        const { isActive } = req.body;
        const bot = await chatbotService.toggleActive(botId, isActive);
        res.json({ success: true, data: bot });
    }),

    getStats: asyncHandler(async (req: Request, res: Response) => {
        const workspaceId = req.params.workspaceId as string;
        const stats = await chatbotService.getStats(workspaceId);
        res.json({ success: true, data: stats });
    }),

    // Public endpoint: bot processes a message (called from widget/socket)
    processMessage: asyncHandler(async (req: Request, res: Response) => {
        const workspaceId = req.params.workspaceId as string;
        const { message, channel } = req.body;
        const result = await chatbotService.processIncomingMessage(workspaceId, message, channel);
        res.json({ success: true, data: result });
    }),

    // List available AI models from the custom API
    listModels: asyncHandler(async (_req: Request, res: Response) => {
        const result = await aiClient.listModels();
        if (result.status === 'online' && result.models.length > 0) {
            res.json({ success: true, data: result.models });
            return;
        }
        // Fallback: surface the configured default model so the UI is never empty
        res.json({
            success: true,
            data: [{ id: aiClient.defaultModel, name: aiClient.defaultModel, owned_by: 'fallback' }],
        });
    }),
};
