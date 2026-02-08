const express = require('express');
const router = express.Router();
const controller = require('./whatsapp.controller');
const authenticate = require('../../middlewares/authenticate');

// ============================================
// WEBHOOK ROUTES (No auth - called by Meta)
// ============================================

// Webhook verification (GET)
router.get('/webhook', controller.verifyWebhook);

// Webhook events (POST)
router.post('/webhook', controller.handleWebhook);

// ============================================
// AUTHENTICATED ROUTES
// ============================================

// Get connected WhatsApp accounts for workspace
router.get('/accounts', authenticate, controller.getAccounts);

// Connect new WhatsApp account (start OAuth)
router.post('/connect', authenticate, controller.connectAccount);

// Complete OAuth callback
router.get('/callback', controller.handleCallback);

// Disconnect account
router.delete('/accounts/:accountId', authenticate, controller.disconnectAccount);

// Send message to user
router.post('/messages', authenticate, controller.sendMessage);

// Get account settings
router.get('/accounts/:accountId/settings', authenticate, controller.getAccountSettings);

// Update account settings
router.patch('/accounts/:accountId/settings', authenticate, controller.updateAccountSettings);

module.exports = router;
