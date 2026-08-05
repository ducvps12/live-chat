import { WidgetPosition } from './common';

// ── Pre-chat form field ──
export interface PreChatField {
    key: string;
    label: string;
    type: 'text' | 'email' | 'tel' | 'textarea' | 'select' | 'checkbox';
    required: boolean;
    enabled: boolean;
    placeholder?: string;
    options?: string[];
}

// ── Widget configuration ──
export interface WidgetConfig {
    primaryColor: string;
    gradient?: string;
    launcherStyle?: 'bubble' | 'tab' | 'pill' | 'image';
    launcherText?: string;
    launcherIcon?: string;
    tooltipText?: string;
    greeting: string;
    placeholder: string;
    position: WidgetPosition;
    language: string;
    avatarUrl?: string;
    showBranding: boolean;
    brandingMode?: 'nemark' | 'custom' | 'hidden';
    brandingName?: string;
    brandingUrl?: string;
    themePreset?: 'modern' | 'minimal' | 'glass' | 'compact';
    customCss?: string;
    offlineMessage: string;
    autoReply?: string;
    headerAvatar?: string;
    profileDisplay?: 'company' | 'agent';
    showTypingIndicator?: boolean;
    requestRating?: boolean;
    autoOpen?: {
        mode: 'none' | 'immediate' | '20s' | '5min' | 'custom';
        customSeconds?: number;
    };
    greetingPopup?: {
        enabled: boolean;
        message: string;
        ctaText: string;
        delay: number;
    };
    urlRules?: {
        domains: Array<{ type: 'include' | 'exclude'; value: string }>;
        paths: Array<{ type: 'include' | 'exclude'; value: string }>;
    };
    preChatForm: {
        enabled: boolean;
        title: string;
        fields: PreChatField[];
        marketingConsent?: {
            enabled: boolean;
            text: string;
        };
    };
}

// ── Widget (frontend-facing) ──
export interface Widget {
    _id: string;
    workspaceId: string;
    name: string;
    config: WidgetConfig;
    domainRules: {
        mode: 'allowlist' | 'blocklist';
        domains: string[];
    };
    isActive: boolean;
    createdAt: string;
    updatedAt?: string;
}
