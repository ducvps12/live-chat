const { getPool } = require('../../../infra/mysql/mysql');

const createWorkspace = async (name, conn) => {
  const pool = conn || getPool();
  const [result] = await pool.execute(
    'INSERT INTO iam_Workspaces (Name, Status) VALUES (?, 1)',
    [name]
  );
  const [rows] = await pool.execute('SELECT * FROM iam_Workspaces WHERE WorkspaceKey = ?', [result.insertId]);
  return rows[0];
};

const createRole = async (workspaceKey, name, conn) => {
  const pool = conn || getPool();
  const [result] = await pool.execute(
    'INSERT INTO iam_Roles (WorkspaceKey, Name) VALUES (?, ?)',
    [workspaceKey, name]
  );
  const [rows] = await pool.execute('SELECT * FROM iam_Roles WHERE RoleKey = ?', [result.insertId]);
  return rows[0];
};

const createMembership = async (workspaceKey, userKey, conn) => {
  const pool = conn || getPool();
  const [result] = await pool.execute(
    'INSERT INTO iam_Memberships (WorkspaceKey, UserKey, Status) VALUES (?, ?, 1)',
    [workspaceKey, userKey]
  );
  const [rows] = await pool.execute('SELECT * FROM iam_Memberships WHERE MembershipKey = ?', [result.insertId]);
  return rows[0];
};

const addRoleToMembership = async (membershipKey, roleKey, conn) => {
  const pool = conn || getPool();
  await pool.execute(
    'INSERT INTO iam_MembershipRoles (MembershipKey, RoleKey) VALUES (?, ?)',
    [membershipKey, roleKey]
  );
};

const grantAllPermissionsToRole = async (workspaceKey, roleKey, conn) => {
  const pool = conn || getPool();
  await pool.execute(
    `INSERT INTO iam_RolePermissionGrants (RoleKey, PermissionKey, Effect)
     SELECT ?, PermissionKey, 1 FROM iam_Permissions`,
    [roleKey]
  );
};

const rebuildMembershipEffectivePermissions = async (membershipKey, conn) => {
  const pool = conn || getPool();

  // Delete existing
  await pool.execute(
    'DELETE FROM iam_MembershipEffectivePermissions WHERE MembershipKey = ?',
    [membershipKey]
  );

  // Role-based grants
  await pool.execute(
    `INSERT INTO iam_MembershipEffectivePermissions
       (MembershipKey, PermissionKey, ResourceKey, Effect, SourceType)
     SELECT ?, g.PermissionKey, gs.ResourceKey, g.Effect, 1
     FROM iam_MembershipRoles mr
     JOIN iam_RolePermissionGrants g ON g.RoleKey = mr.RoleKey
     LEFT JOIN iam_GrantScopes gs ON gs.GrantKey = g.GrantKey
     WHERE mr.MembershipKey = ?`,
    [membershipKey, membershipKey]
  );

  // User overrides
  await pool.execute(
    `INSERT INTO iam_MembershipEffectivePermissions
       (MembershipKey, PermissionKey, ResourceKey, Effect, SourceType)
     SELECT o.MembershipKey, o.PermissionKey, o.ResourceKey, o.Effect, 2
     FROM iam_MembershipPermissionOverrides o
     WHERE o.MembershipKey = ?
       AND (o.ExpiresAt IS NULL OR o.ExpiresAt > UTC_TIMESTAMP(3))`,
    [membershipKey]
  );
};

module.exports = {
  createWorkspace,
  createRole,
  createMembership,
  addRoleToMembership,
  grantAllPermissionsToRole,
  rebuildMembershipEffectivePermissions
};
