import { useRouter } from 'next/router';
import { useEffect, useState, useCallback } from 'react';
import Head from 'next/head';
import {
    Spin, Card, Table, Tag, Button, message, Empty, Switch, Drawer, Form,
    Input, InputNumber, Select, Space, Popconfirm, Divider, Typography, Badge
} from 'antd';
import { Plus, Edit, Trash2, GitBranch, ArrowLeft, PlusCircle, Trash, Settings2 } from 'lucide-react';
import AppLayout from '../../../components/layout/AppLayout';
import { httpClient } from '../../../lib/http/client';

const { Text, Paragraph, Title } = Typography;

const QUICK_TEMPLATES = [
    {
        key: 'website-round-robin',
        title: 'Website chia đều',
        description: 'Luân phiên hội thoại website cho các agent đã chọn.',
        color: '#4f46e5',
        values: {
            name: 'Website - chia đều agent',
            description: 'Tự động chia đều hội thoại từ widget website.',
            priority: 30,
            conditionLogic: 'all',
            conditions: [{ field: 'channel', operator: 'eq', value: 'widget' }],
            actionType: 'round_robin',
            agentIds: [],
        }
    },
    {
        key: 'zalo-least-busy',
        title: 'Zalo cho người ít bận',
        description: 'Ưu tiên agent đang có ít hội thoại mở nhất.',
        color: '#0891b2',
        values: {
            name: 'Zalo - agent ít bận nhất',
            description: 'Phân hội thoại Zalo cho agent có ít hội thoại mở nhất.',
            priority: 40,
            conditionLogic: 'all',
            conditions: [{ field: 'channel', operator: 'eq', value: 'zalo' }],
            actionType: 'least_busy',
            agentIds: [],
        }
    },
    {
        key: 'facebook-round-robin',
        title: 'Facebook chia đều',
        description: 'Chia tin nhắn Fanpage đều cho đội chăm sóc.',
        color: '#2563eb',
        values: {
            name: 'Facebook - chia đều agent',
            description: 'Tự động chia đều hội thoại Facebook Fanpage.',
            priority: 30,
            conditionLogic: 'all',
            conditions: [{ field: 'channel', operator: 'eq', value: 'facebook' }],
            actionType: 'round_robin',
            agentIds: [],
        }
    },
    {
        key: 'returning-customer',
        title: 'Khách cũ gặp agent cũ',
        description: 'Giữ mạch chăm sóc với người từng phụ trách.',
        color: '#db2777',
        values: {
            name: 'Khách quay lại - ưu tiên agent cũ',
            description: 'Ưu tiên nối lại với agent đã từng chăm sóc khách.',
            priority: 50,
            conditionLogic: 'all',
            conditions: [],
            actionType: 'previous_agent',
            agentIds: [],
        }
    }
] as const;

