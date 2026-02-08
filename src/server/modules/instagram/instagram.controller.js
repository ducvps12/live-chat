const instagramService = require('./instagram.service');

/**
 * Get OAuth URL for Instagram connection
 * GET /api/instagram/oauth/url
 */
const getOAuthUrl = async (req, res) => {
    try {
        const { workspaceId } = req.workspace;
        const redirectUri = `${req.protocol}://${req.get('host')}/api/instagram/oauth/callback`;

        const url = instagramService.getOAuthUrl(workspaceId, redirectUri);
        res.json({ success: true, url });
    } catch (error) {
        console.error('[Instagram] Get OAuth URL error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * OAuth callback handler
 * GET /api/instagram/oauth/callback
 */
const oauthCallback = async (req, res) => {
    try {
        const { code, state, error: oauthError } = req.query;

        if (oauthError) {
            return res.redirect(`/workspace/settings/instagram?error=${encodeURIComponent(oauthError)}`);
        }

        if (!code || !state) {
            return res.redirect('/workspace/settings/instagram?error=missing_params');
        }

        // Decode state
        let stateData;
        try {
            stateData = JSON.parse(Buffer.from(state, 'base64').toString());
        } catch (e) {
            return res.redirect('/workspace/settings/instagram?error=invalid_state');
        }

        const redirectUri = `${req.protocol}://${req.get('host')}/api/instagram/oauth/callback`;

        // Exchange code for token
        const tokenResponse = await instagramService.exchangeCodeForToken(code, redirectUri);

        // Get long-lived token
        const longLivedToken = await instagramService.getLongLivedToken(tokenResponse.access_token);

        // Redirect to page selection with token
        const tokenParam = Buffer.from(JSON.stringify({
            token: longLivedToken,
            workspaceId: stateData.workspaceId
        })).toString('base64');

        res.redirect(`/workspace/settings/instagram?token=${tokenParam}`);
    } catch (error) {
        console.error('[Instagram] OAuth callback error:', error);
        res.redirect(`/workspace/settings/instagram?error=${encodeURIComponent(error.message)}`);
    }
};

/**
 * Get available Instagram accounts to connect
 * POST /api/instagram/available
 */
const getAvailableAccounts = async (req, res) => {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({ success: false, error: 'Token is required' });
        }

        const accounts = await instagramService.getPagesWithInstagram(token);
        res.json({ success: true, accounts });
    } catch (error) {
        console.error('[Instagram] Get available accounts error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Connect Instagram account
 * POST /api/instagram/connect
 */
const connectAccount = async (req, res) => {
    try {
        const { workspaceKey } = req.workspace;
        const accountData = req.body;

        if (!accountData.instagramBusinessId) {
            return res.status(400).json({ success: false, error: 'Instagram account data is required' });
        }

        const account = await instagramService.connectAccount(workspaceKey, accountData);
        res.json({ success: true, account });
    } catch (error) {
        console.error('[Instagram] Connect error:', error);
        res.status(400).json({ success: false, error: error.message });
    }
};

/**
 * Get connected accounts
 * GET /api/instagram/accounts
 */
const getAccounts = async (req, res) => {
    try {
        const { workspaceKey } = req.workspace;
        const accounts = await instagramService.getConnectedAccounts(workspaceKey);
        res.json({ success: true, accounts });
    } catch (error) {
        console.error('[Instagram] Get accounts error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Disconnect account
 * DELETE /api/instagram/accounts/:accountId
 */
const disconnectAccount = async (req, res) => {
    try {
        const { workspaceKey } = req.workspace;
        const { accountId } = req.params;

        await instagramService.disconnectAccount(workspaceKey, accountId);
        res.json({ success: true, message: 'Đã ngắt kết nối' });
    } catch (error) {
        console.error('[Instagram] Disconnect error:', error);
        res.status(400).json({ success: false, error: error.message });
    }
};

/**
 * Update account settings
 * PATCH /api/instagram/accounts/:accountId/settings
 */
const updateSettings = async (req, res) => {
    try {
        const { workspaceKey } = req.workspace;
        const { accountId } = req.params;
        const settings = req.body;

        const updated = await instagramService.updateAccountSettings(workspaceKey, accountId, settings);
        res.json({ success: true, account: updated });
    } catch (error) {
        console.error('[Instagram] Update settings error:', error);
        res.status(400).json({ success: false, error: error.message });
    }
};

/**
 * Webhook verification (Facebook/Instagram shared webhook)
 * GET /api/instagram/webhook
 */
const verifyWebhook = async (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN) {
        console.log('[Instagram] Webhook verified');
        res.status(200).send(challenge);
    } else {
        console.warn('[Instagram] Webhook verification failed');
        res.sendStatus(403);
    }
};

/**
 * Handle incoming webhook events
 * POST /api/instagram/webhook
 */
const handleWebhook = async (req, res) => {
    try {
        // Immediately respond to Facebook
        res.sendStatus(200);

        // Process webhook asynchronously
        await instagramService.handleWebhookEvent(req.body);
    } catch (error) {
        console.error('[Instagram] Webhook error:', error);
    }
};

module.exports = {
    getOAuthUrl,
    oauthCallback,
    getAvailableAccounts,
    connectAccount,
    getAccounts,
    disconnectAccount,
    updateSettings,
    verifyWebhook,
    handleWebhook
};
