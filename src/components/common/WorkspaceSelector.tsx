/**
 * Workspace Selector Component
 * Dropdown để chuyển đổi giữa các workspaces
 */
import { useState, useEffect, useCallback } from 'react';
import { useMyStore } from '@/contexts/MyStoreContext';
import { WorkspaceService } from '@/services/workspace.service';
import { getWorkspaceStats, WorkspaceStats } from '@/services/conversation.service';

interface WorkspaceOption {
    workspaceKey: number;
    workspaceId: string;
    name: string;
    membership: {
        membershipKey: number;
        membershipId: string;
        role: string;
    };
}

interface WorkspaceSelectorProps {
    className?: string;
    showStats?: boolean;
}

export default function WorkspaceSelector({ className = '', showStats = true }: WorkspaceSelectorProps) {
    const { activeWorkspace, setActiveWorkspace } = useMyStore();
    const [workspaces, setWorkspaces] = useState<WorkspaceOption[]>([]);
    const [stats, setStats] = useState<WorkspaceStats | null>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // Load workspaces list
    useEffect(() => {
        const loadWorkspaces = async () => {
            try {
                const list = await WorkspaceService.list();
                setWorkspaces(list.map(w => ({
                    workspaceKey: w.workspaceKey,
                    workspaceId: w.workspaceId,
                    name: w.name,
                    membership: {
                        membershipKey: (w as any).membership?.membershipKey || 0,
                        membershipId: (w as any).membership?.membershipId || '',
                        role: (w as any).membership?.role || 'User',
                    }
                })));
            } catch (error) {
                console.error('Failed to load workspaces:', error);
            } finally {
                setIsLoading(false);
            }
        };
        loadWorkspaces();
    }, []);

    // Load stats for active workspace
    useEffect(() => {
        if (!activeWorkspace?.workspaceId || !showStats) return;

        const loadStats = async () => {
            try {
                const workspaceStats = await getWorkspaceStats(activeWorkspace.workspaceId);
                setStats(workspaceStats);
            } catch (error) {
                console.error('Failed to load workspace stats:', error);
            }
        };
        loadStats();
    }, [activeWorkspace?.workspaceId, showStats]);

    // Handle workspace switch
    const handleSwitch = useCallback((workspace: WorkspaceOption) => {
        setActiveWorkspace({
            workspaceKey: workspace.workspaceKey,
            workspaceId: workspace.workspaceId,
            name: workspace.name,
            membership: workspace.membership,
        });
        setIsOpen(false);
    }, [setActiveWorkspace]);

    if (isLoading) {
        return (
            <div className={`flex items-center gap-2 px-3 py-2 ${className}`}>
                <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
                <span className="text-sm text-gray-500">Loading...</span>
            </div>
        );
    }

    return (
        <div className={`relative ${className}`}>
            {/* Trigger Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors min-w-[200px]"
            >
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-semibold text-sm">
                    {activeWorkspace?.name?.charAt(0)?.toUpperCase() || 'W'}
                </div>
                <div className="flex-1 text-left">
                    <div className="font-medium text-gray-900 text-sm truncate max-w-[120px]">
                        {activeWorkspace?.name || 'Select Workspace'}
                    </div>
                    {showStats && stats && (
                        <div className="text-xs text-gray-500">
                            {stats.totalUnreadMessages > 0 && (
                                <span className="text-red-500 font-medium">{stats.totalUnreadMessages} unread</span>
                            )}
                            {stats.totalUnreadMessages === 0 && (
                                <span>{stats.activeConversations} conversations</span>
                            )}
                        </div>
                    )}
                </div>
                <svg
                    className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {/* Dropdown */}
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Menu */}
                    <div className="absolute left-0 top-full mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1 max-h-80 overflow-y-auto">
                        <div className="px-3 py-2 border-b border-gray-100">
                            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                                Workspaces ({workspaces.length})
                            </span>
                        </div>

                        {workspaces.map((workspace) => (
                            <button
                                key={workspace.workspaceId}
                                onClick={() => handleSwitch(workspace)}
                                className={`w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 transition-colors ${activeWorkspace?.workspaceId === workspace.workspaceId ? 'bg-blue-50' : ''
                                    }`}
                            >
                                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-semibold text-sm">
                                    {workspace.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1 text-left">
                                    <div className="font-medium text-gray-900 text-sm">{workspace.name}</div>
                                    <div className="text-xs text-gray-500">{workspace.membership.role}</div>
                                </div>
                                {activeWorkspace?.workspaceId === workspace.workspaceId && (
                                    <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                                        <path
                                            fillRule="evenodd"
                                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                            clipRule="evenodd"
                                        />
                                    </svg>
                                )}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