export default function DistributionPage() {
    const router = useRouter();
    const { workspaceId } = router.query;
    const [ready, setReady] = useState(false);
    const [rules, setRules] = useState<any[]>([]);
    const [agents, setAgents] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [editingRule, setEditingRule] = useState<any>(null);
    const [submitting, setSubmitting] = useState(false);
    const [form] = Form.useForm();

    useEffect(() => {
        setReady(true);
        if (!localStorage.getItem('nemark_token')) {
            router.replace('/auth/login');
        }
    }, [router]);

    const fetchRules = useCallback(async () => {
        if (!workspaceId) return;
        setLoading(true);
        try {
            const { data } = await httpClient.get(`/distribution-rules/workspace/${workspaceId}`);
            setRules(data.data || []);
        } catch (err) {
            console.error('Failed to fetch distribution rules:', err);
            message.error('Không thể tải danh sách quy tắc phân phối');
        } finally {
            setLoading(false);
        }
    }, [workspaceId]);

    const fetchAgents = useCallback(async () => {
        if (!workspaceId) return;
        try {
            const { data } = await httpClient.get(`/workspaces/${workspaceId}/members`);
            setAgents(data.data || []);
        } catch (err) {
            console.error('Failed to fetch workspace agents:', err);
        }
    }, [workspaceId]);

    useEffect(() => {
        if (workspaceId) {
            fetchRules();
            fetchAgents();
        }
    }, [workspaceId, fetchRules, fetchAgents]);

    const handleOpenCreate = () => {
        setEditingRule(null);
        form.resetFields();
        form.setFieldsValue({
            conditionLogic: 'all',
            priority: 0,
            conditions: [{ field: 'channel', operator: 'eq', value: '' }]
        });
        setDrawerOpen(true);
    };

    const handleUseTemplate = (template: typeof QUICK_TEMPLATES[number]) => {
        setEditingRule(null);
        form.resetFields();
        form.setFieldsValue(template.values);
        setDrawerOpen(true);
    };

    const handleOpenEdit = (rule: any) => {
        setEditingRule(rule);
        form.resetFields();
        form.setFieldsValue({
            name: rule.name,
            description: rule.description,
            priority: rule.priority,
            conditionLogic: rule.conditionLogic || 'all',
            actionType: rule.action?.type || 'round_robin',
            agentIds: rule.action?.agentIds || [],
            conditions: rule.conditions || []
        });
        setDrawerOpen(true);
    };

    const handleSave = async (values: any) => {
        if (!workspaceId) return;
        setSubmitting(true);
        try {
            const payload = {
                name: values.name,
                description: values.description || '',
                priority: values.priority || 0,
                conditionLogic: values.conditionLogic || 'all',
                conditions: values.conditions || [],
                action: {
                    type: values.actionType,
                    agentIds: values.agentIds || [],
                }
            };

            if (editingRule) {
                await httpClient.patch(`/distribution-rules/workspace/${workspaceId}/${editingRule.id}`, payload);
                message.success('Đã cập nhật quy tắc phân phối thành công!');
            } else {
                await httpClient.post(`/distribution-rules/workspace/${workspaceId}`, payload);
                message.success('Đã tạo quy tắc phân phối mới thành công!');
            }
            setDrawerOpen(false);
            fetchRules();
        } catch (err: any) {
            console.error('Failed to save rule:', err);
            message.error(err.response?.data?.message || 'Lỗi khi lưu quy tắc');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!workspaceId) return;
        try {
            await httpClient.delete(`/distribution-rules/workspace/${workspaceId}/${id}`);
            message.success('Đã xóa quy tắc phân phối thành công');
            fetchRules();
        } catch (err) {
            console.error('Failed to delete rule:', err);
            message.error('Lỗi khi xóa quy tắc');
        }
    };

    const handleToggle = async (id: string, checked: boolean) => {
        if (!workspaceId) return;
        try {
            await httpClient.patch(`/distribution-rules/workspace/${workspaceId}/${id}`, { isActive: checked });
            message.success(checked ? 'Đã bật quy tắc' : 'Đã tắt quy tắc');
            // update local state quickly
            setRules(prev => prev.map(r => r.id === id ? { ...r, isActive: checked } : r));
        } catch (err) {
            console.error('Failed to toggle rule state:', err);
            message.error('Lỗi khi cập nhật trạng thái quy tắc');
        }
    };

    if (!ready || !workspaceId) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg-soft)' }}>
                <Spin size="large" />
            </div>
        );
    }

    const columns = [
        {
            title: 'Tên quy tắc',
            dataIndex: 'name',
            key: 'name',
            render: (name: string, record: any) => (
                <div style={{ padding: '4px 0' }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--color-text, #1e293b)' }}>{name}</div>
                    {record.description && (
                        <div style={{ fontSize: 12, color: 'var(--color-text-secondary, #64748b)', marginTop: 2 }}>
                            {record.description}
                        </div>
                    )}
                </div>
            )
        },
        {
            title: 'Ưu tiên',
            dataIndex: 'priority',
            key: 'priority',
            width: 90,
            align: 'center' as const,
            render: (p: number) => <Tag color="blue" style={{ borderRadius: 6, fontWeight: 600 }}>Cấp {p}</Tag>
        },
        {
            title: 'Điều kiện',
            key: 'conditions',
            width: 140,
            render: (record: any) => {
                const count = record.conditions?.length || 0;
                const logic = record.conditionLogic === 'any' ? 'Bất kỳ (OR)' : 'Tất cả (AND)';
                return (
                    <div>
                        <Badge count={count} showZero color="#6366f1" style={{ fontSize: 10, height: 16, minWidth: 16, lineHeight: '16px', borderRadius: 8 }} />
                        <span style={{ fontSize: 12, marginLeft: 8, color: 'var(--color-text-secondary)' }}>{logic}</span>
                    </div>
                );
            }
        },
        {
            title: 'Hành động',
            dataIndex: ['action', 'type'],
            key: 'actionType',
            width: 180,
            render: (type: string) => {
                let color = 'default';
                let label = type || '';
                switch (type) {
                    case 'assign_agent': color = 'purple'; label = 'Gán cho Agent'; break;
                    case 'round_robin': color = 'cyan'; label = 'Luân phiên (Round-Robin)'; break;
                    case 'least_busy': color = 'orange'; label = 'Agent ít bận nhất'; break;
                    case 'previous_agent': color = 'magenta'; label = 'Gặp lại Agent cũ'; break;
                }
                return <Tag color={color} style={{ borderRadius: 6 }}>{label}</Tag>;
            }
        },
        {
            title: 'Kích hoạt',
            dataIndex: 'isActive',
            key: 'isActive',
            width: 110,
            align: 'center' as const,
            render: (active: boolean, record: any) => (
                <Switch size="small" checked={active} onChange={(v) => handleToggle(record.id, v)} />
            )
        },
        {
            title: 'Thao tác',
            key: 'actions',
            width: 120,
            align: 'right' as const,
            render: (_: any, record: any) => (
                <Space size={4}>
                    <Button type="text" size="small" icon={<Edit size={14} />} onClick={() => handleOpenEdit(record)} />
                    <Popconfirm
                        title="Xóa quy tắc phân phối này?"
                        description="Hành động này không thể hoàn tác."
                        okText="Xóa"
                        cancelText="Hủy"
                        okButtonProps={{ danger: true }}
                        onConfirm={() => handleDelete(record.id)}
                    >
                        <Button type="text" size="small" danger icon={<Trash2 size={14} />} />
                    </Popconfirm>
                </Space>
            )
        }
    ];

    return (
        <AppLayout headerTitle={<><GitBranch size={20} style={{ marginRight: 8, color: 'var(--color-primary, #6366f1)' }} /> Phân phối hội thoại</>}>
            <Head><title>Phân phối hội thoại | NemarkChat</title></Head>
            <main style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
                <Card style={{ marginBottom: 20, borderColor: '#c7d2fe', background: 'linear-gradient(135deg, #f8faff 0%, #eef2ff 100%)' }}>
                    <div style={{ marginBottom: 14 }}>
                        <Text style={{ color: '#4f46e5', fontWeight: 700, fontSize: 12, letterSpacing: '.08em' }}>MẪU TẠO NHANH</Text>
                        <Title level={4} style={{ margin: '5px 0 2px' }}>Chọn một luồng, sau đó chọn agent</Title>
                        <Paragraph type="secondary" style={{ margin: 0 }}>Không cần tự nhớ tên kênh, điều kiện hay kiểu phân chia.</Paragraph>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 10 }}>
                        {QUICK_TEMPLATES.map(template => (
                            <button
                                type="button"
                                key={template.key}
                                onClick={() => handleUseTemplate(template)}
                                style={{ textAlign: 'left', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 14, cursor: 'pointer' }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: template.color, fontWeight: 700 }}>
                                    <GitBranch size={15} /> {template.title}
                                </div>
                                <div style={{ color: '#64748b', fontSize: 12, lineHeight: 1.45, marginTop: 6 }}>{template.description}</div>
                            </button>
                        ))}
                    </div>
                </Card>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <div>
                        <Title level={4} style={{ margin: 0, fontWeight: 700 }}>Danh sách quy tắc</Title>
                        <Paragraph type="secondary" style={{ margin: 0, fontSize: 13 }}>
                            Thiết lập thứ tự ưu tiên phân chia khách hàng mới vào các nhóm hoặc nhân sự phù hợp.
                        </Paragraph>
                    </div>
                    <Button type="primary" icon={<Plus size={16} />} onClick={handleOpenCreate} style={{ display: 'flex', alignItems: 'center', gap: 6, borderRadius: 8, height: 38, fontWeight: 600, background: 'var(--gradient-hero, linear-gradient(135deg, #6366f1, #a855f7))', border: 'none' }}>
                        Tạo quy tắc
                    </Button>
                </div>

                <Card style={{ borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.02)', border: '1px solid var(--color-border, #f1f5f9)' }} styles={{ body: { padding: 0 } }}>
                    {rules.length === 0 && !loading ? (
                        <div style={{ padding: '60px 0' }}>
                            <Empty description={
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: 15, color: '#334155', marginBottom: 4 }}>Chưa có quy tắc phân phối nào</div>
                                    <div style={{ color: '#64748b', fontSize: 13 }}>Tạo các quy tắc điều hướng cuộc trò chuyện tự động đến các bộ phận kinh doanh, CSKH.</div>
                                </div>
                            }>
                                <Button type="primary" icon={<Plus size={16} />} onClick={handleOpenCreate} style={{ marginTop: 12, borderRadius: 8, height: 36 }}>
                                    Tạo quy tắc mới
                                </Button>
                            </Empty>
                        </div>
                    ) : (
                        <Table
                            dataSource={rules}
                            columns={columns}
                            rowKey="id"
                            loading={loading}
                            pagination={false}
                            style={{ borderRadius: 12, overflow: 'hidden' }}
                        />
                    )}
                </Card>
            </main>

            {/* ─── Create/Edit Rule Drawer ─── */}
            <Drawer
                title={editingRule ? 'Chỉnh sửa Quy tắc Phân phối' : 'Tạo Quy tắc Phân phối Mới'}
                open={drawerOpen}
                onClose={() => setDrawerOpen(false)}
                width={620}
                destroyOnClose
                extra={
                    <Space>
                        <Button onClick={() => setDrawerOpen(false)}>Hủy</Button>
                        <Button type="primary" loading={submitting} onClick={() => form.submit()} style={{ background: 'var(--gradient-hero, linear-gradient(135deg, #6366f1, #a855f7))', border: 'none' }}>
                            Lưu quy tắc
                        </Button>
                    </Space>
                }
            >
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleSave}
                    requiredMark={false}
                    initialValues={{ conditionLogic: 'all', priority: 0 }}
                >
                    <Form.Item name="name" label={<Text strong>Tên quy tắc</Text>} rules={[{ required: true, message: 'Vui lòng nhập tên quy tắc' }]}>
                        <Input placeholder="VD: Phân phối kênh Web Chat cho Team Sale" />
                    </Form.Item>

                    <Form.Item name="description" label={<Text strong>Mô tả mục đích</Text>}>
                        <Input.TextArea placeholder="Mô tả ngắn gọn mục đích của quy tắc này..." rows={2} />
                    </Form.Item>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <Form.Item name="priority" label={<Text strong>Độ ưu tiên</Text>} tooltip="Quy tắc có độ ưu tiên cao hơn sẽ được đánh giá trước">
                            <InputNumber min={0} max={1000} style={{ width: '100%' }} />
                        </Form.Item>
                        <Form.Item name="conditionLogic" label={<Text strong>Mối quan hệ điều kiện</Text>}>
                            <Select options={[
                                { value: 'all', label: 'Thỏa mãn tất cả (AND)' },
                                { value: 'any', label: 'Thỏa mãn bất kỳ (OR)' }
                            ]} />
                        </Form.Item>
                    </div>

                    <Divider style={{ margin: '16px 0' }} />

                    {/* Conditions Field.List */}
                    <div style={{ marginBottom: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <Settings2 size={16} style={{ color: '#6366f1' }} />
                            <Text strong style={{ fontSize: 14 }}>Thiết lập điều kiện lọc hội thoại</Text>
                        </div>
                        <Form.List name="conditions">
                            {(fields, { add, remove }) => (
                                <>
                                    {fields.map(({ key, name, ...restField }) => (
                                        <div key={key} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                                            <Form.Item
                                                {...restField}
                                                name={[name, 'field']}
                                                rules={[{ required: true, message: 'Trường bắt buộc' }]}
                                                style={{ marginBottom: 0, flex: 3 }}
                                            >
                                                <Select
                                                    placeholder="Chọn thuộc tính"
                                                    options={[
                                                        { value: 'channel', label: 'Kênh hội thoại' },
                                                        { value: 'source', label: 'Nguồn khách hàng' },
                                                        { value: 'url', label: 'Đường dẫn URL' },
                                                        { value: 'visitorCountry', label: 'Quốc gia' },
                                                    ]}
                                                />
                                            </Form.Item>

                                            <Form.Item
                                                {...restField}
                                                name={[name, 'operator']}
                                                rules={[{ required: true, message: 'Trường bắt buộc' }]}
                                                style={{ marginBottom: 0, flex: 2 }}
                                            >
                                                <Select
                                                    placeholder="Chọn so sánh"
                                                    options={[
                                                        { value: 'eq', label: 'Bằng (=)' },
                                                        { value: 'neq', label: 'Khác (!=)' },
                                                        { value: 'contains', label: 'Chứa đựng' },
                                                        { value: 'not_contains', label: 'Không chứa' },
                                                    ]}
                                                />
                                            </Form.Item>

                                            <Form.Item
                                                {...restField}
                                                name={[name, 'value']}
                                                rules={[{ required: true, message: 'Vui lòng nhập giá trị' }]}
                                                style={{ marginBottom: 0, flex: 4 }}
                                            >
                                                <Input placeholder="Giá trị lọc (VD: widget, facebook)" />
                                            </Form.Item>

                                            <Button
                                                type="text"
                                                danger
                                                icon={<Trash size={14} />}
                                                onClick={() => remove(name)}
                                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                            />
                                        </div>
                                    ))}
                                    <Button
                                        type="dashed"
                                        onClick={() => add()}
                                        block
                                        icon={<PlusCircle size={14} />}
                                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 8 }}
                                    >
                                        Thêm điều kiện mới
                                    </Button>
                                </>
                            )}
                        </Form.List>
                    </div>

                    <Divider style={{ margin: '20px 0' }} />

                    {/* Action Block */}
                    <div style={{ background: '#f8fafc', borderRadius: 8, padding: 16, border: '1px solid #e2e8f0' }}>
                        <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 12 }}>Hành động phân chia</Text>

                        <Form.Item name="actionType" label="Kiểu phân chia" rules={[{ required: true, message: 'Vui lòng chọn kiểu phân chia' }]}>
                            <Select options={[
                                { value: 'assign_agent', label: 'Gán cho một hoặc nhiều Agent cụ thể' },
                                { value: 'round_robin', label: 'Luân phiên chia đều (Round-Robin)' },
                                { value: 'least_busy', label: 'Phân cho Agent ít cuộc hội thoại mở nhất' },
                                { value: 'previous_agent', label: 'Ưu tiên kết nối lại với Agent cũ' },
                            ]} />
                        </Form.Item>

                        <Form.Item name="agentIds" label="Chọn danh sách Agents tham gia">
                            <Select
                                mode="multiple"
                                placeholder="Chọn các nhân sự..."
                                optionFilterProp="label"
                                options={agents.map(a => ({
                                    value: a.user?.id,
                                    label: `${a.user?.name} (${a.user?.email})`
                                }))}
                                style={{ width: '100%' }}
                            />
                        </Form.Item>
                    </div>
                </Form>
            </Drawer>
        </AppLayout>
    );
}
