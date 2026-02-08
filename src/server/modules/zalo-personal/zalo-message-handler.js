/**
 * Zalo Message Handler Service
 * Handles incoming AND outgoing Zalo messages and saves them to database
 */

const { getPool } = require('../../infra/mysql/mysql');
const conversationRepo = require('../embed/conversation.repo');
const messageRepo = require('../embed/message.repo');
const { getIO } = require('../../bootstrap/socket');
const { getZaloUserInfo, upsertZaloContact, updateConversationWithUserInfo } = require('./zalo-sync.service');
const { findMatchingRule } = require('./autoreply.service');

// Regex patterns for smart contact extraction (Vietnam standards)
const PHONE_REGEX = /(84|0[3|5|7|8|9])+([0-9]{8})\b/g;
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;

// Smart tags keywords mapping
const AUTO_TAG_KEYWORDS = {
    'giá': 'price_inquiry',
    'bao nhiêu': 'price_inquiry',
    'mua': 'purchase_intent',
    'đặt hàng': 'purchase_intent',
    'order': 'purchase_intent',
    'demo': 'demo_request',
    'dùng thử': 'demo_request',
    'hỗ trợ': 'support_request',
    'lỗi': 'support_request',
    'khiếu nại': 'complaint',
    'hoàn tiền': 'refund_request'
};

/**
 * Parse and normalize Zalo message content based on message type
 */
const parseZaloMessageContent = (msg) => {
    let finalContent = "";
    let messageType = "text";

    const rawContent = msg.data?.content;
    const msgType = msg.data?.msgType || msg.type || "text";

    if (typeof rawContent === 'string') {
        if (rawContent.startsWith('{')) {
            try {
                const parsed = JSON.parse(rawContent);
                if (parsed.type === 7 && parsed.id) {
                    let stickerUrl = parsed.url || parsed.staticUrl || parsed.animationUrl;
                    if (!stickerUrl) {
                        const catId = parsed.catId || 0;
                        stickerUrl = `https://zalo-api.zadn.vn/api/emoticon/sticker/${catId}/${parsed.id}@2x.png`;
                    }
                    finalContent = `[Sticker](${stickerUrl})`;
                    messageType = 'sticker';
                } else if (parsed.href && parsed.title !== undefined) {
                    finalContent = `[Link: ${parsed.title || 'Link'}](${parsed.href})`;
                    messageType = 'link';
                } else if (parsed.thumb || parsed.hdUrl) {
                    const imageUrl = parsed.hdUrl || parsed.normalUrl || parsed.thumb;
                    finalContent = `[Image](${imageUrl})`;
                    messageType = 'image';
                } else {
                    finalContent = rawContent;
                }
            } catch (e) {
                finalContent = rawContent;
            }
        } else {
            finalContent = rawContent;
        }
    }
    else if (rawContent && typeof rawContent === 'object') {
        if (rawContent.thumb || rawContent.hdUrl || rawContent.normalUrl || rawContent.href) {
            const imageUrl = rawContent.hdUrl || rawContent.normalUrl || rawContent.href || rawContent.thumb;
            if (rawContent.title !== undefined && rawContent.href) {
                finalContent = `[Link: ${rawContent.title || 'Link'}](${rawContent.href})`;
                if (rawContent.thumb) {
                    finalContent += `\n[Preview](${rawContent.thumb})`;
                }
                messageType = 'link';
            } else {
                finalContent = `[Image](${imageUrl})`;
                messageType = 'image';
            }
        }
        else if (rawContent.type === 7 && rawContent.id) {
            let stickerUrl = rawContent.url || rawContent.staticUrl || rawContent.animationUrl;
            if (!stickerUrl) {
                const catId = rawContent.catId || 0;
                stickerUrl = `https://zalo-api.zadn.vn/api/emoticon/sticker/${catId}/${rawContent.id}@2x.png`;
            }
            finalContent = `[Sticker](${stickerUrl})`;
            messageType = 'sticker';
        }
        else if (rawContent.fileName) {
            const fileUrl = rawContent.href || rawContent.fileUrl || '';
            finalContent = `[File: ${rawContent.fileName}](${fileUrl})`;
            messageType = 'file';
        }
        else if (rawContent.params?.width && rawContent.params?.height && rawContent.thumb) {
            finalContent = `[GIF](${rawContent.thumb})`;
            messageType = 'gif';
        }
        else if (rawContent.duration !== undefined && (rawContent.url || rawContent.fileUrl)) {
            finalContent = `[Voice: ${Math.round(rawContent.duration / 1000)}s](${rawContent.url || rawContent.fileUrl})`;
            messageType = 'voice';
        }
        else if (rawContent.latitude !== undefined && rawContent.longitude !== undefined) {
            finalContent = `[Location](https://maps.google.com/?q=${rawContent.latitude},${rawContent.longitude})`;
            messageType = 'location';
        }
        else {
            finalContent = `[${msgType.toUpperCase()}] Không hỗ trợ hiển thị`;
            messageType = msgType;
        }
    }
    else if (msg.data?.quote) {
        finalContent = msg.data.quote.msg || '[Reply message]';
        messageType = 'quote';
    }

    return { content: finalContent || '', messageType };
};

