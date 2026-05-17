import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Head from 'next/head';
import { Spin } from 'antd';
import AppLayout from '../../../components/layout/AppLayout';
import WorkspaceDashboard from '../../../features/workspace/components/WorkspaceDashboard';

export default function WorkspaceDashboardPage() {
    const router = useRouter();
    const { workspaceId } = router.query;
    const [ready, setReady] = useState(false);

    useEffect(() => {
        const t = localStorage.getItem('HuyMe_token');
        if (!t) {
            router.replace('/auth/login');
            return;
        }
        setReady(true);
    }, [router]);

    // Wait for the dynamic route to hydrate so workspaceId is defined.
    if (!router.isReady || !ready || !workspaceId || Array.isArray(workspaceId)) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f2f5' }}>
                <Spin size="large" />
            </div>
        );
    }

    return (
        <AppLayout headerTitle="Tổng quan Workspace">
            <Head><title>Tổng quan Workspace | HuyMeChat</title></Head>
            <main className="w-full h-full p-6">
                <WorkspaceDashboard workspaceId={workspaceId} />
            </main>
        </AppLayout>
    );
}
