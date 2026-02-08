const { getPool } = require('../../../infra/mysql/mysql');

const insertMembership = async (workspaceKey, userKey, conn) => {
  const pool = conn || getPool();
  const [result] = await pool.execute(
    'INSERT INTO iam_Memberships (WorkspaceKey, UserKey, Status) VALUES (?, ?, 1)',
    [workspaceKey, userKey]
  );
  const [rows] = await pool.execute('SELECT * FROM iam_Memberships WHERE MembershipKey = ?', [result.insertId]);
  return rows[0];
};

const findByWorkspaceAndUser = async (workspaceKey, userKey) => {
  const [rows] = await getPool().execute(
    'SELECT * FROM iam_Memberships WHERE WorkspaceKey = ? AND UserKey = ?',
    [workspaceKey, userKey]
  );
  return rows[0] || null;
};

const findActiveMembership = async (workspaceKey, userKey) => {
  const [rows] = await getPool().execute(
    `SELECT m.*, w.WorkspaceId, w.Name as WorkspaceName
     FROM iam_Memberships m
     JOIN iam_Workspaces w ON w.WorkspaceKey = m.WorkspaceKey
     WHERE m.WorkspaceKey = ? AND m.UserKey = ? AND m.Status = 1 AND w.Status = 1`,
    [workspaceKey, userKey]
  );
  return rows[0] || null;
};

const findByKey = async (membershipKey) => {
  const [rows] = await getPool().execute(
    `SELECT m.*, w.WorkspaceId, w.Name as WorkspaceName
     FROM iam_Memberships m
     JOIN iam_Workspaces w ON w.WorkspaceKey = m.WorkspaceKey
     WHERE m.MembershipKey = ?`,
    [membershipKey]
  );
  return rows[0] || null;
};

module.exports = { insertMembership, findByWorkspaceAndUser, findActiveMembership, findByKey };
