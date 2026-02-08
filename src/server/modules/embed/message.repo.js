const { getPool } = require('../../infra/mysql/mysql');

const createMessage = async ({ conversationKey, senderType, content }) => {
  const [result] = await getPool().execute(
    `INSERT INTO iam_WidgetMessages (ConversationKey, SenderType, Content) VALUES (?, ?, ?)`,
    [conversationKey, senderType, content]
  );
  const [rows] = await getPool().execute(
    'SELECT MessageKey, MessageId, CreatedAt FROM iam_WidgetMessages WHERE MessageKey = ?',
    [result.insertId]
  );
  return rows[0];
};

const listMessagesBySeq = async (conversationKey, limit = 50, beforeSeq = null) => {
  let query = `
    SELECT
      MessageId as id, MessageKey as seq,
      CASE SenderType WHEN 1 THEN 'visitor' ELSE 'agent' END as sender,
      SenderType as senderType, Content as text, CreatedAt as createdAt
    FROM iam_WidgetMessages
    WHERE ConversationKey = ?`;
  const params = [conversationKey];

  if (beforeSeq) {
    query += ' AND MessageKey < ?';
    params.push(beforeSeq);
  }

  query += ' ORDER BY MessageKey DESC LIMIT ?';
  params.push(limit);

  const [rows] = await getPool().execute(query, params);
  return rows.reverse();
};

module.exports = { createMessage, listMessagesBySeq };
