import { httpClient } from '../lib/http/client';

export type SignalSnapshot = {
    id: string;
    title: string;
    excerpt?: string | null;
    diffSummary?: string | null;
    changed: boolean;
    httpStatus?: number | null;
    createdAt: string;
};

export type SignalMonitor = {
    id: string;
    name: string;
    url: string;
    intervalMinutes: number;
    isActive: boolean;
    status: 'pending' | 'healthy' | 'changed' | 'error' | 'paused';
    lastCheckedAt?: string | null;
    nextCheckAt?: string | null;
    lastChangedAt?: string | null;
    lastHttpStatus?: number | null;
    lastError?: string | null;
    notifyTelegram: boolean;
    snapshots: SignalSnapshot[];
};

export type SignalRadarEntitlements = {
    planId: string;
    active: boolean;
    maxMonitors: number;
    minIntervalMinutes: number;
    snapshotRetention: number;
    periodEnd: string;
};

export type SignalAlertSetting = {
    telegramEnabled: boolean;
    telegramChatId: string;
    hasTelegramBotToken: boolean;
    notifyOnChange: boolean;
    notifyOnError: boolean;
};

export type SignalAlertUpdate = Omit<SignalAlertSetting, 'hasTelegramBotToken'> & {
    telegramBotToken?: string;
    clearTelegramBotToken?: boolean;
};

const base = (workspaceId: string) => `/radar/${workspaceId}`;

export const signalRadarAPI = {
    async list(workspaceId: string) {
        const response = await httpClient.get(`${base(workspaceId)}/monitors`);
        return response.data.data as SignalMonitor[];
    },
    async entitlements(workspaceId: string) {
        const response = await httpClient.get(`${base(workspaceId)}/entitlements`);
        return response.data.data as SignalRadarEntitlements;
    },
    async create(workspaceId: string, input: { name: string; url: string; intervalMinutes: number }) {
        const response = await httpClient.post(`${base(workspaceId)}/monitors`, input);
        return response.data.data as SignalMonitor;
    },
    async update(workspaceId: string, monitorId: string, input: Partial<Pick<SignalMonitor, 'name' | 'url' | 'intervalMinutes' | 'isActive' | 'notifyTelegram'>>) {
        const response = await httpClient.patch(`${base(workspaceId)}/monitors/${monitorId}`, input);
        return response.data.data as SignalMonitor;
    },
    async remove(workspaceId: string, monitorId: string) {
        await httpClient.delete(`${base(workspaceId)}/monitors/${monitorId}`);
    },
    async check(workspaceId: string, monitorId: string) {
        const response = await httpClient.post(`${base(workspaceId)}/monitors/${monitorId}/check`);
        return response.data.data as { changed: boolean; summary: string; checkedAt: string; status?: string; error?: string };
    },
    async getAlerts(workspaceId: string) {
        const response = await httpClient.get(`${base(workspaceId)}/alerts`);
        return response.data.data as SignalAlertSetting;
    },
    async saveAlerts(workspaceId: string, input: SignalAlertUpdate) {
        const response = await httpClient.put(`${base(workspaceId)}/alerts`, input);
        return response.data.data as SignalAlertSetting;
    },
    async testAlerts(workspaceId: string, input: { telegramBotToken?: string; telegramChatId: string }) {
        const response = await httpClient.post(`${base(workspaceId)}/alerts/test`, input);
        return response.data.data;
    },
};
