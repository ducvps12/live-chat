const { getPool } = require('../../../infra/mysql/mysql');

const insertWorkspace = async (name, conn) => {
  const pool = conn || getPool();
  const [result] = await pool.execute(
    'INSERT INTO iam_Workspaces (Name, Status) VALUES (?, 1)',
    [name]
  );
  const [rows] = await pool.execute('SELECT * FROM iam_Workspaces WHERE WorkspaceKey = ?', [result.insertId]);
  return rows[0];
};

const findActiveWorkspaces = async (userKey) => {
  const [rows] = await getPool().execute(
    `SELECT w.*
     FROM iam_Workspaces w
     JOIN iam_Memberships m ON w.WorkspaceKey = m.WorkspaceKey
     WHERE m.UserKey = ? AND m.Status = 1 AND w.Status = 1
     ORDER BY w.CreatedAt DESC`,
    [userKey]
  );
  return rows;
};

const findDraftWorkspaces = async (userKey) => {
  const [rows] = await getPool().execute(
    `SELECT w.*
     FROM iam_Workspaces w
     JOIN iam_Memberships m ON w.WorkspaceKey = m.WorkspaceKey
     WHERE m.UserKey = ? AND m.Status = 1 AND w.Status = 0
     ORDER BY w.CreatedAt DESC`,
    [userKey]
  );
  return rows;
};

const updateStatus = async (workspaceKey, status) => {
  await getPool().execute(
    'UPDATE iam_Workspaces SET Status = ?, UpdatedAt = UTC_TIMESTAMP(3) WHERE WorkspaceKey = ?',
    [status, workspaceKey]
  );
};

const canActivate = async (workspaceKey) => {
  const [rows] = await getPool().execute(
    'SELECT COUNT(*) as WidgetCount FROM iam_Widgets WHERE WorkspaceKey = ? AND Status = 1',
    [workspaceKey]
  );
  return rows[0].WidgetCount > 0;
};

const findById = async (workspaceId) => {
  const [rows] = await getPool().execute(
    'SELECT * FROM iam_Workspaces WHERE WorkspaceId = ?',
    [workspaceId]
  );
  return rows[0] || null;
};

const findByKey = async (workspaceKey) => {
  const [rows] = await getPool().execute(
    'SELECT * FROM iam_Workspaces WHERE WorkspaceKey = ?',
    [workspaceKey]
  );
  return rows[0] || null;
};

module.exports = { insertWorkspace, findById, findByKey, findActiveWorkspaces, findDraftWorkspaces, updateStatus, canActivate };
