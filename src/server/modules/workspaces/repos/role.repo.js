const { getPool } = require('../../../infra/mysql/mysql');
const constants = require('../../../config/constants');

const findByName = async (workspaceKey, roleName, conn = null) => {
    const pool = conn || getPool();
    const [rows] = await pool.execute(
        'SELECT * FROM iam_Roles WHERE WorkspaceKey = ? AND Name = ?',
        [workspaceKey, roleName]
    );
    return rows[0] || null;
};

const insertRole = async (workspaceKey, roleName, conn) => {
    const pool = conn || getPool();
    const [result] = await pool.execute(
        'INSERT INTO iam_Roles (WorkspaceKey, Name) VALUES (?, ?)',
        [workspaceKey, roleName]
    );
    const [rows] = await pool.execute('SELECT * FROM iam_Roles WHERE RoleKey = ?', [result.insertId]);
    return rows[0];
};

const getOrCreateOwnerRole = async (workspaceKey, conn) => {
    const existing = await findByName(workspaceKey, 'Owner', conn);
    if (existing) return existing;
    return await insertRole(workspaceKey, 'Owner', conn);
};

const isProtectedRole = (roleName) => {
    return constants.PROTECTED_ROLES.includes(roleName);
};

const getOrCreateDefaultRole = async (workspaceKey, roleName, conn) => {
    const existing = await findByName(workspaceKey, roleName, conn);
    if (existing) return existing;
    return await insertRole(workspaceKey, roleName, conn);
};

module.exports = { findByName, insertRole, getOrCreateOwnerRole, getOrCreateDefaultRole, isProtectedRole };
