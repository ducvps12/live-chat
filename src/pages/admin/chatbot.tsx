import React, { useState } from 'react';
import { Card, Table, Tag, Button, Input, Modal, Form, Select, Space, Switch, message } from 'antd';
import { AdminLayout } from '@/components/layout/AdminLayout';

interface APIKey {
    key: number;
    keyId: string;
    workspace: string;
    provider: 'openai' | 'anthropic' | 'gemini' | 'custom';
    modelName: string;
    endpoint?: string;
    isActive: boolean;
    tokensUsed: number;
    createdAt: string;
}

const AdminChatbotPage: React.FC = () => {
    const [searchText, setSearchText] = useState('');
    const [modalOpen, setModalOpen] = useState(false);
    const [form] = Form.useForm();

    // Mock data
    const apiKeys: APIKey[] = [
        { key: 1, keyId: 'key_abc123', workspace: 'Nemark.vn', provider: 'openai', modelName: 'gpt-4', isActive: true, tokensUsed: 125000, createdAt: '2026-01-15' },
        { key: 2, keyId: 'key_def456', workspace: 'TechCorp', provider: 'anthropic', modelName: 'claude-3', isActive: true, tokensUsed: 89000, createdAt: '2026-01-14' },
        { key: 3, keyId: 'key_ghi789', workspace: 'ShopOnline', provider: 'gemini', modelName: 'gemini-pro', isActive: false, tokensUsed: 45000, createdAt: '2026-01-13' },
        { key: 4, keyId: 'key_jkl012', workspace: 'StartupXYZ', provider: 'custom', modelName: 'llama-3', endpoint: 'https://api.custom.com/v1', isActive: true, tokensUsed: 12000, createdAt: '2026-01-12' },
    ];

    const columns = [
        {
            title: 'WORKSPACE',
            dataIndex: 'workspace',
            key: 'workspace',
            render: (name: string, record: APIKey) => (
                <div>
                    <div className="font-medium text-white">{name}</div>
                    <div className="text-xs text-neutral-500">{record.keyId}</div>
                </div>
            )
        },
        {
            title: 'PROVIDER',
            dataIndex: 'provider',
            key: 'provider',
            render: (provider: string) => {
                const colors: Record<string, string> = { openai: 'green', anthropic: 'orange', gemini: 'blue', custom: 'purple' };
                const icons: Record<string, string> = { openai: '🤖', anthropic: '🧠', gemini: '✨', custom: '⚙️' };
                return (
                    <Tag color={colors[provider]}>
                        {icons[provider]} {provider.toUpperCase()}
                    </Tag>
                );
            }
        },
        {
            title: 'MODEL',
            dataIndex: 'modelName',
            key: 'modelName',
            render: (model: string) => <code className="text-xs bg-neutral-700 px-2 py-0.5 rounded text-white">{model}</code>
        },
        {
            title: 'TOKENS USED',
            dataIndex: 'tokensUsed',
            key: 'tokensUsed',
            render: (tokens: number) => <span className="text-neutral-300">{tokens.toLocaleString()}</span>
        },
        {
            title: 'STATUS',
            dataIndex: 'isActive',
            key: 'isActive',
            render: (active: boolean) => (
                <Tag color={active ? 'green' : 'default'}>{active ? 'ACTIVE' : 'INACTIVE'}</Tag>
            )
        },
        {
            title: '',
            key: 'actions',
            render: (_: any, record: APIKey) => (
                <Space>
                    <Button type="text" size="small">
                        <span className="material-symbols-outlined text-neutral-400">edit</span>
                    </Button>
                    <Button type="text" size="small" danger>
                        <span className="material-symbols-outlined">delete</span>
                    </Button>
                </Space>
            )
        },
    ];

    const handleSubmit = (values: any) => {
        console.log('New API Key:', values);
        message.success('API Key added successfully!');
        setModalOpen(false);
        form.resetFields();
    };

    return (
        <AdminLayout>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-white">Chatbot API Keys</h1>
                        <p className="text-neutral-400 mt-1">Quản lý API keys cho các workspace sử dụng chatbot AI</p>
                    </div>
                    <Space>
                        <Input
                            placeholder="Search..."
                            prefix={<span className="material-symbols-outlined text-neutral-400">search</span>}
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                            className="w-64"
                        />
                        <Button type="primary" onClick={() => setModalOpen(true)}>
                            <span className="material-symbols-outlined text-lg mr-1">add</span>
                            Add API Key
                        </Button>
                    </Space>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-4 gap-4">
                    <Card className="bg-neutral-800 border-neutral-700">
                        <div className="text-center">
                            <p className="text-3xl font-bold text-white">{apiKeys.length}</p>
                            <p className="text-neutral-400 text-sm">Total Keys</p>
                        </div>
                    </Card>
                    <Card className="bg-neutral-800 border-neutral-700">
                        <div className="text-center">
                            <p className="text-3xl font-bold text-green-500">{apiKeys.filter(k => k.isActive).length}</p>
                            <p className="text-neutral-400 text-sm">Active</p>
                        </div>
                    </Card>
                    <Card className="bg-neutral-800 border-neutral-700">
                        <div className="text-center">
                            <p className="text-3xl font-bold text-blue-500">{apiKeys.filter(k => k.provider === 'openai').length}</p>
                            <p className="text-neutral-400 text-sm">OpenAI</p>
                        </div>
                    </Card>
                    <Card className="bg-neutral-800 border-neutral-700">
                        <div className="text-center">
                            <p className="text-3xl font-bold text-purple-500">{apiKeys.filter(k => k.provider === 'custom').length}</p>
                            <p className="text-neutral-400 text-sm">Custom</p>
                        </div>
                    </Card>
                </div>

                {/* Providers Info */}
                <Card className="bg-neutral-800 border-neutral-700" title={<span className="text-white">Supported Providers</span>}>
                    <div className="grid grid-cols-4 gap-4">
                        <div className="p-4 bg-neutral-700 rounded-lg text-center">
                            <div className="text-3xl mb-2">🤖</div>
                            <p className="text-white font-medium">OpenAI</p>
                            <p className="text-neutral-400 text-xs">GPT-4, GPT-3.5</p>
                        </div>
                        <div className="p-4 bg-neutral-700 rounded-lg text-center">
                            <div className="text-3xl mb-2">🧠</div>
                            <p className="text-white font-medium">Anthropic</p>
                            <p className="text-neutral-400 text-xs">Claude 3, Claude 2</p>
                        </div>
                        <div className="p-4 bg-neutral-700 rounded-lg text-center">
                            <div className="text-3xl mb-2">✨</div>
                            <p className="text-white font-medium">Google Gemini</p>
                            <p className="text-neutral-400 text-xs">Gemini Pro, Ultra</p>
                        </div>
                        <div className="p-4 bg-neutral-700 rounded-lg text-center">
                            <div className="text-3xl mb-2">⚙️</div>
                            <p className="text-white font-medium">Custom API</p>
                            <p className="text-neutral-400 text-xs">Self-hosted models</p>
                        </div>
                    </div>
                </Card>

                {/* Table */}
                <Card className="bg-neutral-800 border-neutral-700">
                    <Table
                        dataSource={apiKeys.filter(k => k.workspace.toLowerCase().includes(searchText.toLowerCase()))}
                        columns={columns}
                        pagination={{ pageSize: 10 }}
                        className="admin-table"
                    />
                </Card>
            </div>

            {/* Add API Key Modal */}
            <Modal
                title="Add API Key"
                open={modalOpen}
                onCancel={() => setModalOpen(false)}
                footer={null}
                width={500}
            >
                <Form form={form} layout="vertical" onFinish={handleSubmit}>
                    <Form.Item name="workspace" label="Workspace" rules={[{ required: true }]}>
                        <Select placeholder="Select workspace">
                            <Select.Option value="nemark">Nemark.vn</Select.Option>
                            <Select.Option value="techcorp">TechCorp</Select.Option>
                            <Select.Option value="shoponline">ShopOnline</Select.Option>
                        </Select>
                    </Form.Item>
                    <Form.Item name="provider" label="Provider" rules={[{ required: true }]}>
                        <Select placeholder="Select provider">
                            <Select.Option value="openai">🤖 OpenAI</Select.Option>
                            <Select.Option value="anthropic">🧠 Anthropic</Select.Option>
                            <Select.Option value="gemini">✨ Google Gemini</Select.Option>
                            <Select.Option value="custom">⚙️ Custom API</Select.Option>
                        </Select>
                    </Form.Item>
                    <Form.Item name="apiKey" label="API Key" rules={[{ required: true }]}>
                        <Input.Password placeholder="sk-..." />
                    </Form.Item>
                    <Form.Item name="modelName" label="Model Name" rules={[{ required: true }]}>
                        <Input placeholder="gpt-4, claude-3, etc." />
                    </Form.Item>
                    <Form.Item name="endpoint" label="Custom Endpoint (optional)">
                        <Input placeholder="https://api.custom.com/v1" />
                    </Form.Item>
                    <Form.Item name="isActive" label="Active" valuePropName="checked" initialValue={true}>
                        <Switch />
                    </Form.Item>
                    <div className="flex justify-end gap-2">
                        <Button onClick={() => setModalOpen(false)}>Cancel</Button>
                        <Button type="primary" htmlType="submit">Add Key</Button>
                    </div>
                </Form>
            </Modal>
        </AdminLayout>
    );
};

export default AdminChatbotPage;
