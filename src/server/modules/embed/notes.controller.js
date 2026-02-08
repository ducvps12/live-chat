/**
 * Notes Controller
 * API endpoints for conversation notes
 */
const asyncHandler = require('../../utils/asyncHandler');
const AppError = require('../../utils/AppError');
const notesRepo = require('./notes.repo');
const conversationRepo = require('./conversation.repo');

/**
 * GET /api/embed/conversations/:conversationId/notes
 * Get notes for a conversation
 */
const getNotes = asyncHandler(async (req, res) => {
    const { conversationId } = req.params;
    const user = req.user;

    if (!user) {
        throw new AppError('Authentication required', 401);
    }

    // Get conversation to get conversationKey
    const conv = await conversationRepo.getConversationById(conversationId);
    if (!conv) {
        throw new AppError('Conversation not found', 404);
    }

    const notes = await notesRepo.getNotesByConversation(conv.ConversationKey);

    res.status(200).json({
        status: 'success',
        data: { notes }
    });
});

/**
 * POST /api/embed/conversations/:conversationId/notes
 * Create a note for a conversation
 */
const createNote = asyncHandler(async (req, res) => {
    const { conversationId } = req.params;
    const { content } = req.body;
    const user = req.user;

    if (!user) {
        throw new AppError('Authentication required', 401);
    }

    if (!content?.trim()) {
        throw new AppError('Note content is required', 400);
    }

    const conv = await conversationRepo.getConversationById(conversationId);
    if (!conv) {
        throw new AppError('Conversation not found', 404);
    }

    const note = await notesRepo.createNote({
        conversationKey: conv.ConversationKey,
        userKey: user.UserKey,
        content: content.trim()
    });

    res.status(201).json({
        status: 'success',
        data: { note }
    });
});

/**
 * DELETE /api/embed/notes/:noteId
 * Delete a note
 */
const deleteNote = asyncHandler(async (req, res) => {
    const { noteId } = req.params;
    const user = req.user;

    if (!user) {
        throw new AppError('Authentication required', 401);
    }

    await notesRepo.deleteNote(noteId);

    res.status(200).json({
        status: 'success',
        message: 'Note deleted'
    });
});

module.exports = {
    getNotes,
    createNote,
    deleteNote
};
