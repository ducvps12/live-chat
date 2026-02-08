// Types for Workspace API

export interface Workspace {
  workspaceKey: number;
  workspaceId: string;
  name: string;
  status?: number;
  createdAt?: string;
  settings?: any;
}

export interface Membership {
  membershipKey: number;
  membershipId: string;
  role: string;
  status?: number;
}

export interface WorkspaceWithMembership extends Workspace {
  membership: Membership;
}

// Create Workspace
export interface CreateWorkspaceRequest {
  name: string;
}

export interface CreateWorkspaceResponse {
  workspace: Workspace;
  membership: Membership;
}

// List Workspaces
export interface ListWorkspacesResponse {
  workspaces: WorkspaceWithMembership[];
}

// Invite Member
export interface InviteMemberRequest {
  email: string;
  role: string;
  message?: string;
}

export interface InviteResult {
  inviteKey: number;
  inviteId: string;
  email: string;
  role: string;
  expiresAt: string;
  token?: string; // Only in dev
}

export interface PendingInvite {
  inviteKey: number;
  inviteId: string;
  email: string;
  role: string;
  invitedBy: string;
  expiresAt: string;
  createdAt: string;
}

// Member
export interface WorkspaceMember {
  membershipKey: number;
  membershipId: string;
  status: number;
  joinedAt: string;
  user: {
    userKey: number;
    userId: string;
    email: string;
    displayName: string;
  };
  roles: string[];
}
