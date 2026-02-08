import React from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { CreateWorkspacePage } from '@/components/pages/workspaces/CreateWorkspacePage';
import SeoHead from '@/components/common/SeoHead';

const CreateWorkspace: React.FC = () => {
    return (
        <DashboardLayout>
            <SeoHead
                title="Create Workspace"
                description="Create a new workspace for your team."
            />
            <CreateWorkspacePage />
        </DashboardLayout>
    );
};

export default CreateWorkspace;
