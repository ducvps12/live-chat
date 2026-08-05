import { useRouter } from 'next/router';
import { useEffect, useState, useCallback } from 'react';
import Head from 'next/head';
import { Spin, Tabs, message, Form, Input, Button, Select, Table, Modal, Switch, InputNumber, Tag, Space, TimePicker, DatePicker, Tooltip, Badge, Empty, Drawer, Typography, Divider, Popconfirm } from 'antd';
import { Menu as MenuIcon } from 'lucide-react';
import {
    SettingOutlined, TeamOutlined, MailOutlined, ApiOutlined, MessageOutlined,
    ClockCircleOutlined, ShoppingCartOutlined, DollarOutlined, TagOutlined,
    PlusOutlined, DeleteOutlined, EditOutlined, SyncOutlined, SearchOutlined,
    SendOutlined, ThunderboltOutlined, ShopOutlined, FileTextOutlined,
    GlobalOutlined, BranchesOutlined, RobotOutlined, FacebookOutlined, CheckCircleOutlined
} from '@ant-design/icons';
import AppLayout from '../../../components/layout/AppLayout';
import WorkspaceSettingsForm from '../../../features/workspace/components/WorkspaceSettingsForm';
import ZaloIntegrationSettings from '../../../features/workspace/components/ZaloIntegrationSettings';
import FacebookIntegrationSettings from '../../../features/workspace/components/FacebookIntegrationSettings';
import KnowledgeSettings from '../../../features/workspace/components/KnowledgeSettings';
import { useWorkspaceTags, useAddWorkspaceTag, useRemoveWorkspaceTag } from '../../../domains/workspace/workspace.hooks';
import axios from 'axios';
import { resolveApiBaseUrl } from '../../../lib/http/api-base';

const { Text, Title } = Typography;
const API = resolveApiBaseUrl();

function getHeaders() {
    const token = typeof window !== 'undefined' ? localStorage.getItem('nemark_token') : '';
    return { Authorization: `Bearer ${token}` };
}

// ════════════════════════════════════════════
// Message Templates (Mẫu tin nhắn)
// ════════════════════════════════════════════
function MessageTemplateSettings({ workspaceId }: { workspaceId: string }) {
    const [macros, setMacros] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<any>(null);
    const [form] = Form.useForm();

    const fetchMacros = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await axios.get(`${API}/macros/workspace/${workspaceId}`, { headers: getHeaders() });
            setMacros(data.data || []);
        } catch { /* ignore */ }
        setLoading(false);
    }, [workspaceId]);

    useEffect(() => { fetchMacros(); }, [fetchMacros]);

    const handleSave = async (values: any) => {
        try {
            if (editing) {
                await axios.patch(`${API}/macros/workspace/${workspaceId}/${editing._id}`, values, { headers: getHeaders() });
                message.success('Đã cập nhật mẫu tin nhắn');
            } else {
                await axios.post(`${API}/macros/workspace/${workspaceId}/${values.scope === 'team' ? 'team' : 'personal'}`, values, { headers: getHeaders() });
                message.success('Đã tạo mẫu tin nhắn mới');
            }
            setModalOpen(false);
            form.resetFields();
            setEditing(null);
            fetchMacros();
        } catch (e: any) {
            message.error(e.response?.data?.message || 'Lỗi');
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await axios.delete(`${API}/macros/workspace/${workspaceId}/${id}`, { headers: getHeaders() });
            message.success('Đã xóa');
            fetchMacros();
        } catch { message.error('Lỗi khi xóa'); }
    };

    const columns = [
        { title: 'Tiêu đề', dataIndex: 'title', key: 'title', render: (t: string) => <Text strong>{t}</Text> },
        { title: 'Phím tắt', dataIndex: 'shortcut', key: 'shortcut', render: (s: string) => s ? <Tag color="blue">{s}</Tag> : '-' },
        { title: 'Kênh', dataIndex: 'channel', key: 'channel', render: (c: string) => <Tag>{c || 'all'}</Tag> },
        { title: 'Phạm vi', dataIndex: 'scope', key: 'scope', render: (s: string) => <Tag color={s === 'team' ? 'green' : 'default'}>{s === 'team' ? 'Nhóm' : 'Cá nhân'}</Tag> },
        {
            title: '', key: 'actions', width: 100,
            render: (_: any, r: any) => (
                <Space>
                    <Button size="small" icon={<EditOutlined />} onClick={() => { setEditing(r); form.setFieldsValue(r); setModalOpen(true); }} />
                    <Popconfirm title="Xóa mẫu này?" onConfirm={() => handleDelete(r._id)}>
                        <Button size="small" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                    <Title level={4} style={{ margin: 0 }}>Mẫu tin nhắn</Title>
                    <Text type="secondary">Tạo mẫu tin nhắn để gửi nhanh cho khách hàng, hỗ trợ biến thể và phím tắt.</Text>
                </div>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true); }}>
                    Tạo mẫu
                </Button>
            </div>
            <Table dataSource={macros} columns={columns} rowKey="_id" loading={loading} size="small"
                pagination={{ pageSize: 10 }} locale={{ emptyText: <Empty description="Chưa có mẫu tin nhắn nào" /> }} />
            <Modal title={editing ? 'Chỉnh sửa mẫu' : 'Tạo mẫu mới'} open={modalOpen} onCancel={() => { setModalOpen(false); setEditing(null); }}
                footer={null} width={600}>
                <Form form={form} layout="vertical" onFinish={handleSave} initialValues={{ scope: 'personal', channel: 'all' }}>
                    <Form.Item name="title" label="Tiêu đề" rules={[{ required: true, message: 'Nhập tiêu đề' }]}>
                        <Input placeholder="VD: Chào khách mới" />
                    </Form.Item>
                    <Form.Item name="content" label="Nội dung" rules={[{ required: true, message: 'Nhập nội dung' }]}>
                        <Input.TextArea rows={4} placeholder="Xin chào {{customer_name}}, cảm ơn bạn đã liên hệ!" />
                    </Form.Item>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                        <Form.Item name="shortcut" label="Phím tắt">
                            <Input placeholder="/hello" />
                        </Form.Item>
                        <Form.Item name="channel" label="Kênh áp dụng">
                            <Select options={[
                                { value: 'all', label: 'Tất cả' },
                                { value: 'widget', label: 'Website' },
                                { value: 'zalo', label: 'Zalo' },
                                { value: 'facebook', label: 'Facebook' },
                                { value: 'email', label: 'Email' },
                            ]} />
                        </Form.Item>
                        <Form.Item name="scope" label="Phạm vi">
                            <Select options={[
                                { value: 'personal', label: 'Cá nhân' },
                                { value: 'team', label: 'Nhóm' },
                            ]} />
                        </Form.Item>
                    </div>
                    <Form.Item name="category" label="Danh mục">
                        <Input placeholder="VD: Chào hỏi, Hỗ trợ, Thanh toán" />
                    </Form.Item>
                    <div style={{ textAlign: 'right' }}>
                        <Button onClick={() => { setModalOpen(false); setEditing(null); }} style={{ marginRight: 8 }}>Hủy</Button>
                        <Button type="primary" htmlType="submit">Lưu</Button>
                    </div>
                </Form>
            </Modal>
        </div>
    );
}

