import axios from 'axios';
import { AppError } from '../../middlewares/errorHandler';
import { getAIModel } from '../../config/ai';
import { SETTINGS_KEYS, settingsService } from '../admin/settings.service';
import type {
    AICompletionInput,
    AICompletionResponse,
    AIProviderName,
    AIProviderStatus,
} from './ai.types';

type AIProviderConfig = {
    provider: AIProviderName;
    baseUrl: string;
    apiKey: string;
    model: string;
};

type RuntimeTarget = {
    baseUrl: string;
    apiKey?: string;
    timeoutMs?: number;
};

const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_OLLAMA_BASE_URL = 'http://127.0.0.1:11434';
const DEFAULT_OLLAMA_MODEL = 'qwen2.5:14b';
const NEMARK_GATEWAY_HOSTS = new Set(['api.nemarkchat.com']);

const trimSlash = (value: string) => value.replace(/\/+$/, '');

const normalizeOllamaRoot = (value: string) => {
    const normalized = trimSlash(value.trim() || DEFAULT_OLLAMA_BASE_URL);
    return normalized.endsWith('/v1') ? normalized.slice(0, -3) : normalized;
};

const parseProvider = (value: string, hasOpenAIKey: boolean): AIProviderName => {
    if (value === 'openai') return 'openai';
    if (value === 'ollama') return 'ollama';
    return hasOpenAIKey ? 'openai' : 'ollama';
};

const getProviderConfig = async (): Promise<AIProviderConfig> => {
    const settings = await settingsService.getAll();
    const openAIKey = settings[SETTINGS_KEYS.AI_OPENAI_API_KEY]
        || process.env.OPENAI_API_KEY
        || process.env.NEMARK_AI_API_KEY
        || process.env.AI_API_KEY
        || '';
    const openAIBaseUrl = trimSlash(
        process.env.OPENAI_BASE_URL
        || process.env.NEMARK_AI_API_URL
        || process.env.AI_API_URL
        || DEFAULT_OPENAI_BASE_URL
    );
    const openAIModel = settings[SETTINGS_KEYS.AI_OPENAI_MODEL]
        || process.env.OPENAI_MODEL
        || process.env.NEMARK_AI_MODEL
        || process.env.AI_MODEL
        || getAIModel();
    const provider = parseProvider(
        settings[SETTINGS_KEYS.AI_PROVIDER] || process.env.AI_PROVIDER || 'auto',
        Boolean(openAIKey)
    );

    if (provider === 'openai') {
        return {
            provider,
            baseUrl: openAIBaseUrl,
            apiKey: openAIKey,
            model: openAIModel,
        };
    }

    return {
        provider,
        baseUrl: normalizeOllamaRoot(
            settings[SETTINGS_KEYS.AI_OLLAMA_BASE_URL]
                || process.env.OLLAMA_BASE_URL
                || DEFAULT_OLLAMA_BASE_URL
        ),
        apiKey: await settingsService.getSecret(
            SETTINGS_KEYS.AI_OLLAMA_API_KEY,
            process.env.OLLAMA_API_KEY || ''
        ),
        model: settings[SETTINGS_KEYS.AI_OLLAMA_MODEL]
            || process.env.OLLAMA_MODEL
            || DEFAULT_OLLAMA_MODEL,
    };
};

const asProviderError = (error: unknown, provider: AIProviderName): AppError => {
    if (error instanceof AppError) return error;

    if (axios.isAxiosError(error)) {
        const upstreamStatus = error.response?.status;
        const upstreamMessage = error.response?.data?.error?.message
            || error.response?.data?.error
            || error.response?.data?.message
            || error.message;

        if (upstreamStatus === 401 || upstreamStatus === 403) {
            return new AppError('AI provider rejected the API key', 503, 'AI_AUTH_FAILED');
        }
        if (upstreamStatus === 404) {
            return new AppError(`AI model is unavailable: ${String(upstreamMessage)}`, 503, 'AI_MODEL_UNAVAILABLE');
        }
        if (error.code === 'ECONNREFUSED') {
            return new AppError(`${provider} service is not running`, 503, 'AI_PROVIDER_OFFLINE');
        }
        return new AppError(`AI upstream failed: ${String(upstreamMessage)}`, 502, 'AI_UPSTREAM_ERROR');
    }

    const message = error instanceof Error ? error.message : 'Unknown AI provider error';
    return new AppError(message, 502, 'AI_UPSTREAM_ERROR');
};

