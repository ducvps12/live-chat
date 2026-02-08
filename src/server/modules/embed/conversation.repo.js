const { getPool } = require('../../infra/mysql/mysql');

const listConversationsForUser = async (userKey, limit = 50, offset = 0) => {
  const [rows] = await getPool().execute(
    `SELECT
       c.ConversationId as id,
       c.VisitorId as visitorId,
       c.VisitorName as visitorName,
       c.Status as status,
       c.CreatedAt as createdAt,
       c.LastMessageAt as lastMessageAt,
       c.SourceUrl as domain,
       c.LastMessagePreview as lastMessagePreview,
       c.MessageCount as messageCount,
       GREATEST(0, c.VisitorMessageCount - IFNULL(r.LastReadVisitorCount, 0)) as unreadCount,
       w.SiteKey as siteKey,
       w.Name as widgetName,
       ws.Name as workspaceName,
       ws.WorkspaceId as workspaceId
     FROM iam_WidgetConversations c
     JOIN iam_Widgets w ON c.WidgetKey = w.WidgetKey
     JOIN iam_Workspaces ws ON w.WorkspaceKey = ws.WorkspaceKey
     JOIN iam_Memberships m ON m.WorkspaceKey = ws.WorkspaceKey
     LEFT JOIN iam_WidgetConversationReads r ON c.ConversationKey = r.ConversationKey AND r.UserKey = ?
     WHERE m.UserKey = ? AND m.Status = 1
     ORDER BY c.LastMessageAt DESC
     LIMIT ? OFFSET ?`,
    [userKey, userKey, limit, offset]
  );
  return rows;
};

const listConversationsForWorkspace = async (workspaceId, userKey, limit = 50, offset = 0) => {
  const [rows] = await getPool().execute(
    `SELECT
       c.ConversationId as id,
       c.ConversationKey as conversationKey,
       c.VisitorId as visitorId,
       c.VisitorName as visitorName,
       c.Status as status,
       c.CreatedAt as createdAt,
       c.LastMessageAt as lastMessageAt,
       c.SourceUrl as domain,
       c.LastMessagePreview as lastMessagePreview,
       c.MessageCount as messageCount,
       c.AssignedUserKey as assignedUserKey,
       u.DisplayName as assignedAgentName,
       GREATEST(0, c.VisitorMessageCount - IFNULL(r.LastReadVisitorCount, 0)) as unreadCount,
       w.SiteKey as siteKey,
       w.Name as widgetName
     FROM iam_WidgetConversations c
     JOIN iam_Widgets w ON c.WidgetKey = w.WidgetKey
     JOIN iam_Workspaces ws ON w.WorkspaceKey = ws.WorkspaceKey
     LEFT JOIN iam_Users u ON c.AssignedUserKey = u.UserKey
     LEFT JOIN iam_WidgetConversationReads r ON c.ConversationKey = r.ConversationKey AND r.UserKey = ?
     WHERE ws.WorkspaceId = ?
     ORDER BY c.LastMessageAt DESC
     LIMIT ? OFFSET ?`,
    [userKey, workspaceId, limit, offset]
  );
  return rows;
};

const getWorkspaceStats = async (workspaceId, userKey) => {
  const [rows] = await getPool().execute(
    `SELECT
       COUNT(*) as totalConversations,
       SUM(CASE WHEN c.Status = 1 THEN 1 ELSE 0 END) as activeConversations,
       SUM(CASE WHEN GREATEST(0, c.VisitorMessageCount - IFNULL(r.LastReadVisitorCount, 0)) > 0 THEN 1 ELSE 0 END) as conversationsWithUnread,
       SUM(GREATEST(0, c.VisitorMessageCount - IFNULL(r.LastReadVisitorCount, 0))) as totalUnreadMessages
     FROM iam_WidgetConversations c
     JOIN iam_Widgets w ON c.WidgetKey = w.WidgetKey
     JOIN iam_Workspaces ws ON w.WorkspaceKey = ws.WorkspaceKey
     LEFT JOIN iam_WidgetConversationReads r ON c.ConversationKey = r.ConversationKey AND r.UserKey = ?
     WHERE ws.WorkspaceId = ?`,
    [userKey, workspaceId]
  );
  return rows[0] || { totalConversations: 0, activeConversations: 0, conversationsWithUnread: 0, totalUnreadMessages: 0 };
};

const searchConversations = async (workspaceId, userKey, filters = {}) => {
  const { keyword, status, dateFrom, dateTo, limit = 50, offset = 0 } = filters;
  const params = [userKey, workspaceId];
  let whereClauses = ['ws.WorkspaceId = ?'];

  if (keyword) {
    whereClauses.push(`(c.VisitorName LIKE ? OR c.VisitorId LIKE ? OR c.LastMessagePreview LIKE ? OR c.SourceUrl LIKE ?)`);
    const kw = `%${keyword}%`;
    params.push(kw, kw, kw, kw);
  }
  if (status) { whereClauses.push('c.Status = ?'); params.push(status); }
  if (dateFrom) { whereClauses.push('c.CreatedAt >= ?'); params.push(new Date(dateFrom)); }
  if (dateTo) { whereClauses.push('c.CreatedAt <= ?'); params.push(new Date(dateTo)); }

  params.push(limit, offset);

  const [rows] = await getPool().execute(
    `SELECT
       c.ConversationId as id, c.ConversationKey as conversationKey,
       c.VisitorId as visitorId, c.VisitorName as visitorName,
       c.Status as status, c.CreatedAt as createdAt,
       c.LastMessageAt as lastMessageAt, c.SourceUrl as domain,
       c.LastMessagePreview as lastMessagePreview, c.MessageCount as messageCount,
       GREATEST(0, c.VisitorMessageCount - IFNULL(r.LastReadVisitorCount, 0)) as unreadCount,
       w.SiteKey as siteKey, w.Name as widgetName
     FROM iam_WidgetConversations c
     JOIN iam_Widgets w ON c.WidgetKey = w.WidgetKey
     JOIN iam_Workspaces ws ON w.WorkspaceKey = ws.WorkspaceKey
     LEFT JOIN iam_WidgetConversationReads r ON c.ConversationKey = r.ConversationKey AND r.UserKey = ?
     WHERE ${whereClauses.join(' AND ')}
     ORDER BY c.LastMessageAt DESC
     LIMIT ? OFFSET ?`,
    params
  );
  return rows;
};

