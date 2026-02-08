import React, { useState, useEffect } from 'react';
import { message, Input, Button, Spin } from 'antd';
import { SettingsLayout } from '@/components/layout/SettingsLayout';
import { WorkspaceService } from '@/services/workspace.service';
import { useMyStore } from '@/contexts/MyStoreContext';

const SettingsIndexPage: React.FC = () => {
    const { activeWorkspace, setActiveWorkspace } = useMyStore();
    const workspaceId = activeWorkspace?.workspaceId;

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [workspaceName, setWorkspaceName] = useState('');

    useEffect(() => {
        if (activeWorkspace?.name) {
            setWorkspaceName(activeWorkspace.name);
        }
    }, [activeWorkspace?.name]);

    const handleSave = async () => {
        if (!workspaceId || !workspaceName.trim()) return;

        setSaving(true);
        try {
            await WorkspaceService.update(workspaceId, { name: workspaceName.trim() });
            message.success('Đã lưu cài đặt!');

            if (activeWorkspace) {
                setActiveWorkspace({
                    ...activeWorkspace,
                    name: workspaceName.trim(),
                });
            }
        } catch (error: any) {
            message.error(error.response?.data?.message || 'Lỗi khi lưu');
        } finally {
            setSaving(false);
        }
    };

    if (!workspaceId) {
        return (
            <SettingsLayout>
                <div className="flex items-center justify-center h-64">
                    <p className="text-neutral-500">Vui lòng chọn workspace</p>
                </div>
            </SettingsLayout>
        );
    }

    return (
        <SettingsLayout>
            <Spin spinning={loading}>
                <div className="max-w-2xl">
                    <h1 className="text-2xl font-bold text-neutral-900 mb-2">Cài đặt chung</h1>
                    <p className="text-neutral-500 mb-1">
                        ID tài khoản: <code className="bg-neutral-100 px-2 py-0.5 rounded text-sm">{workspaceId}</code>
                    </p>

                    <div className="bg-white rounded-lg shadow-sm border border-neutral-200 p-6 mt-6">
                        {/* Avatar */}
                        <div className="flex items-center gap-6 mb-8">
                            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
                                <span className="material-symbols-outlined text-4xl text-white">support_agent</span>
                            </div>
                            <div>
                                <Button type="link" className="text-primary-600">
                                    Thay ảnh đại diện
                                </Button>
                            </div>
                        </div>

                        {/* Form */}
                        <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                                        Tên doanh nghiệp <span className="text-red-500">*</span>
                                    </label>
                                    <Input
                                        value={workspaceName}
                                        onChange={(e) => setWorkspaceName(e.target.value)}
                                        placeholder="Hỗ Trợ Viên"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                                        Số điện thoại <span className="text-red-500">*</span>
                                    </label>
                                    <Input placeholder="Ví dụ: 0423857603" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-neutral-700 mb-1">
                                    Địa chỉ <span className="text-red-500">*</span>
                                </label>
                                <Input placeholder="Ví dụ: Đống Đa, Hà Nội" />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                                        Thành phố/Thị Trấn
                                    </label>
                                    <Input placeholder="" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                                        Quốc gia <span className="text-red-500">*</span>
                                    </label>
                                    <Input placeholder="Việt Nam" />
                                </div>
                            </div>

                            <div className="pt-4 border-t">
                                <Button type="primary" onClick={handleSave} loading={saving}>
                                    Lưu lại
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </Spin>
        </SettingsLayout>
    );
};

export default SettingsIndexPage;