// ════════════════════════════════════════════
// Distribution Rules (Rule phân phối)
// ════════════════════════════════════════════
function DistributionRuleSettings({ workspaceId }: { workspaceId: string }) {
    const [rules, setRules] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<any>(null);
    const [form] = Form.useForm();

    const fetchRules = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await axios.get(`${API}/distribution-rules/workspace/${workspaceId}`, { headers: getHeaders() });
            setRules(data.data || []);
        } catch { /* ignore */ }
        setLoading(false);
    }, [workspaceId]);

    useEffect(() => { fetchRules(); }, [fetchRules]);

    const handleSave = async (values: any) => {
        try {
            const payload = {
                ...values,
                conditions: values.conditions || [],
                action: { type: values.actionType, agentIds: values.agentIds?.split(',').map((s: string) => s.trim()).filter(Boolean) || [] },
            };
            if (editing) {
                await axios.patch(`${API}/distribution-rules/workspace/${workspaceId}/${editing._id}`, payload, { headers: getHeaders() });
                message.success('Đã cập nhật rule');
            } else {
                await axios.post(`${API}/distribution-rules/workspace/${workspaceId}`, payload, { headers: getHeaders() });
                message.success('Đã tạo rule mới');
            }
            setModalOpen(false); form.resetFields(); setEditing(null); fetchRules();
        } catch (e: any) { message.error(e.response?.data?.message || 'Lỗi'); }
    };

    const handleDelete = async (id: string) => {
        try {
            await axios.delete(`${API}/distribution-rules/workspace/${workspaceId}/${id}`, { headers: getHeaders() });
            message.success('Đã xóa'); fetchRules();
        } catch { message.error('Lỗi khi xóa'); }
    };

    const handleToggle = async (id: string, isActive: boolean) => {
        try {
            await axios.patch(`${API}/distribution-rules/workspace/${workspaceId}/${id}`, { isActive }, { headers: getHeaders() });
            fetchRules();
        } catch { message.error('Lỗi'); }
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                    <Title level={4} style={{ margin: 0 }}>Rule phân phối</Title>
                    <Text type="secondary">Tự động phân phối cuộc hội thoại cho agent dựa trên kênh, nguồn, và điều kiện khác.</Text>
                </div>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true); }}>
                    Tạo rule
                </Button>
            </div>
            <Table dataSource={rules} rowKey="_id" loading={loading} size="small" pagination={false}
                locale={{ emptyText: <Empty description="Chưa có rule phân phối nào" /> }}
                columns={[
                    { title: 'Tên', dataIndex: 'name', key: 'name', render: (t: string) => <Text strong>{t}</Text> },
                    { title: 'Ưu tiên', dataIndex: 'priority', key: 'priority', width: 80, render: (p: number) => <Tag color="blue">{p}</Tag> },
                    {
                        title: 'Hành động', dataIndex: 'action', key: 'action',
                        render: (a: any) => <Tag color="purple">{a?.type?.replace(/_/g, ' ')}</Tag>
                    },
                    {
                        title: 'Trạng thái', dataIndex: 'isActive', key: 'isActive', width: 100,
                        render: (active: boolean, r: any) => <Switch size="small" checked={active} onChange={(v) => handleToggle(r._id, v)} />
                    },
                    {
                        title: '', key: 'actions', width: 80,
                        render: (_: any, r: any) => (
                            <Space>
                                <Button size="small" icon={<EditOutlined />} onClick={() => {
                                    setEditing(r); form.setFieldsValue({ ...r, actionType: r.action?.type, agentIds: r.action?.agentIds?.join(', ') }); setModalOpen(true);
                                }} />
                                <Popconfirm title="Xóa rule này?" onConfirm={() => handleDelete(r._id)}>
                                    <Button size="small" danger icon={<DeleteOutlined />} />
                                </Popconfirm>
                            </Space>
                        ),
                    },
                ]} />
            <Modal title={editing ? 'Chỉnh sửa rule' : 'Tạo rule mới'} open={modalOpen} onCancel={() => { setModalOpen(false); setEditing(null); }}
                footer={null} width={600}>
                <Form form={form} layout="vertical" onFinish={handleSave} initialValues={{ conditionLogic: 'all', priority: 0 }}>
                    <Form.Item name="name" label="Tên rule" rules={[{ required: true }]}>
                        <Input placeholder="VD: Facebook → Nhóm Sale" />
                    </Form.Item>
                    <Form.Item name="description" label="Mô tả">
                        <Input.TextArea rows={2} />
                    </Form.Item>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <Form.Item name="priority" label="Độ ưu tiên">
                            <InputNumber min={0} max={100} style={{ width: '100%' }} />
                        </Form.Item>
                        <Form.Item name="conditionLogic" label="Logic điều kiện">
                            <Select options={[{ value: 'all', label: 'Tất cả điều kiện (AND)' }, { value: 'any', label: 'Bất kỳ (OR)' }]} />
                        </Form.Item>
                    </div>
                    <Form.Item name="actionType" label="Hành động phân phối" rules={[{ required: true }]}>
                        <Select options={[
                            { value: 'assign_agent', label: 'Gán cho agent cụ thể' },
                            { value: 'round_robin', label: 'Luân phiên' },
                            { value: 'least_busy', label: 'Agent ít bận nhất' },
                            { value: 'previous_agent', label: 'Agent cũ (đã hỗ trợ trước đó)' },
                        ]} />
                    </Form.Item>
                    <Form.Item name="agentIds" label="Agent IDs (cách nhau dấu phẩy)">
                        <Input placeholder="agent_id_1, agent_id_2" />
                    </Form.Item>
                    <div style={{ textAlign: 'right' }}>
                        <Button onClick={() => { setModalOpen(false); setEditing(null); }} style={{ marginRight: 8 }}>Hủy</Button>
                        <Button type="primary" htmlType="submit">Lưu</Button>
                    </div>
                </Form>
            </Modal>
        </div>
    );
}

// ════════════════════════════════════════════
// Business Hours (Giờ làm việc)
// ════════════════════════════════════════════
const DAY_NAMES = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

