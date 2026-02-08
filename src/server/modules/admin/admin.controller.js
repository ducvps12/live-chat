const adminService = require('./admin.service');

// Dashboard
const getDashboard = async (req, res) => {
    try {
        const stats = await adminService.getDashboardStats();
        res.json(stats);
    } catch (err) {
        console.error('[Admin] Dashboard error:', err);
        res.status(500).json({ error: 'Failed to load dashboard' });
    }
};

// Message stats for charts
const getMessageStats = async (req, res) => {
    try {
        const { days = 7 } = req.query;
        const stats = await adminService.getMessageStats(parseInt(days));
        res.json(stats);
    } catch (err) {
        console.error('[Admin] Message stats error:', err);
        res.status(500).json({ error: 'Failed to load message stats' });
    }
};

// Conversation stats for charts
const getConversationStats = async (req, res) => {
    try {
        const { days = 7 } = req.query;
        const stats = await adminService.getConversationStats(parseInt(days));
        res.json(stats);
    } catch (err) {
        console.error('[Admin] Conversation stats error:', err);
        res.status(500).json({ error: 'Failed to load conversation stats' });
    }
};

// Users
const getUsers = async (req, res) => {
    try {
        const { page = 1, limit = 20, search = '', status } = req.query;
        const result = await adminService.getUsers({
            page: parseInt(page),
            limit: parseInt(limit),
            search,
            status: status !== undefined ? parseInt(status) : null
        });
        res.json(result);
    } catch (err) {
        console.error('[Admin] Get users error:', err);
        res.status(500).json({ error: 'Failed to load users' });
    }
};

const getUser = async (req, res) => {
    try {
        const user = await adminService.getUser(req.params.userKey);
        res.json(user);
    } catch (err) {
        res.status(err.status || 500).json({ error: err.message || 'Failed to load user' });
    }
};

const updateUser = async (req, res) => {
    try {
        const result = await adminService.updateUser(req.params.userKey, req.body);
        res.json(result);
    } catch (err) {
        res.status(err.status || 500).json({ error: err.message || 'Failed to update user' });
    }
};

const banUser = async (req, res) => {
    try {
        const result = await adminService.banUser(req.params.userKey);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: 'Failed to ban user' });
    }
};

const unbanUser = async (req, res) => {
    try {
        const result = await adminService.unbanUser(req.params.userKey);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: 'Failed to unban user' });
    }
};

const deleteUser = async (req, res) => {
    try {
        const result = await adminService.deleteUser(req.params.userKey);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete user' });
    }
};

const toggleAdmin = async (req, res) => {
    try {
        const { isAdmin } = req.body;
        const result = await adminService.toggleAdmin(req.params.userKey, isAdmin);
        res.json(result);
    } catch (err) {
        res.status(err.status || 500).json({ error: err.message || 'Failed to toggle admin' });
    }
};

// Workspaces
const getWorkspaces = async (req, res) => {
    try {
        const { page = 1, limit = 20, search = '' } = req.query;
        const result = await adminService.getWorkspaces({
            page: parseInt(page),
            limit: parseInt(limit),
            search
        });
        res.json(result);
    } catch (err) {
        console.error('[Admin] Get workspaces error:', err);
        res.status(500).json({ error: 'Failed to load workspaces' });
    }
};

const updateWorkspace = async (req, res) => {
    try {
        const result = await adminService.updateWorkspace(req.params.workspaceId, req.body);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: 'Failed to update workspace' });
    }
};

const deleteWorkspace = async (req, res) => {
    try {
        const result = await adminService.deleteWorkspace(req.params.workspaceId);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete workspace' });
    }
};

// Conversations
const getConversations = async (req, res) => {
    try {
        const { page = 1, limit = 20, search = '', status, workspaceId } = req.query;
        const result = await adminService.getConversations({
            page: parseInt(page),
            limit: parseInt(limit),
            search,
            status: status !== undefined ? parseInt(status) : null,
            workspaceId
        });
        res.json(result);
    } catch (err) {
        console.error('[Admin] Get conversations error:', err);
        res.status(500).json({ error: 'Failed to load conversations' });
    }
};

const getConversation = async (req, res) => {
    try {
        const result = await adminService.getConversation(req.params.conversationId);
        if (!result) {
            return res.status(404).json({ error: 'Conversation not found' });
        }
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: 'Failed to load conversation' });
    }
};

const deleteConversation = async (req, res) => {
    try {
        await adminService.deleteConversation(req.params.conversationId);
        res.json({ success: true });
    } catch (err) {
        res.status(err.status || 500).json({ error: err.message || 'Failed to delete conversation' });
    }
};

// Audit Logs
const auditRepo = require('./audit.repo');

const getAuditLogs = async (req, res) => {
    try {
        const { page = 1, limit = 50, action, entityType, actorEmail, status, startDate, endDate } = req.query;
        const result = await auditRepo.getLogs({
            page: parseInt(page),
            limit: parseInt(limit),
            action,
            entityType,
            actorEmail,
            status,
            startDate,
            endDate
        });
        res.json(result);
    } catch (err) {
        console.error('[Admin] Get audit logs error:', err);
        res.status(500).json({ error: 'Failed to load audit logs' });
    }
};

const getAuditActions = async (req, res) => {
    try {
        const actions = await auditRepo.getActions();
        res.json(actions);
    } catch (err) {
        res.status(500).json({ error: 'Failed to load actions' });
    }
};

const getAuditEntityTypes = async (req, res) => {
    try {
        const types = await auditRepo.getEntityTypes();
        res.json(types);
    } catch (err) {
        res.status(500).json({ error: 'Failed to load entity types' });
    }
};

const getAuditStats = async (req, res) => {
    try {
        const { days = 7 } = req.query;
        const stats = await auditRepo.getStats(parseInt(days));
        res.json(stats);
    } catch (err) {
        res.status(500).json({ error: 'Failed to load audit stats' });
    }
};

module.exports = {
    getDashboard,
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
    deleteConversation,
    getAuditLogs,
    getAuditActions,
    getAuditEntityTypes,
    getAuditStats
};

