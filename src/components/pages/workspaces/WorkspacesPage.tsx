import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { message, Button, Card, Spin, Tag, Tooltip } from 'antd';
import { WorkspaceService } from '@/services/workspace.service';
import { WorkspaceWithMembership } from '@/types/workspace';
import { useMyStore } from '@/contexts/MyStoreContext';
import { useRouter } from 'next/router';

export const WorkspacesPage: React.FC = () => {
    const { t } = useTranslation();
    const router = useRouter();
    const { activeWorkspace, setActiveWorkspace } = useMyStore();

    const [workspaces, setWorkspaces] = useState<WorkspaceWithMembership[]>([]);
    const [loading, setLoading] = useState(false);

    // Fetch workspaces
    const fetchWorkspaces = useCallback(async () => {
        setLoading(true);
        try {
            const data = await WorkspaceService.list();
            setWorkspaces(data);
        } catch (error: any) {
            console.error('Failed to fetch workspaces:', error);
            message.error('Failed to load workspaces');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchWorkspaces();
    }, [fetchWorkspaces]);

    // Switch workspace
    const handleSwitchWorkspace = (ws: WorkspaceWithMembership) => {
        setActiveWorkspace({
            workspaceKey: ws.workspaceKey,
            workspaceId: ws.workspaceId,
            name: ws.name,
            membership: {
                membershipKey: ws.membership.membershipKey,
                membershipId: ws.membership.membershipId,
                role: (ws.membership as any).role || 'User',
            },
        });
        message.success(`Switched to "${ws.name}"`);
        router.push('/workspace/inbox');
    };

    return (
        <div className="max-w-5xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-neutral-900">Workspaces</h1>
                    <p className="text-neutral-500 mt-1">Manage and switch between your workspaces</p>
                </div>
                <Button type="primary" onClick={() => router.push('/workspace/create')}>
                    <span className="material-symbols-outlined text-lg mr-1">add</span>
                    Create Workspace
                </Button>
            </div>

            <Spin spinning={loading}>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {workspaces.map((ws) => {
                        const isActive = activeWorkspace?.workspaceId === ws.workspaceId;
                        const role = (ws.membership as any).role || 'Member';
                        const isOwner = role === 'Owner';

                        return (
                            <Card key={ws.workspaceId} className={`cursor-pointer transition-all hover:shadow-md ${isActive ? 'border-primary-500 ring-2 ring-primary-100' : ''}`} onClick={() => handleSwitchWorkspace(ws)}>
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white text-lg font-bold">
                                            {ws.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-neutral-900">{ws.name}</h3>
                                            <div className="flex items-center gap-2 mt-1">
                                                <Tag color={role === 'Owner' ? 'gold' : role === 'Admin' ? 'blue' : 'default'}>{role}</Tag>
                                                {isActive && <Tag color="green">Active</Tag>}
                                            </div>
                                        </div>
                                    </div>
                                    {isOwner && (
                                        <Tooltip title="Settings">
                                            <Button
                                                type="text"
                                                size="small"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    router.push(`/workspace/${ws.workspaceId}/edit`);
                                                }}
                                            >
                                                <span className="material-symbols-outlined text-lg">settings</span>
                                            </Button>
                                        </Tooltip>
                                    )}
                                </div>
                                <div className="mt-4 pt-4 border-t border-neutral-100 flex justify-between items-center text-sm text-neutral-500">
                                    <span>Created {new Date(ws.createdAt || Date.now()).toLocaleDateString()}</span>
                                    {isActive ? <span className="text-green-600 font-medium">Current</span> : <span className="text-primary-600 font-medium">Click to switch</span>}
                                </div>
                            </Card>
                        );
                    })}
                    {workspaces.length === 0 && !loading && (
                        <div className="col-span-full text-center py-12">
                            <span className="material-symbols-outlined text-6xl text-neutral-300 mb-4">business</span>
                            <p className="text-neutral-500">No workspaces found. Create your first workspace!</p>
                        </div>
                    )}
                </div>
            </Spin>
        </div>
    );
};
