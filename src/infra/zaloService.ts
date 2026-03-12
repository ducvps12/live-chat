/**
 * ZaloPersonalService — Native Zalo API integration using zca-js.
 * Based on patterns from OpenClaw's @openclaw/zalouser plugin.
 *
 * Key design:
 *  - QR Login via loginQR callback
 *  - Realtime message listener with watchdog (~1-2s latency)
 *  - In-memory message cache for DM history (zca-js has no getUserChatHistory)
 *  - getGroupChatHistory for group message history
 *  - getAllFriends returns User[] directly (not {data: []})
 *  - getAllGroups returns {gridVerMap} which needs getGroupInfo for details
 *
 * IMPORTANT: Only 1 web listener per Zalo account at a time.
 */
import { Zalo, ThreadType } from 'zca-js';
import { LoginQRCallbackEventType } from 'zca-js';
import type { LoginQRCallbackEvent } from 'zca-js';

// ── Constants (from OpenClaw patterns) ──
const LISTENER_WATCHDOG_INTERVAL_MS = 30_000;
const LISTENER_WATCHDOG_MAX_GAP_MS = 35_000;
const MESSAGE_CACHE_MAX_PER_THREAD = 100;
const GROUP_INFO_CHUNK_SIZE = 80;

// ── Types ──
export interface ZaloSession {
    sessionId: string;
    zalo: InstanceType<typeof Zalo>;
    api: any; // zca-js API instance (returned from loginQR)
    status: 'qr_pending' | 'connected' | 'disconnected' | 'error';
    listenerStarted: boolean;
    onMessage?: (msg: ZaloIncomingMessage) => void;
    onError?: (error: string) => void;
    watchdogTimer?: ReturnType<typeof setInterval>;
    lastWatchdogTickAt?: number;
    createdAt: Date;
    connectedAt?: Date;
}

export interface ZaloIncomingMessage {
    msgId: string;
    threadId: string;
    threadType: 'user' | 'group';
    content: string;
    senderId: string;
    senderName: string;
    isSelf: boolean;
    timestamp: number;
    msgType: string;
}

export interface ZaloConversationItem {
    threadId: string;
    threadType: 'user' | 'group';
    displayName: string;
    avatar?: string;
    lastMessage?: string;
    lastMessageAt?: string;
}

// ── Stores ──
const sessions = new Map<string, ZaloSession>();
// In-memory message cache per thread (since zca-js has no DM history API)
const messageCache = new Map<string, ZaloIncomingMessage[]>();

function cacheMessage(sessionId: string, msg: ZaloIncomingMessage): void {
    const key = `${sessionId}:${msg.threadId}`;
    let list = messageCache.get(key);
    if (!list) {
        list = [];
        messageCache.set(key, list);
    }
    // Avoid duplicates
    if (list.some(m => m.msgId === msg.msgId)) return;
    list.push(msg);
    // Trim to max
    if (list.length > MESSAGE_CACHE_MAX_PER_THREAD) {
        list.splice(0, list.length - MESSAGE_CACHE_MAX_PER_THREAD);
    }
}

function getCachedMessages(sessionId: string, threadId: string): ZaloIncomingMessage[] {
    return messageCache.get(`${sessionId}:${threadId}`) || [];
}

function normalizeMessageContent(content: unknown): string {
    if (typeof content === 'string') return content;
    if (!content || typeof content !== 'object') return '';
    const record = content as Record<string, unknown>;
    const title = typeof record.title === 'string' ? record.title.trim() : '';
    const description = typeof record.description === 'string' ? record.description.trim() : '';
    const href = typeof record.href === 'string' ? record.href.trim() : '';
    const combined = [title, description, href].filter(Boolean).join('\n').trim();
    return combined || '[Media/Sticker]';
}

/**
 * Create a new Zalo session and start QR login.
 */
