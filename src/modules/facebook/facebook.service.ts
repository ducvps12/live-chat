import { fbPageRepo } from './repos/fb-page.repo';
import { conversationService } from '../conversation/conversation.service';
import mongoose from 'mongoose';
import { createHmac, timingSafeEqual } from 'crypto';
import { AppError } from '../../middlewares/errorHandler';
import { SETTINGS_KEYS, settingsService } from '../admin/settings.service';

const FB_GRAPH_URL = 'https://graph.facebook.com/v19.0';
const OAUTH_STATE_TTL_MS = 15 * 60 * 1000;

type FacebookRuntimeConfig = {
    enabled: boolean;
    appId: string;
    appSecret: string;
    verifyToken: string;
    redirectUri: string;
    stateSecret: string;
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
        };
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
            webhookReady: config.enabled && webhookConfigured,
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
            if (!parsed.workspaceId || !parsed.issuedAt || Date.now() - parsed.issuedAt > OAUTH_STATE_TTL_MS) {
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

        return `https://www.facebook.com/v19.0/dialog/oauth?client_id=${config.appId}&redirect_uri=${encodeURIComponent(config.redirectUri)}&scope=${scopes}&state=${encodeURIComponent(this.createOAuthState(workspaceId, config.stateSecret))}&response_type=code`;
    }

    /**
     * Step 2: Exchange auth code for user access token
     */
    async exchangeCodeForToken(code: string): Promise<string> {
        const config = await this.getRuntimeConfig();
        this.assertOAuthConfigured(config);
        const url = `${FB_GRAPH_URL}/oauth/access_token?client_id=${config.appId}&redirect_uri=${encodeURIComponent(config.redirectUri)}&client_secret=${config.appSecret}&code=${code}`;

        const res = await fetch(url);
        const data = await res.json() as any;
        if (data.error) {
            throw new Error(data.error.message || 'Failed to exchange code');
        }
        return data.access_token;
    }

    /**
     * Step 2b: Exchange short-lived token for long-lived token
     */
    async getLongLivedToken(shortToken: string): Promise<string> {
        const config = await this.getRuntimeConfig();
        this.assertOAuthConfigured(config);
        const url = `${FB_GRAPH_URL}/oauth/access_token?grant_type=fb_exchange_token&client_id=${config.appId}&client_secret=${config.appSecret}&fb_exchange_token=${shortToken}`;

        const res = await fetch(url);
        const data = await res.json() as any;
        if (data.error) {
            throw new Error(data.error.message || 'Failed to get long-lived token');
        }
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
        const url = `${FB_GRAPH_URL}/me/accounts?fields=id,name,access_token,picture&access_token=${userAccessToken}`;

        const res = await fetch(url);
        const data = await res.json() as any;
        if (data.error) {
            throw new Error(data.error.message || 'Failed to fetch pages');
        }
        return (data.data || []).map((page: any) => ({
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
        // Save to DB
        const page = await fbPageRepo.upsertPage(workspaceId, pageId, {
            pageName,
            pageAvatar,
            accessToken: pageAccessToken,
            userAccessToken,
            status: 'active',
        });

        // Subscribe to webhook
        try {
            await this.subscribeWebhook(pageId, pageAccessToken);
        } catch (err) {
            console.warn(`[FacebookService] Failed to subscribe webhook for page ${pageId}:`, err);
        }

        return page;
    }

    /**
     * Subscribe a page to receive webhook events
     */
    private async subscribeWebhook(pageId: string, pageAccessToken: string) {
        const url = `${FB_GRAPH_URL}/${pageId}/subscribed_apps`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                subscribed_fields: ['messages', 'messaging_postbacks'],
                access_token: pageAccessToken,
            }),
        });
        const data = await res.json() as any;
        if (data.error) {
            console.error(`[FacebookService] Webhook subscribe error:`, data.error);
        } else {
            console.log(`[FacebookService] ✅ Page ${pageId} subscribed to webhook`);
        }
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
        const page = await fbPageRepo.findById(pageDbId);
        if (page && page.workspaceId.toString() === workspaceId) {
            // Unsubscribe webhook
            try {
                const url = `${FB_GRAPH_URL}/${page.pageId}/subscribed_apps?access_token=${page.accessToken}`;
                await fetch(url, { method: 'DELETE' });
            } catch { /* silent */ }
            await fbPageRepo.delete(pageDbId);
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
            const page = await fbPageRepo.findByPageId(pageId);
            if (!page || page.status !== 'active') {
                console.warn(`[FacebookService] Received webhook for unknown/inactive page ${pageId}`);
                continue;
            }

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
                            await this.handlePageSentMessage(workspaceId, page, recipientId, event.message, event.timestamp);
                        }
                    } else {
                        // Customer message → route as visitor message
                        await this.handleIncomingMessage(workspaceId, page, senderId, event.message, event.timestamp);
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
                const profileUrl = `${FB_GRAPH_URL}/${senderId}?fields=first_name,last_name,profile_pic&access_token=${page.accessToken}`;
                const profileRes = await fetch(profileUrl);
                const profile = await profileRes.json() as any;
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
                const profileUrl = `${FB_GRAPH_URL}/${recipientId}?fields=first_name,last_name,profile_pic&access_token=${page.accessToken}`;
                const profileRes = await fetch(profileUrl);
                const profile = await profileRes.json() as any;
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
            page = await fbPageRepo.findByPageId(pageId);
        }
        if (!page) {
            const pages = await fbPageRepo.findByWorkspaceId(workspaceId);
            page = pages.find(p => p.status === 'active');
        }
        if (!page) {
            throw new Error('Không có Facebook Page nào đang kết nối');
        }

        const url = `${FB_GRAPH_URL}/${page.pageId}/messages?access_token=${encodeURIComponent(page.accessToken)}`;
        const body = {
            recipient: { id: recipientId },
            messaging_type: 'RESPONSE',
            message: { text },
        };

        console.log(`[FacebookService] Sending message to ${recipientId} via page ${page.pageName} (${page.pageId})`);

        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        const data = await res.json() as any;
        if (data.error) {
            console.error(`[FacebookService] Send error (${res.status}):`, JSON.stringify(data.error));
            throw new Error(data.error.message || 'Lỗi gửi tin nhắn Facebook');
        }

        console.log(`[FacebookService] ✅ Message sent, messageId: ${data.message_id}`);
        return { success: true, messageId: data.message_id };
    }

    /**
     * Verify webhook (called by Facebook during setup)
     */
    async verifyWebhook(mode: string, token: string, challenge: string): Promise<string | null> {
        const config = await this.getRuntimeConfig();
        if (config.enabled && mode === 'subscribe' && token === config.verifyToken) {
            console.log('[FacebookService] ✅ Webhook verified');
            return challenge;
        }
        return null;
    }

    /**
     * Sync historical conversations from a connected Facebook Page
     * Fetches recent threads and imports messages into the inbox
     */
    async syncPageConversations(workspaceId: string, pageDbId: string) {
        const page = await fbPageRepo.findById(pageDbId);
        if (!page || page.workspaceId.toString() !== workspaceId) {
            throw new Error('Page không tồn tại hoặc không thuộc workspace này');
        }

        const accessToken = page.accessToken;
        const pageId = page.pageId;
        let synced = 0;
        let skipped = 0;

        try {
            // Fetch conversations (threads) from the page
            const convsUrl = `${FB_GRAPH_URL}/${pageId}/conversations?fields=id,participants,updated_time&limit=50&access_token=${accessToken}`;
            const convsRes = await fetch(convsUrl);
            const convsData = await convsRes.json() as any;

            if (convsData.error) {
                console.error('[FacebookService] Sync error:', convsData.error);
                throw new Error(convsData.error.message || 'Failed to fetch conversations');
            }

            const threads = convsData.data || [];
            console.log(`[FacebookService] Found ${threads.length} threads for page ${page.pageName}`);

            for (const thread of threads) {
                try {
                    // Get the non-page participant (the customer)
                    const participants = thread.participants?.data || [];
                    const customer = participants.find((p: any) => p.id !== pageId);
                    if (!customer) continue;

                    // Fetch messages in this thread
                    const msgsUrl = `${FB_GRAPH_URL}/${thread.id}/messages?fields=id,message,from,created_time,attachments&limit=25&access_token=${accessToken}`;
                    const msgsRes = await fetch(msgsUrl);
                    const msgsData = await msgsRes.json() as any;

                    if (msgsData.error) {
                        console.warn(`[FacebookService] Skip thread ${thread.id}:`, msgsData.error.message);
                        skipped++;
                        continue;
                    }

                    const fbMessages = (msgsData.data || []).reverse(); // oldest first

                    // Get customer profile
                    let customerName = customer.name || `FB User ${customer.id.slice(-4)}`;
                    let customerAvatar = '';
                    try {
                        const profileUrl = `${FB_GRAPH_URL}/${customer.id}?fields=first_name,last_name,profile_pic&access_token=${accessToken}`;
                        const profileRes = await fetch(profileUrl);
                        const profile = await profileRes.json() as any;
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
