import { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import { facebookService } from './facebook.service';
import {
    connectFacebookPages,
    getFacebookOAuthFailure,
    sanitizeFacebookProviderError,
} from './facebook-production.helpers';

function sendOAuthPopupResult(
    res: Response,
    payload: {
        type: 'nemarkchat:facebook-oauth';
        success: boolean;
        workspaceId?: string;
        pages?: number;
        failed?: number;
        error?: string;
    },
    fallbackUrl: string,
) {
    const targetOrigin = new URL(fallbackUrl).origin;
    const safePayload = JSON.stringify(payload).replace(/</g, '\\u003c');
    const safeOrigin = JSON.stringify(targetOrigin);
    const safeFallbackUrl = JSON.stringify(fallbackUrl);

    res.status(200).type('html').send(`<!doctype html>
<html lang="vi">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Kết nối Facebook</title></head>
<body style="font-family:system-ui,sans-serif;padding:32px;color:#0f172a">
<p>${payload.success ? 'Đã kết nối Facebook. Cửa sổ này sẽ tự đóng.' : 'Chưa thể kết nối Facebook. Đang quay lại NemarkChat.'}</p>
<p><a href=${safeFallbackUrl}>Quay lại NemarkChat</a></p>
<script>
(function () {
  var payload = ${safePayload};
  var targetOrigin = ${safeOrigin};
  var fallbackUrl = ${safeFallbackUrl};
  try {
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(payload, targetOrigin);
      window.setTimeout(function () { window.close(); }, 80);
      return;
    }
  } catch (_) {}
  window.location.replace(fallbackUrl);
})();
</script>
</body></html>`);
}

export const facebookController = {
    /**
     * Generate Facebook OAuth URL for the user to authorize
     */
    getOAuthUrl: asyncHandler(async (req: Request, res: Response) => {
        const workspaceId = req.params.workspaceId as string;
        const url = await facebookService.getOAuthUrl(workspaceId);
        res.status(200).json({ success: true, data: { url } });
    }),

    getConfigStatus: asyncHandler(async (_req: Request, res: Response) => {
        res.status(200).json({ success: true, data: await facebookService.getConfigStatus() });
    }),

    /**
     * OAuth callback — exchange code, get pages, save
     */
    handleCallback: asyncHandler(async (req: Request, res: Response) => {
        const code = typeof req.query.code === 'string' ? req.query.code : '';
        const state = typeof req.query.state === 'string' ? req.query.state : '';
        const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3010';
        let workspaceId = '';
        try {
            if (state) workspaceId = await facebookService.verifyOAuthState(state);
            const providerFailure = getFacebookOAuthFailure(req.query as Record<string, unknown>);
            if (providerFailure) throw new Error(providerFailure);
            if (!code || !state) throw new Error('Missing Facebook OAuth code or state');

            // Exchange code for token
            const shortToken = await facebookService.exchangeCodeForToken(code);
            const longToken = await facebookService.getLongLivedToken(shortToken);

            // Get user's pages
            const pages = await facebookService.getUserPages(longToken);

            // Auto-connect all pages
            const result = await connectFacebookPages(pages, (page) => facebookService.connectPage(
                workspaceId,
                page.id,
                page.name,
                page.picture || '',
                page.access_token,
                longToken,
            ));
            if (result.connected.length === 0) {
                throw new Error(result.failed[0]?.error || 'No Facebook Page could be connected');
            }

            // Auto-sync conversations in background (fire-and-forget)
            for (const saved of result.connected) {
                const pageDbId = saved.id;
                facebookService.syncPageConversations(workspaceId, pageDbId).catch(err => {
                    console.warn(`[FacebookController] Background sync error for page ${pageDbId}: ${sanitizeFacebookProviderError(err)}`);
                });
            }

            const fallbackUrl = `${baseUrl}/workspace/${workspaceId}/settings?tab=facebook&fb_connected=${result.connected.length}&fb_failed=${result.failed.length}`;
            sendOAuthPopupResult(res, {
                type: 'nemarkchat:facebook-oauth',
                success: true,
                workspaceId,
                pages: result.connected.length,
                failed: result.failed.length,
            }, fallbackUrl);
        } catch (err: unknown) {
            const errorMessage = sanitizeFacebookProviderError(err, 'Facebook OAuth failed');
            console.error(`[FacebookController] OAuth callback error: ${errorMessage}`);
            const target = workspaceId ? `/workspace/${workspaceId}/settings?tab=facebook` : '/auth/login';
            const separator = target.includes('?') ? '&' : '?';
            const fallbackUrl = `${baseUrl}${target}${separator}fb_error=${encodeURIComponent(errorMessage)}`;
            sendOAuthPopupResult(res, {
                type: 'nemarkchat:facebook-oauth',
                success: false,
                workspaceId: workspaceId || undefined,
                error: errorMessage.slice(0, 500),
            }, fallbackUrl);
        }
    }),

    /**
     * Webhook verification (GET) — called by Facebook during setup
     */
    verifyWebhook: asyncHandler(async (req: Request, res: Response) => {
        const mode = req.query['hub.mode'] as string;
        const token = req.query['hub.verify_token'] as string;
        const challenge = req.query['hub.challenge'] as string;

        const result = await facebookService.verifyWebhook(mode, token, challenge);
        if (result) {
            res.status(200).send(result);
        } else {
            res.sendStatus(403);
        }
    }),

    /**
     * Webhook handler (POST) — receives incoming messages
     */
    handleWebhook: asyncHandler(async (req: Request, res: Response) => {
        const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
        const signatureHeader = req.headers['x-hub-signature-256'];
        const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;

        // Never acknowledge or process an unauthenticated Meta webhook.
        await facebookService.verifyWebhookSignature(rawBody, signature);

        // Facebook expects 200 OK immediately after authentication.
        res.sendStatus(200);

        // Process after ACK; transport authentication failures are handled above.
        void facebookService.handleWebhook(req.body).catch((err) => {
            console.error('[FacebookController] Webhook processing error:', err);
        });
    }),

    /**
     * Get connected pages for a workspace
     */
    getPages: asyncHandler(async (req: Request, res: Response) => {
        const workspaceId = req.params.workspaceId as string;
        const pages = await facebookService.getPages(workspaceId);

        res.status(200).json({
            success: true,
            data: { pages, total: pages.length },
        });
    }),

    /**
     * Connect a specific page manually  
     */
    connectPage: asyncHandler(async (req: Request, res: Response) => {
        const workspaceId = req.params.workspaceId as string;
        const { pageId, pageName, pageAvatar, accessToken } = req.body;

        const page = await facebookService.connectPage(workspaceId, pageId, pageName, pageAvatar || '', accessToken);

        res.status(201).json({
            success: true,
            data: page,
        });
    }),

    /**
     * Disconnect a page
     */
    disconnectPage: asyncHandler(async (req: Request, res: Response) => {
        const workspaceId = req.params.workspaceId as string;
        const pageDbId = req.params.pageDbId as string;

        await facebookService.disconnectPage(workspaceId, pageDbId);

        res.status(200).json({
            success: true,
            message: 'Đã ngắt kết nối Facebook Page',
        });
    }),

    /**
     * Send message via Facebook Page
     */
    sendMessage: asyncHandler(async (req: Request, res: Response) => {
        const workspaceId = req.params.workspaceId as string;
        const { recipientId, text, pageId } = req.body;

        const result = await facebookService.sendMessage(workspaceId, recipientId, text, pageId);

        res.status(200).json({
            success: true,
            data: result,
        });
    }),

    /**
     * Sync historical messages from a connected Facebook Page
     */
    syncPageMessages: asyncHandler(async (req: Request, res: Response) => {
        const workspaceId = req.params.workspaceId as string;
        const pageDbId = req.params.pageDbId as string;

        const result = await facebookService.syncPageConversations(workspaceId, pageDbId);
        res.status(200).json({
            success: true,
            data: result,
            message: `Đồng bộ hoàn tất: ${result.synced} tin nhắn, ${result.skipped} bỏ qua`,
        });
    }),
};
