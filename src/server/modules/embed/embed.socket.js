/**
 * Embed Socket Event Handlers
 * Handles realtime messaging for embed chat widget
 * Optimized for high message volume
 */
const embedService = require('./embed.service');
const widgetsService = require('../widgets/widgets.service');
const botService = require('../bot/bot.service');
const dataExtractor = require('./data-extractor.service');

// Store for typing indicators (in-memory, can be upgraded to Redis)
const typingUsers = new Map();

// Message queue for handling bursts
const messageQueues = new Map();
const QUEUE_PROCESS_INTERVAL = 50; // ms

/**
 * Process queued messages for a socket
 */
function processMessageQueue(socket, namespace) {
    const queue = messageQueues.get(socket.id);
    if (!queue || queue.length === 0) return;

    const batch = queue.splice(0, 5); // Process up to 5 messages at a time

    batch.forEach(async ({ messageData, roomName }) => {
        namespace.to(roomName).emit('embed:message', messageData);
    });

    // Schedule next batch if more messages
    if (queue.length > 0) {
        setTimeout(() => processMessageQueue(socket, namespace), QUEUE_PROCESS_INTERVAL);
    }
}

/**
 * Initialize embed namespace handlers
 * @param {Namespace} namespace - Socket.IO namespace
 */
/**
 * Initialize embed namespace handlers
 * @param {Namespace} namespace - Socket.IO namespace
 */