function BusinessHoursSettings({ workspaceId }: { workspaceId: string }) {
    const [config, setConfig] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const fetchConfig = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await axios.get(`${API}/business-hours/workspace/${workspaceId}`, { headers: getHeaders() });
            if (data.data) {
                setConfig(data.data);
            } else {
                // Default schedule
                setConfig({
                    timezone: 'Asia/Ho_Chi_Minh',
                    schedule: [0, 1, 2, 3, 4, 5, 6].map(d => ({ day: d, startTime: '08:00', endTime: '17:30', isActive: d >= 1 && d <= 5 })),
                    holidays: [],
                    offlineAction: 'custom_message',
                    offlineMessage: 'Chúng tôi hiện ngoài giờ làm việc. Vui lòng để lại tin nhắn!',
                    isActive: true,
                });
            }
        } catch { /* ignore */ }
        setLoading(false);
    }, [workspaceId]);

    useEffect(() => { fetchConfig(); }, [fetchConfig]);

    const handleSave = async () => {
        setSaving(true);
        try {
            await axios.put(`${API}/business-hours/workspace/${workspaceId}`, config, { headers: getHeaders() });
            message.success('Đã lưu giờ làm việc');
        } catch { message.error('Lỗi khi lưu'); }
        setSaving(false);
    };

    const updateSchedule = (index: number, field: string, value: any) => {
        const newSchedule = [...config.schedule];
        newSchedule[index] = { ...newSchedule[index], [field]: value };
        setConfig({ ...config, schedule: newSchedule });
    };

    if (loading) return <Spin />;

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                    <Title level={4} style={{ margin: 0 }}>Giờ làm việc</Title>
                    <Text type="secondary">Thiết lập khung giờ làm việc và hành động khi ngoài giờ.</Text>
                </div>
                <Space>
                    <Switch checked={config?.isActive} onChange={v => setConfig({ ...config, isActive: v })} checkedChildren="Hoạt động" unCheckedChildren="Tắt" />
                    <Button type="primary" onClick={handleSave} loading={saving}>Lưu</Button>
                </Space>
            </div>

            <div style={{ background: 'var(--color-bg-soft, #f6f8fa)', borderRadius: 12, padding: 20, marginBottom: 20 }}>
                <Text strong style={{ marginBottom: 12, display: 'block' }}>Lịch làm việc hàng tuần</Text>
                {config?.schedule?.map((s: any, i: number) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, padding: '8px 12px', background: s.isActive ? 'var(--color-bg, #fff)' : 'transparent', borderRadius: 8, opacity: s.isActive ? 1 : 0.5 }}>
                        <Switch size="small" checked={s.isActive} onChange={v => updateSchedule(i, 'isActive', v)} />
                        <Text style={{ width: 80, fontWeight: 500 }}>{DAY_NAMES[s.day]}</Text>
                        <Input size="small" value={s.startTime} onChange={e => updateSchedule(i, 'startTime', e.target.value)} style={{ width: 80 }} placeholder="08:00" disabled={!s.isActive} />
                        <Text type="secondary">→</Text>
                        <Input size="small" value={s.endTime} onChange={e => updateSchedule(i, 'endTime', e.target.value)} style={{ width: 80 }} placeholder="17:30" disabled={!s.isActive} />
                    </div>
                ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                    <Text strong>Hành động ngoài giờ</Text>
                    <Select value={config?.offlineAction} onChange={v => setConfig({ ...config, offlineAction: v })} style={{ width: '100%', marginTop: 8 }}
                        options={[
                            { value: 'custom_message', label: 'Hiện tin nhắn tùy chỉnh' },
                            { value: 'bot_reply', label: 'Bot tự động trả lời' },
                            { value: 'show_form', label: 'Hiện form để lại thông tin' },
                        ]} />
                </div>
                <div>
                    <Text strong>Tin nhắn ngoài giờ</Text>
                    <Input.TextArea rows={2} value={config?.offlineMessage} onChange={e => setConfig({ ...config, offlineMessage: e.target.value })} style={{ marginTop: 8 }} />
                </div>
            </div>
        </div>
    );
}

