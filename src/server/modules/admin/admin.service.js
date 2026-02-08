const adminRepo = require('./admin.repo');

// Dashboard stats - enhanced
const getDashboardStats = async () => {
    const stats = await adminRepo.getDashboardStats();
    return {
        totalUsers: stats.TotalUsers || 0,
        totalWorkspaces: stats.TotalWorkspaces || 0,
        totalAdmins: stats.TotalAdmins || 0,
        activeUsers: stats.ActiveUsers || 0,
        totalWidgets: stats.TotalWidgets || 0,
        totalConversations: stats.TotalConversations || 0,
        totalMessages: stats.TotalMessages || 0
    };
};

// Message stats for charts
const getMessageStats = async (days) => {
    return adminRepo.getMessageStats(days);
};

// Conversation stats for charts
const getConversationStats = async (days) => {
    return adminRepo.getConversationStats(days);
};

// User management
const getUsers = async (options) => {
    return adminRepo.getAllUsers(options);
};

const getUser = async (userKey) => {
    const user = await adminRepo.getUserByKey(userKey);
    if (!user) {
        throw { status: 404, message: 'User not found' };
    }
    return user;
};

const updateUser = async (userKey, data) => {
    await adminRepo.getUserByKey(userKey); // Check exists
    await adminRepo.updateUser(userKey, data);
    return { success: true };
};

const banUser = async (userKey) => {
    await adminRepo.updateUser(userKey, { status: 2 }); // Status 2 = Banned
    return { success: true, message: 'User banned' };
};

const unbanUser = async (userKey) => {
    await adminRepo.updateUser(userKey, { status: 1 }); // Status 1 = Active
    return { success: true, message: 'User unbanned' };
};

const deleteUser = async (userKey) => {
    await adminRepo.deleteUser(userKey); // Status 3 = Deleted
    return { success: true };
};

const toggleAdmin = async (userKey, isAdmin) => {
    await adminRepo.updateUser(userKey, { isSystemAdmin: isAdmin ? 1 : 0 });
    return { success: true, message: isAdmin ? 'User is now admin' : 'Admin rights removed' };
};

// Workspace management
const getWorkspaces = async (options) => {
    return adminRepo.getAllWorkspaces(options);
};

const updateWorkspace = async (workspaceId, data) => {
    await adminRepo.updateWorkspace(workspaceId, data);
    return { success: true };
};

const deleteWorkspace = async (workspaceId) => {
    await adminRepo.deleteWorkspace(workspaceId);
    return { success: true };
};

// Conversation management
const getConversations = async (options) => {
    return adminRepo.getAllConversations(options);
};

const getConversation = async (conversationId) => {
    return adminRepo.getConversationById(conversationId);
};

const deleteConversation = async (conversationId) => {
    await adminRepo.deleteConversation(conversationId);
    return { success: true };
};

module.exports = {
    getDashboardStats,
    getMessageStats,
    getConversationStats,
    getUsers,
    getUser,
    updateUser,
    banUser,
    unbanUser,
    deleteUser,
    toggleAdmin,
    getWorkspaces,
    updateWorkspace,
    deleteWorkspace,
    getConversations,
    getConversation,
    deleteConversation
};
