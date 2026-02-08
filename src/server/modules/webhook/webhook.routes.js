const express = require('express');
const router = express.Router();
const webhookController = require('./webhook.controller');
const { requireWorkspace } = require('../../middlewares/workspace.middleware');

// All routes require workspace context
router.use(requireWorkspace);

// Get available event types
router.get('/events', webhookController.getEventTypes);

// Webhook CRUD
router.get('/', webhookController.getWebhooks);
router.post('/', webhookController.createWebhook);
router.patch('/:webhookId', webhookController.updateWebhook);
router.delete('/:webhookId', webhookController.deleteWebhook);

// Webhook actions
router.post('/:webhookId/toggle', webhookController.toggleWebhook);
router.post('/:webhookId/test', webhookController.testWebhook);
router.get('/:webhookId/logs', webhookController.getWebhookLogs);
router.get('/:webhookId/secret', webhookController.revealSecret);

module.exports = router;
