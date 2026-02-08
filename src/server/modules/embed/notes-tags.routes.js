/**
 * Notes & Tags Routes
 * Modular routes for conversation notes and workspace tags
 */
const express = require('express');
const router = express.Router();
const notesController = require('./notes.controller');
const tagsController = require('./tags.controller');
const authenticate = require('../../middlewares/authenticate');

// ============================================
// NOTES ROUTES
// ============================================

// Get notes for a conversation
router.get('/conversations/:conversationId/notes', authenticate, notesController.getNotes);

// Create a note for a conversation
router.post('/conversations/:conversationId/notes', authenticate, notesController.createNote);

// Delete a note
router.delete('/notes/:noteId', authenticate, notesController.deleteNote);

// ============================================
// TAGS ROUTES
// ============================================

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

module.exports = router;
