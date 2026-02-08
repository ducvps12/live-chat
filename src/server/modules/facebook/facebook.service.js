const axios = require('axios');
const facebookRepo = require('./repos/facebook.repo');
const env = require('../../config/env');

// Facebook Graph API base URL
const FB_GRAPH_URL = 'https://graph.facebook.com/v19.0';

// Page status constants
const PAGE_STATUS = {
    ACTIVE: 1,
    DISCONNECTED: 2,
    TOKEN_EXPIRED: 3,
    ERROR: 4
};

/**
 * Generate Facebook OAuth URL for login
 */
const getOAuthUrl = (workspaceId, redirectUri) => {
    const appId = env.FACEBOOK_APP_ID;
    const scopes = [
        'pages_show_list',
        'pages_messaging',
        'pages_read_engagement',
        'pages_manage_metadata',
        'public_profile'
    ].join(',');

    const state = Buffer.from(JSON.stringify({ workspaceId })).toString('base64');

    return `https://www.facebook.com/v19.0/dialog/oauth?` +
        `client_id=${appId}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&scope=${scopes}` +
        `&state=${state}` +
        `&response_type=code`;
};

/**
 * Exchange authorization code for access token
 */
const exchangeCodeForToken = async (code, redirectUri) => {
    const response = await axios.get(`${FB_GRAPH_URL}/oauth/access_token`, {
        params: {
            client_id: env.FACEBOOK_APP_ID,
            client_secret: env.FACEBOOK_APP_SECRET,
            redirect_uri: redirectUri,
            code
        }
    });
    return response.data; // { access_token, token_type, expires_in }
};

/**
 * Get long-lived user access token
 */
const getLongLivedToken = async (shortLivedToken) => {
    const response = await axios.get(`${FB_GRAPH_URL}/oauth/access_token`, {
        params: {
            grant_type: 'fb_exchange_token',
            client_id: env.FACEBOOK_APP_ID,
            client_secret: env.FACEBOOK_APP_SECRET,
            fb_exchange_token: shortLivedToken
        }
    });
    return response.data.access_token;
};

/**
 * Get list of pages the user manages
 */
const getAvailablePages = async (userAccessToken) => {
    const response = await axios.get(`${FB_GRAPH_URL}/me/accounts`, {
        params: {
            access_token: userAccessToken,
            fields: 'id,name,picture,access_token,category'
        }
    });

    return response.data.data.map(page => ({
        id: page.id,
        name: page.name,
        avatar: page.picture?.data?.url || null,
        category: page.category,
        accessToken: page.access_token
    }));
};

/**
 * Subscribe page to webhook events
 */
const subscribePageToWebhook = async (pageId, pageAccessToken) => {
    await axios.post(`${FB_GRAPH_URL}/${pageId}/subscribed_apps`, null, {
        params: {
            access_token: pageAccessToken,
            subscribed_fields: 'messages,messaging_postbacks,messaging_optins,message_deliveries,message_reads'
        }
    });
};

/**
 * Connect a Facebook page to workspace
 */
const connectPage = async (workspaceKey, pageData) => {
    // Check if already connected
    const exists = await facebookRepo.existsInWorkspace(workspaceKey, pageData.id);
    if (exists) {
        throw new Error('Page already connected to this workspace');
    }

    // Subscribe to webhook
    await subscribePageToWebhook(pageData.id, pageData.accessToken);

    // Save to database
    const page = await facebookRepo.insertPage(workspaceKey, {
        facebookPageId: pageData.id,
        facebookPageName: pageData.name,
        facebookPageAvatar: pageData.avatar,
        pageAccessToken: pageData.accessToken,
        settings: {
            autoReplyComment: false
        }
    });

    return page;
};

/**
 * Connect multiple pages at once
 */
const connectPages = async (workspaceKey, pages) => {
    const results = [];
    const errors = [];

    for (const page of pages) {
        try {
            const connected = await connectPage(workspaceKey, page);
            results.push(connected);
        } catch (error) {
            errors.push({ pageId: page.id, pageName: page.name, error: error.message });
        }
    }

    return { connected: results, errors };
};

/**
 * Get connected pages for workspace
 */
const getConnectedPages = async (workspaceKey) => {
    const pages = await facebookRepo.findByWorkspace(workspaceKey);
    return pages.map(page => ({
        pageId: page.PageId,
        pageKey: page.PageKey,
        facebookPageId: page.FacebookPageId,
        facebookPageName: page.FacebookPageName,
        facebookPageAvatar: page.FacebookPageAvatar,
        status: page.Status,
        statusText: getStatusText(page.Status),
        lastSyncAt: page.LastSyncAt,
        errorMessage: page.ErrorMessage,
        settings: JSON.parse(page.Settings || '{}'),
        createdAt: page.CreatedAt,
        updatedAt: page.UpdatedAt
    }));
};

