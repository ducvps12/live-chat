import { SenderType, MessageType } from './common';

// ── Attachment ──
export interface Attachment {
    data: string;       // base64 data URI
    filename: string;
    mimeType: string;
    size: number;
}

// ── Message sender ──
export interface MessageSender {
    type: SenderType;
    id: string;
    name?: string;
}

// ── Message (frontend-facing, JSON from API) ──
export interface Message {
    _id: string;
    conversationId: string;
    clientMessageId?: string;
    sender: MessageSender;
    content: string;
    type: MessageType;
    status?: 'sent' | 'delivered' | 'read' | 'error';  // undefined = sending, error = failed
    attachments?: Attachment[];
    isInternal?: boolean;
    createdAt: string;
    updatedAt?: string;
}
