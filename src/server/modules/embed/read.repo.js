const { getPool } = require('../../infra/mysql/mysql');

const upsertReadState = async (conversationKey, userKey, visitorMessageCount) => {
  await getPool().execute(
    `INSERT INTO iam_WidgetConversationReads (ConversationKey, UserKey, LastReadVisitorCount, LastReadAt)
     VALUES (?, ?, ?, UTC_TIMESTAMP(3))
     ON DUPLICATE KEY UPDATE LastReadVisitorCount = VALUES(LastReadVisitorCount), LastReadAt = UTC_TIMESTAMP(3)`,
    [conversationKey, userKey, visitorMessageCount]
  );
};

module.exports = { upsertReadState };
