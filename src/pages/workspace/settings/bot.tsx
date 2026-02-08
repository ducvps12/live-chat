import React, { useState, useEffect, useCallback } from 'react';
import { Button, Card, Switch, Table, Tag, Modal, Form, Input, Select, message, Spin, Space, Popconfirm, Slider, Divider, Collapse } from 'antd';
import { SettingsLayout } from '@/components/layout/SettingsLayout';
import { useMyStore } from '@/contexts/MyStoreContext';
import api from '@/lib/http';

interface BotRule {
    RuleKey: number;
    RuleId: string;
    Name: string;
    TriggerType: string;
    TriggerValue: string | null;
    ResponseType: string;
    ResponseContent: string;
    Priority: number;
    IsActive: boolean;
}

interface BotSettings {
    IsEnabled: boolean;
    WelcomeMessage: string;
    OfflineMessage: string;
    IdleTimeoutSeconds: number;
    AiEnabled?: boolean;
    AiModel?: string;
    AiSystemPrompt?: string;
    AiMaxTokens?: number;
    AiTemperature?: number;
}

const AI_MODELS = [
    { value: 'gemini-2.5-flash', label: '⚡ Gemini 2.5 Flash (Nhanh)' },
    { value: 'gemini-2.5-pro', label: '🧠 Gemini 2.5 Pro' },
    { value: 'gemini-3-flash', label: '⚡ Gemini 3 Flash' },
    { value: 'gemini-3-pro-high', label: '🚀 Gemini 3 Pro High' },
    { value: 'claude-sonnet-4-5', label: '🎭 Claude Sonnet 4.5' },
];

const TRIGGER_TYPES = [
    { value: 'first_message', label: 'Tin nhắn đầu tiên' },
    { value: 'keyword', label: 'Keyword (khớp chính xác)' },
    { value: 'contains', label: 'Chứa từ khóa' },
    { value: 'regex', label: 'Regex pattern' },
];

const RESPONSE_TYPES = [
    { value: 'text', label: 'Văn bản' },
    { value: 'buttons', label: 'Buttons (JSON)' },
];

