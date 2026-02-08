const { getPool } = require('../../../infra/mysql/mysql');

const insertWebhook = async (workspaceKey, data) => {
    const pool = getPool();
    const [result] = await pool.execute(
        `INSERT INTO channels_Webhooks (WorkspaceKey, Name, Url, Secret, Events)
     VALUES (?, ?, ?, ?, ?)`,
        [workspaceKey, data.name, data.url, data.secret || null, JSON.stringify(data.events || [])]
    );
    const [rows] = await pool.execute(
        'SELECT WebhookKey, WebhookId, Name, Url, Events, Status, CreatedAt FROM channels_Webhooks WHERE WebhookKey = ?',
        [result.insertId]
    );
    return rows[0];
};

const findByWorkspace = async (workspaceKey) => {
    const [rows] = await getPool().execute(
        `SELECT WebhookKey, WebhookId, Name, Url, Secret, Events, Status,
            LastTriggeredAt, SuccessCount, FailCount, LastError, CreatedAt, UpdatedAt
     FROM channels_Webhooks WHERE WorkspaceKey = ? ORDER BY CreatedAt DESC`,
        [workspaceKey]
    );
    return rows;
};

const findByWebhookId = async (webhookId) => {
    const [rows] = await getPool().execute(
        `SELECT WebhookKey, WebhookId, WorkspaceKey, Name, Url, Secret, Events, Status,
            LastTriggeredAt, SuccessCount, FailCount, LastError, CreatedAt, UpdatedAt
     FROM channels_Webhooks WHERE WebhookId = ?`,
        [webhookId]
    );
    return rows[0] || null;
};

const findActiveByEvent = async (workspaceKey, eventType) => {
    const [rows] = await getPool().execute(
        `SELECT WebhookKey, WebhookId, Name, Url, Secret, Events
     FROM channels_Webhooks WHERE WorkspaceKey = ? AND Status = 1 AND Events LIKE ?`,
        [workspaceKey, `%"${eventType}"%`]
    );
    return rows;
};

const updateWebhook = async (webhookKey, data) => {
    const updates = [];
    const params = [];

    if (data.name !== undefined) { updates.push('Name = ?'); params.push(data.name); }
    if (data.url !== undefined) { updates.push('Url = ?'); params.push(data.url); }
    if (data.secret !== undefined) { updates.push('Secret = ?'); params.push(data.secret); }
    if (data.events !== undefined) { updates.push('Events = ?'); params.push(JSON.stringify(data.events)); }
    if (data.status !== undefined) { updates.push('Status = ?'); params.push(data.status); }
    if (updates.length === 0) return null;

    updates.push('UpdatedAt = UTC_TIMESTAMP(3)');
    params.push(webhookKey);
    await getPool().execute(`UPDATE channels_Webhooks SET ${updates.join(', ')} WHERE WebhookKey = ?`, params);

    const [rows] = await getPool().execute(
        'SELECT WebhookKey, WebhookId, Name, Url, Events, Status, UpdatedAt FROM channels_Webhooks WHERE WebhookKey = ?',
        [webhookKey]
    );
    return rows[0];
};

const recordTrigger = async (webhookKey, success, error = null) => {
    if (success) {
        await getPool().execute(
            `UPDATE channels_Webhooks SET LastTriggeredAt = UTC_TIMESTAMP(3), SuccessCount = SuccessCount + 1,
       FailCount = 0, LastError = NULL, Status = 1 WHERE WebhookKey = ?`,
            [webhookKey]
        );
    } else {
        await getPool().execute(
            `UPDATE channels_Webhooks SET LastTriggeredAt = UTC_TIMESTAMP(3), FailCount = FailCount + 1,
       LastError = ?, Status = CASE WHEN FailCount >= 4 THEN 3 ELSE Status END WHERE WebhookKey = ?`,
            [error, webhookKey]
        );
    }
};

const insertLog = async (webhookKey, eventType, payload, response) => {
    await getPool().execute(
        `INSERT INTO channels_WebhookLogs (WebhookKey, EventType, Payload, ResponseStatus, ResponseBody, ResponseTime, Success, Error)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [webhookKey, eventType, JSON.stringify(payload), response.status || null,
            response.body || null, response.time || null, response.success ? 1 : 0, response.error || null]
    );
};

const getLogs = async (webhookKey, limit = 50, offset = 0) => {
    const [rows] = await getPool().execute(
        `SELECT LogKey, EventType, ResponseStatus, ResponseTime, Success, Error, CreatedAt
     FROM channels_WebhookLogs WHERE WebhookKey = ? ORDER BY CreatedAt DESC LIMIT ? OFFSET ?`,
        [webhookKey, limit, offset]
    );
    return rows;
};

const deleteWebhook = async (webhookKey) => {
    await getPool().execute('DELETE FROM channels_Webhooks WHERE WebhookKey = ?', [webhookKey]);
};

module.exports = { insertWebhook, findByWorkspace, findByWebhookId, findActiveByEvent, updateWebhook, recordTrigger, insertLog, getLogs, deleteWebhook };
