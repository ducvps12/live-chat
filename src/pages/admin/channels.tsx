import React, { useEffect, useState } from 'react';
import { Card, Table, Tag, Button, Tabs, Spin, message, Empty } from 'antd';
import { AdminLayout } from '@/components/layout/AdminLayout';
import api from '@/lib/http';

interface FacebookPage {
    id: string;
    name: string;
    workspaceName: string;
    status: string;
    connectedAt: string;
}

interface ZaloSession {
    sessionId: string;
    workspaceName: string;
    status: string;
    lastActivity: string;
}

const ChannelsPage: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [facebookPages, setFacebookPages] = useState<FacebookPage[]>([]);
    const [zaloSessions, setZaloSessions] = useState<ZaloSession[]>([]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                // Mock data for now - API can be added later
                // In real implementation, these would be API calls
                setFacebookPages([]);
                setZaloSessions([]);
            } catch (error) {
                console.error('Failed to fetch channels:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    const facebookColumns = [
        {
            title: 'Page Name',
            dataIndex: 'name',
            key: 'name',
            render: (name: string) => <span className="font-medium text-white">{name}</span>
        },
        {
            title: 'Workspace',
            dataIndex: 'workspaceName',
            key: 'workspace',
            render: (name: string) => <span className="text-neutral-300">{name}</span>
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            render: (status: string) => (
                <Tag color={status === 'connected' ? 'green' : 'red'}>
                    {status === 'connected' ? 'Connected' : 'Disconnected'}
                </Tag>
            )
        },
        {
            title: 'Connected At',
            dataIndex: 'connectedAt',
            key: 'connectedAt',
            render: (date: string) => (
                <span className="text-neutral-400">
                    {date ? new Date(date).toLocaleString('vi-VN') : '-'}
                </span>
            )
        },
        {
            title: 'Actions',
            key: 'actions',
            render: () => (
                <Button size="small" danger>Disconnect</Button>
            )
        }
    ];

    const zaloColumns = [
        {
            title: 'Session ID',
            dataIndex: 'sessionId',
            key: 'sessionId',
            render: (id: string) => (
                <span className="font-mono text-white">{id.substring(0, 20)}...</span>
            )
        },
        {
            title: 'Workspace',
            dataIndex: 'workspaceName',
            key: 'workspace',
            render: (name: string) => <span className="text-neutral-300">{name}</span>
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            render: (status: string) => (
                <Tag color={status === 'active' ? 'green' : status === 'pending' ? 'orange' : 'red'}>
                    {status === 'active' ? 'Active' : status === 'pending' ? 'Pending' : 'Expired'}
                </Tag>
            )
        },
        {
            title: 'Last Activity',
            dataIndex: 'lastActivity',
            key: 'lastActivity',
            render: (date: string) => (
                <span className="text-neutral-400">
                    {date ? new Date(date).toLocaleString('vi-VN') : '-'}
                </span>
            )
        },
        {
            title: 'Actions',
            key: 'actions',
            render: () => (
                <Button size="small" danger>Terminate</Button>
            )
        }
    ];

    const tabItems = [
        {
            key: 'facebook',
            label: (
                <span className="flex items-center gap-2">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                    </svg>
                    Facebook Pages
                </span>
            ),
            children: (
                <Card className="bg-neutral-800 border-neutral-700">
                    {facebookPages.length > 0 ? (
                        <Table
                            dataSource={facebookPages}
                            columns={facebookColumns}
                            rowKey="id"
                            pagination={false}
                            className="admin-table"
                        />
                    ) : (
                        <Empty
                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                            description={
                                <span className="text-neutral-500">
                                    Chưa có Facebook Page nào được kết nối
                                </span>
                            }
                        />
                    )}
                </Card>
            )
        },
        {
            key: 'zalo',
            label: (
                <span className="flex items-center gap-2">
                    <svg className="w-4 h-4" viewBox="0 0 48 48" fill="currentColor">
                        <path d="M24 4C12.954 4 4 12.954 4 24s8.954 20 20 20 20-8.954 20-20S35.046 4 24 4zm0 36c-8.822 0-16-7.178-16-16S15.178 8 24 8s16 7.178 16 16-7.178 16-16 16z" />
                        <circle cx="24" cy="24" r="8" />
                    </svg>
                    Zalo Sessions
                </span>
            ),
            children: (
                <Card className="bg-neutral-800 border-neutral-700">
                    {zaloSessions.length > 0 ? (
                        <Table
                            dataSource={zaloSessions}
                            columns={zaloColumns}
                            rowKey="sessionId"
                            pagination={false}
                            className="admin-table"
                        />
                    ) : (
                        <Empty
                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                            description={
                                <span className="text-neutral-500">
                                    Chưa có Zalo session nào đang hoạt động
                                </span>
                            }
                        />
                    )}
                </Card>
            )
        }
    ];

    if (loading) {
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
                <div>
                    <h1 className="text-2xl font-bold text-white">Channels</h1>
                    <p className="text-neutral-400 mt-1">
                        Quản lý kết nối Facebook và Zalo
                    </p>
                </div>

                {/* Overview Cards */}
                <div className="grid grid-cols-2 gap-4">
                    <Card className="bg-gradient-to-br from-blue-600 to-blue-700 border-0">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                                <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-blue-100">Facebook Pages</p>
                                <p className="text-3xl font-bold text-white">{facebookPages.length}</p>
                            </div>
                        </div>
                    </Card>
                    <Card className="bg-gradient-to-br from-blue-500 to-cyan-500 border-0">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                                <span className="text-white font-bold text-lg">Z</span>
                            </div>
                            <div>
                                <p className="text-blue-100">Zalo Sessions</p>
                                <p className="text-3xl font-bold text-white">{zaloSessions.length}</p>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* Tabs */}
                <Tabs
                    defaultActiveKey="facebook"
                    items={tabItems}
                    className="admin-tabs"
                />
            </div>
        </AdminLayout>
    );
};

export default ChannelsPage;