/**
 * Extract human-readable preview text from Zalo message content
 */
const extractReadablePreview = (content) => {
    if (!content || typeof content !== 'string') return '';

    if (content.startsWith('[Image]')) return '🖼️ [Hình ảnh]';
    if (content.startsWith('[Sticker]')) return '🎨 [Sticker]';
    if (content.startsWith('[GIF]')) return '🎬 [GIF]';
    if (content.startsWith('[File:')) {
        const match = content.match(/\[File: (.+?)\]/);
        return match ? `📎 ${match[1]}` : '📎 [File]';
    }
    if (content.startsWith('[Link:')) {
        const match = content.match(/\[Link: (.+?)\]/);
        return match ? `🔗 ${match[1]}` : '🔗 [Link]';
    }
    if (content.startsWith('[Voice:')) return '🎤 [Tin nhắn thoại]';
    if (content.startsWith('[Location]')) return '📍 [Vị trí]';

    try {
        if (content.startsWith('{')) {
            const parsed = JSON.parse(content);

            if (parsed.title && parsed.href) {
                return `🔗 ${parsed.title}`;
            }
            if (parsed.type === 7 && parsed.id) {
                return '🎨 [Sticker]';
            }
            if (parsed.thumb || parsed.hdUrl) {
                return '🖼️ [Hình ảnh]';
            }
            if (parsed.fileName) {
                return `📎 ${parsed.fileName}`;
            }
        }
    } catch {
        // Not JSON, return as-is
    }

    return content;
};

/**
 * Get or create a Zalo Widget for a workspace
 */
const getOrCreateZaloWidget = async (workspaceId) => {
    const pool = getPool();

    const [wsRows] = await pool.execute(
        'SELECT WorkspaceKey FROM iam_Workspaces WHERE WorkspaceId = ?',
        [workspaceId]
    );

    if (!wsRows[0]) {
        throw new Error('Workspace not found');
    }

    const workspaceKey = wsRows[0].WorkspaceKey;

    const [widgetRows] = await pool.execute(
        "SELECT WidgetKey, WidgetId, SiteKey FROM iam_Widgets WHERE WorkspaceKey = ? AND Name = 'Zalo Personal'",
        [workspaceKey]
    );

    if (widgetRows[0]) {
        return widgetRows[0];
    }

    // Create new Zalo widget for this workspace
    console.log('[ZaloHandler] Creating Zalo widget for workspace:', workspaceId);
    const siteKey = `zalo_${workspaceId.substring(0, 8)}`;

    const [result] = await pool.execute(
        `INSERT INTO iam_Widgets (WorkspaceKey, Name, Status, SiteKey, AllowedDomains, Theme)
         VALUES (?, 'Zalo Personal', 1, ?, 'zalo.me', '{}')`,
        [workspaceKey, siteKey]
    );

    const [newRows] = await pool.execute(
        'SELECT WidgetKey, WidgetId, SiteKey FROM iam_Widgets WHERE WidgetKey = ?',
        [result.insertId]
    );

    return newRows[0];
};

/**
 * Find or create conversation for a Zalo contact
 */