export async function createZaloSession(
    sessionId: string,
    onQR: (qrDataUrl: string) => void,
    onLogin: (session: ZaloSession) => void,
    onMessage: (msg: ZaloIncomingMessage) => void,
    onError: (error: string) => void,
): Promise<void> {
    try {
        if (sessions.has(sessionId)) {
            await destroyZaloSession(sessionId);
        }

        console.log(`[ZaloService] Creating session ${sessionId}...`);

        const zalo = new Zalo();

        const session: ZaloSession = {
            sessionId,
            zalo,
            api: null,
            status: 'qr_pending',
            listenerStarted: false,
            onMessage,
            onError,
            createdAt: new Date(),
        };

        sessions.set(sessionId, session);

        // Login via QR with callback for QR events
        const api = await zalo.loginQR({}, (event: LoginQRCallbackEvent) => {
            try {
                if (event.type === LoginQRCallbackEventType.QRCodeGenerated) {
                    console.log(`[ZaloService] QR code generated for session ${sessionId}`);
                    if (event.data?.image) {
                        // Ensure proper data URL format (OpenClaw pattern)
                        const image = (event.data.image as string).replace(/^data:image\/png;base64,/, '');
                        const qrDataUrl = image.startsWith('data:image')
                            ? image
                            : `data:image/png;base64,${image}`;
                        onQR(qrDataUrl);
                    }
                } else if (event.type === LoginQRCallbackEventType.QRCodeScanned) {
                    console.log(`[ZaloService] QR scanned by ${(event.data as any)?.display_name || 'user'}`);
                } else if (event.type === LoginQRCallbackEventType.QRCodeExpired) {
                    console.log(`[ZaloService] QR expired, retrying...`);
                    try { (event as any).actions?.retry?.(); } catch { /* ignore */ }
                } else if (event.type === LoginQRCallbackEventType.QRCodeDeclined) {
                    console.log(`[ZaloService] QR login declined`);
                }
                // GotLoginInfo (type=4) is handled internally by zca-js loginQR
            } catch (err: any) {
                console.error(`[ZaloService] QR callback error:`, err);
            }
        });

        if (!api) {
            throw new Error('Login failed — no API returned');
        }

        // Login succeeded
        session.api = api;
        session.status = 'connected';
        session.connectedAt = new Date();
        console.log(`[ZaloService] Session ${sessionId} connected!`);

        // Start message listener with watchdog
        startMessageListener(sessionId);

        onLogin(session);

    } catch (err: any) {
        console.error(`[ZaloService] Session ${sessionId} creation failed:`, err);
        const session = sessions.get(sessionId);
        if (session) {
            session.status = 'error';
        }
        onError(err.message || 'Lỗi đăng nhập Zalo');
    }
}

/**
 * Start the realtime message listener with watchdog timer (OpenClaw pattern).
 */