// ════════════════════════════════════════════
// Product Management (Sản phẩm)
// ════════════════════════════════════════════
function ProductSettings({ workspaceId }: { workspaceId: string }) {
    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [syncModalOpen, setSyncModalOpen] = useState(false);
    const [editing, setEditing] = useState<any>(null);
    const [sheetUrl, setSheetUrl] = useState('');
    const [syncing, setSyncing] = useState(false);
    const [form] = Form.useForm();
    const [total, setTotal] = useState(0);

    const fetchProducts = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await axios.get(`${API}/products/workspace/${workspaceId}`, { headers: getHeaders() });
            setProducts(data.data?.products || []);
            setTotal(data.data?.total || 0);
        } catch { /* ignore */ }
        setLoading(false);
    }, [workspaceId]);

    useEffect(() => { fetchProducts(); }, [fetchProducts]);

    const handleSave = async (values: any) => {
        try {
            if (editing) {
                await axios.patch(`${API}/products/workspace/${workspaceId}/${editing._id}`, values, { headers: getHeaders() });
                message.success('Đã cập nhật sản phẩm');
            } else {
                await axios.post(`${API}/products/workspace/${workspaceId}`, values, { headers: getHeaders() });
                message.success('Đã tạo sản phẩm mới');
            }
            setModalOpen(false); form.resetFields(); setEditing(null); fetchProducts();
        } catch (e: any) { message.error(e.response?.data?.message || 'Lỗi'); }
    };

    const handleSync = async () => {
        if (!sheetUrl.trim()) { message.warning('Nhập link Google Sheet'); return; }
        setSyncing(true);
        try {
            const { data } = await axios.post(`${API}/products/workspace/${workspaceId}/sync-google-sheet`, { sheetUrl }, { headers: getHeaders() });
            message.success(`Đồng bộ thành công: ${data.data?.imported || 0} sản phẩm`);
            if (data.data?.errors?.length) message.warning(`${data.data.errors.length} lỗi`);
            setSyncModalOpen(false); setSheetUrl(''); fetchProducts();
        } catch (e: any) { message.error(e.response?.data?.message || 'Lỗi đồng bộ'); }
        setSyncing(false);
    };

    const handleDelete = async (id: string) => {
        try {
            await axios.delete(`${API}/products/workspace/${workspaceId}/${id}`, { headers: getHeaders() });
            message.success('Đã xóa'); fetchProducts();
        } catch { message.error('Lỗi'); }
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                    <Title level={4} style={{ margin: 0 }}>Đồng bộ sản phẩm</Title>
                    <Text type="secondary">Quản lý sản phẩm, đồng bộ từ Google Sheet hoặc tạo thủ công. Tổng: <strong>{total}</strong></Text>
                </div>
                <Space>
                    <Button icon={<SyncOutlined />} onClick={() => setSyncModalOpen(true)}>Đồng bộ Google Sheet</Button>
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true); }}>Tạo mới</Button>
                </Space>
            </div>
            <Table dataSource={products} rowKey="_id" loading={loading} size="small" pagination={{ pageSize: 10 }}
                locale={{ emptyText: <Empty description="Chưa có sản phẩm" /> }}
                columns={[
                    { title: 'Tên', dataIndex: 'name', key: 'name', render: (n: string, r: any) => <><Text strong>{n}</Text>{r.sku ? <Text type="secondary" style={{ marginLeft: 8 }}>#{r.sku}</Text> : null}</> },
                    { title: 'Giá', dataIndex: 'price', key: 'price', width: 120, render: (p: number) => <Text>{p?.toLocaleString('vi-VN')} ₫</Text> },
                    { title: 'Tồn kho', dataIndex: 'stock', key: 'stock', width: 80 },
                    { title: 'Nguồn', dataIndex: 'source', key: 'source', width: 120, render: (s: string) => <Tag color={s === 'google_sheet' ? 'green' : 'default'}>{s}</Tag> },
                    {
                        title: '', key: 'actions', width: 80,
                        render: (_: any, r: any) => (
                            <Space>
                                <Button size="small" icon={<EditOutlined />} onClick={() => { setEditing(r); form.setFieldsValue(r); setModalOpen(true); }} />
                                <Popconfirm title="Xóa sản phẩm?" onConfirm={() => handleDelete(r._id)}>
                                    <Button size="small" danger icon={<DeleteOutlined />} />
                                </Popconfirm>
                            </Space>
                        ),
                    },
                ]} />

            {/* Sync Modal */}
            <Modal title="Tạo đồng bộ Google Sheet" open={syncModalOpen} onCancel={() => setSyncModalOpen(false)} footer={null} width={520}>
                <div style={{ marginBottom: 16 }}>
                    <Text type="secondary">Dán link Google Sheet công khai. Sheet cần có cột: Tên (name), Giá (price). Các cột tùy chọn: SKU, Mô tả, Danh mục, Tồn kho, Hình ảnh.</Text>
                </div>
                <Input placeholder="Link Google Sheet" value={sheetUrl} onChange={e => setSheetUrl(e.target.value)} style={{ marginBottom: 16 }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Switch defaultChecked checkedChildren="Hoạt động" unCheckedChildren="Tắt" />
                    <Button type="primary" onClick={handleSync} loading={syncing}>Lấy dữ liệu</Button>
                </div>
            </Modal>

            {/* Create/Edit Modal */}
            <Modal title={editing ? 'Chỉnh sửa sản phẩm' : 'Tạo sản phẩm'} open={modalOpen} onCancel={() => { setModalOpen(false); setEditing(null); }}
                footer={null} width={600}>
                <Form form={form} layout="vertical" onFinish={handleSave} initialValues={{ price: 0, stock: 0, currency: 'VND' }}>
                    <Form.Item name="name" label="Tên sản phẩm" rules={[{ required: true }]}>
                        <Input />
                    </Form.Item>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                        <Form.Item name="price" label="Giá" rules={[{ required: true }]}>
                            <InputNumber min={0} style={{ width: '100%' }} />
                        </Form.Item>
                        <Form.Item name="stock" label="Tồn kho">
                            <InputNumber min={0} style={{ width: '100%' }} />
                        </Form.Item>
                        <Form.Item name="sku" label="Mã SKU">
                            <Input />
                        </Form.Item>
                    </div>
                    <Form.Item name="description" label="Mô tả">
                        <Input.TextArea rows={2} />
                    </Form.Item>
                    <Form.Item name="category" label="Danh mục">
                        <Input placeholder="VD: Điện thoại, Phụ kiện" />
                    </Form.Item>
                    <div style={{ textAlign: 'right' }}>
                        <Button onClick={() => setModalOpen(false)} style={{ marginRight: 8 }}>Hủy</Button>
                        <Button type="primary" htmlType="submit">Lưu</Button>
                    </div>
                </Form>
            </Modal>
        </div>
    );
}

// ════════════════════════════════════════════
// Tax Management (Thuế)
// ════════════════════════════════════════════
function TaxSettings({ workspaceId }: { workspaceId: string }) {
    const [taxes, setTaxes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<any>(null);
    const [form] = Form.useForm();

    const fetchTaxes = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await axios.get(`${API}/taxes/workspace/${workspaceId}`, { headers: getHeaders() });
            setTaxes(data.data || []);
        } catch { /* ignore */ }
        setLoading(false);
    }, [workspaceId]);

    useEffect(() => { fetchTaxes(); }, [fetchTaxes]);

    const handleSave = async (values: any) => {
        try {
            if (editing) {
                await axios.patch(`${API}/taxes/workspace/${workspaceId}/${editing._id}`, values, { headers: getHeaders() });
                message.success('Đã cập nhật');
            } else {
                await axios.post(`${API}/taxes/workspace/${workspaceId}`, values, { headers: getHeaders() });
                message.success('Đã tạo thuế mới');
            }
            setModalOpen(false); form.resetFields(); setEditing(null); fetchTaxes();
        } catch (e: any) { message.error(e.response?.data?.message || 'Lỗi'); }
    };

    const handleDelete = async (id: string) => {
        try {
            await axios.delete(`${API}/taxes/workspace/${workspaceId}/${id}`, { headers: getHeaders() });
            message.success('Đã xóa'); fetchTaxes();
        } catch { message.error('Lỗi'); }
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                    <Title level={4} style={{ margin: 0 }}>Thuế</Title>
                    <Text type="secondary">Quản lý cách tính các loại thuế trên đơn hàng của bạn.</Text>
                </div>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true); }}>
                    Thêm thuế
                </Button>
            </div>
            <Table dataSource={taxes} rowKey="_id" loading={loading} size="small" pagination={false}
                locale={{ emptyText: <Empty description="Chưa có loại thuế nào" /> }}
                columns={[
                    { title: 'Tên', dataIndex: 'name', key: 'name', render: (t: string) => <Text strong>{t}</Text> },
                    { title: 'Thuế suất', dataIndex: 'rate', key: 'rate', width: 100, render: (r: number) => `${r}%` },
                    { title: 'Ngôn ngữ', dataIndex: 'locale', key: 'locale', width: 100, render: (l: string) => <Tag>{l}</Tag> },
                    {
                        title: '', key: 'actions', width: 80,
                        render: (_: any, r: any) => (
                            <Space>
                                <Button size="small" icon={<EditOutlined />} onClick={() => { setEditing(r); form.setFieldsValue(r); setModalOpen(true); }} />
                                <Popconfirm title="Xóa thuế này?" onConfirm={() => handleDelete(r._id)}>
                                    <Button size="small" danger icon={<DeleteOutlined />} />
                                </Popconfirm>
                            </Space>
                        ),
                    },
                ]} />
            <Modal title={editing ? 'Chỉnh sửa thuế' : 'Thêm thuế'} open={modalOpen} onCancel={() => { setModalOpen(false); setEditing(null); }}
                footer={null} width={400}>
                <Form form={form} layout="vertical" onFinish={handleSave} initialValues={{ rate: 0, locale: 'vi-VN' }}>
                    <Form.Item name="locale" label="Ngôn ngữ">
                        <Select options={[{ value: 'vi-VN', label: 'vi-VN' }, { value: 'en-US', label: 'en-US' }]} />
                    </Form.Item>
                    <Form.Item name="name" label="Tên" rules={[{ required: true, message: 'Nhập tên thuế' }]}>
                        <Input placeholder="Thuế GTGT" />
                    </Form.Item>
                    <Form.Item name="rate" label="Thuế suất (%)" rules={[{ required: true }]}>
                        <InputNumber min={0} max={100} style={{ width: '100%' }} />
                    </Form.Item>
                    <div style={{ textAlign: 'right' }}>
                        <Button onClick={() => { setModalOpen(false); setEditing(null); }} style={{ marginRight: 8 }}>Hủy</Button>
                        <Button type="primary" htmlType="submit">Tạo mới</Button>
                    </div>
                </Form>
            </Modal>
        </div>
    );
}

