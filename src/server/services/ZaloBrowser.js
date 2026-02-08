/**
 * ZaloBrowser Service
 * zca-js based Zalo login automation
 */

const { Zalo } = require('zca-js');
const fs = require('fs');
const path = require('path');

// Session/credentials file path
const DATA_DIR = path.join(__dirname, '../../data');
const CREDENTIALS_FILE = path.join(DATA_DIR, 'zalo_credentials.json');
const QR_FILE = path.join(process.cwd(), 'qr.png'); // zca-js creates qr.png in cwd

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

/**
 * ZaloClient class using zca-js library
 */
class ZaloClient {
    constructor(sessionId, workspaceId, io = null) {
        this.sessionId = sessionId;
        this.workspaceId = workspaceId;
        this.io = io;
        this.zalo = null;
        this.api = null;
        this._isLoggedIn = false;
        this.destroyed = false;
        this.qrWatcher = null;
        this.qrEmitted = false;
        this.selfUserId = null; // Store connected account's Zalo ID
    }

    /**
     * Initialize Zalo instance
     */
    async init() {
        console.log(`[ZaloBrowser] Initializing zca-js for session: ${this.sessionId}`);

        try {
            this.zalo = new Zalo();
            console.log('[ZaloBrowser] zca-js instance created');
            return true;
        } catch (error) {
            console.error('[ZaloBrowser] Init error:', error.message);
            throw error;
        }
    }

    /**
     * Watch for QR file and emit via Socket.IO
     */
    _startQRFileWatcher() {
        console.log('[ZaloBrowser] Starting QR file watcher...');

        // Clear old QR file if exists
        if (fs.existsSync(QR_FILE)) {
            try { fs.unlinkSync(QR_FILE); } catch (e) { }
        }

        // Poll for QR file creation
        const checkQR = setInterval(() => {
            if (this.destroyed || this.qrEmitted) {
                clearInterval(checkQR);
                return;
            }

            if (fs.existsSync(QR_FILE)) {
                try {
                    const qrBuffer = fs.readFileSync(QR_FILE);
                    const qrBase64 = `data:image/png;base64,${qrBuffer.toString('base64')}`;

                    if (this.io && !this.qrEmitted) {
                        this.io.emit('zalo:qr_code', {
                            sessionId: this.sessionId,
                            qrBase64: qrBase64,
                            expiresAt: Date.now() + 5 * 60 * 1000,
                            timestamp: Date.now(),
                        });
                        console.log('[ZaloBrowser] QR emitted via Socket.IO');
                        this.qrEmitted = true;
                    }
                } catch (err) {
                    console.error('[ZaloBrowser] Error reading QR file:', err.message);
                }
            }
        }, 500);

        this.qrWatcher = checkQR;
    }

