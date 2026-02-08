const crypto = require('crypto');
const axios = require('axios');
const webhookRepo = require('./repos/webhook.repo');

/**
 * Available webhook event types
 */
const WEBHOOK_EVENTS = {
    MESSAGE_NEW: 'message.new',
    MESSAGE_SENT: 'message.sent',
    CONVERSATION_OPENED: 'conversation.opened',
    CONVERSATION_CLOSED: 'conversation.closed',
    CONVERSATION_ASSIGNED: 'conversation.assigned',
    LEAD_STAGE_CHANGED: 'lead.stage_changed',
    VISITOR_IDENTIFIED: 'visitor.identified'
};

const WEBHOOK_STATUS = {
    ACTIVE: 1,
    PAUSED: 2,
    FAILED: 3
};

/**
 * Generate HMAC-SHA256 signature for webhook payload
 */
const generateSignature = (secret, payload) => {
    if (!secret) return null;
    const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);
    return crypto.createHmac('sha256', secret).update(payloadString).digest('hex');
};

/**
 * Create a new webhook
 */
const createWebhook = async (workspaceKey, data) => {
    // Validate URL
    try {
        new URL(data.url);
    } catch (e) {
        throw new Error('Invalid webhook URL');
    }

    // Validate events
    const validEvents = Object.values(WEBHOOK_EVENTS);
    const events = data.events || [];
    for (const event of events) {
        if (!validEvents.includes(event)) {
            throw new Error(`Invalid event type: ${event}`);
        }
    }

    if (events.length === 0) {
        throw new Error('At least one event must be selected');
    }

    // Generate secret if not provided
    const secret = data.secret || crypto.randomBytes(32).toString('hex');

    return await webhookRepo.insertWebhook(workspaceKey, {
        name: data.name || 'Webhook',
        url: data.url,
        secret,
        events
    });
};

/**
 * Get all webhooks for a workspace
 */
const getWebhooks = async (workspaceKey) => {
    const webhooks = await webhookRepo.findByWorkspace(workspaceKey);
    return webhooks.map(formatWebhook);
};

/**
 * Get single webhook by ID
 */
const getWebhookById = async (webhookId) => {
    const webhook = await webhookRepo.findByWebhookId(webhookId);
    return webhook ? formatWebhook(webhook) : null;
};

/**
 * Format webhook for API response
 */
const formatWebhook = (webhook) => ({
    webhookId: webhook.WebhookId,
    webhookKey: webhook.WebhookKey,
    name: webhook.Name,
    url: webhook.Url,
    secret: webhook.Secret ? '••••••••' : null, // Mask secret
    secretRaw: webhook.Secret, // Only for internal use
    events: JSON.parse(webhook.Events || '[]'),
    status: webhook.Status,
    statusText: getStatusText(webhook.Status),
    lastTriggeredAt: webhook.LastTriggeredAt,
    successCount: webhook.SuccessCount,
    failCount: webhook.FailCount,
    lastError: webhook.LastError,
    createdAt: webhook.CreatedAt,
    updatedAt: webhook.UpdatedAt
});

/**
 * Get status text
 */
const getStatusText = (status) => {
    switch (status) {
        case WEBHOOK_STATUS.ACTIVE: return 'Hoạt động';
        case WEBHOOK_STATUS.PAUSED: return 'Tạm dừng';
        case WEBHOOK_STATUS.FAILED: return 'Lỗi (tự động tắt)';
        default: return 'Không xác định';
    }
};

/**
 * Update a webhook
 */
const updateWebhook = async (workspaceKey, webhookId, data) => {
    const webhook = await webhookRepo.findByWebhookId(webhookId);
    if (!webhook || webhook.WorkspaceKey !== workspaceKey) {
        throw new Error('Webhook not found');
    }

    const updated = await webhookRepo.updateWebhook(webhook.WebhookKey, data);
    return formatWebhook(updated);
};

/**
 * Delete a webhook
 */
const deleteWebhook = async (workspaceKey, webhookId) => {
    const webhook = await webhookRepo.findByWebhookId(webhookId);
    if (!webhook || webhook.WorkspaceKey !== workspaceKey) {
        throw new Error('Webhook not found');
    }

    await webhookRepo.deleteWebhook(webhook.WebhookKey);
};

/**
 * Toggle webhook status (pause/resume)
 */
const toggleWebhook = async (workspaceKey, webhookId) => {
    const webhook = await webhookRepo.findByWebhookId(webhookId);
    if (!webhook || webhook.WorkspaceKey !== workspaceKey) {
        throw new Error('Webhook not found');
    }

    const newStatus = webhook.Status === WEBHOOK_STATUS.ACTIVE
        ? WEBHOOK_STATUS.PAUSED
        : WEBHOOK_STATUS.ACTIVE;

    const updated = await webhookRepo.updateWebhook(webhook.WebhookKey, { status: newStatus });
    return formatWebhook(updated);
};

