const { getPool } = require('../../infra/mysql/mysql');
const workspaceRepo = require('./repos/workspace.repo');
const membershipRepo = require('./repos/membership.repo');
const roleRepo = require('./repos/role.repo');
const membershipRoleRepo = require('./repos/membershipRole.repo');
const permissionRepo = require('./repos/permission.repo');
const roleGrantRepo = require('./repos/roleGrant.repo');
const effectivePermissionRepo = require('./repos/effectivePermission.repo');
const auditRepo = require('./repos/audit.repo');
const inviteRepo = require('./repos/invite.repo');
const userRepo = require('../auth/repos/user.repo');
const constants = require('../../config/constants');
const AppError = require('../../utils/AppError');

// ============================================
// WORKSPACE CREATION
// ============================================

const createWorkspace = async ({ userKey, name }) => {
    const pool = getPool();
    const conn = await pool.getConnection();

    try {
        await conn.beginTransaction();

        // 1. Insert workspace
        const workspace = await workspaceRepo.insertWorkspace(name, conn);

        // 2. Insert membership for creator
        const membership = await membershipRepo.insertMembership(
            workspace.WorkspaceKey,
            userKey,
            conn
        );

        // 3. Get or create Owner role
        const ownerRole = await roleRepo.getOrCreateOwnerRole(
            workspace.WorkspaceKey,
            conn
        );

        // 4. Attach Owner role to membership
        await membershipRoleRepo.attachRole(
            membership.MembershipKey,
            ownerRole.RoleKey,
            conn
        );

        // 5. Get permission keys and grant to Owner role
        const permissionKeys = await permissionRepo.getPermissionKeysByCodes(
            constants.OWNER_DEFAULT_PERMISSIONS
        );

        await roleGrantRepo.ensureRoleGrants(
            ownerRole.RoleKey,
            permissionKeys,
            conn
        );

        // 6. Rebuild effective permissions for owner
        await effectivePermissionRepo.rebuild(membership.MembershipKey, conn);

        // 7. Create default roles (Admin, Agent) with permissions
        const adminRole = await roleRepo.getOrCreateDefaultRole(
            workspace.WorkspaceKey,
            'Admin',
            conn
        );
        const adminPermissionKeys = await permissionRepo.getPermissionKeysByCodes(
            constants.ADMIN_DEFAULT_PERMISSIONS
        );
        await roleGrantRepo.ensureRoleGrants(
            adminRole.RoleKey,
            adminPermissionKeys,
            conn
        );

        const agentRole = await roleRepo.getOrCreateDefaultRole(
            workspace.WorkspaceKey,
            'Agent',
            conn
        );
        const agentPermissionKeys = await permissionRepo.getPermissionKeysByCodes(
            constants.AGENT_DEFAULT_PERMISSIONS
        );
        await roleGrantRepo.ensureRoleGrants(
            agentRole.RoleKey,
            agentPermissionKeys,
            conn
        );

        // 8. Log audit event
        await auditRepo.log('workspace.created', {
            actorUserKey: userKey,
            actorMembershipKey: membership.MembershipKey,
            workspaceKey: workspace.WorkspaceKey,
            resourceType: 'workspace',
            resourceKey: workspace.WorkspaceKey,
            metadata: {
                workspaceId: workspace.WorkspaceId,
                name: workspace.Name,
            },
        }, conn);

        await conn.commit();

        return {
            workspace: {
                workspaceKey: workspace.WorkspaceKey,
                workspaceId: workspace.WorkspaceId,
                name: workspace.Name,
                status: workspace.Status,
                createdAt: workspace.CreatedAt,
            },
            membership: {
                membershipKey: membership.MembershipKey,
                membershipId: membership.MembershipId,
                role: 'Owner',
            },
        };
    } catch (err) {
        try {
            await conn.rollback();
        } catch (rollbackErr) {
            console.error('Transaction rollback failed:', rollbackErr);
        }

        if (err.code === 'ER_DUP_ENTRY') {
            throw new AppError('Workspace creation conflict. Please try again.', 409);
        }

        if (err instanceof AppError) {
            throw err;
        }

        console.error('Workspace creation failed:', err);
        throw new AppError('Failed to create workspace', 500);
    } finally {
        conn.release();
    }
};

/**
 * Update workspace settings
 */