const BotSettingsPage: React.FC = () => {
    const { activeWorkspace } = useMyStore();
    const workspaceId = activeWorkspace?.workspaceId;

    const [loading, setLoading] = useState(false);
    const [rules, setRules] = useState<BotRule[]>([]);
    const [settings, setSettings] = useState<BotSettings | null>(null);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingRule, setEditingRule] = useState<BotRule | null>(null);
    const [form] = Form.useForm();

    // AI States
    const [aiTesting, setAiTesting] = useState(false);
    const [aiTestResult, setAiTestResult] = useState<string | null>(null);
    const [aiForm] = Form.useForm();

    const fetchRules = useCallback(async () => {
        if (!workspaceId) return;
        setLoading(true);
        try {
            const [rulesRes, settingsRes] = await Promise.all([
                api.get(`/workspaces/${workspaceId}/bot/rules`),
                api.get(`/workspaces/${workspaceId}/bot/settings`)
            ]);
            setRules(rulesRes.data?.data?.rules || []);
            setSettings(settingsRes.data?.data?.settings || null);
        } catch (error: any) {
            console.error('Failed to fetch bot data:', error);
        } finally {
            setLoading(false);
        }
    }, [workspaceId]);

    useEffect(() => {
        fetchRules();
    }, [fetchRules]);

    const handleCreateRule = () => {
        setEditingRule(null);
        form.resetFields();
        form.setFieldsValue({
            triggerType: 'keyword',
            responseType: 'text',
            priority: 100,
            isActive: true
        });
        setModalVisible(true);
    };

    const handleEditRule = (rule: BotRule) => {
        setEditingRule(rule);
        form.setFieldsValue({
            name: rule.Name,
            triggerType: rule.TriggerType,
            triggerValue: rule.TriggerValue,
            responseType: rule.ResponseType,
            responseContent: rule.ResponseContent,
            priority: rule.Priority,
            isActive: rule.IsActive
        });
        setModalVisible(true);
    };

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields();

            if (editingRule) {
                await api.put(`/workspaces/${workspaceId}/bot/rules/${editingRule.RuleId}`, values);
                message.success('Đã cập nhật rule!');
            } else {
                await api.post(`/workspaces/${workspaceId}/bot/rules`, values);
                message.success('Đã tạo rule mới!');
            }

            setModalVisible(false);
            fetchRules();
        } catch (error: any) {
            message.error(error.message || 'Có lỗi xảy ra');
        }
    };

    const handleToggle = async (rule: BotRule, isActive: boolean) => {
        try {
            await api.patch(`/workspaces/${workspaceId}/bot/rules/${rule.RuleId}/toggle`, { isActive });
            message.success(isActive ? 'Đã bật rule' : 'Đã tắt rule');
            fetchRules();
        } catch (error) {
            message.error('Không thể thay đổi trạng thái');
        }
    };

    const handleDelete = async (ruleId: string) => {
        try {
            await api.delete(`/workspaces/${workspaceId}/bot/rules/${ruleId}`);
            message.success('Đã xóa rule');
            fetchRules();
        } catch (error) {
            message.error('Không thể xóa rule');
        }
    };

    const handleToggleBotEnabled = async (enabled: boolean) => {
        try {
            await api.put(`/workspaces/${workspaceId}/bot/settings`, {
                ...settings,
                isEnabled: enabled
            });
            message.success(enabled ? 'Đã bật Bot' : 'Đã tắt Bot');
            fetchRules();
        } catch (error) {
            message.error('Không thể thay đổi trạng thái Bot');
        }
    };

    // AI Handlers
    const handleToggleAi = async (enabled: boolean) => {
        try {
            await api.put(`/ai/settings/${activeWorkspace?.workspaceKey}`, {
                aiEnabled: enabled,
                aiModel: settings?.AiModel || 'gemini-2.5-flash',
                aiSystemPrompt: settings?.AiSystemPrompt,
                aiMaxTokens: settings?.AiMaxTokens || 500,
                aiTemperature: settings?.AiTemperature || 0.7
            });
            message.success(enabled ? 'Đã bật AI Fallback' : 'Đã tắt AI Fallback');
            fetchRules();
        } catch (error) {
            message.error('Không thể thay đổi trạng thái AI');
        }
    };

    const handleSaveAiSettings = async () => {
        try {
            const values = await aiForm.validateFields();
            await api.put(`/ai/settings/${activeWorkspace?.workspaceKey}`, {
                aiEnabled: settings?.AiEnabled || false,
                aiModel: values.aiModel,
                aiSystemPrompt: values.aiSystemPrompt,
                aiMaxTokens: values.aiMaxTokens,
                aiTemperature: values.aiTemperature
            });
            message.success('Đã lưu cấu hình AI!');
            fetchRules();
        } catch (error) {
            message.error('Không thể lưu cấu hình AI');
        }
    };

    const handleTestAi = async () => {
        setAiTesting(true);
        setAiTestResult(null);
        try {
            const testMessage = aiForm.getFieldValue('testMessage') || 'Xin chào, tôi cần hỗ trợ';
            const response = await api.post('/ai/generate', {
                message: testMessage,
                workspaceKey: activeWorkspace?.workspaceKey,
                model: aiForm.getFieldValue('aiModel'),
                systemPrompt: aiForm.getFieldValue('aiSystemPrompt')
            });
            if (response.data?.success) {
                setAiTestResult(response.data.data.content);
                message.success(`AI phản hồi trong ${response.data.data.responseTimeMs}ms`);
            } else {
                setAiTestResult('Không nhận được phản hồi từ AI');
            }
        } catch (error: any) {
            setAiTestResult(`Lỗi: ${error.message}`);
        } finally {
            setAiTesting(false);
        }
    };

    // Initialize AI form when settings load
    useEffect(() => {
        if (settings) {
            aiForm.setFieldsValue({
                aiModel: settings.AiModel || 'gemini-2.5-flash',
                aiSystemPrompt: settings.AiSystemPrompt || 'Bạn là trợ lý ảo hỗ trợ khách hàng. Trả lời ngắn gọn, thân thiện và hữu ích.',
                aiMaxTokens: settings.AiMaxTokens || 500,
                aiTemperature: settings.AiTemperature || 0.7
            });
        }
    }, [settings, aiForm]);

    const columns = [
        {
            title: 'TÊN RULE',
            dataIndex: 'Name',
            key: 'Name',
            render: (name: string) => (
                <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary-600">smart_toy</span>
                    <span className="font-medium">{name}</span>
                </div>
            ),
        },
        {
            title: 'KÍCH HOẠT',
            key: 'trigger',
            render: (_: any, record: BotRule) => (
                <div>
                    <Tag color="blue">{TRIGGER_TYPES.find(t => t.value === record.TriggerType)?.label || record.TriggerType}</Tag>
                    {record.TriggerValue && (
                        <span className="text-neutral-500 text-sm ml-2">{record.TriggerValue}</span>
                    )}
                </div>
            ),
        },
        {
            title: 'PHẢN HỒI',
            dataIndex: 'ResponseContent',
            key: 'ResponseContent',
            render: (content: string) => (
                <span className="text-neutral-600 truncate block max-w-xs">
                    {content.length > 50 ? content.substring(0, 50) + '...' : content}
                </span>
            ),
        },
        {
            title: 'ƯU TIÊN',
            dataIndex: 'Priority',
            key: 'Priority',
            width: 80,
            render: (priority: number) => <span className="text-neutral-500">{priority}</span>,
        },
        {
            title: 'TRẠNG THÁI',
            key: 'status',
            width: 100,
            render: (_: any, record: BotRule) => (
                <Switch
                    checked={record.IsActive}
                    onChange={(checked) => handleToggle(record, checked)}
                    size="small"
                />
            ),
        },
        {
            title: '',
            key: 'actions',
            width: 120,
            render: (_: any, record: BotRule) => (
                <Space>
                    <Button type="link" size="small" onClick={() => handleEditRule(record)}>
                        Sửa
                    </Button>
                    <Popconfirm
                        title="Xóa rule này?"
                        onConfirm={() => handleDelete(record.RuleId)}
                        okText="Xóa"
                        cancelText="Hủy"
                    >
                        <Button type="link" size="small" danger>
                            Xóa
                        </Button>
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    if (!workspaceId) {
        return (
            <SettingsLayout>
                <div className="flex flex-col items-center justify-center h-64 gap-4">
                    <span className="material-symbols-outlined text-4xl text-neutral-400">smart_toy</span>
                    <p className="text-neutral-500">Vui lòng chọn workspace để quản lý Bot</p>
                    <a href="/workspace/workspaces" className="text-primary-600 hover:underline flex items-center gap-1">
                        <span className="material-symbols-outlined text-lg">arrow_forward</span>
                        Đi đến danh sách Workspaces
                    </a>
                </div>
            </SettingsLayout>
        );
    }

    return (
        <SettingsLayout>
            <Spin spinning={loading}>
                <div className="max-w-5xl">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-2xl text-primary-600">smart_toy</span>
                                <h1 className="text-2xl font-bold text-neutral-900">Bot Auto-Reply</h1>
                                {settings && (
                                    <Switch
                                        checked={settings.IsEnabled}
                                        onChange={handleToggleBotEnabled}
                                        checkedChildren="ON"
                                        unCheckedChildren="OFF"
                                    />
                                )}
                            </div>
                            <p className="text-neutral-500 mt-1">
                                Cấu hình bot tự động trả lời dựa trên keywords và triggers
                            </p>
                        </div>
                        <Button type="primary" size="large" onClick={handleCreateRule}>
                            + Tạo Rule mới
                        </Button>
                    </div>

                    {/* Rules Table */}
                    <Card className="mb-6">
                        <Table
                            dataSource={rules}
                            columns={columns}
                            rowKey="RuleKey"
                            pagination={false}
                            locale={{ emptyText: 'Chưa có rule nào. Nhấn "Tạo Rule mới" để bắt đầu.' }}
                        />
                    </Card>

                    {/* Quick Templates */}
                    <h3 className="text-lg font-semibold mb-4">Mẫu nhanh</h3>
                    <div className="grid grid-cols-3 gap-4">
                        <Card
                            className="cursor-pointer hover:border-primary-500 transition-colors"
                            onClick={() => {
                                form.setFieldsValue({
                                    name: 'Chào mừng',
                                    triggerType: 'first_message',
                                    triggerValue: '',
                                    responseType: 'text',
                                    responseContent: 'Xin chào! Tôi là trợ lý tự động. Bạn cần hỗ trợ gì ạ?',
                                    priority: 1
                                });
                                setEditingRule(null);
                                setModalVisible(true);
                            }}
                        >
                            <div className="text-center">
                                <span className="material-symbols-outlined text-4xl text-blue-500 mb-2">waving_hand</span>
                                <h4 className="font-medium">Chào mừng</h4>
                                <p className="text-sm text-neutral-500">Chào đón khách truy cập</p>
                            </div>
                        </Card>
                        <Card
                            className="cursor-pointer hover:border-primary-500 transition-colors"
                            onClick={() => {
                                form.setFieldsValue({
                                    name: 'Hỏi giá',
                                    triggerType: 'contains',
                                    triggerValue: 'giá,price,bao nhiêu,chi phí',
                                    responseType: 'text',
                                    responseContent: 'Vui lòng truy cập trang Bảng giá hoặc liên hệ sales@company.com để được tư vấn!',
                                    priority: 20
                                });
                                setEditingRule(null);
                                setModalVisible(true);
                            }}
                        >
                            <div className="text-center">
                                <span className="material-symbols-outlined text-4xl text-green-500 mb-2">payments</span>
                                <h4 className="font-medium">Hỏi giá</h4>
                                <p className="text-sm text-neutral-500">Trả lời câu hỏi về giá</p>
                            </div>
                        </Card>
                        <Card
                            className="cursor-pointer hover:border-primary-500 transition-colors"
                            onClick={() => {
                                form.setFieldsValue({
                                    name: 'Liên hệ hỗ trợ',
                                    triggerType: 'contains',
                                    triggerValue: 'hỗ trợ,support,help,giúp',
                                    responseType: 'text',
                                    responseContent: 'Để được hỗ trợ nhanh nhất, vui lòng mô tả vấn đề của bạn. Nhân viên sẽ phản hồi trong ít phút!',
                                    priority: 30
                                });
                                setEditingRule(null);
                                setModalVisible(true);
                            }}
                        >
                            <div className="text-center">
                                <span className="material-symbols-outlined text-4xl text-orange-500 mb-2">support_agent</span>
                                <h4 className="font-medium">Hỗ trợ</h4>
                                <p className="text-sm text-neutral-500">Yêu cầu hỗ trợ</p>
                            </div>
                        </Card>
                    </div>

                    {/* AI Settings Section */}
                    <Divider />
                    <div className="mt-8">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-2xl text-purple-600">auto_awesome</span>
                                <h3 className="text-lg font-semibold">AI Fallback</h3>
                                <Switch
                                    checked={settings?.AiEnabled || false}
                                    onChange={handleToggleAi}
                                    checkedChildren="ON"
                                    unCheckedChildren="OFF"
                                />
                            </div>
                            <Tag color={settings?.AiEnabled ? 'green' : 'default'}>
                                {settings?.AiEnabled ? 'Đang hoạt động' : 'Đã tắt'}
                            </Tag>
                        </div>

                        <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
                            <p className="text-neutral-600 mb-4">
                                Khi bật, AI sẽ <strong>tự động trả lời</strong> các tin nhắn không khớp với bất kỳ rule nào ở trên.
                            </p>

                            <Collapse
                                ghost
                                items={[{
                                    key: '1',
                                    label: <span className="font-medium text-purple-700">⚙️ Cấu hình AI</span>,
                                    children: (
                                        <Form form={aiForm} layout="vertical" className="mt-4">
                                            <div className="grid grid-cols-2 gap-4">
                                                <Form.Item
                                                    name="aiModel"
                                                    label="Model AI"
                                                >
                                                    <Select options={AI_MODELS} />
                                                </Form.Item>

                                                <Form.Item
                                                    name="aiMaxTokens"
                                                    label="Max Tokens"
                                                    tooltip="Độ dài tối đa của phản hồi"
                                                >
                                                    <Slider min={100} max={2000} step={50} />
                                                </Form.Item>
                                            </div>

                                            <Form.Item
                                                name="aiSystemPrompt"
                                                label="System Prompt"
                                                tooltip="Hướng dẫn cách AI nên trả lời"
                                            >
                                                <Input.TextArea
                                                    rows={3}
                                                    placeholder="Bạn là trợ lý ảo hỗ trợ khách hàng..."
                                                />
                                            </Form.Item>

                                            <Form.Item
                                                name="aiTemperature"
                                                label={<span>Temperature: {aiForm.getFieldValue('aiTemperature') || 0.7}</span>}
                                                tooltip="Độ sáng tạo (0 = chính xác, 1 = sáng tạo)"
                                            >
                                                <Slider
                                                    min={0}
                                                    max={1}
                                                    step={0.1}
                                                    marks={{ 0: '0', 0.5: '0.5', 1: '1' }}
                                                />
                                            </Form.Item>

                                            <Divider dashed />

                                            <h4 className="font-medium mb-3">🧪 Test AI</h4>
                                            <Form.Item
                                                name="testMessage"
                                            >
                                                <Input placeholder="Nhập tin nhắn test..." />
                                            </Form.Item>

                                            <div className="flex gap-2 mb-4">
                                                <Button
                                                    type="primary"
                                                    loading={aiTesting}
                                                    onClick={handleTestAi}
                                                    icon={<span className="material-symbols-outlined text-sm mr-1">send</span>}
                                                >
                                                    Test AI
                                                </Button>
                                                <Button onClick={handleSaveAiSettings}>
                                                    Lưu cấu hình
                                                </Button>
                                            </div>

                                            {aiTestResult && (
                                                <Card size="small" className="bg-white">
                                                    <p className="text-sm text-neutral-500 mb-1">Phản hồi AI:</p>
                                                    <p className="text-neutral-800">{aiTestResult}</p>
                                                </Card>
                                            )}
                                        </Form>
                                    )
                                }]}
                            />
                        </Card>
                    </div>
                </div>
            </Spin>

            {/* Create/Edit Modal */}
            <Modal
                title={editingRule ? 'Sửa Rule' : 'Tạo Rule mới'}
                open={modalVisible}
                onCancel={() => setModalVisible(false)}
                onOk={handleSubmit}
                okText={editingRule ? 'Cập nhật' : 'Tạo'}
                cancelText="Hủy"
                width={600}
            >
                <Form form={form} layout="vertical" className="mt-4">
                    <Form.Item
                        name="name"
                        label="Tên Rule"
                        rules={[{ required: true, message: 'Vui lòng nhập tên' }]}
                    >
                        <Input placeholder="VD: Chào mừng khách mới" />
                    </Form.Item>

                    <div className="grid grid-cols-2 gap-4">
                        <Form.Item
                            name="triggerType"
                            label="Loại kích hoạt"
                            rules={[{ required: true }]}
                        >
                            <Select options={TRIGGER_TYPES} />
                        </Form.Item>

                        <Form.Item
                            name="priority"
                            label="Độ ưu tiên"
                            tooltip="Số nhỏ hơn = ưu tiên cao hơn"
                        >
                            <Input type="number" min={1} max={999} />
                        </Form.Item>
                    </div>

                    <Form.Item
                        name="triggerValue"
                        label="Giá trị kích hoạt"
                        tooltip="Với keyword/contains: danh sách từ khóa cách nhau bằng dấu phẩy"
                    >
                        <Input placeholder="VD: hello,hi,xin chào" />
                    </Form.Item>

                    <Form.Item
                        name="responseType"
                        label="Loại phản hồi"
                    >
                        <Select options={RESPONSE_TYPES} />
                    </Form.Item>

                    <Form.Item
                        name="responseContent"
                        label="Nội dung phản hồi"
                        rules={[{ required: true, message: 'Vui lòng nhập nội dung phản hồi' }]}
                    >
                        <Input.TextArea rows={4} placeholder="Nhập nội dung bot sẽ trả lời..." />
                    </Form.Item>
                </Form>
            </Modal>
        </SettingsLayout>
    );
};

export default BotSettingsPage;
