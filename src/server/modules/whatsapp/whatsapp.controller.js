/**
 * WhatsApp Controller
 * Handles HTTP requests for WhatsApp integration
 */
const whatsappService = require('./whatsapp.service');
const whatsappMessageHandler = require('./whatsapp-message-handler');
const asyncHandler = require('../../utils/asyncHandler');
const AppError = require('../../utils/AppError');

/**
 * Verify webhook (GET /api/whatsapp/webhook)
 */
const verifyWebhook = asyncHandler(async (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const result = whatsappService.verifyWebhook(mode, token, challenge);

    if (result.success) {
        res.status(200).send(result.challenge);
    } else {
        res.status(403).send('Verification failed');
    }
});

/**
 * Handle webhook events (POST /api/whatsapp/webhook)
 */
const handleWebhook = asyncHandler(async (req, res) => {
    // Always respond quickly to Meta
    res.status(200).send('EVENT_RECEIVED');

    // Process event asynchronously
    try {
        await whatsappService.processWebhookEvent(req.body);
    } catch (error) {
        console.error('[WhatsApp] Webhook processing error:', error);
    }
});

/**
 * Get connected accounts (GET /api/whatsapp/accounts)
 */
const getAccounts = asyncHandler(async (req, res) => {
    const workspaceId = req.headers['x-workspace-id'];
    if (!workspaceId) {
        throw new AppError('x-workspace-id header is required', 400);
    }

    // Get workspace key from ID
    const { getPool } = require('../../infra/mysql/mysql');
    const pool = getPool();
    const [wsRows] = await pool.execute(
        'SELECT WorkspaceKey FROM iam_Workspaces WHERE WorkspaceId = ?',
        [workspaceId]
    );

    if (!wsRows[0]) {
        throw new AppError('Workspace not found', 404);
    }

    const workspaceKey = wsRows[0].WorkspaceKey;
    const accounts = await whatsappService.getAccountsByWorkspace(workspaceKey);

    res.json({
        status: 'success',
        data: accounts.map(a => ({
            id: a.AccountId,
            phoneNumberId: a.PhoneNumberId,
            displayNumber: a.DisplayNumber,
            businessAccountId: a.BusinessAccountId,
            status: a.Status,
            createdAt: a.CreatedAt
        }))
    });
});

/**
 * Connect new account (POST /api/whatsapp/connect)
 */
const connectAccount = asyncHandler(async (req, res) => {
    const workspaceId = req.headers['x-workspace-id'];
    const { phoneNumberId, displayNumber, wabaId, accessToken } = req.body;

    if (!workspaceId || !phoneNumberId || !accessToken) {
        throw new AppError('Missing required fields', 400);
    }

    // Get workspace key
    const { getPool } = require('../../infra/mysql/mysql');
    const pool = getPool();
    const [wsRows] = await pool.execute(
        'SELECT WorkspaceKey FROM iam_Workspaces WHERE WorkspaceId = ?',
        [workspaceId]
    );

    if (!wsRows[0]) {
        throw new AppError('Workspace not found', 404);
    }

    const workspaceKey = wsRows[0].WorkspaceKey;

    const account = await whatsappService.connectAccount(
        workspaceKey,
        phoneNumberId,
        displayNumber,
        wabaId,
        accessToken
    );

    res.json({
        status: 'success',
        data: {
            id: account.AccountId,
            phoneNumberId: account.PhoneNumberId,
            displayNumber: account.DisplayNumber
        }
    });
});

/**
 * OAuth callback (GET /api/whatsapp/callback)
 */
const handleCallback = asyncHandler(async (req, res) => {
    // WhatsApp uses embedded signup flow
    // This endpoint handles the redirect after user completes setup
    const { code, state } = req.query;

    if (!code) {
        return res.redirect('/workspace/settings/whatsapp?error=no_code');
    }

    // State contains workspaceId
    const workspaceId = state;

    // Exchange code for token using Meta's OAuth
    // Note: WhatsApp Cloud API typically uses long-lived tokens from Facebook Business
    // The actual implementation depends on your OAuth flow setup

    res.redirect(`/workspace/settings/whatsapp?success=true`);
});

/**
 * Disconnect account (DELETE /api/whatsapp/accounts/:accountId)
 */
const disconnectAccount = asyncHandler(async (req, res) => {
    const workspaceId = req.headers['x-workspace-id'];
    const { accountId } = req.params;

    if (!workspaceId || !accountId) {
        throw new AppError('Missing required parameters', 400);
    }

    // Get workspace key
    const { getPool } = require('../../infra/mysql/mysql');
    const pool = getPool();
    const [wsRows] = await pool.execute(
        'SELECT WorkspaceKey FROM iam_Workspaces WHERE WorkspaceId = ?',
        [workspaceId]
    );

    if (!wsRows[0]) {
        throw new AppError('Workspace not found', 404);
    }

    const workspaceKey = wsRows[0].WorkspaceKey;

    await whatsappService.disconnectAccount(accountId, workspaceKey);

    res.json({
        status: 'success',
        message: 'Account disconnected'
    });
});

/**
 * Send message (POST /api/whatsapp/messages)
 */
const sendMessage = asyncHandler(async (req, res) => {
    const { accountKey, recipientPhone, text } = req.body;

    if (!accountKey || !recipientPhone || !text) {
        throw new AppError('accountKey, recipientPhone, and text are required', 400);
    }

    const result = await whatsappMessageHandler.sendMessageToUser(
        accountKey,
        recipientPhone,
        text
    );

    res.json({
        status: 'success',
        data: result
    });
});

/**
 * Get account settings (GET /api/whatsapp/accounts/:accountId/settings)
 */
const getAccountSettings = asyncHandler(async (req, res) => {
    const { accountId } = req.params;

    // Placeholder for account-specific settings
    res.json({
        status: 'success',
        data: {
            autoReplyEnabled: false,
            autoReplyMessage: '',
            businessHours: null
        }
    });
});

/**
 * Update account settings (PATCH /api/whatsapp/accounts/:accountId/settings)
 */
const updateAccountSettings = asyncHandler(async (req, res) => {
    const { accountId } = req.params;
    const settings = req.body;

    // Placeholder for updating settings
    res.json({
        status: 'success',
        message: 'Settings updated'
    });
});

module.exports = {
    verifyWebhook,
    handleWebhook,
    getAccounts,
    connectAccount,
    handleCallback,
    disconnectAccount,
    sendMessage,
    getAccountSettings,
    updateAccountSettings
};
