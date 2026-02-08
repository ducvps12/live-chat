const { getPool } = require('../../infra/mysql/mysql');

const getDashboardStats = async () => {
    const [rows] = await getPool().execute(`
    SELECT
      (SELECT COUNT(*) FROM iam_Users) AS TotalUsers,
      (SELECT COUNT(*) FROM iam_Workspaces WHERE Status = 1) AS TotalWorkspaces,
      (SELECT COUNT(*) FROM iam_Users WHERE IsSystemAdmin = 1) AS TotalAdmins,
      (SELECT COUNT(*) FROM iam_Users WHERE Status = 1) AS ActiveUsers,
      (SELECT COUNT(*) FROM iam_Widgets WHERE Status = 1) AS TotalWidgets,
      (SELECT COUNT(*) FROM iam_WidgetConversations) AS TotalConversations,
      (SELECT COUNT(*) FROM iam_WidgetMessages) AS TotalMessages
  `);
    return rows[0];
};

const getMessageStats = async (days = 7) => {
    const [rows] = await getPool().execute(
        `SELECT DATE(CreatedAt) AS Date, COUNT(*) AS MessageCount
     FROM iam_WidgetMessages WHERE CreatedAt >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? DAY)
     GROUP BY DATE(CreatedAt) ORDER BY Date ASC`,
        [days]
    );
    return rows;
};

const getConversationStats = async (days = 7) => {
    const [rows] = await getPool().execute(
        `SELECT DATE(CreatedAt) AS Date, COUNT(*) AS ConversationCount
     FROM iam_WidgetConversations WHERE CreatedAt >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? DAY)
     GROUP BY DATE(CreatedAt) ORDER BY Date ASC`,
        [days]
    );
    return rows;
};

const getAllConversations = async ({ page = 1, limit = 20, search = '', status = null, workspaceId = null }) => {
    const offset = (page - 1) * limit;
    const params = [];
    let whereClause = '1=1';

    if (search) {
        whereClause += ' AND (c.VisitorId LIKE ? OR c.VisitorName LIKE ?)';
        params.push(`%${search}%`, `%${search}%`);
    }
    if (status !== null) { whereClause += ' AND c.Status = ?'; params.push(status); }
    if (workspaceId) { whereClause += ' AND ws.WorkspaceId = ?'; params.push(workspaceId); }

    const [countRows] = await getPool().execute(
        `SELECT COUNT(*) AS Total FROM iam_WidgetConversations c
     JOIN iam_Widgets wg ON wg.WidgetKey = c.WidgetKey
     JOIN iam_Workspaces ws ON ws.WorkspaceKey = wg.WorkspaceKey WHERE 1=1`
    );

    const [rows] = await getPool().execute(
        `SELECT c.ConversationKey, c.ConversationId, c.VisitorId, c.VisitorName, c.Status,
            c.CreatedAt, c.UpdatedAt, c.LastMessageAt, c.MessageCount, c.VisitorMessageCount,
            c.LastMessagePreview, wg.Name AS WidgetName, wg.WidgetId, ws.Name AS WorkspaceName, ws.WorkspaceId
     FROM iam_WidgetConversations c
     JOIN iam_Widgets wg ON wg.WidgetKey = c.WidgetKey
     JOIN iam_Workspaces ws ON ws.WorkspaceKey = wg.WorkspaceKey
     WHERE ${whereClause} ORDER BY c.LastMessageAt DESC, c.CreatedAt DESC LIMIT ? OFFSET ?`,
        [...params, limit, offset]
    );

    return { conversations: rows, total: countRows[0].Total, page, limit, totalPages: Math.ceil(countRows[0].Total / limit) };
};

const getConversationById = async (conversationId) => {
    const [convRows] = await getPool().execute(
        `SELECT c.*, wg.Name AS WidgetName, ws.Name AS WorkspaceName
     FROM iam_WidgetConversations c
     JOIN iam_Widgets wg ON wg.WidgetKey = c.WidgetKey
     JOIN iam_Workspaces ws ON ws.WorkspaceKey = wg.WorkspaceKey
     WHERE c.ConversationId = ?`,
        [conversationId]
    );
    if (!convRows[0]) return null;
    const conversation = convRows[0];
    const [msgRows] = await getPool().execute(
        'SELECT * FROM iam_WidgetMessages WHERE ConversationKey = ? ORDER BY CreatedAt ASC',
        [conversation.ConversationKey]
    );
    return { ...conversation, messages: msgRows };
};

const deleteConversation = async (conversationId) => {
    const [conv] = await getPool().execute('SELECT ConversationKey FROM iam_WidgetConversations WHERE ConversationId = ?', [conversationId]);
    if (!conv[0]) throw { status: 404, message: 'Conversation not found' };
    const ck = conv[0].ConversationKey;
    await getPool().execute('DELETE FROM iam_WidgetMessages WHERE ConversationKey = ?', [ck]);
    await getPool().execute('DELETE FROM iam_WidgetConversationReads WHERE ConversationKey = ?', [ck]);
    await getPool().execute('DELETE FROM iam_WidgetConversations WHERE ConversationKey = ?', [ck]);
};

