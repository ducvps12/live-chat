const { getPool } = require('../../infra/mysql/mysql');
const crypto = require('crypto');

const generateSiteKey = () => {
  return crypto.randomBytes(12).toString('hex');
};

const create = async (workspaceKey, data) => {
  const pool = getPool();

  const siteKey = generateSiteKey();
  const allowedDomainsJson = JSON.stringify(data.allowedDomains);
  const themeJson = JSON.stringify(data.theme);

  const [result] = await pool.execute(
    'INSERT INTO iam_Widgets (WorkspaceKey, SiteKey, Name, AllowedDomains, Theme) VALUES (?, ?, ?, ?, ?)',
    [workspaceKey, siteKey, data.name, allowedDomainsJson, themeJson]
  );

  const [rows] = await pool.execute('SELECT * FROM iam_Widgets WHERE WidgetKey = ?', [result.insertId]);
  return rows[0];
};

const getById = async (workspaceKey, widgetId) => {
  const pool = getPool();
  const [rows] = await pool.execute(
    'SELECT * FROM iam_Widgets WHERE WorkspaceKey = ? AND WidgetId = ?',
    [workspaceKey, widgetId]
  );
  return rows[0];
};

const update = async (workspaceKey, widgetId, data) => {
  const pool = getPool();

  const updates = [];
  const params = [];

  if (data.name) {
    updates.push('Name = ?');
    params.push(data.name);
  }
  if (data.status) {
    updates.push('Status = ?');
    params.push(data.status);
  }
  if (data.allowedDomains) {
    updates.push('AllowedDomains = ?');
    params.push(JSON.stringify(data.allowedDomains));
  }
  if (data.theme) {
    updates.push('Theme = ?');
    params.push(JSON.stringify(data.theme));
  }

  updates.push('UpdatedAt = UTC_TIMESTAMP(3)');

  if (updates.length === 1) return null; // only UpdatedAt, nothing changed

  params.push(workspaceKey, widgetId);

  await pool.execute(
    `UPDATE iam_Widgets SET ${updates.join(', ')} WHERE WorkspaceKey = ? AND WidgetId = ?`,
    params
  );

  const [rows] = await pool.execute(
    'SELECT * FROM iam_Widgets WHERE WorkspaceKey = ? AND WidgetId = ?',
    [workspaceKey, widgetId]
  );
  return rows[0];
};

const list = async (workspaceKey) => {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT WidgetId, WidgetKey, SiteKey, Name, AllowedDomains, Theme, Status, CreatedAt, UpdatedAt
     FROM iam_Widgets WHERE WorkspaceKey = ? ORDER BY CreatedAt DESC`,
    [workspaceKey]
  );
  return rows;
};

const getWidgetsByUser = async (userKey) => {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT w.WidgetKey, w.WidgetId, w.Name, w.SiteKey,
            ws.WorkspaceId, ws.Name as WorkspaceName
     FROM iam_Widgets w
     INNER JOIN iam_Workspaces ws ON w.WorkspaceKey = ws.WorkspaceKey
     INNER JOIN iam_Memberships m ON m.WorkspaceKey = ws.WorkspaceKey
     WHERE m.UserKey = ? AND m.Status = 1 AND w.Status = 1`,
    [userKey]
  );
  return rows;
};

module.exports = {
  create,
  getById,
  update,
  list,
  getWidgetsByUser
};
