/**
 * ZaloPersonalService — Pure zca-js integration (No Puppeteer).
 * Based on OpenClaw's @openclaw/zalouser plugin patterns.
 *
 * Architecture:
 *  - QR Login: zalo.loginQR → QR image sent to frontend → credentials saved
 *  - Session Restore: zalo.login(savedCredentials) — instant reconnect, no QR
 *  - Realtime Listener: api.listener.on('message') with watchdog timer
 *  - Message Cache: in-memory cache for DM history (no getUserChatHistory API)
 *  - Group History: getGroupChatHistory(groupId, count)
 *  - Conversations: getAllFriends() + getAllGroups() + getGroupInfo()
 *
 * IMPORTANT: Only 1 web listener per Zalo account at a time.
 */
import { Zalo, ThreadType } from 'zca-js';
import { LoginQRCallbackEventType } from 'zca-js';
import type { LoginQRCallbackEvent } from 'zca-js';
import fs from 'fs';
import path from 'path';

// ── Constants ──
const LISTENER_WATCHDOG_INTERVAL_MS = 30_000;
const LISTENER_WATCHDOG_MAX_GAP_MS = 35_000;
const MESSAGE_CACHE_MAX_PER_THREAD = 100;
const GROUP_INFO_CHUNK_SIZE = 80;
const CREDENTIALS_DIR = path.resolve(process.cwd(), 'data', 'zalo-sessions');

// ── Types ──
export interface StoredCredentials {
    imei: string;
    cookie: any;
    userAgent: string;
    language?: string;
    createdAt: string;
    lastUsedAt: string;
}

export interface ZaloSession {
    sessionId: string;
    api: any;
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
const messageCache = new Map<string, ZaloIncomingMessage[]>();
// Track recent conversation activity for sorting (like phone app)
const recentConvActivity = new Map<string, { threadId: string; lastMsgAt: number; lastMsg: string; senderName: string }>();

// ========================
// CREDENTIAL PERSISTENCE
// ========================

function ensureCredentialsDir(): void {
    if (!fs.existsSync(CREDENTIALS_DIR)) {
        fs.mkdirSync(CREDENTIALS_DIR, { recursive: true });
    }
}

function credentialsPath(sessionId: string): string {
    return path.join(CREDENTIALS_DIR, `${sessionId}.json`);
}

function writeCredentials(sessionId: string, creds: Omit<StoredCredentials, 'createdAt' | 'lastUsedAt'>): void {
    ensureCredentialsDir();
    const stored: StoredCredentials = {
        ...creds,
        createdAt: new Date().toISOString(),
        lastUsedAt: new Date().toISOString(),
    };
    fs.writeFileSync(credentialsPath(sessionId), JSON.stringify(stored, null, 2), 'utf-8');
    console.log(`[ZaloService] Credentials saved for session ${sessionId}`);
}

function readCredentials(sessionId: string): StoredCredentials | null {
    const filePath = credentialsPath(sessionId);
    if (!fs.existsSync(filePath)) return null;
    try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(raw) as StoredCredentials;
    } catch {
        return null;
    }
}

function updateLastUsed(sessionId: string): void {
    const creds = readCredentials(sessionId);
    if (!creds) return;
    creds.lastUsedAt = new Date().toISOString();
    try {
        fs.writeFileSync(credentialsPath(sessionId), JSON.stringify(creds, null, 2), 'utf-8');
    } catch { /* silent */ }
}

function clearCredentials(sessionId: string): void {
    const filePath = credentialsPath(sessionId);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`[ZaloService] Credentials cleared for session ${sessionId}`);
    }
}

export function hasStoredCredentials(sessionId: string): boolean {
    return readCredentials(sessionId) !== null;
}

// ========================
// MESSAGE CACHE
// ========================

