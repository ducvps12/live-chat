/**
 * Zalo Personal Service
 * Handles Zalo personal account QR login and message management
 * Uses Puppeteer-based ZaloBrowser for reliable QR generation
 */

const crypto = require('crypto');
const { createClient, getClient, removeClient } = require('../../services/ZaloBrowser');
const { getIO } = require('../../bootstrap/socket');
const { processIncomingMessage } = require('./zalo-message-handler');
const { syncZaloFriends } = require('./zalo-sync.service');

// Store pending QR login sessions
const pendingLogins = new Map();

// Store connected accounts (persisted separately via ZaloBrowser sessions)
const connectedAccounts = new Map();

/**
 * Import session using J2TEAM cookie format (BotzaloNDQ pattern)
 * Alternative to QR login when QR is blocked
 * @param {string} workspaceId 
 * @param {Object} credentials - { cookie: J2TEAM JSON or string, imei?: string, userAgent?: string }
 */
const importCookieSession = async (workspaceId, credentials) => {
    const sessionId = `zalo_cookie_${workspaceId}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    try {
        console.log('[ZaloPersonal] Importing cookie session for workspace:', workspaceId);

        // Get Socket.IO instance
        let io = null;
        try {
            io = getIO();
        } catch (e) {
            console.warn('[ZaloPersonal] Socket.IO not available:', e.message);
        }

        // Create ZaloClient instance
        const client = await createClient(sessionId, workspaceId, io);

        // Initialize Zalo instance
        await client.init();

        // Login with cookie credentials
        await client.loginWithCookie(credentials);

        // Add to connected accounts
        if (!connectedAccounts.has(workspaceId)) {
            connectedAccounts.set(workspaceId, []);
        }
        connectedAccounts.get(workspaceId).push({
            id: sessionId,
            name: 'Zalo User (Cookie)',
            connectedAt: new Date().toISOString(),
            client,
            loginMethod: 'cookie'
        });

        // Sync Zalo friends as contacts (non-blocking)
        const api = client.getAPI();
        if (api) {
            syncZaloFriends(workspaceId, api)
                .then((result) => console.log('[ZaloPersonal] Friend sync completed:', result))
                .catch((err) => console.error('[ZaloPersonal] Friend sync error:', err.message));
        }

        // Start message listener
        console.log('[ZaloPersonal] Starting message listener for workspace:', workspaceId);
        const selfUserId = client.getSelfUserId();

        client.startListener(async (message) => {
            console.log('[ZaloPersonal] Message received:', JSON.stringify(message).substring(0, 200));
            try {
                await processIncomingMessage(workspaceId, sessionId, message, selfUserId);
            } catch (e) {
                console.error('[ZaloPersonal] Error processing message:', e.message);
            }
        });

        return {
            success: true,
            sessionId,
            account: {
                name: 'Zalo User (Cookie)',
                connectedAt: new Date().toISOString(),
                selfUserId,
                loginMethod: 'cookie'
            },
            message: 'Cookie session imported successfully'
        };

    } catch (error) {
        console.error('[ZaloPersonal] Cookie import error:', error);

        // Cleanup on error
        await removeClient(workspaceId);

        throw error;
    }
};

/**
 * Generate a new QR login session using Puppeteer
 */
const generateQRSession = async (workspaceId) => {
    const sessionId = `zalo_${workspaceId}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    try {
        console.log('[ZaloPersonal] Starting Puppeteer QR session for workspace:', workspaceId);

        // Get Socket.IO instance
        let io = null;
        try {
            io = getIO();
        } catch (e) {
            console.warn('[ZaloPersonal] Socket.IO not available:', e.message);
        }

        // Create ZaloClient instance
        const client = await createClient(sessionId, workspaceId, io);

        // Store pending session
        pendingLogins.set(sessionId, {
            workspaceId,
            client,
            status: 'initializing',
            createdAt: Date.now(),
            expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes for Puppeteer session
        });

        // Initialize browser
        await client.init();

        // Update status
        const session = pendingLogins.get(sessionId);
        if (session) {
            session.status = 'browser_ready';
        }

        // Start QR capture (this will emit via Socket.IO)
        await client.getQR();

        // Update status to waiting scan
        if (session) {
            session.status = 'waiting_scan';
        }

        // Start listening for login in background
        client.waitForLogin().then(() => {
            try {
                console.log('[ZaloPersonal] Login detected for session:', sessionId);
                const session = pendingLogins.get(sessionId);
                if (session) {
                    session.status = 'success';

                    // Add to connected accounts
                    if (!connectedAccounts.has(workspaceId)) {
                        connectedAccounts.set(workspaceId, []);
                    }
                    connectedAccounts.get(workspaceId).push({
                        id: sessionId,
                        name: 'Zalo User',
                        connectedAt: new Date().toISOString(),
                        client,
                    });

                    // Sync Zalo friends as contacts (non-blocking with error handling)
                    const api = client.getAPI();
                    if (api) {
                        syncZaloFriends(workspaceId, api)
                            .then((result) => console.log('[ZaloPersonal] Friend sync completed:', result))
                            .catch((err) => console.error('[ZaloPersonal] Friend sync error:', err.message));
                    }

                    // Start message listener to receive incoming messages
                    console.log('[ZaloPersonal] Starting message listener for workspace:', workspaceId);
                    const selfUserId = client.getSelfUserId();
                    console.log('[ZaloPersonal] Self User ID for direction detection:', selfUserId);

                    try {
                        client.startListener(async (message) => {
                            console.log('[ZaloPersonal] Message received:', JSON.stringify(message).substring(0, 200));

                            // Process and save message to database
                            try {
                                await processIncomingMessage(workspaceId, sessionId, message, selfUserId);
                                console.log('[ZaloPersonal] Message saved to database');
                            } catch (e) {
                                console.error('[ZaloPersonal] Error processing message:', e.message);
                            }
                        });
                    } catch (listenerErr) {
                        console.error('[ZaloPersonal] Error starting listener:', listenerErr.message);
                    }
                }
            } catch (loginHandlerErr) {
                console.error('[ZaloPersonal] CRITICAL: Error in login success handler:', loginHandlerErr);
                console.error('[ZaloPersonal] Stack:', loginHandlerErr.stack);
            }

        }).catch((err) => {
            console.error('[ZaloPersonal] Login wait error:', err.message);
            const session = pendingLogins.get(sessionId);
            if (session) {
                session.status = 'failed';
                session.error = err.message;
            }
        });

        return {
            sessionId,
            qrData: null, // QR is sent via Socket.IO
            expiresAt: pendingLogins.get(sessionId)?.expiresAt,
            message: 'QR code will be sent via Socket.IO event "zalo:qr_code"',
        };

    } catch (error) {
        console.error('[ZaloPersonal] QR generation error:', error);

        // Cleanup on error
        await removeClient(workspaceId);
        pendingLogins.delete(sessionId);

        throw error;
    }
};