/**
 * Dispatch webhook event to all matching webhooks
 */
const dispatchEvent = async (workspaceKey, eventType, data) => {
    const webhooks = await webhookRepo.findActiveByEvent(workspaceKey, eventType);

    if (webhooks.length === 0) {
        return { dispatched: 0 };
    }

    const payload = {
        event: eventType,
        timestamp: new Date().toISOString(),
        data
    };

    const results = await Promise.allSettled(
        webhooks.map(webhook => dispatchToWebhook(webhook, eventType, payload))
    );

    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.length - successful;

    return { dispatched: results.length, successful, failed };
};

/**
 * Dispatch payload to a single webhook
 */
const dispatchToWebhook = async (webhook, eventType, payload) => {
    const startTime = Date.now();
    const payloadString = JSON.stringify(payload);
    const signature = generateSignature(webhook.Secret, payloadString);

    try {
        const response = await axios.post(webhook.Url, payload, {
            headers: {
                'Content-Type': 'application/json',
                'X-LiveChat-Event': eventType,
                'X-LiveChat-Signature': signature,
                'X-LiveChat-Timestamp': payload.timestamp
            },
            timeout: 30000, // 30 second timeout
            validateStatus: () => true // Don't throw on non-2xx
        });

        const responseTime = Date.now() - startTime;
        const success = response.status >= 200 && response.status < 300;

        // Log the call
        await webhookRepo.insertLog(webhook.WebhookKey, eventType, payload, {
            status: response.status,
            body: typeof response.data === 'string'
                ? response.data.substring(0, 1000)
                : JSON.stringify(response.data).substring(0, 1000),
            time: responseTime,
            success,
            error: success ? null : `HTTP ${response.status}`
        });

        // Update webhook stats
        await webhookRepo.recordTrigger(webhook.WebhookKey, success,
            success ? null : `HTTP ${response.status}`);

        return { success, status: response.status, time: responseTime };
    } catch (error) {
        const responseTime = Date.now() - startTime;
        const errorMessage = error.code === 'ECONNABORTED'
            ? 'Timeout (>30s)'
            : error.message;

        // Log the failure
        await webhookRepo.insertLog(webhook.WebhookKey, eventType, payload, {
            status: null,
            body: null,
            time: responseTime,
            success: false,
            error: errorMessage
        });

        // Update webhook stats
        await webhookRepo.recordTrigger(webhook.WebhookKey, false, errorMessage);

        return { success: false, error: errorMessage, time: responseTime };
    }
};

/**
 * Test a webhook by sending a sample payload
 */
const testWebhook = async (workspaceKey, webhookId) => {
    const webhook = await webhookRepo.findByWebhookId(webhookId);
    if (!webhook || webhook.WorkspaceKey !== workspaceKey) {
        throw new Error('Webhook not found');
    }

    const testPayload = {
        event: 'test',
        timestamp: new Date().toISOString(),
        data: {
            message: 'This is a test webhook from LiveChat',
            webhookId: webhook.WebhookId
        }
    };

    const result = await dispatchToWebhook(webhook, 'test', testPayload);
    return result;
};

/**
 * Get webhook logs
 */
const getWebhookLogs = async (workspaceKey, webhookId, limit = 50, offset = 0) => {
    const webhook = await webhookRepo.findByWebhookId(webhookId);
    if (!webhook || webhook.WorkspaceKey !== workspaceKey) {
        throw new Error('Webhook not found');
    }

    const logs = await webhookRepo.getLogs(webhook.WebhookKey, limit, offset);
    return logs.map(log => ({
        eventType: log.EventType,
        status: log.ResponseStatus,
        responseTime: log.ResponseTime,
        success: log.Success,
        error: log.Error,
        createdAt: log.CreatedAt
    }));
};

/**
 * Get reveal secret (for copying)
 */
const revealSecret = async (workspaceKey, webhookId) => {
    const webhook = await webhookRepo.findByWebhookId(webhookId);
    if (!webhook || webhook.WorkspaceKey !== workspaceKey) {
        throw new Error('Webhook not found');
    }
    return webhook.Secret;
};

module.exports = {
    WEBHOOK_EVENTS,
    WEBHOOK_STATUS,
    generateSignature,
    createWebhook,
    getWebhooks,
    getWebhookById,
    updateWebhook,
    deleteWebhook,
    toggleWebhook,
    dispatchEvent,
    testWebhook,
    getWebhookLogs,
    revealSecret
};
