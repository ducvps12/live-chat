/**
 * Zalo Personal Controller
 * API handlers for Zalo personal QR login
 */

const zaloPersonalService = require('./zalo-personal.service');

/**
 * Generate new QR code for login
 * POST /api/zalo-personal/qr
 */
const generateQR = async (req, res) => {
    try {
        const workspaceId = req.params.workspaceId || req.body.workspaceId || 'default';

        const result = await zaloPersonalService.generateQRSession(workspaceId);

        res.json({
            success: true,
            data: {
                sessionId: result.sessionId,
                qrData: result.qrData,
                expiresAt: result.expiresAt,
            },
        });
    } catch (error) {
        console.error('[ZaloPersonal] Generate QR error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate QR code',
            message: error.message,
        });
    }
};

/**
 * Check QR login session status
 * GET /api/zalo-personal/status/:sessionId
 */
const checkStatus = async (req, res) => {
    try {
        const { sessionId } = req.params;

        const result = await zaloPersonalService.getSessionStatus(sessionId);

        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        console.error('[ZaloPersonal] Check status error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to check status',
            message: error.message,
        });
    }
};

/**
 * Refresh QR code
 * POST /api/zalo-personal/refresh/:sessionId
 */
const refreshQR = async (req, res) => {
    try {
        const { sessionId } = req.params;

        const result = await zaloPersonalService.refreshQR(sessionId);

        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        console.error('[ZaloPersonal] Refresh QR error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to refresh QR code',
            message: error.message,
        });
    }
};

/**
 * Get connected Zalo accounts
 * GET /api/zalo-personal/accounts/:workspaceId
 */
const getAccounts = async (req, res) => {
    try {
        const { workspaceId } = req.params;

        const accounts = await zaloPersonalService.getConnectedAccounts(workspaceId);

        res.json({
            success: true,
            data: accounts,
        });
    } catch (error) {
        console.error('[ZaloPersonal] Get accounts error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get accounts',
            message: error.message,
        });
    }
};

/**
 * Disconnect a Zalo account
 * DELETE /api/zalo-personal/accounts/:workspaceId/:accountId
 */
const disconnectAccount = async (req, res) => {
    try {
        const { workspaceId, accountId } = req.params;

        await zaloPersonalService.disconnectAccount(workspaceId, accountId);

        res.json({
            success: true,
            message: 'Account disconnected',
        });
    } catch (error) {
        console.error('[ZaloPersonal] Disconnect account error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to disconnect account',
            message: error.message,
        });
    }
};

/**
 * Check Zalo account connection status
 * GET /api/zalo-personal/check/:workspaceId/:accountId
 */
const checkConnection = async (req, res) => {
    try {
        const { workspaceId, accountId } = req.params;

        const result = await zaloPersonalService.checkConnection(workspaceId, accountId);

        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        console.error('[ZaloPersonal] Check connection error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to check connection',
            message: error.message,
        });
    }
};

/**
 * Update Zalo account (nickname)
 * PATCH /api/zalo-personal/accounts/:workspaceId/:accountId
 */
const updateAccount = async (req, res) => {
    try {
        const { workspaceId, accountId } = req.params;
        const { name } = req.body;

        const result = await zaloPersonalService.updateAccount(workspaceId, accountId, { name });

        res.json({
            success: true,
            data: result,
            message: 'Account updated',
        });
    } catch (error) {
        console.error('[ZaloPersonal] Update account error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update account',
            message: error.message,
        });
    }
};

/**
 * Import session using J2TEAM cookie format (BotzaloNDQ pattern)
 * POST /api/zalo-personal/import-session/:workspaceId
 * Body: { cookie: J2TEAM JSON or string, imei?: string, userAgent?: string }
 */
const importCookieSession = async (req, res) => {
    try {
        const { workspaceId } = req.params;
        const { cookie, imei, userAgent } = req.body;

        if (!cookie) {
            return res.status(400).json({
                success: false,
                error: 'Cookie is required',
                message: 'Please provide J2TEAM cookie data'
            });
        }

        const result = await zaloPersonalService.importCookieSession(workspaceId, {
            cookie,
            imei,
            userAgent
        });

        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        console.error('[ZaloPersonal] Import cookie session error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to import cookie session',
            message: error.message,
        });
    }
};

module.exports = {
    generateQR,
    checkStatus,
    refreshQR,
    getAccounts,
    disconnectAccount,
    checkConnection,
    updateAccount,
    importCookieSession,
};
