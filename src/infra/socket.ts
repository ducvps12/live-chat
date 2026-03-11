import { Server, Socket } from 'socket.io';
import http from 'http';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { security } from './security';
import { messageRepo } from '../modules/conversation/repos/message.repo';
import { conversationRepo } from '../modules/conversation/repos/conversation.repo';
import { presenceStore } from './presence';
import { browserPool } from './browserPool';
import { startScreencast, stopScreencast, dispatchMouse, dispatchKeyboard, dispatchScroll, detectLoginState, scrapeZaloConversations, scrapeZaloMessages } from './sessionStream';
import { externalSessionRepo } from '../modules/external-session/repos/externalSession.repo';

let io: Server;

// ── Room naming conventions ──
export const rooms = {
    conversation: (id: string) => `conv:${id}`,
    workspace: (id: string) => `ws:${id}`,
    visitor: (visitorId: string) => `visitor:${visitorId}`,
};

// ── Socket data attached after handshake ──
interface SocketData {
    type: 'visitor' | 'agent';
    id: string;
    name?: string;
    visitorId?: string;     // for visitors
    widgetId?: string;      // for visitors
    workspaceId?: string;   // for agents
}

/**
 * Initialize Socket.IO on the HTTP server.
 */
export function initSocketGateway(server: http.Server): Server {
    io = new Server(server, {
        cors: {
            origin: true,
            credentials: true,
        },
        pingTimeout: 30000,
        pingInterval: 10000,
        transports: ['websocket', 'polling'],
    });

    // ── Visitor namespace (token authenticated) ──
    const visitorNs = io.of('/visitor');

    // Auth middleware for visitors
    visitorNs.use((socket, next) => {
        const token = socket.handshake.auth?.token || socket.handshake.query?.token;
        if (!token) return next(new Error('MISSING_TOKEN'));

        const decoded = security.verifyVisitorToken(token as string);
        if (!decoded) return next(new Error('INVALID_TOKEN'));

        (socket as any).data = {
            type: 'visitor',
            id: decoded.visitorId,
            visitorId: decoded.visitorId,
            widgetId: decoded.widgetId,
        } as SocketData;

        next();
    });

    visitorNs.on('connection', (socket: Socket) => {
        const data = (socket as any).data as SocketData;
        const vid = data.visitorId!;
        const conversationId = socket.handshake.query?.conversationId as string;

        // Join visitor room
        socket.join(rooms.visitor(vid));

        // Join conversation room if provided
        if (conversationId) {
            socket.join(rooms.conversation(conversationId));
        }

        console.log(`[Socket] Visitor connected: ${vid} (socket: ${socket.id})`);

        // ── Presence: visitor online ──
        presenceStore.visitorConnect(vid, socket.id);
        if (data.widgetId) {
            // Notify agents in this widget's workspace
            // (widgetId → workspaceId mapping comes from the conversation)
            if (conversationId) {
                conversationRepo.findById(conversationId).then(conv => {
                    if (conv) {
                        emitToWorkspace((conv.workspaceId as any).toString(), 'presence:visitorOnline', {
                            visitorId: vid, status: 'online',
                        });
                    }
                }).catch(() => {});
            }
        }

        // Send current agents:status to visitor on connect
        socket.emit('agents:status', { hasOnlineAgent: true });

        // ── Visitor events ──

        // Join a conversation room (when conversation is created/resumed later)
        socket.on('join:conversation', (joinData: { conversationId: string }) => {
            if (joinData.conversationId) {
                socket.join(rooms.conversation(joinData.conversationId));
                console.log(`[Socket] Visitor ${vid} joined room: ${rooms.conversation(joinData.conversationId)}`);
            }
        });

        // Typing indicator
        socket.on('typing:start', (typingData: { conversationId: string }) => {
            socket.to(rooms.conversation(typingData.conversationId)).emit('typing:start', {
                conversationId: typingData.conversationId,
                sender: { type: 'visitor', id: vid },
            });
        });

        socket.on('typing:stop', (typingData: { conversationId: string }) => {
            socket.to(rooms.conversation(typingData.conversationId)).emit('typing:stop', {
                conversationId: typingData.conversationId,
                sender: { type: 'visitor', id: vid },
            });
        });

        // ── Message Status Updates ──
        socket.on('message:delivered', async (msgData: { messageIds: string[], conversationId: string }) => {
            if (msgData.messageIds?.length > 0) {
                await messageRepo.markAsDelivered(msgData.messageIds);
                socket.to(rooms.conversation(msgData.conversationId)).emit('message:updated', {
                    messageIds: msgData.messageIds,
                    status: 'delivered'
                });
            }
        });

        socket.on('message:seen', async (seenData: { conversationId: string, messageId: string }) => {
            if (seenData.conversationId && seenData.messageId) {
                // Update cursor for visitor
                await conversationRepo.updateReadCursor(seenData.conversationId, vid, 'visitor', seenData.messageId);
                // Mark agent messages as read
                await messageRepo.markAsReadUpTo(seenData.conversationId, seenData.messageId, 'agent');
                
                socket.to(rooms.conversation(seenData.conversationId)).emit('messages:read', {
                    conversationId: seenData.conversationId,
                    lastReadMessageId: seenData.messageId,
                    participantId: vid,
                    participantType: 'visitor'
                });
            }
        });

        // Visitor heartbeat for idle detection
        socket.on('heartbeat', () => {
            presenceStore.visitorHeartbeat(vid);
        });

        socket.on('disconnect', (reason) => {
            console.log(`[Socket] Visitor disconnected: ${vid} (${reason})`);

            // ── Presence: visitor disconnect ──
            const newStatus = presenceStore.visitorDisconnect(vid, socket.id);
            if (newStatus === 'offline' && conversationId) {
                conversationRepo.findById(conversationId).then(conv => {
                    if (conv) {
                        emitToWorkspace((conv.workspaceId as any).toString(), 'presence:visitorOffline', {
                            visitorId: vid, status: 'offline',
                        });
                    }
                }).catch(() => {});
            }
        });
    });

    // ── Agent namespace (JWT authenticated) ──
    const agentNs = io.of('/agent');

    // Auth middleware for agents
    agentNs.use((socket, next) => {
        const token = socket.handshake.auth?.token || socket.handshake.query?.token;
        if (!token) return next(new Error('UNAUTHORIZED'));

        try {
            const decoded = jwt.verify(token, env.JWT_SECRET) as any;
            (socket as any).data = {
                type: 'agent',
                id: decoded.id || decoded.userId,
                name: decoded.name || 'Agent',
                workspaceId: socket.handshake.query?.workspaceId as string,
            } as SocketData;
            next();
        } catch (err) {
            next(new Error('INVALID_TOKEN'));
        }
    });

    agentNs.on('connection', (socket: Socket) => {
        const data = (socket as any).data as SocketData;
        const workspaceId = data.workspaceId;

        console.log(`[Socket] Agent connected: ${data.id} (socket: ${socket.id})`);

        // ── Presence: agent online ──
        presenceStore.agentConnect(data.id, socket.id, { name: data.name, workspaceId });

        // Broadcast to workspace agents
        if (workspaceId) {
            emitToWorkspace(workspaceId, 'presence:agentStatus', {
                userId: data.id, name: data.name, status: 'online',
            });
            // Broadcast to all visitors in this workspace (widget "we're online")
            getIO().of('/visitor').emit('agents:status', {
                workspaceId,
                hasOnlineAgent: presenceStore.countOnlineAgents(workspaceId) > 0,
                onlineCount: presenceStore.countOnlineAgents(workspaceId),
            });
        }

        // Auto-join workspace room on connect
        if (workspaceId) {
            socket.join(rooms.workspace(workspaceId));
        }

        // ── Workspace room management ──

        // Switch workspace (leave old, join new)
        socket.on('join:workspace', (wsData: { workspaceId: string }) => {
            // Leave all current workspace rooms first
            socket.rooms.forEach((room) => {
                if (room.startsWith('ws:')) socket.leave(room);
            });
            if (wsData.workspaceId) {
                socket.join(rooms.workspace(wsData.workspaceId));
                (socket as any).data.workspaceId = wsData.workspaceId;
            }
        });

        socket.on('leave:workspace', (wsData: { workspaceId: string }) => {
            if (wsData.workspaceId) {
                socket.leave(rooms.workspace(wsData.workspaceId));
            }
        });

        // ── Conversation room management ──

        // Join a single conversation
        socket.on('join:conversation', (convData: { conversationId: string }) => {
            if (convData.conversationId) {
                socket.join(rooms.conversation(convData.conversationId));
                console.log(`[Socket] Agent ${data.id} joined room: ${rooms.conversation(convData.conversationId)}`);
            }
        });

        // Batch join conversations (e.g. agent opens inbox, subscribes to all active convs)
        socket.on('join:conversations', (convData: { conversationIds: string[] }) => {
            if (Array.isArray(convData.conversationIds)) {
                convData.conversationIds.forEach((cid) => {
                    socket.join(rooms.conversation(cid));
                });
            }
        });

        // Leave a conversation room
        socket.on('leave:conversation', (convData: { conversationId: string }) => {
            if (convData.conversationId) {
                socket.leave(rooms.conversation(convData.conversationId));
            }
        });

        // ── Typing indicators ──

        socket.on('typing:start', (typingData: { conversationId: string }) => {
            socket.to(rooms.conversation(typingData.conversationId)).emit('typing:start', {
                conversationId: typingData.conversationId,
                sender: { type: 'agent', id: data.id, name: data.name },
            });
        });

        socket.on('typing:stop', (typingData: { conversationId: string }) => {
            socket.to(rooms.conversation(typingData.conversationId)).emit('typing:stop', {
                conversationId: typingData.conversationId,
                sender: { type: 'agent', id: data.id, name: data.name },
            });
        });

        // ── Message Status Updates ──
        socket.on('message:delivered', async (msgData: { messageIds: string[], conversationId: string }) => {
            if (msgData.messageIds?.length > 0) {
                await messageRepo.markAsDelivered(msgData.messageIds);
                socket.to(rooms.conversation(msgData.conversationId)).emit('message:updated', {
                    messageIds: msgData.messageIds,
                    status: 'delivered'
                });
            }
        });

        socket.on('message:seen', async (seenData: { conversationId: string, messageId: string }) => {
            if (seenData.conversationId && seenData.messageId) {
                // Update cursor for agent
                await conversationRepo.updateReadCursor(seenData.conversationId, data.id, 'agent', seenData.messageId);
                // Mark visitor/system messages as read
                await messageRepo.markAsReadUpTo(seenData.conversationId, seenData.messageId, 'visitor');
                
                // Reset unread count for agent inbox
                await conversationRepo.markRead(seenData.conversationId);
                
                socket.to(rooms.conversation(seenData.conversationId)).emit('messages:read', {
                    conversationId: seenData.conversationId,
                    lastReadMessageId: seenData.messageId,
                    participantId: data.id,
                    participantType: 'agent'
                });
                
                if (workspaceId) {
                    emitToWorkspace(workspaceId, 'conversation:updated', {
                        conversationId: seenData.conversationId,
                        unreadCount: 0
                    });
                }
            }
        });

        // Agent heartbeat for idle detection
        socket.on('heartbeat', () => {
            const wasAway = presenceStore.getAgentStatus(data.id) === 'away';
            presenceStore.agentHeartbeat(data.id);
            if (wasAway && workspaceId) {
                emitToWorkspace(workspaceId, 'presence:agentStatus', {
                    userId: data.id, name: data.name, status: 'online',
                });
            }
        });

        // Manual status change (e.g. agent sets themselves as 'away')
        socket.on('presence:setStatus', (statusData: { status: 'online' | 'away' }) => {
            presenceStore.setAgentStatus(data.id, statusData.status);
            if (workspaceId) {
                emitToWorkspace(workspaceId, 'presence:agentStatus', {
                    userId: data.id, name: data.name, status: statusData.status,
                });
            }
        });

        socket.on('disconnect', async (reason) => {
            console.log(`[Socket] Agent disconnected: ${data.id} (${reason})`);

            // ── Presence: agent disconnect ──
            const newStatus = presenceStore.agentDisconnect(data.id, socket.id);
            if (newStatus === 'offline' && workspaceId) {
                emitToWorkspace(workspaceId, 'presence:agentStatus', {
                    userId: data.id, name: data.name, status: 'offline',
                });
                // Update widget "agents online" indicator
                getIO().of('/visitor').emit('agents:status', {
                    workspaceId,
                    hasOnlineAgent: presenceStore.countOnlineAgents(workspaceId) > 0,
                    onlineCount: presenceStore.countOnlineAgents(workspaceId),
                });
            }

            // Requeue conversations if agent disconnected unexpectedly and fully offline
            if (newStatus === 'offline' && (reason === 'transport close' || reason === 'ping timeout')) {
                try {
                    const count = await conversationRepo.requeueByAgent(data.id);
                    if (count > 0 && workspaceId) {
                        console.log(`[Socket] Requeued ${count} conversations from agent ${data.id}`);
                        const wsRoom = rooms.workspace(workspaceId);
                        agentNs.to(wsRoom).emit('conversation:requeued', { agentId: data.id, count });
                    }
                } catch (err) {
                    console.error('[Socket] Error requeuing conversations:', err);
                }
            }
        });
    });

    console.log('[Socket] Realtime gateway initialized (namespaces: /visitor, /agent)');

    // ── Presence idle check cron (every 60 seconds) ──
    setInterval(() => {
        // Check idle agents
        const idleAgents = presenceStore.checkIdleAgents();
        for (const agent of idleAgents) {
            console.log(`[Presence] Agent ${agent.userId} → away (idle)`);
            if (agent.workspaceId) {
                emitToWorkspace(agent.workspaceId, 'presence:agentStatus', {
                    userId: agent.userId, status: 'away',
                });
            }
        }
        // Check idle visitors
        const idleVisitors = presenceStore.checkIdleVisitors();
        for (const v of idleVisitors) {
            console.log(`[Presence] Visitor ${v.visitorId} → idle`);
        }
    }, 60 * 1000);

    // ── SLA check cron (every 5 minutes) ──
    setInterval(async () => {
        try {
            const { conversationService } = require('../modules/conversation/conversation.service');
            await conversationService.checkSLABreaching();
        } catch (err) {
            console.error('[SLA Cron] Error checking SLA:', err);
        }
    }, 5 * 60 * 1000);

    // ────────── Remote Session Namespace ──────────
    const remoteNs = io.of('/remote');

    // Auth middleware (JWT same as agent)
    remoteNs.use((socket, next) => {
        const token = socket.handshake.auth?.token || socket.handshake.query?.token;
        if (!token) return next(new Error('MISSING_TOKEN'));
        try {
            const decoded = jwt.verify(token as string, env.JWT_SECRET) as any;
            (socket as any).data = {
                type: 'agent',
                id: decoded.id || decoded.userId,
                name: decoded.name || 'Unknown',
                workspaceId: socket.handshake.query?.workspaceId || decoded.workspaceId,
            } as SocketData;
            next();
        } catch {
            next(new Error('INVALID_TOKEN'));
        }
    });

    // Track active screencasts per socket
    const activeScreencasts = new Map<string, string>(); // socketId → sessionId

    remoteNs.on('connection', (socket: Socket) => {
        const data = (socket as any).data as SocketData;
        console.log(`[Remote] User ${data.name} (${data.id}) connected`);

        // ── Join a browser session ──
        socket.on('session:join', async ({ sessionId }: { sessionId: string }) => {
            try {
                const instance = browserPool.get(sessionId);
                if (!instance || instance.status !== 'running') {
                    socket.emit('session:error', { message: 'Phiên trình duyệt không hoạt động' });
                    return;
                }

                const room = `remote:${sessionId}`;
                socket.join(room);

                // Track viewer
                await externalSessionRepo.addViewer(sessionId, data.id);
                await externalSessionRepo.logAudit({
                    sessionId, workspaceId: data.workspaceId || '', userId: data.id, action: 'viewer_joined',
                });

                // Broadcast viewer list + control state
                const session = await externalSessionRepo.findById(sessionId);
                remoteNs.to(room).emit('viewers:updated', session?.viewers || []);
                remoteNs.to(room).emit('control:changed', { userId: session?.controlledBy?.toString() || null });
                socket.emit('session:status', { status: session?.status });

                // Start screencast — send base64 data URL instead of raw Buffer
                activeScreencasts.set(socket.id, sessionId);
                if (!instance.browser.connected) {
                    socket.emit('session:error', { message: 'Trình duyệt đã mất kết nối' });
                    return;
                }
                startScreencast(instance.cdpSession, (frameBuffer) => {
                    const base64 = frameBuffer.toString('base64');
                    socket.emit('session:frame', { image: `data:image/jpeg;base64,${base64}` });
                });

                // Check login state
                const loginState = await detectLoginState(instance.page);
                socket.emit('session:loginState', { state: loginState });

                console.log(`[Remote] ${data.name} joined session ${sessionId}`);
            } catch (err: any) {
                socket.emit('session:error', { message: err.message });
            }
        });

        // ── Leave session ──
        socket.on('session:leave', async ({ sessionId }: { sessionId: string }) => {
            socket.leave(`remote:${sessionId}`);
            activeScreencasts.delete(socket.id);
            await externalSessionRepo.removeViewer(sessionId, data.id);
            const session = await externalSessionRepo.findById(sessionId);
            remoteNs.to(`remote:${sessionId}`).emit('viewers:updated', session?.viewers || []);
        });

        // ── Mouse input (control-locked) ──
        socket.on('input:mouse', async (p: any) => {
            try {
                const session = await externalSessionRepo.findById(p.sessionId);
                if (!session || session.controlledBy?.toString() !== data.id) return;
                const inst = browserPool.get(p.sessionId);
                if (!inst) return;
                await dispatchMouse(inst.cdpSession, p.type, p.x, p.y, p.button || 'left', p.clickCount || 1);
            } catch { /* silent */ }
        });

        // ── Keyboard input (control-locked) ──
        socket.on('input:keyboard', async (p: any) => {
            try {
                const session = await externalSessionRepo.findById(p.sessionId);
                if (!session || session.controlledBy?.toString() !== data.id) return;
                const inst = browserPool.get(p.sessionId);
                if (!inst) return;
                await dispatchKeyboard(inst.cdpSession, p.type, p.key, p.code || '', p.text || '');
            } catch { /* silent */ }
        });

        // ── Scroll input (control-locked) ──
        socket.on('input:scroll', async (p: any) => {
            try {
                const session = await externalSessionRepo.findById(p.sessionId);
                if (!session || session.controlledBy?.toString() !== data.id) return;
                const inst = browserPool.get(p.sessionId);
                if (!inst) return;
                await dispatchScroll(inst.cdpSession, p.x, p.y, p.deltaX, p.deltaY);
            } catch { /* silent */ }
        });

        // ── Take control ──
        socket.on('control:take', async ({ sessionId }: { sessionId: string }) => {
            try {
                await externalSessionRepo.setController(sessionId, data.id);
                await externalSessionRepo.logAudit({
                    sessionId, workspaceId: data.workspaceId || '', userId: data.id, action: 'control_taken',
                });
                remoteNs.to(`remote:${sessionId}`).emit('control:changed', { userId: data.id, name: data.name });
            } catch (err: any) {
                socket.emit('session:error', { message: err.message });
            }
        });

        // ── Release control ──
        socket.on('control:release', async ({ sessionId }: { sessionId: string }) => {
            try {
                const session = await externalSessionRepo.findById(sessionId);
                if (session?.controlledBy?.toString() !== data.id) return;
                await externalSessionRepo.setController(sessionId, null);
                await externalSessionRepo.logAudit({
                    sessionId, workspaceId: data.workspaceId || '', userId: data.id, action: 'control_released',
                });
                remoteNs.to(`remote:${sessionId}`).emit('control:changed', { userId: null, name: null });
            } catch { /* silent */ }
        });

        // ── Manual login check ──
        socket.on('session:checkLogin', async ({ sessionId }: { sessionId: string }) => {
            try {
                const inst = browserPool.get(sessionId);
                if (!inst) return;
                const state = await detectLoginState(inst.page);
                socket.emit('session:loginState', { state });
                if (state === 'logged_in') {
                    const session = await externalSessionRepo.findById(sessionId);
                    if (session && session.status === 'pending_login') {
                        await externalSessionRepo.updateStatus(sessionId, 'connected', { connectedAt: new Date() });
                        await externalSessionRepo.logAudit({
                            sessionId, workspaceId: data.workspaceId || '', userId: data.id, action: 'login_success',
                        });
                        remoteNs.to(`remote:${sessionId}`).emit('session:status', { status: 'connected' });
                        remoteNs.to(`remote:${sessionId}`).emit('session:loginDetected', {});
                    }
                }
            } catch { /* silent */ }
        });

        // ── Scrape Zalo conversations ──
        socket.on('zalo:getConversations', async ({ sessionId }: { sessionId: string }) => {
            try {
                const inst = browserPool.get(sessionId);
                if (!inst || inst.status !== 'running') {
                    socket.emit('zalo:conversations', { conversations: [], error: 'Browser not running' });
                    return;
                }
                const conversations = await scrapeZaloConversations(inst.page);
                console.log(`[ZaloScrape] Found ${conversations.length} conversations for session ${sessionId}`);
                socket.emit('zalo:conversations', { conversations });
            } catch (err: any) {
                socket.emit('zalo:conversations', { conversations: [], error: err.message });
            }
        });

        // ── Scrape Zalo messages for a conversation ──
        socket.on('zalo:getMessages', async ({ sessionId, convIndex }: { sessionId: string; convIndex: number }) => {
            try {
                const inst = browserPool.get(sessionId);
                if (!inst || inst.status !== 'running') {
                    socket.emit('zalo:messages', { messages: [], error: 'Browser not running' });
                    return;
                }
                const messages = await scrapeZaloMessages(inst.page, convIndex);
                console.log(`[ZaloScrape] Found ${messages.length} messages for conv ${convIndex}`);
                socket.emit('zalo:messages', { messages });
            } catch (err: any) {
                socket.emit('zalo:messages', { messages: [], error: err.message });
            }
        });

        // ── Debug: dump Zalo DOM structure ──
        socket.on('zalo:debugDOM', async ({ sessionId }: { sessionId: string }) => {
            try {
                const inst = browserPool.get(sessionId);
                if (!inst || inst.status !== 'running') {
                    socket.emit('zalo:domDump', { error: 'Browser not running' });
                    return;
                }
                const dump = await inst.page.evaluate(() => {
                    const body = document.body;
                    // Get all div elements with their classes (first 3 levels deep)
                    const getStructure = (el: Element, depth: number): any => {
                        if (depth > 4) return null;
                        const children = Array.from(el.children).slice(0, 20).map(c => getStructure(c, depth + 1)).filter(Boolean);
                        const text = el.childNodes.length === 1 && el.childNodes[0].nodeType === 3
                            ? (el.textContent?.trim().substring(0, 50) || '') : '';
                        return {
                            tag: el.tagName.toLowerCase(),
                            cls: el.className?.toString().substring(0, 100) || '',
                            id: el.id || '',
                            text: text,
                            childCount: el.children.length,
                            children: children.length > 0 ? children : undefined,
                        };
                    };
                    return getStructure(body, 0);
                });
                console.log('[ZaloDebug] DOM dump:', JSON.stringify(dump, null, 2).substring(0, 5000));
                socket.emit('zalo:domDump', { dump });
            } catch (err: any) {
                socket.emit('zalo:domDump', { error: err.message });
            }
        });

        // ── Disconnect cleanup ──
        socket.on('disconnect', async () => {
            const sessionId = activeScreencasts.get(socket.id);
            if (sessionId) {
                activeScreencasts.delete(socket.id);
                await externalSessionRepo.removeViewer(sessionId, data.id);
                const session = await externalSessionRepo.findById(sessionId);
                if (session?.controlledBy?.toString() === data.id) {
                    await externalSessionRepo.setController(sessionId, null);
                    remoteNs.to(`remote:${sessionId}`).emit('control:changed', { userId: null, name: null });
                }
                const updated = await externalSessionRepo.findById(sessionId);
                remoteNs.to(`remote:${sessionId}`).emit('viewers:updated', updated?.viewers || []);
            }
            console.log(`[Remote] User ${data.name} disconnected`);
        });
    });

    // ── Login state polling (auto-detect QR→connected) ──
    setInterval(async () => {
        try {
            for (const inst of browserPool.listActive()) {
                const session = await externalSessionRepo.findById(inst.sessionId);
                if (!session || session.status !== 'pending_login') continue;
                const browserInst = browserPool.get(inst.sessionId);
                if (!browserInst) continue;
                const state = await detectLoginState(browserInst.page);
                if (state === 'logged_in') {
                    await externalSessionRepo.updateStatus(inst.sessionId, 'connected', { connectedAt: new Date() });
                    remoteNs.to(`remote:${inst.sessionId}`).emit('session:status', { status: 'connected' });
                    remoteNs.to(`remote:${inst.sessionId}`).emit('session:loginDetected', {});
                    console.log(`[Remote] Auto-detected login for session ${inst.sessionId}`);
                }
            }
        } catch { /* silent */ }
    }, 5000);

    return io;
}

/**
 * Get the Socket.IO server instance.
 */
export function getIO(): Server {
    if (!io) throw new Error('Socket.IO not initialized — call initSocketGateway first');
    return io;
}

/**
 * Emit event to a conversation room (both visitors and agents in this conversation).
 */
export function emitToConversation(conversationId: string, event: string, data: any) {
    const server = getIO();
    const room = rooms.conversation(conversationId);
    console.log(`[Socket] emitToConversation room=${room} event=${event}`);
    server.of('/visitor').to(room).emit(event, data);
    server.of('/agent').to(room).emit(event, data);
}

/**
 * Emit event to a workspace room (all agents in this workspace).
 */
export function emitToWorkspace(workspaceId: string, event: string, data: any) {
    getIO().of('/agent').to(rooms.workspace(workspaceId)).emit(event, data);
}

/**
 * Get online agents for a workspace (for REST API).
 */
export function getWorkspacePresence(workspaceId: string) {
    return presenceStore.getOnlineAgents(workspaceId);
}

/**
 * Get visitor presence status.
 */
export function getVisitorPresence(visitorId: string) {
    return presenceStore.getVisitorStatus(visitorId);
}
