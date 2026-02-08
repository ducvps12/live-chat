const { getPool } = require('../../../infra/mysql/mysql');

const ensureRoleGrants = async (roleKey, permissionKeys, conn) => {
  if (!permissionKeys || permissionKeys.length === 0) return 0;

  const pool = conn || getPool();
  let inserted = 0;

  for (const pk of permissionKeys) {
    const [result] = await pool.execute(
      'INSERT IGNORE INTO iam_RolePermissionGrants (RoleKey, PermissionKey, Effect) VALUES (?, ?, 1)',
      [roleKey, pk]
    );
    inserted += result.affectedRows;
  }

  return inserted;
};

const findGrantsByRole = async (roleKey) => {
  const [rows] = await getPool().execute(
    `SELECT rpg.*, p.Code, p.Resource, p.\`Action\`
     FROM iam_RolePermissionGrants rpg
     JOIN iam_Permissions p ON p.PermissionKey = rpg.PermissionKey
     WHERE rpg.RoleKey = ?`,
    [roleKey]
  );
  return rows;
};

module.exports = { ensureRoleGrants, findGrantsByRole };