const assignConversation = async (conversationId, userKey) => {
  await getPool().execute(
    'UPDATE iam_WidgetConversations SET AssignedUserKey = ?, UpdatedAt = UTC_TIMESTAMP(3) WHERE ConversationId = ?',
    [userKey, conversationId]
  );
};

const updateConversationStatus = async (conversationId, status) => {
  await getPool().execute(
    'UPDATE iam_WidgetConversations SET Status = ?, UpdatedAt = UTC_TIMESTAMP(3) WHERE ConversationId = ?',
    [status, conversationId]
  );
};

const getConversationById = async (conversationId) => {
  const [rows] = await getPool().execute(
    `SELECT ConversationKey, ConversationId, VisitorId, VisitorMessageCount, WidgetKey, AssignedUserKey, SourceUrl
     FROM iam_WidgetConversations WHERE ConversationId = ?`,
    [conversationId]
  );
  return rows[0];
};

const getConversationByKey = async (conversationKey) => {
  const [rows] = await getPool().execute(
    `SELECT ConversationKey, ConversationId, VisitorId, VisitorMessageCount, WidgetKey, AssignedUserKey, SourceUrl
     FROM iam_WidgetConversations WHERE ConversationKey = ?`,
    [conversationKey]
  );
  return rows[0];
};

const updateConversationSummary = async (conversationKey, updates) => {
  const { seq, preview, mongoId, isVisitor } = updates;
  const visitorCountSql = isVisitor ? 'VisitorMessageCount = VisitorMessageCount + 1,' : '';

  await getPool().execute(
    `UPDATE iam_WidgetConversations SET
       LastMessageAt = UTC_TIMESTAMP(3), UpdatedAt = UTC_TIMESTAMP(3),
       MessageCount = MessageCount + 1,
       ${visitorCountSql}
       LastMessageSeq = ?, LastMessagePreview = ?, LastMessageMongoId = ?
     WHERE ConversationKey = ?`,
    [seq, preview, mongoId, conversationKey]
  );
};

const findActiveByVisitor = async (widgetKey, visitorId) => {
  const [rows] = await getPool().execute(
    `SELECT ConversationKey, ConversationId, VisitorName, Status, SourceUrl
     FROM iam_WidgetConversations WHERE WidgetKey = ? AND VisitorId = ? AND Status = 1`,
    [widgetKey, visitorId]
  );
  return rows[0];
};

const findActiveByVisitorAndSiteKey = async (siteKey, visitorId) => {
  const [rows] = await getPool().execute(
    `SELECT c.ConversationKey, c.ConversationId, c.VisitorName, c.Status, w.WidgetKey, w.SiteKey
     FROM iam_WidgetConversations c
     JOIN iam_Widgets w ON c.WidgetKey = w.WidgetKey
     WHERE w.SiteKey = ? AND c.VisitorId = ? AND c.Status = 1`,
    [siteKey, visitorId]
  );
  return rows[0];
};

const createConversation = async ({ widgetKey, visitorId, visitorName, sourceUrl }) => {
  const [result] = await getPool().execute(
    `INSERT INTO iam_WidgetConversations (WidgetKey, VisitorId, VisitorName, Status, LastMessageAt, SourceUrl, MessageCount, VisitorMessageCount)
     VALUES (?, ?, ?, 1, UTC_TIMESTAMP(3), ?, 0, 0)`,
    [widgetKey, visitorId, visitorName, sourceUrl]
  );
  const [rows] = await getPool().execute(
    'SELECT ConversationKey, ConversationId FROM iam_WidgetConversations WHERE ConversationKey = ?',
    [result.insertId]
  );
  return rows[0];
};

const updateConversationMetadata = async (conversationKey, { visitorName, sourceUrl }) => {
  const updates = ['UpdatedAt = UTC_TIMESTAMP(3)'];
  const params = [];
  if (visitorName) { updates.push('VisitorName = ?'); params.push(visitorName); }
  if (sourceUrl) { updates.push('SourceUrl = ?'); params.push(sourceUrl); }
  params.push(conversationKey);
  await getPool().execute(
    `UPDATE iam_WidgetConversations SET ${updates.join(', ')} WHERE ConversationKey = ?`,
    params
  );
};

const updateVisitorContact = async (conversationId, { name, email, phone }) => {
  const updates = ['UpdatedAt = UTC_TIMESTAMP(3)'];
  const params = [];
  if (name !== undefined) { updates.push('VisitorName = ?'); params.push(name); }
  // Note: VisitorEmail/Phone columns may need to be added if used
  if (updates.length === 1) return { updated: false };
  params.push(conversationId);
  await getPool().execute(
    `UPDATE iam_WidgetConversations SET ${updates.join(', ')} WHERE ConversationId = ?`,
    params
  );
  return { updated: true };
};

module.exports = {
  listConversationsForUser, listConversationsForWorkspace, getWorkspaceStats,
  searchConversations, updateConversationStatus, getConversationById,
  updateConversationSummary, findActiveByVisitor, createConversation,
  updateConversationMetadata, findActiveByVisitorAndSiteKey, assignConversation,
  getConversationByKey, updateVisitorContact
};
