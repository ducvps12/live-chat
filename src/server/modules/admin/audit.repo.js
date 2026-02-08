const { getPool } = require('../../infra/mysql/mysql');

const createLog = async ({ action, entityType, entityId, actorKey, actorEmail, ipAddress, userAgent, details, status = 'success' }) => {
    await getPool().execute(
        `INSERT INTO audit_logs (Action, ResourceType, ResourceId, UserKey, IpAddress, UserAgent, Metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [action, entityType || null, entityId || null, actorKey || null, ipAddress || null, userAgent || null, details ? JSON.stringify({ ...details, actorEmail, status }) : JSON.stringify({ actorEmail, status })]
    );
};

const getLogs = async ({ page = 1, limit = 50, action, entityType, actorEmail, status, startDate, endDate }) => {
    const offset = (page - 1) * limit;
    const params = [];
    let whereConditions = ['1=1'];

    if (action) { whereConditions.push('Action = ?'); params.push(action); }
    if (entityType) { whereConditions.push('ResourceType = ?'); params.push(entityType); }
    if (actorEmail) { whereConditions.push('Metadata LIKE ?'); params.push(`%${actorEmail}%`); }
    if (startDate) { whereConditions.push('CreatedAt >= ?'); params.push(new Date(startDate)); }
    if (endDate) { whereConditions.push('CreatedAt <= ?'); params.push(new Date(endDate)); }

    const whereClause = whereConditions.join(' AND ');

    const [rows] = await getPool().execute(
        `SELECT LogKey, LogId, Action, ResourceType AS EntityType, ResourceId AS EntityId,
            UserKey AS ActorKey, IpAddress, UserAgent, Metadata AS Details, CreatedAt
     FROM audit_logs WHERE ${whereClause} ORDER BY CreatedAt DESC LIMIT ? OFFSET ?`,
        [...params, limit, offset]
    );

    const [countRows] = await getPool().execute(
        `SELECT COUNT(*) AS Total FROM audit_logs WHERE ${whereClause}`,
        params
    );

    return {
        logs: rows.map(log => ({ ...log, Details: log.Details ? JSON.parse(log.Details) : null })),
        total: countRows[0].Total, page, limit
    };
};

const getActions = async () => {
    const [rows] = await getPool().execute('SELECT DISTINCT Action FROM audit_logs ORDER BY Action');
    return rows.map(r => r.Action);
};

const getEntityTypes = async () => {
    const [rows] = await getPool().execute('SELECT DISTINCT ResourceType FROM audit_logs WHERE ResourceType IS NOT NULL ORDER BY ResourceType');
    return rows.map(r => r.ResourceType);
};

const getStats = async (days = 7) => {
    const [rows] = await getPool().execute(
        `SELECT Action, COUNT(*) AS Count FROM audit_logs
     WHERE CreatedAt >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? DAY) GROUP BY Action ORDER BY Count DESC`,
        [days]
    );
    return rows;
};

module.exports = { createLog, getLogs, getActions, getEntityTypes, getStats };
