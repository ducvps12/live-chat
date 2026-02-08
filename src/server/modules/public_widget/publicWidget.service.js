const { getPool } = require('../../infra/mysql/mysql');

const getWidgetConfig = async (widgetId) => {
  const pool = getPool();
  const [rows] = await pool.execute(
    'SELECT WidgetKey, Name, Status, AllowedDomains, Theme FROM iam_Widgets WHERE WidgetId = ?',
    [widgetId]
  );
  return rows[0];
};

const getWidgetBySiteKey = async (siteKey) => {
  const pool = getPool();
  const [rows] = await pool.execute(
    'SELECT WidgetKey, WidgetId, Name, Status, AllowedDomains, Theme, SiteKey FROM iam_Widgets WHERE SiteKey = ?',
    [siteKey]
  );
  return rows[0];
};

const getOrCreateConversation = async (widgetKey, visitorId) => {
  const pool = getPool();

  const [existing] = await pool.execute(
    'SELECT ConversationKey, ConversationId FROM iam_WidgetConversations WHERE WidgetKey = ? AND VisitorId = ? AND Status = 1',
    [widgetKey, visitorId]
  );

  if (existing.length > 0) {
    return { conversationId: existing[0].ConversationId, created: false };
  }

  const [result] = await pool.execute(
    'INSERT INTO iam_WidgetConversations (WidgetKey, VisitorId, Status) VALUES (?, ?, 1)',
    [widgetKey, visitorId]
  );

  const [rows] = await pool.execute(
    'SELECT ConversationId FROM iam_WidgetConversations WHERE ConversationKey = ?',
    [result.insertId]
  );

  return { conversationId: rows[0].ConversationId, created: true };
};

const getMessages = async (conversationId, afterTimestamp = null) => {
  const pool = getPool();

  let query = `
    SELECT 
      m.MessageId as id,
      CASE m.SenderType WHEN 1 THEN 'visitor' ELSE 'agent' END as sender,
      m.Content as text,
      m.CreatedAt as createdAt
    FROM iam_WidgetMessages m
    INNER JOIN iam_WidgetConversations c ON m.ConversationKey = c.ConversationKey
    WHERE c.ConversationId = ?
  `;

  const params = [conversationId];

  if (afterTimestamp) {
    query += ' AND m.CreatedAt > ?';
    params.push(new Date(afterTimestamp));
  }

  query += ' ORDER BY m.CreatedAt ASC';

  const [rows] = await pool.execute(query, params);
  return rows;
};

const createMessage = async (widgetKey, data) => {
  const pool = getPool();
  const { visitorId, content, conversationId, senderType = 1 } = data;

  let convKey;
  let convId;

  if (conversationId) {
    const [convRows] = await pool.execute(
      'SELECT ConversationKey, ConversationId FROM iam_WidgetConversations WHERE ConversationId = ?',
      [conversationId]
    );

    if (convRows.length === 0) {
      throw new Error('Conversation not found');
    }
    convKey = convRows[0].ConversationKey;
    convId = convRows[0].ConversationId;
  } else {
    // Find or create conversation (replaces MERGE)
    const [existing] = await pool.execute(
      'SELECT ConversationKey, ConversationId FROM iam_WidgetConversations WHERE WidgetKey = ? AND VisitorId = ? AND Status = 1',
      [widgetKey, visitorId]
    );

    if (existing.length > 0) {
      convKey = existing[0].ConversationKey;
      convId = existing[0].ConversationId;
      await pool.execute(
        'UPDATE iam_WidgetConversations SET UpdatedAt = UTC_TIMESTAMP(3) WHERE ConversationKey = ?',
        [convKey]
      );
    } else {
      const [insertResult] = await pool.execute(
        'INSERT INTO iam_WidgetConversations (WidgetKey, VisitorId, Status) VALUES (?, ?, 1)',
        [widgetKey, visitorId]
      );
      const [rows] = await pool.execute(
        'SELECT ConversationKey, ConversationId FROM iam_WidgetConversations WHERE ConversationKey = ?',
        [insertResult.insertId]
      );
      convKey = rows[0].ConversationKey;
      convId = rows[0].ConversationId;
    }
  }

  // Insert Message
  const [msgResult] = await pool.execute(
    'INSERT INTO iam_WidgetMessages (ConversationKey, SenderType, Content) VALUES (?, ?, ?)',
    [convKey, senderType, content]
  );

  const [msgRows] = await pool.execute(
    'SELECT MessageId, CreatedAt FROM iam_WidgetMessages WHERE MessageKey = ?',
    [msgResult.insertId]
  );

  return {
    conversationId: convId,
    messageId: msgRows[0].MessageId,
    createdAt: msgRows[0].CreatedAt
  };
};

const sendMessage = async (conversationId, content, senderType = 1) => {
  const pool = getPool();

  const [convRows] = await pool.execute(
    'SELECT ConversationKey FROM iam_WidgetConversations WHERE ConversationId = ?',
    [conversationId]
  );

  if (convRows.length === 0) {
    throw new Error('Conversation not found');
  }

  const conversationKey = convRows[0].ConversationKey;

  const [msgResult] = await pool.execute(
    'INSERT INTO iam_WidgetMessages (ConversationKey, SenderType, Content) VALUES (?, ?, ?)',
    [conversationKey, senderType, content]
  );

  const [msgRows] = await pool.execute(
    'SELECT MessageId, CreatedAt FROM iam_WidgetMessages WHERE MessageKey = ?',
    [msgResult.insertId]
  );

  return {
    id: msgRows[0].MessageId,
    sender: senderType === 1 ? 'visitor' : 'agent',
    text: content,
    createdAt: msgRows[0].CreatedAt
  };
};

module.exports = {
  getWidgetConfig,
  getWidgetBySiteKey,
  getOrCreateConversation,
  getMessages,
  createMessage,
  sendMessage
};
