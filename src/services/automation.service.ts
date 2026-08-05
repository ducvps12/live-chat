import { httpClient } from '../lib/http/client';

export type AutomationWorkflow = { id: string; name: string; isActive: boolean; triggerType: string; actionType: string; approvalMode: string; updatedAt: string };
export type AutomationRun = { id: string; workflowId: string; conversationId?: string | null; actionType: string; status: string; summary: string; output?: Record<string, unknown>; createdAt: string };

export const automationService = {
    async list(workspaceId: string) { const res = await httpClient.get(`/automation/workspaces/${workspaceId}`); return (res.data?.data || []) as AutomationWorkflow[]; },
    async listRuns(workspaceId: string) { const res = await httpClient.get(`/automation/workspaces/${workspaceId}/runs`); return (res.data?.data || []) as AutomationRun[]; },
    async create(workspaceId: string, payload: Pick<AutomationWorkflow, 'name' | 'triggerType' | 'actionType' | 'approvalMode'>) { const res = await httpClient.post(`/automation/workspaces/${workspaceId}`, payload); return res.data?.data as AutomationWorkflow; },
    async setActive(workspaceId: string, id: string, isActive: boolean) { const res = await httpClient.patch(`/automation/workspaces/${workspaceId}/${id}`, { isActive }); return res.data?.data as AutomationWorkflow; },
};
