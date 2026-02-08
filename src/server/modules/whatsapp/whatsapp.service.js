/**
 * WhatsApp Business API Service
 * Handles OAuth, message sending, and account management
 * Uses Meta's WhatsApp Cloud API
 */
const axios = require('axios');
const whatsappRepo = require('./repos/whatsapp.repo');

const GRAPH_API_VERSION = 'v19.0';
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

// Environment variables
const WHATSAPP_WEBHOOK_VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'livechat_wa_webhook_verify_2026';

/**
 * Verify webhook challenge from Meta
 */
const verifyWebhook = (mode, token, challenge) => {
    if (mode === 'subscribe' && token === WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
        console.log('[WhatsApp] Webhook verified successfully');
        return { success: true, challenge };
    }
    console.warn('[WhatsApp] Webhook verification failed');
    return { success: false };
};

/**
 * Process incoming webhook events
 */
const processWebhookEvent = async (body) => {
    console.log('[WhatsApp] Webhook event received:', JSON.stringify(body, null, 2));

    // WhatsApp webhook structure
    const entry = body.entry?.[0];
    if (!entry) return;

    const changes = entry.changes?.[0];
    if (!changes || changes.field !== 'messages') return;

    const value = changes.value;
    const phoneNumberId = value.metadata?.phone_number_id;
    const messages = value.messages || [];
    const contacts = value.contacts || [];

    // Find account by phone number ID
    const account = await whatsappRepo.findByPhoneNumberId(phoneNumberId);
    if (!account) {
        console.warn(`[WhatsApp] Unknown phone number ID: ${phoneNumberId}`);
        return;
    }

    // Process each message
    for (const message of messages) {
        const senderId = message.from; // User's phone number
        const contact = contacts.find(c => c.wa_id === senderId);
        const senderName = contact?.profile?.name || senderId;

        await handleIncomingMessage(account, senderId, senderName, message);
    }
};

/**
 * Handle incoming message
 */
const handleIncomingMessage = async (account, senderId, senderName, message) => {
    console.log(`[WhatsApp] New message from ${senderName} (${senderId}):`, message.text?.body || '[media]');

    // Delegate to message handler (same pattern as Facebook)
    const messageHandler = require('./whatsapp-message-handler');
    await messageHandler.processIncomingMessage(account, senderId, senderName, message);
};

/**
 * Send message to WhatsApp user
 */
const sendMessage = async (phoneNumberId, accessToken, recipientPhone, text) => {
    const url = `${GRAPH_API_BASE}/${phoneNumberId}/messages`;

    const payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: recipientPhone,
        type: 'text',
        text: { body: text }
    };

    try {
        const response = await axios.post(url, payload, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        console.log(`[WhatsApp] Message sent to ${recipientPhone}`);
        return { success: true, messageId: response.data.messages?.[0]?.id };
    } catch (error) {
        console.error('[WhatsApp] Send message error:', error.response?.data || error.message);
        throw error;
    }
};

/**
 * Send template message (for initiating conversations)
 */
const sendTemplateMessage = async (phoneNumberId, accessToken, recipientPhone, templateName, languageCode = 'en') => {
    const url = `${GRAPH_API_BASE}/${phoneNumberId}/messages`;

    const payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: recipientPhone,
        type: 'template',
        template: {
            name: templateName,
            language: { code: languageCode }
        }
    };

    try {
        const response = await axios.post(url, payload, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        console.log(`[WhatsApp] Template message sent to ${recipientPhone}`);
        return { success: true, messageId: response.data.messages?.[0]?.id };
    } catch (error) {
        console.error('[WhatsApp] Send template error:', error.response?.data || error.message);
        throw error;
    }
};

/**
 * Get WhatsApp Business Account info
 */
const getBusinessAccountInfo = async (accessToken, wabaId) => {
    const url = `${GRAPH_API_BASE}/${wabaId}`;

    try {
        const response = await axios.get(url, {
            headers: { 'Authorization': `Bearer ${accessToken}` },
            params: { fields: 'id,name,currency,timezone_id' }
        });
        return response.data;
    } catch (error) {
        console.error('[WhatsApp] Get WABA info error:', error.response?.data || error.message);
        throw error;
    }
};

/**
 * Get phone numbers for a WABA
 */
const getPhoneNumbers = async (accessToken, wabaId) => {
    const url = `${GRAPH_API_BASE}/${wabaId}/phone_numbers`;

    try {
        const response = await axios.get(url, {
            headers: { 'Authorization': `Bearer ${accessToken}` },
            params: { fields: 'id,display_phone_number,verified_name,quality_rating,status' }
        });
        return response.data.data || [];
    } catch (error) {
        console.error('[WhatsApp] Get phone numbers error:', error.response?.data || error.message);
        throw error;
    }
};

/**
 * Connect a WhatsApp account to workspace
 */
const connectAccount = async (workspaceKey, phoneNumberId, displayNumber, wabaId, accessToken) => {
    // Check if already connected
    const existing = await whatsappRepo.findByPhoneNumberId(phoneNumberId);
    if (existing) {
        throw new Error('This WhatsApp number is already connected');
    }

    // Create account record
    const account = await whatsappRepo.create({
        workspaceKey,
        phoneNumberId,
        displayNumber,
        businessAccountId: wabaId,
        accessToken
    });

    console.log(`[WhatsApp] Account connected: ${displayNumber} for workspace ${workspaceKey}`);
    return account;
};

/**
 * Disconnect WhatsApp account
 */
const disconnectAccount = async (accountId, workspaceKey) => {
    const account = await whatsappRepo.findById(accountId);
    if (!account || account.WorkspaceKey !== workspaceKey) {
        throw new Error('Account not found');
    }

    await whatsappRepo.delete(account.AccountKey);
    console.log(`[WhatsApp] Account disconnected: ${account.DisplayNumber}`);
};

/**
 * Get accounts for workspace
 */
const getAccountsByWorkspace = async (workspaceKey) => {
    return whatsappRepo.findByWorkspace(workspaceKey);
};

/**
 * Get account by phone number ID
 */
const getAccountByPhoneNumberId = async (phoneNumberId) => {
    return whatsappRepo.findByPhoneNumberId(phoneNumberId);
};

module.exports = {
    verifyWebhook,
    processWebhookEvent,
    handleIncomingMessage,
    sendMessage,
    sendTemplateMessage,
    getBusinessAccountInfo,
    getPhoneNumbers,
    connectAccount,
    disconnectAccount,
    getAccountsByWorkspace,
    getAccountByPhoneNumberId,
    WHATSAPP_WEBHOOK_VERIFY_TOKEN
};
