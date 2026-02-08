const { getPool } = require('../infra/mysql/mysql');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const constants = require('../config/constants');

// Cache for permission code -> key mapping
let permissionCache = null;
let cacheExpiry = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const loadPermissions = async () => {
  const now = Date.now();
  if (permissionCache && cacheExpiry > now) {
    return permissionCache;
  }

  const pool = getPool();
  const [rows] = await pool.execute('SELECT PermissionKey, Code FROM iam_Permissions');

  permissionCache = {};
  for (const row of rows) {
    permissionCache[row.Code] = row.PermissionKey;
  }
  cacheExpiry = now + CACHE_TTL;

  return permissionCache;
};

const clearCache = () => {
  permissionCache = null;
  cacheExpiry = 0;
};

const authorize = (permissionCode, options = {}) => {
  return asyncHandler(async (req, res, next) => {
    const membershipKey = req.user?.membershipKey;
    if (!membershipKey) {
      return next(new AppError('Forbidden: No membership context', 403));
    }

    const permissions = await loadPermissions();
    const permissionKey = permissions[permissionCode];

    if (!permissionKey) {
      console.error(`Permission not found in DB: ${permissionCode}`);
      console.error('Available permissions:', Object.keys(permissions));
      return next(new AppError(`Server Configuration Error: Permission "${permissionCode}" not found. Run seed_permissions.sql`, 500));
    }

    let resourceKey = 0;

    const pool = getPool();
    const [rows] = await pool.execute(
      `SELECT Effect
       FROM iam_MembershipEffectivePermissions
       WHERE MembershipKey = ? AND PermissionKey = ? AND ResourceKeyNN IN (0, ?)
       ORDER BY Effect DESC
       LIMIT 1`,
      [membershipKey, permissionKey, resourceKey]
    );

    const hasPermission = rows.length > 0 && rows[0].Effect === constants.PERMISSION.ALLOW;

    if (!hasPermission) {
      return next(new AppError('Forbidden: Insufficient permissions', 403));
    }

    next();
  });
};

module.exports = authorize;
module.exports.clearCache = clearCache;
