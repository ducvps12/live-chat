const { getPool } = require('../../infra/mysql/mysql');

class AnalyticsRepo {
    async getConversationStats(workspaceKey, startDate, endDate) {
        const params = [workspaceKey];
        let dateFilter = '';
        if (startDate) { dateFilter += ' AND wc.CreatedAt >= ?'; params.push(startDate); }
        if (endDate) { dateFilter += ' AND wc.CreatedAt <= ?'; params.push(endDate); }

        const [rows] = await getPool().execute(
            `SELECT COUNT(*) as totalConversations,
              COUNT(CASE WHEN wc.Status = 1 THEN 1 END) as activeConversations,
              COUNT(CASE WHEN wc.Status = 2 THEN 1 END) as closedConversations,
              COUNT(CASE WHEN wc.CreatedAt >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 DAY) THEN 1 END) as newToday,
              COUNT(CASE WHEN wc.CreatedAt >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 7 DAY) THEN 1 END) as newThisWeek
       FROM iam_WidgetConversations wc
       JOIN iam_Widgets w ON wc.WidgetKey = w.WidgetKey
       WHERE w.WorkspaceKey = ? ${dateFilter}`,
            params
        );
        return rows[0];
    }

    async getMessageStats(workspaceKey, startDate, endDate) {
        const params = [workspaceKey];
        let dateFilter = '';
        if (startDate) { dateFilter += ' AND wm.CreatedAt >= ?'; params.push(startDate); }
        if (endDate) { dateFilter += ' AND wm.CreatedAt <= ?'; params.push(endDate); }

        const [rows] = await getPool().execute(
            `SELECT COUNT(*) as totalMessages,
              COUNT(CASE WHEN SenderType = 1 THEN 1 END) as visitorMessages,
              COUNT(CASE WHEN SenderType = 2 THEN 1 END) as agentMessages,
              COUNT(CASE WHEN SenderType = 3 THEN 1 END) as botMessages
       FROM iam_WidgetMessages wm
       JOIN iam_WidgetConversations wc ON wm.ConversationKey = wc.ConversationKey
       JOIN iam_Widgets w ON wc.WidgetKey = w.WidgetKey
       WHERE w.WorkspaceKey = ? ${dateFilter}`,
            params
        );
        return rows[0];
    }

    async getConversationsByDay(workspaceKey, days = 30) {
        const [rows] = await getPool().execute(
            `SELECT DATE(wc.CreatedAt) as date, COUNT(*) as count
       FROM iam_WidgetConversations wc
       JOIN iam_Widgets w ON wc.WidgetKey = w.WidgetKey
       WHERE w.WorkspaceKey = ? AND wc.CreatedAt >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? DAY)
       GROUP BY DATE(wc.CreatedAt) ORDER BY date ASC`,
            [workspaceKey, days]
        );
        return rows;
    }

    async getMessagesByDay(workspaceKey, days = 30) {
        const [rows] = await getPool().execute(
            `SELECT DATE(wm.CreatedAt) as date, COUNT(*) as count,
              COUNT(CASE WHEN SenderType = 1 THEN 1 END) as visitorCount,
              COUNT(CASE WHEN SenderType = 2 THEN 1 END) as agentCount,
              COUNT(CASE WHEN SenderType = 3 THEN 1 END) as botCount
       FROM iam_WidgetMessages wm
       JOIN iam_WidgetConversations wc ON wm.ConversationKey = wc.ConversationKey
       JOIN iam_Widgets w ON wc.WidgetKey = w.WidgetKey
       WHERE w.WorkspaceKey = ? AND wm.CreatedAt >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? DAY)
       GROUP BY DATE(wm.CreatedAt) ORDER BY date ASC`,
            [workspaceKey, days]
        );
        return rows;
    }

    async getPeakHours(workspaceKey, days = 30) {
        const [rows] = await getPool().execute(
            `SELECT HOUR(wm.CreatedAt) as hour, DAYOFWEEK(wm.CreatedAt) as dayOfWeek, COUNT(*) as count
       FROM iam_WidgetMessages wm
       JOIN iam_WidgetConversations wc ON wm.ConversationKey = wc.ConversationKey
       JOIN iam_Widgets w ON wc.WidgetKey = w.WidgetKey
       WHERE w.WorkspaceKey = ? AND wm.CreatedAt >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? DAY)
       GROUP BY HOUR(wm.CreatedAt), DAYOFWEEK(wm.CreatedAt) ORDER BY dayOfWeek, hour`,
            [workspaceKey, days]
        );
        return rows;
    }

