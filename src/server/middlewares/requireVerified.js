const AppError = require('../utils/AppError');

/**
 * Middleware: Require email verification for sensitive actions
 * 
 * Use this middleware to protect endpoints that should only be accessible
 * to users with verified email addresses (Status = 1, EmailVerified = true)
 * 
 * Examples:
 * - Inviting workspace members
 * - Creating/enabling widgets
 * - Exporting data
 * - Billing operations
 * 
 * @throws {AppError} 403 if user's email is not verified
 */
const requireVerified = (req, res, next) => {
    const user = req.user; // Populated by authenticate middleware

    if (!user) {
        throw new AppError('Authentication required', 401);
    }

    // Check both EmailVerified flag and Status
    // Status 1 = active (verified)
    // Status 4 = unverified
    if (!user.EmailVerified || user.Status !== 1) {
        throw new AppError(
            'Email verification required. Please verify your email to access this feature.',
            403
        );
    }

    next();
};

module.exports = requireVerified;
