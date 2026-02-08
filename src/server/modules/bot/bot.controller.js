/**
 * Bot Controller - API handlers for bot management
 */
const botService = require('./bot.service');

class BotController {
    /**
     * GET /workspaces/:workspaceId/bot/rules
     * Get all bot rules for workspace
     */
    async getRules(req, res) {
        try {
            const { workspaceKey } = req.workspace;
            const rules = await botService.getAllRules(workspaceKey);

            res.json({
                success: true,
                data: { rules }
            });
        } catch (error) {
            console.error('[BotController.getRules] Error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get bot rules'
            });
        }
    }

    /**
     * POST /workspaces/:workspaceId/bot/rules
     * Create a new bot rule
     */
    async createRule(req, res) {
        try {
            const { workspaceKey } = req.workspace;
            const { name, triggerType, triggerValue, triggerConfig, responseType, responseContent, priority, isActive } = req.body;

            // Validate required fields
            if (!name || !triggerType || !responseContent) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required fields: name, triggerType, responseContent'
                });
            }

            const rule = await botService.createRule(workspaceKey, {
                name,
                triggerType,
                triggerValue,
                triggerConfig,
                responseType,
                responseContent,
                priority,
                isActive
            });

            res.status(201).json({
                success: true,
                data: { rule }
            });
        } catch (error) {
            console.error('[BotController.createRule] Error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to create bot rule'
            });
        }
    }

    /**
     * PUT /workspaces/:workspaceId/bot/rules/:ruleId
     * Update a bot rule
     */
    async updateRule(req, res) {
        try {
            const { ruleId } = req.params;
            const { name, triggerType, triggerValue, triggerConfig, responseType, responseContent, priority, isActive } = req.body;

            const rule = await botService.updateRule(ruleId, {
                name,
                triggerType,
                triggerValue,
                triggerConfig,
                responseType,
                responseContent,
                priority,
                isActive
            });

            if (!rule) {
                return res.status(404).json({
                    success: false,
                    message: 'Rule not found'
                });
            }

            res.json({
                success: true,
                data: { rule }
            });
        } catch (error) {
            console.error('[BotController.updateRule] Error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to update bot rule'
            });
        }
    }

    /**
     * DELETE /workspaces/:workspaceId/bot/rules/:ruleId
     * Delete a bot rule
     */
    async deleteRule(req, res) {
        try {
            const { ruleId } = req.params;
            const deleted = await botService.deleteRule(ruleId);

            if (!deleted) {
                return res.status(404).json({
                    success: false,
                    message: 'Rule not found'
                });
            }

            res.json({
                success: true,
                message: 'Rule deleted successfully'
            });
        } catch (error) {
            console.error('[BotController.deleteRule] Error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to delete bot rule'
            });
        }
    }

    /**
     * PATCH /workspaces/:workspaceId/bot/rules/:ruleId/toggle
     * Toggle rule active status
     */
    async toggleRule(req, res) {
        try {
            const { ruleId } = req.params;
            const { isActive } = req.body;

            const rule = await botService.toggleRule(ruleId, isActive);

            if (!rule) {
                return res.status(404).json({
                    success: false,
                    message: 'Rule not found'
                });
            }

            res.json({
                success: true,
                data: { rule }
            });
        } catch (error) {
            console.error('[BotController.toggleRule] Error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to toggle bot rule'
            });
        }
    }

    /**
     * GET /workspaces/:workspaceId/bot/settings
     * Get bot settings for workspace
     */
    async getSettings(req, res) {
        try {
            const { workspaceKey } = req.workspace;
            let settings = await botService.getSettings(workspaceKey);

            // Return default settings if not configured
            if (!settings) {
                settings = {
                    IsEnabled: false,
                    WelcomeMessage: '',
                    OfflineMessage: '',
                    IdleTimeoutSeconds: 60,
                    TransferToAgentAfterFails: 3
                };
            }

            res.json({
                success: true,
                data: { settings }
            });
        } catch (error) {
            console.error('[BotController.getSettings] Error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get bot settings'
            });
        }
    }

    /**
     * PUT /workspaces/:workspaceId/bot/settings
     * Update bot settings for workspace
     */
    async updateSettings(req, res) {
        try {
            const { workspaceKey } = req.workspace;
            const { isEnabled, welcomeMessage, offlineMessage, idleTimeoutSeconds, transferToAgentAfterFails } = req.body;

            const settings = await botService.updateSettings(workspaceKey, {
                isEnabled,
                welcomeMessage,
                offlineMessage,
                idleTimeoutSeconds,
                transferToAgentAfterFails
            });

            res.json({
                success: true,
                data: { settings }
            });
        } catch (error) {
            console.error('[BotController.updateSettings] Error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to update bot settings'
            });
        }
    }

    /**
     * POST /workspaces/:workspaceId/bot/test
     * Test a message against bot rules (for debugging)
     */
    async testMessage(req, res) {
        try {
            const { workspaceKey } = req.workspace;
            const { message, isFirstMessage } = req.body;

            if (!message) {
                return res.status(400).json({
                    success: false,
                    message: 'Message is required'
                });
            }

            const response = await botService.processMessage(message, workspaceKey, { isFirstMessage });

            res.json({
                success: true,
                data: {
                    matched: response !== null,
                    response
                }
            });
        } catch (error) {
            console.error('[BotController.testMessage] Error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to test message'
            });
        }
    }
}

module.exports = new BotController();
