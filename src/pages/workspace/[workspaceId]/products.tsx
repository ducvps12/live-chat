import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Head from 'next/head';
import { Spin, Card, Input, Button, Table, Tag, Space, message, Empty } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { Package } from 'lucide-react';
import AppLayout from '../../../components/layout/AppLayout';
import { httpClient } from '../../../lib/http/client';

export default function ProductsPage() {
    const router = useRouter();
    const { workspaceId } = router.query;
    const [ready, setReady] = useState(false);
    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');

    useEffect(() => { setReady(true); if (!localStorage.getItem('nemark_token')) router.replace('/auth/login'); }, [router]);

    useEffect(() => {
        if (!workspaceId) return;
        setLoading(true);
        httpClient.get(`/products?workspaceId=${workspaceId}`).then(r => setProducts(r.data?.data || [])).catch(() => {}).finally(() => setLoading(false));
    }, [workspaceId]);

    const fmt = (n: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);
    const filtered = products.filter(p => p.name?.toLowerCase().includes(search.toLowerCase()) || p.sku?.toLowerCase().includes(search.toLowerCase()));

    if (!ready || !workspaceId) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spin size="large" /></div>;

    return (
        <AppLayout headerTitle={<><Package size={22} style={{ marginRight: 8 }} /> Sản phẩm</>}>
            <Head><title>Sản phẩm | NemarkChat</title></Head>
            <main style={{ padding: 24 }}>
                <Card>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                        <Input prefix={<SearchOutlined />} placeholder="Tìm sản phẩm..." value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 320 }} allowClear />
                    </div>
                    {products.length === 0 && !loading ? <Empty description="Chưa có sản phẩm" /> :
                        <Table dataSource={filtered} rowKey="id" loading={loading} size="small" pagination={{ pageSize: 15 }} columns={[
                            { title: 'Tên', dataIndex: 'name', ellipsis: true },
                            { title: 'SKU', dataIndex: 'sku', width: 100 },
                            { title: 'Giá', dataIndex: 'price', width: 130, render: (p: number) => <b>{fmt(p)}</b> },
                            { title: 'Kho', dataIndex: 'stock', width: 70 },
                            { title: 'Trạng thái', dataIndex: 'isActive', width: 100, render: (a: boolean) => <Tag color={a ? 'green' : 'default'}>{a ? 'Đang bán' : 'Ẩn'}</Tag> },
                        ]} />
                    }
                </Card>
            </main>
        </AppLayout>
    );
}
