const { getPool } = require('../../../infra/mysql/mysql');
const crypto = require('crypto');

const INVITE_STATUS = { PENDING: 1, ACCEPTED: 2, EXPIRED: 3, REVOKED: 4 };

const createInvite = async (data, conn = null) => {
  const { workspaceKey, email, roleName, invitedByMembershipKey, expiresAt } = data;
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  const pool = conn || getPool();
  const [result] = await pool.execute(
    `INSERT INTO iam_Invites (WorkspaceKey, Email, RoleName, InvitedByMembershipKey, TokenHash, ExpiresAt, Status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [workspaceKey, email.toLowerCase(), roleName, invitedByMembershipKey, tokenHash, expiresAt, INVITE_STATUS.PENDING]
  );
  const [rows] = await pool.execute(
    'SELECT InviteKey, InviteId, WorkspaceKey, Email, RoleName, Status, ExpiresAt, CreatedAt FROM iam_Invites WHERE InviteKey = ?',
    [result.insertId]
  );
  const invite = rows[0];
  invite.token = token;
  return invite;
};

const findByToken = async (token) => {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const [rows] = await getPool().execute(
    `SELECT i.*, w.WorkspaceId, w.Name AS WorkspaceName FROM iam_Invites i
     JOIN iam_Workspaces w ON w.WorkspaceKey = i.WorkspaceKey WHERE i.TokenHash = ?`,
    [tokenHash]
  );
  return rows[0] || null;
};

const findByKey = async (inviteKey) => {
  const [rows] = await getPool().execute(
    `SELECT i.*, w.WorkspaceId, w.Name AS WorkspaceName FROM iam_Invites i
     JOIN iam_Workspaces w ON w.WorkspaceKey = i.WorkspaceKey WHERE i.InviteKey = ?`,
    [inviteKey]
  );
  return rows[0] || null;
};

const findPendingByWorkspace = async (workspaceKey) => {
  const [rows] = await getPool().execute(
    `SELECT i.*, u.DisplayName AS InvitedByName
     FROM iam_Invites i
     LEFT JOIN iam_Memberships m ON m.MembershipKey = i.InvitedByMembershipKey
     LEFT JOIN iam_Users u ON u.UserKey = m.UserKey
     WHERE i.WorkspaceKey = ? AND i.Status = ? AND i.ExpiresAt > UTC_TIMESTAMP(3)
     ORDER BY i.CreatedAt DESC`,
    [workspaceKey, INVITE_STATUS.PENDING]
  );
  return rows;
};

const findPendingByEmail = async (workspaceKey, email) => {
  const params = [email.toLowerCase(), INVITE_STATUS.PENDING];
  let query = `SELECT i.*, w.Name AS WorkspaceName FROM iam_Invites i
     JOIN iam_Workspaces w ON w.WorkspaceKey = i.WorkspaceKey
     WHERE i.Email = ? AND i.Status = ? AND i.ExpiresAt > UTC_TIMESTAMP(3)`;
  if (workspaceKey) { query += ' AND i.WorkspaceKey = ?'; params.push(workspaceKey); }
  const [rows] = await getPool().execute(query, params);
  return rows[0] || null;
};

const updateStatus = async (inviteKey, status, conn = null) => {
  const pool = conn || getPool();
  await pool.execute('UPDATE iam_Invites SET Status = ?, UpdatedAt = UTC_TIMESTAMP(3) WHERE InviteKey = ?', [status, inviteKey]);
  const [rows] = await pool.execute('SELECT * FROM iam_Invites WHERE InviteKey = ?', [inviteKey]);
  return rows[0];
};

const revokeInvite = async (inviteKey) => updateStatus(inviteKey, INVITE_STATUS.REVOKED);
const markAccepted = async (inviteKey, conn) => updateStatus(inviteKey, INVITE_STATUS.ACCEPTED, conn);

module.exports = { INVITE_STATUS, createInvite, findByToken, findByKey, findPendingByWorkspace, findPendingByEmail, updateStatus, revokeInvite, markAccepted };
