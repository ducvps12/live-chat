/**
 * Tags Controller
 * API endpoints for workspace tags and conversation tag assignments
 */
const asyncHandler = require('../../utils/asyncHandler');
const AppError = require('../../utils/AppError');
const tagsRepo = require('./tags.repo');
const conversationRepo = require('./conversation.repo');

/**
 * GET /api/embed/workspaces/:workspaceId/tags
 * Get all tags for a workspace
 */
const getTags = asyncHandler(async (req, res) => {
    const { workspaceId } = req.params;
    const user = req.user;

    if (!user) {
        throw new AppError('Authentication required', 401);
    }

    const tags = await tagsRepo.getTagsByWorkspace(workspaceId);

    res.status(200).json({
        status: 'success',
        data: { tags }
    });
});

/**
 * POST /api/embed/workspaces/:workspaceId/tags
 * Create a new tag in workspace
 */
const createTag = asyncHandler(async (req, res) => {
    const { workspaceId } = req.params;
    const { name, color } = req.body;
    const user = req.user;

    if (!user) {
        throw new AppError('Authentication required', 401);
    }

    if (!name?.trim()) {
        throw new AppError('Tag name is required', 400);
    }

    // Get workspace key from workspaceId
    const { getPool } = require('../../infra/mysql/mysql');
    const pool = getPool();
    const [wsRows] = await pool.execute(
        'SELECT WorkspaceKey FROM iam_Workspaces WHERE WorkspaceId = ?',
        [workspaceId]
    );

    if (!wsRows[0]) {
        throw new AppError('Workspace not found', 404);
    }

    const tag = await tagsRepo.createTag({
        workspaceKey: wsRows[0].WorkspaceKey,
        name: name.trim(),
        color: color || '#3B82F6'
    });

    res.status(201).json({
        status: 'success',
        data: { tag }
    });
});

/**
 * DELETE /api/embed/tags/:tagId
 * Delete a tag
 */
const deleteTag = asyncHandler(async (req, res) => {
    const { tagId } = req.params;
    const user = req.user;

    if (!user) {
        throw new AppError('Authentication required', 401);
    }

    await tagsRepo.deleteTag(tagId);

    res.status(200).json({
        status: 'success',
        message: 'Tag deleted'
    });
});

/**
 * GET /api/embed/conversations/:conversationId/tags
 * Get tags for a conversation
 */
const getConversationTags = asyncHandler(async (req, res) => {
    const { conversationId } = req.params;
    const user = req.user;

    if (!user) {
        throw new AppError('Authentication required', 401);
    }

    const conv = await conversationRepo.getConversationById(conversationId);
    if (!conv) {
        throw new AppError('Conversation not found', 404);
    }

    const tags = await tagsRepo.getTagsByConversation(conv.ConversationKey);

    res.status(200).json({
        status: 'success',
        data: { tags }
    });
});

/**
 * POST /api/embed/conversations/:conversationId/tags/:tagId
 * Assign a tag to a conversation
 */
const assignTag = asyncHandler(async (req, res) => {
    const { conversationId, tagId } = req.params;
    const user = req.user;

    if (!user) {
        throw new AppError('Authentication required', 401);
    }

    const conv = await conversationRepo.getConversationById(conversationId);
    if (!conv) {
        throw new AppError('Conversation not found', 404);
    }

    await tagsRepo.assignTag(conv.ConversationKey, tagId);

    res.status(200).json({
        status: 'success',
        message: 'Tag assigned'
    });
});

/**
 * DELETE /api/embed/conversations/:conversationId/tags/:tagId
 * Remove a tag from a conversation
 */
const removeTag = asyncHandler(async (req, res) => {
    const { conversationId, tagId } = req.params;
    const user = req.user;

    if (!user) {
        throw new AppError('Authentication required', 401);
    }

    const conv = await conversationRepo.getConversationById(conversationId);
    if (!conv) {
        throw new AppError('Conversation not found', 404);
    }

    await tagsRepo.removeTag(conv.ConversationKey, tagId);

    res.status(200).json({
        status: 'success',
        message: 'Tag removed'
    });
});

module.exports = {
    getTags,
    createTag,
    deleteTag,
    getConversationTags,
    assignTag,
    removeTag
};
