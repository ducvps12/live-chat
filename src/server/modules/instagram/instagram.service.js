const axios = require('axios');
const instagramRepo = require('./repos/instagram.repo');
const env = require('../../config/env');

// Facebook Graph API base URL
const FB_GRAPH_URL = 'https://graph.facebook.com/v19.0';

// Account status constants
const ACCOUNT_STATUS = {
    ACTIVE: 1,
    DISCONNECTED: 2,
    TOKEN_EXPIRED: 3,
    ERROR: 4
};

/**
 * Generate OAuth URL for Instagram via Facebook
 * Instagram DM API requires: instagram_basic, instagram_manage_messages, pages_show_list
 */
const getOAuthUrl = (workspaceId, redirectUri) => {
    const appId = env.FACEBOOK_APP_ID;
    const scopes = [
        'instagram_basic',
        'instagram_manage_messages',
        'pages_show_list',
        'pages_messaging',
        'pages_read_engagement',
        'public_profile'
    ].join(',');

    const state = Buffer.from(JSON.stringify({ workspaceId, channel: 'instagram' })).toString('base64');

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
    return response.data;
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
 * Get pages with linked Instagram accounts
 */
const getPagesWithInstagram = async (userAccessToken) => {
    // Get user's pages
    const pagesResponse = await axios.get(`${FB_GRAPH_URL}/me/accounts`, {
        params: {
            access_token: userAccessToken,
            fields: 'id,name,picture,access_token,instagram_business_account'
        }
    });

    const pagesWithInstagram = [];

    for (const page of pagesResponse.data.data) {
        if (page.instagram_business_account) {
            // Get Instagram account details
            try {
                const igResponse = await axios.get(`${FB_GRAPH_URL}/${page.instagram_business_account.id}`, {
                    params: {
                        access_token: page.access_token,
                        fields: 'id,username,name,profile_picture_url'
                    }
                });

                pagesWithInstagram.push({
                    facebookPageId: page.id,
                    facebookPageName: page.name,
                    pageAccessToken: page.access_token,
                    instagramBusinessId: igResponse.data.id,
                    instagramUsername: igResponse.data.username,
                    instagramName: igResponse.data.name || igResponse.data.username,
                    instagramAvatar: igResponse.data.profile_picture_url
                });
            } catch (error) {
                console.warn(`[Instagram] Could not fetch IG account for page ${page.name}:`, error.message);
            }
        }
    }

    return pagesWithInstagram;
};

/**
 * Subscribe Instagram account to webhook
 */
const subscribeToWebhook = async (pageId, pageAccessToken) => {
    await axios.post(`${FB_GRAPH_URL}/${pageId}/subscribed_apps`, null, {
        params: {
            access_token: pageAccessToken,
            subscribed_fields: 'messages,messaging_postbacks'
        }
    });
};

/**
 * Connect an Instagram account to workspace
 */
const connectAccount = async (workspaceKey, accountData) => {
    // Check if already connected
    const exists = await instagramRepo.existsInWorkspace(workspaceKey, accountData.instagramBusinessId);
    if (exists) {
        throw new Error('Tài khoản Instagram này đã được kết nối');
    }

    // Subscribe to webhook via Facebook Page
    await subscribeToWebhook(accountData.facebookPageId, accountData.pageAccessToken);

    // Save to database
    const account = await instagramRepo.insertAccount(workspaceKey, {
        instagramBusinessId: accountData.instagramBusinessId,
        instagramUsername: accountData.instagramUsername,
        instagramName: accountData.instagramName,
        instagramAvatar: accountData.instagramAvatar,
        linkedFacebookPageId: accountData.facebookPageId,
        linkedFacebookPageName: accountData.facebookPageName,
        pageAccessToken: accountData.pageAccessToken,
        settings: {
            autoReplyDM: false,
            welcomeMessage: ''
        }
    });

    return account;
};

/**
 * Get connected accounts for workspace
 */
const getConnectedAccounts = async (workspaceKey) => {
    const accounts = await instagramRepo.findByWorkspace(workspaceKey);
    return accounts.map(formatAccount);
};

/**
 * Format account for API response
 */
const formatAccount = (account) => ({
    accountId: account.AccountId,
    accountKey: account.AccountKey,
    instagramBusinessId: account.InstagramBusinessId,
    instagramUsername: account.InstagramUsername,
    instagramName: account.InstagramName,
    instagramAvatar: account.InstagramAvatar,
    linkedFacebookPageId: account.LinkedFacebookPageId,
    linkedFacebookPageName: account.LinkedFacebookPageName,
    status: account.Status,
    statusText: getStatusText(account.Status),
    lastSyncAt: account.LastSyncAt,
    errorMessage: account.ErrorMessage,
    settings: JSON.parse(account.Settings || '{}'),
    createdAt: account.CreatedAt,
    updatedAt: account.UpdatedAt
});

/**
 * Get status text
 */
const getStatusText = (status) => {
    switch (status) {
        case ACCOUNT_STATUS.ACTIVE: return 'Hoạt động';
        case ACCOUNT_STATUS.DISCONNECTED: return 'Đã ngắt';
        case ACCOUNT_STATUS.TOKEN_EXPIRED: return 'Token hết hạn';
        case ACCOUNT_STATUS.ERROR: return 'Lỗi';
        default: return 'Không xác định';
    }
};

/**
 * Disconnect an account
 */
const disconnectAccount = async (workspaceKey, accountId) => {
    const account = await instagramRepo.findByAccountId(accountId);
    if (!account || account.WorkspaceKey !== workspaceKey) {
        throw new Error('Tài khoản không tồn tại');
    }
    await instagramRepo.deleteAccount(account.AccountKey);
};

/**
 * Update account settings
 */
const updateAccountSettings = async (workspaceKey, accountId, settings) => {
    const account = await instagramRepo.findByAccountId(accountId);
    if (!account || account.WorkspaceKey !== workspaceKey) {
        throw new Error('Tài khoản không tồn tại');
    }

    const currentSettings = JSON.parse(account.Settings || '{}');
    const newSettings = { ...currentSettings, ...settings };

    return await instagramRepo.updateSettings(account.AccountKey, newSettings);
};

/**
 * Handle incoming webhook event from Instagram (via Facebook)
 */
const handleWebhookEvent = async (body) => {
    if (body.object !== 'instagram') {
        return;
    }

    for (const entry of body.entry) {
        const instagramId = entry.id;
        const account = await instagramRepo.findByInstagramId(instagramId);

        if (!account) {
            console.warn(`[Instagram] Received webhook for unknown account: ${instagramId}`);
            continue;
        }

        // Update last sync
        await instagramRepo.updateLastSync(account.AccountKey);

        // Process messaging events
        if (entry.messaging) {
            for (const event of entry.messaging) {
                await processMessagingEvent(account, event);
            }
        }
    }
};

/**
 * Process a single messaging event
 */
const processMessagingEvent = async (account, event) => {
    const senderId = event.sender.id;

    // Skip if sender is the Instagram account itself
    if (senderId === account.InstagramBusinessId) {
        return;
    }

    if (event.message) {
        console.log(`[Instagram] New DM from ${senderId} to @${account.InstagramUsername}:`,
            event.message.text || '[media]');

        // TODO: Process message using message handler (similar to Facebook)
        // await messageHandler.processIncomingMessage(account, senderId, event.message);
    }
};

/**
 * Send message to Instagram user
 */
const sendMessage = async (accountKey, recipientId, message) => {
    const account = await instagramRepo.findByAccountId(accountKey);
    if (!account) {
        throw new Error('Account not found');
    }

    await axios.post(`${FB_GRAPH_URL}/${account.InstagramBusinessId}/messages`, {
        recipient: { id: recipientId },
        message: { text: message }
    }, {
        params: { access_token: account.PageAccessToken }
    });
};

module.exports = {
    ACCOUNT_STATUS,
    getOAuthUrl,
    exchangeCodeForToken,
    getLongLivedToken,
    getPagesWithInstagram,
    connectAccount,
    getConnectedAccounts,
    disconnectAccount,
    updateAccountSettings,
    handleWebhookEvent,
    sendMessage
};