const updateWorkspace = async ({ workspaceKey, name, settings }) => {
    const pool = getPool();

    const updates = [];
    const params = [];

    if (name) {
        updates.push('Name = ?');
        params.push(name);
    }

    if (settings) {
        updates.push('Settings = ?');
        const settingsValue = typeof settings === 'object' ? JSON.stringify(settings) : settings;
        params.push(settingsValue);
    }

    if (updates.length === 0) {
        throw new AppError('No fields to update', 400);
    }

    updates.push('UpdatedAt = UTC_TIMESTAMP(3)');
    params.push(workspaceKey);

    const [result] = await pool.execute(
        `UPDATE iam_Workspaces SET ${updates.join(', ')} WHERE WorkspaceKey = ? AND Status = 1`,
        params
    );

    if (result.affectedRows === 0) {
        throw new AppError('Workspace not found', 404);
    }

    const [rows] = await pool.execute(
        'SELECT WorkspaceKey, WorkspaceId, Name, Status, Settings, CreatedAt, UpdatedAt FROM iam_Workspaces WHERE WorkspaceKey = ?',
        [workspaceKey]
    );

    const workspace = rows[0];

    return {
        workspaceKey: workspace.WorkspaceKey,
        workspaceId: workspace.WorkspaceId,
        name: workspace.Name,
        status: workspace.Status,
        settings: workspace.Settings ? JSON.parse(workspace.Settings) : null,
        createdAt: workspace.CreatedAt,
    };
};

/**
 * Get full workspace details with membership
 */
const getWorkspaceDetails = async (workspaceKey, userKey) => {
    const pool = getPool();
    const [rows] = await pool.execute(
        `SELECT 
            w.WorkspaceKey, w.WorkspaceId, w.Name, w.Status, w.Settings, w.CreatedAt, w.UpdatedAt,
            m.MembershipKey, m.MembershipId, m.Status AS MembershipStatus,
            (
                SELECT r.Name 
                FROM iam_MembershipRoles mr 
                JOIN iam_Roles r ON r.RoleKey = mr.RoleKey 
                WHERE mr.MembershipKey = m.MembershipKey
                ORDER BY CASE WHEN r.Name = 'Owner' THEN 0 ELSE 1 END
                LIMIT 1
            ) AS PrimaryRole
        FROM iam_Workspaces w
        JOIN iam_Memberships m ON m.WorkspaceKey = w.WorkspaceKey
        WHERE w.WorkspaceKey = ? AND m.UserKey = ?`,
        [workspaceKey, userKey]
    );

    const row = rows[0];

    if (!row) return null;

    return {
        workspaceKey: row.WorkspaceKey,
        workspaceId: row.WorkspaceId,
        name: row.Name,
        status: row.Status,
        settings: row.Settings ? JSON.parse(row.Settings) : null,
        createdAt: row.CreatedAt,
        updatedAt: row.UpdatedAt,
        membership: {
            membershipKey: row.MembershipKey,
            membershipId: row.MembershipId,
            status: row.MembershipStatus,
            role: row.PrimaryRole || 'User',
        },
    };
};

/**
 * Get workspaces for a user
 */
const getWorkspacesForUser = async (userKey) => {
    const pool = getPool();
    const [rows] = await pool.execute(
        `SELECT 
            w.WorkspaceKey, w.WorkspaceId, w.Name, w.Status, w.Settings, w.CreatedAt,
            m.MembershipKey, m.MembershipId, m.Status AS MembershipStatus,
            (
                SELECT r.Name 
                FROM iam_MembershipRoles mr 
                JOIN iam_Roles r ON r.RoleKey = mr.RoleKey 
                WHERE mr.MembershipKey = m.MembershipKey
                ORDER BY CASE WHEN r.Name = 'Owner' THEN 0 ELSE 1 END
                LIMIT 1
            ) AS PrimaryRole
        FROM iam_Memberships m
        JOIN iam_Workspaces w ON w.WorkspaceKey = m.WorkspaceKey
        WHERE m.UserKey = ? AND m.Status = 1 AND w.Status = 1
        ORDER BY w.CreatedAt DESC`,
        [userKey]
    );

    return rows.map(row => ({
        workspaceKey: row.WorkspaceKey,
        workspaceId: row.WorkspaceId,
        name: row.Name,
        status: row.Status,
        createdAt: row.CreatedAt,
        membership: {
            membershipKey: row.MembershipKey,
            membershipId: row.MembershipId,
            status: row.MembershipStatus,
            role: row.PrimaryRole || 'User',
        },
    }));
};

