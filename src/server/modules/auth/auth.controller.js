const authService = require('./auth.service');
const asyncHandler = require('../../utils/asyncHandler');

// A. Account
const register = asyncHandler(async (req, res) => {
  const ip = req.ip;
  const agent = req.headers['user-agent'];
  const result = await authService.register({ ...req.body, ip, agent });
  res.status(201).json({ status: 'success', data: result });
});

const login = asyncHandler(async (req, res) => {
  const ip = req.ip;
  const agent = req.headers['user-agent'];
  const result = await authService.login({ ...req.body, ip, agent });
  res.status(200).json({ status: 'success', data: result });
});

const logout = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body; // Expecting refresh token to revoke
  if (refreshToken) {
    await authService.logout(refreshToken);
  }
  res.status(200).json({ status: 'success', message: 'Logged out' });
});

const logoutAll = asyncHandler(async (req, res) => {
  await authService.logoutAll(req.user.key);
  res.status(200).json({ status: 'success', message: 'All sessions revoked' });
});

const me = asyncHandler(async (req, res) => {
  const context = await authService.getMeWithContext(req.user.key);

  res.status(200).json({
    status: 'success',
    data: {
      user: req.user,
      workspaces: context
    }
  });
});

// B. Token
const refreshToken = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  const ip = req.ip;
  const agent = req.headers['user-agent'];
  const result = await authService.refreshToken({ token: refreshToken, ip, agent });
  res.status(200).json({ status: 'success', data: result });
});

const verifyToken = asyncHandler(async (req, res) => {
  // If we reached here, authenticate middleware passed
  res.status(200).json({ status: 'success', message: 'Token is valid' });
});

// C. Password
const changePassword = asyncHandler(async (req, res) => {
  await authService.changePassword(
    req.user.key,
    req.body.oldPassword,
    req.body.newPassword
  );
  res.status(200).json({ status: 'success', message: 'Password changed, all sessions revoked' });
});

const forgotPassword = asyncHandler(async (req, res) => {
  await authService.forgotPassword(req.body.email);
  res.status(200).json({ status: 'success', message: 'If email exists, a reset instruction has been sent' });
});

const resetPassword = asyncHandler(async (req, res) => {
  await authService.resetPassword(req.body.token, req.body.newPassword);
  res.status(200).json({ status: 'success', message: 'Password reset successfully' });
});

const verifyPassword = asyncHandler(async (req, res) => {
  const result = await authService.verifyPasswordForReauth(req.user.key, req.body.password);
  res.status(200).json({ status: 'success', valid: result.valid });
});

const verifyEmail = asyncHandler(async (req, res) => {
  await authService.verifyEmail(req.body.token);
  res.status(200).json({ status: 'success', message: 'Email verified successfully' });
});

const resendVerification = asyncHandler(async (req, res) => {
  await authService.resendVerification(req.body.email);
  res.status(200).json({ status: 'success', message: 'Verification email sent' });
});

// D. Sessions
const listSessions = asyncHandler(async (req, res) => {
  const sessions = await authService.listSessions(req.user.key);
  res.status(200).json({ status: 'success', data: sessions });
});

const revokeSession = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  await authService.revokeSession(req.user.key, sessionId);
  res.status(200).json({ status: 'success', message: 'Session revoked' });
});

module.exports = {
  register,
  login,
  logout,
  logoutAll,
  me,
  refreshToken,
  verifyToken,
  changePassword,
  forgotPassword,
  resetPassword,
  verifyPassword,
  verifyEmail,
  resendVerification,
  listSessions,
  revokeSession
};