function init(namespace) {
    namespace.on('connection', async (socket) => {
        // ============================================
        // UNIFIED AGENT CONNECTION
        // ============================================
        if (socket.agentData && socket.agentData.isAgent) {
            const { userKey } = socket.agentData;
            console.log(`[Embed] Unified Agent connected: ${userKey}`);

            try {
                // Auto-join rooms for all sites the agent has access to
                const widgets = await widgetsService.getWidgetsByUser(userKey);

                if (widgets.length === 0) {
                    console.warn(`[Embed] Warning: No active widgets found for Agent ${userKey}. Real-time updates may fail.`);
                }

                let count = 0;
                widgets.forEach(w => {
                    const skid = w.SiteKey.toLowerCase();
                    socket.join(`agent:site:${skid}`);
                    count++;
                });
                console.log(`[Embed] Agent ${userKey} joined ${count} site rooms`);

                // Event: Agent explicitly joining a conversation (e.g. for typing events)
                socket.on('embed:agent-join', (payload, callback) => {
                    const { siteKey, visitorId } = payload || {};
                    if (siteKey && visitorId) {
                        const roomName = `embed:${siteKey}:${visitorId}`;
                        socket.join(roomName);
                        if (typeof callback === 'function') callback({ success: true, room: roomName });
                    }
                });

                // Agent might want to leave a conversation room
                socket.on('embed:agent-leave', (payload) => {
                    const { siteKey, visitorId } = payload || {};
                    if (siteKey && visitorId) {
                        socket.leave(`embed:${siteKey}:${visitorId}`);
                    }
                });

                // Agent sending message (Unified Inbox)
                socket.on('embed:agent-message', async (payload, callback) => {
                    try {
                        const { text, conversationId, siteKey, visitorId, clientMsgId } = payload;
                        if (!text || !conversationId) throw new Error('Invalid payload');

                        // Validate GUID format
                        const guidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
                        if (!guidRegex.test(conversationId)) {
                            throw new Error('Invalid conversationId format');
                        }

                        const conv = await embedService.getConversationById(conversationId);
                        if (!conv) throw new Error('Conversation not found');

                        // Create message (Type 2 = Agent)
                        const message = await embedService.createMessage(
                            conv.ConversationKey,
                            text,
                            2, // Sender: Agent
                            userKey, // SenderId: Agent UserKey
                            conversationId,
                            clientMsgId
                        );

                        // Update activity
                        embedService.updateConversationActivityWithSeq(
                            conv.ConversationKey,
                            message.seq,
                            message.content,
                            message.messageId
                        ).catch(console.error);

                        // =============================================
                        // FACEBOOK MESSAGE FORWARDING
                        // If this conversation is from Facebook, forward message to Messenger
                        // =============================================
                        if (conv.SourceUrl && conv.SourceUrl.startsWith('facebook://page/')) {
                            try {
                                const fbMessageHandler = require('../facebook/facebook-message-handler');
                                const pageKey = parseInt(conv.SourceUrl.replace('facebook://page/', ''), 10);
                                // visitorId is the Facebook PSID (stored as VisitorId in conversation)
                                await fbMessageHandler.sendMessageToUser(pageKey, visitorId, text);
                                console.log(`[Embed] Message forwarded to Facebook for page ${pageKey}`);
                            } catch (fbErr) {
                                console.error('[Embed] Failed to forward to Facebook:', fbErr.message);
                                // Don't fail the main flow - message is saved in DB
                            }
                        }

                        // =============================================
                        // WHATSAPP MESSAGE FORWARDING
                        // If this conversation is from WhatsApp, forward message
                        // =============================================
                        if (conv.SourceUrl && conv.SourceUrl.startsWith('whatsapp://account/')) {
                            try {
                                const waMessageHandler = require('../whatsapp/whatsapp-message-handler');
                                const accountKey = parseInt(conv.SourceUrl.replace('whatsapp://account/', ''), 10);
                                // visitorId is the user's phone number
                                await waMessageHandler.sendMessageToUser(accountKey, visitorId, text);
                                console.log(`[Embed] Message forwarded to WhatsApp for account ${accountKey}`);
                            } catch (waErr) {
                                console.error('[Embed] Failed to forward to WhatsApp:', waErr.message);
                                // Don't fail the main flow - message is saved in DB
                            }
                        }

                        // =============================================
                        // ZALO PERSONAL MESSAGE FORWARDING
                        // If this conversation is from Zalo Personal, forward message via zca-js
                        // =============================================
                        if (conv.SourceUrl && conv.SourceUrl === 'zalo://personal') {
                            try {
                                console.log('[Embed] Zalo message forwarding initiated...');
                                console.log('[Embed] Conversation WidgetKey:', conv.WidgetKey);
                                console.log('[Embed] Conversation VisitorId (Zalo UID):', conv.VisitorId);

                                const { getClient } = require('../../services/ZaloBrowser');
                                // Get workspaceId from widget to find Zalo client
                                const widget = await require('./embed.service').getWidgetByKey(conv.WidgetKey);
                                console.log('[Embed] Widget found:', widget ? 'YES' : 'NO');

                                if (widget && widget.WorkspaceId) {
                                    console.log('[Embed] Looking for Zalo client with WorkspaceId:', widget.WorkspaceId);
                                    const zaloClient = getClient(widget.WorkspaceId);
                                    console.log('[Embed] Zalo client found:', zaloClient ? 'YES' : 'NO');

                                    if (zaloClient) {
                                        const isLoggedIn = await zaloClient.isLoggedIn();
                                        console.log('[Embed] Zalo client isLoggedIn:', isLoggedIn);

                                        if (isLoggedIn) {
                                            // Use conv.VisitorId (Zalo user ID) - NOT payload visitorId
                                            const zaloUserId = conv.VisitorId;
                                            console.log('[Embed] Sending to Zalo user:', zaloUserId, 'Text:', text.substring(0, 50));

                                            try {
                                                const sendResult = await zaloClient.sendMessage(zaloUserId, text);
                                                console.log(`[Embed] ✅ Message forwarded to Zalo Personal for user ${zaloUserId}`);
                                                console.log('[Embed] Send result:', JSON.stringify(sendResult || 'ok'));
                                            } catch (sendErr) {
                                                console.error('[Embed] ❌ zaloClient.sendMessage failed:', sendErr.message);
                                                console.error('[Embed] Full send error:', sendErr);

                                                // Detect stale session (ERR_INVALID_URL means zpwServiceMap not populated)
                                                const isSessionStale = sendErr.code === 'ERR_INVALID_URL' ||
                                                    sendErr.message?.includes('Invalid URL') ||
                                                    sendErr.message?.includes('undefined');

                                                if (isSessionStale) {
                                                    console.error('[Embed] ⚠️ Zalo session appears stale - needs re-login');
                                                    // Remove stale session to force re-login
                                                    const { removeSession } = require('../../services/ZaloBrowser');
                                                    if (removeSession) {
                                                        removeSession(widget.WorkspaceId);
                                                    }
                                                }

                                                // Emit error to frontend so user knows message failed
                                                namespace.to(`agent:site:${siteKey?.toLowerCase()}`).emit('embed:zalo_error', {
                                                    conversationId: conversationId,
                                                    error: isSessionStale
                                                        ? 'Phiên Zalo đã hết hạn. Vui lòng kết nối lại Zalo trong Settings.'
                                                        : `Gửi tin nhắn Zalo thất bại: ${sendErr.message}`,
                                                    needsRelogin: isSessionStale,
                                                    timestamp: Date.now()
                                                });
                                            }
                                        } else {
                                            console.warn('[Embed] ⚠️ Zalo client exists but not logged in for workspace:', widget.WorkspaceId);
                                        }
                                    } else {
                                        console.warn('[Embed] ⚠️ No Zalo client found for workspace:', widget.WorkspaceId);
                                    }
                                } else {
                                    console.warn('[Embed] ⚠️ Widget missing or no WorkspaceId');
                                }
                            } catch (zaloErr) {
                                console.error('[Embed] ❌ Failed to forward to Zalo Personal:', zaloErr.message);
                                console.error('[Embed] Full error:', zaloErr);
                                // Don't fail the main flow - message is saved in DB
                            }
                        }

                        const messageData = {
                            id: message.messageId,
                            seq: message.seq,
                            conversationId: conversationId,
                            visitorId: visitorId,
                            text: message.content,
                            sender: 'agent',
                            senderType: 2,
                            senderId: userKey,
                            createdAt: message.createdAt,
                            clientMsgId: message.clientMsgId,
                            siteKey: siteKey
                        };

                        // Broadcast to conversation room (Visitor sees this)
                        const roomName = `embed:${siteKey}:${visitorId}`;
                        namespace.to(roomName).emit('embed:message', messageData);

                        // Broadcast to other Agents
                        const normalizedSiteKey = siteKey.toLowerCase();
                        const agentRoom = `agent:site:${normalizedSiteKey}`;
                        namespace.to(agentRoom).emit('embed:message', messageData);

                        if (typeof callback === 'function') callback({ success: true, data: messageData });
                    } catch (err) {
                        console.error('[Embed] Agent message error:', err);
                        if (typeof callback === 'function') callback({ success: false, error: err.message });
                    }
                });

            } catch (err) {
                console.error('[Embed] Agent join error:', err);
                socket.emit('embed:error', { message: 'Failed to access workspaces' });
            }
            return;
        }

        // ============================================
        // VISITOR CONNECTION
        // ============================================
        const { siteKey, visitorId, widgetKey } = socket.embedData;
        const roomName = `embed:${siteKey}:${visitorId}`;

        console.log(`[Embed] Visitor connected: ${visitorId} for site ${siteKey}`);

        // Auto-join the conversation room
        socket.join(roomName);

        // Initialize message queue for this socket
        messageQueues.set(socket.id, []);

        // Handle join event (explicit join with optional visitor name)
        socket.on('embed:join', async (payload, callback) => {
            try {
                const { visitorName, sourceUrl } = payload || {};

                // Get or create conversation
                const result = await embedService.getOrCreateConversation(
                    widgetKey,
                    visitorId,
                    visitorName,
                    sourceUrl
                );

                // Store conversationId in socket for later use
                socket.conversationId = result.conversationId;
                socket.conversationKey = result.conversationKey;

                const response = {
                    conversationId: result.conversationId,
                    created: result.created
                };

                if (typeof callback === 'function') {
                    callback({ success: true, data: response });
                }

                socket.emit('embed:joined', response);

                // Notify Agents (Unified)
                // New conversation or visitor join - good to notify agent list if we had a "conversation:update" event
                // For now, strictly sticking to requested message flow

                console.log(`[Embed] Visitor ${visitorId} joined conversation ${result.conversationId}`);
            } catch (err) {
                console.error('[Embed] Join error:', err);
                if (typeof callback === 'function') {
                    callback({ success: false, error: err.message });
                }
                socket.emit('embed:error', { code: 'JOIN_ERROR', message: err.message });
            }
        });

        // Handle message sending (optimized with seq ordering)
        socket.on('embed:message', async (payload, callback) => {
            const startTime = Date.now();

            try {
                const { text, clientMsgId } = payload;

                if (!text || typeof text !== 'string') {
                    throw new Error('Text is required');
                }

                // Validate text length
                if (text.length > 2000) {
                    throw new Error('Message too long (max 2000 characters)');
                }

                // Sanitize text (basic)
                const sanitizedText = text.trim().replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');

                if (!sanitizedText) {
                    throw new Error('Message cannot be empty');
                }

                // Get conversation (should have been set in join)
                if (!socket.conversationKey) {
                    // Try to get from DB
                    const conv = await embedService.getConversationByVisitor(widgetKey, visitorId);
                    if (!conv) {
                        throw new Error('Conversation not found. Please join first.');
                    }
                    socket.conversationKey = conv.ConversationKey;
                    socket.conversationId = conv.ConversationId;
                }

                // Save message to MongoDB (includes atomic seq allocation and dedup)
                const message = await embedService.createMessage(
                    socket.conversationKey,
                    sanitizedText,
                    1, // senderType: 1 = visitor
                    visitorId,
                    socket.conversationId,
                    clientMsgId
                );

                // Update SQL metadata with seq safety (prevents LastMessageSeq from going backwards)
                // Run in parallel but don't block response
                embedService.updateConversationActivityWithSeq(
                    socket.conversationKey,
                    message.seq,
                    message.content,
                    message.messageId
                ).catch(err => console.error('[Embed] Failed to update conversation activity:', err));

                // =============================================
                // SMART DATA EXTRACTION
                // Extract phone/email from visitor message and update profile
                // =============================================
                try {
                    const extracted = dataExtractor.extractContactInfo(sanitizedText);
                    if (extracted.phones.length > 0 || extracted.emails.length > 0 || extracted.names.length > 0) {
                        console.log(`[DataExtract] Found: phones=${extracted.phones.length}, emails=${extracted.emails.length}, names=${extracted.names.length}`);

                        // Update visitor profile with extracted data (async, don't block)
                        embedService.updateVisitorContactInfo(visitorId, widgetKey, {
                            phone: extracted.phones[0] || null,
                            email: extracted.emails[0] || null,
                            name: extracted.names[0] || null
                        }).catch(err => console.error('[DataExtract] Failed to update visitor:', err));
                    }
                } catch (extractErr) {
                    console.error('[DataExtract] Error:', extractErr);
                    // Don't fail the main message flow
                }

                // CRITICAL: Build response from DB record, NOT from request payload
                // This ensures "no message mix-up" guarantee
                const messageData = {
                    id: message.messageId,
                    seq: message.seq,
                    conversationId: socket.conversationId, // Add for context
                    visitorId: visitorId,                  // Add for context
                    text: message.content,
                    sender: 'visitor',
                    senderType: message.senderType,
                    senderId: message.senderId || visitorId,
                    createdAt: message.createdAt,
                    clientMsgId: message.clientMsgId,
                    isDuplicate: message.isDuplicate || false,
                    siteKey: siteKey // Useful for Unified Agents to know which site
                };

                // Broadcast to room immediately using DB record
                namespace.to(roomName).emit('embed:message', messageData);

                // Broadcast to Unified Agents watching this site
                const normalizedSiteKey = siteKey.toLowerCase();
                const agentRoom = `agent:site:${normalizedSiteKey}`;
                const roomSize = namespace.adapter.rooms.get(agentRoom)?.size || 0;
                console.log(`[Embed] Broadcasting to agent room: ${agentRoom} (Sockets: ${roomSize})`);

                if (roomSize > 0) {
                    namespace.to(agentRoom).emit('embed:message', messageData);
                } else {
                    console.log(`[Embed] No agents in room ${agentRoom}, skipping broadcast`);
                }

                // =============================================
                // BOT AUTO-REPLY
                // =============================================
                try {
                    // Get workspaceKey from widget
                    const widget = await embedService.getWidgetByKey(widgetKey);
                    if (widget && widget.WorkspaceKey) {
                        const isFirstMessage = socket.isFirstMessage !== false;
                        socket.isFirstMessage = false; // Mark as no longer first message

                        const botResponse = await botService.processMessage(
                            sanitizedText,
                            widget.WorkspaceKey,
                            { isFirstMessage }
                        );

                        if (botResponse) {
                            // Create bot message in DB
                            const botMessage = await embedService.createMessage(
                                socket.conversationKey,
                                typeof botResponse.content === 'string' ? botResponse.content : JSON.stringify(botResponse.content),
                                3, // senderType: 3 = bot
                                'bot',
                                socket.conversationId,
                                null
                            );

                            const botMessageData = {
                                id: botMessage.messageId,
                                seq: botMessage.seq,
                                conversationId: socket.conversationId,
                                visitorId: visitorId,
                                text: botMessage.content,
                                sender: 'bot',
                                senderType: 3,
                                senderId: 'bot',
                                createdAt: botMessage.createdAt,
                                siteKey: siteKey,
                                responseType: botResponse.type,
                                ruleId: botResponse.ruleId,
                                ruleName: botResponse.ruleName
                            };

                            // Delay bot reply slightly for natural feel
                            setTimeout(() => {
                                namespace.to(roomName).emit('embed:message', botMessageData);
                                namespace.to(agentRoom).emit('embed:message', botMessageData);
                            }, 800);

                            console.log(`[Bot] Auto-reply sent for rule: ${botResponse.ruleName}`);
                        }
                    }
                } catch (botErr) {
                    console.error('[Bot] Auto-reply error:', botErr);
                    // Don't fail the main message flow
                }

                if (typeof callback === 'function') {
                    callback({ success: true, data: messageData });
                }

                const duration = Date.now() - startTime;
                if (duration > 100) {
                    console.log(`[Embed] Message from ${visitorId} took ${duration}ms (seq: ${message.seq})`);
                }
            } catch (err) {
                console.error('[Embed] Message error:', err);
                if (typeof callback === 'function') {
                    callback({ success: false, error: err.message });
                }
                socket.emit('embed:error', { code: 'MESSAGE_ERROR', message: err.message });
            }
        });

        // Handle history request (optimized)
        socket.on('embed:history', async (payload, callback) => {
            try {
                const { limit = 30, before } = payload || {};

                if (!socket.conversationId) {
                    // Try to get conversation
                    const conv = await embedService.getConversationByVisitor(widgetKey, visitorId);
                    if (!conv) {
                        if (typeof callback === 'function') {
                            callback({ success: true, data: { messages: [] } });
                        }
                        return;
                    }
                    socket.conversationKey = conv.ConversationKey;
                    socket.conversationId = conv.ConversationId;
                }

                // Validate GUID format to prevent SQL crash
                const guidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
                if (!guidRegex.test(socket.conversationId)) {
                    console.warn(`[Embed] Invalid conversationId format in history request: ${socket.conversationId}`);
                    if (typeof callback === 'function') {
                        callback({ success: false, error: 'Invalid conversation ID' });
                    }
                    return;
                }

                const messages = await embedService.getMessages(
                    socket.conversationId,
                    Math.min(limit, 50),
                    before
                );

                const response = { messages };

                if (typeof callback === 'function') {
                    callback({ success: true, data: response });
                }

                socket.emit('embed:history', response);
            } catch (err) {
                console.error('[Embed] History error:', err);
                if (typeof callback === 'function') {
                    callback({ success: false, error: err.message });
                }
            }
        });

        // Handle typing indicator
        socket.on('embed:typing', (payload) => {
            const { isTyping } = payload || {};
            const event = {
                visitorId,
                isTyping: !!isTyping,
                sender: 'visitor',
                siteKey // Add siteKey for agents
            };

            // Broadcast to room
            socket.to(roomName).emit('embed:typing', event);
            // Broadcast to agents
            socket.to(`agent:site:${siteKey}`).emit('embed:typing', event);
        });

        // Handle seen/read receipt
        socket.on('embed:seen', async (payload) => {
            try {
                const { lastSeenAt } = payload || {};
                // Could update last seen timestamp in DB
                socket.to(roomName).emit('embed:seen', {
                    visitorId,
                    lastSeenAt: lastSeenAt || new Date().toISOString()
                });
            } catch (err) {
                console.error('[Embed] Seen error:', err);
            }
        });

        // Handle agent joining a specific conversation room
        socket.on('embed:agent-join', async (payload, callback) => {
            // Leave empty for visitor mode, they cannot join other rooms
            // Security: maybe verify if visitor allowed? 
            // Currently this event was likely copy-pasted or intended for agent logic which is now separated.
            // We can ignore it or return error for visitors.
            if (typeof callback === 'function') callback({ success: false, error: 'Not allowed' });
        });

        // Handle disconnect
        socket.on('disconnect', () => {
            console.log(`[Embed] Visitor disconnected: ${visitorId}`);
            // Clean up typing indicator and message queue
            typingUsers.delete(`${siteKey}:${visitorId}`);
            messageQueues.delete(socket.id);
        });
    });

    console.log('[Embed] Socket handlers initialized');
}

