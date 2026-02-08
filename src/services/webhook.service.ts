import axiosHttp from '@/lib/http';

export interface Webhook {
    webhookId: string;
    webhookKey: number;
    name: string;
    url: string;
    secret: string | null;
    events: string[];
    status: number;
    statusText: string;
    lastTriggeredAt: string | null;
    successCount: number;
    failCount: number;
    lastError: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface WebhookLog {
    eventType: string;
    status: number | null;
    responseTime: number | null;
    success: boolean;
    error: string | null;
    createdAt: string;
}

export interface WebhookEvent {
    key: string;
    value: string;
    label: string;
}

export interface CreateWebhookData {
    name: string;
    url: string;
    secret?: string;
    events: string[];
}

export interface UpdateWebhookData {
    name?: string;
    url?: string;
    events?: string[];
    status?: number;
}

export interface TestResult {
    success: boolean;
    status?: number;
    time?: number;
    error?: string;
}

const webhookService = {
    /**
     * Get all webhooks for current workspace
     */
    getWebhooks: async (): Promise<Webhook[]> => {
        const response = await axiosHttp.get('/webhooks');
        return response.data.webhooks;
    },

    /**
     * Get available event types
     */
    getEventTypes: async (): Promise<WebhookEvent[]> => {
        const response = await axiosHttp.get('/webhooks/events');
        return response.data.events;
    },

    /**
     * Create a new webhook
     */
    createWebhook: async (data: CreateWebhookData): Promise<Webhook> => {
        const response = await axiosHttp.post('/webhooks', data);
        return response.data.webhook;
    },

    /**
     * Update a webhook
     */
    updateWebhook: async (webhookId: string, data: UpdateWebhookData): Promise<Webhook> => {
        const response = await axiosHttp.patch(`/webhooks/${webhookId}`, data);
        return response.data.webhook;
    },

    /**
     * Delete a webhook
     */
    deleteWebhook: async (webhookId: string): Promise<void> => {
        await axiosHttp.delete(`/webhooks/${webhookId}`);
    },

    /**
     * Toggle webhook status (pause/resume)
     */
    toggleWebhook: async (webhookId: string): Promise<Webhook> => {
        const response = await axiosHttp.post(`/webhooks/${webhookId}/toggle`);
        return response.data.webhook;
    },

    /**
     * Test a webhook
     */
    testWebhook: async (webhookId: string): Promise<TestResult> => {
        const response = await axiosHttp.post(`/webhooks/${webhookId}/test`);
        return response.data.result;
    },

    /**
     * Get webhook logs
     */
    getWebhookLogs: async (webhookId: string, limit = 50, offset = 0): Promise<WebhookLog[]> => {
        const response = await axiosHttp.get(`/webhooks/${webhookId}/logs`, {
            params: { limit, offset }
        });
        return response.data.logs;
    },

    /**
     * Reveal webhook secret
     */
    revealSecret: async (webhookId: string): Promise<string> => {
        const response = await axiosHttp.get(`/webhooks/${webhookId}/secret`);
        return response.data.secret;
    }
};

export default webhookService;
