/**
 * Facebook Message Handler Service
 * Handles incoming messages from Facebook Messenger webhooks
 * Follows the same Virtual Widget pattern as Zalo Personal
 */

const { getPool } = require('../../infra/mysql/mysql');
const conversationRepo = require('../embed/conversation.repo');
const messageRepo = require('../embed/message.repo');
const { getIO } = require('../../bootstrap/socket');
const facebookRepo = require('./repos/facebook.repo');
const axios = require('axios');
const env = require('../../config/env');

// Facebook Graph API base URL
const FB_GRAPH_URL = 'https://graph.facebook.com/v19.0';

/**
 * Get or create a Facebook Widget for a page
 */
const getOrCreateFacebookWidget = async (pageKey, workspaceKey) => {
    const pool = getPool();

    const [rows] = await pool.execute(
        'SELECT WidgetKey, WidgetId, SiteKey FROM iam_Widgets WHERE WorkspaceKey = ? AND SiteKey = ?',
        [workspaceKey, `fb_page_${pageKey}`]
    );

    if (rows[0]) {
        return rows[0];
    }

    // Get page info for widget name
    const page = await facebookRepo.findByPageKey(pageKey);
    const pageName = page?.FacebookPageName || 'Facebook Page';

    console.log('[FacebookHandler] Creating widget for page:', pageName);
    const [result] = await pool.execute(
        `INSERT INTO iam_Widgets (WorkspaceKey, Name, Status, SiteKey, AllowedDomains, Theme)
         VALUES (?, ?, 1, ?, 'facebook.com', '{}')`,
        [workspaceKey, `Facebook: ${pageName}`, `fb_page_${pageKey}`]
    );

    const [newRows] = await pool.execute(
        'SELECT WidgetKey, WidgetId, SiteKey FROM iam_Widgets WHERE WidgetKey = ?',
        [result.insertId]
    );

    return newRows[0];
};

/**
 * Find or create conversation for a Facebook sender
 */
const findOrCreateConversation = async (widgetKey, senderId, senderName, senderAvatar, pageKey) => {
    const existing = await conversationRepo.findActiveByVisitor(widgetKey, senderId);

    if (existing) {
        return existing;
    }

    console.log('[FacebookHandler] Creating new conversation for FB user:', senderId);
    const conversation = await conversationRepo.createConversation({
        widgetKey,
        visitorId: senderId,
        visitorName: senderName || `Facebook User`,
        sourceUrl: `facebook://page/${pageKey}`
    });

    // Update avatar if available
    if (senderAvatar) {
        const pool = getPool();
        await pool.execute(
            'UPDATE iam_WidgetConversations SET VisitorAvatar = ? WHERE ConversationKey = ?',
            [senderAvatar, conversation.ConversationKey]
        );
    }

    return conversation;
};

/**
 * Get user profile from Facebook
 */
const getUserProfile = async (pageAccessToken, userId) => {
    try {
        const response = await axios.get(`${FB_GRAPH_URL}/${userId}`, {
            params: {
                access_token: pageAccessToken,
                fields: 'name,profile_pic'
            }
        });
        return {
            name: response.data.name,
            avatar: response.data.profile_pic
        };
    } catch (error) {
        console.warn('[FacebookHandler] Failed to get user profile:', error.message);
        return null;
    }
};

/**
 * Process incoming message from Facebook webhook
 */
