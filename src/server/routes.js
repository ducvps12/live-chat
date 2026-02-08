const express = require('express');
const router = express.Router();

// Health check endpoint — returns DB connection status
router.get('/health', async (req, res) => {
    try {
        const { checkConnection, getDbStatus } = require('./infra/mysql/mysql');
        const status = await checkConnection();
        res.status(status.connected ? 200 : 503).json({
            status: status.connected ? 'ok' : 'error',
            database: status.connected ? 'connected' : 'disconnected',
            error: status.error || null,
            timestamp: status.lastCheck,
        });
    } catch (err) {
        res.status(503).json({
            status: 'error',
            database: 'disconnected',
            error: err.message,
            timestamp: new Date().toISOString(),
        });
    }
});

// Mount Auth Module
router.use('/auth', require('./modules/auth/auth.routes'));

// Google OAuth helper (for getting Drive tokens)
router.use('/auth', require('./modules/auth/google-oauth.routes'));

// Mount Profile Module
router.use('/profile', require('./modules/profile/profile.routes'));

// Mount Images Module (for retrieving uploaded images)
router.use('/images', require('./modules/images/images.routes'));

// Mount Workspaces Module (no workspace context required)
router.use('/workspaces', require('./modules/workspaces/workspaces.routes'));

// Mount Widgets Module (requires workspace context)
router.use('/widgets', require('./modules/widgets/widgets.routes'));
router.use('/public/widgets', require('./modules/public_widget/publicWidget.routes'));

// Embed module (public, no auth)
router.use('/embed', require('./modules/embed/embed.routes'));

// Legacy: Serve Widget Script at Root (for backwards compatibility)
const publicController = require('./modules/public_widget/publicWidget.controller');
router.get('/widget.js', publicController.getScript);


// Mount Onboarding Module
router.use('/onboarding', require('./modules/onboarding/onboarding.routes'));

// Mount Admin Module (SuperAdmin only)
router.use('/admin', require('./modules/admin/admin.routes'));

// Mount Facebook Integration Module
router.use('/facebook', require('./modules/facebook/facebook.routes'));

// Mount Zalo Personal Module
router.use('/zalo-personal', require('./modules/zalo-personal/zalo-personal.routes'));

// Mount Instagram Integration Module
router.use('/instagram', require('./modules/instagram/instagram.routes'));

// Mount Tickets Module (Kanban)
router.use('/tickets', require('./modules/tickets/tickets.routes'));

// Mount Webhook Module
router.use('/webhooks', require('./modules/webhook/webhook.routes'));

// Mount Call Center Module
router.use('/callcenter', require('./modules/callcenter/callcenter.routes'));

// Mount AI Module
router.use('/ai', require('./modules/ai/ai.routes'));

// Mount WhatsApp Integration Module
router.use('/whatsapp', require('./modules/whatsapp/whatsapp.routes'));

module.exports = router;


