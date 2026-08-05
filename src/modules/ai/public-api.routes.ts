import { NextFunction, Request, Response, Router } from 'express';
import asyncHandler from 'express-async-handler';
import { requireAuth } from '../../middlewares/auth.middleware';
import { scopeCheck } from '../../middlewares/scopeCheck';
import { requirePermission } from '../../middlewares/permission.middleware';
import { PERMISSIONS } from '../../config/permissions';
import { AppError } from '../../middlewares/errorHandler';
import { aiService } from './ai.service';
import { publicAIService } from './public-api.service';

const router = Router();
const publicRouter = Router();
const routeParam = (value: string | string[]) => Array.isArray(value) ? value[0] : value;

const apiRateWindows = new Map<string, number[]>();
const activeRequests = new Map<string, number>();

const requirePublicKey = async (req: Request, _res: Response, next: NextFunction) => {
    try {
        const header = req.header('authorization') || '';
        const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
        const key = await publicAIService.authenticate(token);
        const now = Date.now();
        const recent = (apiRateWindows.get(key.id) || []).filter((at) => now - at < 60_000);
        if (recent.length >= key.project.rateLimitPerMinute) {
            throw new AppError('Rate limit reached. Retry in one minute.', 429, 'AI_API_RATE_LIMITED');
        }
        const current = activeRequests.get(key.projectId) || 0;
        if (current >= key.project.concurrencyLimit) {
            throw new AppError('Project concurrency limit reached. Retry shortly.', 429, 'AI_API_BUSY');
        }
        recent.push(now);
        apiRateWindows.set(key.id, recent);
        activeRequests.set(key.projectId, current + 1);
        (req as any).publicApiKey = key;
        resOnFinish(_res, () => activeRequests.set(key.projectId, Math.max(0, (activeRequests.get(key.projectId) || 1) - 1)));
        next();
    } catch (error) { next(error); }
};

const resOnFinish = (res: Response, done: () => void) => {
    let finished = false;
    res.once('finish', () => { if (!finished) { finished = true; done(); } });
    res.once('close', () => { if (!finished) { finished = true; done(); } });
};

// Authenticated workspace management. The secret is returned exactly once from POST /keys.
router.get('/:workspaceId/projects', requireAuth, scopeCheck, requirePermission(PERMISSIONS.WORKSPACE_UPDATE), asyncHandler(async (req, res) => {
    res.json({ success: true, data: await publicAIService.listProjects(routeParam(req.params.workspaceId)) });
}));

router.post('/:workspaceId/projects', requireAuth, scopeCheck, requirePermission(PERMISSIONS.WORKSPACE_UPDATE), asyncHandler(async (req: any, res) => {
    const project = await publicAIService.createProject(routeParam(req.params.workspaceId), req.user.id, req.body || {});
    res.status(201).json({ success: true, data: project });
}));

router.post('/:workspaceId/projects/:projectId/keys', requireAuth, scopeCheck, requirePermission(PERMISSIONS.WORKSPACE_UPDATE), asyncHandler(async (req, res) => {
    const result = await publicAIService.issueKey(routeParam(req.params.workspaceId), routeParam(req.params.projectId), req.body || {});
    res.status(201).json({ success: true, data: result, warning: 'Sao chép secret ngay. Nó sẽ không được hiển thị lại.' });
}));

router.delete('/:workspaceId/projects/:projectId/keys/:keyId', requireAuth, scopeCheck, requirePermission(PERMISSIONS.WORKSPACE_UPDATE), asyncHandler(async (req, res) => {
    await publicAIService.revokeKey(routeParam(req.params.workspaceId), routeParam(req.params.projectId), routeParam(req.params.keyId));
    res.json({ success: true });
}));

router.get('/:workspaceId/projects/:projectId/usage', requireAuth, scopeCheck, requirePermission(PERMISSIONS.WORKSPACE_UPDATE), asyncHandler(async (req, res) => {
    res.json({ success: true, data: await publicAIService.usage(routeParam(req.params.workspaceId), routeParam(req.params.projectId)) });
}));

// External, OpenAI-compatible endpoint. It accepts only a generated workspace key,
// never the internal AI gateway token and never grants system or data access.
publicRouter.post('/chat/completions', requirePublicKey, asyncHandler(async (req: Request, res: Response) => {
    const key = (req as any).publicApiKey;
    const body = req.body || {};
    if (!Array.isArray(body.messages) || body.messages.length === 0 || body.messages.length > 40) {
        throw new AppError('messages must contain 1 to 40 items', 400, 'AI_INVALID_REQUEST');
    }
    const inputChars = JSON.stringify(body.messages).length;
    if (inputChars > 60_000) throw new AppError('Request context is too large', 413, 'AI_CONTEXT_TOO_LARGE');
    const allowedModels = Array.isArray(key.project.allowedModels) ? key.project.allowedModels : [];
    if (body.model && !allowedModels.includes(body.model)) {
        throw new AppError('Requested model is not enabled for this API project', 403, 'AI_MODEL_FORBIDDEN');
    }
    await publicAIService.reserveRequest(key, inputChars);
    const completion = await aiService.complete({
        model: body.model || allowedModels[0] || 'qwen2.5:14b',
        messages: body.messages,
        temperature: body.temperature,
        top_p: body.top_p,
        max_tokens: Math.min(Math.max(Number(body.max_tokens) || 500, 1), 1200),
    }, 60_000);
    const content = completion.choices.map((choice) => choice.message?.content || '').join('');
    await publicAIService.recordOutput(key.projectId, content.length);
    res.setHeader('X-Nemark-AI-Project', key.projectId);
    res.json({ ...completion, provider: undefined });
}));

publicRouter.get('/models', requirePublicKey, asyncHandler(async (req: Request, res: Response) => {
    const key = (req as any).publicApiKey;
    const allowedModels = Array.isArray(key.project.allowedModels) ? key.project.allowedModels : [];
    res.json({ object: 'list', data: allowedModels.map((id: string) => ({ id, object: 'model', owned_by: 'nemark' })) });
}));

export { publicRouter as publicAIRoutes };
export default router;
