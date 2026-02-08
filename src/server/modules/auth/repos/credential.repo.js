const { getPool } = require('../../../infra/mysql/mysql');

const createCredential = async (userKey, hash, conn) => {
  const pool = conn || getPool();
  await pool.execute(
    `INSERT INTO iam_UserCredentials (UserKey, PasswordHash, PasswordAlgo)
     VALUES (?, ?, ?)`,
    [userKey, hash, 'bcrypt']
  );
};

const getCredential = async (userKey) => {
  const [rows] = await getPool().execute(
    'SELECT * FROM iam_UserCredentials WHERE UserKey = ?',
    [userKey]
  );
  return rows[0];
};

const updatePassword = async (userKey, newHash, conn) => {
  const pool = conn || getPool();
  await pool.execute(
    `UPDATE iam_UserCredentials
     SET PasswordHash = ?, MustChangePassword = 0, FailedLoginAttempts = 0, LockUntil = NULL
     WHERE UserKey = ?`,
    [newHash, userKey]
  );
};

const incrementFailedAttempts = async (userKey, lockoutDurationMinutes) => {
  const MAX_ATTEMPTS = 5;
  await getPool().execute(
    `UPDATE iam_UserCredentials
     SET FailedLoginAttempts = FailedLoginAttempts + 1,
         LockUntil = CASE
           WHEN FailedLoginAttempts + 1 >= ${MAX_ATTEMPTS}
           THEN DATE_ADD(UTC_TIMESTAMP(3), INTERVAL ? MINUTE)
           ELSE LockUntil
         END
     WHERE UserKey = ?`,
    [lockoutDurationMinutes, userKey]
  );
};

const resetFailedAttempts = async (userKey) => {
  await getPool().execute(
    `UPDATE iam_UserCredentials SET FailedLoginAttempts = 0, LockUntil = NULL WHERE UserKey = ?`,
    [userKey]
  );
};

module.exports = {
  createCredential,
  getCredential,
  updatePassword,
  incrementFailedAttempts,
  resetFailedAttempts
};
