export type ActionSeverity = 'critical' | 'warning' | 'info';

export interface ActionItem {
    id: string;
    severity: ActionSeverity;
    title: string;
    description: string;
    metadata?: {
        count?: number;
        timeRemaining?: string;
        affectedItems?: string[];
    };
    actions: ActionButton[];
    timestamp: string;
}

export interface ActionButton {
    label: string;
    icon?: string;
    variant: 'primary' | 'secondary' | 'ghost';
    action: string; // Action identifier: 'view-inbox' | 'assign-me' | 'notify-team' | 'escalate' | 'configure' | 'enable'
    href?: string;
}

export interface SmartActionCenterData {
    actions: ActionItem[];
    lastUpdated: string;
}
