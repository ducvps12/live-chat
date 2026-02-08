/**
 * Superadmin middleware
 * Checks if user has UserLevel = 9 (SuperAdmin)
 */
const superadminMiddleware = (req, res, next) => {
    // User should be attached by auth middleware
    if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    // Check UserLevel
    // 0 = Normal user
    // 1 = Demo (read-only)
    // 9 = SuperAdmin
    if (req.user.UserLevel !== 9) {
        return res.status(403).json({
            error: 'Access denied',
            message: 'SuperAdmin access required'
        });
    }

    next();
};

/**
 * Demo-safe middleware
 * Blocks write operations for Demo accounts (UserLevel = 1)
 */
const demoSafeMiddleware = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    // Demo accounts (level 1) can only read
    if (req.user.UserLevel === 1 && !['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        return res.status(403).json({
            error: 'Demo account',
            message: 'Demo accounts cannot modify data'
        });
    }

    next();
};

module.exports = { superadminMiddleware, demoSafeMiddleware };