// ============================================
// MEMBER INVITATION
// ============================================

const inviteMember = async ({ workspaceKey, membershipKey, email, role }) => {
    if (constants.PROTECTED_ROLES.includes(role)) {
        throw new AppError(`Role "${role}" is non-transferable and cannot be assigned via invite`, 403);
    }

    const existingUser = await userRepo.findByEmail(email);
    if (existingUser) {
        const existingMembership = await membershipRepo.findByWorkspaceAndUser(
            workspaceKey,
            existingUser.UserKey
        );
        if (existingMembership) {
            throw new AppError('User is already a member of this workspace', 409);
        }
    }

    const existingInvite = await inviteRepo.findPendingByEmail(workspaceKey, email);
    if (existingInvite) {
        throw new AppError('An invite is already pending for this email', 409);
    }

    const roleRecord = await roleRepo.findByName(workspaceKey, role);
    if (!roleRecord) {
        throw new AppError(`Role "${role}" does not exist in this workspace`, 400);
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invite = await inviteRepo.createInvite({
        workspaceKey,
        email,
        roleName: role,
        invitedByMembershipKey: membershipKey,
        expiresAt,
    });

    await auditRepo.log('member.invited', {
        actorMembershipKey: membershipKey,
        workspaceKey,
        resourceType: 'invite',
        resourceKey: invite.InviteKey,
        metadata: { email, role },
    });

    const workspace = await workspaceRepo.findByKey(workspaceKey);
    const inviterMembership = await membershipRepo.findByKey(membershipKey);
    const inviter = await userRepo.findById(inviterMembership.UserKey);

    try {
        const emailService = require('../../services/email.service');
        await emailService.sendWorkspaceInvite({
            to: email,
            workspaceName: workspace.Name,
            role: role,
            inviterName: inviter.DisplayName || inviter.Email,
            token: invite.token,
            expiresAt: invite.ExpiresAt,
        });
    } catch (emailError) {
        console.error('[EMAIL] Failed to send invite email:', emailError);
    }

    return {
        inviteKey: invite.InviteKey,
        inviteId: invite.InviteId,
        email: invite.Email,
        role: invite.RoleName,
        expiresAt: invite.ExpiresAt,
        ...(process.env.NODE_ENV !== 'production' && { token: invite.token }),
    };
};

const validateInviteToken = async ({ token }) => {
    const invite = await inviteRepo.findByToken(token);

    if (!invite) {
        throw new AppError('Invalid invite token', 400);
    }

    if (invite.Status !== inviteRepo.INVITE_STATUS.PENDING) {
        throw new AppError('Invite is no longer valid', 400);
    }

    if (new Date(invite.ExpiresAt) < new Date()) {
        throw new AppError('Invite has expired', 400);
    }

    const existingUser = await userRepo.findByEmail(invite.Email);

    console.log(`[VALIDATE INVITE] Email: ${invite.Email}, User exists: ${!!existingUser}`);

    return {
        email: invite.Email,
        workspaceName: invite.WorkspaceName,
        role: invite.RoleName,
        expiresAt: invite.ExpiresAt,
        userExists: !!existingUser,
        requiresLogin: !!existingUser,
        requiresRegistration: !existingUser,
    };
};

const acceptInvite = async ({ token, userKey }) => {
    const invite = await inviteRepo.findByToken(token);

    if (!invite) {
        throw new AppError('Invalid invite token', 400);
    }

    if (invite.Status !== inviteRepo.INVITE_STATUS.PENDING) {
        throw new AppError('Invite is no longer valid', 400);
    }

    if (new Date(invite.ExpiresAt) < new Date()) {
        throw new AppError('Invite has expired', 400);
    }

    if (!userKey) {
        throw new AppError('Authentication required to accept invite', 401);
    }

    const user = await userRepo.findById(userKey);
    if (!user) {
        throw new AppError('User not found', 404);
    }

    if (user.Email.toLowerCase() !== invite.Email.toLowerCase()) {
        throw new AppError('This invite is for a different email address', 403);
    }

    const existingMembership = await membershipRepo.findByWorkspaceAndUser(
        invite.WorkspaceKey,
        userKey
    );
    if (existingMembership) {
        throw new AppError('You are already a member of this workspace', 409);
    }

    const roleRecord = await roleRepo.findByName(invite.WorkspaceKey, invite.RoleName);
    if (!roleRecord) {
        throw new AppError('Assigned role no longer exists', 500);
    }

    const pool = getPool();
    const conn = await pool.getConnection();

    try {
        await conn.beginTransaction();

        const membership = await membershipRepo.insertMembership(
            invite.WorkspaceKey,
            userKey,
            conn
        );

        await membershipRoleRepo.attachRole(
            membership.MembershipKey,
            roleRecord.RoleKey,
            conn
        );

        await effectivePermissionRepo.rebuild(membership.MembershipKey, conn);

        await inviteRepo.markAccepted(invite.InviteKey, conn);

        await auditRepo.log('member.joined', {
            actorUserKey: userKey,
            actorMembershipKey: membership.MembershipKey,
            workspaceKey: invite.WorkspaceKey,
            resourceType: 'membership',
            resourceKey: membership.MembershipKey,
            metadata: { role: invite.RoleName, inviteKey: invite.InviteKey },
        }, conn);

        await conn.commit();

        return {
            membershipKey: membership.MembershipKey,
            membershipId: membership.MembershipId,
            workspaceKey: invite.WorkspaceKey,
            workspaceId: invite.WorkspaceId,
            workspaceName: invite.WorkspaceName,
            role: invite.RoleName,
        };
    } catch (err) {
        try {
            await conn.rollback();
        } catch (rollbackErr) {
            console.error('Transaction rollback failed:', rollbackErr);
        }
        throw err;
    } finally {
        conn.release();
    }
};

const listInvites = async (workspaceKey) => {
    const invites = await inviteRepo.findPendingByWorkspace(workspaceKey);
    return invites.map(inv => ({
        inviteKey: inv.InviteKey,
        inviteId: inv.InviteId,
        email: inv.Email,
        role: inv.RoleName,
        invitedBy: inv.InvitedByName,
        expiresAt: inv.ExpiresAt,
        createdAt: inv.CreatedAt,
    }));
};

const revokeInvite = async ({ workspaceKey, inviteKey, membershipKey }) => {
    const invite = await inviteRepo.findPendingByWorkspace(workspaceKey);
    const target = invite.find(i => String(i.InviteKey) === String(inviteKey));

    if (!target) {
        throw new AppError('Invite not found', 404);
    }

    await inviteRepo.revokeInvite(inviteKey);

    await auditRepo.log('member.invite_revoked', {
        actorMembershipKey: membershipKey,
        workspaceKey,
        resourceType: 'invite',
        resourceKey: inviteKey,
        metadata: { email: target.Email },
    });

    return { success: true };
};

const resendInvite = async ({ workspaceKey, inviteKey }) => {
    console.log('[DEBUG] resendInvite:', { workspaceKey, inviteKey });
    const invites = await inviteRepo.findPendingByWorkspace(workspaceKey);
    console.log('[DEBUG] Found invites:', invites.length, invites.map(i => ({ key: i.InviteKey, email: i.Email })));
    const invite = invites.find(i => String(i.InviteKey) === String(inviteKey));

    if (!invite) {
        throw new AppError('Invite not found or already accepted', 404);
    }

    if (new Date(invite.ExpiresAt) < new Date()) {
        throw new AppError('Invite has expired. Please create a new invite.', 400);
    }

    const crypto = require('crypto');
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Update token in database
    await getPool().execute(
        'UPDATE iam_Invites SET TokenHash = ?, UpdatedAt = UTC_TIMESTAMP(3) WHERE InviteKey = ?',
        [tokenHash, inviteKey]
    );

    const workspace = await workspaceRepo.findByKey(workspaceKey);
    const fullInvite = await inviteRepo.findByKey(inviteKey);
    const inviterMembershipKey = fullInvite.InvitedByMembershipKey;
    const inviterMembership = await membershipRepo.findByKey(inviterMembershipKey);
    const inviter = await userRepo.findById(inviterMembership.UserKey);

    try {
        const emailService = require('../../services/email.service');
        await emailService.sendWorkspaceInvite({
            to: invite.Email,
            workspaceName: workspace.Name,
            role: invite.RoleName,
            inviterName: inviter.DisplayName || inviter.Email,
            token: token,
            expiresAt: invite.ExpiresAt,
        });
        console.log(`[EMAIL] Resend invite to ${invite.Email} | Token: ${token}`);
    } catch (emailError) {
        console.error('[EMAIL] Failed to resend invite email:', emailError);
        throw new AppError('Failed to send email', 500);
    }

    return {
        success: true,
        email: invite.Email,
        expiresAt: invite.ExpiresAt,
    };
};

// ============================================
// MEMBER MANAGEMENT
// ============================================

const listMembers = async (workspaceKey) => {
    const pool = getPool();
    const [rows] = await pool.execute(
        `SELECT 
            m.MembershipKey, m.MembershipId, m.Status AS MembershipStatus, m.CreatedAt AS JoinedAt,
            u.UserKey, u.UserId, u.Email, u.DisplayName,
            GROUP_CONCAT(r.Name SEPARATOR ', ') AS Roles
        FROM iam_Memberships m
        JOIN iam_Users u ON u.UserKey = m.UserKey
        LEFT JOIN iam_MembershipRoles mr ON mr.MembershipKey = m.MembershipKey
        LEFT JOIN iam_Roles r ON r.RoleKey = mr.RoleKey
        WHERE m.WorkspaceKey = ? AND m.Status = 1
        GROUP BY m.MembershipKey, m.MembershipId, m.Status, m.CreatedAt,
                 u.UserKey, u.UserId, u.Email, u.DisplayName
        ORDER BY m.CreatedAt ASC`,
        [workspaceKey]
    );

    return rows.map(row => ({
        membershipKey: row.MembershipKey,
        membershipId: row.MembershipId,
        status: row.MembershipStatus,
        joinedAt: row.JoinedAt,
        user: {
            userKey: row.UserKey,
            userId: row.UserId,
            email: row.Email,
            displayName: row.DisplayName,
        },
        roles: row.Roles ? row.Roles.split(', ') : [],
    }));
};

const removeMember = async ({ workspaceKey, targetMembershipKey, actorMembershipKey }) => {
    if (targetMembershipKey === actorMembershipKey) {
        throw new AppError('Cannot remove yourself from workspace', 400);
    }

    const isOwner = await membershipRoleRepo.hasRole(targetMembershipKey, 'Owner');
    if (isOwner) {
        throw new AppError('Cannot remove an Owner from the workspace', 403);
    }

    const pool = getPool();
    const conn = await pool.getConnection();

    try {
        await conn.beginTransaction();

        // Soft delete membership
        await conn.execute(
            'UPDATE iam_Memberships SET Status = 3 WHERE MembershipKey = ?',
            [targetMembershipKey]
        );

        // Remove from MembershipRoles
        await conn.execute(
            'DELETE FROM iam_MembershipRoles WHERE MembershipKey = ?',
            [targetMembershipKey]
        );

        // Clear effective permissions
        await conn.execute(
            'DELETE FROM iam_MembershipEffectivePermissions WHERE MembershipKey = ?',
            [targetMembershipKey]
        );

        // Log audit
        await auditRepo.log('member.removed', {
            actorMembershipKey,
            workspaceKey,
            resourceType: 'membership',
            resourceKey: targetMembershipKey,
        }, conn);

        await conn.commit();

        return { success: true };
    } catch (err) {
        try {
            await conn.rollback();
        } catch (rollbackErr) {
            console.error('Transaction rollback failed:', rollbackErr);
        }
        throw err;
    } finally {
        conn.release();
    }
};

const assignRole = async ({ workspaceKey, targetMembershipKey, role, actorMembershipKey }) => {
    if (constants.PROTECTED_ROLES.includes(role)) {
        throw new AppError(`Role "${role}" is non-transferable and cannot be assigned`, 403);
    }

    const roleRecord = await roleRepo.findByName(workspaceKey, role);
    if (!roleRecord) {
        throw new AppError(`Role "${role}" does not exist in this workspace`, 400);
    }

    await membershipRoleRepo.attachRole(targetMembershipKey, roleRecord.RoleKey);

    await effectivePermissionRepo.rebuild(targetMembershipKey);

    await auditRepo.log('member.role_assigned', {
        actorMembershipKey,
        workspaceKey,
        resourceType: 'membership',
        resourceKey: targetMembershipKey,
        metadata: { role },
    });

    return { success: true };
};

module.exports = {
    // Workspace
    createWorkspace,
    updateWorkspace,
    getWorkspaceDetails,
    getWorkspacesForUser,
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