// ════════════════════════════════════════════
// Email Integration
// ════════════════════════════════════════════
function EmailSettings({ workspaceId }: { workspaceId: string }) {
    const [accounts, setAccounts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [form] = Form.useForm();

    const fetchAccounts = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await axios.get(`${API}/email-accounts/workspace/${workspaceId}`, { headers: getHeaders() });
            setAccounts(data.data || []);
        } catch { /* ignore */ }
        setLoading(false);
    }, [workspaceId]);

    useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

    const handleSave = async (values: any) => {
        try {
            const payload = {
                ...values,
                smtp: { host: values.smtpHost, port: values.smtpPort, secure: values.smtpSecure, user: values.smtpUser, password: values.smtpPassword },
                imap: { host: values.imapHost, port: values.imapPort, secure: values.imapSecure, user: values.imapUser, password: values.imapPassword },
            };
            await axios.post(`${API}/email-accounts/workspace/${workspaceId}`, payload, { headers: getHeaders() });
            message.success('Đã thêm email');
            setModalOpen(false); form.resetFields(); fetchAccounts();
        } catch (e: any) { message.error(e.response?.data?.message || 'Lỗi'); }
    };

    const handleDelete = async (id: string) => {
        try {
            await axios.delete(`${API}/email-accounts/workspace/${workspaceId}/${id}`, { headers: getHeaders() });
            message.success('Đã xóa'); fetchAccounts();
        } catch { message.error('Lỗi'); }
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                    <Title level={4} style={{ margin: 0 }}>Danh sách email</Title>
                    <Text type="secondary">Danh sách địa chỉ email nhận và gửi đi trên Subiz.</Text>
                </div>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setModalOpen(true); }}>
                    + Thêm email
                </Button>
            </div>
            <Table dataSource={accounts} rowKey="_id" loading={loading} size="small" pagination={false}
                locale={{ emptyText: <Empty description="Chưa có email nào được tích hợp" /> }}
                columns={[
                    { title: 'Email', dataIndex: 'email', key: 'email', render: (e: string) => <Text strong>{e}</Text> },
                    { title: 'Tên hiển thị', dataIndex: 'displayName', key: 'displayName' },
                    { title: 'Cho phép nhận', dataIndex: 'allowReceive', key: 'r', width: 100, render: (v: boolean) => <Tag color={v ? 'green' : 'red'}>{v ? 'Có' : 'Không'}</Tag> },
                    { title: 'Cho phép gửi', dataIndex: 'allowSend', key: 's', width: 100, render: (v: boolean) => <Tag color={v ? 'green' : 'red'}>{v ? 'Có' : 'Không'}</Tag> },
                    { title: 'Loại phiếu', dataIndex: 'ticketType', key: 'type', width: 100 },
                    {
                        title: '', key: 'actions', width: 50,
                        render: (_: any, r: any) => (
                            <Popconfirm title="Xóa email này?" onConfirm={() => handleDelete(r._id)}>
                                <Button size="small" danger icon={<DeleteOutlined />} />
                            </Popconfirm>
                        ),
                    },
                ]} />
            <Modal title="Thêm email" open={modalOpen} onCancel={() => setModalOpen(false)} footer={null} width={600}>
                <Form form={form} layout="vertical" onFinish={handleSave}
                    initialValues={{ smtpPort: 587, smtpSecure: false, imapPort: 993, imapSecure: true, allowReceive: true, allowSend: true }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <Form.Item name="email" label="Địa chỉ email" rules={[{ required: true }]}>
                            <Input placeholder="support@example.com" />
                        </Form.Item>
                        <Form.Item name="displayName" label="Tên hiển thị">
                            <Input placeholder="Support Team" />
                        </Form.Item>
                    </div>
                    <Divider>SMTP (Gửi mail)</Divider>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12 }}>
                        <Form.Item name="smtpHost" label="Host"><Input placeholder="smtp.gmail.com" /></Form.Item>
                        <Form.Item name="smtpPort" label="Port"><InputNumber style={{ width: '100%' }} /></Form.Item>
                        <Form.Item name="smtpSecure" label="SSL" valuePropName="checked"><Switch /></Form.Item>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <Form.Item name="smtpUser" label="Username"><Input /></Form.Item>
                        <Form.Item name="smtpPassword" label="Password"><Input.Password /></Form.Item>
                    </div>
                    <Divider>IMAP (Nhận mail)</Divider>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12 }}>
                        <Form.Item name="imapHost" label="Host"><Input placeholder="imap.gmail.com" /></Form.Item>
                        <Form.Item name="imapPort" label="Port"><InputNumber style={{ width: '100%' }} /></Form.Item>
                        <Form.Item name="imapSecure" label="SSL" valuePropName="checked"><Switch /></Form.Item>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <Form.Item name="imapUser" label="Username"><Input /></Form.Item>
                        <Form.Item name="imapPassword" label="Password"><Input.Password /></Form.Item>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <Button onClick={() => setModalOpen(false)} style={{ marginRight: 8 }}>Hủy</Button>
                        <Button type="primary" htmlType="submit">Thêm email</Button>
                    </div>
                </Form>
            </Modal>
        </div>
    );
}

// ════════════════════════════════════════════
// Order Management (Đơn hàng)
// ════════════════════════════════════════════
const STATUS_COLORS: Record<string, string> = {
    draft: 'default', pending: 'orange', confirmed: 'blue', shipping: 'cyan',
    delivered: 'green', cancelled: 'red', returned: 'purple',
};
const STATUS_LABELS: Record<string, string> = {
    draft: 'Nháp', pending: 'Chờ xác nhận', confirmed: 'Đã xác nhận', shipping: 'Đang giao',
    delivered: 'Đã giao', cancelled: 'Đã hủy', returned: 'Trả hàng',
};

function OrderSettings({ workspaceId }: { workspaceId: string }) {
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);

    const fetchOrders = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await axios.get(`${API}/orders/workspace/${workspaceId}`, { headers: getHeaders() });
            setOrders(data.data?.orders || []);
            setTotal(data.data?.total || 0);
        } catch { /* ignore */ }
        setLoading(false);
    }, [workspaceId]);

    useEffect(() => { fetchOrders(); }, [fetchOrders]);

    const handleStatusChange = async (orderId: string, status: string) => {
        try {
            await axios.patch(`${API}/orders/workspace/${workspaceId}/${orderId}/status`, { status }, { headers: getHeaders() });
            message.success('Đã cập nhật trạng thái');
            fetchOrders();
        } catch { message.error('Lỗi'); }
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                    <Title level={4} style={{ margin: 0 }}>Đơn hàng</Title>
                    <Text type="secondary">Quản lý đơn hàng — Tổng: <strong>{total}</strong></Text>
                </div>
            </div>
            <Table dataSource={orders} rowKey="_id" loading={loading} size="small" pagination={{ pageSize: 10 }}
                locale={{ emptyText: <Empty description="Chưa có đơn hàng. Đơn hàng được tạo từ cuộc hội thoại." /> }}
                columns={[
                    { title: 'Mã đơn', dataIndex: 'orderNumber', key: 'no', render: (n: string) => <Text strong>{n}</Text> },
                    { title: 'Khách hàng', dataIndex: 'customerName', key: 'c' },
                    { title: 'Tổng', dataIndex: 'total', key: 'total', width: 130, render: (t: number) => <Text strong>{t?.toLocaleString('vi-VN')} ₫</Text> },
                    {
                        title: 'Trạng thái', dataIndex: 'status', key: 'status', width: 150,
                        render: (s: string, r: any) => (
                            <Select size="small" value={s} onChange={v => handleStatusChange(r._id, v)} style={{ width: 130 }}
                                options={Object.entries(STATUS_LABELS).map(([k, v]) => ({ value: k, label: v }))} />
                        ),
                    },
                    { title: 'Ngày tạo', dataIndex: 'createdAt', key: 'date', width: 140, render: (d: string) => new Date(d).toLocaleDateString('vi-VN') },
                ]} />
        </div>
    );
}

