import React, { useState, useEffect } from 'react';
import { Card, Table, Tag, Button, Input, Modal, Dropdown, Space, Spin, message } from 'antd';
import { AdminLayout } from '@/components/layout/AdminLayout';
import api from '@/lib/http';

interface Workspace {
    key: number;
    WorkspaceKey: number;
    WorkspaceId: string;
    Name: string;
    OwnerEmail: string;
    MemberCount: number;
    Status: number;
    CreatedAt: string;
    UpdatedAt: string;
}

interface WorkspacesResponse {
    workspaces: Workspace[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

const AdminWorkspacesPage: React.FC = () => {
    const [searchText, setSearchText] = useState('');
    const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
    const [loading, setLoading] = useState(true);
    const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
    const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null);
    const [detailModalOpen, setDetailModalOpen] = useState(false);

    const fetchWorkspaces = async (page = 1, search = '') => {
        try {
            setLoading(true);
            const res = await api.get<WorkspacesResponse>('/admin/workspaces', {
                params: { page, limit: 20, search }
            });
            setWorkspaces(res.data.workspaces.map((ws, idx) => ({ ...ws, key: idx })));
            setPagination({
                current: res.data.page,
                pageSize: res.data.limit,
                total: res.data.total
            });
        } catch (error: any) {
            console.error('Failed to fetch workspaces:', error);
            if (error?.response?.status === 403) {
                message.error('Bạn không có quyền truy cập');
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchWorkspaces();
    }, []);

    const handleSearch = () => {
        fetchWorkspaces(1, searchText);
    };

    const handleSuspend = async (workspaceId: string) => {
        try {
            await api.put(`/admin/workspaces/${workspaceId}`, { status: 0 });
            message.success('Đã suspend workspace');
            fetchWorkspaces(pagination.current, searchText);
        } catch (error) {
            message.error('Lỗi khi suspend workspace');
        }
    };

    const handleActivate = async (workspaceId: string) => {
        try {
            await api.put(`/admin/workspaces/${workspaceId}`, { status: 1 });
            message.success('Đã activate workspace');
            fetchWorkspaces(pagination.current, searchText);
        } catch (error) {
            message.error('Lỗi khi activate workspace');
        }
    };

    const columns = [
        {
            title: 'WORKSPACE',
            dataIndex: 'Name',
            key: 'name',
            render: (name: string, record: Workspace) => (
                <div>
                    <div className="font-medium text-white">{name}</div>
                    <div className="text-xs text-neutral-500">{record.WorkspaceId}</div>
                </div>
            )
        },
        {
            title: 'OWNER',
            dataIndex: 'OwnerEmail',
            key: 'owner',
            render: (email: string) => (
                <span className="text-neutral-300">{email || 'N/A'}</span>
            )
        },
        {
            title: 'MEMBERS',
            dataIndex: 'MemberCount',
            key: 'members',
            render: (n: number) => <span className="text-neutral-300">{n}</span>
        },
        {
            title: 'STATUS',
            dataIndex: 'Status',
            key: 'status',
            render: (status: number) => (
                <Tag color={status === 1 ? 'green' : 'red'}>
                    {status === 1 ? 'ACTIVE' : 'SUSPENDED'}
                </Tag>
            )
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
            render: (_: any, record: Workspace) => (
                <Dropdown menu={{
                    items: [
                        {
                            key: 'view',
                            label: 'View Details',
                            onClick: () => { setSelectedWorkspace(record); setDetailModalOpen(true); }
                        },
                        { type: 'divider' },
                        record.Status === 1
                            ? { key: 'suspend', label: 'Suspend', danger: true, onClick: () => handleSuspend(record.WorkspaceId) }
                            : { key: 'activate', label: 'Activate', onClick: () => handleActivate(record.WorkspaceId) },
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
        active: workspaces.filter(w => w.Status === 1).length,
        suspended: workspaces.filter(w => w.Status === 0).length
    };

    if (loading && workspaces.length === 0) {
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
                        <h1 className="text-2xl font-bold text-white">Workspaces</h1>
                        <p className="text-neutral-400 mt-1">Quản lý tất cả workspaces trong hệ thống</p>
                    </div>
                    <Space>
                        <Input
                            placeholder="Search workspaces..."
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
                <div className="grid grid-cols-3 gap-4">
                    <Card className="bg-neutral-800 border-neutral-700">
                        <div className="text-center">
                            <p className="text-3xl font-bold text-white">{stats.total}</p>
                            <p className="text-neutral-400 text-sm">Total Workspaces</p>
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
                            <p className="text-3xl font-bold text-red-500">{stats.suspended}</p>
                            <p className="text-neutral-400 text-sm">Suspended</p>
                        </div>
                    </Card>
                </div>

                {/* Table */}
                <Card className="bg-neutral-800 border-neutral-700">
                    <Table
                        dataSource={workspaces}
                        columns={columns}
                        loading={loading}
                        pagination={{
                            ...pagination,
                            onChange: (page) => fetchWorkspaces(page, searchText)
                        }}
                        className="admin-table"
                    />
                </Card>
            </div>

            {/* Detail Modal */}
            <Modal
                title={<span className="text-lg">Workspace Details</span>}
                open={detailModalOpen}
                onCancel={() => setDetailModalOpen(false)}
                footer={null}
                width={600}
            >
                {selectedWorkspace && (
                    <div className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm text-neutral-500">Workspace Name</label>
                                <p className="font-medium">{selectedWorkspace.Name}</p>
                            </div>
                            <div>
                                <label className="text-sm text-neutral-500">Workspace ID</label>
                                <p className="font-mono text-sm">{selectedWorkspace.WorkspaceId}</p>
                            </div>
                            <div>
                                <label className="text-sm text-neutral-500">Owner Email</label>
                                <p>{selectedWorkspace.OwnerEmail || 'N/A'}</p>
                            </div>
                            <div>
                                <label className="text-sm text-neutral-500">Members</label>
                                <p>{selectedWorkspace.MemberCount}</p>
                            </div>
                            <div>
                                <label className="text-sm text-neutral-500">Status</label>
                                <Tag color={selectedWorkspace.Status === 1 ? 'green' : 'red'}>
                                    {selectedWorkspace.Status === 1 ? 'ACTIVE' : 'SUSPENDED'}
                                </Tag>
                            </div>
                            <div>
                                <label className="text-sm text-neutral-500">Created</label>
                                <p>{new Date(selectedWorkspace.CreatedAt).toLocaleDateString('vi-VN')}</p>
                            </div>
                        </div>
                    </div>
                )}
            </Modal>
        </AdminLayout>
    );
};

export default AdminWorkspacesPage;
