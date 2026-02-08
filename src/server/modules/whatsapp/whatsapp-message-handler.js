/**
 * WhatsApp Message Handler
 * Handles incoming messages using Virtual Widget pattern
 * Same architecture as Facebook message handler
 */
const { v4: uuidv4 } = require('uuid');
const conversationRepo = require('../embed/conversation.repo');
const messageRepo = require('../embed/message.repo');
const whatsappRepo = require('./repos/whatsapp.repo');
const whatsappService = require('./whatsapp.service');

/**
 * Get or create virtual widget for WhatsApp account
 */
const getOrCreateWhatsAppWidget = async (accountKey, workspaceKey) => {
    const { getPool } = require('../../infra/mysql/mysql');
    const pool = getPool();

    const sourceUrl = `whatsapp://account/${accountKey}`;

    const [rows] = await pool.execute(
        'SELECT WidgetKey, SiteKey, Name FROM iam_Widgets WHERE WorkspaceKey = ? AND SourceUrl = ?',
        [workspaceKey, sourceUrl]
    );

    if (rows.length > 0) {
        return rows[0];
    }

    // Get account info for widget name
    const account = await whatsappRepo.findByKey(accountKey);
    const widgetName = `WhatsApp: ${account?.DisplayNumber || 'Unknown'}`;

    // Create virtual widget
    const siteKey = `wa-${accountKey}-${Date.now()}`;

    const [result] = await pool.execute(
        'INSERT INTO iam_Widgets (WorkspaceKey, Name, SiteKey, SourceUrl, Status, CreatedAt) VALUES (?, ?, ?, ?, 1, UTC_TIMESTAMP(3))',
        [workspaceKey, widgetName, siteKey, sourceUrl]
    );

    const [newRows] = await pool.execute(
        'SELECT WidgetKey, SiteKey, Name FROM iam_Widgets WHERE WidgetKey = ?',
        [result.insertId]
    );

    console.log(`[WhatsApp] Created virtual widget: ${widgetName}`);
    return newRows[0];
};

/**
 * Find or create conversation for WhatsApp user
 */
const findOrCreateConversation = async (widgetKey, senderPhone, senderName, accountKey) => {
    const visitorId = senderPhone;

    let conversation = await conversationRepo.findActiveByVisitor(widgetKey, visitorId);

    if (conversation) {
        if (senderName && senderName !== conversation.VisitorName) {
            await conversationRepo.updateConversationMetadata(conversation.ConversationKey, {
                visitorName: senderName
            });
        }
        return conversation;
    }

    const sourceUrl = `whatsapp://account/${accountKey}`;
    conversation = await conversationRepo.createConversation({
        widgetKey,
        visitorId,
        visitorName: senderName || senderPhone,
        sourceUrl
    });

    console.log(`[WhatsApp] Created conversation for ${senderName || senderPhone}`);
    return conversation;
};

/**
 * Process incoming WhatsApp message
 */
const processIncomingMessage = async (account, senderId, senderName, message) => {
    try {
        const widget = await getOrCreateWhatsAppWidget(account.AccountKey, account.WorkspaceKey);

        const conversation = await findOrCreateConversation(
            widget.WidgetKey,
            senderId,
            senderName,
            account.AccountKey
        );

        let content = '';
        let messageType = 'text';

        if (message.type === 'text') {
            content = message.text?.body || '';
        } else if (message.type === 'image') {
            content = '[Image]';
            messageType = 'image';
        } else if (message.type === 'audio') {
            content = '[Audio]';
            messageType = 'audio';
        } else if (message.type === 'video') {
            content = '[Video]';
            messageType = 'video';
        } else if (message.type === 'document') {
            content = `[Document: ${message.document?.filename || 'file'}]`;
            messageType = 'document';
        } else if (message.type === 'location') {
            content = `[Location: ${message.location?.latitude}, ${message.location?.longitude}]`;
            messageType = 'location';
        } else {
            content = `[${message.type || 'Unknown'}]`;
        }

        const savedMessage = await messageRepo.createMessage({
            conversationKey: conversation.ConversationKey,
            senderType: 1,
            senderId: senderId,
            content: content,
            clientMsgId: message.id
        });

        await conversationRepo.updateConversationSummary(conversation.ConversationKey, {
            seq: savedMessage.seq,
            preview: content.substring(0, 100),
            mongoId: savedMessage.messageId,
            isVisitor: true
        });

        try {
            const { emitToEmbedRoom } = require('../../bootstrap/socket');
            const messageData = {
                id: savedMessage.messageId,
                seq: savedMessage.seq,
                conversationId: conversation.ConversationId,
                visitorId: senderId,
                text: content,
                sender: 'visitor',
                senderType: 1,
                senderId: senderId,
                createdAt: savedMessage.createdAt,
                siteKey: widget.SiteKey,
                source: 'whatsapp'
            };

            emitToEmbedRoom(`agent:site:${widget.SiteKey.toLowerCase()}`, 'embed:message', messageData);

            console.log(`[WhatsApp] Message saved and emitted: ${savedMessage.messageId}`);
        } catch (socketErr) {
            console.error('[WhatsApp] Socket emit error:', socketErr.message);
        }

        return savedMessage;
    } catch (error) {
        console.error('[WhatsApp] Process incoming message error:', error);
        throw error;
    }
};

/**
 * Send message to WhatsApp user (from agent inbox)
 */
const sendMessageToUser = async (accountKey, recipientPhone, text) => {
    try {
        const account = await whatsappRepo.findByKey(accountKey);
        if (!account) {
            throw new Error('WhatsApp account not found');
        }

        const result = await whatsappService.sendMessage(
            account.PhoneNumberId,
            account.AccessToken,
            recipientPhone,
            text
        );

        const widget = await getOrCreateWhatsAppWidget(accountKey, account.WorkspaceKey);
        const conversation = await conversationRepo.findActiveByVisitor(widget.WidgetKey, recipientPhone);

        if (conversation) {
            const savedMessage = await messageRepo.createMessage({
                conversationKey: conversation.ConversationKey,
                senderType: 2,
                content: text,
                clientMsgId: result.messageId
            });

            await conversationRepo.updateConversationSummary(conversation.ConversationKey, {
                seq: savedMessage.seq,
                preview: text.substring(0, 100),
                mongoId: savedMessage.messageId,
                isVisitor: false
            });
        }

        return result;
    } catch (error) {
        console.error('[WhatsApp] Send message to user error:', error);
        throw error;
    }
};

const getAccountKeyFromConversation = (sourceUrl) => {
    if (!sourceUrl || !sourceUrl.startsWith('whatsapp://account/')) {
        return null;
    }
    return parseInt(sourceUrl.replace('whatsapp://account/', ''), 10);
};

module.exports = {
    getOrCreateWhatsAppWidget,
    findOrCreateConversation,
    processIncomingMessage,
    sendMessageToUser,
    getAccountKeyFromConversation
};
