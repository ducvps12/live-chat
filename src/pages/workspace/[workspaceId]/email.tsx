import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Head from 'next/head';
import { Spin, Card, Table, Tag, Button, Empty, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { Mail } from 'lucide-react';
import AppLayout from '../../../components/layout/AppLayout';
import { httpClient } from '../../../lib/http/client';

export default function EmailPage() {
    const router = useRouter();
    const { workspaceId } = router.query;
    const [ready, setReady] = useState(false);
    const [accounts, setAccounts] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => { setReady(true); if (!localStorage.getItem('nemark_token')) router.replace('/auth/login'); }, [router]);

    useEffect(() => {
        if (!workspaceId) return;
        setLoading(true);
        httpClient.get(`/email-accounts?workspaceId=${workspaceId}`).then(r => setAccounts(r.data?.data || [])).catch(() => {}).finally(() => setLoading(false));
    }, [workspaceId]);

    if (!ready || !workspaceId) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spin size="large" /></div>;

    return (
        <AppLayout headerTitle={<><Mail size={22} style={{ marginRight: 8 }} /> Kênh Email</>}>
            <Head><title>Email | NemarkChat</title></Head>
            <main style={{ padding: 24 }}>
                <Card>
                    <p style={{ color: '#666', marginBottom: 16 }}>Kết nối email để nhận và trả lời yêu cầu hỗ trợ qua email ngay trong NemarkChat.</p>
                    {accounts.length === 0 && !loading ? (
                        <Empty description="Chưa có tài khoản email nào">
                            <Button type="primary" icon={<PlusOutlined />}>Thêm tài khoản email</Button>
                        </Empty>
                    ) : (
                        <Table dataSource={accounts} rowKey="id" loading={loading} size="small" columns={[
                            { title: 'Email', dataIndex: 'email' },
                            { title: 'Hiển thị', dataIndex: 'displayName', width: 150 },
                            { title: 'Nhận', dataIndex: 'allowReceive', width: 80, render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? 'Bật' : 'Tắt'}</Tag> },
                            { title: 'Gửi', dataIndex: 'allowSend', width: 80, render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? 'Bật' : 'Tắt'}</Tag> },
                            { title: 'Trạng thái', dataIndex: 'isActive', width: 100, render: (a: boolean) => <Tag color={a ? 'green' : 'red'}>{a ? 'Hoạt động' : 'Tắt'}</Tag> },
                        ]} />
                    )}
                </Card>
            </main>
        </AppLayout>
    );
}
