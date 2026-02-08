const express = require('express');
const router = express.Router();
const controller = require('./workspaces.controller');
const validate = require('../../middlewares/validate');
const schema = require('./workspaces.validate');
const authenticate = require('../../middlewares/authenticate');
const authenticateOptional = require('../../middlewares/authenticateOptional');
const requireWorkspaceMember = require('../../middlewares/requireWorkspaceMember');
const authorize = require('../../middlewares/authorize');
const requireVerified = require('../../middlewares/requireVerified');

// ============================================
// PUBLIC ENDPOINTS (no authentication required)
// ============================================

/**
 * GET /api/workspaces/invites/validate/:token
 * Validate invite token and return invite info
 * Public endpoint - used by accept page to check token before auth
 */
router.get('/invites/validate/:token',
    controller.validateInviteToken
);

// ============================================
// WORKSPACE ENDPOINTS (no workspace context needed)
// ============================================

// All routes below require authentication
router.use(authenticate);

/**
 * POST /api/workspaces
 * Create a new workspace
 */
router.post('/',
    validate(schema.createWorkspace),
    controller.createWorkspace
);

/**
 * GET /api/workspaces
 * List workspaces for current user
 */
router.get('/',
    controller.listWorkspaces
);

// ============================================
// INVITE ACCEPT (no workspace context needed)
// ============================================

/**
 * POST /api/workspaces/invites/accept
 * Accept an invite (token in body)
 */
router.post('/invites/accept',
    authenticateOptional,
    validate(schema.acceptInvite),
    controller.acceptInvite
);

// ============================================
// WORKSPACE-SCOPED ROUTES (require workspace context)
// ============================================

// All routes below require workspace membership
router.use('/:workspaceId', (req, res, next) => {
    // Set workspaceId in headers for requireWorkspaceMember middleware
    if (req.params.workspaceId) {
        req.headers['x-workspace-id'] = req.params.workspaceId;
    }
    next();
}, requireWorkspaceMember);

/**
 * GET /api/workspaces/:workspaceId
 * Get workspace details
 */
router.get('/:workspaceId',
    controller.getWorkspace
);

/**
 * PATCH /api/workspaces/:workspaceId
 * Update workspace settings
 * Requires: workspace.manage permission
 */
router.patch('/:workspaceId',
    authorize('workspace.manage'),
    validate(schema.updateWorkspace),
    controller.updateWorkspace
);

// --- WIDGETS ---
router.use('/:workspaceId/widgets', require('../widgets/widgets.routes'));

// --- BOT ---
router.use('/:workspaceId/bot', require('../bot/bot.routes'));

// --- ANALYTICS ---
router.use('/:workspaceId/analytics', require('../analytics/analytics.routes'));

// --- DASHBOARD ---

/**
 * GET /api/workspaces/:workspaceId/dashboard/urgent-actions
 * Get urgent actions for dashboard Smart Action Center
 */
router.get('/:workspaceId/dashboard/urgent-actions',
    controller.getUrgentActions
);

// --- INVITES ---

/**
 * POST /api/workspaces/:workspaceId/invites
 * Invite a member to workspace
 * Requires: member.invite permission + email verified
 */
router.post('/:workspaceId/invites',
    requireVerified, // Email verification required
    authorize('member.invite'),
    validate(schema.inviteMember),
    controller.inviteMember
);

/**
 * GET /api/workspaces/:workspaceId/invites
 * List pending invites
 * Requires: member.read permission
 */
router.get('/:workspaceId/invites',
    authorize('member.read'),
    controller.listInvites
);

/**
 * DELETE /api/workspaces/:workspaceId/invites/:inviteKey
 * Revoke a pending invite
 * Requires: member.invite permission
 */
router.delete('/:workspaceId/invites/:inviteKey',
    authorize('member.invite'),
    controller.revokeInvite
);

/**
 * POST /api/workspaces/:workspaceId/invites/:inviteKey/resend
 * Resend an invite email
 * Requires: member.invite permission
 */
router.post('/:workspaceId/invites/:inviteKey/resend',
    authorize('member.invite'),
    controller.resendInvite
);

// --- MEMBERS ---

/**
 * GET /api/workspaces/:workspaceId/members
 * List workspace members
 * Requires: member.read permission
 */
router.get('/:workspaceId/members',
    authorize('member.read'),
    controller.listMembers
);

/**
 * DELETE /api/workspaces/:workspaceId/members/:membershipKey
 * Remove a member from workspace
 * Requires: member.remove permission
 */
router.delete('/:workspaceId/members/:membershipKey',
    authorize('member.remove'),
    controller.removeMember
);

/**
 * PATCH /api/workspaces/:workspaceId/members/:membershipKey/role
 * Assign role to member
 * Requires: role.manage permission
 */
router.patch('/:workspaceId/members/:membershipKey/role',
    authorize('role.manage'),
    validate(schema.assignRole),
    controller.assignRole
);

module.exports = router;
