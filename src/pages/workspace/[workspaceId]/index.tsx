import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { Spin } from 'antd';
import AppLayout from '../../../components/layout/AppLayout';
import WorkspaceDashboard from '../../../features/workspace/components/WorkspaceDashboard';

export default function WorkspaceDashboardPage() {
    const router = useRouter();
    const { workspaceId } = router.query;
    const [ready, setReady] = useState(false);

    useEffect(() => {
        const token = localStorage.getItem('nemark_token');
        setReady(true);
        if (!token) router.replace('/auth/login');
    }, [router]);

    if (!ready || !workspaceId) {
        return (
            <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--ent-bg)' }}>
                <Spin size="large" />
            </div>
        );
    }

    return (
        <AppLayout headerTitle="Tổng quan workspace">
            <Head>
                <title>Tổng quan workspace | NemarkChat</title>
            </Head>
            <WorkspaceDashboard workspaceId={workspaceId as string} />
        </AppLayout>
    );
}
