const { getPool } = require('../../infra/mysql/mysql');

const createNote = async ({ conversationKey, userKey, content }) => {
  const [result] = await getPool().execute(
    'INSERT INTO iam_ConversationNotes (ConversationKey, UserKey, Content) VALUES (?, ?, ?)',
    [conversationKey, userKey, content]
  );
  const [rows] = await getPool().execute(
    'SELECT NoteKey, NoteId, ConversationKey, UserKey, Content, CreatedAt FROM iam_ConversationNotes WHERE NoteKey = ?',
    [result.insertId]
  );
  return rows[0];
};

const getNotesByConversation = async (conversationKey) => {
  const [rows] = await getPool().execute(
    `SELECT n.NoteKey as noteKey, n.NoteId as noteId, n.Content as content, n.CreatedAt as createdAt,
            u.DisplayName as authorName, u.Email as authorEmail
     FROM iam_ConversationNotes n
     JOIN iam_Users u ON n.UserKey = u.UserKey
     WHERE n.ConversationKey = ?
     ORDER BY n.CreatedAt DESC`,
    [conversationKey]
  );
  return rows;
};

const updateNote = async (noteKey, content) => {
  await getPool().execute(
    'UPDATE iam_ConversationNotes SET Content = ?, UpdatedAt = UTC_TIMESTAMP(3) WHERE NoteKey = ?',
    [content, noteKey]
  );
};

const deleteNote = async (noteKey) => {
  await getPool().execute('DELETE FROM iam_ConversationNotes WHERE NoteKey = ?', [noteKey]);
};

module.exports = { createNote, getNotesByConversation, updateNote, deleteNote };