const createProviderCompletion = async (
    input: AICompletionInput,
    timeoutMs = 60_000
): Promise<AICompletionResponse> => {
    const config = await getProviderConfig();
    const model = input.model || config.model;

    if (config.provider === 'openai') {
        if (!config.apiKey) {
            throw new AppError('OPENAI_API_KEY is not configured', 503, 'AI_NOT_CONFIGURED');
        }

        try {
            const payload: Record<string, unknown> = {
                // Public workspaces use a stable Nemark model alias. The gateway
                // resolves that alias to the provider model configured by admins.
                model,
                messages: input.messages,
                max_completion_tokens: input.max_completion_tokens || input.max_tokens || 500,
                stream: false,
            };
            const response = await axios.post(
                `${config.baseUrl}/chat/completions`,
                payload,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${config.apiKey}`,
                    },
                    timeout: timeoutMs,
                }
            );

            return {
                ...response.data,
                model: response.data?.model || model,
                choices: response.data?.choices || [],
                provider: config.provider,
            };
        } catch (error) {
            throw asProviderError(error, config.provider);
        }
    }

    try {
        const response = await axios.post(
            `${config.baseUrl}/v1/chat/completions`,
            {
                model,
                messages: input.messages,
                max_tokens: input.max_tokens || input.max_completion_tokens || 500,
                temperature: input.temperature ?? 0.2,
                top_p: input.top_p ?? 0.9,
                stream: false,
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
                },
                timeout: timeoutMs,
            }
        );

        return {
            ...response.data,
            model: response.data?.model || model,
            choices: response.data?.choices || [],
            provider: config.provider,
        };
    } catch (error) {
        throw asProviderError(error, config.provider);
    }
};

export const isNemarkAIGateway = (baseUrl: string) => {
    try {
        const parsed = new URL(baseUrl);
        if (NEMARK_GATEWAY_HOSTS.has(parsed.hostname)) return true;
        return ['127.0.0.1', 'localhost'].includes(parsed.hostname)
            && parsed.pathname.replace(/\/+$/, '') === '/v1';
    } catch {
        return false;
    }
};

const getProviderModels = async (config: AIProviderConfig): Promise<Array<{ id: string; owned_by: string }>> => {
    if (config.provider === 'openai') {
        if (!config.apiKey) return [{ id: config.model, owned_by: 'openai' }];
        try {
            const response = await axios.get(`${config.baseUrl}/models`, {
                headers: { Authorization: `Bearer ${config.apiKey}` },
                timeout: 10_000,
            });
            return (response.data?.data || []).map((item: { id: string; owned_by?: string }) => ({
                id: item.id,
                owned_by: item.owned_by || 'openai',
            }));
        } catch (error) {
            throw asProviderError(error, config.provider);
        }
    }

    try {
        const response = await axios.get(`${config.baseUrl}/api/tags`, {
            headers: config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : undefined,
            timeout: 10_000,
        });
        return (response.data?.models || []).map((item: { name: string }) => ({
            id: item.name,
            owned_by: 'ollama',
        }));
    } catch (error) {
        throw asProviderError(error, config.provider);
    }
};

export const aiService = {
    async complete(input: AICompletionInput, timeoutMs?: number) {
        if (!Array.isArray(input.messages) || input.messages.length === 0) {
            throw new AppError('messages must contain at least one item', 400, 'AI_INVALID_REQUEST');
        }
        return createProviderCompletion(input, timeoutMs);
    },

    async completeRuntime(target: RuntimeTarget, input: AICompletionInput) {
        if (isNemarkAIGateway(target.baseUrl)) {
            return createProviderCompletion(input, target.timeoutMs);
        }

        try {
            const response = await axios.post(
                `${trimSlash(target.baseUrl)}/chat/completions`,
                { ...input, stream: false },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        ...(target.apiKey ? { Authorization: `Bearer ${target.apiKey}` } : {}),
                    },
                    timeout: target.timeoutMs || 60_000,
                }
            );
            return {
                ...response.data,
                model: response.data?.model || input.model || 'custom',
                choices: response.data?.choices || [],
                provider: 'openai' as const,
            };
        } catch (error) {
            throw asProviderError(error, 'openai');
        }
    },

    async listModels() {
        const config = await getProviderConfig();
        return getProviderModels(config);
    },

    async status(): Promise<AIProviderStatus> {
        const startedAt = Date.now();
        const config = await getProviderConfig();

        try {
            const models = await getProviderModels(config);
            const modelIds = models.map((item: { id: string }) => item.id);
            const modelAvailable = config.provider === 'openai'
                ? Boolean(config.apiKey)
                : modelIds.some((id: string) => id === config.model || id.startsWith(`${config.model}:`));

            return {
                status: modelAvailable ? 'online' : 'degraded',
                provider: config.provider,
                model: config.model,
                baseUrl: config.baseUrl,
                modelAvailable,
                latencyMs: Date.now() - startedAt,
                models: modelIds,
                ...(!modelAvailable ? { message: `Configured model ${config.model} is not available` } : {}),
            };
        } catch (error) {
            const appError = asProviderError(error, config.provider);
            return {
                status: 'offline',
                provider: config.provider,
                model: config.model,
                baseUrl: config.baseUrl,
                modelAvailable: false,
                latencyMs: Date.now() - startedAt,
                models: [],
                message: appError.message,
            };
        }
    },

    async gatewayToken() {
        return settingsService.get(
            SETTINGS_KEYS.AI_GATEWAY_TOKEN,
            process.env.NEMARK_AI_GATEWAY_TOKEN || ''
        );
    },
};
