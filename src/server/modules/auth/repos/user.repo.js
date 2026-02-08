const { getPool } = require('../../../infra/mysql/mysql');

const findByEmail = async (email) => {
  const [rows] = await getPool().execute(
    'SELECT * FROM iam_Users WHERE EmailNormalized = ?',
    [email.toLowerCase().trim()]
  );
  return rows[0];
};

const findById = async (userKey) => {
  const [rows] = await getPool().execute(
    'SELECT * FROM iam_Users WHERE UserKey = ?',
    [userKey]
  );
  return rows[0];
};

const createUser = async (userData, conn) => {
  const pool = conn || getPool();
  const [result] = await pool.execute(
    `INSERT INTO iam_Users (Email, EmailNormalized, DisplayName)
     VALUES (?, ?, ?)`,
    [userData.email, userData.email.toLowerCase(), userData.displayName || null]
  );
  const [rows] = await pool.execute('SELECT * FROM iam_Users WHERE UserKey = ?', [result.insertId]);
  return rows[0];
};

const updateEmailVerified = async (userKey, verified) => {
  await getPool().execute(
    `UPDATE iam_Users
     SET EmailVerified = ?, EmailVerificationToken = NULL, EmailVerificationExpiry = NULL
     WHERE UserKey = ?`,
    [verified ? 1 : 0, userKey]
  );
};

const updateVerificationToken = async (userKey, token, expiry) => {
  await getPool().execute(
    `UPDATE iam_Users
     SET EmailVerificationToken = ?, EmailVerificationExpiry = ?
     WHERE UserKey = ?`,
    [token, expiry, userKey]
  );
};

const findByVerificationToken = async (token) => {
  const [rows] = await getPool().execute(
    `SELECT * FROM iam_Users
     WHERE EmailVerificationToken = ? AND EmailVerificationExpiry > UTC_TIMESTAMP(3)`,
    [token]
  );
  return rows[0];
};

const updateProfile = async (userKey, profileData) => {
  const { firstName, lastName, language, timezone } = profileData;
  const updates = [];
  const params = [];

  if (firstName !== undefined) { updates.push('FirstName = ?'); params.push(firstName); }
  if (lastName !== undefined) { updates.push('LastName = ?'); params.push(lastName); }
  if (language !== undefined) { updates.push('Language = ?'); params.push(language); }
  if (timezone !== undefined) { updates.push('Timezone = ?'); params.push(timezone); }

  if (updates.length === 0) return;

  updates.push('UpdatedAt = UTC_TIMESTAMP(3)');
  params.push(userKey);

  await getPool().execute(
    `UPDATE iam_Users SET ${updates.join(', ')} WHERE UserKey = ?`,
    params
  );
};

const updateAvatar = async (userKey, avatarUrl) => {
  await getPool().execute(
    `UPDATE iam_Users SET AvatarUrl = ?, UpdatedAt = UTC_TIMESTAMP(3) WHERE UserKey = ?`,
    [avatarUrl, userKey]
  );
};

const getUserContext = async (userKey) => {
  const pool = getPool();

  const [memberships] = await pool.execute(
    `SELECT
       m.MembershipKey,
       w.WorkspaceId,
       w.Name AS WorkspaceName,
       r.Name AS RoleName
     FROM iam_Memberships m
     JOIN iam_Workspaces w ON w.WorkspaceKey = m.WorkspaceKey
     LEFT JOIN iam_MembershipRoles mr ON mr.MembershipKey = m.MembershipKey
     LEFT JOIN iam_Roles r ON r.RoleKey = mr.RoleKey
     WHERE m.UserKey = ? AND m.Status = 1 AND w.Status = 1`,
    [userKey]
  );

  const [permissions] = await pool.execute(
    `SELECT
       m.MembershipKey,
       p.Code AS PermissionCode,
       mep.ResourceKeyNN,
       mep.Effect
     FROM iam_Memberships m
     JOIN iam_MembershipEffectivePermissions mep ON mep.MembershipKey = m.MembershipKey
     JOIN iam_Permissions p ON p.PermissionKey = mep.PermissionKey
     WHERE m.UserKey = ? AND mep.Effect = 1`,
    [userKey]
  );

  const workspacesMap = new Map();

  memberships.forEach(row => {
    if (!workspacesMap.has(row.MembershipKey)) {
      workspacesMap.set(row.MembershipKey, {
        membershipKey: row.MembershipKey,
        workspaceId: row.WorkspaceId,
        workspaceName: row.WorkspaceName,
        roles: [],
        permissions: []
      });
    }
    if (row.RoleName) {
      workspacesMap.get(row.MembershipKey).roles.push(row.RoleName);
    }
  });

  permissions.forEach(row => {
    const ws = workspacesMap.get(row.MembershipKey);
    if (ws && !ws.permissions.includes(row.PermissionCode)) {
      ws.permissions.push(row.PermissionCode);
    }
  });

  return Array.from(workspacesMap.values());
};

module.exports = {
  findByEmail,
  findById,
  createUser,
  getUserContext,
  updateEmailVerified,
  updateVerificationToken,
  findByVerificationToken,
  updateProfile,
  updateAvatar
};