/**
 * Get status text
 */
const getStatusText = (status) => {
    switch (status) {
        case PAGE_STATUS.ACTIVE: return 'HOẠT ĐỘNG';
        case PAGE_STATUS.DISCONNECTED: return 'ĐÃ NGẮT';
        case PAGE_STATUS.TOKEN_EXPIRED: return 'TOKEN HẾT HẠN';
        case PAGE_STATUS.ERROR: return 'LỖI';
        default: return 'KHÔNG XÁC ĐỊNH';
    }
};

/**
 * Disconnect a page
 */
const disconnectPage = async (workspaceKey, pageId) => {
    const page = await facebookRepo.findByPageId(pageId);
    if (!page || page.WorkspaceKey !== workspaceKey) {
        throw new Error('Page not found');
    }
    await facebookRepo.deleteByPageId(pageId);
};

/**
 * Update page settings
 */
const updatePageSettings = async (workspaceKey, pageId, settings) => {
    const page = await facebookRepo.findByPageId(pageId);
    if (!page || page.WorkspaceKey !== workspaceKey) {
        throw new Error('Page not found');
    }

    // Merge with existing settings
    const currentSettings = JSON.parse(page.Settings || '{}');
    const newSettings = { ...currentSettings, ...settings };

    return await facebookRepo.updatePageSettings(page.PageKey, newSettings);
};

/**
 * Verify webhook from Facebook
 */
const verifyWebhook = (query) => {
    const mode = query['hub.mode'];
    const token = query['hub.verify_token'];
    const challenge = query['hub.challenge'];

    if (mode === 'subscribe' && token === env.FACEBOOK_WEBHOOK_VERIFY_TOKEN) {
        return challenge;
    }
    throw new Error('Webhook verification failed');
};

/**
 * Handle incoming webhook event from Facebook
 */
const handleWebhookEvent = async (body) => {
    if (body.object !== 'page') {
        return;
    }

    for (const entry of body.entry) {
        const pageId = entry.id;
        const page = await facebookRepo.findByFacebookPageId(pageId);

        if (!page) {
            console.warn(`Received webhook for unknown page: ${pageId}`);
            continue;
        }

        // Update last sync
        await facebookRepo.updateLastSync(page.PageKey);

        // Process messaging events
        if (entry.messaging) {
            for (const event of entry.messaging) {
                await processMessagingEvent(page, event);
            }
        }
    }
};

/**
 * Process a single messaging event
 */
const processMessagingEvent = async (page, event) => {
    const senderId = event.sender.id;
    const recipientId = event.recipient.id;

    // Skip if sender is the page itself
    if (senderId === page.FacebookPageId) {
        return;
    }

    if (event.message) {
        await handleIncomingMessage(page, senderId, event.message, event.timestamp);
    } else if (event.postback) {
        await handlePostback(page, senderId, event.postback);
    }
};

/**
 * Handle incoming message
 */
const handleIncomingMessage = async (page, senderId, message, timestamp) => {
    console.log(`[Facebook] New message from ${senderId} to page ${page.FacebookPageName}:`, message.text || '[attachment]');

    // Process message using the message handler
    const messageHandler = require('./facebook-message-handler');
    await messageHandler.processIncomingMessage(page, senderId, message, timestamp);
};

/**
 * Handle postback (button click)
 */
const handlePostback = async (page, senderId, postback) => {
    console.log(`[Facebook] Postback from ${senderId}:`, postback.payload);
};

/**
 * Send message to Facebook user
 */
const sendMessage = async (pageKey, recipientId, message) => {
    const page = await facebookRepo.findByPageKey(pageKey);
    if (!page) {
        throw new Error('Page not found');
    }

    await axios.post(`${FB_GRAPH_URL}/me/messages`, {
        recipient: { id: recipientId },
        message: { text: message }
    }, {
        params: { access_token: page.PageAccessToken }
    });
};

module.exports = {
    PAGE_STATUS,
    getOAuthUrl,
    exchangeCodeForToken,
    getLongLivedToken,
    getAvailablePages,
    connectPage,
    connectPages,
    getConnectedPages,
    disconnectPage,
    updatePageSettings,
    verifyWebhook,
    handleWebhookEvent,
    sendMessage
};
