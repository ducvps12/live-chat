import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';
import { message, Input, Button, Card } from 'antd';
import { WorkspaceService } from '@/services/workspace.service';
import { useMyStore } from '@/contexts/MyStoreContext';

export const CreateWorkspacePage: React.FC = () => {
    const { t } = useTranslation();
    const router = useRouter();
    const { setActiveWorkspace } = useMyStore();

    const [newWorkspaceName, setNewWorkspaceName] = useState('');
    const [createLoading, setCreateLoading] = useState(false);

    const handleCreate = async () => {
        if (!newWorkspaceName.trim()) return;
        setCreateLoading(true);
        try {
            const result = await WorkspaceService.create({ name: newWorkspaceName.trim() });
            message.success('Workspace created successfully');

            // Set as active workspace
            setActiveWorkspace({
                workspaceKey: result.workspace.workspaceKey,
                workspaceId: result.workspace.workspaceId,
                name: result.workspace.name,
                membership: {
                    membershipKey: result.membership.membershipKey,
                    membershipId: result.membership.membershipId,
                    role: result.membership.role || 'Owner',
                },
            });

            // Redirect to workspaces list
            router.push('/workspace/workspaces');
        } catch (error: any) {
            message.error(error.response?.data?.message || 'Failed to create workspace');
        } finally {
            setCreateLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto py-8">
            <div className="flex items-center gap-4 mb-6">
                <Button
                    type="text"
                    icon={<span className="material-symbols-outlined">arrow_back</span>}
                    onClick={() => router.back()}
                />
                <div>
                    <h1 className="text-2xl font-bold text-neutral-900">Create New Workspace</h1>
                    <p className="text-neutral-500">Start a new workspace for your team</p>
                </div>
            </div>

            <Card className="shadow-sm">
                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-2">
                            Workspace Name <span className="text-red-500">*</span>
                        </label>
                        <Input
                            size="large"
                            placeholder="e.g. Acme Corp Support"
                            value={newWorkspaceName}
                            onChange={(e) => setNewWorkspaceName(e.target.value)}
                            onPressEnter={handleCreate}
                            autoFocus
                        />
                        <p className="text-xs text-neutral-500 mt-2">
                            This is the name of your company or team. You can change this later.
                        </p>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-neutral-100">
                        <Button onClick={() => router.back()} disabled={createLoading}>
                            Cancel
                        </Button>
                        <Button
                            type="primary"
                            onClick={handleCreate}
                            loading={createLoading}
                            disabled={!newWorkspaceName.trim()}
                        >
                            Create Workspace
                        </Button>
                    </div>
                </div>
            </Card>
        </div>
    );
};
