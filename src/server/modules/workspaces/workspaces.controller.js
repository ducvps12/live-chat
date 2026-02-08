const workspacesService = require('./workspaces.service');
const asyncHandler = require('../../utils/asyncHandler');

// ============================================
// WORKSPACE ENDPOINTS
// ============================================

/**
 * Create a new workspace
 * POST /api/workspaces
 */
const createWorkspace = asyncHandler(async (req, res) => {
    const userKey = req.user?.UserKey || req.user?.key;

    if (!userKey) {
        return res.status(401).json({
            status: 'error',
            message: 'User context not found',
        });
    }

    const { name } = req.body;

    const result = await workspacesService.createWorkspace({
        userKey,
        name,
    });

    res.status(201).json({
        status: 'success',
        data: result,
    });
});

/**
 * List workspaces for current user
 * GET /api/workspaces
 */
const listWorkspaces = asyncHandler(async (req, res) => {
    const userKey = req.user?.UserKey || req.user?.key;

    if (!userKey) {
        return res.status(401).json({
            status: 'error',
            message: 'User context not found',
        });
    }

    const workspaces = await workspacesService.getWorkspacesForUser(userKey);

    res.status(200).json({
        status: 'success',
        data: { workspaces },
    });
});

/**
 * Get workspace details
 * GET /api/workspaces/:workspaceId
 */
const getWorkspace = asyncHandler(async (req, res) => {
    const userKey = req.user?.UserKey || req.user?.key;

    // req.workspace is attached by middleware
    const result = await workspacesService.getWorkspaceDetails(req.workspace.workspaceKey, userKey);

    if (!result) {
        return res.status(404).json({
            status: 'error',
            message: 'Workspace not found',
        });
    }

    res.status(200).json({
        status: 'success',
        data: result,
    });
});

/**
 * Update workspace settings
 * PATCH /api/workspaces/:workspaceId
 * 
 * Requires: workspace.update permission
 */
const updateWorkspace = asyncHandler(async (req, res) => {
    const { name } = req.body;

    const result = await workspacesService.updateWorkspace({
        workspaceKey: req.workspace.workspaceKey,
        name,
    });

    res.status(200).json({
        status: 'success',
        message: 'Workspace updated successfully',
        data: { workspace: result },
    });
});

// ============================================
// DASHBOARD ENDPOINTS
// ============================================

/**
 * Get urgent actions for dashboard
 * GET /api/workspaces/:workspaceId/dashboard/urgent-actions
 * 
 * Returns mock data for now - can be enhanced with real data later
 */
const getUrgentActions = asyncHandler(async (req, res) => {
    // Generate mock urgent actions data
    // TODO: Replace with real data from conversations/tickets
    const actions = [];

    // Sample critical action - missed chats (random for demo)
    const missedChats = Math.floor(Math.random() * 5);
    if (missedChats > 0) {
        actions.push({
            id: 'missed-chats',
            severity: 'critical',
            title: `${missedChats} chat bị bỏ lỡ trong 30 phút qua`,
            description: 'Khách hàng đang chờ phản hồi',
            metadata: {
                count: missedChats,
                affectedItems: ['Facebook Messenger', 'Zalo'],
            },
            actions: [
                { label: 'Vào Inbox', icon: 'inbox', variant: 'primary', action: 'view-inbox' },
                { label: 'Nhận xử lý', icon: 'person_add', variant: 'secondary', action: 'assign-me' },
            ],
            timestamp: new Date().toISOString(),
        });
    }

    // Sample warning action - SLA breach
    const slaTickets = Math.floor(Math.random() * 3);
    if (slaTickets > 0) {
        actions.push({
            id: 'sla-breach',
            severity: 'warning',
            title: `SLA sắp vượt ngưỡng: ${slaTickets} ticket`,
            description: 'Cần xử lý trước khi hết thời gian cam kết',
            metadata: {
                count: slaTickets,
                timeRemaining: '45 phút',
            },
            actions: [
                { label: 'Xem Ticket', icon: 'confirmation_number', variant: 'primary', action: 'view-tickets' },
            ],
            timestamp: new Date().toISOString(),
        });
    }

    // Sample info action - bot status
    actions.push({
        id: 'bot-disabled',
        severity: 'info',
        title: 'Bot Auto-Reply đang tắt',
        description: 'Bật bot để tự động phản hồi khi ngoài giờ làm việc',
        actions: [
            { label: 'Cấu hình Bot', icon: 'smart_toy', variant: 'secondary', action: 'configure-bot' },
        ],
        timestamp: new Date().toISOString(),
    });

    res.status(200).json({
        status: 'success',
        data: {
            actions,
            lastUpdated: new Date().toISOString(),
        },
    });
});

// ============================================
// INVITE ENDPOINTS
// ============================================

