import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import {
    Alert, Button, Card, Empty, Form, Input, message, Modal, Popconfirm,
    Segmented, Space, Spin, Statistic, Table, Tag, Typography
} from 'antd';
import {
    DeleteOutlined, EditOutlined, FileTextOutlined, GlobalOutlined,
    LinkOutlined, PlusOutlined, SearchOutlined, ThunderboltOutlined
} from '@ant-design/icons';
import { BookOpen } from 'lucide-react';
import AppLayout from '../../../components/layout/AppLayout';
import { httpClient } from '../../../lib/http/client';

const { Text, Title, Paragraph } = Typography;

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

type ImportMode = 'url' | 'sheet' | 'text';

const sourceLabel = (source: string) => {
    if (source === 'google_sheets') return { label: 'Google Sheets', color: 'green' };
    if (source === 'pasted_text') return { label: 'Văn bản', color: 'purple' };
    if (source?.startsWith('website:')) return { label: 'Website', color: 'blue' };
    return { label: 'Thủ công', color: 'default' };
};

export default function KnowledgePage() {
    const router = useRouter();
    const { workspaceId } = router.query;
    const [ready, setReady] = useState(false);
    const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [manualOpen, setManualOpen] = useState(false);
    const [importOpen, setImportOpen] = useState(false);
    const [importMode, setImportMode] = useState<ImportMode>('url');
    const [importing, setImporting] = useState(false);
    const [editingEntry, setEditingEntry] = useState<KnowledgeEntry | null>(null);
    const [form] = Form.useForm();
    const [importForm] = Form.useForm();

    useEffect(() => {
        const token = localStorage.getItem('nemark_token');
        setReady(true);
        if (!token) router.replace('/auth/login');
    }, [router]);

    const fetchEntries = async () => {
        if (!workspaceId) return;
        setLoading(true);
        try {
            const res = await httpClient.get(`/workspaces/${workspaceId}/knowledge`);
            setEntries(res.data?.data || []);
        } catch {
            message.error('Không thể tải kho tri thức');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchEntries(); }, [workspaceId]);

    const filteredEntries = useMemo(() => {
        const keyword = search.trim().toLowerCase();
        if (!keyword) return entries;
        return entries.filter(entry =>
            entry.product?.toLowerCase().includes(keyword) ||
            entry.question?.toLowerCase().includes(keyword) ||
            entry.answer?.toLowerCase().includes(keyword)
        );
    }, [entries, search]);

    const handleSave = async (values: any) => {
        try {
            if (editingEntry) {
                await httpClient.put(`/workspaces/${workspaceId}/knowledge/${editingEntry.id}`, values);
                message.success('Đã cập nhật kiến thức');
            } else {
                await httpClient.post(`/workspaces/${workspaceId}/knowledge`, values);
                message.success('Đã thêm kiến thức');
            }
            setManualOpen(false);
            setEditingEntry(null);
            form.resetFields();
            fetchEntries();
        } catch (error: any) {
            message.error(error.response?.data?.message || 'Không thể lưu kiến thức');
        }
    };

    const handleImport = async (values: any) => {
        setImporting(true);
        try {
            let result: any;
            if (importMode === 'url') {
                result = await httpClient.post(`/workspaces/${workspaceId}/knowledge/import-url`, {
                    url: values.url,
                    topic: values.topic,
                });
            } else if (importMode === 'sheet') {
                result = await httpClient.post(`/workspaces/${workspaceId}/knowledge/sync`, {
                    sheetUrl: values.sheetUrl,
                });
            } else {
                result = await httpClient.post(`/workspaces/${workspaceId}/knowledge/import-text`, {
                    topic: values.topic,
                    text: values.text,
                });
            }
            const count = result.data?.data?.importedEntries
                ?? result.data?.data?.syncedEntries
                ?? result.data?.data?.savedCount
                ?? result.data?.data?.count;
            message.success(count !== undefined ? `Đã nạp ${count} mục kiến thức` : 'Đã nạp kiến thức thành công');
            setImportOpen(false);
            importForm.resetFields();
            fetchEntries();
        } catch (error: any) {
            message.error(error.response?.data?.message || 'Không thể nạp dữ liệu. Hãy kiểm tra lại nguồn.');
        } finally {
            setImporting(false);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await httpClient.delete(`/workspaces/${workspaceId}/knowledge/${id}`);
            message.success('Đã xóa mục kiến thức');
            fetchEntries();
        } catch {
            message.error('Xóa thất bại');
        }
    };

    const openManual = (entry?: KnowledgeEntry) => {
        setEditingEntry(entry || null);
        form.resetFields();
        if (entry) form.setFieldsValue(entry);
        setManualOpen(true);
    };

    const columns = [
        {
            title: 'Chủ đề', dataIndex: 'product', key: 'product', width: 170,
            render: (value: string) => <Tag color="blue">{value}</Tag>
        },
        { title: 'Câu hỏi / Ý chính', dataIndex: 'question', key: 'question', ellipsis: true },
        { title: 'Nội dung trả lời', dataIndex: 'answer', key: 'answer', ellipsis: true },
        {
            title: 'Nguồn', dataIndex: 'source', key: 'source', width: 130,
            render: (source: string) => {
                const meta = sourceLabel(source);
                return <Tag color={meta.color}>{meta.label}</Tag>;
            }
        },
        {
            title: '', key: 'actions', width: 86,
            render: (_: any, record: KnowledgeEntry) => (
                <Space>
                    <Button size="small" aria-label="Sửa" icon={<EditOutlined />} onClick={() => openManual(record)} />
                    <Popconfirm title="Xóa mục kiến thức này?" okText="Xóa" cancelText="Hủy" onConfirm={() => handleDelete(record.id)}>
                        <Button size="small" danger aria-label="Xóa" icon={<DeleteOutlined />} />
                    </Popconfirm>
                </Space>
            )
        }
    ];

    if (!ready || !workspaceId) {
        return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spin size="large" /></div>;
    }

    return (
        <AppLayout headerTitle={<><BookOpen size={22} style={{ marginRight: 8 }} /> Kho tri thức</>}>
            <Head><title>Kho tri thức | NemarkChat</title></Head>
            <main style={{ padding: 24, maxWidth: 1540, margin: '0 auto' }}>
                <Card style={{ marginBottom: 16, borderColor: '#c7d2fe', background: 'linear-gradient(135deg, #f8faff 0%, #eef2ff 100%)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
                        <div>
                            <Text style={{ color: '#4f46e5', fontWeight: 700, fontSize: 12, letterSpacing: '.08em' }}>DỮ LIỆU CHO AI</Text>
                            <Title level={2} style={{ margin: '8px 0 4px' }}>Nạp kiến thức, không cần nhập từng câu</Title>
                            <Paragraph style={{ margin: 0, color: '#64748b' }}>
                                Quét một trang website, đồng bộ Google Sheets hoặc dán tài liệu. AI dùng dữ liệu này để trả lời đúng thông tin doanh nghiệp.
                            </Paragraph>
                        </div>
                        <Space wrap>
                            <Button icon={<PlusOutlined />} onClick={() => openManual()}>Thêm thủ công</Button>
                            <Button type="primary" icon={<ThunderboltOutlined />} onClick={() => setImportOpen(true)}>Nạp nhanh</Button>
                        </Space>
                    </div>
                </Card>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
                    <Card size="small"><Statistic title="Tổng mục kiến thức" value={entries.length} /></Card>
                    <Card size="small"><Statistic title="Nguồn tự động" value={entries.filter(item => item.source !== 'manual').length} /></Card>
                    <Card size="small"><Statistic title="Chủ đề" value={new Set(entries.map(item => item.product)).size} /></Card>
                </div>

                <Card>
                    <Input
                        prefix={<SearchOutlined />}
                        placeholder="Tìm theo chủ đề, câu hỏi hoặc nội dung..."
                        value={search}
                        onChange={event => setSearch(event.target.value)}
                        style={{ maxWidth: 420, marginBottom: 16 }}
                        allowClear
                    />
                    {entries.length === 0 && !loading ? (
                        <Empty description="Kho tri thức đang trống. Nạp website hoặc tài liệu để bot có dữ liệu trả lời.">
                            <Button type="primary" icon={<ThunderboltOutlined />} onClick={() => setImportOpen(true)}>Nạp dữ liệu đầu tiên</Button>
                        </Empty>
                    ) : (
                        <Table dataSource={filteredEntries} columns={columns} rowKey="id" loading={loading} size="small" pagination={{ pageSize: 15 }} />
                    )}
                </Card>

                <Modal
                    title={editingEntry ? 'Sửa kiến thức' : 'Thêm kiến thức thủ công'}
                    open={manualOpen}
                    onCancel={() => { setManualOpen(false); setEditingEntry(null); }}
                    onOk={() => form.submit()}
                    okText="Lưu"
                    cancelText="Hủy"
                    width={640}
                >
                    <Form form={form} layout="vertical" onFinish={handleSave}>
                        <Form.Item name="product" label="Sản phẩm / Chủ đề" rules={[{ required: true, message: 'Nhập chủ đề' }]}><Input /></Form.Item>
                        <Form.Item name="question" label="Câu hỏi" rules={[{ required: true, message: 'Nhập câu hỏi' }]}><Input.TextArea rows={2} /></Form.Item>
                        <Form.Item name="answer" label="Câu trả lời" rules={[{ required: true, message: 'Nhập câu trả lời' }]}><Input.TextArea rows={5} /></Form.Item>
                        <Form.Item name="upsaleText" label="Gợi ý bán thêm (tùy chọn)"><Input.TextArea rows={2} /></Form.Item>
                    </Form>
                </Modal>

                <Modal
                    title="Nạp nhanh vào Kho tri thức"
                    open={importOpen}
                    onCancel={() => setImportOpen(false)}
                    onOk={() => importForm.submit()}
                    okText="Nạp dữ liệu"
                    cancelText="Hủy"
                    confirmLoading={importing}
                    width={700}
                >
                    <Segmented
                        block
                        value={importMode}
                        onChange={value => { setImportMode(value as ImportMode); importForm.resetFields(); }}
                        options={[
                            { value: 'url', label: 'Quét website', icon: <GlobalOutlined /> },
                            { value: 'sheet', label: 'Google Sheets', icon: <LinkOutlined /> },
                            { value: 'text', label: 'Dán văn bản', icon: <FileTextOutlined /> },
                        ]}
                        style={{ marginBottom: 20 }}
                    />
                    <Form form={importForm} layout="vertical" onFinish={handleImport}>
                        {importMode === 'url' && <>
                            <Alert type="info" showIcon message="Quét nội dung hiển thị của một trang công khai. Hệ thống chặn localhost, IP nội bộ, trang quá lớn và chuyển hướng không an toàn." style={{ marginBottom: 16 }} />
                            <Form.Item name="url" label="Đường dẫn website" rules={[{ required: true, type: 'url', message: 'Nhập URL hợp lệ, gồm https:// hoặc http://' }]}>
                                <Input prefix={<GlobalOutlined />} placeholder="https://tenmien.vn/bang-gia" />
                            </Form.Item>
                            <Form.Item name="topic" label="Tên chủ đề (tùy chọn)"><Input placeholder="Ví dụ: Bảng giá, Chính sách đổi trả" /></Form.Item>
                        </>}
                        {importMode === 'sheet' && <>
                            <Alert type="info" showIcon message="Sheet cần được chia sẻ quyền xem bằng link. Dòng đầu nên có các cột: product, question, answer, upsaleText." style={{ marginBottom: 16 }} />
                            <Form.Item name="sheetUrl" label="Link Google Sheets" rules={[{ required: true, type: 'url', message: 'Nhập link Google Sheets hợp lệ' }]}>
                                <Input prefix={<LinkOutlined />} placeholder="https://docs.google.com/spreadsheets/d/..." />
                            </Form.Item>
                        </>}
                        {importMode === 'text' && <>
                            <Alert type="info" showIcon message="Dán bảng giá, chính sách, mô tả dịch vụ hoặc FAQ. Hệ thống tự chia thành các đoạn phù hợp cho AI tìm kiếm." style={{ marginBottom: 16 }} />
                            <Form.Item name="topic" label="Chủ đề" rules={[{ required: true, message: 'Nhập chủ đề' }]}><Input placeholder="Ví dụ: Dịch vụ VPS" /></Form.Item>
                            <Form.Item name="text" label="Nội dung" rules={[{ required: true, min: 20, message: 'Nội dung cần ít nhất 20 ký tự' }]}>
                                <Input.TextArea rows={10} showCount maxLength={24000} placeholder="Dán nội dung tại đây..." />
                            </Form.Item>
                        </>}
                    </Form>
                </Modal>
            </main>
        </AppLayout>
    );
}
