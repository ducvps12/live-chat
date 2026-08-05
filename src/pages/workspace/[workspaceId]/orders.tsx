import { useRouter } from 'next/router';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import { Spin, Input, Table, Tag, Empty, Select, Button, Space, message } from 'antd';
import {
    ShoppingBag,
    Search,
    RefreshCw,
    CreditCard,
    Truck,
    CheckCircle2,
    Clock3,
    ArrowRight,
    Package,
} from 'lucide-react';
import AppLayout from '../../../components/layout/AppLayout';
import { httpClient } from '../../../lib/http/client';

type OrderStatus = 'draft' | 'pending' | 'confirmed' | 'shipping' | 'delivered' | 'cancelled' | 'returned';

type OrderRow = {
    id?: string;
    _id?: string;
    orderNumber?: string;
    customerName?: string;
    customerPhone?: string;
    customerEmail?: string;
    total?: number;
    status?: OrderStatus;
    createdAt?: string;
    items?: Array<{ name: string; quantity: number; price: number }>;
};

type OrderStats = {
    totalOrders?: number;
    totalRevenue?: number;
    byStatus?: Array<{ _id: OrderStatus; count: number }>;
};

const currency = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' });

const statusMeta: Record<OrderStatus, { label: string; color: string }> = {
    draft: { label: 'Nháp', color: 'default' },
    pending: { label: 'Chờ xác nhận', color: 'orange' },
    confirmed: { label: 'Đã xác nhận', color: 'blue' },
    shipping: { label: 'Đang giao', color: 'cyan' },
    delivered: { label: 'Đã giao', color: 'green' },
    cancelled: { label: 'Đã huỷ', color: 'red' },
    returned: { label: 'Hoàn trả', color: 'volcano' },
};

const getOrderId = (order: OrderRow) => order.id || order._id || order.orderNumber || '';

