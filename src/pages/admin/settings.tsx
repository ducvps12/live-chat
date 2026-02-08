import React from 'react';
import { Card, Form, Input, Button, Switch, Divider, message } from 'antd';
import { AdminLayout } from '@/components/layout/AdminLayout';

const AdminSettingsPage: React.FC = () => {
    const [form] = Form.useForm();

    const handleSave = () => {
        message.success('Settings saved successfully!');
    };

    return (
        <AdminLayout>
            <div className="space-y-6 max-w-3xl">
                {/* Header */}
                <div>
                    <h1 className="text-2xl font-bold text-white">Settings</h1>
                    <p className="text-neutral-400 mt-1">Cấu hình hệ thống Super Admin</p>
                </div>

                {/* General Settings */}
                <Card title={<span className="text-white">General Settings</span>} className="bg-neutral-800 border-neutral-700">
                    <Form form={form} layout="vertical">
                        <Form.Item label={<span className="text-neutral-300">System Name</span>} name="systemName" initialValue="LiveChat System">
                            <Input placeholder="System name" />
                        </Form.Item>
                        <Form.Item label={<span className="text-neutral-300">Admin Email</span>} name="adminEmail" initialValue="admin@livechat.com">
                            <Input placeholder="admin@example.com" />
                        </Form.Item>
                        <Form.Item label={<span className="text-neutral-300">Support URL</span>} name="supportUrl">
                            <Input placeholder="https://support.example.com" />
                        </Form.Item>
                    </Form>
                </Card>

                {/* Security */}
                <Card title={<span className="text-white">Security</span>} className="bg-neutral-800 border-neutral-700">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-white font-medium">Two-Factor Authentication</p>
                                <p className="text-neutral-400 text-sm">Require 2FA for admin accounts</p>
                            </div>
                            <Switch defaultChecked />
                        </div>
                        <Divider className="border-neutral-700" />
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-white font-medium">Session Timeout</p>
                                <p className="text-neutral-400 text-sm">Auto logout after inactivity</p>
                            </div>
                            <Switch defaultChecked />
                        </div>
                        <Divider className="border-neutral-700" />
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-white font-medium">IP Whitelist</p>
                                <p className="text-neutral-400 text-sm">Restrict admin access by IP</p>
                            </div>
                            <Switch />
                        </div>
                    </div>
                </Card>

                {/* Notifications */}
                <Card title={<span className="text-white">Notifications</span>} className="bg-neutral-800 border-neutral-700">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-white font-medium">New Workspace Alert</p>
                                <p className="text-neutral-400 text-sm">Get notified when new workspace is created</p>
                            </div>
                            <Switch defaultChecked />
                        </div>
                        <Divider className="border-neutral-700" />
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-white font-medium">System Alerts</p>
                                <p className="text-neutral-400 text-sm">Critical system notifications</p>
                            </div>
                            <Switch defaultChecked />
                        </div>
                        <Divider className="border-neutral-700" />
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-white font-medium">Weekly Reports</p>
                                <p className="text-neutral-400 text-sm">Receive weekly analytics summary</p>
                            </div>
                            <Switch />
                        </div>
                    </div>
                </Card>

                {/* Danger Zone */}
                <Card title={<span className="text-red-500">Danger Zone</span>} className="bg-neutral-800 border-red-900">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-white font-medium">Maintenance Mode</p>
                                <p className="text-neutral-400 text-sm">Put system in maintenance mode</p>
                            </div>
                            <Button danger>Enable</Button>
                        </div>
                        <Divider className="border-neutral-700" />
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-white font-medium">Clear All Cache</p>
                                <p className="text-neutral-400 text-sm">Clear system cache</p>
                            </div>
                            <Button danger>Clear Cache</Button>
                        </div>
                    </div>
                </Card>

                <div className="flex justify-end">
                    <Button type="primary" size="large" onClick={handleSave}>
                        Save Settings
                    </Button>
                </div>
            </div>
        </AdminLayout>
    );
};

export default AdminSettingsPage;
