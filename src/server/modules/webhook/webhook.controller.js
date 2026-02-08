const webhookService = require('./webhook.service');

/**
 * Get all webhooks for workspace
 * GET /api/webhooks
 */
const getWebhooks = async (req, res) => {
    try {
        const { workspaceKey } = req.workspace;
        const webhooks = await webhookService.getWebhooks(workspaceKey);
        res.json({ success: true, webhooks });
    } catch (error) {
        console.error('[Webhook] Get webhooks error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Create new webhook
 * POST /api/webhooks
 */
const createWebhook = async (req, res) => {
    try {
        const { workspaceKey } = req.workspace;
        const { name, url, secret, events } = req.body;

        if (!url) {
            return res.status(400).json({ success: false, error: 'URL is required' });
        }

        const webhook = await webhookService.createWebhook(workspaceKey, {
            name,
            url,
            secret,
            events
        });

        res.json({ success: true, webhook });
    } catch (error) {
        console.error('[Webhook] Create error:', error);
        res.status(400).json({ success: false, error: error.message });
    }
};

/**
 * Update webhook
 * PATCH /api/webhooks/:webhookId
 */
const updateWebhook = async (req, res) => {
    try {
        const { workspaceKey } = req.workspace;
        const { webhookId } = req.params;
        const { name, url, events, status } = req.body;

        const webhook = await webhookService.updateWebhook(workspaceKey, webhookId, {
            name,
            url,
            events,
            status
        });

        res.json({ success: true, webhook });
    } catch (error) {
        console.error('[Webhook] Update error:', error);
        res.status(400).json({ success: false, error: error.message });
    }
};

/**
 * Delete webhook
 * DELETE /api/webhooks/:webhookId
 */
const deleteWebhook = async (req, res) => {
    try {
        const { workspaceKey } = req.workspace;
        const { webhookId } = req.params;

        await webhookService.deleteWebhook(workspaceKey, webhookId);
        res.json({ success: true, message: 'Webhook deleted' });
    } catch (error) {
        console.error('[Webhook] Delete error:', error);
        res.status(400).json({ success: false, error: error.message });
    }
};

/**
 * Toggle webhook status
 * POST /api/webhooks/:webhookId/toggle
 */
const toggleWebhook = async (req, res) => {
    try {
        const { workspaceKey } = req.workspace;
        const { webhookId } = req.params;

        const webhook = await webhookService.toggleWebhook(workspaceKey, webhookId);
        res.json({ success: true, webhook });
    } catch (error) {
        console.error('[Webhook] Toggle error:', error);
        res.status(400).json({ success: false, error: error.message });
    }
};

/**
 * Test webhook
 * POST /api/webhooks/:webhookId/test
 */
const testWebhook = async (req, res) => {
    try {
        const { workspaceKey } = req.workspace;
        const { webhookId } = req.params;

        const result = await webhookService.testWebhook(workspaceKey, webhookId);
        res.json({ success: true, result });
    } catch (error) {
        console.error('[Webhook] Test error:', error);
        res.status(400).json({ success: false, error: error.message });
    }
};

/**
 * Get webhook logs
 * GET /api/webhooks/:webhookId/logs
 */
const getWebhookLogs = async (req, res) => {
    try {
        const { workspaceKey } = req.workspace;
        const { webhookId } = req.params;
        const { limit = 50, offset = 0 } = req.query;

        const logs = await webhookService.getWebhookLogs(
            workspaceKey,
            webhookId,
            parseInt(limit),
            parseInt(offset)
        );

        res.json({ success: true, logs });
    } catch (error) {
        console.error('[Webhook] Get logs error:', error);
        res.status(400).json({ success: false, error: error.message });
    }
};

/**
 * Reveal webhook secret
 * GET /api/webhooks/:webhookId/secret
 */
const revealSecret = async (req, res) => {
    try {
        const { workspaceKey } = req.workspace;
        const { webhookId } = req.params;

        const secret = await webhookService.revealSecret(workspaceKey, webhookId);
        res.json({ success: true, secret });
    } catch (error) {
        console.error('[Webhook] Reveal secret error:', error);
        res.status(400).json({ success: false, error: error.message });
    }
};

/**
 * Get available event types
 * GET /api/webhooks/events
 */
const getEventTypes = async (req, res) => {
    const events = Object.entries(webhookService.WEBHOOK_EVENTS).map(([key, value]) => ({
        key,
        value,
        label: getEventLabel(value)
    }));
    res.json({ success: true, events });
};

const getEventLabel = (event) => {
    const labels = {
        'message.new': 'Tin nhắn mới từ khách',
        'message.sent': 'Tin nhắn đã gửi',
        'conversation.opened': 'Hội thoại được mở',
        'conversation.closed': 'Hội thoại đã đóng',
        'conversation.assigned': 'Hội thoại được gán',
        'lead.stage_changed': 'Thay đổi giai đoạn lead',
        'visitor.identified': 'Khách được xác định'
    };
    return labels[event] || event;
};

module.exports = {
    getWebhooks,
    createWebhook,
    updateWebhook,
    deleteWebhook,
    toggleWebhook,
    testWebhook,
    getWebhookLogs,
    revealSecret,
    getEventTypes
};
