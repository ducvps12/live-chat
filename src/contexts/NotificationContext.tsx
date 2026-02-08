/**
 * Notification Context
 * Workspace-scoped notifications with real-time updates
 */
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useMyStore } from '@/contexts/MyStoreContext';
import { getSocket, onMessage, offMessage, SocketMessage } from '@/lib/socket';

interface Notification {
    id: string;
    type: 'new_message' | 'new_conversation' | 'mention' | 'system';
    title: string;
    body: string;
    conversationId?: string;
    visitorName?: string;
    createdAt: string;
    read: boolean;
}

interface NotificationContextType {
    notifications: Notification[];
    unreadCount: number;
    markRead: (id: string) => void;
    markAllRead: () => void;
    clearAll: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

// Default values for SSR/when outside provider
const defaultNotificationContext: NotificationContextType = {
    notifications: [],
    unreadCount: 0,
    markRead: () => { },
    markAllRead: () => { },
    clearAll: () => { }
};

export const useNotifications = () => {
    const context = useContext(NotificationContext);
    // Return default context for SSR safety - no error thrown
    if (!context) {
        return defaultNotificationContext;
    }
    return context;
};

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { activeWorkspace } = useMyStore();
    const [notifications, setNotifications] = useState<Notification[]>([]);

    // Handle new message notification
    const handleNewMessage = useCallback((msg: SocketMessage) => {
        // Only create notification for visitor messages (not agent messages)
        if (msg.senderType !== 1) return;

        const notification: Notification = {
            id: `msg-${msg.id}`,
            type: 'new_message',
            title: 'New Message',
            body: msg.text.substring(0, 100) + (msg.text.length > 100 ? '...' : ''),
            conversationId: msg.conversationId,
            visitorName: msg.visitorId,
            createdAt: msg.createdAt,
            read: false
        };

        setNotifications(prev => [notification, ...prev.slice(0, 49)]); // Keep max 50

        // Show browser notification if permitted
        if (Notification.permission === 'granted') {
            new Notification(notification.title, {
                body: notification.body,
                icon: '/favicon.ico'
            });
        }
    }, []);

    // Subscribe to socket events
    useEffect(() => {
        onMessage(handleNewMessage);
        return () => offMessage(handleNewMessage);
    }, [handleNewMessage]);

    // Clear notifications when workspace changes
    useEffect(() => {
        setNotifications([]);
    }, [activeWorkspace?.workspaceId]);

    // Request notification permission
    useEffect(() => {
        if (typeof window !== 'undefined' && 'Notification' in window) {
            if (Notification.permission === 'default') {
                Notification.requestPermission();
            }
        }
    }, []);

    const unreadCount = notifications.filter(n => !n.read).length;

    const markRead = useCallback((id: string) => {
        setNotifications(prev =>
            prev.map(n => n.id === id ? { ...n, read: true } : n)
        );
    }, []);

    const markAllRead = useCallback(() => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    }, []);

    const clearAll = useCallback(() => {
        setNotifications([]);
    }, []);

    return (
        <NotificationContext.Provider value={{
            notifications,
            unreadCount,
            markRead,
            markAllRead,
            clearAll
        }}>
            {children}
        </NotificationContext.Provider>
    );
};

export default NotificationContext;
