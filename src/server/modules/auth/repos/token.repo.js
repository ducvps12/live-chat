const { getPool } = require('../../../infra/mysql/mysql');

const createRefreshToken = async (data) => {
  await getPool().execute(
    `INSERT INTO iam_RefreshTokens (UserKey, TokenHash, ExpiresAt, FamilyId, CreatedByIp, UserAgent)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [data.userKey, data.tokenHash, data.expiresAt, data.familyId || null, data.ip || null, data.agent || null]
  );
};

const findByHash = async (tokenHash) => {
  const [rows] = await getPool().execute(
    'SELECT * FROM iam_RefreshTokens WHERE TokenHash = ?',
    [tokenHash]
  );
  return rows[0];
};

const revokeByKey = async (tokenKey, userKey = null) => {
  let query = 'UPDATE iam_RefreshTokens SET RevokedAt = UTC_TIMESTAMP(3) WHERE RefreshTokenKey = ?';
  const params = [tokenKey];

  if (userKey !== null) {
    query += ' AND UserKey = ?';
    params.push(userKey);
  }

  await getPool().execute(query, params);
};

const revokeFamily = async (familyId) => {
  await getPool().execute(
    'UPDATE iam_RefreshTokens SET RevokedAt = UTC_TIMESTAMP(3) WHERE FamilyId = ?',
    [familyId]
  );
};

const revokeAllForUser = async (userKey) => {
  await getPool().execute(
    'UPDATE iam_RefreshTokens SET RevokedAt = UTC_TIMESTAMP(3) WHERE UserKey = ? AND RevokedAt IS NULL',
    [userKey]
  );
};

const listActiveSessions = async (userKey) => {
  const [rows] = await getPool().execute(
    `SELECT RefreshTokenKey, CreatedAt, ExpiresAt, CreatedByIp, UserAgent
     FROM iam_RefreshTokens
     WHERE UserKey = ? AND RevokedAt IS NULL AND ExpiresAt > UTC_TIMESTAMP(3)`,
    [userKey]
  );
  return rows;
};

module.exports = {
  createRefreshToken,
  findByHash,
  revokeByKey,
  revokeFamily,
  revokeAllForUser,
  listActiveSessions
};
