const express = require('express');
const router = express.Router();
const instagramController = require('./instagram.controller');
const { requireWorkspace } = require('../../middlewares/workspace.middleware');

// Webhook endpoints (no auth required)
router.get('/webhook', instagramController.verifyWebhook);
router.post('/webhook', instagramController.handleWebhook);

// OAuth callback (no workspace context - state contains workspaceId)
router.get('/oauth/callback', instagramController.oauthCallback);

// Protected routes - require workspace context
router.use(requireWorkspace);

// OAuth
router.get('/oauth/url', instagramController.getOAuthUrl);
router.post('/available', instagramController.getAvailableAccounts);
router.post('/connect', instagramController.connectAccount);

// Account management
router.get('/accounts', instagramController.getAccounts);
router.delete('/accounts/:accountId', instagramController.disconnectAccount);
router.patch('/accounts/:accountId/settings', instagramController.updateSettings);

module.exports = router;
