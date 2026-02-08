const { getPool } = require('../../infra/mysql/mysql');

class BotRepo {
    async getRulesByWorkspace(workspaceKey) {
        const [rows] = await getPool().execute(
            `SELECT RuleKey, RuleId, Name, TriggerType, TriggerValue, TriggerConfig,
              ResponseType, ResponseContent, Priority, IsActive, CreatedAt, UpdatedAt
       FROM iam_BotRules WHERE WorkspaceKey = ? ORDER BY Priority ASC, CreatedAt ASC`,
            [workspaceKey]
        );
        return rows;
    }

    async getActiveRules(workspaceKey) {
        const [rows] = await getPool().execute(
            `SELECT RuleKey, RuleId, Name, TriggerType, TriggerValue, TriggerConfig,
              ResponseType, ResponseContent, Priority
       FROM iam_BotRules WHERE WorkspaceKey = ? AND IsActive = 1 ORDER BY Priority ASC`,
            [workspaceKey]
        );
        return rows;
    }

    async getRuleById(ruleId) {
        const [rows] = await getPool().execute(
            `SELECT RuleKey, RuleId, WorkspaceKey, Name, TriggerType, TriggerValue, TriggerConfig,
              ResponseType, ResponseContent, Priority, IsActive, CreatedAt, UpdatedAt
       FROM iam_BotRules WHERE RuleId = ?`,
            [ruleId]
        );
        return rows[0] || null;
    }

    async createRule(workspaceKey, data) {
        const pool = getPool();
        const [result] = await pool.execute(
            `INSERT INTO iam_BotRules (WorkspaceKey, Name, TriggerType, TriggerValue, TriggerConfig, ResponseType, ResponseContent, Priority, IsActive)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [workspaceKey, data.name, data.triggerType, data.triggerValue || null,
                data.triggerConfig ? JSON.stringify(data.triggerConfig) : null,
                data.responseType || 'text',
                typeof data.responseContent === 'object' ? JSON.stringify(data.responseContent) : data.responseContent,
                data.priority || 100, data.isActive !== false ? 1 : 0]
        );
        const [rows] = await pool.execute('SELECT * FROM iam_BotRules WHERE RuleKey = ?', [result.insertId]);
        return rows[0];
    }

    async updateRule(ruleId, data) {
        const pool = getPool();
        await pool.execute(
            `UPDATE iam_BotRules SET Name = ?, TriggerType = ?, TriggerValue = ?, TriggerConfig = ?,
       ResponseType = ?, ResponseContent = ?, Priority = ?, IsActive = ?, UpdatedAt = UTC_TIMESTAMP(3) WHERE RuleId = ?`,
            [data.name, data.triggerType, data.triggerValue || null,
            data.triggerConfig ? JSON.stringify(data.triggerConfig) : null,
            data.responseType || 'text',
            typeof data.responseContent === 'object' ? JSON.stringify(data.responseContent) : data.responseContent,
            data.priority || 100, data.isActive !== false ? 1 : 0, ruleId]
        );
        const [rows] = await pool.execute('SELECT * FROM iam_BotRules WHERE RuleId = ?', [ruleId]);
        return rows[0];
    }

    async deleteRule(ruleId) {
        const [result] = await getPool().execute('DELETE FROM iam_BotRules WHERE RuleId = ?', [ruleId]);
        return result.affectedRows > 0;
    }

    async toggleRule(ruleId, isActive) {
        const pool = getPool();
        await pool.execute('UPDATE iam_BotRules SET IsActive = ?, UpdatedAt = UTC_TIMESTAMP(3) WHERE RuleId = ?', [isActive ? 1 : 0, ruleId]);
        const [rows] = await pool.execute('SELECT * FROM iam_BotRules WHERE RuleId = ?', [ruleId]);
        return rows[0];
    }

    async getSettings(workspaceKey) {
        const [rows] = await getPool().execute(
            `SELECT SettingKey, WorkspaceKey, IsEnabled, WelcomeMessage, OfflineMessage,
              IdleTimeoutSeconds, TransferToAgentAfterFails, AiEnabled, AiModel,
              AiSystemPrompt, AiMaxTokens, AiTemperature, CreatedAt, UpdatedAt
       FROM iam_BotSettings WHERE WorkspaceKey = ?`,
            [workspaceKey]
        );
        return rows[0] || null;
    }

    async upsertSettings(workspaceKey, data) {
        const pool = getPool();
        const params = [
            data.isEnabled !== false ? 1 : 0, data.welcomeMessage || null, data.offlineMessage || null,
            data.idleTimeoutSeconds || 60, data.transferToAgentAfterFails || 3,
            data.aiEnabled ? 1 : 0, data.aiModel || 'gemini-2.5-flash', data.aiSystemPrompt || null,
            data.aiMaxTokens || 500, data.aiTemperature || 0.7
        ];

        await pool.execute(
            `INSERT INTO iam_BotSettings (WorkspaceKey, IsEnabled, WelcomeMessage, OfflineMessage,
       IdleTimeoutSeconds, TransferToAgentAfterFails, AiEnabled, AiModel, AiSystemPrompt, AiMaxTokens, AiTemperature)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         IsEnabled = VALUES(IsEnabled), WelcomeMessage = VALUES(WelcomeMessage),
         OfflineMessage = VALUES(OfflineMessage), IdleTimeoutSeconds = VALUES(IdleTimeoutSeconds),
         TransferToAgentAfterFails = VALUES(TransferToAgentAfterFails),
         AiEnabled = VALUES(AiEnabled), AiModel = VALUES(AiModel), AiSystemPrompt = VALUES(AiSystemPrompt),
         AiMaxTokens = VALUES(AiMaxTokens), AiTemperature = VALUES(AiTemperature),
         UpdatedAt = UTC_TIMESTAMP(3)`,
            [workspaceKey, ...params]
        );
        return this.getSettings(workspaceKey);
    }
}

module.exports = new BotRepo();
