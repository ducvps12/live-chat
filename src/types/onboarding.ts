// Types for Onboarding State

import { Workspace, Membership, InviteResult } from './workspace';

// Step identifiers
export type OnboardingStep = 1 | 2 | 3 | 4 | 5;

// Widget configuration
export interface WidgetConfig {
  widgetId: string;
  siteKey: string;
  name: string;
  domains: string[];
  mainColor: string;
  position: 'br' | 'bl';
  welcomeMsg: string;
  embedCode: string;
}

// Inbox settings (stored locally until API available)
export interface InboxSettings {
  assignmentMode: 'auto' | 'manual';
  strategy: 'round-robin' | 'least-busy';
  onlineOnly: boolean;
  reassignOnOffline: boolean;
  workingHours: {
    type: 'business' | '24/7' | 'custom';
    start?: string;
    end?: string;
  };
  afterHoursMessage: string;
  notifications: {
    newConversation: boolean;
    assigned: boolean;
    sound: boolean;
  };
  reminderMinutes: number;
}

// Invite tracking
export interface InviteTracker {
  sent: string[];
  failed: { email: string; reason: string }[];
  already: string[];
}

// Main onboarding state
export interface OnboardingState {
  step: OnboardingStep;
  workspace: {
    workspaceId: string;
    workspaceKey: number;
    name: string;
  } | null;
  invites: InviteTracker;
  widget: WidgetConfig | null;
  inboxSettings: InboxSettings | null;
}

// Default inbox settings
export const DEFAULT_INBOX_SETTINGS: InboxSettings = {
  assignmentMode: 'auto',
  strategy: 'round-robin',
  onlineOnly: true,
  reassignOnOffline: true,
  workingHours: {
    type: 'business',
    start: '09:00',
    end: '18:00',
  },
  afterHoursMessage: 'Hiện tại chúng tôi đang ngoài giờ làm việc. Bạn để lại lời nhắn, chúng tôi sẽ phản hồi sớm nhất.',
  notifications: {
    newConversation: true,
    assigned: true,
    sound: true,
  },
  reminderMinutes: 2,
};

// Default onboarding state
export const DEFAULT_ONBOARDING_STATE: OnboardingState = {
  step: 1,
  workspace: null,
  invites: { sent: [], failed: [], already: [] },
  widget: null,
  inboxSettings: null,
};

// Role options for invite
export const ROLE_OPTIONS = [
  { value: 'Admin', label: 'Admin — Toàn quyền quản lý workspace' },
  { value: 'Manager', label: 'Manager — Quản lý hội thoại và phân công' },
  { value: 'Agent', label: 'User/Agent — Xử lý hội thoại được giao' },
] as const;