const findOrCreateConversation = async (widgetKey, zaloUserId, zaloUserName) => {
    const existing = await conversationRepo.findActiveByVisitor(widgetKey, zaloUserId);

    if (existing) {
        return existing;
    }

    console.log('[ZaloHandler] Creating new conversation for Zalo user:', zaloUserId);
    return await conversationRepo.createConversation({
        widgetKey,
        visitorId: zaloUserId,
        visitorName: zaloUserName || `Zalo User ${zaloUserId.substring(0, 6)}`,
        sourceUrl: 'zalo://personal'
    });
};

/**
 * Extract and save contact info from message content
 */
const extractAndSaveContactInfo = async (workspaceId, conversationKey, messageContent) => {
    if (!messageContent || typeof messageContent !== 'string') return;

    try {
        const phones = messageContent.match(PHONE_REGEX);
        const emails = messageContent.match(EMAIL_REGEX);

        if (!phones?.length && !emails?.length) return;

        const pool = getPool();
        const updates = [];
        const params = [];

        if (phones?.length) {
            let phone = phones[0];
            if (phone.startsWith('0')) {
                phone = '+84' + phone.substring(1);
            } else if (phone.startsWith('84')) {
                phone = '+' + phone;
            }
            updates.push('VisitorPhone = IFNULL(VisitorPhone, ?)');
            params.push(phone);
            console.log('[ZaloHandler] Detected phone:', phone);
        }

        if (emails?.length) {
            updates.push('VisitorEmail = IFNULL(VisitorEmail, ?)');
            params.push(emails[0].toLowerCase());
            console.log('[ZaloHandler] Detected email:', emails[0]);
        }

        if (updates.length > 0) {
            params.push(conversationKey);
            await pool.execute(
                `UPDATE iam_WidgetConversations 
                 SET ${updates.join(', ')}, UpdatedAt = UTC_TIMESTAMP(3)
                 WHERE ConversationKey = ?`,
                params
            );

            console.log('[ZaloHandler] Contact info saved to conversation:', conversationKey);
        }
    } catch (error) {
        console.warn('[ZaloHandler] Contact extraction error:', error.message);
    }
};

/**
 * Process Zalo message (both incoming and outgoing)
 */
