const { getPool } = require('../../../infra/mysql/mysql');

const attachRole = async (membershipKey, roleKey, conn) => {
  const pool = conn || getPool();
  await pool.execute(
    'INSERT IGNORE INTO iam_MembershipRoles (MembershipKey, RoleKey) VALUES (?, ?)',
    [membershipKey, roleKey]
  );
};

const findRolesByMembership = async (membershipKey) => {
  const [rows] = await getPool().execute(
    `SELECT r.*
     FROM iam_MembershipRoles mr
     JOIN iam_Roles r ON r.RoleKey = mr.RoleKey
     WHERE mr.MembershipKey = ?`,
    [membershipKey]
  );
  return rows;
};

const hasRole = async (membershipKey, roleName) => {
  const [rows] = await getPool().execute(
    `SELECT 1
     FROM iam_MembershipRoles mr
     JOIN iam_Roles r ON r.RoleKey = mr.RoleKey
     WHERE mr.MembershipKey = ? AND r.Name = ?`,
    [membershipKey, roleName]
  );
  return rows.length > 0;
};

module.exports = { attachRole, findRolesByMembership, hasRole };
