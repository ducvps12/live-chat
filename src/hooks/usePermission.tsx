/**
 * usePermission Hook
 * Check user permissions for role-based UI visibility
 */
import { useMemo } from 'react';
import { useMyStore } from '@/contexts/MyStoreContext';

// Role hierarchy - higher number = more permissions
const ROLE_HIERARCHY: Record<string, number> = {
    'Owner': 100,
    'Admin': 80,
    'Agent': 50,
    'Viewer': 10,
};

// Permission sets by role
const ROLE_PERMISSIONS: Record<string, string[]> = {
    Owner: [
        'workspace.manage',
        'member.invite', 'member.read', 'member.remove',
        'role.manage', 'role.read', 'permission.read',
        'widget.manage', 'widget.read',
        'conversation.read', 'conversation.reply', 'conversation.assign', 'conversation.close', 'conversation.note', 'conversation.tag',
        'contact.read', 'contact.create', 'contact.update', 'contact.merge',
        'report.view', 'report.export',
        'audit.read',
        'integration.manage',
        'billing.view', 'billing.manage',
    ],
    Admin: [
        'member.invite', 'member.read', 'member.remove',
        'role.read', 'permission.read',
        'widget.manage', 'widget.read',
        'conversation.read', 'conversation.reply', 'conversation.assign', 'conversation.close', 'conversation.note', 'conversation.tag',
        'contact.read', 'contact.create', 'contact.update',
        'report.view', 'report.export',
        'audit.read',
    ],
    Agent: [
        'conversation.read', 'conversation.reply', 'conversation.close', 'conversation.note', 'conversation.tag',
        'contact.read', 'contact.create',
        'widget.read',
    ],
    Viewer: [
        'conversation.read',
        'contact.read',
    ],
};

export interface PermissionContext {
    role: string;
    roleLevel: number;
    permissions: string[];
    hasPermission: (permission: string) => boolean;
    hasRole: (role: string) => boolean;
    isAtLeast: (role: string) => boolean;
    isOwner: boolean;
    isAdmin: boolean;
    isAgent: boolean;
    canManageWorkspace: boolean;
    canManageMembers: boolean;
    canManageWidgets: boolean;
    canViewReports: boolean;
}

export function usePermission(): PermissionContext {
    const { activeWorkspace } = useMyStore();

    const role = activeWorkspace?.membership?.role || 'Viewer';
    const roleLevel = ROLE_HIERARCHY[role] || 0;
    const permissions = ROLE_PERMISSIONS[role] || [];

    const context = useMemo<PermissionContext>(() => ({
        role,
        roleLevel,
        permissions,

        hasPermission: (permission: string) => permissions.includes(permission),

        hasRole: (checkRole: string) => role === checkRole,

        isAtLeast: (checkRole: string) => {
            const checkLevel = ROLE_HIERARCHY[checkRole] || 0;
            return roleLevel >= checkLevel;
        },

        isOwner: role === 'Owner',
        isAdmin: roleLevel >= ROLE_HIERARCHY['Admin'],
        isAgent: roleLevel >= ROLE_HIERARCHY['Agent'],

        // Convenience checks
        canManageWorkspace: permissions.includes('workspace.manage'),
        canManageMembers: permissions.includes('member.invite'),
        canManageWidgets: permissions.includes('widget.manage'),
        canViewReports: permissions.includes('report.view'),
    }), [role, roleLevel, permissions]);

    return context;
}

/**
 * Higher-order component for permission-based rendering
 */
export function withPermission<P extends object>(
    WrappedComponent: React.ComponentType<P>,
    requiredPermission: string
): React.FC<P> {
    return function PermissionWrapper(props: P) {
        const { hasPermission } = usePermission();

        if (!hasPermission(requiredPermission)) {
            return null;
        }

        return <WrappedComponent {...props} />;
    };
}

/**
 * Component for conditional rendering based on permission
 */
export function IfPermission({
    permission,
    children,
    fallback = null
}: {
    permission: string;
    children: React.ReactNode;
    fallback?: React.ReactNode;
}) {
    const { hasPermission } = usePermission();
    return hasPermission(permission) ? <>{children}</> : <>{fallback}</>;
}

/**
 * Component for conditional rendering based on role level
 */
export function IfAtLeast({
    role,
    children,
    fallback = null
}: {
    role: string;
    children: React.ReactNode;
    fallback?: React.ReactNode;
}) {
    const { isAtLeast } = usePermission();
    return isAtLeast(role) ? <>{children}</> : <>{fallback}</>;
}
