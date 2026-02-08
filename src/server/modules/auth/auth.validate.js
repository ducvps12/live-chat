const Joi = require('joi');
const constants = require('../../config/constants');

const passwordRule = Joi.string().min(constants.AUTH.PASSWORD_MIN_LENGTH).required();

const register = Joi.object({
  email: Joi.string().email().required(),
  password: passwordRule,
  firstName: Joi.string().required(),
  lastName: Joi.string().required(),
  displayName: Joi.string().max(100).optional(),
  inviteToken: Joi.string().optional(),
});

const login = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(), // Don't enforce policy on login, just string
});

const refresh = Joi.object({
  refreshToken: Joi.string().required(),
});

const changePassword = Joi.object({
  oldPassword: Joi.string().required(),
  newPassword: passwordRule,
});

const forgotPassword = Joi.object({
  email: Joi.string().email().required(),
});

const resetPassword = Joi.object({
  token: Joi.string().required(),
  newPassword: passwordRule,
  confirmPassword: Joi.string().optional(), // Frontend sends this for validation
});

const verifyPassword = Joi.object({
  password: Joi.string().required()
});

const verifyEmail = Joi.object({
  token: Joi.string().required()
});

const resendVerification = Joi.object({
  email: Joi.string().email().required()
});

module.exports = {
  register,
  login,
  refresh,
  changePassword,
  forgotPassword,
  resetPassword,
  verifyPassword,
  verifyEmail,
  resendVerification
};
