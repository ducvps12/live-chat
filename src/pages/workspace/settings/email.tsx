import React from 'react';
import { Button, Card, Input, Form, Switch } from 'antd';
import { SettingsLayout } from '@/components/layout/SettingsLayout';

const EmailSettingsPage: React.FC = () => {
    return (
        <SettingsLayout>
            <div className="max-w-4xl">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-red-500 rounded-lg flex items-center justify-center">
                                <span className="material-symbols-outlined text-white text-lg">email</span>
                            </div>
                            <h1 className="text-2xl font-bold text-neutral-900">Email</h1>
                        </div>
                        <p className="text-neutral-500 mt-1">
                            Cấu hình email để gửi thông báo và hỗ trợ khách hàng qua email
                        </p>
                    </div>
                </div>

                {/* Email Configuration */}
                <Card title="Cấu hình SMTP" className="mb-6">
                    <Form layout="vertical" className="max-w-lg">
                        <Form.Item label="SMTP Server">
                            <Input placeholder="smtp.gmail.com" />
                        </Form.Item>
                        <div className="grid grid-cols-2 gap-4">
                            <Form.Item label="Port">
                                <Input placeholder="587" />
                            </Form.Item>
                            <Form.Item label="Encryption">
                                <Input placeholder="TLS" />
                            </Form.Item>
                        </div>
                        <Form.Item label="Email gửi">
                            <Input placeholder="support@company.com" />
                        </Form.Item>
                        <Form.Item label="Mật khẩu / App Password">
                            <Input.Password placeholder="••••••••" />
                        </Form.Item>
                        <Button type="primary">Lưu cấu hình</Button>
                    </Form>
                </Card>

                {/* Email Notifications */}
                <Card title="Thông báo Email">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-medium">Thông báo tin nhắn mới</p>
                                <p className="text-sm text-neutral-500">Gửi email khi có tin nhắn mới từ khách hàng</p>
                            </div>
                            <Switch defaultChecked />
                        </div>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-medium">Thông báo hội thoại được phân công</p>
                                <p className="text-sm text-neutral-500">Gửi email khi bạn được phân công hội thoại mới</p>
                            </div>
                            <Switch defaultChecked />
                        </div>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-medium">Báo cáo hàng ngày</p>
                                <p className="text-sm text-neutral-500">Gửi báo cáo tổng hợp hàng ngày</p>
                            </div>
                            <Switch />
                        </div>
                    </div>
                </Card>
            </div>
        </SettingsLayout>
    );
};

export default EmailSettingsPage;