const processIncomingMessage = async (workspaceId, accountId, message, selfUserId = null) => {
    try {
        console.log('[ZaloHandler] Processing message for workspace:', workspaceId);

        // ========== RAW MESSAGE DEBUG ==========
        console.log('[ZaloHandler] ====== RAW MESSAGE STRUCTURE ======');
        console.log('[ZaloHandler] FULL MESSAGE JSON:', JSON.stringify(message, null, 2));
        console.log('[ZaloHandler] message.isSelf:', message.isSelf);
        console.log('[ZaloHandler] message.fromMe:', message.fromMe);
        console.log('[ZaloHandler] message.threadId:', message.threadId);
        console.log('[ZaloHandler] message.data?.uidFrom:', message.data?.uidFrom);
        console.log('[ZaloHandler] message.data?.idTo:', message.data?.idTo);
        console.log('[ZaloHandler] message.data?.uidTo:', message.data?.uidTo);
        console.log('[ZaloHandler] message.data?.toId:', message.data?.toId);
        console.log('[ZaloHandler] message.data?.isSelf:', message.data?.isSelf);
        console.log('[ZaloHandler] message.data?.fromMe:', message.data?.fromMe);
        console.log('[ZaloHandler] selfUserId passed:', selfUserId);

        const senderId = message.data?.uidFrom || message.data?.fromId || message.data?.userId || message.threadId;
        const recipientId = message.data?.idTo || message.data?.uidTo || message.data?.toId || message.data?.threadId;
        const senderName = message.data?.dName || message.senderName || 'Unknown';

        const { content, messageType } = parseZaloMessageContent(message);

        if (!content) {
            console.log('[ZaloHandler] Skipping empty message');
            return null;
        }

        console.log(`[ZaloHandler] Parsed message type: ${messageType}`);

        // ========== DIRECTION DETECTION (ENHANCED) ==========
        const senderIdStr = String(senderId || '');
        const recipientIdStr = String(recipientId || '');
        const selfUserIdStr = String(selfUserId || '');

        const isSelfFlag = message.isSelf === true ||
            message.data?.isSelf === true ||
            message.data?.fromMe === true ||
            message.fromMe === true;

        const isSenderSelf = senderIdStr && selfUserIdStr && senderIdStr === selfUserIdStr;

        const isOutgoing = isSelfFlag || isSenderSelf;
        const direction = isOutgoing ? 'sent' : 'received';

        const senderType = isOutgoing ? 2 : 1;
        const senderLabel = isOutgoing ? 'agent' : 'visitor';

        // ========== CRITICAL: VISITOR ID LOGIC ==========
        const visitorId = isOutgoing ? recipientIdStr : senderIdStr;
        const contactName = isOutgoing ? (message.data?.toName || message.data?.dName || 'Customer') : senderName;

        console.log(`[ZaloHandler] ====== DIRECTION RESULT ======`);
        console.log(`[ZaloHandler] isSelfFlag: ${isSelfFlag} | isSenderSelf: ${isSenderSelf}`);
        console.log(`[ZaloHandler] senderId: "${senderIdStr}" | recipientId: "${recipientIdStr}" | selfUserId: "${selfUserIdStr}"`);
        console.log(`[ZaloHandler] isOutgoing: ${isOutgoing} | direction: ${direction} | senderType: ${senderType} (${senderLabel})`);
        console.log(`[ZaloHandler] VISITOR ID (thread): "${visitorId}" | contactName: "${contactName}"`);

        // Get or create Zalo widget for workspace
        const widget = await getOrCreateZaloWidget(workspaceId);

        const conversation = await findOrCreateConversation(
            widget.WidgetKey,
            visitorId,
            contactName
        );

        // ========== DEDUPLICATION CHECK ==========
        const externalMsgId = message.msgId || message.data?.msgId || null;

        if (externalMsgId) {
            const pool = getPool();
            const [existingRows] = await pool.execute(
                'SELECT MessageId, MessageKey FROM iam_WidgetMessages WHERE ExternalMsgId = ? AND ConversationKey = ?',
                [externalMsgId, conversation.ConversationKey]
            );

            if (existingRows[0]) {
                console.log(`[ZaloHandler] Duplicate message skipped: ${externalMsgId}`);
                return {
                    messageId: existingRows[0].MessageId,
                    conversationId: conversation.ConversationId,
                    direction: direction,
                    isDuplicate: true
                };
            }
        }

        // Save message to database with ExternalMsgId
        const pool = getPool();
        const [insertResult] = await pool.execute(
            `INSERT INTO iam_WidgetMessages (ConversationKey, SenderType, Content, ExternalMsgId, Source)
             VALUES (?, ?, ?, ?, 'zalo')`,
            [conversation.ConversationKey, senderType, content, externalMsgId]
        );

        const [savedRows] = await pool.execute(
            'SELECT MessageKey, MessageId, CreatedAt FROM iam_WidgetMessages WHERE MessageKey = ?',
            [insertResult.insertId]
        );

        const savedMessage = savedRows[0];
        console.log(`[ZaloHandler] Message saved: ${savedMessage.MessageId} (${direction})`);

        // Update conversation summary
        await conversationRepo.updateConversationSummary(
            conversation.ConversationKey,
            {
                seq: savedMessage.MessageKey,
                preview: extractReadablePreview(content).substring(0, 100),
                mongoId: null,
                isVisitor: !isOutgoing
            }
        );

        // ========== SMART CONTACT EXTRACTION ==========
        if (!isOutgoing) {
            extractAndSaveContactInfo(workspaceId, conversation.ConversationKey, content)
                .catch(err => console.warn('[ZaloHandler] Contact extraction failed:', err.message));

            const threadId = visitorId;
            getZaloUserInfo(workspaceId, threadId)
                .then(async (userInfo) => {
                    if (userInfo) {
                        console.log('[ZaloHandler] Got user info:', userInfo.displayName || userInfo.name);

                        await updateConversationWithUserInfo(conversation.ConversationKey, userInfo);

                        await upsertZaloContact(workspaceId, {
                            zaloId: threadId,
                            name: userInfo.displayName || userInfo.zaloName || userInfo.name,
                            avatar: userInfo.avatar || userInfo.avatarUrl,
                            phone: userInfo.phoneNumber,
                            gender: userInfo.gender,
                        });
                    }
                })
                .catch(err => console.warn('[ZaloHandler] User info enrichment failed:', err.message));
        }

        // Emit real-time update via Socket.IO
        try {
            const io = getIO();
            if (io) {
                const embedNamespace = io.of('/embed');
                const normalizedSiteKey = widget.SiteKey.toLowerCase();

                const messageData = {
                    id: savedMessage.MessageId,
                    seq: savedMessage.MessageKey,
                    conversationId: conversation.ConversationId,
                    visitorId: visitorId,
                    text: content,
                    sender: senderLabel,
                    senderType: senderType,
                    senderId: isOutgoing ? 'agent' : visitorId,
                    createdAt: savedMessage.CreatedAt,
                    siteKey: widget.SiteKey,
                    source: 'zalo',
                    direction: direction
                };

                const agentRoom = `agent:site:${normalizedSiteKey}`;
                embedNamespace.to(agentRoom).emit('embed:message', messageData);
                console.log(`[ZaloHandler] Emitted to room: ${agentRoom}`);

                const conversationRoom = `embed:${widget.SiteKey}:${visitorId}`;
                embedNamespace.to(conversationRoom).emit('embed:message', messageData);
            }
        } catch (e) {
            console.error('[ZaloHandler] Socket emit error:', e.message);
        }

        return {
            messageId: savedMessage.MessageId,
            conversationId: conversation.ConversationId,
            direction: direction
        };

    } catch (error) {
        console.error('[ZaloHandler] Error processing message:', error);
        throw error;
    }
};

