const { getPool } = require('../../infra/mysql/mysql');

const createTag = async ({ workspaceKey, name, color = '#3B82F6' }) => {
  const [result] = await getPool().execute(
    'INSERT INTO iam_Tags (WorkspaceKey, Name, Color) VALUES (?, ?, ?)',
    [workspaceKey, name, color]
  );
  const [rows] = await getPool().execute(
    'SELECT TagKey, TagId, WorkspaceKey, Name, Color, CreatedAt FROM iam_Tags WHERE TagKey = ?',
    [result.insertId]
  );
  return rows[0];
};

const getTagsByWorkspace = async (workspaceId) => {
  const [rows] = await getPool().execute(
    `SELECT t.TagKey as tagKey, t.TagId as tagId, t.Name as name, t.Color as color, t.CreatedAt as createdAt
     FROM iam_Tags t
     JOIN iam_Workspaces w ON t.WorkspaceKey = w.WorkspaceKey
     WHERE w.WorkspaceId = ?
     ORDER BY t.Name`,
    [workspaceId]
  );
  return rows;
};

const deleteTag = async (tagKey) => {
  await getPool().execute('DELETE FROM iam_ConversationTags WHERE TagKey = ?', [tagKey]);
  await getPool().execute('DELETE FROM iam_Tags WHERE TagKey = ?', [tagKey]);
};

const assignTag = async (conversationKey, tagKey) => {
  await getPool().execute(
    'INSERT IGNORE INTO iam_ConversationTags (ConversationKey, TagKey) VALUES (?, ?)',
    [conversationKey, tagKey]
  );
};

const removeTag = async (conversationKey, tagKey) => {
  await getPool().execute(
    'DELETE FROM iam_ConversationTags WHERE ConversationKey = ? AND TagKey = ?',
    [conversationKey, tagKey]
  );
};

const getTagsByConversation = async (conversationKey) => {
  const [rows] = await getPool().execute(
    `SELECT t.TagKey as tagKey, t.TagId as tagId, t.Name as name, t.Color as color
     FROM iam_Tags t
     JOIN iam_ConversationTags ct ON t.TagKey = ct.TagKey
     WHERE ct.ConversationKey = ?
     ORDER BY t.Name`,
    [conversationKey]
  );
  return rows;
};

module.exports = { createTag, getTagsByWorkspace, deleteTag, assignTag, removeTag, getTagsByConversation };
