import { useRouter } from 'next/router';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import {
    Spin,
    Input,
    Button,
    Table,
    Tag,
    Space,
    message,
    Empty,
    Modal,
    Form,
    InputNumber,
    Select,
    Popconfirm,
} from 'antd';
import {
    Package,
    Plus,
    RefreshCw,
    Search,
    Sheet,
    Pencil,
    Trash2,
    Boxes,
    EyeOff,
    Wallet,
    ArrowRight,
} from 'lucide-react';
import AppLayout from '../../../components/layout/AppLayout';
import { httpClient } from '../../../lib/http/client';

type ProductRow = {
    id?: string;
    _id?: string;
    name: string;
    sku?: string;
    category?: string;
    price?: number;
    stock?: number;
    source?: string;
    isActive?: boolean;
    description?: string;
    imageUrl?: string;
};

type ProductFormValues = {
    name: string;
    sku?: string;
    category?: string;
    price?: number;
    stock?: number;
    description?: string;
    isActive?: boolean;
};

const currency = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' });

const getProductId = (product: ProductRow) => product.id || product._id || product.sku || product.name;

export default function ProductsPage() {
    const router = useRouter();
    const { workspaceId } = router.query;
    const [ready, setReady] = useState(false);
    const [products, setProducts] = useState<ProductRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState('all');
    const [visibility, setVisibility] = useState<'all' | 'active' | 'hidden'>('all');
    const [editorOpen, setEditorOpen] = useState(false);
    const [syncOpen, setSyncOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<ProductRow | null>(null);
    const [sheetUrl, setSheetUrl] = useState('');
    const [form] = Form.useForm<ProductFormValues>();

    useEffect(() => {
        setReady(true);
        if (!localStorage.getItem('nemark_token')) router.replace('/auth/login');
    }, [router]);

    const fetchProducts = useCallback(async () => {
        if (!workspaceId) return;
        setLoading(true);
        try {
            const res = await httpClient.get(`/products/workspace/${workspaceId}`);
            setProducts(res.data?.data?.products || []);
        } catch {
            message.error('Không thể tải danh sách sản phẩm');
        } finally {
            setLoading(false);
        }
    }, [workspaceId]);

    useEffect(() => {
        fetchProducts();
    }, [fetchProducts]);

    const categories = useMemo(() => {
        const values = products.map((item) => item.category).filter(Boolean) as string[];
        return Array.from(new Set(values));
    }, [products]);

    const stats = useMemo(() => {
        const active = products.filter((item) => item.isActive !== false).length;
        const hidden = products.length - active;
        const stock = products.reduce((sum, item) => sum + (item.stock || 0), 0);
        const value = products.reduce((sum, item) => sum + ((item.price || 0) * (item.stock || 0)), 0);
        return { total: products.length, active, hidden, stock, value };
    }, [products]);

    const filteredProducts = useMemo(() => {
        const normalizedSearch = search.trim().toLowerCase();
        return products.filter((product) => {
            if (category !== 'all' && product.category !== category) return false;
            if (visibility === 'active' && product.isActive === false) return false;
            if (visibility === 'hidden' && product.isActive !== false) return false;
            if (!normalizedSearch) return true;
            return `${product.name || ''} ${product.sku || ''} ${product.category || ''}`.toLowerCase().includes(normalizedSearch);
        });
    }, [category, products, search, visibility]);

    const openCreate = () => {
        setEditingProduct(null);
        form.resetFields();
        form.setFieldsValue({ price: 0, stock: 0, isActive: true });
        setEditorOpen(true);
    };

    const openEdit = (product: ProductRow) => {
        setEditingProduct(product);
        form.setFieldsValue({
            name: product.name,
            sku: product.sku,
            category: product.category,
            price: product.price || 0,
            stock: product.stock || 0,
            description: product.description,
            isActive: product.isActive !== false,
        });
        setEditorOpen(true);
    };

    const saveProduct = async (values: ProductFormValues) => {
        if (!workspaceId) return;
        setSaving(true);
        try {
            const payload = { ...values, price: values.price || 0, stock: values.stock || 0 };
            if (editingProduct) {
                await httpClient.patch(`/products/workspace/${workspaceId}/${getProductId(editingProduct)}`, payload);
                message.success('Đã cập nhật sản phẩm');
            } else {
                await httpClient.post(`/products/workspace/${workspaceId}`, payload);
                message.success('Đã tạo sản phẩm mới');
            }
            setEditorOpen(false);
            setEditingProduct(null);
            form.resetFields();
            fetchProducts();
        } catch (error: unknown) {
            const err = error as { response?: { data?: { message?: string; error?: { message?: string } } } };
            message.error(err.response?.data?.error?.message || err.response?.data?.message || 'Không thể lưu sản phẩm');
        } finally {
            setSaving(false);
        }
    };

    const syncGoogleSheet = async () => {
        if (!workspaceId || !sheetUrl.trim()) {
            message.warning('Nhập link Google Sheet trước khi đồng bộ');
            return;
        }
        setSyncing(true);
        try {
            const res = await httpClient.post(`/products/workspace/${workspaceId}/sync-google-sheet`, { sheetUrl: sheetUrl.trim() });
            const imported = res.data?.data?.imported || 0;
            const errors = res.data?.data?.errors || [];
            message.success(`Đồng bộ thành công ${imported} sản phẩm`);
            if (errors.length) message.warning(`${errors.length} dòng cần kiểm tra lại`);
            setSyncOpen(false);
            setSheetUrl('');
            fetchProducts();
        } catch (error: unknown) {
            const err = error as { response?: { data?: { message?: string } } };
            message.error(err.response?.data?.message || 'Không thể đồng bộ Google Sheet');
        } finally {
            setSyncing(false);
        }
    };

    const deleteProduct = async (product: ProductRow) => {
        if (!workspaceId) return;
        try {
            await httpClient.delete(`/products/workspace/${workspaceId}/${getProductId(product)}`);
            message.success('Đã xoá sản phẩm');
            fetchProducts();
        } catch {
            message.error('Không thể xoá sản phẩm');
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
        <AppLayout headerTitle={<><Package size={22} style={{ marginRight: 8 }} /> Sản phẩm</>}>
            <Head><title>Sản phẩm | NemarkChat</title></Head>
            <main className="enterprise-page">
                <div className="enterprise-container" style={{ paddingTop: 24 }}>
                    <section className="enterprise-section" style={{ padding: 24 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                            <div>
                                <span className="enterprise-kicker">
                                    <span style={{ width: 7, height: 7, borderRadius: 999, background: '#12b76a' }} />
                                    Catalog bán hàng
                                </span>
                                <h1 style={{ margin: '12px 0 8px', fontSize: 30, fontWeight: 950, color: 'var(--ent-text)' }}>Quản lý sản phẩm</h1>
                                <p style={{ margin: 0, color: 'var(--ent-text-muted)', fontSize: 14 }}>
                                    Dùng sản phẩm trong hội thoại để chốt đơn nhanh, đồng bộ bảng giá và kiểm soát tồn kho.
                                </p>
                            </div>
                            <Space wrap>
                                <Button icon={<RefreshCw size={15} />} onClick={fetchProducts} loading={loading} style={{ height: 40, borderRadius: 10, fontWeight: 800 }}>
                                    Làm mới
                                </Button>
                                <Button icon={<Sheet size={15} />} onClick={() => setSyncOpen(true)} style={{ height: 40, borderRadius: 10, fontWeight: 800 }}>
                                    Đồng bộ Sheet
                                </Button>
                                <Button type="primary" icon={<Plus size={16} />} onClick={openCreate} style={{ height: 40, borderRadius: 10, fontWeight: 800 }}>
                                    Tạo sản phẩm
                                </Button>
                            </Space>
                        </div>
                    </section>

                    <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12, marginTop: 16 }}>
                        {[
                            { label: 'Tổng sản phẩm', value: stats.total, hint: `${stats.active} đang bán`, icon: Package, color: '#4f46e5', bg: '#eef2ff' },
                            { label: 'Tồn kho', value: stats.stock, hint: 'Tổng số lượng khả dụng', icon: Boxes, color: '#0f766e', bg: '#ecfdf5' },
                            { label: 'Đang ẩn', value: stats.hidden, hint: 'Không hiển thị cho agent', icon: EyeOff, color: '#b45309', bg: '#fffbeb' },
                            { label: 'Giá trị kho', value: currency.format(stats.value), hint: 'Theo giá bán hiện tại', icon: Wallet, color: '#0369a1', bg: '#e0f2fe' },
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
                                placeholder="Tìm theo tên, SKU, danh mục..."
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                style={{ height: 40, borderRadius: 10, maxWidth: 360 }}
                            />
                            <Select
                                value={category}
                                onChange={setCategory}
                                style={{ width: 190 }}
                                options={[{ value: 'all', label: 'Tất cả danh mục' }, ...categories.map((item) => ({ value: item, label: item }))]}
                            />
                            <Select
                                value={visibility}
                                onChange={setVisibility}
                                style={{ width: 160 }}
                                options={[
                                    { value: 'all', label: 'Mọi trạng thái' },
                                    { value: 'active', label: 'Đang bán' },
                                    { value: 'hidden', label: 'Đang ẩn' },
                                ]}
                            />
                        </div>

                        {products.length === 0 && !loading ? (
                            <Empty
                                image={Empty.PRESENTED_IMAGE_SIMPLE}
                                description={
                                    <div>
                                        <div style={{ fontWeight: 900, color: 'var(--ent-text)', marginBottom: 6 }}>Chưa có sản phẩm</div>
                                        <div style={{ color: 'var(--ent-text-muted)' }}>Tạo sản phẩm đầu tiên hoặc đồng bộ Google Sheet để agent có thể chốt đơn từ inbox.</div>
                                    </div>
                                }
                                style={{ padding: '56px 24px' }}
                            >
                                <Space wrap>
                                    <Button type="primary" icon={<Plus size={15} />} onClick={openCreate}>Tạo sản phẩm</Button>
                                    <Button icon={<Sheet size={15} />} onClick={() => setSyncOpen(true)}>Đồng bộ Sheet</Button>
                                    <Link href={`/workspace/${workspaceId}/settings?tab=products`} className="enterprise-button" style={{ height: 32, padding: '0 12px' }}>
                                        Cài đặt nâng cao <ArrowRight size={14} />
                                    </Link>
                                </Space>
                            </Empty>
                        ) : (
                            <Table
                                dataSource={filteredProducts}
                                rowKey={(record) => getProductId(record)}
                                loading={loading}
                                pagination={{ pageSize: 15, showSizeChanger: false }}
                                columns={[
                                    {
                                        title: 'Sản phẩm',
                                        dataIndex: 'name',
                                        render: (_value, record) => (
                                            <div>
                                                <strong style={{ display: 'block', color: 'var(--ent-text)' }}>{record.name}</strong>
                                                <span style={{ fontSize: 12, color: 'var(--ent-text-muted)' }}>{record.sku ? `#${record.sku}` : 'Chưa có SKU'}</span>
                                            </div>
                                        ),
                                    },
                                    { title: 'Danh mục', dataIndex: 'category', width: 160, render: (value) => value ? <Tag>{value}</Tag> : <span style={{ color: '#94a3b8' }}>Chưa phân loại</span> },
                                    { title: 'Giá', dataIndex: 'price', width: 150, render: (value) => <strong>{currency.format(value || 0)}</strong> },
                                    { title: 'Kho', dataIndex: 'stock', width: 90 },
                                    { title: 'Nguồn', dataIndex: 'source', width: 130, render: (value) => <Tag color={value === 'google_sheet' ? 'green' : 'blue'}>{value === 'google_sheet' ? 'Google Sheet' : 'Thủ công'}</Tag> },
                                    { title: 'Trạng thái', dataIndex: 'isActive', width: 120, render: (value) => <Tag color={value === false ? 'default' : 'green'}>{value === false ? 'Đang ẩn' : 'Đang bán'}</Tag> },
                                    {
                                        title: '',
                                        key: 'actions',
                                        width: 96,
                                        render: (_value, record) => (
                                            <Space>
                                                <Button size="small" icon={<Pencil size={13} />} onClick={() => openEdit(record)} />
                                                <Popconfirm title="Xoá sản phẩm này?" okText="Xoá" cancelText="Huỷ" onConfirm={() => deleteProduct(record)}>
                                                    <Button size="small" danger icon={<Trash2 size={13} />} />
                                                </Popconfirm>
                                            </Space>
                                        ),
                                    },
                                ]}
                            />
                        )}
                    </section>
                </div>
            </main>

            <Modal
                title={editingProduct ? 'Chỉnh sửa sản phẩm' : 'Tạo sản phẩm'}
                open={editorOpen}
                onCancel={() => setEditorOpen(false)}
                onOk={() => form.submit()}
                okText={editingProduct ? 'Lưu thay đổi' : 'Tạo sản phẩm'}
                confirmLoading={saving}
                destroyOnClose
            >
                <Form form={form} layout="vertical" onFinish={saveProduct} initialValues={{ price: 0, stock: 0, isActive: true }}>
                    <Form.Item name="name" label="Tên sản phẩm" rules={[{ required: true, message: 'Nhập tên sản phẩm' }]}>
                        <Input placeholder="VD: Combo chăm sóc da" />
                    </Form.Item>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <Form.Item name="sku" label="SKU">
                            <Input placeholder="SKU-001" />
                        </Form.Item>
                        <Form.Item name="category" label="Danh mục">
                            <Input placeholder="Mỹ phẩm, Dịch vụ..." />
                        </Form.Item>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <Form.Item name="price" label="Giá bán">
                            <InputNumber min={0} style={{ width: '100%' }} addonAfter="đ" />
                        </Form.Item>
                        <Form.Item name="stock" label="Tồn kho">
                            <InputNumber min={0} style={{ width: '100%' }} />
                        </Form.Item>
                    </div>
                    <Form.Item name="description" label="Mô tả">
                        <Input.TextArea rows={3} placeholder="Thông tin tư vấn nhanh cho agent" />
                    </Form.Item>
                    <Form.Item name="isActive" label="Trạng thái">
                        <Select options={[{ value: true, label: 'Đang bán' }, { value: false, label: 'Ẩn khỏi catalog' }]} />
                    </Form.Item>
                </Form>
            </Modal>

            <Modal
                title="Đồng bộ Google Sheet"
                open={syncOpen}
                onCancel={() => setSyncOpen(false)}
                onOk={syncGoogleSheet}
                okText="Lấy dữ liệu"
                confirmLoading={syncing}
                destroyOnClose
            >
                <p style={{ color: 'var(--ent-text-muted)', marginTop: 0 }}>
                    Sheet cần có cột <strong>name/tên</strong> và <strong>price/giá</strong>. Có thể thêm SKU, category, stock, description, image.
                </p>
                <Input value={sheetUrl} onChange={(event) => setSheetUrl(event.target.value)} placeholder="https://docs.google.com/spreadsheets/d/..." />
            </Modal>
        </AppLayout>
    );
}
