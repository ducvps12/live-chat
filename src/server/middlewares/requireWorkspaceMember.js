const { getPool } = require('../infra/mysql/mysql');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');

const requireWorkspaceMember = asyncHandler(async (req, res, next) => {
    const workspaceId = req.headers['x-workspace-id'] || req.params.workspaceId;

    if (!workspaceId) {
        return next(new AppError('Workspace ID is required (x-workspace-id header)', 400));
    }

    const userKey = req.user?.UserKey || req.user?.key;

    if (!userKey) {
        return next(new AppError('Unauthorized: User context required', 401));
    }

    const pool = getPool();

    const [rows] = await pool.execute(
        `SELECT 
            w.WorkspaceKey, w.WorkspaceId, w.Name AS WorkspaceName, w.Status AS WorkspaceStatus,
            m.MembershipKey, m.MembershipId, m.Status AS MembershipStatus
        FROM iam_Workspaces w
        LEFT JOIN iam_Memberships m ON m.WorkspaceKey = w.WorkspaceKey AND m.UserKey = ?
        WHERE w.WorkspaceId = ?`,
        [userKey, workspaceId]
    );

    const record = rows[0];

    if (!record) {
        return next(new AppError('Forbidden: Not a member of this workspace', 403));
    }

    if (record.WorkspaceStatus !== 1) {
        return next(new AppError('Forbidden: Workspace is not active', 403));
    }

    if (!record.MembershipKey || record.MembershipStatus !== 1) {
        return next(new AppError('Forbidden: Not a member of this workspace', 403));
    }

    req.workspace = {
        workspaceKey: record.WorkspaceKey,
        workspaceId: record.WorkspaceId,
        workspaceName: record.WorkspaceName,
        membershipKey: record.MembershipKey,
        membershipId: record.MembershipId,
    };

    req.workspaceKey = record.WorkspaceKey;
    req.membershipKey = record.MembershipKey;

    if (req.user) {
        req.user.membershipKey = record.MembershipKey;
    }

    next();
});

module.exports = requireWorkspaceMember;
