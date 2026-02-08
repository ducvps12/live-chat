/**
 * Audit Controller
 * API endpoints for audit logs
 */
const asyncHandler = require('../../utils/asyncHandler');
const AppError = require('../../utils/AppError');
const auditRepo = require('./audit.repo');

/**
 * GET /api/embed/workspaces/:workspaceId/audit-logs
 * Get audit logs for a workspace
 */
const getAuditLogs = asyncHandler(async (req, res) => {
    const { workspaceId } = req.params;
    const { action, resourceType, dateFrom, dateTo, limit = 100, offset = 0 } = req.query;
    const user = req.user;

    if (!user) {
        throw new AppError('Authentication required', 401);
    }

    const logs = await auditRepo.getLogsByWorkspace(workspaceId, {
        action,
        resourceType,
        dateFrom,
        dateTo,
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10)
    });

    res.status(200).json({
        status: 'success',
        data: {
            logs,
            count: logs.length
        }
    });
});

module.exports = {
    getAuditLogs
};
