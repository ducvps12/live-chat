const { getPool } = require('../../infra/mysql/mysql');
const userRepo = require('./repos/user.repo');
const credentialRepo = require('./repos/credential.repo');
const tokenRepo = require('./repos/token.repo');
const passwordUtils = require('../../utils/password.utils');
const tokenUtils = require('../../utils/token.utils');
const AppError = require('../../utils/AppError');
const constants = require('../../config/constants');
const jwt = require('jsonwebtoken');
const env = require('../../config/env');
const crypto = require('crypto');
const emailService = require('../../utils/email.service');

// Helper to issue tokens
const issueTokens = async (userKey, userId, email, displayName, ip, agent) => {
  const accessToken = tokenUtils.signAccessToken(userKey);
  const familyId = crypto.randomUUID();
  const refreshToken = tokenUtils.signRefreshToken();
  const refreshHash = tokenUtils.hashToken(refreshToken);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await tokenRepo.createRefreshToken({
    userKey,
    tokenHash: refreshHash,
    expiresAt,
    familyId,
    ip,
    agent
  });

  return { accessToken, refreshToken, user: { id: userId, email, name: displayName } };
};

// Register
const register = async ({ email, password, firstName, lastName, displayName, inviteToken, ip, agent }) => {
  if (!displayName && firstName && lastName) {
    displayName = `${firstName} ${lastName}`.trim();
  }

  // 1. Check if user exists
  const existing = await userRepo.findByEmail(email);
  if (existing) {
    if (existing.Status === 4) { // Unverified
      const pool = getPool();
      await pool.execute('DELETE FROM iam_Users WHERE UserKey = ?', [existing.UserKey]);
    } else {
      throw new AppError('Email already registered', 400);
    }
  }

  // 2. Validate Password
  passwordUtils.validatePasswordPolicy(password);

  // 3. Transaction (MySQL)
  const pool = getPool();
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const iamRepo = require('./repos/iam.repo');
    const roleGrantRepo = require('../workspaces/repos/roleGrant.repo');
    const permissionRepo = require('../workspaces/repos/permission.repo');

    // Create User - set status to 4 (unverified)
    const user = await userRepo.createUser({ email, displayName }, conn);

    // Set status to unverified
    await conn.execute('UPDATE iam_Users SET Status = 4 WHERE UserKey = ?', [user.UserKey]);

    // Create Credential
    const hash = await passwordUtils.hashPassword(password);
    await credentialRepo.createCredential(user.UserKey, hash, conn);

    // 4. SaaS Setup - Auto-create Workspace
    const workspaceName = `Workspace của ${displayName || email}`;
    const workspace = await iamRepo.createWorkspace(workspaceName, conn);

    // Create Owner Role & Membership
    const ownerRole = await iamRepo.createRole(workspace.WorkspaceKey, 'Owner', conn);
    const membership = await iamRepo.createMembership(workspace.WorkspaceKey, user.UserKey, conn);
    await iamRepo.addRoleToMembership(membership.MembershipKey, ownerRole.RoleKey, conn);
    await iamRepo.grantAllPermissionsToRole(workspace.WorkspaceKey, ownerRole.RoleKey, conn);

    // Create Default Roles (Admin, Agent)
    const adminRole = await iamRepo.createRole(workspace.WorkspaceKey, 'Admin', conn);
    const adminPerms = await permissionRepo.getPermissionKeysByCodes(constants.ADMIN_DEFAULT_PERMISSIONS);
    await roleGrantRepo.ensureRoleGrants(adminRole.RoleKey, adminPerms, conn);

    const agentRole = await iamRepo.createRole(workspace.WorkspaceKey, 'Agent', conn);
    const agentPerms = await permissionRepo.getPermissionKeysByCodes(constants.AGENT_DEFAULT_PERMISSIONS);
    await roleGrantRepo.ensureRoleGrants(agentRole.RoleKey, agentPerms, conn);

    // Rebuild Effective Permissions
    await iamRepo.rebuildMembershipEffectivePermissions(membership.MembershipKey, conn);

    await conn.commit();
    console.log('[REGISTER] Transaction committed successfully.');

    // Check if this is from a valid invite token
    if (inviteToken) {
      try {
        console.log('[REGISTER] Processing invite token:', inviteToken);
        const inviteRepo = require('../workspaces/repos/invite.repo');

        const invite = await inviteRepo.findByToken(inviteToken);
        console.log('[REGISTER] Invite found:', invite ? 'Yes' : 'No');

        if (invite && invite.Email.toLowerCase() === email.toLowerCase() &&
          invite.Status === inviteRepo.INVITE_STATUS.PENDING &&
          new Date(invite.ExpiresAt) > new Date()) {

          console.log(`[REGISTER] Valid invite token provided. Auto-verifying email for: ${email}`);

          // Auto-verify email
          await userRepo.updateEmailVerified(user.UserKey, true);
          console.log('[REGISTER] Email verified.');

          // Set user status to active (1)
          await pool.execute('UPDATE iam_Users SET Status = 1 WHERE UserKey = ?', [user.UserKey]);
          console.log('[REGISTER] User status set to Active.');

          // Send Welcome Email
          emailService.sendWelcomeEmail({
            to: user.Email,
            displayName: user.DisplayName,
            workspaceName: invite.WorkspaceName,
            role: invite.RoleName
          }).catch(err => console.error('[REGISTER] Failed to send welcome email:', err.message));

          // Auto-login: Issue tokens
          console.log('[REGISTER] Issuing tokens...');
          const tokens = await issueTokens(user.UserKey, user.UserId, user.Email, user.DisplayName, ip, agent);
          console.log('[REGISTER] Tokens issued.');

          return {
            userKey: user.UserKey,
            email: user.Email,
            workspaceKey: workspace.WorkspaceKey,
            requiresEmailVerification: false,
            autoVerified: true,
            ...tokens
          };
        } else {
          console.warn(`[REGISTER] Invalid or mismatching invite token provided for ${email}`);
        }
      } catch (inviteErr) {
        console.error('[REGISTER] Error processing invite token (falling back to normal verification):', inviteErr);
      }
    }

    // Normal registration flow - require email verification
    const verificationToken = jwt.sign(
      { sub: user.UserKey, type: 'email_verification', email: user.Email },
      env.app.jwtSecret,
      { expiresIn: '30m' }
    );

    const verificationExpiry = new Date();
    verificationExpiry.setMinutes(verificationExpiry.getMinutes() + 30);

    await userRepo.updateVerificationToken(user.UserKey, verificationToken, verificationExpiry);

    emailService.sendEmailVerification(user.Email, verificationToken)
      .catch(err => console.error('[REGISTER] Failed to send verification email:', err.message));

    return {
      userKey: user.UserKey,
      email: user.Email,
      workspaceKey: workspace.WorkspaceKey,
      requiresEmailVerification: true
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

// Login
const login = async ({ email, password, ip, agent }) => {
  try {
    console.log('[LOGIN] Starting login for:', email);

    const user = await userRepo.findByEmail(email);
    if (!user) {
      await passwordUtils.comparePassword('dummy', '$2b$10$dummyhashdummyhashdummyhashdummyhashdummyhash');
      throw new AppError('Invalid credentials', 401);
    }
    console.log('[LOGIN] User found:', user.UserKey);

    const credential = await credentialRepo.getCredential(user.UserKey);
    console.log('[LOGIN] Credential loaded, LockUntil:', credential.LockUntil);

    if (credential.LockUntil && new Date(credential.LockUntil) > new Date()) {
      throw new AppError('Account is temporarily locked. Please try again later.', 429);
    }

    const isValid = await passwordUtils.comparePassword(password, credential.PasswordHash);
    console.log('[LOGIN] Password valid:', isValid);

    if (!isValid) {
      await credentialRepo.incrementFailedAttempts(user.UserKey, constants.AUTH.LOCKOUT_DURATION_MINUTES);
      throw new AppError('Invalid credentials', 401);
    }

    if (credential.FailedLoginAttempts > 0) {
      await credentialRepo.resetFailedAttempts(user.UserKey);
    }

    console.log('[LOGIN] Issuing tokens...');
    const tokens = await issueTokens(user.UserKey, user.UserId, user.Email, user.DisplayName, ip, agent);
    console.log('[LOGIN] Tokens issued successfully');
    return tokens;
  } catch (error) {
    console.error('[LOGIN] ERROR:', error.message);
    console.error('[LOGIN] Stack:', error.stack);
    throw error;
  }
};

// Refresh Token
const refreshToken = async ({ token, ip, agent }) => {
  const hash = tokenUtils.hashToken(token);
  const storedToken = await tokenRepo.findByHash(hash);

  if (!storedToken) {
    throw new AppError('Invalid token', 401);
  }

  if (storedToken.RevokedAt) {
    if (storedToken.FamilyId) {
      await tokenRepo.revokeFamily(storedToken.FamilyId);
    }
    throw new AppError('Token reused - Security Alert', 403);
  }

  if (new Date(storedToken.ExpiresAt) < new Date()) {
    throw new AppError('Token expired', 401);
  }

  await tokenRepo.revokeByKey(storedToken.RefreshTokenKey);

  const newRefToken = tokenUtils.signRefreshToken();
  const newRefHash = tokenUtils.hashToken(newRefToken);
  const userKey = storedToken.UserKey;

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await tokenRepo.createRefreshToken({
    userKey,
    tokenHash: newRefHash,
    expiresAt,
    familyId: storedToken.FamilyId,
    ip,
    agent
  });

  const accessToken = tokenUtils.signAccessToken(userKey);

  return { accessToken, refreshToken: newRefToken };
};

// Logout
const logout = async (token) => {
  const hash = tokenUtils.hashToken(token);
  const storedToken = await tokenRepo.findByHash(hash);
  if (storedToken && !storedToken.RevokedAt) {
    await tokenRepo.revokeByKey(storedToken.RefreshTokenKey);
  }
};

// Logout All
const logoutAll = async (userKey) => {
  await tokenRepo.revokeAllForUser(userKey);
};

// Change Password
const changePassword = async (userKey, oldPassword, newPassword) => {
  const credential = await credentialRepo.getCredential(userKey);

  const isValid = await passwordUtils.comparePassword(oldPassword, credential.PasswordHash);
  if (!isValid) throw new AppError('Invalid old password', 401);

  passwordUtils.validatePasswordPolicy(newPassword);

  const newHash = await passwordUtils.hashPassword(newPassword);

  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await credentialRepo.updatePassword(userKey, newHash, conn);
    await tokenRepo.revokeAllForUser(userKey);
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

// Forgot Password
const forgotPassword = async (email) => {
  const user = await userRepo.findByEmail(email);
  if (!user) return;

  const token = jwt.sign(
    { sub: user.UserKey, type: 'reset' },
    env.app.jwtSecret,
    { expiresIn: '15m' }
  );

  emailService.sendPasswordReset(email, token)
    .catch(err => console.error('[FORGOT_PASSWORD] Failed to send email:', err.message));
};

// Reset Password
const resetPassword = async (token, newPassword) => {
  let decoded;
  try {
    decoded = jwt.verify(token, env.app.jwtSecret);
  } catch (err) {
    throw new AppError('Invalid or expired reset token', 400);
  }

  if (decoded.type !== 'reset') throw new AppError('Invalid token type', 400);

  const userKey = decoded.sub;

  passwordUtils.validatePasswordPolicy(newPassword);

  const newHash = await passwordUtils.hashPassword(newPassword);

  await credentialRepo.updatePassword(userKey, newHash);
  await tokenRepo.revokeAllForUser(userKey);
};

const listSessions = async (userKey) => {
  return await tokenRepo.listActiveSessions(userKey);
};

const revokeSession = async (userKey, sessionId) => {
  await tokenRepo.revokeByKey(sessionId, userKey);
};

const verifyEmail = async (token) => {
  let decoded;
  try {
    decoded = jwt.verify(token, env.app.jwtSecret);
  } catch (err) {
    throw new AppError('Invalid or expired verification token', 400);
  }

  if (decoded.type !== 'email_verification') {
    throw new AppError('Invalid token type', 400);
  }

  const userKey = decoded.sub;

  const user = await userRepo.findById(userKey);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  if (user.EmailVerified) {
    throw new AppError('Email already verified', 400);
  }

  await userRepo.updateEmailVerified(userKey, true);

  // Update status to active
  await getPool().execute('UPDATE iam_Users SET Status = 1 WHERE UserKey = ?', [userKey]);
};

const resendVerification = async (email) => {
  const user = await userRepo.findByEmail(email);
  if (!user) return;

  if (user.EmailVerified) {
    throw new AppError('Email already verified', 400);
  }

  const verificationToken = jwt.sign(
    { sub: user.UserKey, type: 'email_verification', email: user.Email },
    env.app.jwtSecret,
    { expiresIn: '30m' }
  );

  const verificationExpiry = new Date();
  verificationExpiry.setMinutes(verificationExpiry.getMinutes() + 30);

  await userRepo.updateVerificationToken(user.UserKey, verificationToken, verificationExpiry);

  emailService.sendEmailVerification(user.Email, verificationToken)
    .catch(err => console.error('[RESEND_VERIFICATION] Failed to send email:', err.message));
};

const verifyPasswordForReauth = async (userKey, password) => {
  const credential = await credentialRepo.getCredential(userKey);
  if (!credential) {
    throw new AppError('Credential not found', 404);
  }

  const isValid = await passwordUtils.comparePassword(password, credential.PasswordHash);
  return { valid: isValid };
};

const getMeWithContext = async (userKey) => {
  return await userRepo.getUserContext(userKey);
};

// Register or Login with Google OAuth
const registerOrLoginWithGoogle = async ({ email, displayName, googleId, avatarUrl, ip, agent }) => {
  const pool = getPool();

  const existingUser = await userRepo.findByEmail(email);

  if (existingUser) {
    if (googleId && !existingUser.GoogleId) {
      await pool.execute(
        `UPDATE iam_Users SET GoogleId = ?, AvatarUrl = COALESCE(?, AvatarUrl),
         EmailVerified = 1, Status = 1 WHERE UserKey = ?`,
        [googleId, avatarUrl || null, existingUser.UserKey]
      );
    }

    return await issueTokens(
      existingUser.UserKey,
      existingUser.UserId,
      existingUser.Email,
      existingUser.DisplayName,
      ip,
      agent
    );
  }

  // New user - register with Google
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const iamRepo = require('./repos/iam.repo');
    const roleGrantRepo = require('../workspaces/repos/roleGrant.repo');
    const permissionRepo = require('../workspaces/repos/permission.repo');

    // Create User (with Google ID, verified)
    const [insertResult] = await conn.execute(
      `INSERT INTO iam_Users (Email, EmailNormalized, DisplayName, GoogleId, AvatarUrl, EmailVerified, Status)
       VALUES (?, ?, ?, ?, ?, 1, 1)`,
      [email, email.toLowerCase(), displayName, googleId, avatarUrl || null]
    );
    const [userRows] = await conn.execute('SELECT * FROM iam_Users WHERE UserKey = ?', [insertResult.insertId]);
    const user = userRows[0];

    // Create a random password for the user
    const randomPassword = crypto.randomBytes(16).toString('hex');
    const hash = await passwordUtils.hashPassword(randomPassword);
    await credentialRepo.createCredential(user.UserKey, hash, conn);

    // Create Workspace
    const workspaceName = `Workspace của ${displayName || email}`;
    const workspace = await iamRepo.createWorkspace(workspaceName, conn);

    // Create Owner Role & Membership
    const ownerRole = await iamRepo.createRole(workspace.WorkspaceKey, 'Owner', conn);
    const membership = await iamRepo.createMembership(workspace.WorkspaceKey, user.UserKey, conn);
    await iamRepo.addRoleToMembership(membership.MembershipKey, ownerRole.RoleKey, conn);
    await iamRepo.grantAllPermissionsToRole(workspace.WorkspaceKey, ownerRole.RoleKey, conn);

    // Create Default Roles
    const adminRole = await iamRepo.createRole(workspace.WorkspaceKey, 'Admin', conn);
    const adminPerms = await permissionRepo.getPermissionKeysByCodes(constants.ADMIN_DEFAULT_PERMISSIONS);
    await roleGrantRepo.ensureRoleGrants(adminRole.RoleKey, adminPerms, conn);

    const agentRole = await iamRepo.createRole(workspace.WorkspaceKey, 'Agent', conn);
    const agentPerms = await permissionRepo.getPermissionKeysByCodes(constants.AGENT_DEFAULT_PERMISSIONS);
    await roleGrantRepo.ensureRoleGrants(agentRole.RoleKey, agentPerms, conn);

    // Rebuild Effective Permissions
    await iamRepo.rebuildMembershipEffectivePermissions(membership.MembershipKey, conn);

    await conn.commit();

    return await issueTokens(user.UserKey, user.UserId, user.Email, user.DisplayName, ip, agent);

  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

module.exports = {
  register,
  login,
  refreshToken,
  logout,
  logoutAll,
  changePassword,
  forgotPassword,
  resetPassword,
  listSessions,
  revokeSession,
  getMeWithContext,
  verifyEmail,
  resendVerification,
  verifyPasswordForReauth,
  registerOrLoginWithGoogle
};
