const { getPool } = require('../../../infra/mysql/mysql');

const log = async (event, data, conn = null) => {
    const { actorUserKey = null, actorMembershipKey = null, workspaceKey = null, resourceType = null, resourceKey = null, metadata = null } = data;
    const pool = conn || getPool();

    try {
        await pool.execute(
            `INSERT INTO audit_logs (WorkspaceKey, UserKey, Action, ResourceType, ResourceId, Metadata)
       VALUES (?, ?, ?, ?, ?, ?)`,
            [workspaceKey, actorUserKey, event, resourceType, resourceKey ? String(resourceKey) : null, metadata ? JSON.stringify(metadata) : null]
        );
    } catch (err) {
        console.log('[AUDIT]', { event, actorUserKey, actorMembershipKey, workspaceKey, resourceType, resourceKey, metadata, timestamp: new Date().toISOString() });
    }
};

module.exports = { log };