export default function OrdersPage() {
    const router = useRouter();
    const { workspaceId } = router.query;
    const [ready, setReady] = useState(false);
    const [orders, setOrders] = useState<OrderRow[]>([]);
    const [stats, setStats] = useState<OrderStats>({});
    const [loading, setLoading] = useState(false);
    const [updatingId, setUpdatingId] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | OrderStatus>('all');

    useEffect(() => {
        setReady(true);
        if (!localStorage.getItem('nemark_token')) router.replace('/auth/login');
    }, [router]);

    const fetchOrders = useCallback(async () => {
        if (!workspaceId) return;
        setLoading(true);
        try {
            const [ordersRes, statsRes] = await Promise.all([
                httpClient.get(`/orders/workspace/${workspaceId}`),
                httpClient.get(`/orders/workspace/${workspaceId}/stats`),
            ]);
            setOrders(ordersRes.data?.data?.orders || []);
            setStats(statsRes.data?.data || {});
        } catch {
            message.error('Không thể tải danh sách đơn hàng');
        } finally {
            setLoading(false);
        }
    }, [workspaceId]);

    useEffect(() => {
        fetchOrders();
    }, [fetchOrders]);

    const statusCounts = useMemo(() => {
        const fromStats = new Map((stats.byStatus || []).map((item) => [item._id, item.count]));
        if (fromStats.size > 0) return fromStats;
        return orders.reduce((map, order) => {
            const status = order.status || 'draft';
            map.set(status, (map.get(status) || 0) + 1);
            return map;
        }, new Map<OrderStatus, number>());
    }, [orders, stats.byStatus]);

    const totalRevenue = stats.totalRevenue ?? orders
        .filter((order) => order.status === 'delivered')
        .reduce((sum, order) => sum + (order.total || 0), 0);

    const filteredOrders = useMemo(() => {
        const normalizedSearch = search.trim().toLowerCase();
        return orders.filter((order) => {
            if (statusFilter !== 'all' && order.status !== statusFilter) return false;
            if (!normalizedSearch) return true;
            return `${order.orderNumber || ''} ${order.customerName || ''} ${order.customerPhone || ''} ${order.customerEmail || ''}`.toLowerCase().includes(normalizedSearch);
        });
    }, [orders, search, statusFilter]);

    const updateStatus = async (order: OrderRow, status: OrderStatus) => {
        if (!workspaceId) return;
        const orderId = getOrderId(order);
        setUpdatingId(orderId);
        try {
            await httpClient.patch(`/orders/workspace/${workspaceId}/${orderId}/status`, { status });
            message.success('Đã cập nhật trạng thái đơn hàng');
            fetchOrders();
        } catch {
            message.error('Không thể cập nhật trạng thái');
        } finally {
            setUpdatingId(null);
        }
    };

    if (!ready || !workspaceId) {
        return (
            <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
                <Spin size="large" />
            </div>
        );
    }

    return (
        <AppLayout headerTitle={<><ShoppingBag size={22} style={{ marginRight: 8 }} /> Đơn hàng</>}>
            <Head><title>Đơn hàng | NemarkChat</title></Head>
            <main className="enterprise-page">
                <div className="enterprise-container" style={{ paddingTop: 24 }}>
                    <section className="enterprise-section" style={{ padding: 24 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                            <div>
                                <span className="enterprise-kicker">
                                    <span style={{ width: 7, height: 7, borderRadius: 999, background: '#12b76a' }} />
                                    Chốt đơn từ hội thoại
                                </span>
                                <h1 style={{ margin: '12px 0 8px', fontSize: 30, fontWeight: 950, color: 'var(--ent-text)' }}>Quản lý đơn hàng</h1>
                                <p style={{ margin: 0, color: 'var(--ent-text-muted)', fontSize: 14 }}>
                                    Theo dõi đơn phát sinh từ inbox, cập nhật trạng thái xử lý và đo doanh thu đã giao.
                                </p>
                            </div>
                            <Space wrap>
                                <Button icon={<RefreshCw size={15} />} onClick={fetchOrders} loading={loading} style={{ height: 40, borderRadius: 10, fontWeight: 800 }}>
                                    Làm mới
                                </Button>
                                <Link href={`/workspace/${workspaceId}/inbox`} className="enterprise-button enterprise-button-primary" style={{ height: 40, padding: '0 14px' }}>
                                    Mở Inbox <ArrowRight size={15} />
                                </Link>
                            </Space>
                        </div>
                    </section>

                    <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12, marginTop: 16 }}>
                        {[
                            { label: 'Tổng đơn', value: stats.totalOrders ?? orders.length, hint: `${filteredOrders.length} đang hiển thị`, icon: ShoppingBag, color: '#4f46e5', bg: '#eef2ff' },
                            { label: 'Chờ xử lý', value: (statusCounts.get('pending') || 0) + (statusCounts.get('confirmed') || 0), hint: 'Cần xác nhận/giao hàng', icon: Clock3, color: '#b45309', bg: '#fffbeb' },
                            { label: 'Đang giao', value: statusCounts.get('shipping') || 0, hint: 'Theo dõi vận chuyển', icon: Truck, color: '#0369a1', bg: '#e0f2fe' },
                            { label: 'Doanh thu đã giao', value: currency.format(totalRevenue), hint: `${statusCounts.get('delivered') || 0} đơn hoàn tất`, icon: CreditCard, color: '#0f766e', bg: '#ecfdf5' },
                        ].map((item) => {
                            const Icon = item.icon;
                            return (
                                <div key={item.label} className="enterprise-section" style={{ padding: 18, display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ fontSize: 12, color: 'var(--ent-text-muted)', fontWeight: 850, textTransform: 'uppercase', letterSpacing: 0 }}>{item.label}</div>
                                        <div style={{ marginTop: 8, fontSize: 24, fontWeight: 950, color: 'var(--ent-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.value}</div>
                                        <div style={{ marginTop: 6, fontSize: 12, color: 'var(--ent-text-muted)', fontWeight: 650 }}>{item.hint}</div>
                                    </div>
                                    <div style={{ width: 42, height: 42, borderRadius: 10, display: 'grid', placeItems: 'center', background: item.bg, color: item.color, flexShrink: 0 }}>
                                        <Icon size={20} />
                                    </div>
                                </div>
                            );
                        })}
                    </section>

                    <section className="enterprise-section" style={{ marginTop: 16, overflow: 'hidden' }}>
                        <div style={{ padding: 18, borderBottom: '1px solid var(--ent-border)', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                            <Input
                                allowClear
                                prefix={<Search size={15} color="#94a3b8" />}
                                placeholder="Tìm mã đơn, khách hàng, SĐT..."
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                style={{ height: 40, borderRadius: 10, maxWidth: 380 }}
                            />
                            <Select
                                value={statusFilter}
                                onChange={setStatusFilter}
                                style={{ width: 180 }}
                                options={[
                                    { value: 'all', label: 'Mọi trạng thái' },
                                    ...Object.entries(statusMeta).map(([value, meta]) => ({ value, label: meta.label })),
                                ]}
                            />
                        </div>

                        {orders.length === 0 && !loading ? (
                            <Empty
                                image={Empty.PRESENTED_IMAGE_SIMPLE}
                                description={
                                    <div>
                                        <div style={{ fontWeight: 900, color: 'var(--ent-text)', marginBottom: 6 }}>Chưa có đơn hàng</div>
                                        <div style={{ color: 'var(--ent-text-muted)' }}>Đơn thường được tạo từ cuộc hội thoại sau khi agent tư vấn và chọn sản phẩm.</div>
                                    </div>
                                }
                                style={{ padding: '56px 24px' }}
                            >
                                <Space wrap>
                                    <Link href={`/workspace/${workspaceId}/inbox`} className="enterprise-button enterprise-button-primary" style={{ height: 32, padding: '0 12px' }}>
                                        Mở Inbox <ArrowRight size={14} />
                                    </Link>
                                    <Link href={`/workspace/${workspaceId}/products`} className="enterprise-button" style={{ height: 32, padding: '0 12px' }}>
                                        Kiểm tra sản phẩm <Package size={14} />
                                    </Link>
                                </Space>
                            </Empty>
                        ) : (
                            <Table
                                dataSource={filteredOrders}
                                rowKey={(record) => getOrderId(record)}
                                loading={loading}
                                pagination={{ pageSize: 15, showSizeChanger: false }}
                                columns={[
                                    {
                                        title: 'Mã đơn',
                                        dataIndex: 'orderNumber',
                                        width: 150,
                                        render: (value) => <strong style={{ color: 'var(--ent-text)' }}>{value || 'Chưa có mã'}</strong>,
                                    },
                                    {
                                        title: 'Khách hàng',
                                        dataIndex: 'customerName',
                                        render: (_value, record) => (
                                            <div>
                                                <strong style={{ display: 'block', color: 'var(--ent-text)' }}>{record.customerName || 'Chưa có tên'}</strong>
                                                <span style={{ fontSize: 12, color: 'var(--ent-text-muted)' }}>{record.customerPhone || record.customerEmail || 'Chưa có liên hệ'}</span>
                                            </div>
                                        ),
                                    },
                                    {
                                        title: 'Sản phẩm',
                                        dataIndex: 'items',
                                        width: 160,
                                        render: (items) => `${Array.isArray(items) ? items.length : 0} dòng hàng`,
                                    },
                                    { title: 'Tổng tiền', dataIndex: 'total', width: 150, render: (value) => <strong>{currency.format(value || 0)}</strong> },
                                    {
                                        title: 'Trạng thái',
                                        dataIndex: 'status',
                                        width: 170,
                                        render: (value: OrderStatus = 'draft', record) => (
                                            <Select
                                                size="small"
                                                value={value}
                                                onChange={(nextStatus) => updateStatus(record, nextStatus)}
                                                loading={updatingId === getOrderId(record)}
                                                style={{ width: 145 }}
                                                options={Object.entries(statusMeta).map(([status, meta]) => ({ value: status, label: meta.label }))}
                                            />
                                        ),
                                    },
                                    {
                                        title: 'Ngày tạo',
                                        dataIndex: 'createdAt',
                                        width: 130,
                                        render: (value) => value ? new Date(value).toLocaleDateString('vi-VN') : '-',
                                    },
                                    {
                                        title: '',
                                        key: 'state',
                                        width: 96,
                                        render: (_value, record) => {
                                            const meta = statusMeta[record.status || 'draft'];
                                            return <Tag color={meta.color} icon={record.status === 'delivered' ? <CheckCircle2 size={12} /> : undefined}>{meta.label}</Tag>;
                                        },
                                    },
                                ]}
                            />
                        )}
                    </section>
                </div>
            </main>
        </AppLayout>
    );
}