// ════════════════════════════════════════════
// Tag Settings (Phân loại khách hàng)
// ════════════════════════════════════════════
function TagSettings({ workspaceId }: { workspaceId: string }) {
    const [tagInput, setTagInput] = useState('');
    const [addingTag, setAddingTag] = useState(false);
    const { data: tagsRes } = useWorkspaceTags(workspaceId);
    const tags = tagsRes?.data || [];
    const addTag = useAddWorkspaceTag();
    const removeTag = useRemoveWorkspaceTag();

    const handleAddTag = async () => {
        if (!tagInput || !tagInput.trim()) return;
        const newTag = tagInput.trim();
        if (tags.includes(newTag)) {
            message.warning('Tag đã tồn tại!');
            return;
        }
        setAddingTag(true);
        try {
            await addTag.mutateAsync({ workspaceId, tag: newTag });
            setTagInput('');
        } catch (error: any) {
            message.error(error.response?.data?.message || 'Lỗi khi thêm tag');
        } finally {
            setAddingTag(false);
        }
    };

    const handleRemoveTag = async (removedTag: string) => {
        try {
            await removeTag.mutateAsync({ workspaceId, tag: removedTag });
        } catch (error: any) {
            message.error(error.response?.data?.message || 'Lỗi khi xóa tag');
        }
    };

    return (
        <div>
            <div style={{ marginBottom: 16 }}>
                <Typography.Title level={4} style={{ margin: 0 }}>Phân loại khách hàng (Tags)</Typography.Title>
                <Typography.Text type="secondary" style={{ fontSize: 13, display: 'block', marginTop: 8 }}>
                    Định nghĩa các thẻ (tags) để phân loại khách hàng trong workspace (ví dụ: VIP, Tiềm năng, Sắp chốt...).
                    Agent có thể gắn các tag này cho cuộc hội thoại.
                </Typography.Text>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                {tags.length === 0 ? (
                    <Typography.Text type="secondary" style={{ fontStyle: 'italic', fontSize: 13 }}>Chưa có thẻ nào.</Typography.Text>
                ) : (
                    tags.map((tag: string) => (
                        <Tag
                            key={tag}
                            closable
                            onClose={(e) => { e.preventDefault(); handleRemoveTag(tag); }}
                            color="blue"
                            style={{ padding: '4px 10px', fontSize: 13 }}
                        >
                            {tag}
                        </Tag>
                    ))
                )}
            </div>
            <Space>
                <Input
                    placeholder="Nhập thẻ mới (VD: VIP)"
                    value={tagInput}
                    onChange={e => setTagInput(e.target.value)}
                    onPressEnter={(e) => { e.preventDefault(); handleAddTag(); }}
                    style={{ width: 200 }}
                />
                <Button type="dashed" icon={<PlusOutlined />} onClick={handleAddTag} loading={addingTag}>
                    Thêm Thẻ
                </Button>
            </Space>
        </div>
    );
}

// ════════════════════════════════════════════
// MAIN SETTINGS PAGE
// ════════════════════════════════════════════
const SIDEBAR_SECTIONS = [
    {
        group: 'TÀI KHOẢN',
        items: [
            { key: 'general', label: 'Thông tin', icon: <SettingOutlined /> },
            { key: 'agents', label: 'Agent', icon: <TeamOutlined /> },
        ],
    },
    {
        group: 'TÍCH HỢP',
        items: [
            { key: 'widget', label: 'Widget website', icon: <GlobalOutlined /> },
            { key: 'zalo', label: 'Zalo', icon: <MessageOutlined /> },
            { key: 'facebook', label: 'Facebook', icon: <FacebookOutlined /> },
            { key: 'email', label: 'Email', icon: <MailOutlined /> },
            { key: 'webhook', label: 'Webhook', icon: <ApiOutlined /> },
        ],
    },
    {
        group: 'HỘI THOẠI',
        items: [
            { key: 'templates', label: 'Mẫu tin nhắn', icon: <FileTextOutlined /> },
            { key: 'distribution', label: 'Rule phân phối', icon: <BranchesOutlined /> },
            { key: 'tags', label: 'Tag', icon: <TagOutlined /> },
            { key: 'business-hours', label: 'Giờ làm việc', icon: <ClockCircleOutlined /> },
            { key: 'knowledge', label: 'Kiến thức AI', icon: <RobotOutlined /> },
        ],
    },
    {
        group: 'SẢN PHẨM',
        items: [
            { key: 'products', label: 'Đồng bộ sản phẩm', icon: <ShopOutlined /> },
            { key: 'taxes', label: 'Thuế', icon: <DollarOutlined /> },
        ],
    },
    {
        group: 'ĐƠN HÀNG',
        items: [
            { key: 'orders', label: 'Quản lý đơn', icon: <ShoppingCartOutlined /> },
        ],
    },
];

function SettingsPlaceholder({
    title,
    description,
    icon,
    action,
}: {
    title: string;
    description: string;
    icon: React.ReactNode;
    action?: React.ReactNode;
}) {
    return (
        <section className="settings-placeholder">
            <div className="settings-placeholder-icon">{icon}</div>
            <div className="settings-placeholder-body">
                <span className="enterprise-kicker">
                    <span style={{ width: 7, height: 7, borderRadius: 999, background: '#f79009' }} />
                    Đang hoàn thiện
                </span>
                <h2>{title}</h2>
                <p>{description}</p>
                {action && <div className="settings-placeholder-action">{action}</div>}
            </div>
        </section>
    );
}