    /**
     * Start QR login flow using zca-js with callback pattern
     * Uses zca-js callback events: QRCodeGenerated, QRCodeExpired, QRCodeScanned, GotLoginInfo
     */
    async startQRLogin() {
        if (!this.zalo || this.destroyed) {
            throw new Error('Zalo instance not initialized');
        }

        console.log('[ZaloBrowser] Starting QR login with zca-js callback pattern...');

        return new Promise((resolve, reject) => {
            let retryCount = 0;
            const maxRetries = 5;

            // Create callback handler for zca-js events
            const qrCallback = (event) => {
                console.log('[ZaloBrowser] QR Event:', event.type, event.data ? 'has data' : 'no data');

                switch (event.type) {
                    case 0: // QRCodeGenerated
                        console.log('[ZaloBrowser] QR Code generated!');

                        // Emit QR code to frontend via Socket.IO
                        if (this.io && event.data && event.data.image) {
                            const qrBase64 = event.data.image.startsWith('data:')
                                ? event.data.image
                                : `data:image/png;base64,${event.data.image}`;

                            this.io.emit('zalo:qr_code', {
                                sessionId: this.sessionId,
                                qrBase64: qrBase64,
                                expiresAt: Date.now() + 100 * 1000, // 100 seconds
                                timestamp: Date.now(),
                            });
                            console.log('[ZaloBrowser] QR emitted via Socket.IO');
                        }

                        // Also save to file for compatibility
                        if (event.actions && event.actions.saveToFile) {
                            event.actions.saveToFile();
                        }
                        break;

                    case 1: // QRCodeExpired
                        console.log('[ZaloBrowser] QR Code expired!');
                        retryCount++;

                        if (this.io) {
                            this.io.emit('zalo:qr_expired', {
                                sessionId: this.sessionId,
                                retryCount: retryCount,
                                timestamp: Date.now(),
                            });
                        }

                        // Auto-retry if not exceeded max retries
                        if (retryCount < maxRetries && event.actions && event.actions.retry) {
                            console.log(`[ZaloBrowser] Auto-retrying QR generation (${retryCount}/${maxRetries})...`);
                            event.actions.retry();
                        } else {
                            console.log('[ZaloBrowser] Max retries exceeded, aborting...');
                            if (event.actions && event.actions.abort) {
                                event.actions.abort();
                            }
                        }
                        break;

                    case 2: // QRCodeScanned
                        console.log('[ZaloBrowser] QR Code scanned! User:', event.data?.display_name);

                        if (this.io) {
                            this.io.emit('zalo:qr_scanned', {
                                sessionId: this.sessionId,
                                displayName: event.data?.display_name,
                                avatar: event.data?.avatar,
                                timestamp: Date.now(),
                            });
                        }
                        break;

                    case 3: // QRCodeDeclined
                        console.log('[ZaloBrowser] QR Code declined by user!');

                        if (this.io) {
                            this.io.emit('zalo:error', {
                                sessionId: this.sessionId,
                                error: 'Đăng nhập bị từ chối trên điện thoại',
                                timestamp: Date.now(),
                            });
                        }

                        // Retry after declined
                        if (event.actions && event.actions.retry) {
                            event.actions.retry();
                        }
                        break;

                    case 4: // GotLoginInfo
                        console.log('[ZaloBrowser] Got login info (cookie, imei, userAgent)');
                        // This event provides credentials for session persistence
                        // The actual login completion is handled in the .then() below
                        break;

                    default:
                        console.log('[ZaloBrowser] Unknown event type:', event.type);
                }
            };

            // Timeout after 10 minutes
            const timeout = setTimeout(() => {
                console.log('[ZaloBrowser] Login timeout after 10 minutes');
                reject(new Error('Login timeout'));
            }, 10 * 60 * 1000);

            // Start login process with callback
            this.zalo.loginQR({}, qrCallback)
                .then(async (api) => {
                    clearTimeout(timeout);

                    if (this.destroyed) {
                        reject(new Error('Session destroyed'));
                        return;
                    }

                    console.log('[ZaloBrowser] Login successful!');
                    this.api = api;
                    this._isLoggedIn = true;

                    // Fetch own account info to get selfUserId
                    try {
                        if (api.fetchAccountInfo) {
                            const accountInfo = await api.fetchAccountInfo();
                            this.selfUserId = accountInfo?.userId || accountInfo?.uid || accountInfo?.id;
                            console.log('[ZaloBrowser] Self User ID:', this.selfUserId);
                        }
                    } catch (err) {
                        console.warn('[ZaloBrowser] Could not fetch account info:', err.message);
                    }

                    // Save credentials for session persistence
                    this._saveCredentials();

                    // Emit success to frontend
                    if (this.io) {
                        this.io.emit('zalo:login_success', {
                            sessionId: this.sessionId,
                            workspaceId: this.workspaceId,
                            account: {
                                name: 'Zalo User',
                                connectedAt: new Date().toISOString(),
                                selfUserId: this.selfUserId,
                            },
                        });
                    }

                    resolve(api);
                })
                .catch((error) => {
                    clearTimeout(timeout);
                    console.error('[ZaloBrowser] Login error:', error.message);

                    if (this.io) {
                        this.io.emit('zalo:error', {
                            sessionId: this.sessionId,
                            error: error.message,
                            timestamp: Date.now(),
                        });
                    }

                    reject(error);
                });
        });
    }

    /**
     * Stop QR file watcher
     */
    _stopQRFileWatcher() {
        if (this.qrWatcher) {
            clearInterval(this.qrWatcher);
            this.qrWatcher = null;
        }
    }

    /**
     * Get QR code - starts the login flow
     * Kept for backward compatibility with existing code
     */
    async getQR() {
        return this.startQRLogin();
    }

