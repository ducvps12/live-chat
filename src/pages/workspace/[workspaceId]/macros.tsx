import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Head from 'next/head';
import { Spin, Card, Input, Button, Table, Tag, Space, Modal, Form, message, Empty, Popconfirm, Select } from 'antd';
import { PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined, CopyOutlined } from '@ant-design/icons';
import { Zap } from 'lucide-react';
import AppLayout from '../../../components/layout/AppLayout';
import { httpClient } from '../../../lib/http/client';

interface Macro {
    id: string;
    title: string;
    content: string;
    shortcut?: string;
    category?: string;
    channel: string;
    scope: string;
    usageCount: number;
    createdAt: string;
}

export default function MacrosPage() {
    const router = useRouter();
    const { workspaceId } = router.query;
    const [ready, setReady] = useState(false);
    const [macros, setMacros] = useState<Macro[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [modalOpen, setModalOpen] = useState(false);
    const [editingMacro, setEditingMacro] = useState<Macro | null>(null);
    const [form] = Form.useForm();

    useEffect(() => {
        const t = localStorage.getItem('nemark_token');
        setReady(true);
        if (!t) router.replace('/auth/login');
    }, [router]);

    const fetchMacros = async () => {
        if (!workspaceId) return;
        setLoading(true);
        try {
            const res = await httpClient.get(`/macros?workspaceId=${workspaceId}`);
            setMacros(res.data?.data || []);
        } catch { /* silent */ }
        setLoading(false);
    };

    useEffect(() => { fetchMacros(); }, [workspaceId]);

    const filteredMacros = macros.filter(m =>
        m.title?.toLowerCase().includes(search.toLowerCase()) ||
        m.content?.toLowerCase().includes(search.toLowerCase()) ||
        m.shortcut?.toLowerCase().includes(search.toLowerCase())
    );

    const handleSave = async (values: any) => {
        try {
            const payload = { ...values, workspaceId };
            if (editingMacro) {
                await httpClient.put(`/macros/${editingMacro.id}`, payload);
                message.success('Cập nhật thành công');
            } else {
                await httpClient.post('/macros', payload);
                message.success('Tạo phản hồi nhanh thành công');
            }
            setModalOpen(false);
            setEditingMacro(null);
            form.resetFields();
            fetchMacros();
        } catch {
            message.error('Có lỗi xảy ra');
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await httpClient.delete(`/macros/${id}`);
            message.success('Đã xóa');
            fetchMacros();
        } catch {
            message.error('Xóa thất bại');
        }
    };

    const columns = [
        { title: 'Tiêu đề', dataIndex: 'title', key: 'title', width: 200 },
        { title: 'Nội dung', dataIndex: 'content', key: 'content', ellipsis: true },
        { title: 'Phím tắt', dataIndex: 'shortcut', key: 'shortcut', width: 100, render: (s: string) => s ? <Tag color="purple">/{s}</Tag> : '-' },
        { title: 'Kênh', dataIndex: 'channel', key: 'channel', width: 90, render: (c: string) => <Tag>{c}</Tag> },
        { title: 'Đã dùng', dataIndex: 'usageCount', key: 'usageCount', width: 80, render: (n: number) => <span style={{ color: '#888' }}>{n} lần</span> },
        {
            title: '', key: 'actions', width: 120,
            render: (_: any, record: Macro) => (
                <Space>
                    <Button size="small" icon={<CopyOutlined />} onClick={() => { navigator.clipboard.writeText(record.content); message.success('Đã copy'); }} />
                    <Button size="small" icon={<EditOutlined />} onClick={() => { setEditingMacro(record); form.setFieldsValue(record); setModalOpen(true); }} />
                    <Popconfirm title="Xóa phản hồi nhanh này?" onConfirm={() => handleDelete(record.id)}>
                        <Button size="small" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                </Space>
            )
        }
    ];

    if (!ready || !workspaceId) {
        return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spin size="large" /></div>;
    }

    return (
        <AppLayout headerTitle={<><Zap size={22} style={{ marginRight: 8 }} /> Phản hồi nhanh</>}>
            <Head><title>Phản hồi nhanh | NemarkChat</title></Head>
            <main style={{ padding: 24 }}>
                <Card>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <Input prefix={<SearchOutlined />} placeholder="Tìm kiếm macro..." value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 320 }} allowClear />
                        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingMacro(null); form.resetFields(); setModalOpen(true); }}>Tạo mới</Button>
                    </div>
                    {macros.length === 0 && !loading ? (
                        <Empty description="Chưa có phản hồi nhanh nào. Tạo các mẫu tin nhắn để trả lời khách nhanh hơn." />
                    ) : (
                        <Table dataSource={filteredMacros} columns={columns} rowKey="id" loading={loading} size="small" pagination={{ pageSize: 15 }} />
                    )}
                </Card>
                <Modal title={editingMacro ? 'Sửa phản hồi nhanh' : 'Tạo phản hồi nhanh'} open={modalOpen} onCancel={() => { setModalOpen(false); setEditingMacro(null); }} onOk={() => form.submit()} okText="Lưu" width={600}>
                    <Form form={form} layout="vertical" onFinish={handleSave} initialValues={{ channel: 'all', scope: 'personal' }}>
                        <Form.Item name="title" label="Tiêu đề" rules={[{ required: true }]}><Input placeholder="VD: Chào khách hàng" /></Form.Item>
                        <Form.Item name="content" label="Nội dung tin nhắn" rules={[{ required: true }]}><Input.TextArea rows={4} placeholder="Nội dung sẽ được gửi cho khách..." /></Form.Item>
                        <div style={{ display: 'flex', gap: 16 }}>
                            <Form.Item name="shortcut" label="Phím tắt" style={{ flex: 1 }}><Input placeholder="VD: chao" addonBefore="/" /></Form.Item>
                            <Form.Item name="channel" label="Kênh" style={{ flex: 1 }}>
                                <Select options={[{ value: 'all', label: 'Tất cả' }, { value: 'widget', label: 'Widget' }, { value: 'zalo', label: 'Zalo' }, { value: 'facebook', label: 'Facebook' }, { value: 'email', label: 'Email' }]} />
                            </Form.Item>
                        </div>
                        <Form.Item name="category" label="Danh mục (tùy chọn)"><Input placeholder="VD: Chào hỏi, Giá cả, Hỗ trợ" /></Form.Item>
                    </Form>
                </Modal>
            </main>
        </AppLayout>
    );
}