/**
 * Check QR login session status
 */
const getSessionStatus = async (sessionId) => {
    const session = pendingLogins.get(sessionId);

    if (!session) {
        return { status: 'not_found' };
    }

    // Check expiry
    if (Date.now() > session.expiresAt) {
        // Cleanup
        await removeClient(session.workspaceId);
        pendingLogins.delete(sessionId);
        return { status: 'expired' };
    }

    if (session.status === 'success') {
        return {
            status: 'success',
            account: {
                name: 'Zalo User',
                connectedAt: new Date().toISOString(),
            },
        };
    }

    return {
        status: session.status,
        error: session.error,
    };
};

/**
 * Refresh QR code for a session
 * With Puppeteer approach, we just need to re-capture the QR
 */
const refreshQR = async (sessionId) => {
    const session = pendingLogins.get(sessionId);

    if (!session) {
        throw new Error('Session not found');
    }

    const client = session.client;
    if (!client) {
        throw new Error('Client not initialized');
    }

    try {
        // Re-capture QR (page should still be open)
        await client.getQR();

        session.expiresAt = Date.now() + 10 * 60 * 1000;
        session.status = 'waiting_scan';

        return {
            expiresAt: session.expiresAt,
            message: 'QR refreshed, new code sent via Socket.IO',
        };
    } catch (error) {
        console.error('[ZaloPersonal] Refresh QR error:', error.message);
        throw error;
    }
};

/**
 * Get connected Zalo accounts for a workspace
 */
const getConnectedAccounts = async (workspaceId) => {
    const accounts = connectedAccounts.get(workspaceId) || [];

    return accounts.map((acc) => ({
        id: acc.id,
        name: acc.name,
        connectedAt: acc.connectedAt,
        status: 'connected',
    }));
};

/**
 * Disconnect a Zalo account
 */
const disconnectAccount = async (workspaceId, accountId) => {
    const accounts = connectedAccounts.get(workspaceId) || [];
    const index = accounts.findIndex((acc) => acc.id === accountId);

    if (index === -1) {
        throw new Error('Account not found');
    }

    // Destroy the client
    const account = accounts[index];
    if (account.client) {
        await account.client.destroy();
    }

    accounts.splice(index, 1);

    // Also remove from pending if exists
    pendingLogins.delete(accountId);

    return { success: true };
};

/**
 * Cleanup expired pending sessions
 */
const cleanupExpiredSessions = async () => {
    const now = Date.now();
    for (const [sessionId, session] of pendingLogins.entries()) {
        if (now > session.expiresAt && session.status !== 'success') {
            console.log('[ZaloPersonal] Cleaning up expired session:', sessionId);
            await removeClient(session.workspaceId);
            pendingLogins.delete(sessionId);
        }
    }
};

// Cleanup every 5 minutes
setInterval(cleanupExpiredSessions, 5 * 60 * 1000);

/**
 * Check if a Zalo account connection is still active
 */
const checkConnection = async (workspaceId, accountId) => {
    const accounts = connectedAccounts.get(workspaceId) || [];
    const account = accounts.find((acc) => acc.id === accountId);

    if (!account) {
        return { connected: false, error: 'Account not found' };
    }

    if (!account.client) {
        return { connected: false, error: 'Client not initialized' };
    }

    try {
        // Check if the client is still logged in
        const isLoggedIn = await account.client.isLoggedIn();
        return {
            connected: isLoggedIn,
            lastChecked: new Date().toISOString(),
        };
    } catch (error) {
        console.error('[ZaloPersonal] Check connection error:', error.message);
        return { connected: false, error: error.message };
    }
};

/**
 * Update account information (nickname)
 */
const updateAccount = async (workspaceId, accountId, data) => {
    const accounts = connectedAccounts.get(workspaceId) || [];
    const account = accounts.find((acc) => acc.id === accountId);

    if (!account) {
        throw new Error('Account not found');
    }

    // Update nickname
    if (data.name) {
        account.name = data.name;
    }

    return {
        id: account.id,
        name: account.name,
        connectedAt: account.connectedAt,
        status: 'connected',
    };
};

module.exports = {
    generateQRSession,
    getSessionStatus,
    refreshQR,
    getConnectedAccounts,
    disconnectAccount,
    checkConnection,
    updateAccount,
    importCookieSession,
};
