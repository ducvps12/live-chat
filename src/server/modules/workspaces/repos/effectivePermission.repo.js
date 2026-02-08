const { getPool } = require('../../../infra/mysql/mysql');

const rebuild = async (membershipKey, conn) => {
  const pool = conn || getPool();

  // Delete existing
  await pool.execute('DELETE FROM iam_MembershipEffectivePermissions WHERE MembershipKey = ?', [membershipKey]);

  // Insert role-based grants
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

  // Insert user overrides
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

const getEffectivePermissions = async (membershipKey) => {
  const [rows] = await getPool().execute(
    `SELECT mep.*, p.Code, p.Resource, p.\`Action\`
     FROM iam_MembershipEffectivePermissions mep
     JOIN iam_Permissions p ON p.PermissionKey = mep.PermissionKey
     WHERE mep.MembershipKey = ?`,
    [membershipKey]
  );
  return rows;
};

const hasPermission = async (membershipKey, permissionCode, resourceKey = 0) => {
  const [rows] = await getPool().execute(
    `SELECT mep.Effect
     FROM iam_MembershipEffectivePermissions mep
     JOIN iam_Permissions p ON p.PermissionKey = mep.PermissionKey
     WHERE mep.MembershipKey = ? AND p.Code = ? AND mep.ResourceKeyNN IN (0, ?)
     ORDER BY mep.Effect DESC
     LIMIT 1`,
    [membershipKey, permissionCode, resourceKey]
  );
  return rows.length > 0 && rows[0].Effect === 1;
};

module.exports = { rebuild, getEffectivePermissions, hasPermission };