const processIncomingMessage = async (page, senderId, message, timestamp) => {
    try {
        console.log('[FacebookHandler] Processing message for page:', page.FacebookPageName);

        const content = message.text || '';
        const attachments = message.attachments || [];

        if (!content && attachments.length === 0) {
            console.log('[FacebookHandler] Skipping empty message');
            return null;
        }

        const widget = await getOrCreateFacebookWidget(page.PageKey, page.WorkspaceKey);

        let senderName = null;
        let senderAvatar = null;
        const profile = await getUserProfile(page.PageAccessToken, senderId);
        if (profile) {
            senderName = profile.name;
            senderAvatar = profile.avatar;
        }

        const conversation = await findOrCreateConversation(
            widget.WidgetKey,
            senderId,
            senderName,
            senderAvatar,
            page.PageKey
        );

        let messageContent = content;
        if (attachments.length > 0) {
            const attachmentTypes = attachments.map(a => a.type).join(', ');
            if (content) {
                messageContent = `${content} [${attachmentTypes}]`;
            } else {
                messageContent = `[${attachmentTypes}]`;
            }
        }

        const savedMessage = await messageRepo.createMessage({
            conversationKey: conversation.ConversationKey,
            senderType: 1,
            content: messageContent
        });

        console.log('[FacebookHandler] Message saved:', savedMessage.MessageId);

        await conversationRepo.updateConversationSummary(
            conversation.ConversationKey,
            {
                seq: savedMessage.MessageKey,
                preview: messageContent.substring(0, 100),
                mongoId: null,
                isVisitor: true
            }
        );

        // Get workspace ID for Socket.IO
        const pool = getPool();
        const [wsRows] = await pool.execute(
            'SELECT WorkspaceId FROM iam_Workspaces WHERE WorkspaceKey = ?',
            [page.WorkspaceKey]
        );

        const workspaceId = wsRows[0]?.WorkspaceId;

        if (workspaceId) {
            emitRealtimeUpdate(workspaceId, conversation, savedMessage, messageContent);
        }

        return {
            messageId: savedMessage.MessageId,
            conversationId: conversation.ConversationId
        };

    } catch (error) {
        console.error('[FacebookHandler] Error processing message:', error);
        throw error;
    }
};

/**
 * Emit real-time Socket.IO events
 */
const emitRealtimeUpdate = (workspaceId, conversation, message, content) => {
    try {
        const io = getIO();
        if (!io) return;

        io.to(`workspace:${workspaceId}`).emit('conversation:update', {
            conversationId: conversation.ConversationId,
            lastMessageAt: new Date().toISOString(),
            lastMessagePreview: content.substring(0, 100),
            source: 'facebook'
        });

        io.to(`conversation:${conversation.ConversationId}`).emit('message:new', {
            id: message.MessageId,
            seq: message.MessageKey,
            sender: 'visitor',
            senderType: 1,
            text: content,
            createdAt: message.CreatedAt,
            source: 'facebook',
            direction: 'received'
        });

        console.log('[FacebookHandler] Real-time events emitted');
    } catch (e) {
        console.error('[FacebookHandler] Socket emit error:', e.message);
    }
};

/**
 * Send message to Facebook user
 */
const sendMessageToUser = async (pageKey, recipientId, messageText) => {
    const page = await facebookRepo.findByPageKey(pageKey);
    if (!page) {
        throw new Error('Page not found');
    }

    const response = await axios.post(`${FB_GRAPH_URL}/me/messages`, {
        recipient: { id: recipientId },
        message: { text: messageText }
    }, {
        params: { access_token: page.PageAccessToken }
    });

    console.log('[FacebookHandler] Message sent to:', recipientId);

    const widget = await getOrCreateFacebookWidget(pageKey, page.WorkspaceKey);
    const conversation = await conversationRepo.findActiveByVisitor(widget.WidgetKey, recipientId);

    if (conversation) {
        const savedMessage = await messageRepo.createMessage({
            conversationKey: conversation.ConversationKey,
            senderType: 2,
            content: messageText
        });

        await conversationRepo.updateConversationSummary(
            conversation.ConversationKey,
            {
                seq: savedMessage.MessageKey,
                preview: messageText.substring(0, 100),
                mongoId: null,
                isVisitor: false
            }
        );

        return {
            messageId: savedMessage.MessageId,
            facebookMessageId: response.data.message_id
        };
    }

    return {
        facebookMessageId: response.data.message_id
    };
};

/**
 * Get page key from conversation
 */
const getPageKeyFromConversation = async (conversationId) => {
    const pool = getPool();
    const [rows] = await pool.execute(
        'SELECT SourceUrl FROM iam_WidgetConversations WHERE ConversationId = ?',
        [conversationId]
    );

    const sourceUrl = rows[0]?.SourceUrl;
    if (sourceUrl && sourceUrl.startsWith('facebook://page/')) {
        return parseInt(sourceUrl.replace('facebook://page/', ''), 10);
    }
    return null;
};

module.exports = {
    getOrCreateFacebookWidget,
    findOrCreateConversation,
    processIncomingMessage,
    sendMessageToUser,
    getUserProfile,
    getPageKeyFromConversation
};