/**
 * Invite a member to workspace
 * POST /api/workspaces/:workspaceId/invites
 * 
 * Requires: member.invite permission
 * RULE: Cannot invite with role "Owner"
 */
const inviteMember = asyncHandler(async (req, res) => {
    const { email, role } = req.body;

    const result = await workspacesService.inviteMember({
        workspaceKey: req.workspace.workspaceKey,
        membershipKey: req.workspace.membershipKey,
        email,
        role,
    });

    res.status(201).json({
        status: 'success',
        message: 'Invite sent successfully',
        data: result,
    });
});

/**
 * Validate invite token and return invite info
 * GET /api/invites/validate/:token
 * 
 * Public endpoint - no authentication required
 */
const validateInviteToken = asyncHandler(async (req, res) => {
    const { token } = req.params;

    const result = await workspacesService.validateInviteToken({ token });

    res.status(200).json({
        status: 'success',
        data: result,
    });
});

/**
 * Accept an invite
 * POST /api/workspaces/invites/accept
 * 
 * Requires: authentication only (no workspace context)
 */
const acceptInvite = asyncHandler(async (req, res) => {
    const userKey = req.user?.UserKey || req.user?.key;
    const { token } = req.body;

    const result = await workspacesService.acceptInvite({
        token,
        userKey,
    });

    res.status(200).json({
        status: 'success',
        message: 'Welcome to the workspace!',
        data: result,
    });
});

/**
 * List pending invites
 * GET /api/workspaces/:workspaceId/invites
 * 
 * Requires: member.read permission
 */
const listInvites = asyncHandler(async (req, res) => {
    const invites = await workspacesService.listInvites(req.workspace.workspaceKey);

    res.status(200).json({
        status: 'success',
        data: { invites },
    });
});

/**
 * Revoke an invite
 * DELETE /api/workspaces/:workspaceId/invites/:inviteKey
 * 
 * Requires: member.invite permission
 */
const revokeInvite = asyncHandler(async (req, res) => {
    const { inviteKey } = req.params;

    await workspacesService.revokeInvite({
        workspaceKey: req.workspace.workspaceKey,
        inviteKey,
        membershipKey: req.workspace.membershipKey,
    });

    res.status(200).json({
        status: 'success',
        message: 'Invite revoked',
    });
});

/**
 * Resend an invite
 * POST /api/workspaces/:workspaceId/invites/:inviteKey/resend
 * 
 * Requires: member.invite permission
 */
const resendInvite = asyncHandler(async (req, res) => {
    const { inviteKey } = req.params;

    console.log('[DEBUG] Controller resendInvite:', {
        workspace: req.workspace,
        inviteKey
    });

    const result = await workspacesService.resendInvite({
        workspaceKey: req.workspace.workspaceKey,
        inviteKey,
    });

    res.status(200).json({
        status: 'success',
        message: 'Invite resent successfully',
        data: result,
    });
});

// ============================================
// MEMBER ENDPOINTS
// ============================================

/**
 * List members of workspace
 * GET /api/workspaces/:workspaceId/members
 * 
 * Requires: member.read permission
 */
const listMembers = asyncHandler(async (req, res) => {
    const members = await workspacesService.listMembers(req.workspace.workspaceKey);

    res.status(200).json({
        status: 'success',
        data: { members },
    });
});

/**
 * Remove a member from workspace
 * DELETE /api/workspaces/:workspaceId/members/:membershipKey
 * 
 * Requires: member.remove permission
 * RULE: Cannot remove an Owner
 */
const removeMember = asyncHandler(async (req, res) => {
    const { membershipKey } = req.params;

    await workspacesService.removeMember({
        workspaceKey: req.workspace.workspaceKey,
        targetMembershipKey: parseInt(membershipKey),
        actorMembershipKey: req.workspace.membershipKey,
    });

    res.status(200).json({
        status: 'success',
        message: 'Member removed',
    });
});

/**
 * Assign role to member
 * PATCH /api/workspaces/:workspaceId/members/:membershipKey/role
 * 
 * Requires: role.manage permission
 * RULE: Cannot assign "Owner" role
 */
const assignRole = asyncHandler(async (req, res) => {
    const { membershipKey } = req.params;
    const { role } = req.body;

    await workspacesService.assignRole({
        workspaceKey: req.workspace.workspaceKey,
        targetMembershipKey: parseInt(membershipKey),
        role,
        actorMembershipKey: req.workspace.membershipKey,
    });

    res.status(200).json({
        status: 'success',
        message: `Role "${role}" assigned successfully`,
    });
});

module.exports = {
    // Workspace
    createWorkspace,
    getWorkspace,
    updateWorkspace,
    listWorkspaces,
    // Dashboard
    getUrgentActions,
    // Invite
    inviteMember,
    validateInviteToken,
    acceptInvite,
    listInvites,
    revokeInvite,
    resendInvite,
    // Members
    listMembers,
    removeMember,
    assignRole,
};
