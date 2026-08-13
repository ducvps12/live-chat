import { fbPageRepo } from './repos/fb-page.repo';
import { conversationService } from '../conversation/conversation.service';
import mongoose from 'mongoose';
import { createHmac, timingSafeEqual } from 'crypto';
import { AppError } from '../../middlewares/errorHandler';
import { SETTINGS_KEYS, settingsService } from '../admin/settings.service';
import {
    assertFacebookGraphResponse,
    connectFacebookPageTwoPhase,
    facebookGraphUrl,
    facebookOAuthDialogUrl,
    isFacebookOAuthTimestampValid,
    isValidFacebookWebhookSignature,
    resolveFacebookGraphApiVersion,
} from './facebook-production.helpers';

type FacebookRuntimeConfig = {
    enabled: boolean;
    appId: string;
    appSecret: string;
    verifyToken: string;
    redirectUri: string;
    stateSecret: string;
    graphApiVersion: string;
};

type FacebookManagedPage = {
    id: string;
    name: string;
    access_token: string;
    picture?: { data?: { url?: string } };
};

class FacebookService {
    private getStateSecret(): string {
        return process.env.FB_OAUTH_STATE_SECRET || process.env.JWT_SECRET || '';
    }

    private async getRuntimeConfig(): Promise<FacebookRuntimeConfig> {
        const baseUrl = (process.env.BASE_URL || process.env.FRONTEND_URL || 'http://localhost:3010').replace(/\/$/, '');
        const [enabled, appId, appSecret, verifyToken, redirectUri] = await Promise.all([
            settingsService.get(SETTINGS_KEYS.FACEBOOK_ENABLED, 'true'),
            settingsService.get(SETTINGS_KEYS.FACEBOOK_APP_ID, process.env.FB_APP_ID || ''),
            settingsService.getSecret(SETTINGS_KEYS.FACEBOOK_APP_SECRET, process.env.FB_APP_SECRET || ''),
            settingsService.getSecret(SETTINGS_KEYS.FACEBOOK_VERIFY_TOKEN, process.env.FB_VERIFY_TOKEN || ''),
            settingsService.get(
                SETTINGS_KEYS.FACEBOOK_REDIRECT_URI,
                process.env.FB_REDIRECT_URI || `${baseUrl}/api/facebook/callback`,
            ),
        ]);
        return {
            enabled: enabled === 'true',
            appId,
            appSecret,
            verifyToken,
            redirectUri,
            stateSecret: this.getStateSecret(),
            graphApiVersion: resolveFacebookGraphApiVersion(process.env.FB_GRAPH_API_VERSION),
        };
    }

    private graphUrl(config: Pick<FacebookRuntimeConfig, 'graphApiVersion'>, path: string): string {
        return facebookGraphUrl(config.graphApiVersion, path);
    }

    private async readGraphResponse<T>(response: Response, operation: string, requireSuccess = false): Promise<T> {
        let data: unknown = null;
        try {
            data = await response.json();
        } catch {
            data = { message: `HTTP ${response.status}` };
        }
        return assertFacebookGraphResponse<T>(response, data, operation, { requireSuccess });
    }

