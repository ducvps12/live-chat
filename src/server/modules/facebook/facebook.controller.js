const service = require('./facebook.service');
const asyncHandler = require('../../utils/asyncHandler');
const AppError = require('../../utils/AppError');

// Base URL for OAuth callback
const getRedirectUri = (req) => {
    const host = process.env.PUBLIC_HOST || `${req.protocol}://${req.get('host')}`;
    return `${host}/api/facebook/oauth/callback`;
};

/**
 * Get OAuth URL to start Facebook login flow
 * GET /api/facebook/oauth/url
 */
const getOAuthUrl = asyncHandler(async (req, res) => {
    const redirectUri = getRedirectUri(req);
    const url = service.getOAuthUrl(req.workspaceId, redirectUri);

    res.json({
        status: 'success',
        data: { url, redirectUri }
    });
});

/**
 * Handle OAuth callback from Facebook
 * GET /api/facebook/oauth/callback
 */
const handleOAuthCallback = asyncHandler(async (req, res) => {
    const { code, state, error, error_description } = req.query;

    // Handle user cancellation or error
    if (error) {
        const errorMessage = error_description || error;
        return res.redirect(`/workspace/settings/facebook?error=${encodeURIComponent(errorMessage)}`);
    }

    if (!code) {
        return res.redirect('/workspace/settings/facebook?error=No authorization code received');
    }

    try {
        // Decode state to get workspaceId
        const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
        const { workspaceId } = stateData;

        // Exchange code for token
        const redirectUri = getRedirectUri(req);
        const tokenData = await service.exchangeCodeForToken(code, redirectUri);

        // Get long-lived token
        const longLivedToken = await service.getLongLivedToken(tokenData.access_token);

        // Store token temporarily in session or return to frontend
        // For now, redirect with token (in production, use secure session)
        const tokenParam = Buffer.from(longLivedToken).toString('base64');

        res.redirect(`/workspace/${workspaceId}/settings/facebook?token=${tokenParam}&success=1`);
    } catch (error) {
        console.error('Facebook OAuth error:', error.response?.data || error.message);
        res.redirect(`/workspace/settings/facebook?error=${encodeURIComponent('Không thể kết nối Facebook')}`);
    }
});

/**
 * Get list of available pages to connect (from Facebook)
 * GET /api/facebook/pages/available
 */
const getAvailablePages = asyncHandler(async (req, res) => {
    const { token } = req.query;

    if (!token) {
        throw new AppError('Access token is required', 400);
    }

    const accessToken = Buffer.from(token, 'base64').toString();
    const pages = await service.getAvailablePages(accessToken);

    // Filter out already connected pages
    const connectedPages = await service.getConnectedPages(req.workspaceKey);
    const connectedIds = new Set(connectedPages.map(p => p.facebookPageId));

    const availablePages = pages.map(page => ({
        ...page,
        isConnected: connectedIds.has(page.id)
    }));

    res.json({
        status: 'success',
        data: { pages: availablePages }
    });
});

/**
 * Get connected pages for workspace
 * GET /api/facebook/pages
 */
const getConnectedPages = asyncHandler(async (req, res) => {
    const pages = await service.getConnectedPages(req.workspaceKey);

    res.json({
        status: 'success',
        data: { pages }
    });
});

/**
 * Connect selected pages to workspace
 * POST /api/facebook/pages/connect
 */
const connectPages = asyncHandler(async (req, res) => {
    const { pages, token } = req.body;

    if (!pages || !Array.isArray(pages) || pages.length === 0) {
        throw new AppError('Please select at least one page', 400);
    }

    if (!token) {
        throw new AppError('Access token is required', 400);
    }

    // Get page tokens from Facebook
    const accessToken = Buffer.from(token, 'base64').toString();
    const availablePages = await service.getAvailablePages(accessToken);

    // Filter selected pages
    const selectedIds = new Set(pages.map(p => p.id));
    const pagesToConnect = availablePages.filter(p => selectedIds.has(p.id));

    if (pagesToConnect.length === 0) {
        throw new AppError('No valid pages to connect', 400);
    }

    const result = await service.connectPages(req.workspaceKey, pagesToConnect);

    res.json({
        status: 'success',
        data: result
    });
});

/**
 * Disconnect a page
 * DELETE /api/facebook/pages/:pageId
 */
const disconnectPage = asyncHandler(async (req, res) => {
    const { pageId } = req.params;

    await service.disconnectPage(req.workspaceKey, pageId);

    res.json({
        status: 'success',
        message: 'Page disconnected successfully'
    });
});

/**
 * Update page settings
 * PATCH /api/facebook/pages/:pageId/settings
 */
const updatePageSettings = asyncHandler(async (req, res) => {
    const { pageId } = req.params;
    const settings = req.body;

    const page = await service.updatePageSettings(req.workspaceKey, pageId, settings);

    res.json({
        status: 'success',
        data: { page }
    });
});

/**
 * Verify webhook (called by Facebook)
 * GET /api/facebook/webhook
 */
const verifyWebhook = asyncHandler(async (req, res) => {
    try {
        const challenge = service.verifyWebhook(req.query);
        res.status(200).send(challenge);
    } catch (error) {
        res.status(403).send('Verification failed');
    }
});

/**
 * Handle webhook events (called by Facebook)
 * POST /api/facebook/webhook
 */
const handleWebhook = asyncHandler(async (req, res) => {
    // Always respond with 200 immediately to acknowledge receipt
    res.status(200).send('EVENT_RECEIVED');

    // Process events asynchronously
    try {
        await service.handleWebhookEvent(req.body);
    } catch (error) {
        console.error('Error processing Facebook webhook:', error);
    }
});

/**
 * Send message to Facebook user (from Inbox)
 * POST /api/facebook/messages
 */
const sendMessageToUser = asyncHandler(async (req, res) => {
    const { conversationId, message, pageKey, recipientId } = req.body;

    if (!message) {
        throw new AppError('Message is required', 400);
    }

    const messageHandler = require('./facebook-message-handler');
    let actualPageKey = pageKey;
    let actualRecipientId = recipientId;

    // If conversationId provided, extract pageKey and recipientId from it
    if (conversationId && (!pageKey || !recipientId)) {
        actualPageKey = await messageHandler.getPageKeyFromConversation(conversationId);
        if (!actualPageKey) {
            throw new AppError('Could not find Facebook page for this conversation', 400);
        }

        // Get recipient from conversation
        const { getPool } = require('../../infra/mysql/mysql');
        const pool = getPool();
        const [convRows] = await pool.execute(
            'SELECT VisitorId FROM iam_WidgetConversations WHERE ConversationId = ?',
            [conversationId]
        );

        actualRecipientId = convRows[0]?.VisitorId;
    }

    if (!actualPageKey || !actualRecipientId) {
        throw new AppError('Page and recipient are required', 400);
    }

    const result = await messageHandler.sendMessageToUser(actualPageKey, actualRecipientId, message);

    res.json({
        status: 'success',
        data: result
    });
});

module.exports = {
    getOAuthUrl,
    handleOAuthCallback,
    getAvailablePages,
    getConnectedPages,
    connectPages,
    disconnectPage,
    updatePageSettings,
    verifyWebhook,
    handleWebhook,
    sendMessageToUser
};
