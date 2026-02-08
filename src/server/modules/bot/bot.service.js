/**
 * Bot Service - Business logic for auto-reply bot
 */
const botRepo = require('./bot.repo');

class BotService {
    constructor() {
        // Cache for active rules per workspace (TTL: 60 seconds)
        this.rulesCache = new Map();
        this.cacheTTL = 60000; // 60 seconds
    }

    /**
     * Get active rules with caching
     */
    async getActiveRules(workspaceKey) {
        const cacheKey = `rules_${workspaceKey}`;
        const cached = this.rulesCache.get(cacheKey);

        if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
            return cached.rules;
        }

        const rules = await botRepo.getActiveRules(workspaceKey);
        this.rulesCache.set(cacheKey, { rules, timestamp: Date.now() });
        return rules;
    }

    /**
     * Clear cache for a workspace (call after rule updates)
     */
    clearCache(workspaceKey) {
        this.rulesCache.delete(`rules_${workspaceKey}`);
    }

    /**
     * Find matching rule for a message
     * @param {string} message - The incoming message
     * @param {number} workspaceKey - Workspace key
     * @param {object} context - Additional context (isFirstMessage, etc.)
     * @returns {object|null} - Matching rule or null
     */
    async findMatchingRule(message, workspaceKey, context = {}) {
        const rules = await this.getActiveRules(workspaceKey);
        const normalizedMessage = message.toLowerCase().trim();

        for (const rule of rules) {
            if (this.matchesRule(rule, normalizedMessage, context)) {
                return rule;
            }
        }

        return null;
    }

    /**
     * Check if message matches a rule
     */
    matchesRule(rule, message, context) {
        switch (rule.TriggerType) {
            case 'first_message':
                return context.isFirstMessage === true;

            case 'keyword':
                // Exact keyword match (comma-separated keywords)
                if (!rule.TriggerValue) return false;
                const keywords = rule.TriggerValue.toLowerCase().split(',').map(k => k.trim());
                return keywords.some(keyword => message === keyword);

            case 'contains':
                // Contains any of the keywords
                if (!rule.TriggerValue) return false;
                const containsKeywords = rule.TriggerValue.toLowerCase().split(',').map(k => k.trim());
                return containsKeywords.some(keyword => message.includes(keyword));

            case 'regex':
                // Regex pattern match
                if (!rule.TriggerValue) return false;
                try {
                    const regex = new RegExp(rule.TriggerValue, 'i');
                    return regex.test(message);
                } catch (e) {
                    console.error('Invalid regex in bot rule:', e);
                    return false;
                }

            case 'idle':
                // Idle timeout trigger (handled elsewhere)
                return context.isIdleTrigger === true;

            default:
                return false;
        }
    }

    /**
     * Generate bot response from rule
     */
    generateResponse(rule) {
        let content = rule.ResponseContent;

        // Try to parse as JSON for complex responses
        try {
            content = JSON.parse(content);
        } catch (e) {
            // Keep as string if not JSON
        }

        return {
            type: rule.ResponseType,
            content: content,
            ruleId: rule.RuleId,
            ruleName: rule.Name
        };
    }

    /**
     * Process incoming message and get bot response
     */
    async processMessage(message, workspaceKey, context = {}) {
        // Check if bot is enabled
        const settings = await botRepo.getSettings(workspaceKey);
        if (!settings || !settings.IsEnabled) {
            return null; // Bot disabled
        }

        // Find matching rule
        const rule = await this.findMatchingRule(message, workspaceKey, context);

        if (rule) {
            return this.generateResponse(rule);
        }

        // AI Fallback - if enabled and no rule matched
        if (settings.AiEnabled) {
            try {
                const aiService = require('../ai/ai.service');
                const aiResponse = await aiService.generateResponse(message, workspaceKey, {
                    model: settings.AiModel || 'gemini-2.5-flash',
                    systemPrompt: settings.AiSystemPrompt || 'Bạn là trợ lý ảo hỗ trợ khách hàng. Trả lời ngắn gọn, thân thiện.',
                    maxTokens: settings.AiMaxTokens || 500,
                    temperature: parseFloat(settings.AiTemperature) || 0.7,
                    conversationHistory: context.conversationHistory || []
                });

                if (aiResponse) {
                    return {
                        type: 'ai',
                        content: aiResponse.content,
                        model: aiResponse.model,
                        responseTimeMs: aiResponse.responseTimeMs,
                        ruleName: 'AI Response'
                    };
                }
            } catch (aiError) {
                console.error('[Bot] AI fallback error:', aiError.message);
            }
        }

        return null; // No matching rule and no AI response
    }

    /**
     * Get welcome message for new conversation
     */
    async getWelcomeMessage(workspaceKey) {
        // First check for first_message rule
        const rules = await this.getActiveRules(workspaceKey);
        const welcomeRule = rules.find(r => r.TriggerType === 'first_message');

        if (welcomeRule) {
            return this.generateResponse(welcomeRule);
        }

        // Fallback to settings welcome message
        const settings = await botRepo.getSettings(workspaceKey);
        if (settings && settings.WelcomeMessage) {
            return {
                type: 'text',
                content: settings.WelcomeMessage,
                isSystemMessage: true
            };
        }

        return null;
    }

    // ==================== CRUD Operations ====================

    async getAllRules(workspaceKey) {
        return botRepo.getRulesByWorkspace(workspaceKey);
    }

    async getRule(ruleId) {
        return botRepo.getRuleById(ruleId);
    }

    async createRule(workspaceKey, data) {
        const rule = await botRepo.createRule(workspaceKey, data);
        this.clearCache(workspaceKey);
        return rule;
    }

    async updateRule(ruleId, data) {
        const rule = await botRepo.updateRule(ruleId, data);
        if (rule) {
            this.clearCache(rule.WorkspaceKey);
        }
        return rule;
    }

    async deleteRule(ruleId) {
        const rule = await botRepo.getRuleById(ruleId);
        if (rule) {
            await botRepo.deleteRule(ruleId);
            this.clearCache(rule.WorkspaceKey);
            return true;
        }
        return false;
    }

    async toggleRule(ruleId, isActive) {
        const rule = await botRepo.toggleRule(ruleId, isActive);
        if (rule) {
            this.clearCache(rule.WorkspaceKey);
        }
        return rule;
    }

    async getSettings(workspaceKey) {
        return botRepo.getSettings(workspaceKey);
    }

    async updateSettings(workspaceKey, data) {
        return botRepo.upsertSettings(workspaceKey, data);
    }
}

module.exports = new BotService();
