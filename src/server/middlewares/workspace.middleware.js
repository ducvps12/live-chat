const { getPool } = require('../infra/mysql/mysql');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const authenticate = require('./authenticate');

const requireWorkspace = [
    authenticate,
    asyncHandler(async (req, res, next) => {
        const workspaceId = req.headers['x-workspace-id'];

        if (!workspaceId) {
            return next(new AppError('Missing x-workspace-id header', 400));
        }

        const userKey = req.user?.UserKey || req.user?.key;

        if (!userKey) {
            return next(new AppError('Unauthorized: User context required', 401));
        }

        const pool = getPool();

        const [rows] = await pool.execute(
            `SELECT w.WorkspaceKey, w.WorkspaceId, m.MembershipKey
             FROM iam_Workspaces w
             LEFT JOIN iam_Memberships m ON m.WorkspaceKey = w.WorkspaceKey AND m.UserKey = ?
             WHERE w.WorkspaceId = ?`,
            [userKey, workspaceId]
        );

        const record = rows[0];

        if (!record) {
            return next(new AppError('Workspace not found', 404));
        }

        if (!record.MembershipKey) {
            return next(new AppError('Forbidden: Not a member of this workspace', 403));
        }

        req.workspaceKey = record.WorkspaceKey;
        req.workspaceId = record.WorkspaceId;
        req.membershipKey = record.MembershipKey;

        if (req.user) {
            req.user.membershipKey = record.MembershipKey;
        }

        next();
    })
];

module.exports = { requireWorkspace };
