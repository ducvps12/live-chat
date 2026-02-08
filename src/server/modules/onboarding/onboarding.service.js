const workspaceRepo = require('../workspaces/repos/workspace.repo');
const AppError = require('../../utils/AppError');

/**
 * Check onboarding status for a user
 * @param {number} userKey 
 */
const checkStatus = async (userKey) => {
    // 1. Check if user has any ACTIVE workspaces
    const activeWorkspaces = await workspaceRepo.findActiveWorkspaces(userKey);

    if (activeWorkspaces.length > 0) {
        return {
            needsOnboarding: false,
            hasActiveWorkspace: true,
            draftWorkspace: null
        };
    }

    // 2. Check if user has any DRAFT workspaces
    const draftWorkspaces = await workspaceRepo.findDraftWorkspaces(userKey);
    const draftWorkspace = draftWorkspaces.length > 0 ? draftWorkspaces[0] : null;

    if (draftWorkspace) {
        return {
            needsOnboarding: true,
            hasActiveWorkspace: false,
            draftWorkspace: {
                WorkspaceKey: draftWorkspace.WorkspaceKey,
                WorkspaceId: draftWorkspace.WorkspaceId,
                Name: draftWorkspace.Name,
                Status: draftWorkspace.Status,
                CreatedAt: draftWorkspace.CreatedAt
            }
        };
    }

    // 3. No workspaces at all -> Needs onboarding (step 1 will create draft)
    return {
        needsOnboarding: true,
        hasActiveWorkspace: false,
        draftWorkspace: null
    };
};

/**
 * Complete onboarding for a workspace
 * @param {number} userKey 
 * @param {number} workspaceKey 
 */
const completeOnboarding = async (userKey, workspaceKey) => {
    // Verify workspace belongs to user (and is draft)
    const draftWorkspaces = await workspaceRepo.findDraftWorkspaces(userKey);
    const workspace = draftWorkspaces.find(w => w.WorkspaceKey === parseInt(workspaceKey));

    if (!workspace) {
        throw new AppError('Workspace not found or already active', 404);
    }

    // Validate requirements (e.g. at least 1 widget)
    // For now, we trust the repo's canActivate or just strict check
    const canActivate = await workspaceRepo.canActivate(workspaceKey);
    if (!canActivate) {
        throw new AppError('Cannot activate workspace: Please add a widget first', 400);
    }

    // Activate
    await workspaceRepo.updateStatus(workspaceKey, 1); // 1 = ACTIVE

    return {
        workspaceKey,
        status: 'active'
    };
};

module.exports = {
    checkStatus,
    completeOnboarding
};
