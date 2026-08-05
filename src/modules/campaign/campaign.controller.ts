import { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import { campaignService } from './campaign.service';
import { AppError } from '../../middlewares/errorHandler';

const escapePageText = (value: string) => value.replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character] || character));

const renderUnsubscribePage = (title: string, body: string, success: boolean) => `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} | NemarkChat</title><style>
body{margin:0;background:#f8fafc;color:#0f172a;font-family:Inter,system-ui,sans-serif;display:grid;min-height:100vh;place-items:center;padding:24px;box-sizing:border-box}
main{width:min(460px,100%);background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:32px;box-shadow:0 18px 50px rgba(15,23,42,.08);text-align:center}
.icon{width:52px;height:52px;margin:0 auto 18px;border-radius:50%;display:grid;place-items:center;background:${success ? '#ecfdf5' : '#fff7ed'};color:${success ? '#047857' : '#c2410c'};font-size:24px;font-weight:700}
h1{font-size:23px;margin:0 0 10px}p{color:#64748b;line-height:1.65;margin:0}.brand{margin-top:24px;font-size:12px;color:#94a3b8}
</style></head><body><main><div class="icon">${success ? '✓' : '!'}</div><h1>${title}</h1><p>${body}</p><div class="brand">NemarkChat</div></main></body></html>`;

const renderUnsubscribeConfirm = (maskedEmail: string, token: string) => `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Xác nhận hủy đăng ký | NemarkChat</title><style>
body{margin:0;background:#f8fafc;color:#0f172a;font-family:Inter,system-ui,sans-serif;display:grid;min-height:100vh;place-items:center;padding:24px;box-sizing:border-box}
main{width:min(460px,100%);background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:32px;box-shadow:0 18px 50px rgba(15,23,42,.08);text-align:center}
h1{font-size:23px;margin:0 0 10px}p{color:#64748b;line-height:1.65;margin:0 0 22px}button{border:0;border-radius:10px;background:#0f172a;color:#fff;font:inherit;font-weight:700;padding:12px 18px;cursor:pointer}.brand{margin-top:24px;font-size:12px;color:#94a3b8}
</style></head><body><main><h1>Xác nhận hủy đăng ký</h1><p>Dừng nhận email marketing gửi tới <strong>${maskedEmail}</strong>?</p><form method="post" action="/api/campaigns/unsubscribe"><input type="hidden" name="token" value="${token}"><button type="submit">Xác nhận hủy đăng ký</button></form><div class="brand">NemarkChat</div></main></body></html>`;

const unsubscribeRateLimits = new Map<string, { count: number; resetAt: number }>();
const isUnsubscribeRateLimited = (req: Request): boolean => {
    const now = Date.now();
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const current = unsubscribeRateLimits.get(key);
    if (!current || current.resetAt <= now) {
        unsubscribeRateLimits.set(key, { count: 1, resetAt: now + 10 * 60_000 });
        if (unsubscribeRateLimits.size > 5000) {
            for (const [entryKey, value] of unsubscribeRateLimits) {
                if (value.resetAt <= now) unsubscribeRateLimits.delete(entryKey);
            }
        }
        return false;
    }
    current.count++;
    return current.count > 30;
};

