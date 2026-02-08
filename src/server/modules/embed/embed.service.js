/**
 * Embed Service Layer
 * REFACTORED: Uses Repository Pattern (SQL) + MongoDB for Content
 */
const jwt = require('jsonwebtoken');
const env = require('../../config/env');
const AppError = require('../../utils/AppError');

// Repositories
const conversationRepo = require('./conversation.repo');
const messageRepo = require('./message.repo');
const readRepo = require('./read.repo');
const widgetRepo = require('./widget.repo');

// Services (MongoDB service removed — using MySQL only)

/**
 * Get widget by SiteKey with validation
 */
const getWidgetBySiteKey = async (siteKey) => {
  return widgetRepo.getWidgetBySiteKey(siteKey);
};

/**
 * Get widget by WidgetKey (for bot integration)
 */
const getWidgetByKey = async (widgetKey) => {
  const { getPool } = require('../../infra/mysql/mysql');
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT w.WidgetKey, w.WidgetId, w.WorkspaceKey, ws.WorkspaceId, w.Name, w.SiteKey, w.Status, w.AllowedDomains, w.Theme
     FROM iam_Widgets w
     LEFT JOIN iam_Workspaces ws ON w.WorkspaceKey = ws.WorkspaceKey
     WHERE w.WidgetKey = ?`,
    [widgetKey]
  );
  return rows[0] || null;
};

/**
 * Validate origin against widget's allowed domains
 */
const validateOrigin = (widget, origin) => {
  if (!origin) return false;
  if (env.embed.devAllowAll && env.app.env === 'development') return true;

  try {
    const allowedDomains = JSON.parse(widget.AllowedDomains || '[]');
    const normalizedOrigin = origin.replace(/\/$/, '').toLowerCase();

    return allowedDomains.some(domain => {
      const normalizedDomain = domain.replace(/\/$/, '').toLowerCase();
      if (normalizedDomain === normalizedOrigin) return true;
      const originNoProtocol = normalizedOrigin.replace(/^https?:\/\//, '');
      if (normalizedDomain === originNoProtocol) return true;

      if (normalizedDomain.startsWith('*')) {
        const pattern = normalizedDomain.replace('*', '.*');
        return new RegExp(`^${pattern}$`).test(normalizedOrigin) ||
          new RegExp(`^${pattern}$`).test(originNoProtocol);
      }
      return false;
    });
  } catch (err) {
    console.error('Error parsing AllowedDomains:', err);
    return false;
  }
};

/**
 * Generate embed session token (JWT)
 */
const generateSessionToken = (widget, visitorId) => {
  const payload = {
    typ: 'embed',
    siteKey: widget.SiteKey,
    widgetKey: widget.WidgetKey,
    visitorId,
    iat: Math.floor(Date.now() / 1000)
  };

  const token = jwt.sign(payload, env.embed.jwtSecret, {
    expiresIn: env.embed.tokenTTL
  });

  const decoded = jwt.decode(token);
  return {
    token,
    expiresAt: new Date(decoded.exp * 1000).toISOString(),
    expiresIn: env.embed.tokenTTL
  };
};

/**
 * Verify embed session token
 */
const verifySessionToken = (token) => {
  return jwt.verify(token, env.embed.jwtSecret);
};

/**
 * Get or create conversation for widget + visitor
 */
const getOrCreateConversation = async (widgetKey, visitorId, visitorName = null, sourceUrl = null) => {
  // Check existing active conversation
  const existing = await conversationRepo.findActiveByVisitor(widgetKey, visitorId);

  if (existing) {
    // Update metadata if needed
    if ((visitorName && visitorName !== existing.VisitorName) || (sourceUrl && sourceUrl !== existing.SourceUrl)) {
      await conversationRepo.updateConversationMetadata(existing.ConversationKey, { visitorName, sourceUrl });
    }
    return {
      conversationId: existing.ConversationId,
      conversationKey: existing.ConversationKey,
      created: false
    };
  }

  // Create new
  const newConv = await conversationRepo.createConversation({
    widgetKey, visitorId, visitorName, sourceUrl
  });

  return {
    conversationId: newConv.ConversationId,
    conversationKey: newConv.ConversationKey,
    created: true
  };
};

/**
 * Create message (Syncs to MongoDB and SQL)
 */
const createMessage = async (conversationKey, text, senderType, senderId = null, conversationId = null, clientMsgId = null) => {
  // 1. Resolve conversationId if missing (or use Key)
  // If Agent (senderType=2), validation required.
  if (senderType === 2 && senderId) {
    const conv = await conversationRepo.getConversationByKey(conversationKey);
    if (conv) {
      if (!conv.AssignedUserKey) {
        // Auto-assign to this agent
        await conversationRepo.assignConversation(conv.ConversationId, senderId);
        console.log(`[EmbedService] Auto-assigned conversation ${conv.ConversationId} to user ${senderId}`);
      } else if (conv.AssignedUserKey !== senderId) {
        // Conversation assigned to someone else
        // TODO: Bypass if User is Manager/Owner (need Role context here, but service doesn't have it yet)
        // For now, Strict Lock.
        throw new AppError('This conversation is assigned to another agent.', 403);
      }
    }
  }

  // 2. Save to MongoDB (Content Source)
  const mongoMsg = await messageService.createMessage(
    conversationKey, conversationId, text, senderType, senderId, clientMsgId
  );

  // 3. Save to SQL (Metadata/Summary Source)
  const sqlMsg = await messageRepo.createMessage({
    conversationKey,
    senderType,
    content: text
  });

  console.log('[EmbedService] SQL Message Created:', sqlMsg);

  if (!sqlMsg || !sqlMsg.MessageKey) {
    console.error('[EmbedService] Failed to get MessageKey from SQL insert. Using fallback 0.');
    // This avoids crashing but indicates DB issue.
  }

  // Use MessageKey (BIGINT IDENTITY) as seq, not MessageId (GUID)
  const seqId = parseInt(sqlMsg?.MessageKey, 10) || 0;

  // 4. Update Conversation Summary
  await conversationRepo.updateConversationSummary(conversationKey, {
    seq: seqId,
    preview: text,
    mongoId: mongoMsg.id,
    isVisitor: senderType === 1
  });

  // 5. Invalidate Cache (Legacy: Not needed as Redis removed)

  return {
    ...mongoMsg,
    seq: seqId,
    messageId: sqlMsg?.MessageId
  };
};

/**
 * Get messages by sequence (Infinite Scroll support)
 * Uses SQL Repository
 */
const getMessagesBySeq = async (conversationId, limit = 30, cursorSeq = null) => {
  // Need Conversation Key first
  const conv = await conversationRepo.getConversationById(conversationId);
  if (!conv) throw new AppError('Conversation not found', 404);

  const messages = await messageRepo.listMessagesBySeq(conv.ConversationKey, limit, cursorSeq);

  // Return structure expected by Controller
  const items = messages;
  const nextCursor = items.length > 0 ? items[0].seq : null;

  return {
    items,
    nextCursor
  };
};

/**
 * List conversations for User (Unified Inbox)
 * Uses SQL Repo with Unread Counts
 */
const listConversationsForUser = async (userKey, limit = 50) => {
  return conversationRepo.listConversationsForUser(userKey, limit);
};

/**
 * List conversations for a specific workspace
 * @param {string} workspaceId - Workspace UUID
 * @param {number} userKey - User key for read state
 * @param {number} limit - Pagination limit
 * @param {number} offset - Pagination offset
 */
const listConversationsForWorkspace = async (workspaceId, userKey, limit = 50, offset = 0) => {
  return conversationRepo.listConversationsForWorkspace(workspaceId, userKey, limit, offset);
};

/**
 * Get workspace statistics
 * @param {string} workspaceId - Workspace UUID
 * @param {number} userKey - User key for unread calculation
 */
const getWorkspaceStats = async (workspaceId, userKey) => {
  return conversationRepo.getWorkspaceStats(workspaceId, userKey);
};

/**
 * Get messages (Legacy Support)
 */
const getMessages = async (conversationId, limit = 50, before = null) => {
  const conv = await conversationRepo.getConversationById(conversationId);
  if (!conv) throw new AppError('Conversation not found', 404);

  // Use new Repo but return flat array
  return messageRepo.listMessagesBySeq(conv.ConversationKey, limit, before);
};

/**
 * Mark conversation as read
 */
const markConversationRead = async (conversationId, userKey) => {
  const conv = await conversationRepo.getConversationById(conversationId);
  if (!conv) throw new AppError('Conversation not found', 404);

  // Set LastReadVisitorCount to current VisitorMessageCount
  await readRepo.upsertReadState(conv.ConversationKey, userKey, conv.VisitorMessageCount);

  return {
    success: true
  };
};

/**
 * Get Conversation by ID (Direct Repo Call)
 */
const getConversationById = async (conversationId) => conversationRepo.getConversationById(conversationId);

// Legacy Helpers (Proxy to Repo)
const getConversationByVisitor = async (widgetKey, visitorId) => conversationRepo.findActiveByVisitor(widgetKey, visitorId);

const getConversationByVisitorAndSiteKey = async (siteKey, visitorId) => conversationRepo.findActiveByVisitorAndSiteKey(siteKey, visitorId);

/**
 * Update conversation activity with seq safety (async, for socket handlers)
 * Wrapper for updateConversationSummary that handles errors gracefully
 */
const updateConversationActivityWithSeq = async (conversationKey, seq, preview, messageId) => {
  try {
    await conversationRepo.updateConversationSummary(conversationKey, {
      seq: parseInt(seq, 10) || 0,
      preview: preview,
      mongoId: messageId,
      isVisitor: false // Called after message already created, don't increment again
    });
  } catch (err) {
    console.error('[EmbedService] Failed to update conversation activity:', err);
  }
};

/**
 * Update visitor contact info from extracted data
 * @param {string} visitorId - Visitor ID
 * @param {number} widgetKey - Widget key
 * @param {Object} contactData - { phone, email, name }
 */
const updateVisitorContactInfo = async (visitorId, widgetKey, contactData) => {
  const { phone, email, name } = contactData;

  // Only update if we have data to save
  if (!phone && !email && !name) return;

  try {
    const { getPool } = require('../../infra/mysql/mysql');
    const pool = getPool();

    const [convRows] = await pool.execute(
      `SELECT ConversationKey, VisitorPhone, VisitorEmail, VisitorName
       FROM iam_Conversations
       WHERE WidgetKey = ? AND VisitorId = ? AND Status = 1
       ORDER BY UpdatedAt DESC`,
      [widgetKey, visitorId]
    );

    if (convRows.length === 0) return;

    const conv = convRows[0];

    const updates = [];
    const params = [];

    if (phone && !conv.VisitorPhone) {
      updates.push('VisitorPhone = ?');
      params.push(phone);
    }
    if (email && !conv.VisitorEmail) {
      updates.push('VisitorEmail = ?');
      params.push(email);
    }
    if (name && !conv.VisitorName) {
      updates.push('VisitorName = ?');
      params.push(name);
    }

    if (updates.length > 0) {
      params.push(conv.ConversationKey);
      await pool.execute(
        `UPDATE iam_Conversations SET ${updates.join(', ')}, UpdatedAt = UTC_TIMESTAMP(3) WHERE ConversationKey = ?`,
        params
      );
      console.log(`[EmbedService] Updated visitor ${visitorId} contact info:`, { phone, email, name });
    }
  } catch (err) {
    console.error('[EmbedService] Failed to update visitor contact info:', err);
    // Don't throw - this is a non-critical operation
  }
};

// Export
module.exports = {
  getWidgetBySiteKey,
  getWidgetByKey,
  validateOrigin,
  generateSessionToken,
  verifySessionToken,
  getOrCreateConversation,
  getConversationByVisitor,
  getConversationByVisitorAndSiteKey,
  createMessage,
  getMessages,
  getMessagesBySeq,
  getConversationById,
  listConversationsForUser,
  listConversationsForWorkspace,
  getWorkspaceStats,
  searchConversations: (workspaceId, userKey, filters) =>
    conversationRepo.searchConversations(workspaceId, userKey, filters),
  updateConversationStatus: (conversationId, status) =>
    conversationRepo.updateConversationStatus(conversationId, status),
  markConversationRead,
  updateConversationActivityWithSeq,
  updateVisitorContactInfo,
  assignConversation: async (conversationId, userKey) => {
    const conv = await conversationRepo.getConversationById(conversationId);
    if (!conv) throw new AppError('Conversation not found', 404);
    await conversationRepo.assignConversation(conversationId, userKey);
    return { success: true };
  }
};

