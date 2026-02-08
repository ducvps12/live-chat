import React from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { TeamsPage } from '@/components/pages/teams/TeamsPage';

const TeamsIndexPage: React.FC = () => {
    return (
        <DashboardLayout>
            <TeamsPage />
        </DashboardLayout>
    );
};

export default TeamsIndexPage;