export const campaignController = {
    telegramStatus: asyncHandler(async (req: Request, res: Response) => {
        const workspaceId = req.params.workspaceId as string;
        res.status(200).json({ success: true, data: await campaignService.getTelegramStatus(workspaceId) });
    }),

    telegramDestinations: asyncHandler(async (req: Request, res: Response) => {
        const workspaceId = req.params.workspaceId as string;
        res.status(200).json({ success: true, data: await campaignService.discoverTelegramDestinations(workspaceId) });
    }),

    /**
     * Create a new campaign (draft)
     * POST /campaigns
     */
    create: asyncHandler(async (req: Request, res: Response) => {
        const workspaceId = req.params.workspaceId as string;
        const userId = (req as any).user?.id || (req as any).user?._id;
        const {
            name,
            channel,
            messages,
            subject,
            emailHtml,
            emailText,
            emailAccountId,
            audience,
            schedule,
            antiSpam,
        } = req.body;

        const campaign = await campaignService.create(workspaceId, userId, {
            name,
            channel,
            messages,
            subject,
            emailHtml,
            emailText,
            emailAccountId,
            audience,
            schedule,
            antiSpam,
        });

        res.status(201).json({ success: true, data: campaign });
    }),

    /**
     * List campaigns
     * GET /campaigns
     */
    list: asyncHandler(async (req: Request, res: Response) => {
        const workspaceId = req.params.workspaceId as string;
        const { status, page, limit } = req.query;

        const result = await campaignService.list(workspaceId, {
            status: status as any,
            page: page ? Number(page) : 1,
            limit: limit ? Number(limit) : 20,
        });

        res.status(200).json({ success: true, data: result });
    }),

    /**
     * Get campaign details
     * GET /campaigns/:campaignId
     */
    getById: asyncHandler(async (req: Request, res: Response) => {
        const workspaceId = req.params.workspaceId as string;
        const campaignId = req.params.campaignId as string;
        const campaign = await campaignService.getById(campaignId, workspaceId);
        res.status(200).json({ success: true, data: campaign });
    }),

    /**
     * Update draft campaign
     * PUT /campaigns/:campaignId
     */
    update: asyncHandler(async (req: Request, res: Response) => {
        const workspaceId = req.params.workspaceId as string;
        const campaignId = req.params.campaignId as string;
        const {
            name,
            channel,
            messages,
            subject,
            emailHtml,
            emailText,
            emailAccountId,
            audience,
            schedule,
            antiSpam,
        } = req.body;

        const updated = await campaignService.update(campaignId, workspaceId, {
            name,
            channel,
            messages,
            subject,
            emailHtml,
            emailText,
            emailAccountId,
            audience,
            schedule,
            antiSpam,
        });

        res.status(200).json({ success: true, data: updated });
    }),

    /**
     * Start campaign execution
     * POST /campaigns/:campaignId/start
     */
    start: asyncHandler(async (req: Request, res: Response) => {
        const workspaceId = req.params.workspaceId as string;
        const campaignId = req.params.campaignId as string;
        const result = await campaignService.start(campaignId, workspaceId);
        res.status(200).json({
            success: true,
            data: result,
            message: result.scheduledAt
                ? `Đã lên lịch campaign lúc ${new Date(result.scheduledAt).toLocaleString('vi-VN')}`
                : `Đã bắt đầu gửi campaign cho ${result.total} người nhận`,
        });
    }),

    /**
     * Pause campaign
     * POST /campaigns/:campaignId/pause
     */
    pause: asyncHandler(async (req: Request, res: Response) => {
        const workspaceId = req.params.workspaceId as string;
        const campaignId = req.params.campaignId as string;
        await campaignService.pause(campaignId, workspaceId);
        res.status(200).json({ success: true, message: 'Đã tạm dừng campaign' });
    }),

    /**
     * Resume campaign
     * POST /campaigns/:campaignId/resume
     */
    resume: asyncHandler(async (req: Request, res: Response) => {
        const workspaceId = req.params.workspaceId as string;
        const campaignId = req.params.campaignId as string;
        await campaignService.resume(campaignId, workspaceId);
        res.status(200).json({ success: true, message: 'Đã tiếp tục campaign' });
    }),

    /**
     * Cancel/delete campaign
     * DELETE /campaigns/:campaignId
     */
    cancel: asyncHandler(async (req: Request, res: Response) => {
        const workspaceId = req.params.workspaceId as string;
        const campaignId = req.params.campaignId as string;
        await campaignService.cancel(campaignId, workspaceId);
        res.status(200).json({ success: true, message: 'Đã hủy campaign' });
    }),

    /**
     * Get workspace campaign stats
     * GET /campaigns/stats
     */
    getStats: asyncHandler(async (req: Request, res: Response) => {
        const workspaceId = req.params.workspaceId as string;
        const stats = await campaignService.getStats(workspaceId);
        res.status(200).json({ success: true, data: stats });
    }),

    unsubscribePage: async (req: Request, res: Response) => {
        if (isUnsubscribeRateLimited(req)) {
            res.status(429).type('html').send(renderUnsubscribePage(
                'Thử lại sau',
                'Có quá nhiều yêu cầu từ kết nối này.',
                false,
            ));
            return;
        }
        try {
            const token = typeof req.query.token === 'string' ? req.query.token : '';
            const result = await campaignService.getUnsubscribePreview(token);
            res.status(200).type('html').send(renderUnsubscribeConfirm(escapePageText(result.maskedEmail), token));
        } catch (error) {
            const status = error instanceof AppError ? error.statusCode : 500;
            res.status(status).type('html').send(renderUnsubscribePage(
                'Liên kết không hợp lệ',
                status >= 500 ? 'Không thể kiểm tra yêu cầu lúc này.' : (error as Error).message,
                false,
            ));
        }
    },

    unsubscribe: async (req: Request, res: Response) => {
        if (isUnsubscribeRateLimited(req)) {
            res.status(429).type('html').send(renderUnsubscribePage(
                'Thử lại sau',
                'Có quá nhiều yêu cầu từ kết nối này.',
                false,
            ));
            return;
        }
        try {
            const token = typeof req.body?.token === 'string'
                ? req.body.token
                : typeof req.query.token === 'string' ? req.query.token : '';
            const result = await campaignService.unsubscribe(token);
            res.status(200).type('html').send(renderUnsubscribePage(
                'Đã hủy đăng ký',
                `${escapePageText(result.maskedEmail)} sẽ không nhận thêm email marketing từ workspace này.`,
                true,
            ));
        } catch (error) {
            const status = error instanceof AppError ? error.statusCode : 500;
            const message = status >= 500
                ? 'Không thể xử lý yêu cầu lúc này. Vui lòng thử lại sau.'
                : (error as Error).message;
            res.status(status).type('html').send(renderUnsubscribePage(
                'Không thể hủy đăng ký',
                message,
                false,
            ));
        }
    },
};
