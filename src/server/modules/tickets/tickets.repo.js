const { getPool } = require('../../infra/mysql/mysql');

const createTicket = async ({ workspaceKey, conversationKey, title, description, type, priority, assigneeUserKey, reporterUserKey, dueDate }) => {
  const pool = getPool();
  const [posRows] = await pool.execute(
    'SELECT IFNULL(MAX(Position), 0) + 1 as nextPos FROM iam_Tickets WHERE WorkspaceKey = ? AND Status = 1',
    [workspaceKey]
  );
  const position = posRows[0].nextPos;

  const [result] = await pool.execute(
    `INSERT INTO iam_Tickets (WorkspaceKey, ConversationKey, Title, Description, Type, Priority, AssigneeUserKey, ReporterUserKey, DueDate, Position)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [workspaceKey, conversationKey || null, title, description || null, type || 1, priority || 2,
      assigneeUserKey || null, reporterUserKey, dueDate || null, position]
  );
  const [rows] = await pool.execute(
    `SELECT TicketKey, TicketId, WorkspaceKey, Title, Description, Type, Status, Priority,
            AssigneeUserKey, ReporterUserKey, DueDate, Position, CreatedAt
     FROM iam_Tickets WHERE TicketKey = ?`,
    [result.insertId]
  );
  return rows[0];
};

const getTicketsByWorkspace = async (workspaceKey, { status, type, assigneeUserKey, priority } = {}) => {
  const params = [workspaceKey];
  let query = `SELECT t.TicketKey, t.TicketId, t.Title, t.Description, t.Type, t.Status, t.Priority,
    t.DueDate, t.Position, t.CreatedAt, t.UpdatedAt, t.CompletedAt, t.AssigneeUserKey, t.ReporterUserKey,
    a.DisplayName as AssigneeName, a.Email as AssigneeEmail, a.AvatarUrl as AssigneeAvatar,
    r.DisplayName as ReporterName, r.Email as ReporterEmail
    FROM iam_Tickets t
    LEFT JOIN iam_Users a ON t.AssigneeUserKey = a.UserKey
    LEFT JOIN iam_Users r ON t.ReporterUserKey = r.UserKey
    WHERE t.WorkspaceKey = ?`;

  if (status) { query += ' AND t.Status = ?'; params.push(status); }
  if (type) { query += ' AND t.Type = ?'; params.push(type); }
  if (assigneeUserKey) { query += ' AND t.AssigneeUserKey = ?'; params.push(assigneeUserKey); }
  if (priority) { query += ' AND t.Priority = ?'; params.push(priority); }
  query += ' ORDER BY t.Status, t.Position ASC';

  const [rows] = await getPool().execute(query, params);
  return rows;
};

const getTicketById = async (ticketId) => {
  const [rows] = await getPool().execute(
    `SELECT t.TicketKey, t.TicketId, t.WorkspaceKey, t.ConversationKey, t.Title, t.Description,
            t.Type, t.Status, t.Priority, t.DueDate, t.Position, t.CreatedAt, t.UpdatedAt, t.CompletedAt,
            t.AssigneeUserKey, t.ReporterUserKey,
            a.DisplayName as AssigneeName, a.Email as AssigneeEmail, a.AvatarUrl as AssigneeAvatar,
            r.DisplayName as ReporterName, r.Email as ReporterEmail
     FROM iam_Tickets t
     LEFT JOIN iam_Users a ON t.AssigneeUserKey = a.UserKey
     LEFT JOIN iam_Users r ON t.ReporterUserKey = r.UserKey
     WHERE t.TicketId = ?`,
    [ticketId]
  );
  return rows[0];
};

const updateTicket = async (ticketKey, { title, description, priority, assigneeUserKey, dueDate }) => {
  await getPool().execute(
    `UPDATE iam_Tickets SET Title = ?, Description = ?, Priority = ?, AssigneeUserKey = ?,
     DueDate = ?, UpdatedAt = UTC_TIMESTAMP(3) WHERE TicketKey = ?`,
    [title, description, priority, assigneeUserKey || null, dueDate || null, ticketKey]
  );
};

const updateTicketStatus = async (ticketKey, status, position) => {
  const completedAt = status === 4 ? 'UTC_TIMESTAMP(3)' : 'NULL';
  await getPool().execute(
    `UPDATE iam_Tickets SET Status = ?, Position = ?, CompletedAt = ${completedAt}, UpdatedAt = UTC_TIMESTAMP(3) WHERE TicketKey = ?`,
    [status, position, ticketKey]
  );
};

const deleteTicket = async (ticketKey) => {
  await getPool().execute('DELETE FROM iam_Tickets WHERE TicketKey = ?', [ticketKey]);
};

const getAllTicketsForAdmin = async ({ workspaceKey, status, type, limit = 100, offset = 0 } = {}) => {
  const params = [];
  let query = `SELECT t.TicketKey, t.TicketId, t.Title, t.Type, t.Status, t.Priority, t.Position,
    t.CreatedAt, w.Name as WorkspaceName, a.DisplayName as AssigneeName, a.AvatarUrl as AssigneeAvatar
    FROM iam_Tickets t LEFT JOIN iam_Users a ON t.AssigneeUserKey = a.UserKey
    LEFT JOIN iam_Workspaces w ON t.WorkspaceKey = w.WorkspaceKey WHERE 1=1`;

  if (workspaceKey) { query += ' AND t.WorkspaceKey = ?'; params.push(workspaceKey); }
  if (status) { query += ' AND t.Status = ?'; params.push(status); }
  if (type) { query += ' AND t.Type = ?'; params.push(type); }
  query += ' ORDER BY t.CreatedAt DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const [rows] = await getPool().execute(query, params);
  return rows;
};

const getTicketCountsByStatus = async (workspaceKey) => {
  const [rows] = await getPool().execute(
    'SELECT Status, COUNT(*) as Count FROM iam_Tickets WHERE WorkspaceKey = ? GROUP BY Status',
    [workspaceKey]
  );
  return rows;
};

module.exports = { createTicket, getTicketsByWorkspace, getTicketById, updateTicket, updateTicketStatus, deleteTicket, getAllTicketsForAdmin, getTicketCountsByStatus };
