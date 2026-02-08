/**
 * Conversation Context for Inbox Page
 * Manages conversations, messages, and real-time updates
 */
import React, {
    createContext,
    useContext,
    useState,
    useEffect,
    useCallback,
    useRef,
    ReactNode,
} from 'react';
import {
    Conversation,
    Message,
    getConversations,
    getMessages,
    markRead,
    sendMessage as sendAgentMessageApi
} from '@/services/conversation.service';
import {
    initSocket,
    disconnectSocket,
    getSocket,
    joinConversationRoom,
    onMessage,
    offMessage,
    onTyping,
    offTyping,
    sendAgentMessage, // Socket emit
    SocketMessage,
    TypingEvent,
} from '@/lib/socket';
import api from '@/lib/http';

// Types
interface ConversationContextType {
    // Data
    conversations: Conversation[];
    selectedConversation: Conversation | null;
    messages: Message[];

    // Loading states
    isLoadingConversations: boolean;
    isLoadingMessages: boolean;
    isSending: boolean;

    // Connection state
    isConnected: boolean;
    typingVisitor: string | null;

    // Actions
    selectConversation: (conv: Conversation | null) => void;
    sendMessage: (text: string) => Promise<void>;
    refreshConversations: () => Promise<void>;
    loadMoreMessages: () => Promise<void>;
    isLoadingOlderMessages: boolean;
    hasMoreMessages: boolean;
}

const ConversationContext = createContext<ConversationContextType | undefined>(
    undefined
);

export const useConversation = () => {
    const context = useContext(ConversationContext);
    if (!context) {
        throw new Error(
            'useConversation must be used within a ConversationProvider'
        );
    }
    return context;
};

interface ConversationProviderProps {
    children: ReactNode;
    workspaceId?: string;
    siteKey?: string;
}

