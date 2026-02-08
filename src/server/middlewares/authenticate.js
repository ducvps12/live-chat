const tokenUtils = require('../utils/token.utils');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const constants = require('../config/constants');

const authenticate = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  let token;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else {
    token = authHeader;
  }

  if (!token) {
    return next(new AppError('Unauthorized: No token provided', 401));
  }

  try {
    const userRepo = require('../modules/auth/repos/user.repo');

    const decoded = tokenUtils.verifyAccessToken(token);

    const user = await userRepo.findById(decoded.sub);

    if (!user) {
      return next(new AppError('Unauthorized: User not found', 401));
    }

    req.user = user;

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new AppError('Unauthorized: Token expired', 401));
    }
    return next(new AppError('Unauthorized: Invalid token', 401));
  }
});

module.exports = authenticate;