function startMessageListener(sessionId: string): void {
    const session = sessions.get(sessionId);
    if (!session || !session.api || session.listenerStarted) return;

    try {
        session.lastWatchdogTickAt = Date.now();

        const onMessage = (message: any) => {
            try {
                session.lastWatchdogTickAt = Date.now();
                const content = normalizeMessageContent(message.data?.content);
                const isPlainText = typeof message.data?.content === 'string';
                const threadType = message.type === ThreadType.User ? 'user' : 'group';

                const incomingMsg: ZaloIncomingMessage = {
                    msgId: message.data?.msgId || `zca_${Date.now()}`,
                    threadId: message.threadId,
                    threadType,
                    content,
                    senderId: message.data?.uidFrom || message.data?.senderId || '',
                    senderName: message.data?.dName || message.data?.senderName || 'Unknown',
                    isSelf: message.isSelf || false,
                    timestamp: message.data?.ts ? resolveTimestamp(message.data.ts) : Date.now(),
                    msgType: isPlainText ? 'text' : 'media',
                };

                console.log(`[ZaloService] New message in ${threadType} ${message.threadId}: "${incomingMsg.content.substring(0, 50)}" (self=${incomingMsg.isSelf})`);

                // Cache message for history retrieval
                cacheMessage(sessionId, incomingMsg);

                if (session.onMessage) {
                    session.onMessage(incomingMsg);
                }
            } catch (err: any) {
                console.error(`[ZaloService] Message processing error:`, err);
            }
        };

        const onError = (error: unknown) => {
            console.error(`[ZaloService] Listener error for ${sessionId}:`, error);
            cleanupListener(sessionId);
            session.onError?.(`Listener error: ${error instanceof Error ? error.message : String(error)}`);
        };

        const onClosed = (code: number, reason: string) => {
            console.error(`[ZaloService] Listener closed for ${sessionId} (${code}): ${reason || 'no reason'}`);
            cleanupListener(sessionId);
            session.onError?.(`Listener disconnected (${code})`);
        };

        session.api.listener.on('message', onMessage);
        session.api.listener.on('error', onError);
        session.api.listener.on('closed', onClosed);

        session.api.listener.start();
        session.listenerStarted = true;

        // Watchdog timer (OpenClaw pattern: detect stale connections)
        session.watchdogTimer = setInterval(() => {
            if (!session.listenerStarted) return;
            const now = Date.now();
            const gap = now - (session.lastWatchdogTickAt || now);
            session.lastWatchdogTickAt = now;
            if (gap > LISTENER_WATCHDOG_MAX_GAP_MS) {
                console.error(`[ZaloService] Watchdog gap detected (${Math.round(gap / 1000)}s) for ${sessionId}`);
                cleanupListener(sessionId);
                session.onError?.('Listener watchdog timeout — connection may be stale');
            }
        }, LISTENER_WATCHDOG_INTERVAL_MS);

        console.log(`[ZaloService] Message listener started for session ${sessionId} (with watchdog)`);
    } catch (err: any) {
        console.error(`[ZaloService] Failed to start listener for ${sessionId}:`, err);
    }
}

function cleanupListener(sessionId: string): void {
    const session = sessions.get(sessionId);
    if (!session) return;
    if (session.watchdogTimer) {
        clearInterval(session.watchdogTimer);
        session.watchdogTimer = undefined;
    }
    try {
        session.api?.listener?.stop();
    } catch { /* ignore */ }
    session.listenerStarted = false;
}