    private async graphFetch(url: string, init: RequestInit = {}): Promise<Response> {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15_000);
        try {
            return await fetch(url, { ...init, signal: controller.signal });
        } catch (error) {
            if (controller.signal.aborted) {
                throw new AppError('Facebook Graph request timed out', 504, 'FACEBOOK_GRAPH_TIMEOUT');
            }
            throw error;
        } finally {
            clearTimeout(timeout);
        }
    }

    private assertEnabled(config: FacebookRuntimeConfig): void {
        if (!config.enabled) {
            throw new AppError('Facebook integration is disabled.', 503, 'FACEBOOK_DISABLED');
        }
    }

    private async getFacebookProfile(userId: string, accessToken: string): Promise<{
        first_name?: string;
        last_name?: string;
        profile_pic?: string;
    }> {
        const config = await this.getRuntimeConfig();
        this.assertEnabled(config);
        const url = `${this.graphUrl(config, encodeURIComponent(userId))}?fields=first_name,last_name,profile_pic&access_token=${encodeURIComponent(accessToken)}`;
        const response = await this.graphFetch(url);
        return this.readGraphResponse(response, 'Facebook profile lookup');
    }

    private assertOAuthConfigured(config: FacebookRuntimeConfig): void {
        if (!config.enabled) {
            throw new AppError('Tích hợp Facebook đang bị tắt trong Admin Control Panel.', 503, 'FACEBOOK_DISABLED');
        }
        if (!config.appId || !config.appSecret) {
            throw new AppError(
                'Facebook App chưa được cấu hình trên máy chủ. Quản trị viên cần bổ sung FB_APP_ID và FB_APP_SECRET trước khi kết nối Fanpage.',
                503,
                'FACEBOOK_APP_NOT_CONFIGURED',
            );
        }
        if (!config.stateSecret) {
            throw new AppError('Facebook OAuth state secret chua duoc cau hinh tren may chu.', 503, 'FACEBOOK_STATE_NOT_CONFIGURED');
        }
    }

    async getConfigStatus() {
        const config = await this.getRuntimeConfig();
        const appConfigured = Boolean(config.appId && config.appSecret);
        const stateConfigured = Boolean(config.stateSecret);
        const webhookConfigured = Boolean(config.verifyToken);
        return {
            enabled: config.enabled,
            oauthReady: config.enabled && appConfigured && stateConfigured,
            webhookReady: config.enabled && Boolean(config.appSecret) && webhookConfigured,
            graphApiVersion: config.graphApiVersion,
            redirectUri: config.redirectUri,
            webhookUrl: `${(process.env.BASE_URL || process.env.FRONTEND_URL || 'http://localhost:3010').replace(/\/$/, '')}/api/facebook/webhook`,
            missing: [
                ...(!config.appId ? ['Facebook App ID'] : []),
                ...(!config.appSecret ? ['Facebook App Secret'] : []),
                ...(!stateConfigured ? ['FB_OAUTH_STATE_SECRET or JWT_SECRET'] : []),
                ...(!webhookConfigured ? ['Facebook Verify Token'] : []),
            ],
        };
    }

    private createOAuthState(workspaceId: string, stateSecret: string): string {
        const payload = Buffer.from(JSON.stringify({ workspaceId, issuedAt: Date.now() })).toString('base64url');
        const signature = createHmac('sha256', stateSecret).update(payload).digest('base64url');
        return `${payload}.${signature}`;
    }

    async verifyOAuthState(state: string): Promise<string> {
        const config = await this.getRuntimeConfig();
        const [payload, receivedSignature] = String(state || '').split('.');
        if (!payload || !receivedSignature || !config.stateSecret) {
            throw new AppError('Invalid Facebook OAuth state', 400, 'FACEBOOK_OAUTH_STATE_INVALID');
        }
        const expectedSignature = createHmac('sha256', config.stateSecret).update(payload).digest('base64url');
        const received = Buffer.from(receivedSignature);
        const expected = Buffer.from(expectedSignature);
        if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
            throw new AppError('Invalid Facebook OAuth state', 400, 'FACEBOOK_OAUTH_STATE_INVALID');
        }
        try {
            const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { workspaceId?: string; issuedAt?: number };
            if (!parsed.workspaceId || !parsed.issuedAt || !isFacebookOAuthTimestampValid(parsed.issuedAt, Date.now())) {
                throw new Error('expired');
            }
            return parsed.workspaceId;
        } catch {
            throw new AppError('Facebook OAuth state expired or invalid', 400, 'FACEBOOK_OAUTH_STATE_INVALID');
        }
    }

    /**
     * Step 1: Generate OAuth URL for user to login with Facebook
     */
    async getOAuthUrl(workspaceId: string): Promise<string> {
        const config = await this.getRuntimeConfig();
        this.assertOAuthConfigured(config);
        const scopes = [
            'pages_messaging',
            'pages_manage_metadata',
            'pages_read_engagement',
            'pages_show_list',
        ].join(',');

        return `${facebookOAuthDialogUrl(config.graphApiVersion)}?client_id=${config.appId}&redirect_uri=${encodeURIComponent(config.redirectUri)}&scope=${scopes}&state=${encodeURIComponent(this.createOAuthState(workspaceId, config.stateSecret))}&response_type=code`;
    }

    /**
     * Step 2: Exchange auth code for user access token
     */
    async exchangeCodeForToken(code: string): Promise<string> {
        const config = await this.getRuntimeConfig();
        this.assertOAuthConfigured(config);
        const url = `${this.graphUrl(config, 'oauth/access_token')}?client_id=${config.appId}&redirect_uri=${encodeURIComponent(config.redirectUri)}&client_secret=${config.appSecret}&code=${encodeURIComponent(code)}`;

        const res = await this.graphFetch(url);
        const data = await this.readGraphResponse<{ access_token?: string }>(res, 'Facebook OAuth token exchange');
        if (!data.access_token) throw new AppError('Facebook OAuth token exchange returned no token', 502, 'FACEBOOK_GRAPH_REQUEST_FAILED');
        return data.access_token;
    }

    /**
     * Step 2b: Exchange short-lived token for long-lived token
     */
    async getLongLivedToken(shortToken: string): Promise<string> {
        const config = await this.getRuntimeConfig();
        this.assertOAuthConfigured(config);
        const url = `${this.graphUrl(config, 'oauth/access_token')}?grant_type=fb_exchange_token&client_id=${config.appId}&client_secret=${config.appSecret}&fb_exchange_token=${encodeURIComponent(shortToken)}`;

        const res = await this.graphFetch(url);
        const data = await this.readGraphResponse<{ access_token?: string }>(res, 'Facebook long-lived token exchange');
        if (!data.access_token) throw new AppError('Facebook long-lived token exchange returned no token', 502, 'FACEBOOK_GRAPH_REQUEST_FAILED');
        return data.access_token;
    }

    /**
     * Step 3: Get list of pages the user manages
     */
    async getUserPages(userAccessToken: string): Promise<Array<{
        id: string;
        name: string;
        access_token: string;
        picture?: string;
    }>> {
        const config = await this.getRuntimeConfig();
        this.assertOAuthConfigured(config);
        const url = `${this.graphUrl(config, 'me/accounts')}?fields=id,name,access_token,picture&access_token=${encodeURIComponent(userAccessToken)}`;

        const res = await this.graphFetch(url);
        const data = await this.readGraphResponse<{ data?: FacebookManagedPage[] }>(res, 'Facebook managed pages lookup');
        return (data.data || []).map((page) => ({
            id: page.id,
            name: page.name,
            access_token: page.access_token,
            picture: page.picture?.data?.url || '',
        }));
    }

    /**
     * Step 4: Connect a page to workspace
     */
    async connectPage(workspaceId: string, pageId: string, pageName: string, pageAvatar: string, pageAccessToken: string, userAccessToken?: string) {
        return connectFacebookPageTwoPhase({
            subscribe: () => this.subscribeWebhook(pageId, pageAccessToken),
            persist: () => fbPageRepo.upsertPage(workspaceId, pageId, {
                pageName,
                pageAvatar,
                accessToken: pageAccessToken,
                userAccessToken,
                status: 'active',
            }),
        });
    }

    /**
     * Subscribe a page to receive webhook events
     */
    private async subscribeWebhook(pageId: string, pageAccessToken: string) {
        const config = await this.getRuntimeConfig();
        this.assertOAuthConfigured(config);
        const url = this.graphUrl(config, `${encodeURIComponent(pageId)}/subscribed_apps`);
        const res = await this.graphFetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                subscribed_fields: 'messages,messaging_postbacks',
                access_token: pageAccessToken,
            }).toString(),
        });
        await this.readGraphResponse<{ success: true }>(
            res,
            'Facebook webhook subscription',
            true,
        );

        // A successful POST is not enough: permission/app-mode issues can leave
        // the Page unsubscribed. Verify before persisting it as active locally.
        const verificationUrl = `${url}?fields=id&access_token=${encodeURIComponent(pageAccessToken)}`;
        const verificationResponse = await this.graphFetch(verificationUrl);
        const verification = await this.readGraphResponse<{
            data?: Array<{ id?: string }>;
        }>(verificationResponse, 'Facebook webhook subscription verification');
        const isSubscribedToConfiguredApp = verification.data?.some(app => app.id === config.appId) === true;
        if (!isSubscribedToConfiguredApp) {
            throw new AppError(
                'Facebook did not confirm the Page webhook subscription for this app.',
                502,
                'FACEBOOK_WEBHOOK_SUBSCRIPTION_UNVERIFIED',
            );
        }
        console.log(`[FacebookService] Page ${pageId} subscribed to webhook`);
    }

    /**
     * Get all pages connected to a workspace
     */
    async getPages(workspaceId: string) {
        const pages = await fbPageRepo.findByWorkspaceId(workspaceId);
        return pages.map(p => ({
            id: p.id,
            pageId: p.pageId,
            pageName: p.pageName,
            pageAvatar: p.pageAvatar,
            status: p.status,
            createdAt: p.createdAt,
        }));
    }

    /**
     * Disconnect a page
     */
    async disconnectPage(workspaceId: string, pageDbId: string) {
        const page = await fbPageRepo.findByIdForWorkspace(workspaceId, pageDbId);
        if (!page) {
            throw new AppError('Facebook Page not found', 404, 'FACEBOOK_PAGE_NOT_FOUND');
        }

        const config = await this.getRuntimeConfig();
        this.assertOAuthConfigured(config);
        const url = `${this.graphUrl(config, `${encodeURIComponent(page.pageId)}/subscribed_apps`)}?access_token=${encodeURIComponent(page.accessToken)}`;
        const response = await this.graphFetch(url, { method: 'DELETE' });
        await this.readGraphResponse<{ success: true }>(response, 'Facebook webhook unsubscribe', true);

        const deleted = await fbPageRepo.deleteForWorkspace(workspaceId, pageDbId);
        if (!deleted) {
            throw new AppError('Facebook Page not found', 404, 'FACEBOOK_PAGE_NOT_FOUND');
        }
        return { success: true };
    }

    /**
     * Handle incoming webhook from Facebook
     * This is called when a message is sent to one of our connected pages
     */
    async handleWebhook(body: any) {
        if (body.object !== 'page') return;

        for (const entry of body.entry || []) {
            const pageId = entry.id;

            // Find which workspace owns this page
            const pages = await fbPageRepo.findActiveByPageId(pageId);
            if (pages.length === 0) {
                console.warn(`[FacebookService] Received webhook for unknown/inactive page ${pageId}`);
                continue;
            }

            for (const page of pages) {
                const workspaceId = page.workspaceId.toString();

                for (const event of entry.messaging || []) {
                    const senderId = event.sender?.id;
                    const recipientId = event.recipient?.id;

                    if (event.message) {
                        // Check if message is sent BY the page (echo / page-sent)
                        const isEcho = event.message.is_echo === true;
                        const isSentByPage = senderId === pageId || isEcho;

                    if (isSentByPage) {
                        // Page-sent message → route as agent message (2-way sync)
                        // Skip if no real content (delivery receipts, etc.)
                        const msgContent = event.message.text || '';
                        const hasAttachments = event.message.attachments?.length > 0;
                        if (msgContent || hasAttachments) {
                            if (recipientId) {
                                await this.handlePageSentMessage(workspaceId, page, recipientId, event.message, event.timestamp);
                            }
                        }
                    } else {
                        // Customer message → route as visitor message
                        if (senderId) {
                            await this.handleIncomingMessage(workspaceId, page, senderId, event.message, event.timestamp);
                        }
                    }
                    }
                }
            }
        }
    }

    /**
     * Process an incoming Facebook message
     */
    private async handleIncomingMessage(
        workspaceId: string,
        page: any,
        senderId: string,
        fbMessage: any,
        timestamp: number,
    ) {
        try {
            // Get sender profile
            let senderName = `FB User ${senderId.slice(-4)}`;
            let senderAvatar = '';
            try {
                const profile = await this.getFacebookProfile(senderId, page.accessToken);
                if (profile.first_name) {
                    senderName = `${profile.first_name} ${profile.last_name || ''}`.trim();
                }
                if (profile.profile_pic) {
                    senderAvatar = profile.profile_pic;
                }
            } catch { /* silent — profile may not be accessible */ }

            const content = fbMessage.text || '';
            let msgType: 'text' | 'image' | 'video' | 'file' = 'text';
            let attachments: any[] = [];

            // Process attachments
            if (fbMessage.attachments?.data?.length > 0 || fbMessage.attachments?.length > 0) {
                const fbAttachments = fbMessage.attachments.data || fbMessage.attachments || [];
                for (const att of fbAttachments) {
                    if (att.type === 'image') {
                        msgType = 'image';
                        attachments.push({
                            url: att.payload?.url || att.image_data?.url || '',
                            name: 'Facebook Image',
                            size: 0,
                            mimeType: 'image/jpeg',
                        });
                    } else if (att.type === 'video') {
                        msgType = 'video';
                        attachments.push({
                            url: att.payload?.url || '',
                            name: 'Facebook Video',
                            size: 0,
                            mimeType: 'video/mp4',
                        });
                    } else if (att.type === 'file') {
                        msgType = 'file';
                        attachments.push({
                            url: att.payload?.url || '',
                            name: att.payload?.name || 'File',
                            size: att.payload?.size || 0,
                            mimeType: att.payload?.mime_type || 'application/octet-stream',
                        });
                    } else if (att.type === 'sticker') {
                        msgType = 'image';
                        attachments.push({
                            url: att.payload?.url || '',
                            name: 'Facebook Sticker',
                            size: 0,
                            mimeType: 'image/png',
                        });
                    }
                }
            }

            console.log(`[FacebookService] Msg from ${senderName} via page ${page.pageName}: "${content?.substring(0, 50)}"`);

            // Route to conversation system
            await conversationService.handleIncomingFacebookMessage(
                workspaceId,
                senderId,
                senderName,
                senderAvatar,
                content || (attachments.length > 0 ? '[Đính kèm]' : ''),
                msgType,
                attachments,
                fbMessage.mid || `fb_${Date.now()}`,
                page.pageId,
                page.pageName,
            );
        } catch (err) {
            console.error(`[FacebookService] Error handling incoming message:`, err);
        }
    }

    /**
     * Process a message sent BY the page (echo) — route as agent message for 2-way sync
     */
    private async handlePageSentMessage(
        workspaceId: string,
        page: any,
        recipientId: string, // The customer who received the message
        fbMessage: any,
        timestamp: number,
    ) {
        try {
            const content = fbMessage.text || '';
            let msgType: 'text' | 'image' | 'video' | 'file' = 'text';
            let attachments: any[] = [];

            // Process attachments (same logic as handleIncomingMessage)
            if (fbMessage.attachments?.data?.length > 0 || fbMessage.attachments?.length > 0) {
                const fbAttachments = fbMessage.attachments.data || fbMessage.attachments || [];
                for (const att of fbAttachments) {
                    if (att.type === 'image') {
                        msgType = 'image';
                        attachments.push({ url: att.payload?.url || '', name: 'Image', size: 0, mimeType: 'image/jpeg' });
                    } else if (att.type === 'video') {
                        msgType = 'video';
                        attachments.push({ url: att.payload?.url || '', name: 'Video', size: 0, mimeType: 'video/mp4' });
                    } else if (att.type === 'file') {
                        msgType = 'file';
                        attachments.push({ url: att.payload?.url || '', name: att.payload?.name || 'File', size: 0, mimeType: 'application/octet-stream' });
                    }
                }
            }

            // Get recipient profile (the customer)
            let recipientName = `FB User ${recipientId.slice(-4)}`;
            let recipientAvatar = '';
            try {
                const profile = await this.getFacebookProfile(recipientId, page.accessToken);
                if (profile.first_name) recipientName = `${profile.first_name} ${profile.last_name || ''}`.trim();
                if (profile.profile_pic) recipientAvatar = profile.profile_pic;
            } catch { /* silent */ }

            console.log(`[FacebookService] Page-sent msg to ${recipientName}: "${content?.substring(0, 50)}"`);

            await conversationService.handleSelfFacebookMessage(
                workspaceId, recipientId, recipientName, recipientAvatar,
                content || (attachments.length > 0 ? '[Đính kèm]' : ''),
                msgType, attachments,
                fbMessage.mid || `fb_echo_${Date.now()}`,
                page.pageId, page.pageName,
            );
        } catch (err) {
            console.error(`[FacebookService] Error handling page-sent message:`, err);
        }
    }

    /**
     * Send a message reply through a Facebook page
     */
    async sendMessage(workspaceId: string, recipientId: string, text: string, pageId?: string) {
        // Find a connected page
        let page;
        if (pageId) {
            const candidate = await fbPageRepo.findByPageIdForWorkspace(workspaceId, pageId);
            if (candidate?.status === 'active') {
                page = candidate;
            }
        }
        if (!page && !pageId) {
            const pages = await fbPageRepo.findByWorkspaceId(workspaceId);
            page = pages.find(p => p.status === 'active');
        }
        if (!page) {
            throw new Error('Không có Facebook Page nào đang kết nối');
        }

        const config = await this.getRuntimeConfig();
        this.assertEnabled(config);
        const url = `${this.graphUrl(config, `${encodeURIComponent(page.pageId)}/messages`)}?access_token=${encodeURIComponent(page.accessToken)}`;
        const body = {
            recipient: { id: recipientId },
            messaging_type: 'RESPONSE',
            message: { text },
        };

        console.log(`[FacebookService] Sending message to ${recipientId} via page ${page.pageName} (${page.pageId})`);

        const res = await this.graphFetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        const data = await this.readGraphResponse<{
            message_id?: string;
            error?: { message?: string };
        }>(
            res,
            'Facebook message delivery',
        );
        if (!data.message_id) {
            throw new AppError(
                'Facebook message delivery returned no message id',
                502,
                'FACEBOOK_DELIVERY_FAILED',
            );
        }

        console.log(`[FacebookService] ✅ Message sent, messageId: ${data.message_id}`);
        return { success: true, messageId: data.message_id };
    }

    /**
     * Verify webhook (called by Facebook during setup)
     */
    async verifyWebhook(mode: string, token: string, challenge: string): Promise<string | null> {
        const config = await this.getRuntimeConfig();
        if (config.enabled && config.verifyToken && mode === 'subscribe' && token === config.verifyToken) {
            console.log('[FacebookService] ✅ Webhook verified');
            return challenge;
        }
        return null;
    }

    async verifyWebhookSignature(rawBody: Buffer | undefined, signature: string | undefined): Promise<void> {
        const config = await this.getRuntimeConfig();
        this.assertEnabled(config);
        if (!config.appSecret) {
            throw new AppError('Facebook App Secret is not configured.', 503, 'FACEBOOK_APP_NOT_CONFIGURED');
        }
        if (!rawBody || !signature || !isValidFacebookWebhookSignature(rawBody, signature, config.appSecret)) {
            throw new AppError('Invalid Facebook webhook signature.', 401, 'FACEBOOK_WEBHOOK_SIGNATURE_INVALID');
        }
    }

    /**
     * Sync historical conversations from a connected Facebook Page
     * Fetches recent threads and imports messages into the inbox
     */
    async syncPageConversations(workspaceId: string, pageDbId: string) {
        const page = await fbPageRepo.findByIdForWorkspace(workspaceId, pageDbId);
        if (!page) {
            throw new Error('Page không tồn tại hoặc không thuộc workspace này');
        }

        const config = await this.getRuntimeConfig();
        this.assertEnabled(config);
        const accessToken = page.accessToken;
        const pageId = page.pageId;
        let synced = 0;
        let skipped = 0;

        try {
            // Fetch conversations (threads) from the page
            const convsUrl = `${this.graphUrl(config, `${encodeURIComponent(pageId)}/conversations`)}?fields=id,participants,updated_time&limit=50&access_token=${encodeURIComponent(accessToken)}`;
            const convsRes = await this.graphFetch(convsUrl);
            const convsData = await this.readGraphResponse<{ data?: any[] }>(convsRes, 'Facebook conversation sync');

            const threads = convsData.data || [];
            console.log(`[FacebookService] Found ${threads.length} threads for page ${page.pageName}`);

            for (const thread of threads) {
                try {
                    // Get the non-page participant (the customer)
                    const participants = thread.participants?.data || [];
                    const customer = participants.find((p: any) => p.id !== pageId);
                    if (!customer) continue;

                    // Fetch messages in this thread
                    const msgsUrl = `${this.graphUrl(config, `${encodeURIComponent(thread.id)}/messages`)}?fields=id,message,from,created_time,attachments&limit=25&access_token=${encodeURIComponent(accessToken)}`;
                    const msgsRes = await this.graphFetch(msgsUrl);
                    const msgsData = await this.readGraphResponse<{ data?: any[] }>(msgsRes, 'Facebook thread sync');

                    const fbMessages = (msgsData.data || []).reverse(); // oldest first

                    // Get customer profile
                    let customerName = customer.name || `FB User ${customer.id.slice(-4)}`;
                    let customerAvatar = '';
                    try {
                        const profile = await this.getFacebookProfile(customer.id, accessToken);
                        if (profile.first_name) {
                            customerName = `${profile.first_name} ${profile.last_name || ''}`.trim();
                        }
                        if (profile.profile_pic) {
                            customerAvatar = profile.profile_pic;
                        }
                    } catch { /* silent */ }

                    for (const msg of fbMessages) {
                        const isFromPage = msg.from?.id === pageId;
                        const content = msg.message || '';
                        const msgId = msg.id || `fb_sync_${Date.now()}_${Math.random().toString(36).slice(2)}`;

                        // Process attachments
                        let msgType: 'text' | 'image' | 'video' | 'file' = 'text';
                        const attachments: any[] = [];
                        if (msg.attachments?.data?.length > 0) {
                            for (const att of msg.attachments.data) {
                                if (att.mime_type?.startsWith('image') || att.type === 'image') {
                                    msgType = 'image';
                                    attachments.push({
                                        url: att.image_data?.url || att.file_url || '',
                                        name: att.name || 'Facebook Image',
                                        size: att.size || 0,
                                        mimeType: att.mime_type || 'image/jpeg',
                                    });
                                } else if (att.mime_type?.startsWith('video') || att.type === 'video') {
                                    msgType = 'video';
                                    attachments.push({
                                        url: att.video_data?.url || att.file_url || '',
                                        name: att.name || 'Facebook Video',
                                        size: att.size || 0,
                                        mimeType: att.mime_type || 'video/mp4',
                                    });
                                } else if (att.type === 'file' || att.file_url) {
                                    msgType = 'file';
                                    attachments.push({
                                        url: att.file_url || '',
                                        name: att.name || 'File',
                                        size: att.size || 0,
                                        mimeType: att.mime_type || 'application/octet-stream',
                                    });
                                }
                            }
                        }

                        if (!content && attachments.length === 0) continue;

                        if (isFromPage) {
                            // Message from the page (agent-side) — handle as self-sent
                            await conversationService.handleSelfFacebookMessage(
                                workspaceId,
                                customer.id,
                                customerName,
                                customerAvatar,
                                content || (attachments.length > 0 ? '[Đính kèm]' : ''),
                                msgType,
                                attachments,
                                msgId,
                                pageId,
                                page.pageName,
                            );
                        } else {
                            // Message from customer
                            await conversationService.handleIncomingFacebookMessage(
                                workspaceId,
                                customer.id,
                                customerName,
                                customerAvatar,
                                content || (attachments.length > 0 ? '[Đính kèm]' : ''),
                                msgType,
                                attachments,
                                msgId,
                                pageId,
                                page.pageName,
                            );
                        }
                        synced++;
                    }
                } catch (err) {
                    console.warn(`[FacebookService] Error syncing thread ${thread.id}:`, err);
                    skipped++;
                }
            }
        } catch (err) {
            console.error('[FacebookService] Sync failed:', err);
            throw err;
        }

        console.log(`[FacebookService] ✅ Sync completed: ${synced} messages synced, ${skipped} skipped`);
        return { synced, skipped };
    }

    /**
     * Auto-sync all active pages across all workspaces
     * Useful for server startup and periodic background sync
     */
    async syncAllActivePages() {
        try {
            const allPages = await fbPageRepo.findActive();
            if (!allPages || allPages.length === 0) {
                console.log('[FacebookService] No active pages to sync');
                return;
            }

            console.log(`[FacebookService] 🔄 Starting auto-sync for ${allPages.length} active page(s)...`);
            let totalSynced = 0;
            let totalSkipped = 0;

            for (const page of allPages) {
                try {
                    const pageDbId = page.id;
                    const workspaceId = page.workspaceId.toString();
                    console.log(`[FacebookService]   → Syncing page "${page.pageName}" (${page.pageId})`);
                    const result = await this.syncPageConversations(workspaceId, pageDbId);
                    totalSynced += result.synced;
                    totalSkipped += result.skipped;
                } catch (err) {
                    console.warn(`[FacebookService]   ⚠ Failed to sync page ${page.pageName}:`, err);
                }
            }

            console.log(`[FacebookService] ✅ Auto-sync complete: ${totalSynced} messages, ${totalSkipped} skipped across ${allPages.length} pages`);
            return { totalSynced, totalSkipped, pagesCount: allPages.length };
        } catch (err) {
            console.error('[FacebookService] Auto-sync error:', err);
        }
    }
}

export const facebookService = new FacebookService();
