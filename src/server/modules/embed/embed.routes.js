const express = require('express');
const router = express.Router();
const controller = require('./embed.controller');
const { strictRateLimiter, widgetRateLimiter } = require('../../middlewares/rateLimit');
const authenticate = require('../../middlewares/authenticate');

// ============================================
// PUBLIC ROUTES - No authentication required
// ============================================

// Widget script endpoints (cached, no rate limit needed)
router.get('/widget.js', controller.getWidgetScript);
router.get('/widget.min.js', controller.getWidgetScriptMinified);

// Snippet generation endpoints
router.get('/snippet', controller.getSnippet);
router.get('/snippet/preview', controller.getSnippetPreview);

// Iframe frame endpoint
router.get('/frame', controller.getFrame);

// Demo and admin pages
router.get('/demo', controller.getDemo);
router.get('/admin', controller.getAdmin);

// ============================================
// API ROUTES - With rate limiting
// ============================================

// Session endpoint for visitors (rate limited)
router.post('/session', strictRateLimiter, controller.createSession);

// File upload endpoint for chat attachments
const fileUpload = require('./file-upload.controller');
router.post('/upload', widgetRateLimiter, fileUpload.uploadMiddleware, fileUpload.uploadFile);

// Conversations list (for agents) - Unified Inbox support (Requires Auth)
// This enables agents to see conversations across ALL their workspaces
router.get('/conversations', authenticate, controller.getConversations);

// Workspace-scoped conversations (Requires Auth)
// GET /api/embed/workspaces/:workspaceId/conversations
router.get('/workspaces/:workspaceId/conversations', authenticate, controller.getWorkspaceConversations);

// Workspace statistics (Requires Auth)
// GET /api/embed/workspaces/:workspaceId/stats
router.get('/workspaces/:workspaceId/stats', authenticate, controller.getWorkspaceStats);

// Search conversations in workspace (Requires Auth)
// GET /api/embed/workspaces/:workspaceId/conversations/search?keyword=&status=&dateFrom=&dateTo=
router.get('/workspaces/:workspaceId/conversations/search', authenticate, controller.searchConversations);

// Update conversation status (Requires Auth)
// PATCH /api/embed/conversations/:conversationId/status
router.patch('/conversations/:conversationId/status', authenticate, controller.updateConversationStatus);

// Messages for a conversation with keyset cursor pagination (RECOMMENDED)
router.get('/conversations/:conversationId/messages', controller.getMessagesBySeq);

// Mark conversation as read
router.post('/conversations/:conversationId/read', authenticate, controller.markRead);

// Assign conversation
router.post('/conversations/:conversationId/assign', authenticate, controller.assignConversation);

// Update visitor contact info (email, phone)
router.patch('/conversations/:conversationId/contact', authenticate, controller.updateVisitorContact);

// Messages for a conversation (LEGACY - uses timestamp pagination)
router.get('/messages/:conversationId', controller.getMessages);

// Agent session (for testing admin console)
router.post('/agent-session', controller.createAgentSession);

// Agent send message
router.post('/agent-message', widgetRateLimiter, controller.sendAgentMessage);

// ============================================
// NOTES ROUTES
// ============================================
const notesController = require('./notes.controller');

// Get notes for a conversation
router.get('/conversations/:conversationId/notes', authenticate, notesController.getNotes);

// Create a note for a conversation
router.post('/conversations/:conversationId/notes', authenticate, notesController.createNote);

// Delete a note
router.delete('/notes/:noteId', authenticate, notesController.deleteNote);

// ============================================
// TAGS ROUTES
// ============================================
const tagsController = require('./tags.controller');

// Get all tags for a workspace
router.get('/workspaces/:workspaceId/tags', authenticate, tagsController.getTags);

// Create a new tag in workspace
router.post('/workspaces/:workspaceId/tags', authenticate, tagsController.createTag);

// Delete a tag
router.delete('/tags/:tagId', authenticate, tagsController.deleteTag);

// Get tags for a conversation
router.get('/conversations/:conversationId/tags', authenticate, tagsController.getConversationTags);

// Assign a tag to a conversation
router.post('/conversations/:conversationId/tags/:tagId', authenticate, tagsController.assignTag);

// Remove a tag from a conversation
router.delete('/conversations/:conversationId/tags/:tagId', authenticate, tagsController.removeTag);

// ============================================
// AUDIT LOG ROUTES
// ============================================
const auditController = require('./audit.controller');

// Get audit logs for a workspace
router.get('/workspaces/:workspaceId/audit-logs', authenticate, auditController.getAuditLogs);

module.exports = router;