function cacheMessage(sessionId: string, msg: ZaloIncomingMessage): void {
    const key = `${sessionId}:${msg.threadId}`;
    let list = messageCache.get(key);
    if (!list) {
        list = [];
        messageCache.set(key, list);
    }
    if (list.some(m => m.msgId === msg.msgId)) return;
    list.push(msg);
    if (list.length > MESSAGE_CACHE_MAX_PER_THREAD) {
        list.splice(0, list.length - MESSAGE_CACHE_MAX_PER_THREAD);
    }

    // Track recent conversation activity (for sorting like phone app)
    recentConvActivity.set(key, {
        threadId: msg.threadId,
        lastMsgAt: msg.timestamp,
        lastMsg: msg.content.substring(0, 80),
        senderName: msg.senderName,
    });
}

function getCachedMessages(sessionId: string, threadId: string): ZaloIncomingMessage[] {
    return messageCache.get(`${sessionId}:${threadId}`) || [];
}

// ========================
// HELPERS
// ========================

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

function resolveTimestamp(ts: unknown): number {
    if (typeof ts === 'number' && Number.isFinite(ts)) {
        return ts > 1_000_000_000_000 ? ts : ts * 1000;
    }
    const parsed = parseInt(String(ts || ''), 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return Date.now();
    return parsed > 1_000_000_000_000 ? parsed : parsed * 1000;
}

// ========================
// QR LOGIN (new session)
// ========================

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

        console.log(`[ZaloService] Creating QR login session ${sessionId}...`);

        const zalo = new Zalo({ logging: false, selfListen: false });

        const session: ZaloSession = {
            sessionId,
            api: null,
            status: 'qr_pending',
            listenerStarted: false,
            onMessage,
            onError,
            createdAt: new Date(),
        };

        sessions.set(sessionId, session);

        // Capture credentials from GotLoginInfo event (OpenClaw pattern)
        let capturedCredentials: Omit<StoredCredentials, 'createdAt' | 'lastUsedAt'> | null = null;

        const api = await zalo.loginQR(undefined, (event: LoginQRCallbackEvent) => {
            try {
                switch (event.type) {
                    case LoginQRCallbackEventType.QRCodeGenerated: {
                        console.log(`[ZaloService] QR code generated for session ${sessionId}`);
                        const rawImage = (event.data as any)?.image;
                        if (rawImage) {
                            const image = String(rawImage).replace(/^data:image\/png;base64,/, '');
                            const qrDataUrl = image.startsWith('data:image')
                                ? image
                                : `data:image/png;base64,${image}`;
                            onQR(qrDataUrl);
                        }
                        break;
                    }
                    case LoginQRCallbackEventType.QRCodeExpired: {
                        console.log(`[ZaloService] QR expired, auto-retrying...`);
                        try { (event as any).actions?.retry?.(); } catch { /* ignore */ }
                        break;
                    }
                    case LoginQRCallbackEventType.QRCodeDeclined: {
                        console.log(`[ZaloService] QR login declined`);
                        break;
                    }
                    case LoginQRCallbackEventType.GotLoginInfo: {
                        // Capture credentials for persistence (OpenClaw pattern)
                        const data = event.data as any;
                        capturedCredentials = {
                            imei: data.imei,
                            cookie: data.cookie,
                            userAgent: data.userAgent,
                        };
                        console.log(`[ZaloService] Captured login credentials for ${sessionId}`);
                        break;
                    }
                    default:
                        break;
                }
            } catch (err) {
                console.error(`[ZaloService] QR callback error:`, err);
            }
        });

        if (!api) {
            throw new Error('Login failed — no API returned');
        }

        // Fallback: get credentials from API context if not captured from event
        if (!capturedCredentials) {
            try {
                const ctx = api.getContext();
                const cookieJar = api.getCookie();
                const cookieJson = cookieJar?.toJSON?.();
                capturedCredentials = {
                    imei: ctx.imei,
                    cookie: cookieJson?.cookies ?? [],
                    userAgent: ctx.userAgent,
                    language: ctx.language,
                };
                console.log(`[ZaloService] Captured credentials from API context for ${sessionId}`);
            } catch (err) {
                console.warn(`[ZaloService] Could not extract credentials from context:`, err);
            }
        }

        // Save credentials for future session restore
        if (capturedCredentials) {
            writeCredentials(sessionId, capturedCredentials);
        }

        // Login succeeded
        session.api = api;
        session.status = 'connected';
        session.connectedAt = new Date();
        console.log(`[ZaloService] Session ${sessionId} connected via QR login!`);

        startMessageListener(sessionId);
        onLogin(session);

    } catch (err: any) {
        console.error(`[ZaloService] Session ${sessionId} QR login failed:`, err);
        const session = sessions.get(sessionId);
        if (session) session.status = 'error';
        onError(err.message || 'Lỗi đăng nhập Zalo');
    }
}

