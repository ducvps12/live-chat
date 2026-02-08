import React, { useState, useEffect } from 'react';
import { Button, Card, Input, Form, Table, Tag, Modal, Checkbox, message, Popconfirm, Dropdown, Space, Tooltip, Spin } from 'antd';
import { SettingsLayout } from '@/components/layout/SettingsLayout';
import webhookService, { Webhook, WebhookEvent, WebhookLog } from '@/services/webhook.service';

const WebhookSettingsPage: React.FC = () => {
    const [webhooks, setWebhooks] = useState<Webhook[]>([]);
    const [eventTypes, setEventTypes] = useState<WebhookEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [editingWebhook, setEditingWebhook] = useState<Webhook | null>(null);
    const [logsModalOpen, setLogsModalOpen] = useState(false);
    const [selectedWebhook, setSelectedWebhook] = useState<Webhook | null>(null);
    const [logs, setLogs] = useState<WebhookLog[]>([]);
    const [logsLoading, setLogsLoading] = useState(false);
    const [testingId, setTestingId] = useState<string | null>(null);
    const [form] = Form.useForm();

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [webhooksData, eventsData] = await Promise.all([
                webhookService.getWebhooks(),
                webhookService.getEventTypes()
            ]);
            setWebhooks(webhooksData);
            setEventTypes(eventsData);
        } catch (error: any) {
            message.error(error.message || 'Không thể tải danh sách webhook');
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (values: any) => {
        try {
            const webhook = await webhookService.createWebhook({
                name: values.name,
                url: values.url,
                secret: values.secret,
                events: values.events
            });
            setWebhooks([webhook, ...webhooks]);
            setCreateModalOpen(false);
            form.resetFields();
            message.success('Tạo webhook thành công!');
        } catch (error: any) {
            message.error(error.message || 'Không thể tạo webhook');
        }
    };

    const handleUpdate = async (values: any) => {
        if (!editingWebhook) return;
        try {
            const updated = await webhookService.updateWebhook(editingWebhook.webhookId, {
                name: values.name,
                url: values.url,
                events: values.events
            });
            setWebhooks(webhooks.map(w => w.webhookId === updated.webhookId ? updated : w));
            setEditingWebhook(null);
            form.resetFields();
            message.success('Cập nhật thành công!');
        } catch (error: any) {
            message.error(error.message || 'Không thể cập nhật webhook');
        }
    };

    const handleDelete = async (webhookId: string) => {
        try {
            await webhookService.deleteWebhook(webhookId);
            setWebhooks(webhooks.filter(w => w.webhookId !== webhookId));
            message.success('Đã xóa webhook');
        } catch (error: any) {
            message.error(error.message || 'Không thể xóa webhook');
        }
    };

    const handleToggle = async (webhook: Webhook) => {
        try {
            const updated = await webhookService.toggleWebhook(webhook.webhookId);
            setWebhooks(webhooks.map(w => w.webhookId === updated.webhookId ? updated : w));
            message.success(updated.status === 1 ? 'Đã kích hoạt webhook' : 'Đã tạm dừng webhook');
        } catch (error: any) {
            message.error(error.message || 'Không thể thay đổi trạng thái');
        }
    };

    const handleTest = async (webhookId: string) => {
        try {
            setTestingId(webhookId);
            const result = await webhookService.testWebhook(webhookId);
            if (result.success) {
                message.success(`Test thành công! (${result.time}ms)`);
            } else {
                message.error(`Test thất bại: ${result.error}`);
            }
            // Reload to get updated stats
            loadData();
        } catch (error: any) {
            message.error(error.message || 'Không thể test webhook');
        } finally {
            setTestingId(null);
        }
    };

    const handleViewLogs = async (webhook: Webhook) => {
        setSelectedWebhook(webhook);
        setLogsModalOpen(true);
        setLogsLoading(true);
        try {
            const logsData = await webhookService.getWebhookLogs(webhook.webhookId);
            setLogs(logsData);
        } catch (error: any) {
            message.error(error.message || 'Không thể tải logs');
        } finally {
            setLogsLoading(false);
        }
    };

    const handleCopySecret = async (webhookId: string) => {
        try {
            const secret = await webhookService.revealSecret(webhookId);
            await navigator.clipboard.writeText(secret);
            message.success('Đã copy secret!');
        } catch (error: any) {
            message.error(error.message || 'Không thể lấy secret');
        }
    };

    const openEditModal = (webhook: Webhook) => {
        setEditingWebhook(webhook);
        form.setFieldsValue({
            name: webhook.name,
            url: webhook.url,
            events: webhook.events
        });
    };

    const getStatusColor = (status: number) => {
        switch (status) {
            case 1: return 'green';
            case 2: return 'default';
            case 3: return 'red';
            default: return 'default';
        }
    };

    const columns = [
        {
            title: 'Tên',
            dataIndex: 'name',
            key: 'name',
            render: (name: string, record: Webhook) => (
                <div>
                    <div className="font-medium">{name}</div>
                    <code className="text-xs text-neutral-500 bg-neutral-100 px-1.5 py-0.5 rounded">
                        {record.url.length > 40 ? record.url.substring(0, 40) + '...' : record.url}
                    </code>
                </div>
            ),
        },
        {
            title: 'Sự kiện',
            dataIndex: 'events',
            key: 'events',
            render: (events: string[]) => (
                <div className="flex flex-wrap gap-1">
                    {events.slice(0, 2).map(e => (
                        <Tag key={e} className="text-xs">{e}</Tag>
                    ))}
                    {events.length > 2 && (
                        <Tag className="text-xs">+{events.length - 2}</Tag>
                    )}
                </div>
            ),
        },
        {
            title: 'Trạng thái',
            dataIndex: 'status',
            key: 'status',
            render: (status: number, record: Webhook) => (
                <div>
                    <Tag color={getStatusColor(status)}>{record.statusText}</Tag>
                    {record.lastError && (
                        <Tooltip title={record.lastError}>
                            <span className="text-xs text-red-500 cursor-help">⚠</span>
                        </Tooltip>
                    )}
                </div>
            ),
        },
        {
            title: 'Thống kê',
            key: 'stats',
            render: (_: any, record: Webhook) => (
                <div className="text-xs text-neutral-500">
                    <span className="text-green-600">{record.successCount} ✓</span>
                    {' / '}
                    <span className="text-red-600">{record.failCount} ✗</span>
                </div>
            ),
        },
        {
            title: '',
            key: 'actions',
            width: 150,
            render: (_: any, record: Webhook) => (
                <Space size="small">
                    <Tooltip title="Test webhook">
                        <Button
                            type="text"
                            size="small"
                            loading={testingId === record.webhookId}
                            onClick={() => handleTest(record.webhookId)}
                            icon={<span className="material-symbols-outlined text-base">send</span>}
                        />
                    </Tooltip>
                    <Dropdown menu={{
                        items: [
                            { key: 'edit', label: 'Chỉnh sửa', onClick: () => openEditModal(record) },
                            { key: 'logs', label: 'Xem logs', onClick: () => handleViewLogs(record) },
                            { key: 'secret', label: 'Copy secret', onClick: () => handleCopySecret(record.webhookId) },
                            { key: 'toggle', label: record.status === 1 ? 'Tạm dừng' : 'Kích hoạt', onClick: () => handleToggle(record) },
                            { type: 'divider' },
                            { key: 'delete', label: 'Xóa', danger: true, onClick: () => handleDelete(record.webhookId) },
                        ]
                    }}>
                        <Button type="text" size="small" icon={<span className="material-symbols-outlined text-base">more_vert</span>} />
                    </Dropdown>
                </Space>
            ),
        },
    ];

    const logColumns = [
        {
            title: 'Thời gian',
            dataIndex: 'createdAt',
            key: 'createdAt',
            render: (date: string) => new Date(date).toLocaleString('vi-VN'),
        },
        {
            title: 'Event',
            dataIndex: 'eventType',
            key: 'eventType',
            render: (event: string) => <code className="text-xs">{event}</code>,
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            render: (status: number, record: WebhookLog) => (
                <Tag color={record.success ? 'green' : 'red'}>
                    {status || 'Error'}
                </Tag>
            ),
        },
        {
            title: 'Time',
            dataIndex: 'responseTime',
            key: 'responseTime',
            render: (time: number) => time ? `${time}ms` : '-',
        },
        {
            title: 'Lỗi',
            dataIndex: 'error',
            key: 'error',
            render: (error: string) => error ? <span className="text-red-500 text-xs">{error}</span> : '-',
        },
    ];

    return (
        <SettingsLayout>
            <div className="max-w-4xl">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-2xl text-primary-600">webhook</span>
                            <h1 className="text-2xl font-bold text-neutral-900">Webhook</h1>
                        </div>
                        <p className="text-neutral-500 mt-1">
                            Nhận thông báo realtime khi có sự kiện xảy ra trong hệ thống
                        </p>
                    </div>
                    <Button type="primary" size="large" onClick={() => setCreateModalOpen(true)}>
                        + Tạo Webhook
                    </Button>
                </div>

                {/* Webhook List */}
                <Card className="mb-6">
                    <Table
                        dataSource={webhooks}
                        columns={columns}
                        rowKey="webhookId"
                        loading={loading}
                        pagination={false}
                        locale={{ emptyText: 'Chưa có webhook nào' }}
                    />
                </Card>

                {/* Info Box */}
                <div className="p-5 bg-blue-50 rounded-xl border border-blue-100">
                    <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                        <span className="material-symbols-outlined text-lg">info</span>
                        Hướng dẫn sử dụng
                    </h4>
                    <ul className="text-sm text-blue-800 space-y-2 list-disc list-inside ml-1">
                        <li>Webhook sẽ gửi POST request với payload JSON đến URL của bạn</li>
                        <li>Header <code className="bg-blue-100 px-1 rounded">X-LiveChat-Signature</code> chứa HMAC-SHA256 signature</li>
                        <li>Webhook tự động tắt sau 5 lần thất bại liên tiếp</li>
                        <li>Sử dụng <a href="https://webhook.site" target="_blank" rel="noopener" className="underline">webhook.site</a> để test</li>
                    </ul>
                </div>
            </div>

            {/* Create Modal */}
            <Modal
                title="Tạo Webhook mới"
                open={createModalOpen}
                onCancel={() => { setCreateModalOpen(false); form.resetFields(); }}
                footer={null}
                width={500}
            >
                <Form form={form} layout="vertical" onFinish={handleCreate} className="mt-4">
                    <Form.Item name="name" label="Tên" rules={[{ required: true, message: 'Nhập tên webhook' }]}>
                        <Input placeholder="My Webhook" />
                    </Form.Item>
                    <Form.Item name="url" label="URL" rules={[{ required: true, message: 'Nhập URL' }, { type: 'url', message: 'URL không hợp lệ' }]}>
                        <Input placeholder="https://your-server.com/webhook" />
                    </Form.Item>
                    <Form.Item name="secret" label="Secret (tùy chọn)">
                        <Input.Password placeholder="Để trống sẽ tự động tạo" />
                    </Form.Item>
                    <Form.Item name="events" label="Sự kiện" rules={[{ required: true, message: 'Chọn ít nhất 1 sự kiện' }]}>
                        <Checkbox.Group className="flex flex-col gap-2">
                            {eventTypes.map(event => (
                                <Checkbox key={event.value} value={event.value}>
                                    <code className="text-xs mr-2">{event.value}</code>
                                    <span className="text-neutral-500">{event.label}</span>
                                </Checkbox>
                            ))}
                        </Checkbox.Group>
                    </Form.Item>
                    <div className="flex justify-end gap-2 mt-6">
                        <Button onClick={() => { setCreateModalOpen(false); form.resetFields(); }}>Hủy</Button>
                        <Button type="primary" htmlType="submit">Tạo Webhook</Button>
                    </div>
                </Form>
            </Modal>

            {/* Edit Modal */}
            <Modal
                title="Chỉnh sửa Webhook"
                open={!!editingWebhook}
                onCancel={() => { setEditingWebhook(null); form.resetFields(); }}
                footer={null}
                width={500}
            >
                <Form form={form} layout="vertical" onFinish={handleUpdate} className="mt-4">
                    <Form.Item name="name" label="Tên" rules={[{ required: true }]}>
                        <Input placeholder="My Webhook" />
                    </Form.Item>
                    <Form.Item name="url" label="URL" rules={[{ required: true }, { type: 'url' }]}>
                        <Input placeholder="https://your-server.com/webhook" />
                    </Form.Item>
                    <Form.Item name="events" label="Sự kiện" rules={[{ required: true }]}>
                        <Checkbox.Group className="flex flex-col gap-2">
                            {eventTypes.map(event => (
                                <Checkbox key={event.value} value={event.value}>
                                    <code className="text-xs mr-2">{event.value}</code>
                                    <span className="text-neutral-500">{event.label}</span>
                                </Checkbox>
                            ))}
                        </Checkbox.Group>
                    </Form.Item>
                    <div className="flex justify-end gap-2 mt-6">
                        <Button onClick={() => { setEditingWebhook(null); form.resetFields(); }}>Hủy</Button>
                        <Button type="primary" htmlType="submit">Lưu</Button>
                    </div>
                </Form>
            </Modal>

            {/* Logs Modal */}
            <Modal
                title={`Logs - ${selectedWebhook?.name}`}
                open={logsModalOpen}
                onCancel={() => setLogsModalOpen(false)}
                footer={null}
                width={800}
            >
                <Table
                    dataSource={logs}
                    columns={logColumns}
                    rowKey="createdAt"
                    loading={logsLoading}
                    pagination={{ pageSize: 10 }}
                    size="small"
                />
            </Modal>
        </SettingsLayout>
    );
};

export default WebhookSettingsPage;
