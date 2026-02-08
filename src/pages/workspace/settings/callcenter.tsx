import React, { useState, useEffect } from 'react';
import { Button, Card, Table, Tag, Tabs, Modal, Form, Input, message, Switch, Alert, Empty, Spin, Tooltip, Select } from 'antd';
import { SettingsLayout } from '@/components/layout/SettingsLayout';
import callcenterService, { CallCenterSettings, PhoneNumber, Call, AvailableNumber } from '@/services/callcenter.service';

const CallCenterSettingsPage: React.FC = () => {
    const [settings, setSettings] = useState<CallCenterSettings | null>(null);
    const [numbers, setNumbers] = useState<PhoneNumber[]>([]);
    const [calls, setCalls] = useState<Call[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('overview');

    // Modals
    const [credentialsModalOpen, setCredentialsModalOpen] = useState(false);
    const [buyNumberModalOpen, setBuyNumberModalOpen] = useState(false);
    const [availableNumbers, setAvailableNumbers] = useState<AvailableNumber[]>([]);
    const [searchingNumbers, setSearchingNumbers] = useState(false);
    const [purchasingNumber, setPurchasingNumber] = useState<string | null>(null);

    const [credentialsForm] = Form.useForm();

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [settingsData, numbersData, callsData] = await Promise.all([
                callcenterService.getSettings(),
                callcenterService.getNumbers().catch(() => []),
                callcenterService.getCalls().catch(() => [])
            ]);
            setSettings(settingsData);
            setNumbers(numbersData);
            setCalls(callsData);
        } catch (error: any) {
            message.error(error.message || 'Không thể tải dữ liệu');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveCredentials = async (values: any) => {
        try {
            await callcenterService.saveCredentials(values.accountSid, values.authToken);
            message.success('Đã lưu thông tin Twilio');
            setCredentialsModalOpen(false);
            credentialsForm.resetFields();
            loadData();
        } catch (error: any) {
            message.error(error.message || 'Không thể lưu thông tin');
        }
    };

    const handleSearchNumbers = async (country: string, type: string) => {
        try {
            setSearchingNumbers(true);
            const numbers = await callcenterService.searchAvailableNumbers(country, type);
            setAvailableNumbers(numbers);
        } catch (error: any) {
            message.error(error.message || 'Không thể tìm số điện thoại');
        } finally {
            setSearchingNumbers(false);
        }
    };

    const handlePurchaseNumber = async (number: AvailableNumber) => {
        try {
            setPurchasingNumber(number.phoneNumber);
            const purchased = await callcenterService.purchaseNumber(number.phoneNumber, number.friendlyName);
            setNumbers([purchased, ...numbers]);
            setBuyNumberModalOpen(false);
            setAvailableNumbers([]);
            message.success(`Đã mua số ${number.phoneNumber}`);
        } catch (error: any) {
            message.error(error.message || 'Không thể mua số điện thoại');
        } finally {
            setPurchasingNumber(null);
        }
    };

    const handleReleaseNumber = async (numberId: string) => {
        try {
            await callcenterService.releaseNumber(numberId);
            setNumbers(numbers.filter(n => n.numberId !== numberId));
            message.success('Đã hủy số điện thoại');
        } catch (error: any) {
            message.error(error.message || 'Không thể hủy số điện thoại');
        }
    };

    const handleUpdateSettings = async (key: string, value: any) => {
        try {
            const updated = await callcenterService.updateSettings({ [key]: value });
            setSettings(updated);
            message.success('Đã cập nhật cài đặt');
        } catch (error: any) {
            message.error(error.message || 'Không thể cập nhật');
        }
    };

    const numberColumns = [
        {
            title: 'Số điện thoại',
            key: 'phone',
            render: (_: any, record: PhoneNumber) => (
                <div>
                    <div className="font-mono font-medium">{callcenterService.formatPhoneNumber(record.phoneNumber)}</div>
                    {record.friendlyName && <div className="text-sm text-neutral-500">{record.friendlyName}</div>}
                </div>
            ),
        },
        {
            title: 'Khả năng',
            key: 'capabilities',
            render: (_: any, record: PhoneNumber) => (
                <div className="flex gap-1">
                    {record.capabilities.voice && <Tag color="blue">Voice</Tag>}
                    {record.capabilities.sms && <Tag color="green">SMS</Tag>}
                </div>
            ),
        },
        {
            title: 'Trạng thái',
            key: 'status',
            render: (_: any, record: PhoneNumber) => (
                <Tag color={record.status === 1 ? 'green' : 'default'}>{record.statusText}</Tag>
            ),
        },
        {
            title: '',
            key: 'actions',
            width: 100,
            render: (_: any, record: PhoneNumber) => (
                <Button type="text" danger size="small" onClick={() => handleReleaseNumber(record.numberId)}>
                    Hủy
                </Button>
            ),
        },
    ];

    const callColumns = [
        {
            title: 'Thời gian',
            dataIndex: 'createdAt',
            key: 'createdAt',
            render: (date: string) => new Date(date).toLocaleString('vi-VN'),
        },
        {
            title: 'Hướng',
            dataIndex: 'direction',
            key: 'direction',
            render: (dir: string) => (
                <Tag color={dir === 'inbound' ? 'blue' : 'default'}>
                    {dir === 'inbound' ? '📞 Gọi vào' : '📱 Gọi ra'}
                </Tag>
            ),
        },
        {
            title: 'Từ → Đến',
            key: 'numbers',
            render: (_: any, record: Call) => (
                <div className="text-sm">
                    <div className="font-mono">{callcenterService.formatPhoneNumber(record.fromNumber)}</div>
                    <div className="text-neutral-400">→ {callcenterService.formatPhoneNumber(record.toNumber)}</div>
                </div>
            ),
        },
        {
            title: 'Trạng thái',
            dataIndex: 'status',
            key: 'status',
            render: (status: string) => (
                <Tag color={callcenterService.getCallStatusColor(status)}>
                    {callcenterService.getCallStatusText(status)}
                </Tag>
            ),
        },
        {
            title: 'Thời lượng',
            dataIndex: 'duration',
            key: 'duration',
            render: (duration: number) => callcenterService.formatDuration(duration),
        },
        {
            title: '',
            key: 'actions',
            width: 80,
            render: (_: any, record: Call) => record.recordingUrl && (
                <Tooltip title="Nghe ghi âm">
                    <Button type="text" size="small" href={record.recordingUrl} target="_blank">
                        <span className="material-symbols-outlined text-base">play_circle</span>
                    </Button>
                </Tooltip>
            ),
        },
    ];

    if (loading) {
        return (
            <SettingsLayout>
                <div className="flex items-center justify-center py-20">
                    <Spin size="large" />
                </div>
            </SettingsLayout>
        );
    }

    return (
        <SettingsLayout>
            <div className="max-w-4xl">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center shadow-sm">
                            <span className="material-symbols-outlined text-white text-xl">phone_in_talk</span>
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-neutral-900">Tổng đài</h1>
                            <p className="text-sm text-neutral-500">Quản lý cuộc gọi VoIP qua Twilio</p>
                        </div>
                    </div>
                </div>

                {/* Not configured alert */}
                {!settings?.configured && (
                    <Alert
                        type="warning"
                        showIcon
                        className="mb-6"
                        message="Chưa cấu hình Twilio"
                        description="Bạn cần cấu hình Account SID và Auth Token từ Twilio để sử dụng tính năng tổng đài."
                        action={
                            <Button type="primary" onClick={() => setCredentialsModalOpen(true)}>
                                Cấu hình ngay
                            </Button>
                        }
                    />
                )}

                {/* Tabs */}
                <Tabs
                    activeKey={activeTab}
                    onChange={setActiveTab}
                    items={[
                        {
                            key: 'overview',
                            label: 'Tổng quan',
                            children: (
                                <div className="space-y-6">
                                    {/* Stats */}
                                    <div className="grid grid-cols-3 gap-4">
                                        <Card className="text-center">
                                            <div className="text-3xl font-bold text-primary-600">{numbers.length}</div>
                                            <div className="text-neutral-500">Số điện thoại</div>
                                        </Card>
                                        <Card className="text-center">
                                            <div className="text-3xl font-bold text-green-600">
                                                {calls.filter(c => c.status === 'completed').length}
                                            </div>
                                            <div className="text-neutral-500">Cuộc gọi hôm nay</div>
                                        </Card>
                                        <Card className="text-center">
                                            <div className="text-3xl font-bold text-blue-600">
                                                {callcenterService.formatDuration(
                                                    calls.reduce((acc, c) => acc + (c.duration || 0), 0)
                                                )}
                                            </div>
                                            <div className="text-neutral-500">Tổng thời lượng</div>
                                        </Card>
                                    </div>

                                    {/* Settings */}
                                    {settings?.configured && (
                                        <Card title="Cài đặt chung">
                                            <div className="space-y-4">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <div className="font-medium">Ghi âm cuộc gọi</div>
                                                        <div className="text-sm text-neutral-500">Tự động ghi âm tất cả cuộc gọi</div>
                                                    </div>
                                                    <Switch
                                                        checked={settings.recordCalls}
                                                        onChange={(v) => handleUpdateSettings('recordCalls', v)}
                                                    />
                                                </div>
                                                <div className="border-t pt-4">
                                                    <div className="font-medium mb-2">Lời chào</div>
                                                    <Input.TextArea
                                                        rows={2}
                                                        value={settings.welcomeMessage || ''}
                                                        onChange={(e) => handleUpdateSettings('welcomeMessage', e.target.value)}
                                                        placeholder="Xin chào! Cảm ơn bạn đã gọi điện..."
                                                    />
                                                </div>
                                            </div>
                                        </Card>
                                    )}
                                </div>
                            ),
                        },
                        {
                            key: 'numbers',
                            label: 'Số điện thoại',
                            disabled: !settings?.configured,
                            children: (
                                <div>
                                    <div className="flex justify-end mb-4">
                                        <Button type="primary" onClick={() => {
                                            setBuyNumberModalOpen(true);
                                            handleSearchNumbers('VN', 'local');
                                        }}>
                                            + Mua số mới
                                        </Button>
                                    </div>
                                    {numbers.length > 0 ? (
                                        <Card>
                                            <Table
                                                dataSource={numbers}
                                                columns={numberColumns}
                                                rowKey="numberId"
                                                pagination={false}
                                            />
                                        </Card>
                                    ) : (
                                        <Card className="text-center py-12">
                                            <Empty description="Chưa có số điện thoại nào" />
                                        </Card>
                                    )}
                                </div>
                            ),
                        },
                        {
                            key: 'calls',
                            label: 'Lịch sử cuộc gọi',
                            disabled: !settings?.configured,
                            children: (
                                <Card>
                                    <Table
                                        dataSource={calls}
                                        columns={callColumns}
                                        rowKey="callId"
                                        pagination={{ pageSize: 10 }}
                                        locale={{ emptyText: 'Chưa có cuộc gọi nào' }}
                                    />
                                </Card>
                            ),
                        },
                    ]}
                />

                {/* Info box */}
                <div className="mt-6 p-5 bg-teal-50 rounded-xl border border-teal-100">
                    <h4 className="font-semibold text-teal-900 mb-3 flex items-center gap-2">
                        <span className="material-symbols-outlined text-lg">info</span>
                        Hướng dẫn sử dụng
                    </h4>
                    <ul className="text-sm text-teal-800 space-y-2 list-disc list-inside ml-1">
                        <li>Đăng ký tài khoản tại <a href="https://www.twilio.com" target="_blank" rel="noopener" className="underline">twilio.com</a></li>
                        <li>Lấy Account SID và Auth Token từ Console</li>
                        <li>Mua số điện thoại Vietnam từ Twilio</li>
                        <li>Chi phí: ~$4/tháng cho mỗi số + phí cuộc gọi</li>
                    </ul>
                </div>
            </div>

            {/* Credentials Modal */}
            <Modal
                title="Cấu hình Twilio"
                open={credentialsModalOpen}
                onCancel={() => setCredentialsModalOpen(false)}
                footer={null}
            >
                <Form form={credentialsForm} layout="vertical" onFinish={handleSaveCredentials} className="mt-4">
                    <Form.Item name="accountSid" label="Account SID" rules={[{ required: true }]}>
                        <Input placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" />
                    </Form.Item>
                    <Form.Item name="authToken" label="Auth Token" rules={[{ required: true }]}>
                        <Input.Password placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" />
                    </Form.Item>
                    <div className="flex justify-end gap-2">
                        <Button onClick={() => setCredentialsModalOpen(false)}>Hủy</Button>
                        <Button type="primary" htmlType="submit">Lưu</Button>
                    </div>
                </Form>
            </Modal>

            {/* Buy Number Modal */}
            <Modal
                title="Mua số điện thoại mới"
                open={buyNumberModalOpen}
                onCancel={() => { setBuyNumberModalOpen(false); setAvailableNumbers([]); }}
                footer={null}
                width={600}
            >
                <div className="mb-4 flex gap-2">
                    <Select defaultValue="VN" style={{ width: 120 }}
                        onChange={(v) => handleSearchNumbers(v, 'local')}>
                        <Select.Option value="VN">🇻🇳 Vietnam</Select.Option>
                        <Select.Option value="US">🇺🇸 US</Select.Option>
                        <Select.Option value="SG">🇸🇬 Singapore</Select.Option>
                    </Select>
                    <Button onClick={() => handleSearchNumbers('VN', 'local')} loading={searchingNumbers}>
                        Tìm số
                    </Button>
                </div>

                {searchingNumbers ? (
                    <div className="text-center py-8"><Spin /></div>
                ) : availableNumbers.length > 0 ? (
                    <div className="space-y-2 max-h-96 overflow-auto">
                        {availableNumbers.map(num => (
                            <div key={num.phoneNumber} className="flex items-center justify-between p-3 border rounded-lg hover:bg-neutral-50">
                                <div>
                                    <div className="font-mono font-medium">{callcenterService.formatPhoneNumber(num.phoneNumber)}</div>
                                    <div className="text-sm text-neutral-500">{num.locality}, {num.region}</div>
                                </div>
                                <Button
                                    type="primary"
                                    size="small"
                                    loading={purchasingNumber === num.phoneNumber}
                                    onClick={() => handlePurchaseNumber(num)}
                                >
                                    Mua
                                </Button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <Empty description="Không tìm thấy số điện thoại khả dụng" />
                )}
            </Modal>
        </SettingsLayout>
    );
};

export default CallCenterSettingsPage;
