import { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import { aiService } from './ai.service';
import type { AICompletionResponse } from './ai.types';

const withoutProvider = (completion: AICompletionResponse) => {
    const response = { ...completion } as Partial<AICompletionResponse>;
    delete response.provider;
    return response;
};

export const aiController = {
    info: asyncHandler(async (_req: Request, res: Response) => {
        const status = await aiService.status();
        res.json({
            object: 'nemark.ai.gateway',
            version: 'v1',
            status: status.status,
            compatibility: 'openai-chat-completions',
        });
    }),

    health: asyncHandler(async (_req: Request, res: Response) => {
        const status = await aiService.status();
        res.status(status.status === 'offline' ? 503 : 200).json({
            status: status.status,
            service: 'nemark-ai-gateway',
            latencyMs: status.latencyMs,
            modelAvailable: status.modelAvailable,
        });
    }),

    models: asyncHandler(async (_req: Request, res: Response) => {
        const models = await aiService.listModels();
        res.json({ object: 'list', data: models });
    }),

    chatCompletions: asyncHandler(async (req: Request, res: Response) => {
        const completion = await aiService.complete(req.body || {});
        res.setHeader('X-Nemark-AI-Provider', completion.provider);
        res.json(withoutProvider(completion));
    }),
};
