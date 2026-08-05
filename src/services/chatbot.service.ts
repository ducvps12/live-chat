import { httpClient } from '../lib/http/client';

export interface IAIPersonaConfig {
    version: 1;
    humanLikeMode: boolean;
    roleTitle: string;
    selfReference: string;
    customerReference: string;
    toneInstructions: string;
    sampleReplies: string;
    signaturePhrases: string[];
    forbiddenPhrases: string[];
    adaptToCustomerTone: boolean;
    emojiLevel: 'none' | 'light' | 'expressive';
    salesStyle: 'consultative' | 'balanced' | 'direct';
    identityStyle: 'role_first' | 'transparent';
    typingIndicator: boolean;
    typingLabel: string;
    responsePace: 'instant' | 'natural' | 'thoughtful';
    minDelayMs: number;
    maxDelayMs: number;
    intelligenceLevel: 'quick' | 'balanced' | 'advanced';
    replyGrouping: 'single' | 'smart_burst';
    maxReplyParts: number;
    interMessageDelayMs: number;
}

export interface IAIBotData {
    name: string;
    avatarUrl?: string;
    brandName: string;
    brandDescription?: string;
    mainTask: 'customer_care' | 'sales' | 'technical_support';
    conversationStyle: 'friendly' | 'professional' | 'casual';
    messageLength: 'short' | 'medium' | 'long';
    customGreeting?: string;
    welcomeMessage?: string;
    channels: {
        website: { enabled: boolean; filterIds?: string[] };
        messenger: { enabled: boolean; filterIds?: string[] };
        facebook: { enabled: boolean; filterIds?: string[] };
        zalo: { enabled: boolean; filterIds?: string[] };
        instagram: { enabled: boolean; filterIds?: string[] };
    };
    agentCondition: 'always' | 'no_agent_online' | 'at_least_one_online' | 'no_condition';
    scenarios: Array<{
        trigger: string;
        triggerType: 'keyword' | 'contains' | 'regex';
        response: string;
        action?: string;
        actionData?: any;
        priority: number;
    }>;
    quickReplies: Array<{ label: string; value: string; icon?: string }>;
    followUp: { enabled: boolean; delaySeconds: number; message: string };
    personaConfig: IAIPersonaConfig;
    isActive: boolean;
    isDraft: boolean;
    aiModel?: string;
}

export interface IAIRuntimeSettings {
    enabled: boolean;
    provider: 'openai-compatible' | 'local-vllm' | 'disabled';
    baseUrl: string;
    apiKey?: string;
    hasApiKey?: boolean;
    model: string;
    temperature: number;
    maxTokens: number;
    timeoutMs: number;
    updatedAt?: string;
}

export interface IAIReplyPreview {
    response: string;
    botId: string;
    botName: string;
    agentCondition: string;
    source?: 'scenario' | 'action' | 'ai' | 'knowledge' | 'greeting' | 'identity' | 'fallback';
    latencyMs?: number;
    deliveryDelayMs?: number;
    typingIndicator?: boolean;
    typingLabel?: string;
    responseParts?: string[];
    interMessageDelayMs?: number;
    preview?: boolean;
}

export const chatbotService = {
    list: async (workspaceId: string) => {
        const res = await httpClient.get(`/chatbots/workspace/${workspaceId}`);
        return res.data;
    },

    getOne: async (workspaceId: string, botId: string) => {
        const res = await httpClient.get(`/chatbots/workspace/${workspaceId}/${botId}`);
        return res.data;
    },

    create: async (workspaceId: string, data: Partial<IAIBotData>) => {
        const res = await httpClient.post(`/chatbots/workspace/${workspaceId}`, data);
        return res.data;
    },

    update: async (workspaceId: string, botId: string, data: Partial<IAIBotData>) => {
        const res = await httpClient.put(`/chatbots/workspace/${workspaceId}/${botId}`, data);
        return res.data;
    },

    remove: async (workspaceId: string, botId: string) => {
        const res = await httpClient.delete(`/chatbots/workspace/${workspaceId}/${botId}`);
        return res.data;
    },

    toggleActive: async (workspaceId: string, botId: string, isActive: boolean) => {
        const res = await httpClient.patch(`/chatbots/workspace/${workspaceId}/${botId}/toggle`, { isActive });
        return res.data;
    },

    getStats: async (workspaceId: string) => {
        const res = await httpClient.get(`/chatbots/workspace/${workspaceId}/stats`);
        return res.data;
    },

    previewReply: async (
        workspaceId: string,
        payload: { message: string; channel: string; botId?: string; context?: string },
    ) => {
        const res = await httpClient.post(`/chatbots/workspace/${workspaceId}/preview`, payload, {
            timeout: 120_000,
        });
        return res.data;
    },

    listModels: async () => {
        const res = await httpClient.get('/chatbots/ai/models');
        return res.data;
    },

    listTemplates: async () => {
        const res = await httpClient.get('/chatbots/templates');
        return res.data;
    },

    applyTemplate: async (workspaceId: string, templateKey: string, payload: Record<string, unknown>) => {
        const res = await httpClient.post(`/chatbots/workspace/${workspaceId}/templates/${templateKey}/apply`, payload);
        return res.data;
    },

    previewShopeeAffiliate: async (workspaceId: string, payload: Record<string, unknown>) => {
        const res = await httpClient.post(`/chatbots/workspace/${workspaceId}/actions/shopee-affiliate/preview`, payload);
        return res.data;
    },

    getAIRuntime: async (workspaceId: string) => {
        const res = await httpClient.get(`/workspaces/${workspaceId}/ai-runtime`);
        return res.data;
    },

    updateAIRuntime: async (workspaceId: string, payload: Partial<IAIRuntimeSettings> & { clearApiKey?: boolean }) => {
        const res = await httpClient.patch(`/workspaces/${workspaceId}/ai-runtime`, payload);
        return res.data;
    },

    testAIRuntime: async (workspaceId: string, payload: Partial<IAIRuntimeSettings>) => {
        const res = await httpClient.post(`/workspaces/${workspaceId}/ai-runtime/test`, payload, {
            timeout: 120_000,
        });
        return res.data;
    },

    getAIQuota: async (workspaceId: string) => {
        const res = await httpClient.get(`/workspaces/${workspaceId}/subscription/ai-quota`);
        return res.data;
    },
};
