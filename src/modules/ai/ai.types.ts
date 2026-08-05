export type AIProviderName = 'openai' | 'ollama';

export type AIChatMessage = {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
};

export type AICompletionInput = {
    model?: string;
    messages: AIChatMessage[];
    max_tokens?: number;
    max_completion_tokens?: number;
    temperature?: number;
    top_p?: number;
    stream?: boolean;
};

export type AICompletionResponse = {
    id?: string;
    object?: string;
    created?: number;
    model: string;
    choices: Array<{
        index?: number;
        message?: {
            role?: string;
            content?: string;
        };
        finish_reason?: string;
    }>;
    usage?: Record<string, number>;
    provider: AIProviderName;
};

export type AIProviderStatus = {
    status: 'online' | 'degraded' | 'offline';
    provider: AIProviderName;
    model: string;
    baseUrl: string;
    modelAvailable: boolean;
    latencyMs: number;
    models: string[];
    message?: string;
};
