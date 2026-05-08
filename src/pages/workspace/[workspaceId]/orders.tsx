import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Head from 'next/head';
import { Spin, Card, Input, Table, Tag, Empty } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { ShoppingBag } from 'lucide-react';
import AppLayout from '../../../components/layout/AppLayout';
import { httpClient } from '../../../lib/http/client';

export default function OrdersPage() {
    const router = useRouter();
    const { workspaceId } = router.query;
    const [ready, setReady] = useState(false);
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');

    useEffect(() => { setReady(true); if (!localStorage.getItem('nemark_token')) router.replace('/auth/login'); }, [router]);

    useEffect(() => {
        if (!workspaceId) return;
        setLoading(true);
        httpClient.get(`/orders?workspaceId=${workspaceId}`).then(r => setOrders(r.data?.data || [])).catch(() => {}).finally(() => setLoading(false));
    }, [workspaceId]);

    const fmt = (n: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);
    const statusColor: Record<string, string> = { draft: 'default', pending: 'orange', confirmed: 'blue', shipping: 'cyan', delivered: 'green', cancelled: 'red', returned: 'volcano' };
    const filtered = orders.filter(o => o.orderNumber?.includes(search) || o.customerName?.toLowerCase().includes(search.toLowerCase()));

    if (!ready || !workspaceId) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spin size="large" /></div>;

    return (
        <AppLayout headerTitle={<><ShoppingBag size={22} style={{ marginRight: 8 }} /> Đơn hàng</>}>
            <Head><title>Đơn hàng | NemarkChat</title></Head>
            <main style={{ padding: 24 }}>
                <Card>
                    <div style={{ marginBottom: 16 }}>
                        <Input prefix={<SearchOutlined />} placeholder="Tìm đơn hàng..." value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 320 }} allowClear />
                    </div>
                    {orders.length === 0 && !loading ? <Empty description="Chưa có đơn hàng" /> :
                        <Table dataSource={filtered} rowKey="id" loading={loading} size="small" pagination={{ pageSize: 15 }} columns={[
                            { title: 'Mã đơn', dataIndex: 'orderNumber', width: 120, render: (n: string) => <b>{n}</b> },
                            { title: 'Khách hàng', dataIndex: 'customerName', ellipsis: true },
                            { title: 'SĐT', dataIndex: 'customerPhone', width: 120 },
                            { title: 'Tổng tiền', dataIndex: 'total', width: 140, render: (t: number) => <b>{fmt(t)}</b> },
                            { title: 'Trạng thái', dataIndex: 'status', width: 110, render: (s: string) => <Tag color={statusColor[s] || 'default'}>{s}</Tag> },
                            { title: 'Ngày tạo', dataIndex: 'createdAt', width: 120, render: (d: string) => new Date(d).toLocaleDateString('vi-VN') },
                        ]} />
                    }
                </Card>
            </main>
        </AppLayout>
    );
}
