import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Table, Tag, Avatar, Input, Spin } from 'antd';
import { SettingsLayout } from '@/components/layout/SettingsLayout';
import { useMyStore } from '@/contexts/MyStoreContext';
import { WorkspaceService } from '@/services/workspace.service';
import { WorkspaceMember } from '@/types/workspace';

const AgentsSettingsPage: React.FC = () => {
    const { t } = useTranslation();
    const { activeWorkspace } = useMyStore();
    const workspaceId = activeWorkspace?.workspaceId;

    const [loading, setLoading] = useState(false);
    const [members, setMembers] = useState<WorkspaceMember[]>([]);
    const [searchText, setSearchText] = useState('');

    const fetchMembers = useCallback(async () => {
        if (!workspaceId) return;

        setLoading(true);
        try {
            const data = await WorkspaceService.listMembers(workspaceId);
            setMembers(data);
        } catch (error: any) {
            console.error('Failed to fetch members:', error);
        } finally {
            setLoading(false);
        }
    }, [workspaceId]);

    useEffect(() => {
        fetchMembers();
    }, [fetchMembers]);

    const filteredMembers = members.filter(m =>
        m.user.displayName?.toLowerCase().includes(searchText.toLowerCase()) ||
        m.user.email?.toLowerCase().includes(searchText.toLowerCase())
    );

    const columns = [
        {
            title: 'AGENT',
            dataIndex: 'user',
            key: 'user',
            render: (user: WorkspaceMember['user']) => (
                <div className="flex items-center gap-3">
                    <Avatar
                        size={40}
                        className="bg-primary-100 text-primary-700 font-semibold"
                    >
                        {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
                    </Avatar>
                    <div>
                        <div className="font-medium text-neutral-900">{user.displayName || 'Chưa đặt tên'}</div>
                        <div className="text-sm text-neutral-500">{user.email}</div>
                    </div>
                </div>
            ),
        },
        {
            title: 'VAI TRÒ',
            dataIndex: 'roles',
            key: 'roles',
            render: (roles: string[]) => {
                const role = roles[0] || 'User';
                const color = role === 'Owner' ? 'gold' : role === 'Admin' ? 'blue' : 'default';
                return <Tag color={color}>{role}</Tag>;
            },
        },
        {
            title: 'TRẠNG THÁI',
            key: 'status',
            render: () => (
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <span className="text-sm text-neutral-600">Online</span>
                </div>
            ),
        },
        {
            title: 'THAM GIA',
            dataIndex: 'joinedAt',
            key: 'joinedAt',
            render: (date: string) => new Date(date).toLocaleDateString('vi-VN'),
        },
    ];

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
                <div className="max-w-4xl">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-2xl text-primary-600">support_agent</span>
                                <h1 className="text-2xl font-bold text-neutral-900">Agents</h1>
                                <span className="text-neutral-400 ml-2">{members.length} thành viên</span>
                            </div>
                            <p className="text-neutral-500 mt-1">
                                Quản lý các agents trong workspace của bạn
                            </p>
                        </div>
                        <Input
                            placeholder="Tìm kiếm agent..."
                            prefix={<span className="material-symbols-outlined text-neutral-400 text-lg">search</span>}
                            className="w-64"
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                        />
                    </div>

                    {/* Table */}
                    <div className="bg-white rounded-lg shadow-sm border border-neutral-200">
                        <Table
                            dataSource={filteredMembers}
                            columns={columns}
                            rowKey="membershipKey"
                            pagination={false}
                        />
                    </div>
                </div>
            </Spin>
        </SettingsLayout>
    );
};

export default AgentsSettingsPage;
