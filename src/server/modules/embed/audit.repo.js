const { getPool } = require('../../infra/mysql/mysql');

const createLog = async ({ workspaceKey, userKey, action, resourceType, resourceId, metadata, ipAddress }) => {
    const [result] = await getPool().execute(
        `INSERT INTO audit_logs (WorkspaceKey, UserKey, Action, ResourceType, ResourceId, Metadata, IpAddress)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [workspaceKey, userKey || null, action, resourceType || null, resourceId || null,
            metadata ? JSON.stringify(metadata) : null, ipAddress || null]
    );
    const [rows] = await getPool().execute(
        'SELECT LogKey, LogId, Action, ResourceType, ResourceId, CreatedAt FROM audit_logs WHERE LogKey = ?',
        [result.insertId]
    );
    return rows[0];
};

const getLogsByWorkspace = async (workspaceId, filters = {}) => {
    const { action, resourceType, dateFrom, dateTo, limit = 100, offset = 0 } = filters;
    const params = [workspaceId];
    let whereClauses = ['w.WorkspaceId = ?'];

    if (action) { whereClauses.push('a.Action = ?'); params.push(action); }
    if (resourceType) { whereClauses.push('a.ResourceType = ?'); params.push(resourceType); }
    if (dateFrom) { whereClauses.push('a.CreatedAt >= ?'); params.push(new Date(dateFrom)); }
    if (dateTo) { whereClauses.push('a.CreatedAt <= ?'); params.push(new Date(dateTo)); }

    params.push(limit, offset);

    const [rows] = await getPool().execute(
        `SELECT a.LogKey as logKey, a.LogId as logId, a.Action as action,
            a.ResourceType as resourceType, a.ResourceId as resourceId,
            a.Metadata as metadata, a.IpAddress as ipAddress, a.CreatedAt as createdAt,
            u.DisplayName as userName, u.Email as userEmail
     FROM audit_logs a
     JOIN iam_Workspaces w ON a.WorkspaceKey = w.WorkspaceKey
     LEFT JOIN iam_Users u ON a.UserKey = u.UserKey
     WHERE ${whereClauses.join(' AND ')}
     ORDER BY a.CreatedAt DESC
     LIMIT ? OFFSET ?`,
        params
    );

    return rows.map(log => ({
        ...log, metadata: log.metadata ? JSON.parse(log.metadata) : null
    }));
};

const AUDIT_ACTIONS = {
    CONVERSATION_CREATED: 'conversation.created',
    CONVERSATION_STATUS_CHANGED: 'conversation.status_changed',
    CONVERSATION_ASSIGNED: 'conversation.assigned',
    CONVERSATION_NOTE_ADDED: 'conversation.note_added',
    CONVERSATION_TAG_ADDED: 'conversation.tag_added',
    CONVERSATION_TAG_REMOVED: 'conversation.tag_removed',
    WIDGET_CREATED: 'widget.created',
    WIDGET_UPDATED: 'widget.updated',
    WIDGET_DELETED: 'widget.deleted',
    MEMBER_INVITED: 'member.invited',
    MEMBER_REMOVED: 'member.removed',
    MEMBER_ROLE_CHANGED: 'member.role_changed',
    WORKSPACE_UPDATED: 'workspace.updated',
};

module.exports = { createLog, getLogsByWorkspace, AUDIT_ACTIONS };