// ========================
// SESSION RESTORE (no QR)
// ========================

export async function restoreZaloSession(
    sessionId: string,
    onMessage: (msg: ZaloIncomingMessage) => void,
    onError: (error: string) => void,
): Promise<boolean> {
    const creds = readCredentials(sessionId);
    if (!creds) {
        console.log(`[ZaloService] No stored credentials for session ${sessionId}`);
        return false;
    }

    // Already connected?
    if (isZaloSessionConnected(sessionId)) {
        console.log(`[ZaloService] Session ${sessionId} already connected`);
        return true;
    }

    // Destroy any stale session
    if (sessions.has(sessionId)) {
        await destroyZaloSession(sessionId);
    }

    try {
        console.log(`[ZaloService] Restoring session ${sessionId} from saved credentials...`);

        const zalo = new Zalo({ logging: false, selfListen: false });
        const api = await zalo.login({
            imei: creds.imei,
            cookie: creds.cookie,
            userAgent: creds.userAgent,
        });

        if (!api) {
            throw new Error('Session restore failed — no API returned');
        }

        updateLastUsed(sessionId);

        const session: ZaloSession = {
            sessionId,
            api,
            status: 'connected',
            listenerStarted: false,
            onMessage,
            onError,
            createdAt: new Date(creds.createdAt),
            connectedAt: new Date(),
        };

        sessions.set(sessionId, session);
        console.log(`[ZaloService] Session ${sessionId} restored successfully!`);

        startMessageListener(sessionId);
        return true;

    } catch (err: any) {
        console.error(`[ZaloService] Session ${sessionId} restore failed:`, err);
        // Clear invalid credentials
        clearCredentials(sessionId);
        onError(err.message || 'Session restore failed — credentials expired');
        return false;
    }
}

// ========================
// MESSAGE LISTENER
// ========================

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

                cacheMessage(sessionId, incomingMsg);

                if (session.onMessage) {
                    session.onMessage(incomingMsg);
                }
            } catch (err) {
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

        // Watchdog timer
        session.watchdogTimer = setInterval(() => {
            if (!session.listenerStarted) return;
            const now = Date.now();
            const gap = now - (session.lastWatchdogTickAt || now);
            session.lastWatchdogTickAt = now;
            if (gap > LISTENER_WATCHDOG_MAX_GAP_MS) {
                console.error(`[ZaloService] Watchdog gap (${Math.round(gap / 1000)}s) for ${sessionId}`);
                cleanupListener(sessionId);
                session.onError?.('Listener watchdog timeout');
            }
        }, LISTENER_WATCHDOG_INTERVAL_MS);

        console.log(`[ZaloService] Listener started for session ${sessionId} (with watchdog)`);
    } catch (err) {
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
    try { session.api?.listener?.stop(); } catch { /* ignore */ }
    session.listenerStarted = false;
}

// ========================
// CONVERSATIONS
// ========================