function resolveTimestamp(ts: unknown): number {
    if (typeof ts === 'number' && Number.isFinite(ts)) {
        return ts > 1_000_000_000_000 ? ts : ts * 1000;
    }
    const parsed = parseInt(String(ts || ''), 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return Date.now();
    return parsed > 1_000_000_000_000 ? parsed : parsed * 1000;
}

/**
 * Get all conversations (friends + groups) for a session.
 * Fixed: getAllFriends returns User[] directly, getAllGroups returns {gridVerMap}.
 */
export async function getZaloConversations(sessionId: string): Promise<ZaloConversationItem[]> {
    const session = sessions.get(sessionId);
    if (!session || !session.api || session.status !== 'connected') {
        console.warn(`[ZaloService] Session ${sessionId} not connected`);
        return [];
    }

    try {
        const conversations: ZaloConversationItem[] = [];

        // Get friends list — getAllFriends() returns User[] directly (NOT {data: []})
        try {
            const friends = await session.api.getAllFriends();
            // zca-js returns the array directly
            const friendList = Array.isArray(friends) ? friends : [];
            for (const f of friendList) {
                const threadId = String(f.userId || f.uid || f.id || '');
                if (!threadId) continue;
                conversations.push({
                    threadId,
                    threadType: 'user',
                    displayName: f.displayName || f.zaloName || f.name || 'Unknown',
                    avatar: f.avatar || f.thumbAvatar || '',
                    lastMessage: '',
                    lastMessageAt: '',
                });
            }
            console.log(`[ZaloService] Got ${friendList.length} friends`);
        } catch (err: any) {
            console.error(`[ZaloService] Failed to get friends:`, err.message);
        }

        // Get groups list — getAllGroups() returns {gridVerMap: Record<id, version>}
        // Then getGroupInfo(ids) returns {gridInfoMap: Record<id, GroupInfo>}
        try {
            const allGroups = await session.api.getAllGroups();
            const gridVerMap = allGroups?.gridVerMap || {};
            const groupIds = Object.keys(gridVerMap);

            if (groupIds.length > 0) {
                // Fetch group details in chunks (OpenClaw pattern)
                for (let i = 0; i < groupIds.length; i += GROUP_INFO_CHUNK_SIZE) {
                    const chunk = groupIds.slice(i, i + GROUP_INFO_CHUNK_SIZE);
                    try {
                        const infoResponse = await session.api.getGroupInfo(chunk);
                        const gridInfoMap = infoResponse?.gridInfoMap || {};
                        for (const [groupId, info] of Object.entries(gridInfoMap) as [string, any][]) {
                            conversations.push({
                                threadId: groupId,
                                threadType: 'group',
                                displayName: info?.name?.trim() || groupId,
                                avatar: info?.avt || info?.fullAvt || '',
                                lastMessage: '',
                                lastMessageAt: '',
                            });
                        }
                    } catch (err: any) {
                        console.error(`[ZaloService] getGroupInfo chunk error:`, err.message);
                        // Still add by ID even without details
                        for (const gid of chunk) {
                            conversations.push({
                                threadId: gid,
                                threadType: 'group',
                                displayName: `Nhóm ${gid}`,
                                avatar: '',
                                lastMessage: '',
                                lastMessageAt: '',
                            });
                        }
                    }
                }
                console.log(`[ZaloService] Got ${groupIds.length} groups`);
            }
        } catch (err: any) {
            console.error(`[ZaloService] Failed to get groups:`, err.message);
        }

        return conversations;
    } catch (err: any) {
        console.error(`[ZaloService] getConversations error:`, err);
        return [];
    }
}

/**
 * Get message history for a specific thread.
 *
 * - Group: uses getGroupChatHistory(groupId, count) → {groupMsgs: GroupMessage[]}
 * - User DM: zca-js has NO getUserChatHistory API, returns cached messages
 *   from the realtime listener instead.
 */
export async function getZaloMessages(
    sessionId: string,
    threadId: string,
    threadType: 'user' | 'group',
    count: number = 30,
): Promise<any[]> {
    const session = sessions.get(sessionId);
    if (!session || !session.api || session.status !== 'connected') {
        return [];
    }

    try {
        if (threadType === 'group') {
            // Group: use getGroupChatHistory — returns {groupMsgs: GroupMessage[]}
            try {
                const history = await session.api.getGroupChatHistory(threadId, count);
                // Response shape: { lastActionId, lastActionIdOther, more, groupMsgs: GroupMessage[] }
                // Each GroupMessage has: { type, data: TGroupMessage, threadId, isSelf }
                // TGroupMessage has: { msgId, content, uidFrom, dName, ts, ... }
                const groupMsgs = history?.groupMsgs || [];
                console.log(`[ZaloService] getGroupChatHistory returned ${groupMsgs.length} messages for ${threadId}`);

                return groupMsgs.map((gm: any, i: number) => {
                    const data = gm.data || gm; // GroupMessage.data or raw
                    const content = normalizeMessageContent(data.content);
                    const ts = resolveTimestamp(data.ts);
                    return {
                        id: data.msgId || `zca_gmsg_${Date.now()}_${i}`,
                        content,
                        senderType: gm.isSelf ? 'me' : 'other',
                        senderName: data.dName || (gm.isSelf ? 'Bạn' : 'Thành viên'),
                        createdAt: new Date(ts).toISOString(),
                        type: typeof data.content === 'string' ? 'text' : 'media',
                        senderId: data.uidFrom || '',
                    };
                });
            } catch (err: any) {
                console.error(`[ZaloService] getGroupChatHistory error:`, err.message);
                // Fall back to cache
                const cached = getCachedMessages(sessionId, threadId);
                return cached.slice(-count).map(mapCachedToOutput);
            }
        } else {
            // User DM: zca-js has NO getUserChatHistory API
            // Return messages accumulated from the realtime listener
            const cached = getCachedMessages(sessionId, threadId);
            console.log(`[ZaloService] Returning ${cached.length} cached DM messages for ${threadId}`);

            if (cached.length === 0) {
                console.log(`[ZaloService] No cached messages for DM ${threadId}. Messages will appear as they arrive in realtime.`);
            }

            return cached.slice(-count).map(mapCachedToOutput);
        }
    } catch (err: any) {
        console.error(`[ZaloService] getMessages error:`, err);
        return [];
    }
}

function mapCachedToOutput(msg: ZaloIncomingMessage) {
    return {
        id: msg.msgId,
        content: msg.content,
        senderType: msg.isSelf ? 'me' : 'other',
        senderName: msg.senderName,
        createdAt: new Date(msg.timestamp).toISOString(),
        type: msg.msgType,
        senderId: msg.senderId,
    };
}

/**
 * Send a message to a Zalo thread.
 * zca-js accepts plain string for simple text messages.
 */
export async function sendZaloMsg(
    sessionId: string,
    threadId: string,
    threadType: 'user' | 'group',
    text: string,
): Promise<{ success: boolean; error?: string; msgId?: string }> {
    const session = sessions.get(sessionId);
    if (!session || !session.api || session.status !== 'connected') {
        return { success: false, error: 'Session chưa kết nối' };
    }

    try {
        const type = threadType === 'group' ? ThreadType.Group : ThreadType.User;

        // Send plain string (OpenClaw pattern — simpler and works reliably)
        const result = await session.api.sendMessage(
            text,
            threadId,
            type,
        );

        // Extract message ID from response
        const msgId = result?.msgId ?? result?.message?.msgId ?? result?.attachment?.[0]?.msgId;

        console.log(`[ZaloService] Sent message to ${threadType} ${threadId}: "${text.substring(0, 50)}" (msgId=${msgId})`);

        // Cache the sent message for history
        cacheMessage(sessionId, {
            msgId: msgId ? String(msgId) : `sent_${Date.now()}`,
            threadId,
            threadType,
            content: text,
            senderId: 'self',
            senderName: 'Bạn',
            isSelf: true,
            timestamp: Date.now(),
            msgType: 'text',
        });

        return { success: true, msgId: msgId ? String(msgId) : undefined };

    } catch (err: any) {
        console.error(`[ZaloService] sendMessage error:`, err);
        return { success: false, error: err.message || 'Lỗi gửi tin nhắn' };
    }
}

/**
 * Destroy a Zalo session and cleanup.
 */
export async function destroyZaloSession(sessionId: string): Promise<void> {
    const session = sessions.get(sessionId);
    if (!session) return;

    cleanupListener(sessionId);

    session.status = 'disconnected';
    sessions.delete(sessionId);

    // Clean message cache for this session
    for (const key of messageCache.keys()) {
        if (key.startsWith(`${sessionId}:`)) {
            messageCache.delete(key);
        }
    }

    console.log(`[ZaloService] Session ${sessionId} destroyed`);
}

/**
 * Get session status.
 */
export function getZaloSessionStatus(sessionId: string): string {
    const session = sessions.get(sessionId);
    return session?.status || 'not_found';
}

/**
 * Check if a session exists and is connected.
 */
export function isZaloSessionConnected(sessionId: string): boolean {
    const session = sessions.get(sessionId);
    return session?.status === 'connected' && !!session.api;
}

/**
 * Get all active session IDs.
 */
export function getActiveZaloSessions(): string[] {
    return Array.from(sessions.entries())
        .filter(([_, s]) => s.status === 'connected')
        .map(([id]) => id);
}