    /**
     * Wait for login - kept for backward compatibility
     * The actual waiting is done in startQRLogin
     */
    async waitForLogin() {
        if (this._isLoggedIn) {
            return true;
        }
        // Login happens in startQRLogin, this is just for compatibility
        return new Promise((resolve) => {
            const checkInterval = setInterval(() => {
                if (this._isLoggedIn || this.destroyed) {
                    clearInterval(checkInterval);
                    resolve(this._isLoggedIn);
                }
            }, 1000);
        });
    }

    /**
     * Save session data (cookie) to file for session persistence
     * zca-js v2 uses getCookie() for session export
     */
    _saveCredentials() {
        try {
            if (!this.api) return;

            // Try getCookie first (zca-js v2 standard)
            let sessionData = null;

            if (typeof this.api.getCookie === 'function') {
                sessionData = this.api.getCookie();
                console.log('[ZaloBrowser] Got cookie from API');
            } else if (typeof this.api.getCredentials === 'function') {
                // Fallback for older versions
                sessionData = this.api.getCredentials();
                console.log('[ZaloBrowser] Got credentials from API (fallback)');
            }

            if (!sessionData) {
                console.log('[ZaloBrowser] No session data to save');
                return;
            }

            // Load existing sessions
            let allSessions = {};
            if (fs.existsSync(CREDENTIALS_FILE)) {
                try {
                    const data = fs.readFileSync(CREDENTIALS_FILE, 'utf8');
                    allSessions = JSON.parse(data);
                } catch (e) {
                    console.warn('[ZaloBrowser] Could not parse existing sessions file');
                }
            }

            // Save this workspace's session
            allSessions[this.workspaceId] = {
                cookie: sessionData,
                selfUserId: this.selfUserId,
                connectedAt: new Date().toISOString(),
                sessionId: this.sessionId,
            };

            fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(allSessions, null, 2));
            console.log(`[ZaloBrowser] Session saved for workspace: ${this.workspaceId}`);

        } catch (error) {
            console.error('[ZaloBrowser] Save session error:', error.message);
        }
    }

    /**
     * Load session from file and restore using cookie
     * zca-js v2 uses loginCookie() for session restore
     */
    async loadSession() {
        try {
            if (!fs.existsSync(CREDENTIALS_FILE)) {
                return false;
            }

            const data = fs.readFileSync(CREDENTIALS_FILE, 'utf8');
            const allSessions = JSON.parse(data);
            const savedData = allSessions[this.workspaceId];

            if (!savedData || !savedData.cookie) {
                console.log(`[ZaloBrowser] No saved session for workspace: ${this.workspaceId}`);
                return false;
            }

            console.log(`[ZaloBrowser] Found saved session for workspace: ${this.workspaceId}`);
            console.log(`[ZaloBrowser] Session from: ${savedData.connectedAt}`);

            // Initialize Zalo if not done
            if (!this.zalo) {
                this.zalo = new Zalo();
            }

            // Try loginCookie first (zca-js v2 standard)
            if (typeof this.zalo.loginCookie === 'function') {
                console.log('[ZaloBrowser] Attempting loginCookie...');
                this.api = await this.zalo.loginCookie(savedData.cookie);
                this._isLoggedIn = true;
                this.selfUserId = savedData.selfUserId;
                console.log('[ZaloBrowser] Session restored via loginCookie');

                // Re-save to refresh session data
                this._saveCredentials();
                return true;
            }

            // Fallback for older versions
            if (typeof this.zalo.loginCredentials === 'function') {
                console.log('[ZaloBrowser] Attempting loginCredentials (fallback)...');
                this.api = await this.zalo.loginCredentials(savedData.cookie);
                this._isLoggedIn = true;
                this.selfUserId = savedData.selfUserId;
                console.log('[ZaloBrowser] Session restored via loginCredentials');
                return true;
            }

            console.warn('[ZaloBrowser] No login method available for session restore');
            return false;

        } catch (error) {
            console.error('[ZaloBrowser] Load session error:', error.message);
            // Remove invalid session
            this._removeSession();
            return false;
        }
    }

    /**
     * Remove saved session for this workspace
     */
    _removeSession() {
        try {
            if (!fs.existsSync(CREDENTIALS_FILE)) return;

            const data = fs.readFileSync(CREDENTIALS_FILE, 'utf8');
            const allSessions = JSON.parse(data);

            if (allSessions[this.workspaceId]) {
                delete allSessions[this.workspaceId];
                fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(allSessions, null, 2));
                console.log(`[ZaloBrowser] Removed invalid session for: ${this.workspaceId}`);
            }
        } catch (e) {
            console.error('[ZaloBrowser] Remove session error:', e.message);
        }
    }

    /**
     * Get the logged-in API instance
     */
    getAPI() {
        return this.api;
    }

    /**
     * Check if client is logged in (async method for API)
     */
    async isLoggedIn() {
        // Return the isLoggedIn property value
        return this._isLoggedIn === true;
    }

    /**
     * Get the connected account's Zalo user ID
     */
    getSelfUserId() {
        return this.selfUserId;
    }

    /**
     * Start message listener
     */
    startListener(messageHandler) {
        console.log('[ZaloBrowser] Attempting to start message listener...');
        console.log('[ZaloBrowser] API exists:', !!this.api);
        console.log('[ZaloBrowser] API listener exists:', !!this.api?.listener);

        if (!this.api) {
            console.error('[ZaloBrowser] Cannot start listener - API not initialized');
            return false;
        }

        if (!this.api.listener) {
            console.error('[ZaloBrowser] Cannot start listener - listener not available on API');
            console.log('[ZaloBrowser] Available API methods:', Object.keys(this.api));
            return false;
        }

        try {
            this.api.listener.on('message', (message) => {
                console.log('[ZaloBrowser] ======= MESSAGE RECEIVED =======');
                console.log('[ZaloBrowser] Message type:', message?.type || 'unknown');
                console.log('[ZaloBrowser] Thread ID:', message?.threadId || message?.data?.uidFrom || 'unknown');
                console.log('[ZaloBrowser] Content preview:', JSON.stringify(message).substring(0, 300));

                if (messageHandler) {
                    messageHandler(message);
                }
                // DISABLED: Global emit causes duplicate messages
                // Messages are now only emitted through zalo-message-handler.js
                // which sends to proper room-based events
                // if (this.io) {
                //     this.io.emit('zalo:message', {
                //         sessionId: this.sessionId,
                //         message,
                //         timestamp: Date.now(),
                //     });
                // }
            });

            this.api.listener.start();
            console.log('[ZaloBrowser] Message listener started successfully!');
            return true;
        } catch (error) {
            console.error('[ZaloBrowser] Error starting listener:', error.message);
            return false;
        }
    }

    /**
     * Send a message
     */
    async sendMessage(threadId, message, threadType = 'User') {
        if (!this.api) {
            throw new Error('Not logged in');
        }

        return await this.api.sendMessage(
            { msg: message },
            threadId,
            threadType
        );
    }

    /**
     * Destroy client and cleanup
     */
    async destroy() {
        console.log(`[ZaloBrowser] Destroying session: ${this.sessionId}`);
        this.destroyed = true;
        this._stopQRFileWatcher();

        if (this.api && this.api.listener) {
            try {
                this.api.listener.stop();
            } catch (e) {
                console.error('[ZaloBrowser] Listener stop error:', e.message);
            }
        }

        this.zalo = null;
        this.api = null;
    }

    /**
     * Login with J2TEAM format cookies (BotzaloNDQ pattern)
     * @param {Object} credentials - { cookie: J2TEAM JSON, imei: z_uuid, userAgent: browser UA }
     * @returns {Promise<boolean>} Login success
     */
    async loginWithCookie(credentials) {
        const { cookie, imei, userAgent } = credentials;

        if (!cookie) {
            throw new Error('Cookie is required');
        }

        console.log('[ZaloBrowser] Attempting login with J2TEAM cookie format...');

        // Parse J2TEAM cookie format to string format
        let cookieString = cookie;
        if (typeof cookie === 'object') {
            if (cookie.cookies && Array.isArray(cookie.cookies)) {
                // J2TEAM format: { url: "...", cookies: [...] }
                cookieString = cookie.cookies
                    .map(c => `${c.name}=${c.value}`)
                    .join('; ');
                console.log('[ZaloBrowser] Parsed J2TEAM cookies to string format');
            } else if (Array.isArray(cookie)) {
                // Array of cookies
                cookieString = cookie
                    .map(c => `${c.name}=${c.value}`)
                    .join('; ');
            }
        }

        if (!this.zalo) {
            this.zalo = new Zalo();
        }

        try {
            // Try zca-js loginCookie with parsed string
            if (typeof this.zalo.loginCookie === 'function') {
                this.api = await this.zalo.loginCookie({
                    cookie: cookieString,
                    imei: imei || undefined,
                    userAgent: userAgent || undefined
                });
            } else {
                // Fallback: just use cookie string
                this.api = await this.zalo.loginCookie(cookieString);
            }

            this._isLoggedIn = true;

            // Fetch self user ID
            try {
                if (this.api.fetchAccountInfo) {
                    const accountInfo = await this.api.fetchAccountInfo();
                    this.selfUserId = accountInfo?.userId || accountInfo?.uid || accountInfo?.id;
                } else if (this.api.getOwnId) {
                    this.selfUserId = await this.api.getOwnId();
                }
                console.log('[ZaloBrowser] Self User ID:', this.selfUserId);
            } catch (err) {
                console.warn('[ZaloBrowser] Could not fetch account info:', err.message);
            }

            // Save credentials for persistence
            this._saveCredentials();

            // Emit success if IO available
            if (this.io) {
                this.io.emit('zalo:login_success', {
                    sessionId: this.sessionId,
                    workspaceId: this.workspaceId,
                    account: {
                        name: 'Zalo User (Cookie)',
                        connectedAt: new Date().toISOString(),
                        selfUserId: this.selfUserId,
                        loginMethod: 'cookie'
                    },
                });
            }

            console.log('[ZaloBrowser] Cookie login successful!');
            return true;

        } catch (error) {
            console.error('[ZaloBrowser] Cookie login error:', error.message);

            if (this.io) {
                this.io.emit('zalo:error', {
                    sessionId: this.sessionId,
                    error: 'Cookie login failed: ' + error.message,
                    timestamp: Date.now(),
                });
            }

            throw error;
        }
    }
}