/**
 * Send message from agent to visitor
 * Called from agent-side endpoints
 * Uses seq ordering and emits from DB record
 */
async function sendAgentMessage(siteKey, visitorId, text, agentId, namespace, clientMsgId = null) {
    const roomName = `embed:${siteKey}:${visitorId}`;

    // Get conversation
    const conv = await embedService.getConversationByVisitorAndSiteKey(siteKey, visitorId);
    if (!conv) {
        throw new Error('Conversation not found');
    }

    // Save message to MongoDB (includes atomic seq allocation and dedup)
    const message = await embedService.createMessage(
        conv.ConversationKey,
        text,
        2, // senderType: 2 = agent
        agentId,
        conv.ConversationId,
        clientMsgId
    );

    // Update SQL metadata with seq safety (async, don't block)
    embedService.updateConversationActivityWithSeq(
        conv.ConversationKey,
        message.seq,
        message.content,
        message.messageId
    ).catch(err => console.error('[Embed] Failed to update conversation activity:', err));

    // CRITICAL: Build response from DB record, NOT from request payload
    const messageData = {
        id: message.messageId,
        seq: message.seq,
        text: message.content,      // Use DB content
        sender: 'agent',
        senderType: message.senderType,
        senderId: message.senderId || agentId,
        createdAt: message.createdAt,
        clientMsgId: message.clientMsgId,
        isDuplicate: message.isDuplicate || false
    };

    // Broadcast to room using DB record
    if (namespace) {
        namespace.to(roomName).emit('embed:message', messageData);
        // Also broadcast to unified agents
        namespace.to(`agent:site:${siteKey}`).emit('embed:message', messageData);
    }

    return messageData;
}

module.exports = {
    init,
    sendAgentMessage
};
