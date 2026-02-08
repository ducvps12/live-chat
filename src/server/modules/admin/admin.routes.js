const express = require('express');
const router = express.Router();
const adminController = require('./admin.controller');
const authenticate = require('../../middlewares/authenticate');
const { superadminMiddleware } = require('../../middlewares/superadmin.middleware');

// All admin routes require auth + superadmin
router.use(authenticate);
router.use(superadminMiddleware);

// Dashboard
router.get('/dashboard', adminController.getDashboard);
router.get('/stats/messages', adminController.getMessageStats);
router.get('/stats/conversations', adminController.getConversationStats);

// Users
router.get('/users', adminController.getUsers);
router.get('/users/:userKey', adminController.getUser);
router.put('/users/:userKey', adminController.updateUser);
router.post('/users/:userKey/ban', adminController.banUser);
router.post('/users/:userKey/unban', adminController.unbanUser);
router.post('/users/:userKey/admin', adminController.toggleAdmin);
router.delete('/users/:userKey', adminController.deleteUser);

// Workspaces
router.get('/workspaces', adminController.getWorkspaces);
router.put('/workspaces/:workspaceId', adminController.updateWorkspace);
router.delete('/workspaces/:workspaceId', adminController.deleteWorkspace);

// Conversations
router.get('/conversations', adminController.getConversations);
router.get('/conversations/:conversationId', adminController.getConversation);
router.delete('/conversations/:conversationId', adminController.deleteConversation);

// Audit Logs
router.get('/audit-logs', adminController.getAuditLogs);
router.get('/audit-logs/actions', adminController.getAuditActions);
router.get('/audit-logs/entity-types', adminController.getAuditEntityTypes);
router.get('/audit-logs/stats', adminController.getAuditStats);

// Tickets (Kanban) - Admin view
const ticketsController = require('../tickets/tickets.controller');
router.get('/tickets', ticketsController.adminGetAllTickets);

module.exports = router;

