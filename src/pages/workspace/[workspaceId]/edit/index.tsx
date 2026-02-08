import React from 'react';
import { useRouter } from 'next/router';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { EditWorkspacePage } from '@/components/pages/workspaces/EditWorkspacePage';
import SeoHead from '@/components/common/SeoHead';

const EditWorkspace: React.FC = () => {
    const router = useRouter();
    const { workspaceId } = router.query;

    if (!router.isReady) return null;

    return (
        <DashboardLayout>
            <SeoHead
                title="Edit Workspace"
                description="Manage your workspace settings."
            />
            {workspaceId && <EditWorkspacePage workspaceId={workspaceId as string} />}
        </DashboardLayout>
    );
};

export default EditWorkspace;