// Store active ZaloClient instances
const activeClients = new Map();

/**
 * Create a new ZaloClient instance
 */
async function createClient(sessionId, workspaceId, io = null) {
    // Cleanup existing client for this workspace if any
    if (activeClients.has(workspaceId)) {
        const oldClient = activeClients.get(workspaceId);
        await oldClient.destroy();
    }

    const client = new ZaloClient(sessionId, workspaceId, io);
    activeClients.set(workspaceId, client);
    return client;
}

/**
 * Get existing client for workspace
 */
function getClient(workspaceId) {
    return activeClients.get(workspaceId);
}

/**
 * Remove client for workspace
 */
async function removeClient(workspaceId) {
    const client = activeClients.get(workspaceId);
    if (client) {
        await client.destroy();
        activeClients.delete(workspaceId);
    }
}

/**
 * Restore all saved Zalo sessions from file
 * Called on server startup to maintain session persistence
 * Uses cookie-based login for zca-js v2
 */
async function restoreAllSessions(io = null) {
    console.log('[ZaloBrowser] Attempting to restore saved sessions...');

    try {
        if (!fs.existsSync(CREDENTIALS_FILE)) {
            console.log('[ZaloBrowser] No saved sessions file found');
            return { restored: 0, failed: 0 };
        }

        const data = fs.readFileSync(CREDENTIALS_FILE, 'utf8');
        const allSessions = JSON.parse(data);
        const workspaceIds = Object.keys(allSessions);

        if (workspaceIds.length === 0) {
            console.log('[ZaloBrowser] No saved sessions found');
            return { restored: 0, failed: 0 };
        }

        console.log(`[ZaloBrowser] Found ${workspaceIds.length} saved session(s) to restore`);

        let restored = 0;
        let failed = 0;
        let cleanedSessions = { ...allSessions };

        for (const workspaceId of workspaceIds) {
            const savedData = allSessions[workspaceId];
            if (!savedData || !savedData.cookie) {
                console.log(`[ZaloBrowser] Skipping ${workspaceId} - no cookie data`);
                continue;
            }

            try {
                console.log(`[ZaloBrowser] Restoring session for workspace: ${workspaceId}`);

                const client = new ZaloClient(savedData.sessionId || `restored_${Date.now()}`, workspaceId, io);
                await client.init();

                // Try loginCookie first (zca-js v2 standard)
                let loginSuccess = false;

                if (typeof client.zalo.loginCookie === 'function') {
                    console.log(`[ZaloBrowser] Using loginCookie for ${workspaceId}`);
                    client.api = await client.zalo.loginCookie(savedData.cookie);
                    loginSuccess = true;
                } else if (typeof client.zalo.loginCredentials === 'function') {
                    console.log(`[ZaloBrowser] Using loginCredentials (fallback) for ${workspaceId}`);
                    client.api = await client.zalo.loginCredentials(savedData.cookie);
                    loginSuccess = true;
                }

                if (loginSuccess && client.api) {
                    client._isLoggedIn = true;
                    client.selfUserId = savedData.selfUserId;

                    // Fetch self user ID if not saved
                    if (!client.selfUserId) {
                        try {
                            if (typeof client.api.fetchAccountInfo === 'function') {
                                const accountInfo = await client.api.fetchAccountInfo();
                                client.selfUserId = accountInfo?.userId || accountInfo?.uid || accountInfo?.id;
                            } else if (typeof client.api.getOwnId === 'function') {
                                client.selfUserId = await client.api.getOwnId();
                            }
                        } catch (e) {
                            console.warn(`[ZaloBrowser] Could not fetch account info for ${workspaceId}:`, e.message);
                        }
                    }

                    console.log(`[ZaloBrowser] Restored session for ${workspaceId}, selfUserId: ${client.selfUserId}`);

                    // Start message listener
                    const { processIncomingMessage } = require('../modules/zalo-personal/zalo-message-handler');
                    const selfUserId = client.getSelfUserId();

                    client.startListener(async (message) => {
                        try {
                            await processIncomingMessage(workspaceId, savedData.sessionId, message, selfUserId);
                        } catch (e) {
                            console.error(`[ZaloBrowser] Error processing message for ${workspaceId}:`, e.message);
                        }
                    });

                    // Re-save to refresh cookie
                    client._saveCredentials();

                    activeClients.set(workspaceId, client);
                    restored++;
                    console.log(`[ZaloBrowser] Session restored successfully for workspace: ${workspaceId}`);
                } else {
                    console.log(`[ZaloBrowser] Cannot restore ${workspaceId} - no login method available`);
                    failed++;
                    delete cleanedSessions[workspaceId];
                }
            } catch (error) {
                console.error(`[ZaloBrowser] Failed to restore session for ${workspaceId}:`, error.message);
                failed++;
                // Remove invalid session
                delete cleanedSessions[workspaceId];
            }
        }

        // Save cleaned up sessions (remove failed ones)
        if (failed > 0) {
            fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(cleanedSessions, null, 2));
            console.log(`[ZaloBrowser] Cleaned up ${failed} invalid session(s)`);
        }

        console.log(`[ZaloBrowser] Session restore complete: ${restored} restored, ${failed} failed`);
        return { restored, failed };

    } catch (error) {
        console.error('[ZaloBrowser] Error restoring sessions:', error.message);
        return { restored: 0, failed: 0 };
    }
}

/**
 * Remove a saved session for a workspace (force re-login)
 * @param {string} workspaceId 
 */
function removeSession(workspaceId) {
    try {
        if (!fs.existsSync(CREDENTIALS_FILE)) return false;

        const data = fs.readFileSync(CREDENTIALS_FILE, 'utf8');
        const allSessions = JSON.parse(data);

        if (allSessions[workspaceId]) {
            delete allSessions[workspaceId];
            fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(allSessions, null, 2));
            console.log(`[ZaloBrowser] Removed stale session for workspace: ${workspaceId}`);

            // Also remove from active clients
            const client = activeClients.get(workspaceId);
            if (client) {
                client._isLoggedIn = false;
                activeClients.delete(workspaceId);
            }

            return true;
        }
        return false;
    } catch (e) {
        console.error('[ZaloBrowser] Remove session error:', e.message);
        return false;
    }
}


module.exports = {
    ZaloClient,
    createClient,
    getClient,
    removeClient,
    removeSession,
    restoreAllSessions,
};
