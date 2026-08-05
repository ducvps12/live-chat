import { httpClient } from '../lib/http/client';

export type PublicAIKey = {
    id: string;
    name: string;
    prefix: string;
    scopes: string[];
    isActive: boolean;
    createdAt: string;
    lastUsedAt?: string | null;
    expiresAt?: string | null;
    revokedAt?: string | null;
};

export type PublicAIProject = {
    id: string;
    name: string;
    isActive: boolean;
    monthlyRequestLimit: number;
    rateLimitPerMinute: number;
    concurrencyLimit: number;
    allowedModels: string[];
    createdAt: string;
    keys: PublicAIKey[];
};

export type PublicAIUsage = {
    periodKey: string;
    requests: number;
    limit: number;
    inputChars: number;
    outputChars: number;
};

export type PublicAIEntitlement = {
    planId: string;
    active: boolean;
    maxProjects: number;
    monthlyRequestLimit: number;
    rateLimitPerMinute: number;
    concurrencyLimit: number;
    periodEnd: string;
};

export const publicAIAPIService = {
    async listProjects(workspaceId: string) {
        const response = await httpClient.get(`/ai-api/${workspaceId}/projects`);
        return (response.data?.data || []) as PublicAIProject[];
    },
    async createProject(workspaceId: string, payload: { name: string; allowedModels: string[] }) {
        const response = await httpClient.post(`/ai-api/${workspaceId}/projects`, payload);
        return response.data?.data as PublicAIProject;
    },
    async issueKey(workspaceId: string, projectId: string, payload: { name: string; expiresAt?: string }) {
        const response = await httpClient.post(`/ai-api/${workspaceId}/projects/${projectId}/keys`, payload);
        return response.data?.data as { key: PublicAIKey; secret: string };
    },
    async revokeKey(workspaceId: string, projectId: string, keyId: string) {
        await httpClient.delete(`/ai-api/${workspaceId}/projects/${projectId}/keys/${keyId}`);
    },
    async getUsage(workspaceId: string, projectId: string) {
        const response = await httpClient.get(`/ai-api/${workspaceId}/projects/${projectId}/usage`);
        return response.data?.data as PublicAIUsage;
    },
    async getEntitlement(workspaceId: string) {
        const response = await httpClient.get(`/workspaces/${workspaceId}/subscription/public-api-entitlements`);
        return response.data?.data as PublicAIEntitlement;
    },
};
