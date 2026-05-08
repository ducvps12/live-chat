import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Head from 'next/head';
import { Spin, Card, Input, Button, Table, Tag, Space, Modal, Form, message, Empty, Popconfirm } from 'antd';
import { PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { BookOpen, FileText } from 'lucide-react';
import AppLayout from '../../../components/layout/AppLayout';
import { httpClient } from '../../../lib/http/client';

interface KnowledgeEntry {
    id: string;
    product: string;
    question: string;
    answer: string;
    upsaleText?: string;
    keywords: string[];
    source: string;
    createdAt: string;
}

export default function KnowledgePage() {
    const router = useRouter();
    const { workspaceId } = router.query;
    const [ready, setReady] = useState(false);
    const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [modalOpen, setModalOpen] = useState(false);
    const [editingEntry, setEditingEntry] = useState<KnowledgeEntry | null>(null);
    const [form] = Form.useForm();

    useEffect(() => {
        const t = localStorage.getItem('nemark_token');
        setReady(true);
        if (!t) router.replace('/auth/login');
    }, [router]);

    const fetchEntries = async () => {
        if (!workspaceId) return;
        setLoading(true);
        try {
            const res = await httpClient.get(`/workspaces/${workspaceId}/knowledge`);
            setEntries(res.data?.data || []);
        } catch { /* silent */ }
        setLoading(false);
    };

    useEffect(() => { fetchEntries(); }, [workspaceId]);

    const filteredEntries = entries.filter(e =>
        e.product?.toLowerCase().includes(search.toLowerCase()) ||
        e.question?.toLowerCase().includes(search.toLowerCase()) ||
        e.answer?.toLowerCase().includes(search.toLowerCase())
    );

    const handleSave = async (values: any) => {
        try {
            if (editingEntry) {
                await httpClient.put(`/workspaces/${workspaceId}/knowledge/${editingEntry.id}`, values);
                message.success('Cập nhật thành công');
            } else {
                await httpClient.post(`/workspaces/${workspaceId}/knowledge`, values);
                message.success('Thêm kiến thức thành công');
            }
            setModalOpen(false);
            setEditingEntry(null);
            form.resetFields();
            fetchEntries();
        } catch {
            message.error('Có lỗi xảy ra');
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await httpClient.delete(`/workspaces/${workspaceId}/knowledge/${id}`);
            message.success('Đã xóa');
            fetchEntries();
        } catch {
            message.error('Xóa thất bại');
        }
    };

    const columns = [
        { title: 'Sản phẩm', dataIndex: 'product', key: 'product', width: 150, render: (t: string) => <Tag color="blue">{t}</Tag> },
        { title: 'Câu hỏi', dataIndex: 'question', key: 'question', ellipsis: true },
        { title: 'Trả lời', dataIndex: 'answer', key: 'answer', ellipsis: true },
        { title: 'Nguồn', dataIndex: 'source', key: 'source', width: 100, render: (s: string) => <Tag>{s}</Tag> },
        {
            title: '', key: 'actions', width: 80,
            render: (_: any, record: KnowledgeEntry) => (
                <Space>
                    <Button size="small" icon={<EditOutlined />} onClick={() => { setEditingEntry(record); form.setFieldsValue(record); setModalOpen(true); }} />
                    <Popconfirm title="Xóa mục này?" onConfirm={() => handleDelete(record.id)}>
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
        <AppLayout headerTitle={<><BookOpen size={22} style={{ marginRight: 8 }} /> Kiến thức</>}>
            <Head><title>Kiến thức | NemarkChat</title></Head>
            <main style={{ padding: 24 }}>
                <Card>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <Input prefix={<SearchOutlined />} placeholder="Tìm kiếm..." value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 320 }} allowClear />
                        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingEntry(null); form.resetFields(); setModalOpen(true); }}>Thêm mới</Button>
                    </div>
                    {entries.length === 0 && !loading ? (
                        <Empty description="Chưa có kiến thức nào. Thêm kiến thức để AI chatbot có thể trả lời khách hàng chính xác hơn." />
                    ) : (
                        <Table dataSource={filteredEntries} columns={columns} rowKey="id" loading={loading} size="small" pagination={{ pageSize: 15 }} />
                    )}
                </Card>
                <Modal title={editingEntry ? 'Sửa kiến thức' : 'Thêm kiến thức'} open={modalOpen} onCancel={() => { setModalOpen(false); setEditingEntry(null); }} onOk={() => form.submit()} okText="Lưu" width={600}>
                    <Form form={form} layout="vertical" onFinish={handleSave}>
                        <Form.Item name="product" label="Sản phẩm / Chủ đề" rules={[{ required: true }]}><Input /></Form.Item>
                        <Form.Item name="question" label="Câu hỏi" rules={[{ required: true }]}><Input.TextArea rows={2} /></Form.Item>
                        <Form.Item name="answer" label="Câu trả lời" rules={[{ required: true }]}><Input.TextArea rows={4} /></Form.Item>
                        <Form.Item name="upsaleText" label="Gợi ý bán thêm (tùy chọn)"><Input.TextArea rows={2} /></Form.Item>
                    </Form>
                </Modal>
            </main>
        </AppLayout>
    );
}
