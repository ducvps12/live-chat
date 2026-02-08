const { getPool } = require('../../../infra/mysql/mysql');

const insertPage = async (workspaceKey, pageData, conn) => {
  const pool = conn || getPool();
  const [result] = await pool.execute(
    `INSERT INTO channels_FacebookPages (WorkspaceKey, FacebookPageId, FacebookPageName, FacebookPageAvatar, PageAccessToken, Settings)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [workspaceKey, pageData.facebookPageId, pageData.facebookPageName, pageData.facebookPageAvatar || null,
      pageData.pageAccessToken, JSON.stringify(pageData.settings || {})]
  );
  const [rows] = await pool.execute(
    `SELECT PageKey, PageId, WorkspaceKey, FacebookPageId, FacebookPageName, FacebookPageAvatar,
            Status, Settings, CreatedAt, UpdatedAt FROM channels_FacebookPages WHERE PageKey = ?`,
    [result.insertId]
  );
  return rows[0];
};

const findByWorkspace = async (workspaceKey) => {
  const [rows] = await getPool().execute(
    `SELECT PageKey, PageId, WorkspaceKey, FacebookPageId, FacebookPageName, FacebookPageAvatar,
            Status, LastSyncAt, ErrorMessage, Settings, CreatedAt, UpdatedAt
     FROM channels_FacebookPages WHERE WorkspaceKey = ? ORDER BY CreatedAt DESC`,
    [workspaceKey]
  );
  return rows;
};

const findByPageId = async (pageId) => {
  const [rows] = await getPool().execute('SELECT * FROM channels_FacebookPages WHERE PageId = ?', [pageId]);
  return rows[0] || null;
};

const findByPageKey = async (pageKey) => {
  const [rows] = await getPool().execute('SELECT * FROM channels_FacebookPages WHERE PageKey = ?', [pageKey]);
  return rows[0] || null;
};

const findByFacebookPageId = async (facebookPageId) => {
  const [rows] = await getPool().execute('SELECT * FROM channels_FacebookPages WHERE FacebookPageId = ?', [facebookPageId]);
  return rows[0] || null;
};

const existsInWorkspace = async (workspaceKey, facebookPageId) => {
  const [rows] = await getPool().execute(
    'SELECT 1 as Exists FROM channels_FacebookPages WHERE WorkspaceKey = ? AND FacebookPageId = ?',
    [workspaceKey, facebookPageId]
  );
  return rows.length > 0;
};

const updatePageToken = async (pageKey, accessToken) => {
  await getPool().execute(
    `UPDATE channels_FacebookPages SET PageAccessToken = ?, UpdatedAt = UTC_TIMESTAMP(3), Status = 1, ErrorMessage = NULL WHERE PageKey = ?`,
    [accessToken, pageKey]
  );
};

const updatePageStatus = async (pageKey, status, errorMessage = null) => {
  await getPool().execute(
    'UPDATE channels_FacebookPages SET Status = ?, ErrorMessage = ?, UpdatedAt = UTC_TIMESTAMP(3) WHERE PageKey = ?',
    [status, errorMessage, pageKey]
  );
};

const updatePageSettings = async (pageKey, settings) => {
  await getPool().execute(
    'UPDATE channels_FacebookPages SET Settings = ?, UpdatedAt = UTC_TIMESTAMP(3) WHERE PageKey = ?',
    [JSON.stringify(settings), pageKey]
  );
  const [rows] = await getPool().execute('SELECT * FROM channels_FacebookPages WHERE PageKey = ?', [pageKey]);
  return rows[0];
};

const updateLastSync = async (pageKey) => {
  await getPool().execute(
    'UPDATE channels_FacebookPages SET LastSyncAt = UTC_TIMESTAMP(3), UpdatedAt = UTC_TIMESTAMP(3) WHERE PageKey = ?',
    [pageKey]
  );
};

const deletePage = async (pageKey) => {
  await getPool().execute('DELETE FROM channels_FacebookPages WHERE PageKey = ?', [pageKey]);
};

const deleteByPageId = async (pageId) => {
  await getPool().execute('DELETE FROM channels_FacebookPages WHERE PageId = ?', [pageId]);
};

module.exports = { insertPage, findByWorkspace, findByPageId, findByPageKey, findByFacebookPageId, existsInWorkspace, updatePageToken, updatePageStatus, updatePageSettings, updateLastSync, deletePage, deleteByPageId };
