/**
 * Socket.IO client for agent-side real-time messaging
 */
import { io, Socket } from 'socket.io-client';

// Determine socket URL:
// 1. If NEXT_PUBLIC_API_URL is set and is absolute (http://...), use it
// 2. Otherwise fall back to localhost:3001 (default backend port)
const getSocketUrl = (): string => {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
  
  // If it's an absolute URL, use it for socket
  if (apiUrl.startsWith('http://') || apiUrl.startsWith('https://')) {
    // Remove /api suffix if present to get base URL
    return apiUrl.replace(/\/api\/?$/, '');
  }
  
  // Default to backend port 3001
  return 'http://localhost:3001';
};

const SOCKET_URL = getSocketUrl();

let socket: Socket | null = null;

// Store listeners to re-attach on reconnect
const messageListeners: Set<(message: SocketMessage) => void> = new Set();
const typingListeners: Set<(event: TypingEvent) => void> = new Set();

export interface SocketMessage {
  id: string;
  seq: number;
  text: string;
  sender: 'visitor' | 'agent';
  senderType: number;
  senderId: string;
  createdAt: string;
  clientMsgId?: string;
  conversationId?: string;
  visitorId?: string;
}

export interface TypingEvent {
  visitorId: string;
  isTyping: boolean;
  sender: 'visitor' | 'agent';
}

/**
 * Re-attach all stored listeners to the socket
 */
const reattachListeners = () => {
  if (!socket) return;
  
  console.log(`[Socket] Re-attaching ${messageListeners.size} message listeners and ${typingListeners.size} typing listeners`);
  
  // Re-attach message listeners
  messageListeners.forEach(cb => {
    socket!.off('embed:message', cb);
    socket!.on('embed:message', cb);
  });
  
  // Re-attach typing listeners
  typingListeners.forEach(cb => {
    socket!.off('embed:typing', cb);
    socket!.on('embed:typing', cb);
  });
};

/**
 * Initialize socket connection with JWT token
 */
export const initSocket = (token: string): Socket => {
  if (socket?.connected) {
    return socket;
  }

  console.log('[Socket] Connecting to:', `${SOCKET_URL}/embed`);
  
  socket = io(`${SOCKET_URL}/embed`, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  socket.on('connect', () => {
    console.log('[Socket] Connected to server');
    // Re-attach listeners on connect/reconnect
    reattachListeners();
  });

  socket.on('connect_error', (error) => {
    console.error('[Socket] Connection error:', error.message);
  });

  socket.on('disconnect', (reason) => {
    console.log('[Socket] Disconnected:', reason);
  });

  return socket;
};

/**
 * Get existing socket instance
 */
export const getSocket = (): Socket | null => socket;

/**
 * Disconnect socket
 */
export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

/**
 * Join a conversation room as agent
 */
export const joinConversationRoom = (
  siteKey: string,
  visitorId: string
): Promise<{ success: boolean; room?: string; error?: string }> => {
  return new Promise((resolve) => {
    if (!socket) {
      resolve({ success: false, error: 'Socket not connected' });
      return;
    }

    socket.emit('embed:agent-join', { siteKey, visitorId }, (response: any) => {
      resolve(response);
    });
  });
};

/**
 * Send message as agent
 */
export const sendAgentMessage = (
  text: string,
  conversationId: string,
  siteKey: string,
  visitorId: string,
  clientMsgId?: string
): Promise<{ success: boolean; data?: SocketMessage; error?: string }> => {
  return new Promise((resolve) => {
    if (!socket) {
      resolve({ success: false, error: 'Socket not connected' });
      return;
    }

    socket.emit('embed:agent-message', { 
      text, 
      conversationId, 
      siteKey, 
      visitorId, 
      clientMsgId 
    }, (response: any) => {
      resolve(response);
    });
  });
};

/**
 * Send typing indicator
 */
export const sendTypingIndicator = (isTyping: boolean) => {
  if (socket) {
    socket.emit('embed:typing', { isTyping });
  }
};

/**
 * Subscribe to messages
 */
export const onMessage = (callback: (message: SocketMessage) => void) => {
  // Store for re-attachment on reconnect
  messageListeners.add(callback);
  
  if (socket) {
    socket.on('embed:message', callback);
    console.log('[Socket] Message listener attached, total listeners:', messageListeners.size);
  } else {
    console.log('[Socket] Message listener stored (socket not ready), total listeners:', messageListeners.size);
  }
};

/**
 * Subscribe to typing events
 */
export const onTyping = (callback: (event: TypingEvent) => void) => {
  // Store for re-attachment on reconnect
  typingListeners.add(callback);
  
  if (socket) {
    socket.on('embed:typing', callback);
  }
};

/**
 * Remove message listener
 */
export const offMessage = (callback?: (message: SocketMessage) => void) => {
  if (callback) {
    messageListeners.delete(callback);
    if (socket) {
      socket.off('embed:message', callback);
    }
  } else {
    messageListeners.clear();
    if (socket) {
      socket.off('embed:message');
    }
  }
};

/**
 * Remove typing listener
 */
export const offTyping = (callback?: (event: TypingEvent) => void) => {
  if (callback) {
    typingListeners.delete(callback);
    if (socket) {
      socket.off('embed:typing', callback);
    }
  } else {
    typingListeners.clear();
    if (socket) {
      socket.off('embed:typing');
    }
  }
};