    async getResponseTimeStats(workspaceKey, days = 30) {
        const [rows] = await getPool().execute(
            `SELECT
         AVG(TIMESTAMPDIFF(SECOND, fvm.FirstVisitorTime, far.FirstAgentTime)) as avgResponseTimeSeconds,
         MIN(TIMESTAMPDIFF(SECOND, fvm.FirstVisitorTime, far.FirstAgentTime)) as minResponseTimeSeconds,
         MAX(TIMESTAMPDIFF(SECOND, fvm.FirstVisitorTime, far.FirstAgentTime)) as maxResponseTimeSeconds,
         COUNT(*) as respondedConversations
       FROM (
         SELECT wc.ConversationKey, MIN(wm.CreatedAt) as FirstVisitorTime
         FROM iam_WidgetMessages wm
         JOIN iam_WidgetConversations wc ON wm.ConversationKey = wc.ConversationKey
         JOIN iam_Widgets w ON wc.WidgetKey = w.WidgetKey
         WHERE w.WorkspaceKey = ? AND wm.SenderType = 1 AND wm.CreatedAt >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? DAY)
         GROUP BY wc.ConversationKey
       ) fvm
       JOIN (
         SELECT wm.ConversationKey, MIN(wm.CreatedAt) as FirstAgentTime
         FROM iam_WidgetMessages wm
         JOIN iam_WidgetConversations wc ON wm.ConversationKey = wc.ConversationKey
         JOIN iam_Widgets w ON wc.WidgetKey = w.WidgetKey
         WHERE w.WorkspaceKey = ? AND wm.SenderType = 2 AND wm.CreatedAt >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? DAY)
         GROUP BY wm.ConversationKey
       ) far ON fvm.ConversationKey = far.ConversationKey
       WHERE far.FirstAgentTime > fvm.FirstVisitorTime`,
            [workspaceKey, days, workspaceKey, days]
        );
        return rows[0];
    }

    async getAgentStats(workspaceKey, days = 30) {
        const [rows] = await getPool().execute(
            `SELECT u.UserKey, u.DisplayName as agentName, u.Email as agentEmail,
              COUNT(DISTINCT wc.ConversationKey) as handledConversations,
              COUNT(wm.MessageKey) as messagesSent
       FROM iam_Users u
       JOIN iam_Memberships m ON u.UserKey = m.UserKey
       LEFT JOIN iam_WidgetConversations wc ON wc.AssignedUserKey = u.UserKey
       LEFT JOIN iam_WidgetMessages wm ON wm.ConversationKey = wc.ConversationKey AND wm.SenderType = 2
       WHERE m.WorkspaceKey = ?
       GROUP BY u.UserKey, u.DisplayName, u.Email ORDER BY messagesSent DESC`,
            [workspaceKey]
        );
        return rows;
    }

    async getWidgetStats(workspaceKey) {
        const [rows] = await getPool().execute(
            `SELECT w.WidgetKey, w.Name as widgetName, w.SiteKey,
              COUNT(DISTINCT wc.ConversationKey) as conversationCount,
              COUNT(wm.MessageKey) as messageCount,
              MAX(wc.LastMessageAt) as lastActivity
       FROM iam_Widgets w
       LEFT JOIN iam_WidgetConversations wc ON w.WidgetKey = wc.WidgetKey
       LEFT JOIN iam_WidgetMessages wm ON wc.ConversationKey = wm.ConversationKey
       WHERE w.WorkspaceKey = ?
       GROUP BY w.WidgetKey, w.Name, w.SiteKey ORDER BY conversationCount DESC`,
            [workspaceKey]
        );
        return rows;
    }

    async getBotStats(workspaceKey, days = 30) {
        const [rows] = await getPool().execute(
            `SELECT COUNT(CASE WHEN SenderType = 3 THEN 1 END) as botMessages,
              COUNT(CASE WHEN SenderType = 1 THEN 1 END) as visitorMessages,
              COUNT(CASE WHEN SenderType = 2 THEN 1 END) as agentMessages,
              CASE WHEN COUNT(CASE WHEN SenderType = 1 THEN 1 END) > 0
                THEN CAST(COUNT(CASE WHEN SenderType = 3 THEN 1 END) AS DECIMAL) / COUNT(CASE WHEN SenderType = 1 THEN 1 END) * 100
                ELSE 0 END as botResponseRate
       FROM iam_WidgetMessages wm
       JOIN iam_WidgetConversations wc ON wm.ConversationKey = wc.ConversationKey
       JOIN iam_Widgets w ON wc.WidgetKey = w.WidgetKey
       WHERE w.WorkspaceKey = ? AND wm.CreatedAt >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? DAY)`,
            [workspaceKey, days]
        );
        return rows[0];
    }
}

module.exports = new AnalyticsRepo();
