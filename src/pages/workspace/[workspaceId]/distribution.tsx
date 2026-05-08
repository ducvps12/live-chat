import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Head from 'next/head';
import { Spin, Card, Table, Tag, Button, message, Empty, Switch } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { GitBranch } from 'lucide-react';
import AppLayout from '../../../components/layout/AppLayout';
import { httpClient } from '../../../lib/http/client';

export default function DistributionPage() {
    const router = useRouter();
    const { workspaceId } = router.query;
    const [ready, setReady] = useState(false);
    const [rules, setRules] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => { setReady(true); if (!localStorage.getItem('nemark_token')) router.replace('/auth/login'); }, [router]);

    useEffect(() => {
        if (!workspaceId) return;
        setLoading(true);
        httpClient.get(`/distribution-rules?workspaceId=${workspaceId}`).then(r => setRules(r.data?.data || [])).catch(() => {}).finally(() => setLoading(false));
    }, [workspaceId]);

    if (!ready || !workspaceId) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spin size="large" /></div>;

    return (
        <AppLayout headerTitle={<><GitBranch size={22} style={{ marginRight: 8 }} /> Phân phối hội thoại</>}>
            <Head><title>Phân phối | NemarkChat</title></Head>
            <main style={{ padding: 24 }}>
                <Card>
                    <p style={{ color: '#666', marginBottom: 16 }}>Tự động phân phối hội thoại mới đến nhân viên phù hợp dựa trên quy tắc.</p>
                    {rules.length === 0 && !loading ? (
                        <Empty description="Chưa có quy tắc phân phối nào">
                            <Button type="primary" icon={<PlusOutlined />}>Tạo quy tắc</Button>
                        </Empty>
                    ) : (
                        <Table dataSource={rules} rowKey="id" loading={loading} size="small" columns={[
                            { title: 'Tên quy tắc', dataIndex: 'name' },
                            { title: 'Ưu tiên', dataIndex: 'priority', width: 80 },
                            { title: 'Điều kiện', dataIndex: 'conditionLogic', width: 100, render: (l: string) => <Tag>{l === 'all' ? 'Tất cả' : 'Bất kỳ'}</Tag> },
                            { title: 'Trạng thái', dataIndex: 'isActive', width: 100, render: (a: boolean) => <Tag color={a ? 'green' : 'default'}>{a ? 'Bật' : 'Tắt'}</Tag> },
                        ]} />
                    )}
                </Card>
            </main>
        </AppLayout>
    );
}
