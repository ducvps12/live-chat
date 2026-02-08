const { getPool } = require('../../../infra/mysql/mysql');

const insertAccount = async (workspaceKey, data) => {
    const pool = getPool();
    const [result] = await pool.execute(
        `INSERT INTO channels_InstagramAccounts
     (WorkspaceKey, InstagramBusinessId, InstagramUsername, InstagramName, InstagramAvatar,
      LinkedFacebookPageId, LinkedFacebookPageName, PageAccessToken, Settings)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [workspaceKey, data.instagramBusinessId, data.instagramUsername, data.instagramName,
            data.instagramAvatar, data.linkedFacebookPageId, data.linkedFacebookPageName,
            data.pageAccessToken, JSON.stringify(data.settings || {})]
    );
    const [rows] = await pool.execute(
        'SELECT AccountKey, AccountId, InstagramUsername, InstagramName, InstagramAvatar, Status, CreatedAt FROM channels_InstagramAccounts WHERE AccountKey = ?',
        [result.insertId]
    );
    return rows[0];
};

const findByWorkspace = async (workspaceKey) => {
    const [rows] = await getPool().execute(
        `SELECT AccountKey, AccountId, InstagramBusinessId, InstagramUsername, InstagramName,
            InstagramAvatar, LinkedFacebookPageId, LinkedFacebookPageName, Status,
            LastSyncAt, ErrorMessage, Settings, CreatedAt, UpdatedAt
     FROM channels_InstagramAccounts WHERE WorkspaceKey = ? ORDER BY CreatedAt DESC`,
        [workspaceKey]
    );
    return rows;
};

const findByAccountId = async (accountId) => {
    const [rows] = await getPool().execute(
        `SELECT AccountKey, AccountId, WorkspaceKey, InstagramBusinessId, InstagramUsername,
            InstagramName, InstagramAvatar, LinkedFacebookPageId, LinkedFacebookPageName,
            PageAccessToken, Status, LastSyncAt, ErrorMessage, Settings, CreatedAt, UpdatedAt
     FROM channels_InstagramAccounts WHERE AccountId = ?`,
        [accountId]
    );
    return rows[0] || null;
};

const findByInstagramId = async (instagramBusinessId) => {
    const [rows] = await getPool().execute(
        `SELECT AccountKey, AccountId, WorkspaceKey, InstagramBusinessId, InstagramUsername,
            PageAccessToken, Status
     FROM channels_InstagramAccounts WHERE InstagramBusinessId = ?`,
        [instagramBusinessId]
    );
    return rows[0] || null;
};

const existsInWorkspace = async (workspaceKey, instagramBusinessId) => {
    const [rows] = await getPool().execute(
        'SELECT 1 as Exists FROM channels_InstagramAccounts WHERE WorkspaceKey = ? AND InstagramBusinessId = ?',
        [workspaceKey, instagramBusinessId]
    );
    return rows.length > 0;
};

const updateStatus = async (accountKey, status, errorMessage = null) => {
    await getPool().execute(
        'UPDATE channels_InstagramAccounts SET Status = ?, ErrorMessage = ?, UpdatedAt = UTC_TIMESTAMP(3) WHERE AccountKey = ?',
        [status, errorMessage, accountKey]
    );
};

const updateLastSync = async (accountKey) => {
    await getPool().execute('UPDATE channels_InstagramAccounts SET LastSyncAt = UTC_TIMESTAMP(3) WHERE AccountKey = ?', [accountKey]);
};

const updateSettings = async (accountKey, settings) => {
    await getPool().execute(
        'UPDATE channels_InstagramAccounts SET Settings = ?, UpdatedAt = UTC_TIMESTAMP(3) WHERE AccountKey = ?',
        [JSON.stringify(settings), accountKey]
    );
    const [rows] = await getPool().execute(
        'SELECT AccountKey, AccountId, Settings FROM channels_InstagramAccounts WHERE AccountKey = ?',
        [accountKey]
    );
    return rows[0];
};

const deleteAccount = async (accountKey) => {
    await getPool().execute('DELETE FROM channels_InstagramAccounts WHERE AccountKey = ?', [accountKey]);
};

module.exports = { insertAccount, findByWorkspace, findByAccountId, findByInstagramId, existsInWorkspace, updateStatus, updateLastSync, updateSettings, deleteAccount };
