const { getPool } = require('../../../infra/mysql/mysql');

const create = async ({ workspaceKey, phoneNumberId, displayNumber, businessAccountId, accessToken }) => {
    const pool = getPool();
    const [result] = await pool.execute(
        `INSERT INTO channels_WhatsAppAccounts (WorkspaceKey, PhoneNumberId, DisplayNumber, BusinessAccountId, AccessToken, Status)
     VALUES (?, ?, ?, ?, ?, 1)`,
        [workspaceKey, phoneNumberId, displayNumber, businessAccountId, accessToken]
    );
    const [rows] = await pool.execute(
        'SELECT AccountKey, AccountId, PhoneNumberId, DisplayNumber FROM channels_WhatsAppAccounts WHERE AccountKey = ?',
        [result.insertId]
    );
    return rows[0];
};

const findByPhoneNumberId = async (phoneNumberId) => {
    const [rows] = await getPool().execute(
        `SELECT AccountKey, AccountId, WorkspaceKey, PhoneNumberId, DisplayNumber,
            BusinessAccountId, AccessToken, Status, CreatedAt
     FROM channels_WhatsAppAccounts WHERE PhoneNumberId = ? AND Status = 1`,
        [phoneNumberId]
    );
    return rows[0];
};

const findByKey = async (accountKey) => {
    const [rows] = await getPool().execute(
        `SELECT AccountKey, AccountId, WorkspaceKey, PhoneNumberId, DisplayNumber,
            BusinessAccountId, AccessToken, Status, CreatedAt
     FROM channels_WhatsAppAccounts WHERE AccountKey = ?`,
        [accountKey]
    );
    return rows[0];
};

const findById = async (accountId) => {
    const [rows] = await getPool().execute(
        `SELECT AccountKey, AccountId, WorkspaceKey, PhoneNumberId, DisplayNumber,
            BusinessAccountId, AccessToken, Status, CreatedAt
     FROM channels_WhatsAppAccounts WHERE AccountId = ?`,
        [accountId]
    );
    return rows[0];
};

const findByWorkspace = async (workspaceKey) => {
    const [rows] = await getPool().execute(
        `SELECT AccountKey, AccountId, WorkspaceKey, PhoneNumberId, DisplayNumber,
            BusinessAccountId, Status, CreatedAt
     FROM channels_WhatsAppAccounts WHERE WorkspaceKey = ? AND Status = 1 ORDER BY CreatedAt DESC`,
        [workspaceKey]
    );
    return rows;
};

const updateToken = async (accountKey, accessToken) => {
    await getPool().execute(
        'UPDATE channels_WhatsAppAccounts SET AccessToken = ?, UpdatedAt = UTC_TIMESTAMP(3) WHERE AccountKey = ?',
        [accessToken, accountKey]
    );
};

const remove = async (accountKey) => {
    await getPool().execute(
        'UPDATE channels_WhatsAppAccounts SET Status = 0, UpdatedAt = UTC_TIMESTAMP(3) WHERE AccountKey = ?',
        [accountKey]
    );
};

module.exports = { create, findByPhoneNumberId, findByKey, findById, findByWorkspace, updateToken, delete: remove };