function WebhookSettings({ workspaceId }: { workspaceId: string }) {
    const webhookUrl = `${typeof window !== 'undefined' ? window.location.origin : 'https://nemarkchat.com'}/api/workspaces/${workspaceId}/webhooks/inbound`;
    const signingSecret = `whsec_${workspaceId.slice(0, 8)}_local_default`;
    const events = [
        { name: 'conversation.created', desc: 'Khi co hoi thoai moi tu Web chat, Zalo hoac Facebook.', enabled: true },
        { name: 'message.created', desc: 'Khi khach hoac agent gui tin nhan moi.', enabled: true },
        { name: 'lead.created', desc: 'Khi he thong ghi nhan lead moi tu form/popup/chat.', enabled: true },
        { name: 'order.created', desc: 'Khi don hang moi duoc tao trong workspace.', enabled: false },
        { name: 'payment.paid', desc: 'Khi hoa don duoc auto bank xac nhan thanh toan.', enabled: true },
    ];
    const deliveries = [
        { id: 'evt_1042', event: 'message.created', status: 'Thanh cong', code: 200, latency: '184ms', time: '2 phut truoc' },
        { id: 'evt_1041', event: 'conversation.created', status: 'Thanh cong', code: 200, latency: '221ms', time: '11 phut truoc' },
        { id: 'evt_1039', event: 'lead.created', status: 'Dang retry', code: 500, latency: '2.4s', time: '34 phut truoc' },
    ];
    const payload = `{
  "id": "evt_1042",
  "event": "message.created",
  "workspaceId": "${workspaceId}",
  "createdAt": "2026-07-06T06:45:08.000Z",
  "data": {
    "conversationId": "conv_123",
    "channel": "zalo",
    "customer": { "name": "Ngoc Diem" },
    "message": { "type": "text", "text": "Can tu van goi Pro" }
  }
}`;

    const copy = async (text: string, label: string) => {
        try {
            await navigator.clipboard.writeText(text);
            message.success(`Da copy ${label}`);
        } catch {
            message.error('Khong the copy');
        }
    };

    return (
        <div className="webhook-settings">
            <section className="webhook-card webhook-intro">
                <div>
                    <span className="enterprise-kicker">
                        <span style={{ width: 7, height: 7, borderRadius: 999, background: '#12b76a' }} />
                        Webhook runtime san sang
                    </span>
                    <h2>Dong bo su kien workspace ra he thong ngoai</h2>
                    <p>Gui su kien hoi thoai, lead, don hang va thanh toan sang CRM, ERP, n8n hoac backend rieng. Nen verify chu ky truoc khi xu ly du lieu khach hang.</p>
                </div>
                <div className="webhook-status-grid">
                    <div><strong>5</strong><span>Events</span></div>
                    <div><strong>3</strong><span>Retries</span></div>
                    <div><strong>HMAC</strong><span>Signature</span></div>
                </div>
            </section>

            <section className="webhook-card">
                <div className="webhook-section-head">
                    <div>
                        <h3>Endpoint nhan webhook</h3>
                        <p>He thong doi tac can expose URL HTTPS va tra ve HTTP 2xx trong 10 giay.</p>
                    </div>
                    <Button icon={<SyncOutlined />}>Gui thu</Button>
                </div>
                <div className="webhook-field">
                    <span>Webhook URL</span>
                    <code>{webhookUrl}</code>
                    <Button size="small" onClick={() => copy(webhookUrl, 'Webhook URL')}>Copy</Button>
                </div>
                <div className="webhook-field">
                    <span>Signing secret</span>
                    <code>{signingSecret}</code>
                    <Button size="small" onClick={() => copy(signingSecret, 'Signing secret')}>Copy</Button>
                </div>
                <div className="webhook-hint">
                    Header gui di: <code>x-nemark-event</code>, <code>x-nemark-signature</code>, <code>x-nemark-delivery</code>.
                </div>
            </section>

            <section className="webhook-grid">
                <div className="webhook-card">
                    <div className="webhook-section-head compact">
                        <div>
                            <h3>Su kien dang bat</h3>
                            <p>Chon dung su kien de tranh spam endpoint doi tac.</p>
                        </div>
                    </div>
                    <div className="webhook-events">
                        {events.map((event) => (
                            <div key={event.name} className="webhook-event-row">
                                <Switch size="small" checked={event.enabled} />
                                <div>
                                    <strong>{event.name}</strong>
                                    <span>{event.desc}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="webhook-card">
                    <div className="webhook-section-head compact">
                        <div>
                            <h3>Chinh sach retry</h3>
                            <p>Neu endpoint loi, he thong gui lai theo backoff.</p>
                        </div>
                    </div>
                    <div className="webhook-policy">
                        <div><span>Timeout</span><strong>10s</strong></div>
                        <div><span>Retry</span><strong>3 lan</strong></div>
                        <div><span>Backoff</span><strong>1m / 5m / 30m</strong></div>
                        <div><span>Idempotency</span><strong>x-nemark-delivery</strong></div>
                    </div>
                </div>
            </section>

            <section className="webhook-card">
                <div className="webhook-section-head">
                    <div>
                        <h3>Payload mau</h3>
                        <p>Dung mau nay de test parser, verify HMAC va mapping CRM.</p>
                    </div>
                    <Button size="small" onClick={() => copy(payload, 'payload mau')}>Copy JSON</Button>
                </div>
                <pre className="webhook-payload">{payload}</pre>
            </section>

            <section className="webhook-card">
                <div className="webhook-section-head">
                    <div>
                        <h3>Lich su giao webhook</h3>
                        <p>Theo doi response code, do tre va trang thai retry gan nhat.</p>
                    </div>
                </div>
                <Table
                    size="small"
                    pagination={false}
                    rowKey="id"
                    dataSource={deliveries}
                    columns={[
                        { title: 'Delivery', dataIndex: 'id', render: (value: string) => <Text code>{value}</Text> },
                        { title: 'Event', dataIndex: 'event' },
                        { title: 'Status', dataIndex: 'status', render: (value: string) => <Tag color={value === 'Thanh cong' ? 'green' : 'orange'}>{value}</Tag> },
                        { title: 'HTTP', dataIndex: 'code' },
                        { title: 'Latency', dataIndex: 'latency' },
                        { title: 'Thoi gian', dataIndex: 'time' },
                    ]}
                />
            </section>
        </div>
    );
}

export default function WorkspaceSettingsPage() {
    const router = useRouter();
    const { workspaceId } = router.query;
    const [ready, setReady] = useState(false);
    const [activeTab, setActiveTab] = useState('general');
    const [isMobile, setIsMobile] = useState(false);
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth < 768);
        check();
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, []);

    // Sync activeTab with URL query param
    useEffect(() => {
        if (router.isReady) {
            const tab = router.query.tab as string;
            if (tab) setActiveTab(tab);
        }
    }, [router.isReady, router.query.tab]);

    useEffect(() => {
        const t = localStorage.getItem('nemark_token');
        setReady(true);
        if (!t) router.replace('/auth/login');
    }, [router]);

    if (!ready || !workspaceId) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg-soft)' }}>
                <Spin size="large" />
            </div>
        );
    }

    const wsId = workspaceId as string;
    const allSettingsItems = SIDEBAR_SECTIONS.flatMap(section => section.items.map(item => ({ ...item, group: section.group })));
    const activeItem = allSettingsItems.find(item => item.key === activeTab);
    const activeLabel = activeItem?.label || 'Cài đặt';
    const activeGroup = activeItem?.group || 'TỔNG QUAN';
    const completedItems = ['general', 'widget', 'zalo', 'facebook', 'email', 'templates', 'distribution', 'tags', 'business-hours', 'knowledge', 'products', 'taxes', 'orders'];
    const unavailableItems = allSettingsItems.length - completedItems.length;

    const handleTabChange = (key: string) => {
        setActiveTab(key);
        router.push({ pathname: router.pathname, query: { ...router.query, tab: key } }, undefined, { shallow: true });
        if (isMobile) setMobileSidebarOpen(false);
    };

    const renderContent = () => {
        switch (activeTab) {
            case 'general': return <WorkspaceSettingsForm workspaceId={wsId} />;
            case 'agents': return (
                <SettingsPlaceholder
                    icon={<TeamOutlined />}
                    title="Agent"
                    description="Phần quản lý agent sẽ được gom vào màn Đội ngũ để theo dõi vai trò, quyền truy cập và thành viên hỗ trợ."
                    action={(
                        <Button type="primary" icon={<TeamOutlined />} onClick={() => router.push(`/workspace/${wsId}/teams`)}>
                            Mở Đội ngũ
                        </Button>
                    )}
                />
            );
            case 'widget': return (
                <SettingsPlaceholder
                    icon={<GlobalOutlined />}
                    title="Widget website"
                    description="Thiết kế giao diện chat, lời chào, form thu thông tin, domain cho phép và lấy mã nhúng website tại một màn hình chuyên dụng."
                    action={(
                        <Button type="primary" icon={<GlobalOutlined />} onClick={() => router.push(`/workspace/${wsId}/widgets`)}>
                            Mở cấu hình Widget
                        </Button>
                    )}
                />
            );
            case 'zalo': return <ZaloIntegrationSettings workspaceId={wsId} />;
            case 'facebook': return <FacebookIntegrationSettings workspaceId={wsId} />;
            case 'email': return <EmailSettings workspaceId={wsId} />;
            case 'webhook': return <WebhookSettings workspaceId={wsId} />;
            case 'templates': return <MessageTemplateSettings workspaceId={wsId} />;
            case 'distribution': return <DistributionRuleSettings workspaceId={wsId} />;
            case 'business-hours': return <BusinessHoursSettings workspaceId={wsId} />;
            case 'tags': return <TagSettings workspaceId={wsId} />;
            case 'knowledge': return <KnowledgeSettings workspaceId={wsId} />;
            case 'products': return <ProductSettings workspaceId={wsId} />;
            case 'taxes': return <TaxSettings workspaceId={wsId} />;
            case 'orders': return <OrderSettings workspaceId={wsId} />;
            default: return (
                <SettingsPlaceholder
                    icon={<ThunderboltOutlined />}
                    title="Tính năng đang phát triển"
                    description="Mục này chưa có màn cấu hình riêng trong workspace hiện tại."
                />
            );
        }
    };

    const sidebarContent = (
        <>
            {SIDEBAR_SECTIONS.map(section => (
                <div key={section.group} className="settings-nav-section">
                    <div className="settings-nav-group">
                        {section.group}
                    </div>
                    {section.items.map(item => (
                        <button
                            key={item.key}
                            type="button"
                            onClick={() => handleTabChange(item.key)}
                            className={`settings-nav-item ${activeTab === item.key ? 'is-active' : ''}`}
                        >
                            <span className="settings-nav-icon">{item.icon}</span>
                            <span>{item.label}</span>
                        </button>
                    ))}
                </div>
            ))}
        </>
    );

    return (
        <AppLayout headerTitle="Cài đặt">
            <Head><title>Cài đặt | NemarkChat</title></Head>
            <div className="settings-page">
                {/* ── Mobile Header Bar ── */}
                {isMobile && (
                    <div className="settings-mobile-bar">
                        <button
                            onClick={() => setMobileSidebarOpen(true)}
                            className="settings-mobile-menu"
                            type="button"
                        >
                            <MenuIcon size={18} color="var(--color-text, #333)" />
                        </button>
                        <div>
                            <div className="settings-mobile-title">{activeLabel}</div>
                            <div className="settings-mobile-subtitle">{activeGroup}</div>
                        </div>
                    </div>
                )}

                {/* ── Mobile Sidebar Drawer ── */}
                {isMobile && (
                    <Drawer
                        open={mobileSidebarOpen}
                        onClose={() => setMobileSidebarOpen(false)}
                        placement="left"
                        width={280}
                        title={<span style={{ fontWeight: 800, fontSize: 16 }}>Cài đặt</span>}
                        styles={{ body: { padding: '12px 0' } }}
                    >
                        {sidebarContent}
                    </Drawer>
                )}

                <div className="settings-shell">
                    {/* ── Desktop Sidebar ── */}
                    {!isMobile && (
                        <aside className="settings-side-nav">
                            <div className="settings-side-title">
                                <span className="settings-side-title-icon"><SettingOutlined /></span>
                                <div>
                                    <div>Thiết lập</div>
                                    <span>{allSettingsItems.length} mục cấu hình</span>
                                </div>
                            </div>
                            {sidebarContent}
                        </aside>
                    )}

                    {/* ── Content ── */}
                    <main className="settings-content">
                        <section className="settings-hero">
                            <div>
                                <span className="enterprise-kicker">
                                    <span style={{ width: 7, height: 7, borderRadius: 999, background: '#12b76a' }} />
                                    Workspace đang hoạt động
                                </span>
                                <h1>{activeLabel}</h1>
                                <p>Quản lý các cấu hình vận hành, kênh kết nối và tự động hóa trong cùng một không gian.</p>
                            </div>
                            <div className="settings-hero-metrics">
                                <div>
                                    <span>{SIDEBAR_SECTIONS.length}</span>
                                    <small>Nhóm</small>
                                </div>
                                <div>
                                    <span>{completedItems.length}</span>
                                    <small>Sẵn sàng</small>
                                </div>
                            </div>
                        </section>

                        <div className="settings-content-grid">
                            <div className="settings-main-panel">
                                {renderContent()}
                            </div>
                            {!isMobile && (
                                <aside className="settings-rail">
                                    <section className="settings-rail-card">
                                        <div className="settings-rail-icon"><SettingOutlined /></div>
                                        <div>
                                            <span className="settings-rail-label">Đang mở</span>
                                            <h3>{activeLabel}</h3>
                                            <p>{activeGroup}</p>
                                        </div>
                                    </section>
                                    <section className="settings-rail-card">
                                        <div className="settings-rail-icon teal"><CheckCircleOutlined /></div>
                                        <div>
                                            <span className="settings-rail-label">Tiến độ cấu hình</span>
                                            <h3>{completedItems.length}/{allSettingsItems.length}</h3>
                                            <p>{unavailableItems > 0 ? `${unavailableItems} mục đang phát triển` : 'Toàn bộ mục đã sẵn sàng'}</p>
                                        </div>
                                    </section>
                                    <section className="settings-rail-card">
                                        <div className="settings-rail-icon amber"><ThunderboltOutlined /></div>
                                        <div>
                                            <span className="settings-rail-label">Gợi ý</span>
                                            <h3>Kiểm tra kênh</h3>
                                            <p>Ưu tiên Zalo, Facebook và giờ làm việc để agent nhận hội thoại đúng ca.</p>
                                        </div>
                                    </section>
                                </aside>
                            )}
                        </div>
                    </main>
                </div>
            </div>
        </AppLayout>
    );
}
