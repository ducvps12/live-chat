/**
 * Zalo Image/Attachment API Controller
 * Handles image upload and sending via zca-js
 */

const { getClient } = require('../../services/ZaloBrowser');
const asyncHandler = require('../../utils/asyncHandler');
const { getPool } = require('../../infra/mysql/mysql');
const messageRepo = require('../embed/message.repo');
const conversationRepo = require('../embed/conversation.repo');
const { getIO } = require('../../bootstrap/socket');
const sharp = require('sharp');

/**
 * Send image to Zalo conversation
 * POST /zalo-personal/send-image
 * Body: FormData with image file, threadId, workspaceId
 */
const sendImage = asyncHandler(async (req, res) => {
    const { threadId, workspaceId, conversationId } = req.body;
    const file = req.file;

    if (!file) {
        return res.status(400).json({ success: false, error: 'No image file provided' });
    }

    if (!threadId || !workspaceId) {
        return res.status(400).json({ success: false, error: 'Missing threadId or workspaceId' });
    }

    console.log(`[Zalo Image] Sending image to thread ${threadId} in workspace ${workspaceId}`);
    console.log(`[Zalo Image] File: ${file.originalname}, Size: ${file.size}, Type: ${file.mimetype}`);

    // Get Zalo client for this workspace
    const zaloClient = getClient(workspaceId);
    if (!zaloClient || !zaloClient.api) {
        return res.status(400).json({ success: false, error: 'Zalo not connected for this workspace' });
    }

    try {
        // Get image metadata using sharp
        const metadata = await sharp(file.buffer).metadata();

        // Create attachment source with Buffer
        const attachmentSource = {
            data: file.buffer,
            filename: file.originalname || `image_${Date.now()}.${metadata.format || 'png'}`,
            metadata: {
                totalSize: file.size,
                width: metadata.width || 0,
                height: metadata.height || 0
            }
        };

        console.log(`[Zalo Image] Image metadata: ${metadata.width}x${metadata.height}, format: ${metadata.format}`);

        // Send message with attachment
        const result = await zaloClient.api.sendMessage(
            {
                msg: '',
                attachments: [attachmentSource]
            },
            threadId,
            'User'
        );

        console.log('[Zalo Image] Send result:', JSON.stringify(result));

        // Save message to database if conversationId provided
        if (conversationId) {
            const pool = getPool();

            const [convRows] = await pool.execute(
                'SELECT workspaceKey, visitorId FROM Conversations WHERE conversationId = ?',
                [conversationId]
            );

            if (convRows.length > 0) {
                const { workspaceKey, visitorId } = convRows[0];

                const imageContent = JSON.stringify({
                    type: 'image',
                    url: result.attachment?.[0]?.normalUrl || result.attachment?.[0]?.hdUrl || '',
                    fileName: file.originalname,
                    size: file.size,
                    width: metadata.width,
                    height: metadata.height
                });

                const newMessage = await messageRepo.createMessage({
                    conversationId,
                    text: imageContent,
                    sender: 'agent',
                    senderType: 2,
                    workspaceKey,
                    visitorId
                });

                const io = getIO();
                if (io) {
                    io.to(`conversation:${conversationId}`).emit('newMessage', {
                        ...newMessage,
                        text: imageContent
                    });
                }

                console.log('[Zalo Image] Message saved to DB:', newMessage.messageKey);
            }
        }

        return res.json({
            success: true,
            data: {
                messageId: result.attachment?.[0]?.msgId || result.message?.msgId,
                attachment: result.attachment
            }
        });

    } catch (error) {
        console.error('[Zalo Image] Send error:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Failed to send image'
        });
    }
});

/**
 * Check if workspace has Zalo connected
 * GET /zalo-personal/check-connection/:workspaceId
 */
const checkConnection = asyncHandler(async (req, res) => {
    const { workspaceId } = req.params;

    const zaloClient = getClient(workspaceId);
    const isConnected = !!(zaloClient && zaloClient.api);

    return res.json({
        success: true,
        connected: isConnected
    });
});

module.exports = {
    sendImage,
    checkConnection
};
