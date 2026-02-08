import React, { useState, useEffect } from 'react';
import { Card, Table, Tag, Button, Input, Avatar, Dropdown, Space, Modal, Select, message, Spin } from 'antd';
import { AdminLayout } from '@/components/layout/AdminLayout';
import api from '@/lib/http';

interface User {
    key: number;
    UserKey: number;
    UserId: string;
    DisplayName: string;
    Email: string;
    UserLevel: number;
    Status: number;
    EmailVerified: boolean;
    CreatedAt: string;
    UpdatedAt: string;
}

interface UsersResponse {
    users: User[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

const AdminUsersPage: React.FC = () => {
    const [searchText, setSearchText] = useState('');
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
    const [editModal, setEditModal] = useState<{ visible: boolean; user: User | null }>({ visible: false, user: null });
    const [editForm, setEditForm] = useState<{ userLevel: number; status: number }>({ userLevel: 0, status: 1 });

    const fetchUsers = async (page = 1, search = '') => {
        try {
            setLoading(true);
            const res = await api.get<UsersResponse>('/admin/users', {
                params: { page, limit: 20, search }
            });
            setUsers(res.data.users.map((u, idx) => ({ ...u, key: idx })));
            setPagination({
                current: res.data.page,
                pageSize: res.data.limit,
                total: res.data.total
            });
        } catch (error: any) {
            console.error('Failed to fetch users:', error);
            if (error?.response?.status === 403) {
                message.error('Bạn không có quyền truy cập');
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const handleSearch = () => {
        fetchUsers(1, searchText);
    };

    const handleBan = async (userKey: number) => {
        try {
            await api.post(`/admin/users/${userKey}/ban`);
            message.success('Đã ban user');
            fetchUsers(pagination.current, searchText);
        } catch (error) {
            message.error('Lỗi khi ban user');
        }
    };

    const handleUnban = async (userKey: number) => {
        try {
            await api.post(`/admin/users/${userKey}/unban`);
            message.success('Đã unban user');
            fetchUsers(pagination.current, searchText);
        } catch (error) {
            message.error('Lỗi khi unban user');
        }
    };

    const handleSetLevel = async () => {
        if (!editModal.user) return;
        try {
            await api.post(`/admin/users/${editModal.user.UserKey}/level`, {
                level: editForm.userLevel
            });
            message.success('Đã cập nhật quyền user');
            setEditModal({ visible: false, user: null });
            fetchUsers(pagination.current, searchText);
        } catch (error) {
            message.error('Lỗi khi cập nhật');
        }
    };

    const openEditModal = (user: User) => {
        setEditForm({ userLevel: user.UserLevel, status: user.Status });
        setEditModal({ visible: true, user });
    };

    const getUserLevelLabel = (level: number) => {
        switch (level) {
            case 9: return { label: 'SUPERADMIN', color: 'gold' };
            case 1: return { label: 'DEMO', color: 'purple' };
            default: return { label: 'USER', color: 'default' };
        }
    };

    const columns = [
        {
            title: 'USER',
            dataIndex: 'DisplayName',
            key: 'displayName',
            render: (name: string, record: User) => (
                <div className="flex items-center gap-3">
                    <Avatar className="bg-gradient-to-br from-primary-500 to-primary-700">
                        {(name || record.Email || '?').charAt(0).toUpperCase()}
                    </Avatar>
                    <div>
                        <div className="font-medium text-white">{name || 'Unnamed'}</div>
                        <div className="text-xs text-neutral-500">{record.Email}</div>
                    </div>
                </div>
            )
        },
        {
            title: 'LEVEL',
            dataIndex: 'UserLevel',
            key: 'userLevel',
            render: (level: number) => {
                const { label, color } = getUserLevelLabel(level);
                return <Tag color={color}>{label}</Tag>;
            }
        },
        {
            title: 'VERIFIED',
            dataIndex: 'EmailVerified',
            key: 'emailVerified',
            render: (verified: boolean) => (
                <Tag color={verified ? 'green' : 'default'}>
                    {verified ? 'YES' : 'NO'}
                </Tag>
            )
        },
        {
            title: 'STATUS',
            dataIndex: 'Status',
            key: 'status',
            render: (status: number) => {
                const colors: Record<number, string> = { 1: 'green', 0: 'red' };
                return <Tag color={colors[status]}>{status === 1 ? 'ACTIVE' : 'BANNED'}</Tag>;
            }
        },
        {
            title: 'CREATED',
            dataIndex: 'CreatedAt',
            key: 'createdAt',
            render: (date: string) => (
                <span className="text-neutral-400">
                    {new Date(date).toLocaleDateString('vi-VN')}
                </span>
            )
        },
        {
            title: '',
            key: 'actions',
            render: (_: any, record: User) => (
                <Dropdown menu={{
                    items: [
                        { key: 'edit', label: 'Chỉnh sửa quyền', onClick: () => openEditModal(record) },
                        { type: 'divider' },
                        record.Status === 1
                            ? { key: 'ban', label: 'Ban User', danger: true, onClick: () => handleBan(record.UserKey) }
                            : { key: 'unban', label: 'Unban User', onClick: () => handleUnban(record.UserKey) },
                    ]
                }}>
                    <Button type="text" size="small">
                        <span className="material-symbols-outlined text-neutral-400">more_vert</span>
                    </Button>
                </Dropdown>
            )
        },
    ];

    const stats = {
        total: pagination.total,
        active: users.filter(u => u.Status === 1).length,
        admins: users.filter(u => u.UserLevel === 9).length,
        banned: users.filter(u => u.Status === 0).length
    };

    if (loading && users.length === 0) {
        return (
            <AdminLayout>
                <div className="flex items-center justify-center h-64">
                    <Spin size="large" />
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-white">Users</h1>
                        <p className="text-neutral-400 mt-1">Quản lý tất cả users trong hệ thống</p>
                    </div>
                    <Space>
                        <Input
                            placeholder="Search users..."
                            prefix={<span className="material-symbols-outlined text-neutral-400">search</span>}
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                            onPressEnter={handleSearch}
                            className="w-64"
                        />
                        <Button onClick={handleSearch}>Tìm kiếm</Button>
                    </Space>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-4 gap-4">
                    <Card className="bg-neutral-800 border-neutral-700">
                        <div className="text-center">
                            <p className="text-3xl font-bold text-white">{stats.total}</p>
                            <p className="text-neutral-400 text-sm">Total Users</p>
                        </div>
                    </Card>
                    <Card className="bg-neutral-800 border-neutral-700">
                        <div className="text-center">
                            <p className="text-3xl font-bold text-green-500">{stats.active}</p>
                            <p className="text-neutral-400 text-sm">Active</p>
                        </div>
                    </Card>
                    <Card className="bg-neutral-800 border-neutral-700">
                        <div className="text-center">
                            <p className="text-3xl font-bold text-yellow-500">{stats.admins}</p>
                            <p className="text-neutral-400 text-sm">SuperAdmins</p>
                        </div>
                    </Card>
                    <Card className="bg-neutral-800 border-neutral-700">
                        <div className="text-center">
                            <p className="text-3xl font-bold text-red-500">{stats.banned}</p>
                            <p className="text-neutral-400 text-sm">Banned</p>
                        </div>
                    </Card>
                </div>

                {/* Table */}
                <Card className="bg-neutral-800 border-neutral-700">
                    <Table
                        dataSource={users}
                        columns={columns}
                        loading={loading}
                        pagination={{
                            ...pagination,
                            onChange: (page) => fetchUsers(page, searchText)
                        }}
                        className="admin-table"
                    />
                </Card>

                {/* Edit Modal */}
                <Modal
                    title="Chỉnh sửa User"
                    open={editModal.visible}
                    onOk={handleSetLevel}
                    onCancel={() => setEditModal({ visible: false, user: null })}
                    okText="Lưu"
                    cancelText="Hủy"
                >
                    <div className="space-y-4 py-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">User Level</label>
                            <Select
                                value={editForm.userLevel}
                                onChange={(value) => setEditForm({ ...editForm, userLevel: value })}
                                className="w-full"
                                options={[
                                    { value: 0, label: 'Normal User' },
                                    { value: 1, label: 'Demo (Read-only)' },
                                    { value: 9, label: 'SuperAdmin' },
                                ]}
                            />
                        </div>
                    </div>
                </Modal>
            </div>
        </AdminLayout>
    );
};

export default AdminUsersPage;
