const { getPool } = require('../../infra/mysql/mysql');

class AiRepo {
    async logUsage(workspaceKey, data) {
        await getPool().execute(
            `INSERT INTO iam_AiUsage (WorkspaceKey, ConversationId, Model, PromptTokens, CompletionTokens, TotalTokens, ResponseTimeMs, Success, ErrorMessage)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [workspaceKey, data.conversationId || null, data.model, data.promptTokens || 0, data.completionTokens || 0, data.totalTokens || 0, data.responseTimeMs || 0, data.success !== false ? 1 : 0, data.errorMessage || null]
        );
    }

    async getUsageStats(workspaceKey, days = 30) {
        const [rows] = await getPool().execute(
            `SELECT COUNT(*) as TotalRequests,
              SUM(CASE WHEN Success = 1 THEN 1 ELSE 0 END) as SuccessfulRequests,
              SUM(CASE WHEN Success = 0 THEN 1 ELSE 0 END) as FailedRequests,
              SUM(TotalTokens) as TotalTokensUsed,
              AVG(ResponseTimeMs) as AvgResponseTimeMs,
              MIN(CreatedAt) as FirstUsage, MAX(CreatedAt) as LastUsage
       FROM iam_AiUsage WHERE WorkspaceKey = ? AND CreatedAt >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? DAY)`,
            [workspaceKey, days]
        );
        return rows[0] || null;
    }

    async getDailyUsage(workspaceKey, days = 7) {
        const [rows] = await getPool().execute(
            `SELECT DATE(CreatedAt) as Date, COUNT(*) as Requests, SUM(TotalTokens) as Tokens, AVG(ResponseTimeMs) as AvgResponseMs
       FROM iam_AiUsage WHERE WorkspaceKey = ? AND CreatedAt >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? DAY)
       GROUP BY DATE(CreatedAt) ORDER BY Date DESC`,
            [workspaceKey, days]
        );
        return rows;
    }

    async getUsageByModel(workspaceKey, days = 30) {
        const [rows] = await getPool().execute(
            `SELECT Model, COUNT(*) as Requests, SUM(TotalTokens) as Tokens, AVG(ResponseTimeMs) as AvgResponseMs,
              SUM(CASE WHEN Success = 0 THEN 1 ELSE 0 END) as Errors
       FROM iam_AiUsage WHERE WorkspaceKey = ? AND CreatedAt >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? DAY)
       GROUP BY Model ORDER BY Requests DESC`,
            [workspaceKey, days]
        );
        return rows;
    }
}

module.exports = new AiRepo();
