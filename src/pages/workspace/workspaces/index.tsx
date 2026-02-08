import React from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { WorkspacesPage } from '@/components/pages/workspaces/WorkspacesPage';

const WorkspacesIndexPage: React.FC = () => {
    return (
        <DashboardLayout>
            <WorkspacesPage />
        </DashboardLayout>
    );
};

export default WorkspacesIndexPage;
