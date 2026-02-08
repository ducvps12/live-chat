/**
 * AI Service - Integration with AntigravityManager Proxy
 * Provides OpenAI-compatible API calls for AI chatbot responses
 */

const AI_PROXY_URL = process.env.AI_PROXY_URL || 'http://168.250.137.33:8045/v1';
const AI_PROXY_KEY = process.env.AI_PROXY_KEY || '';
const AI_DEFAULT_MODEL = process.env.AI_DEFAULT_MODEL || 'gemini-2.5-flash';
const AI_TIMEOUT_MS = parseInt(process.env.AI_TIMEOUT_MS || '30000', 10);

class AiService {
    constructor() {
        this.rateLimitMap = new Map(); // workspaceKey -> { count, resetTime }
        this.RATE_LIMIT_PER_MIN = parseInt(process.env.AI_RATE_LIMIT_PER_MIN || '60', 10);
    }

    /**
     * Generate AI response for a message
     * @param {string} message - User message
     * @param {number} workspaceKey - Workspace identifier
     * @param {object} options - Additional options
     * @returns {object|null} - AI response or null
     */
    async generateResponse(message, workspaceKey, options = {}) {
        const startTime = Date.now();

        try {
            // Rate limiting check
            if (!this.checkRateLimit(workspaceKey)) {
                console.warn(`[AI] Rate limit exceeded for workspace ${workspaceKey}`);
                return null;
            }

            const {
                model = AI_DEFAULT_MODEL,
                systemPrompt = 'Bạn là trợ lý ảo hỗ trợ khách hàng. Trả lời ngắn gọn, thân thiện.',
                maxTokens = 500,
                temperature = 0.7,
                conversationHistory = []
            } = options;

            // Build messages array
            const messages = [
                { role: 'system', content: systemPrompt }
            ];

            // Add conversation history (last 5 messages for context)
            if (conversationHistory.length > 0) {
                const recentHistory = conversationHistory.slice(-5);
                recentHistory.forEach(msg => {
                    messages.push({
                        role: msg.sender === 'visitor' ? 'user' : 'assistant',
                        content: msg.text
                    });
                });
            }

            // Add current message
            messages.push({ role: 'user', content: message });

            // Call AntigravityManager API
            const response = await this.callApi({
                model,
                messages,
                max_tokens: maxTokens,
                temperature
            });

            if (!response || !response.choices || response.choices.length === 0) {
                console.warn('[AI] Empty response from API');
                return null;
            }

            const aiText = response.choices[0].message?.content || '';
            const responseTime = Date.now() - startTime;

            // Log usage (async, don't block)
            this.logUsage(workspaceKey, {
                model,
                promptTokens: response.usage?.prompt_tokens || 0,
                completionTokens: response.usage?.completion_tokens || 0,
                totalTokens: response.usage?.total_tokens || 0,
                responseTimeMs: responseTime,
                success: true
            }).catch(err => console.error('[AI] Failed to log usage:', err));

            console.log(`[AI] Response generated in ${responseTime}ms for workspace ${workspaceKey}`);

            return {
                type: 'ai',
                content: aiText.trim(),
                model,
                responseTimeMs: responseTime
            };

        } catch (error) {
            const responseTime = Date.now() - startTime;
            console.error('[AI] Error generating response:', error.message);

            // Log failed attempt
            this.logUsage(workspaceKey, {
                model: options.model || AI_DEFAULT_MODEL,
                responseTimeMs: responseTime,
                success: false,
                errorMessage: error.message
            }).catch(err => console.error('[AI] Failed to log error:', err));

            return null;
        }
    }

    /**
     * Call AntigravityManager API (OpenAI-compatible)
     */
    async callApi(payload) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

        try {
            const response = await fetch(`${AI_PROXY_URL}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${AI_PROXY_KEY}`
                },
                body: JSON.stringify(payload),
                signal: controller.signal
            });

            clearTimeout(timeout);

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API error ${response.status}: ${errorText}`);
            }

            return await response.json();

        } catch (error) {
            clearTimeout(timeout);
            if (error.name === 'AbortError') {
                throw new Error('AI request timeout');
            }
            throw error;
        }
    }

    /**
     * Check rate limit for workspace
     */
    checkRateLimit(workspaceKey) {
        const now = Date.now();
        const limit = this.rateLimitMap.get(workspaceKey);

        if (!limit || now > limit.resetTime) {
            // Reset or initialize
            this.rateLimitMap.set(workspaceKey, {
                count: 1,
                resetTime: now + 60000 // 1 minute
            });
            return true;
        }

        if (limit.count >= this.RATE_LIMIT_PER_MIN) {
            return false;
        }

        limit.count++;
        return true;
    }

    /**
     * Log AI usage to database
     */
    async logUsage(workspaceKey, data) {
        try {
            const aiRepo = require('./ai.repo');
            await aiRepo.logUsage(workspaceKey, data);
        } catch (error) {
            console.error('[AI] Failed to log usage:', error);
        }
    }

    /**
     * Get usage statistics for a workspace
     */
    async getUsageStats(workspaceKey, days = 30) {
        const aiRepo = require('./ai.repo');
        return aiRepo.getUsageStats(workspaceKey, days);
    }

    /**
     * Test AI connection
     */
    async testConnection(customConfig = {}) {
        try {
            const response = await this.generateResponse(
                'Xin chào, đây là tin nhắn test',
                0, // Test workspace
                {
                    maxTokens: 50,
                    ...customConfig
                }
            );

            return {
                success: !!response,
                response: response?.content || null,
                model: response?.model || null,
                responseTimeMs: response?.responseTimeMs || null
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get available models from AntigravityManager
     */
    getAvailableModels() {
        return [
            { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'google' },
            { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'google' },
            { id: 'gemini-3-flash', name: 'Gemini 3 Flash', provider: 'google' },
            { id: 'gemini-3-pro-high', name: 'Gemini 3 Pro High', provider: 'google' },
            { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5', provider: 'anthropic' },
            { id: 'claude-opus-4-5-thinking', name: 'Claude Opus 4.5', provider: 'anthropic' }
        ];
    }
}

module.exports = new AiService();
