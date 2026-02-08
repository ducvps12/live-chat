/**
 * AI Controller - API endpoints for AI management
 */
const aiService = require('./ai.service');
const botRepo = require('../bot/bot.repo');

/**
 * Test AI connection
 * POST /api/ai/test
 */
async function testAi(req, res) {
    try {
        const { message, model } = req.body;

        const result = await aiService.testConnection({
            model: model || undefined
        });

        res.json(result);
    } catch (error) {
        console.error('[AI] Test error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

/**
 * Get AI usage statistics
 * GET /api/ai/usage/:workspaceKey
 */
async function getUsage(req, res) {
    try {
        const { workspaceKey } = req.params;
        const { days = 30 } = req.query;

        const stats = await aiService.getUsageStats(parseInt(workspaceKey), parseInt(days));

        res.json({ success: true, data: stats });
    } catch (error) {
        console.error('[AI] Get usage error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

/**
 * Get available AI models
 * GET /api/ai/models
 */
async function getModels(req, res) {
    try {
        const models = aiService.getAvailableModels();
        res.json({ success: true, data: models });
    } catch (error) {
        console.error('[AI] Get models error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

/**
 * Update AI settings for workspace
 * PUT /api/ai/settings/:workspaceKey
 */
async function updateSettings(req, res) {
    try {
        const { workspaceKey } = req.params;
        const { aiEnabled, aiModel, aiSystemPrompt, aiMaxTokens, aiTemperature } = req.body;

        // Get current settings and update
        const currentSettings = await botRepo.getSettings(parseInt(workspaceKey));

        const updatedSettings = await botRepo.upsertSettings(parseInt(workspaceKey), {
            ...currentSettings,
            isEnabled: currentSettings?.IsEnabled || false,
            welcomeMessage: currentSettings?.WelcomeMessage || null,
            offlineMessage: currentSettings?.OfflineMessage || null,
            aiEnabled,
            aiModel,
            aiSystemPrompt,
            aiMaxTokens,
            aiTemperature
        });

        res.json({ success: true, data: updatedSettings });
    } catch (error) {
        console.error('[AI] Update settings error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

/**
 * Get AI settings for workspace
 * GET /api/ai/settings/:workspaceKey
 */
async function getSettings(req, res) {
    try {
        const { workspaceKey } = req.params;

        const settings = await botRepo.getSettings(parseInt(workspaceKey));

        res.json({
            success: true,
            data: {
                aiEnabled: settings?.AiEnabled || false,
                aiModel: settings?.AiModel || 'gemini-2.5-flash',
                aiSystemPrompt: settings?.AiSystemPrompt || '',
                aiMaxTokens: settings?.AiMaxTokens || 500,
                aiTemperature: settings?.AiTemperature || 0.7
            }
        });
    } catch (error) {
        console.error('[AI] Get settings error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

/**
 * Generate AI response (for testing in UI)
 * POST /api/ai/generate
 */
async function generateResponse(req, res) {
    try {
        const { message, workspaceKey, model, systemPrompt } = req.body;

        if (!message) {
            return res.status(400).json({ success: false, error: 'Message is required' });
        }

        const response = await aiService.generateResponse(message, workspaceKey || 0, {
            model,
            systemPrompt,
            maxTokens: 500
        });

        if (!response) {
            return res.json({ success: false, error: 'No response from AI' });
        }

        res.json({ success: true, data: response });
    } catch (error) {
        console.error('[AI] Generate error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

module.exports = {
    testAi,
    getUsage,
    getModels,
    updateSettings,
    getSettings,
    generateResponse
};