export async function getZaloConversations(sessionId: string): Promise<ZaloConversationItem[]> {
    const session = sessions.get(sessionId);
    if (!session || !session.api || session.status !== 'connected') {
        console.warn(`[ZaloService] Session ${sessionId} not connected`);
        return [];
    }

    try {
        const conversations: ZaloConversationItem[] = [];

        // Friends — getAllFriends() returns User[] directly
        try {
            const friends = await session.api.getAllFriends();
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

        // Groups — getAllGroups() returns {gridVerMap}, then getGroupInfo for details
        try {
            const allGroups = await session.api.getAllGroups();
            const gridVerMap = allGroups?.gridVerMap || {};
            const groupIds = Object.keys(gridVerMap);

            if (groupIds.length > 0) {
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

        // Enrich conversations with recent activity data and sort like phone app
        for (const conv of conversations) {
            const activityKey = `${sessionId}:${conv.threadId}`;
            const activity = recentConvActivity.get(activityKey);
            if (activity) {
                conv.lastMessage = activity.lastMsg;
                conv.lastMessageAt = new Date(activity.lastMsgAt).toISOString();
            }
        }

        // Sort: conversations with recent messages first (newest first),
        // then conversations without activity go to the bottom (alphabetically)
        conversations.sort((a, b) => {
            const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
            const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;

            // Both have activity → sort by most recent first
            if (aTime > 0 && bTime > 0) return bTime - aTime;
            // One has activity, the other doesn't → active one first
            if (aTime > 0) return -1;
            if (bTime > 0) return 1;
            // Neither has activity → alphabetical
            return (a.displayName || '').localeCompare(b.displayName || '');
        });

        return conversations;
    } catch (err) {
        console.error(`[ZaloService] getConversations error:`, err);
        return [];
    }
}

// ========================
// MESSAGES
// ========================

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
            try {
                const history = await session.api.getGroupChatHistory(threadId, count);
                const groupMsgs = history?.groupMsgs || [];
                console.log(`[ZaloService] getGroupChatHistory: ${groupMsgs.length} messages for ${threadId}`);

                return groupMsgs.map((gm: any, i: number) => {
                    const data = gm.data || gm;
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
                const cached = getCachedMessages(sessionId, threadId);
                return cached.slice(-count).map(mapCachedToOutput);
            }
        } else {
            // User DM: no native API — return cached messages from listener
            const cached = getCachedMessages(sessionId, threadId);
            console.log(`[ZaloService] DM history: ${cached.length} cached messages for ${threadId}`);
            return cached.slice(-count).map(mapCachedToOutput);
        }
    } catch (err) {
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

// ========================
// SEND MESSAGE
// ========================

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
        const result = await session.api.sendMessage(text, threadId, type);
        const msgId = result?.msgId ?? result?.message?.msgId ?? result?.attachment?.[0]?.msgId;

        console.log(`[ZaloService] Sent to ${threadType} ${threadId}: "${text.substring(0, 50)}" (msgId=${msgId})`);

        // Cache sent message
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

// ========================
// SESSION MANAGEMENT
// ========================

export async function destroyZaloSession(sessionId: string): Promise<void> {
    const session = sessions.get(sessionId);
    if (!session) return;

    cleanupListener(sessionId);
    session.status = 'disconnected';
    sessions.delete(sessionId);

    for (const key of messageCache.keys()) {
        if (key.startsWith(`${sessionId}:`)) {
            messageCache.delete(key);
        }
    }

    console.log(`[ZaloService] Session ${sessionId} destroyed`);
}

export function logoutZaloSession(sessionId: string): void {
    clearCredentials(sessionId);
    destroyZaloSession(sessionId);
    console.log(`[ZaloService] Session ${sessionId} logged out and credentials cleared`);
}

export function getZaloSessionStatus(sessionId: string): string {
    const session = sessions.get(sessionId);
    return session?.status || 'not_found';
}

export function isZaloSessionConnected(sessionId: string): boolean {
    const session = sessions.get(sessionId);
    return session?.status === 'connected' && !!session.api;
}

export function getActiveZaloSessions(): string[] {
    return Array.from(sessions.entries())
        .filter(([_, s]) => s.status === 'connected')
        .map(([id]) => id);
}
