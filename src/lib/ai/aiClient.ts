/**
 * Shared AI client for OpenAI-compatible APIs.
 *
 * Targets any provider that speaks the OpenAI API spec:
 *  - OpenAI (api.openai.com/v1)
 *  - OpenRouter (openrouter.ai/api/v1)
 *  - Google Gemini (generativelanguage.googleapis.com/v1beta/openai)
 *  - DeepSeek (api.deepseek.com/v1)
 *  - 9Router / CLIProxyAPI (localhost:8317/v1) — including OpenCode Free
 *  - Self-hosted Ollama / vLLM / LM Studio
 *
 * Configuration is centralized in src/config/env.ts (AI_API_URL, AI_API_KEY,
 * AI_MODEL). When AI_API_KEY is empty, the Authorization header is omitted —
 * required for no-auth providers like 9Router OpenCode Free.
 */

import axios, { AxiosError } from 'axios';
import { env } from '../../config/env';

export interface ChatMessage {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
}

export interface ChatCompletionParams {
    /** Override the default model (env.AI_MODEL). */
    model?: string;
    messages: ChatMessage[];
    /** Sampling temperature 0–2. Default 0.7. */
    temperature?: number;
    top_p?: number;
    max_tokens?: number;
    /** Per-request timeout in milliseconds. Falls back to env.AI_REQUEST_TIMEOUT_MS. */
    timeoutMs?: number;
    /** Free-form caller tag used in logs only. */
    label?: string;
}

export interface AIModel {
    id: string;
    name?: string;
    owned_by?: string;
}

function buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (env.AI_API_KEY) headers['Authorization'] = `Bearer ${env.AI_API_KEY}`;
    return headers;
}

function logError(label: string, err: unknown): void {
    const ax = err as AxiosError<any>;
    const status = ax?.response?.status;
    const data = ax?.response?.data;
    const msg = (err as Error)?.message;
    console.error(`[AI:${label}] failed`, { status, data, msg });
}

/** Build the model fallback chain: primary first, then comma-separated fallbacks. */
function modelChain(primary?: string): string[] {
    const main = primary || env.AI_MODEL;
    const extras = (env.AI_MODEL_FALLBACK || '')
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s && s !== main);
    return [main, ...extras];
}

/**
 * Extract assistant text from a chat-completion response.
 * Some providers return reasoning models that put the reply in `reasoning_content`
 * (with empty `content`) when max_tokens is hit. We treat that case as "no usable
 * reply" so the caller can fall back to the next model in the chain.
 */
function extractReply(data: any): string | null {
    const choice = data?.choices?.[0];
    const msg = choice?.message;
    const content = typeof msg?.content === 'string' ? msg.content.trim() : '';
    if (content) return content;
    return null;
}

export const aiClient = {
    /** Active provider URL — handy for debugging / health checks. */
    get baseUrl(): string {
        return env.AI_API_URL;
    },

    /** Default model id from env. */
    get defaultModel(): string {
        return env.AI_MODEL;
    },

    /**
     * Call /chat/completions and return the assistant's reply text.
     * Returns null on failure (callers can fall back gracefully).
     *
     * Walks env.AI_MODEL_FALLBACK on retryable errors (429, 5xx, empty content).
     */
    async chat(params: ChatCompletionParams): Promise<string | null> {
        const label = params.label || 'chat';
        const chain = modelChain(params.model);
        for (let i = 0; i < chain.length; i++) {
            const model = chain[i];
            try {
                const res = await axios.post(
                    `${env.AI_API_URL}/chat/completions`,
                    {
                        model,
                        messages: params.messages,
                        max_tokens: params.max_tokens ?? 500,
                        temperature: params.temperature ?? 0.7,
                        top_p: params.top_p ?? 0.9,
                    },
                    {
                        headers: buildHeaders(),
                        timeout: params.timeoutMs ?? env.AI_REQUEST_TIMEOUT_MS,
                    }
                );
                const reply = extractReply(res.data);
                if (reply) return reply;
                console.warn(`[AI:${label}] empty content from ${model}, trying next in chain`);
            } catch (err) {
                const status = (err as AxiosError)?.response?.status;
                logError(`${label}:${model}`, err);
                // Don't retry on auth/permission errors — they affect every model.
                if (status === 401 || status === 403) return null;
            }
        }
        return null;
    },

    /**
     * Same as chat() but returns the full raw response of the FIRST model.
     * Use when you need usage/finish_reason metadata. No fallback chain.
     */
    async chatRaw(params: ChatCompletionParams): Promise<any | null> {
        const model = params.model || env.AI_MODEL;
        const label = params.label || 'chatRaw';
        try {
            const res = await axios.post(
                `${env.AI_API_URL}/chat/completions`,
                {
                    model,
                    messages: params.messages,
                    max_tokens: params.max_tokens ?? 500,
                    temperature: params.temperature ?? 0.7,
                    top_p: params.top_p ?? 0.9,
                },
                {
                    headers: buildHeaders(),
                    timeout: params.timeoutMs ?? env.AI_REQUEST_TIMEOUT_MS,
                }
            );
            return res.data;
        } catch (err) {
            logError(label, err);
            return null;
        }
    },

    /**
     * Probe /models endpoint. Returns the model list and round-trip latency.
     * Used by the admin AI health check.
     */
    async listModels(timeoutMs = 10_000): Promise<{ status: 'online' | 'offline'; models: AIModel[]; latencyMs: number; error?: string }> {
        const start = Date.now();
        try {
            const res = await axios.get(`${env.AI_API_URL}/models`, {
                headers: buildHeaders(),
                timeout: timeoutMs,
            });
            const models: AIModel[] = (res.data?.data || []).map((m: any) => ({
                id: m.id,
                name: m.id,
                owned_by: m.owned_by || 'custom',
            }));
            return { status: 'online', models, latencyMs: Date.now() - start };
        } catch (err) {
            logError('listModels', err);
            const msg = (err as AxiosError)?.message || 'unknown';
            return { status: 'offline', models: [], latencyMs: -1, error: msg };
        }
    },
};
