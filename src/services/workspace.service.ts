import api from '@/lib/http';
import { ApiResponse } from '@/types/api';
import {
  Workspace,
  CreateWorkspaceRequest,
  CreateWorkspaceResponse,
  ListWorkspacesResponse,
  InviteMemberRequest,
  InviteResult,
  PendingInvite,
  WorkspaceMember,
  WorkspaceWithMembership,
} from '@/types/workspace';

export const WorkspaceService = {
  /**
   * Create a new workspace
   * POST /api/workspaces
   */
  create: async (data: CreateWorkspaceRequest) => {
    const response = await api.post<ApiResponse<CreateWorkspaceResponse>>(
      '/workspaces',
      data
    );
    return response.data.data;
  },

  /**
   * List workspaces for current user
   * GET /api/workspaces
   */
  list: async () => {
    const response = await api.get<ApiResponse<ListWorkspacesResponse>>(
      '/workspaces'
    );
    return response.data.data.workspaces;
  },

  /**
   * Invite a member to workspace
   * POST /api/workspaces/{workspaceId}/invites
   */
  inviteMember: async (workspaceId: string, data: InviteMemberRequest) => {
    const response = await api.post<ApiResponse<InviteResult>>(
      `/workspaces/${workspaceId}/invites`,
      data
    );
    return response.data.data;
  },

  /**
   * List pending invites for workspace
   * GET /api/workspaces/{workspaceId}/invites
   */
  listInvites: async (workspaceId: string) => {
    const response = await api.get<ApiResponse<{ invites: PendingInvite[] }>>(
      `/workspaces/${workspaceId}/invites`
    );
    return response.data.data.invites;
  },

  /**
   * Revoke an invite
   * DELETE /api/workspaces/{workspaceId}/invites/{inviteKey}
   */
  revokeInvite: async (workspaceId: string, inviteKey: number) => {
    const response = await api.delete<ApiResponse<{ success: boolean }>>(
      `/workspaces/${workspaceId}/invites/${inviteKey}`
    );
    return response.data.data;
  },

  /**
   * Resend an invite email
   * POST /api/workspaces/{workspaceId}/invites/{inviteKey}/resend
   */
  resendInvite: async (workspaceId: string, inviteKey: number) => {
    const response = await api.post<ApiResponse<{ success: boolean; email: string; expiresAt: string }>>(
      `/workspaces/${workspaceId}/invites/${inviteKey}/resend`
    );
    return response.data.data;
  },

  /**
   * List workspace members
   * GET /api/workspaces/{workspaceId}/members
   */
  listMembers: async (workspaceId: string) => {
    const response = await api.get<ApiResponse<{ members: WorkspaceMember[] }>>(
      `/workspaces/${workspaceId}/members`
    );
    return response.data.data.members;
  },

  /**
   * Remove a member from workspace
   * DELETE /api/workspaces/{workspaceId}/members/{membershipKey}
   */
  removeMember: async (workspaceId: string, membershipKey: number) => {
    const response = await api.delete<ApiResponse<{ success: boolean }>>(
      `/workspaces/${workspaceId}/members/${membershipKey}`
    );
    return response.data.data;
  },

  /**
   * Assign role to a member
   * PATCH /api/workspaces/{workspaceId}/members/{membershipKey}/role
   */
  assignRole: async (workspaceId: string, membershipKey: number, role: string) => {
    const response = await api.patch<ApiResponse<{ success: boolean }>>(
      `/workspaces/${workspaceId}/members/${membershipKey}/role`,
      { role }
    );
    return response.data.data;
  },

  /**
   * Accept an invite
   * POST /api/workspaces/invites/accept
   */
  acceptInvite: async (token: string) => {
    const response = await api.post<ApiResponse<{
      membershipKey: number;
      membershipId: string;
      workspaceKey: number;
      workspaceId: string;
      workspaceName: string;
      role: string;
    }>>('/workspaces/invites/accept', { token });
    return response.data.data;
  },

  /**
   * Update workspace settings
   * PATCH /api/workspaces/{workspaceId}
   */
  update: async (workspaceId: string, data: { name?: string; settings?: any }) => {
    const response = await api.patch<ApiResponse<{ workspace: Workspace }>>(
      `/workspaces/${workspaceId}`,
      data
    );
    return response.data.data.workspace;
  },

  /**
   * Get workspace details
   * GET /api/workspaces/{workspaceId}
   */
  getDetails: async (workspaceId: string) => {
    const response = await api.get<ApiResponse<WorkspaceWithMembership>>(
      `/workspaces/${workspaceId}`
    );
    return response.data.data;
  },
};