const getAllUsers = async ({ page = 1, limit = 20, search = '', status = null }) => {
    const offset = (page - 1) * limit;
    const params = [];
    let whereClause = '1=1';
    if (search) { whereClause += ' AND (Email LIKE ? OR DisplayName LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
    if (status !== null) { whereClause += ' AND Status = ?'; params.push(status); }

    const countParams = search ? [`%${search}%`, `%${search}%`] : [];
    const [countRows] = await getPool().execute(
        `SELECT COUNT(*) AS Total FROM iam_Users WHERE ${search ? '(Email LIKE ? OR DisplayName LIKE ?)' : '1=1'}`,
        countParams
    );

    const [rows] = await getPool().execute(
        `SELECT UserKey, UserId, Email, DisplayName, Status, IsSystemAdmin, CreatedAt, UpdatedAt
     FROM iam_Users WHERE ${whereClause} ORDER BY CreatedAt DESC LIMIT ? OFFSET ?`,
        [...params, limit, offset]
    );
    return { users: rows, total: countRows[0].Total, page, limit, totalPages: Math.ceil(countRows[0].Total / limit) };
};

const getUserByKey = async (userKey) => {
    const [rows] = await getPool().execute('SELECT * FROM iam_Users WHERE UserKey = ?', [userKey]);
    return rows[0];
};

const updateUser = async (userKey, { status, isSystemAdmin, displayName }) => {
    const updates = ['UpdatedAt = UTC_TIMESTAMP(3)'];
    const params = [];
    if (status !== undefined) { updates.push('Status = ?'); params.push(status); }
    if (isSystemAdmin !== undefined) { updates.push('IsSystemAdmin = ?'); params.push(isSystemAdmin ? 1 : 0); }
    if (displayName !== undefined) { updates.push('DisplayName = ?'); params.push(displayName); }
    params.push(userKey);
    await getPool().execute(`UPDATE iam_Users SET ${updates.join(', ')} WHERE UserKey = ?`, params);
};

const deleteUser = async (userKey) => {
    await getPool().execute('UPDATE iam_Users SET Status = 3, UpdatedAt = UTC_TIMESTAMP(3) WHERE UserKey = ?', [userKey]);
};

const getAllWorkspaces = async ({ page = 1, limit = 20, search = '' }) => {
    const offset = (page - 1) * limit;
    const params = [];
    let whereClause = '1=1';
    if (search) { whereClause = 'w.Name LIKE ?'; params.push(`%${search}%`); }

    const countParams = search ? [`%${search}%`] : [];
    const [countRows] = await getPool().execute(
        `SELECT COUNT(*) AS Total FROM iam_Workspaces w WHERE ${search ? 'w.Name LIKE ?' : '1=1'}`,
        countParams
    );

    const [rows] = await getPool().execute(
        `SELECT w.WorkspaceKey, w.WorkspaceId, w.Name, w.Status, w.CreatedAt, w.UpdatedAt,
            (SELECT COUNT(*) FROM iam_Memberships m WHERE m.WorkspaceKey = w.WorkspaceKey AND m.Status = 1) AS MemberCount,
            (SELECT COUNT(*) FROM iam_Widgets wg WHERE wg.WorkspaceKey = w.WorkspaceKey AND wg.Status = 1) AS WidgetCount,
            (SELECT u.Email FROM iam_Memberships m
             JOIN iam_Users u ON u.UserKey = m.UserKey
             JOIN iam_MembershipRoles mr ON mr.MembershipKey = m.MembershipKey
             JOIN iam_Roles r ON r.RoleKey = mr.RoleKey
             WHERE m.WorkspaceKey = w.WorkspaceKey AND r.Name = 'Owner' LIMIT 1) AS OwnerEmail
     FROM iam_Workspaces w WHERE ${whereClause} ORDER BY w.CreatedAt DESC LIMIT ? OFFSET ?`,
        [...params, limit, offset]
    );
    return { workspaces: rows, total: countRows[0].Total, page, limit, totalPages: Math.ceil(countRows[0].Total / limit) };
};

const updateWorkspace = async (workspaceId, { name, status }) => {
    const updates = ['UpdatedAt = UTC_TIMESTAMP(3)'];
    const params = [];
    if (name !== undefined) { updates.push('Name = ?'); params.push(name); }
    if (status !== undefined) { updates.push('Status = ?'); params.push(status); }
    params.push(workspaceId);
    await getPool().execute(`UPDATE iam_Workspaces SET ${updates.join(', ')} WHERE WorkspaceId = ?`, params);
};

const deleteWorkspace = async (workspaceId) => {
    await getPool().execute('UPDATE iam_Workspaces SET Status = 2, UpdatedAt = UTC_TIMESTAMP(3) WHERE WorkspaceId = ?', [workspaceId]);
};

module.exports = { getDashboardStats, getMessageStats, getConversationStats, getAllConversations, getConversationById, deleteConversation, getAllUsers, getUserByKey, updateUser, deleteUser, getAllWorkspaces, updateWorkspace, deleteWorkspace };
