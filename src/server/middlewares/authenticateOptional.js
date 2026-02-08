const tokenUtils = require('../utils/token.utils');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');

/**
 * Optional authentication middleware.
 * If token is present and valid, attaches user to req.user.
 * If no token or invalid, simply proceeds without req.user (does not throw 401).
 */
const authenticateOptional = asyncHandler(async (req, res, next) => {
    const authHeader = req.headers.authorization;
    let token;

    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
    } else if (authHeader) {
        token = authHeader;
    }

    if (!token) {
        return next();
    }

    try {
        const userRepo = require('../modules/auth/repos/user.repo');
        const decoded = tokenUtils.verifyAccessToken(token);

        // Fetch full user identity
        const user = await userRepo.findById(decoded.sub);

        if (user) {
            req.user = user;
        }
    } catch (err) {
        // Ignore errors (expired/invalid) and treat as unauthenticated
        // Optional: could log debug warning
    }

    next();
});

module.exports = authenticateOptional;