export const ConversationProvider: React.FC<ConversationProviderProps> = ({
    children,
    workspaceId = 'default',
    siteKey = '',
}) => {
    // State
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selectedConversation, setSelectedConversation] =
        useState<Conversation | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);

    // Loading states
    const [isLoadingConversations, setIsLoadingConversations] = useState(true);
    const [isLoadingMessages, setIsLoadingMessages] = useState(false);
    const [isLoadingOlderMessages, setIsLoadingOlderMessages] = useState(false);
    const [hasMoreMessages, setHasMoreMessages] = useState(false);
    const [isSending, setIsSending] = useState(false);

    // Socket state
    const [isConnected, setIsConnected] = useState(false);
    const [typingVisitor, setTypingVisitor] = useState<string | null>(null);

    // Refs
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const currentConvRef = useRef<Conversation | null>(null);
    const messagesRef = useRef<Message[]>([]);
    const markReadTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Keep ref in sync
    useEffect(() => {
        messagesRef.current = messages;
    }, [messages]);

    // Keep ref in sync with state for socket callbacks
    useEffect(() => {
        currentConvRef.current = selectedConversation;
    }, [selectedConversation]);

    /**
     * Mark conversation as read (Debounced)
     */
    const triggerMarkRead = useCallback((convId: string) => {
        if (markReadTimeoutRef.current) clearTimeout(markReadTimeoutRef.current);

        markReadTimeoutRef.current = setTimeout(async () => {
            try {
                // Call API
                const result = await markRead(workspaceId, convId);

                // Update local state
                setConversations(prev => prev.map(c =>
                    c.conversationId === convId ? { ...c, unreadCount: 0 } : c
                ));
            } catch (err) {
                console.error('Failed to mark read:', err);
            }
        }, 1000); // 1s debounce
    }, [workspaceId]);

    /**
     * Fetch conversations from backend (workspace-scoped)
     */
    const refreshConversations = useCallback(async () => {
        if (!workspaceId || workspaceId === 'default') {
            console.warn('No workspace selected, skipping conversation fetch');
            setIsLoadingConversations(false);
            return;
        }

        setIsLoadingConversations(true);
        try {
            // Workspace-scoped Fetch using new endpoint
            const response = await api.get<{
                status: string;
                data: { workspaceId: string; conversations: any[]; count: number };
            }>(`/embed/workspaces/${workspaceId}/conversations`);

            const convs = response.data.data.conversations.map((c: any) => ({
                conversationId: c.id || c.ConversationId,
                conversationKey: c.conversationKey || c.ConversationKey || 0,
                visitorId: c.visitorId || c.VisitorId,
                visitorName: c.visitorName || c.VisitorName || `Visitor ${(c.visitorId || c.VisitorId || '').slice(-6)}`,
                widgetId: c.WidgetKey?.toString() || '',
                widgetName: c.widgetName || c.WidgetName || 'Widget',
                siteKey: c.siteKey || c.SiteKey,
                workspaceName: c.workspaceName || '',
                workspaceId: c.workspaceId || workspaceId,
                domain: c.domain,
                status: c.status || c.Status,
                messageCount: c.messageCount || 0,
                unreadCount: c.unreadCount || 0,
                lastMessageContent: c.lastMessagePreview || c.lastMessage?.content || c.lastMessage?.text || c.lastMessageContent || c.LastMessageContent,
                lastMessageAt: c.lastMessageAt || c.LastMessageAt,
                createdAt: c.createdAt || c.CreatedAt,
                updatedAt: c.updatedAt || c.UpdatedAt,
            }));

            setConversations(convs);
        } catch (error) {
            console.error('Error fetching conversations:', error);
            setConversations([]);
        } finally {
            setIsLoadingConversations(false);
        }
    }, [workspaceId]);

    /**
     * Fetch messages for a conversation
     */
    const fetchMessages = useCallback(async (conv: Conversation) => {
        setIsLoadingMessages(true);
        try {
            // Use Service
            const data = await getMessages(workspaceId, conv.conversationId, { limit: 50 });

            const msgs = data.items.map((m) => ({
                id: m.id,
                seq: m.seq,
                text: m.text,
                sender: m.sender,
                senderType: m.senderType,
                senderId: m.senderId,
                createdAt: m.createdAt,
                clientMsgId: m.clientMsgId,
            })) as Message[];

            // Sort by seq ascending (oldest first)
            msgs.sort((a, b) => a.seq - b.seq);

            setMessages(msgs);
            setHasMoreMessages(!!(data.nextCursor || data.hasMore));
        } catch (error) {
            console.error('Error fetching messages:', error);
            setMessages([]);
            setHasMoreMessages(false);
        } finally {
            setIsLoadingMessages(false);
        }
    }, [workspaceId]);

    const loadMoreMessages = useCallback(async () => {
        if (!selectedConversation || !messages.length || isLoadingOlderMessages) return;

        setIsLoadingOlderMessages(true);
        const oldestSeq = messages[0].seq;

        try {
            // Use Service
            const data = await getMessages(workspaceId, selectedConversation.conversationId, {
                limit: 50,
                beforeSeq: oldestSeq
            });

            if (!data.items || data.items.length === 0) {
                setHasMoreMessages(false);
                return;
            }

            const msgs = data.items.map((m) => ({
                id: m.id,
                seq: m.seq,
                text: m.text,
                sender: m.sender, // 'visitor' or 'agent'
                senderType: m.senderType,
                senderId: m.senderId,
                createdAt: m.createdAt,
                clientMsgId: m.clientMsgId,
            })) as Message[];

            msgs.sort((a, b) => a.seq - b.seq);

            setMessages(prev => {
                const existingIds = new Set(prev.map(m => m.id));
                const uniqueNewMsgs = msgs.filter(m => !existingIds.has(m.id));
                return [...uniqueNewMsgs, ...prev];
            });
            setHasMoreMessages(!!(data.nextCursor || data.hasMore));
        } catch (error) {
            console.error('Error loading older messages:', error);
        } finally {
            setIsLoadingOlderMessages(false);
        }
    }, [selectedConversation, messages, isLoadingOlderMessages, workspaceId]);

    /**
     * Select a conversation
     */
    const selectConversation = useCallback(
        async (conv: Conversation | null) => {
            setSelectedConversation(conv);

            if (!conv) {
                setMessages([]);
                return;
            }

            // Fetch messages
            await fetchMessages(conv);

            // Mark Read Optimistically
            setConversations(prev => prev.map(c =>
                c.conversationId === conv.conversationId ? { ...c, unreadCount: 0 } : c
            ));

            // Trigger API Mark Read
            triggerMarkRead(conv.conversationId);

            // Join socket room
            const socket = getSocket();
            if (socket && conv.siteKey && conv.visitorId) {
                joinConversationRoom(conv.siteKey, conv.visitorId);
            }
        },
        [fetchMessages, triggerMarkRead]
    );

    /**
     * Send a message
     */
    const sendMessage = useCallback(
        async (text: string) => {
            if (!selectedConversation || !text.trim()) return;

            setIsSending(true);
            const clientMsgId = `agent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

            try {
                const targetSiteKey = selectedConversation.siteKey;

                // Use Socket to send message
                const response = await sendAgentMessage(
                    text.trim(),
                    selectedConversation.conversationId,
                    targetSiteKey,
                    selectedConversation.visitorId,
                    clientMsgId
                );

                if (!response.success || !response.data) {
                    throw new Error(response.error || 'Failed to send message');
                }

                const newMessage: Message = {
                    id: response.data.id,
                    seq: response.data.seq,
                    text: response.data.text,
                    sender: 'agent',
                    senderType: 2,
                    senderId: response.data.senderId || 'agent',
                    createdAt: response.data.createdAt,
                    clientMsgId,
                };

                setMessages((prev) => {
                    if (prev.some((m) => m.clientMsgId === clientMsgId || m.id === newMessage.id)) {
                        return prev;
                    }
                    return [...prev, newMessage];
                });

                // Also update conversation list last message
                setConversations(prev => prev.map(c =>
                    c.conversationId === selectedConversation.conversationId ? {
                        ...c,
                        lastMessageContent: newMessage.text,
                        lastMessageAt: newMessage.createdAt,
                        messageCount: (c.messageCount || 0) + 1
                    } : c
                ));

            } catch (error) {
                console.error('Error sending message:', error);
                throw error;
            } finally {
                setIsSending(false);
            }
        },
        [selectedConversation]
    );

    /**
     * Handle incoming socket message
     */
    const handleSocketMessage = useCallback((msg: SocketMessage) => {
        const currentConv = currentConvRef.current;
        const msgIsVisitor = msg.senderType === 1 || msg.sender === 'visitor';

        // 1. Update Message List (if active)
        const msgId = msg.conversationId || '';
        if (
            currentConv &&
            ((msgId && msgId.toLowerCase() === currentConv.conversationId.toLowerCase()) ||
                msg.visitorId?.toLowerCase() === currentConv.visitorId?.toLowerCase())
        ) {
            setMessages((prev) => {
                if (prev.some((m) => m.id === msg.id || (msg.clientMsgId && m.clientMsgId === msg.clientMsgId))) {
                    return prev;
                }
                const newMessage: Message = {
                    id: msg.id,
                    seq: msg.seq,
                    text: msg.text,
                    sender: msg.sender,
                    senderType: msg.senderType,
                    senderId: msg.senderId,
                    createdAt: msg.createdAt,
                    clientMsgId: msg.clientMsgId,
                };
                return [...prev, newMessage].sort((a, b) => a.seq - b.seq);
            });

            // If visitor message in current conversation -> Mark Read Again
            if (msgIsVisitor) {
                triggerMarkRead(currentConv.conversationId);
            }
        }

        // 2. Update Conversation List (Unread Count + Last Message)
        setConversations((prev) => {
            const exists = prev.some(c =>
                c.conversationId.toLowerCase() === msg.conversationId?.toLowerCase() ||
                c.visitorId?.toLowerCase() === msg.visitorId?.toLowerCase()
            );

            if (exists) {
                return prev.map((c) => {
                    // Match conversation (Case-insensitive check for GUIDs and visitorId)
                    const msgId = msg.conversationId || '';
                    const isIdMatch = msgId && c.conversationId.toLowerCase() === msgId.toLowerCase();
                    const isVisitorMatch = msg.visitorId?.toLowerCase() === c.visitorId?.toLowerCase();

                    if (isIdMatch || isVisitorMatch) {
                        // Increase unread count if Visitor AND Not Current Conversation
                        let newUnread = c.unreadCount || 0;
                        if (msgIsVisitor) {
                            if (!currentConv || (currentConv.conversationId.toLowerCase() !== c.conversationId.toLowerCase())) {
                                newUnread += 1;
                            } else {
                                // If current, we are reading it technically, keep 0 (triggerMarkRead called above)
                                newUnread = 0;
                            }
                        }

                        return {
                            ...c,
                            lastMessageContent: msg.text,
                            lastMessageAt: msg.createdAt,
                            messageCount: (c.messageCount || 0) + 1,
                            unreadCount: newUnread
                        };
                    }
                    return c;
                });
            } else {
                refreshConversations();
                return prev;
            }
        });
    }, [refreshConversations, triggerMarkRead]);

    /**
     * Handle typing indicator
     */
    const handleTyping = useCallback((event: TypingEvent) => {
        const currentConv = currentConvRef.current;
        if (!currentConv) return;
        if (event.visitorId !== currentConv.visitorId) return;

        if (event.sender === 'visitor') {
            if (event.isTyping) {
                setTypingVisitor(event.visitorId);
                if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
                typingTimeoutRef.current = setTimeout(() => {
                    setTypingVisitor(null);
                }, 3000);
            } else {
                setTypingVisitor(null);
            }
        }
    }, []);

    /**
     * Initialize socket
     */
    useEffect(() => {
        const initializeSocket = async () => {
            try {
                const authTokenRaw = localStorage.getItem('auth_token');
                let token: string | null = null;
                if (authTokenRaw) {
                    try {
                        const parsed = JSON.parse(authTokenRaw);
                        token = parsed.code;
                    } catch (e) { token = authTokenRaw; }
                }

                if (!token) return;

                const socket = initSocket(token);

                socket.on('connect', () => setIsConnected(true));
                socket.on('disconnect', () => setIsConnected(false));

                onMessage(handleSocketMessage);
                onTyping(handleTyping);
            } catch (error) {
                console.error('Error initializing socket:', error);
            }
        };

        initializeSocket();
        return () => {
            offMessage(handleSocketMessage);
            offTyping(handleTyping);
            disconnectSocket();
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        };
    }, [handleSocketMessage, handleTyping]);

    /**
     * Clear state when workspace changes
     */
    useEffect(() => {
        // Reset state when workspace changes
        setSelectedConversation(null);
        setMessages([]);
        setConversations([]);
        setTypingVisitor(null);
    }, [workspaceId]);

    /**
     * Initial fetch (triggered when workspaceId changes)
     */
    useEffect(() => {
        refreshConversations();
    }, [refreshConversations]);

    const contextValue: ConversationContextType = {
        conversations,
        selectedConversation,
        messages,
        isLoadingConversations,
        isLoadingMessages,
        isSending,
        isConnected,
        typingVisitor,
        selectConversation,
        sendMessage,
        refreshConversations,
        loadMoreMessages,
        isLoadingOlderMessages,
        hasMoreMessages,
    };

    return (
        <ConversationContext.Provider value={contextValue}>
            {children}
        </ConversationContext.Provider>
    );
};

export default ConversationContext;
