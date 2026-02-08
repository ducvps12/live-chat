const express = require('express');
const router = express.Router();
const controller = require('./facebook.controller');
const authenticate = require('../../middlewares/authenticate');
const resolveWorkspace = require('../../middlewares/resolveWorkspace');

// ============================================
// Public webhook endpoints (no auth required)
// ============================================

// Facebook webhook verification
router.get('/webhook', controller.verifyWebhook);

// Facebook webhook events
router.post('/webhook', controller.handleWebhook);

// ============================================
// OAuth callback (no workspace auth, uses state)
// ============================================

router.get('/oauth/callback', controller.handleOAuthCallback);

// ============================================
// Protected routes (require auth + workspace)
// ============================================

router.use(authenticate);
router.use(resolveWorkspace);

// Get OAuth URL to start Facebook login
router.get('/oauth/url', controller.getOAuthUrl);

// Get connected pages for workspace
router.get('/pages', controller.getConnectedPages);

// Get available pages from Facebook (after OAuth)
router.get('/pages/available', controller.getAvailablePages);

// Connect selected pages
router.post('/pages/connect', controller.connectPages);

// Disconnect a page
router.delete('/pages/:pageId', controller.disconnectPage);

// Update page settings
router.patch('/pages/:pageId/settings', controller.updatePageSettings);

// Send message to Facebook user
router.post('/messages', controller.sendMessageToUser);

module.exports = router;