/**
 * Extract smart tags from message content
 */
const extractSmartTags = (messageContent) => {
    if (!messageContent || typeof messageContent !== 'string') return [];

    const normalizedContent = messageContent.toLowerCase();
    const detectedTags = [];

    for (const [keyword, tag] of Object.entries(AUTO_TAG_KEYWORDS)) {
        if (normalizedContent.includes(keyword) && !detectedTags.includes(tag)) {
            detectedTags.push(tag);
        }
    }

    return detectedTags;
};

/**
 * Save detected tags to conversation
 */
const saveSmartTags = async (conversationKey, newTags) => {
    if (!newTags.length) return;

    try {
        const pool = getPool();

        const [rows] = await pool.execute(
            'SELECT Tags FROM iam_WidgetConversations WHERE ConversationKey = ?',
            [conversationKey]
        );

        const existingTags = rows[0]?.Tags
            ? rows[0].Tags.split(',').map(t => t.trim())
            : [];

        const mergedTags = [...new Set([...existingTags, ...newTags])];

        await pool.execute(
            'UPDATE iam_WidgetConversations SET Tags = ?, UpdatedAt = UTC_TIMESTAMP(3) WHERE ConversationKey = ?',
            [mergedTags.join(','), conversationKey]
        );

        console.log('[ZaloHandler] Smart tags saved:', mergedTags);
    } catch (error) {
        console.warn('[ZaloHandler] Smart tags error:', error.message);
    }
};

/**
 * Process auto-reply for incoming message
 */
const processAutoReply = async (workspaceId, threadId, messageContent, zaloClient) => {
    try {
        const matchingRule = await findMatchingRule(workspaceId, messageContent, 'zalo');

        if (matchingRule) {
            console.log('[ZaloHandler] Auto-reply triggered:', matchingRule.name);

            if (zaloClient && zaloClient.sendMessage) {
                await zaloClient.sendMessage(threadId, matchingRule.replyContent);
                console.log('[ZaloHandler] Auto-reply sent successfully');
                return matchingRule.replyContent;
            }
        }
    } catch (error) {
        console.warn('[ZaloHandler] Auto-reply error:', error.message);
    }
    return null;
};

module.exports = {
    getOrCreateZaloWidget,
    findOrCreateConversation,
    processIncomingMessage,
    extractAndSaveContactInfo,
    extractSmartTags,
    saveSmartTags,
    processAutoReply
};
