import React, { useEffect, useState } from 'react';
import { Card, Table, Tag, Button, Input, Select, Modal, Spin, message, Tooltip, Popconfirm } from 'antd';
import { AdminLayout } from '@/components/layout/AdminLayout';
import api from '@/lib/http';

interface Conversation {
    ConversationKey: number;
    ConversationId: string;
    VisitorId: string;
    VisitorName: string | null;
    Status: number;
    CreatedAt: string;
    LastMessageAt: string | null;
    MessageCount: number;
    VisitorMessageCount: number;
    LastMessagePreview: string | null;
    WidgetName: string;
    WorkspaceName: string;
}

interface Message {
    MessageKey: number;
    MessageId: string;
    SenderType: number;
    Content: string;
    CreatedAt: string;
}

const ConversationsPage: React.FC = () => {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<number | null>(null);

    // Detail modal state
    const [detailModal, setDetailModal] = useState(false);
    const [selectedConversation, setSelectedConversation] = useState<any>(null);
    const [detailLoading, setDetailLoading] = useState(false);

    const fetchConversations = async () => {
        try {
            setLoading(true);
            const params: any = { page, limit: 20 };
            if (search) params.search = search;
            if (statusFilter !== null) params.status = statusFilter;

            const res = await api.get('/admin/conversations', { params });
            setConversations(res.data.conversations.map((c: any, idx: number) => ({
                ...c,
                key: c.ConversationKey
            })));
            setTotal(res.data.total);
        } catch (error) {
            console.error('Failed to fetch conversations:', error);
            message.error('Không thể tải danh sách hội thoại');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchConversations();
    }, [page, statusFilter]);

    const handleSearch = () => {
        setPage(1);
        fetchConversations();
    };

    const viewDetail = async (conversationId: string) => {
        try {
            setDetailLoading(true);
            setDetailModal(true);
            const res = await api.get(`/admin/conversations/${conversationId}`);
            setSelectedConversation(res.data);
        } catch (error) {
            message.error('Không thể tải chi tiết hội thoại');
        } finally {
            setDetailLoading(false);
        }
    };

    const handleDelete = async (conversationId: string) => {
        try {
            await api.delete(`/admin/conversations/${conversationId}`);
            message.success('Đã xóa hội thoại');
            fetchConversations();
        } catch (error) {
            message.error('Không thể xóa hội thoại');
        }
    };

    const getStatusTag = (status: number) => {
        switch (status) {
            case 1:
                return <Tag color="green">Active</Tag>;
            case 2:
                return <Tag color="orange">Pending</Tag>;
            case 3:
                return <Tag color="red">Closed</Tag>;
            default:
                return <Tag color="default">Unknown</Tag>;
        }
    };

    const columns = [
        {
            title: 'Visitor',
            key: 'visitor',
            render: (_: any, record: Conversation) => (
                <div>
                    <div className="font-medium text-white">{record.VisitorName || 'Anonymous'}</div>
                    <div className="text-xs text-neutral-500">{record.VisitorId.substring(0, 20)}...</div>
                </div>
            )
        },
        {
            title: 'Workspace',
            dataIndex: 'WorkspaceName',
            key: 'workspace',
            render: (name: string) => <span className="text-neutral-300">{name}</span>
        },
        {
            title: 'Widget',
            dataIndex: 'WidgetName',
            key: 'widget',
            render: (name: string) => <span className="text-blue-400">{name}</span>
        },
        {
            title: 'Messages',
            key: 'messages',
            render: (_: any, record: Conversation) => (
                <div className="text-center">
                    <span className="text-white font-medium">{record.MessageCount}</span>
                    <span className="text-neutral-500 text-xs ml-1">({record.VisitorMessageCount} visitor)</span>
                </div>
            )
        },
        {
            title: 'Last Message',
            dataIndex: 'LastMessagePreview',
            key: 'lastMessage',
            width: 200,
            render: (preview: string | null) => (
                <Tooltip title={preview}>
                    <span className="text-neutral-400 truncate block max-w-[180px]">
                        {preview ? preview.substring(0, 50) + (preview.length > 50 ? '...' : '') : '-'}
                    </span>
                </Tooltip>
            )
        },
        {
            title: 'Status',
            dataIndex: 'Status',
            key: 'status',
            render: (status: number) => getStatusTag(status)
        },
        {
            title: 'Last Activity',
            dataIndex: 'LastMessageAt',
            key: 'lastActivity',
            render: (date: string | null) => (
                <span className="text-neutral-400">
                    {date ? new Date(date).toLocaleString('vi-VN') : '-'}
                </span>
            )
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (_: any, record: Conversation) => (
                <div className="flex gap-2">
                    <Button
                        size="small"
                        type="primary"
                        ghost
                        onClick={() => viewDetail(record.ConversationId)}
                    >
                        Xem
                    </Button>
                    <Popconfirm
                        title="Xóa hội thoại này?"
                        description="Tất cả tin nhắn sẽ bị xóa vĩnh viễn"
                        onConfirm={() => handleDelete(record.ConversationId)}
                        okText="Xóa"
                        cancelText="Hủy"
                        okButtonProps={{ danger: true }}
                    >
                        <Button size="small" danger>Xóa</Button>
                    </Popconfirm>
                </div>
            )
        }
    ];

    return (
        <AdminLayout>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold text-white">Conversations</h1>
                        <p className="text-neutral-400 mt-1">Quản lý tất cả cuộc hội thoại</p>
                    </div>
                    <div className="text-neutral-400">
                        Tổng: <span className="text-white font-medium">{total}</span> hội thoại
                    </div>
                </div>

                {/* Filters */}
                <Card className="bg-neutral-800 border-neutral-700">
                    <div className="flex gap-4">
                        <Input.Search
                            placeholder="Tìm theo Visitor ID hoặc tên..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            onSearch={handleSearch}
                            style={{ width: 300 }}
                            allowClear
                        />
                        <Select
                            placeholder="Trạng thái"
                            style={{ width: 150 }}
                            allowClear
                            value={statusFilter}
                            onChange={setStatusFilter}
                            options={[
                                { value: 1, label: 'Active' },
                                { value: 2, label: 'Pending' },
                                { value: 3, label: 'Closed' }
                            ]}
                        />
                    </div>
                </Card>

                {/* Table */}
                <Card className="bg-neutral-800 border-neutral-700">
                    <Table
                        dataSource={conversations}
                        columns={columns}
                        loading={loading}
                        pagination={{
                            current: page,
                            total,
                            pageSize: 20,
                            onChange: setPage,
                            showSizeChanger: false,
                            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total}`
                        }}
                        className="admin-table"
                    />
                </Card>
            </div>

            {/* Detail Modal */}
            <Modal
                title={<span className="text-white">Chi tiết hội thoại</span>}
                open={detailModal}
                onCancel={() => setDetailModal(false)}
                footer={null}
                width={700}
                className="admin-modal"
            >
                {detailLoading ? (
                    <div className="flex justify-center py-8">
                        <Spin size="large" />
                    </div>
                ) : selectedConversation ? (
                    <div className="space-y-4">
                        {/* Info */}
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <span className="text-neutral-500">Visitor:</span>
                                <span className="text-white ml-2">{selectedConversation.VisitorName || 'Anonymous'}</span>
                            </div>
                            <div>
                                <span className="text-neutral-500">Workspace:</span>
                                <span className="text-white ml-2">{selectedConversation.WorkspaceName}</span>
                            </div>
                            <div>
                                <span className="text-neutral-500">Widget:</span>
                                <span className="text-white ml-2">{selectedConversation.WidgetName}</span>
                            </div>
                            <div>
                                <span className="text-neutral-500">Messages:</span>
                                <span className="text-white ml-2">{selectedConversation.MessageCount}</span>
                            </div>
                        </div>

                        {/* Messages */}
                        <div className="border-t border-neutral-700 pt-4">
                            <h4 className="text-white font-medium mb-3">Lịch sử tin nhắn</h4>
                            <div className="max-h-[400px] overflow-y-auto space-y-2 pr-2">
                                {selectedConversation.messages?.map((msg: Message) => (
                                    <div
                                        key={msg.MessageKey}
                                        className={`p-3 rounded-lg ${msg.SenderType === 1
                                                ? 'bg-neutral-700 ml-0 mr-12'  // Visitor
                                                : 'bg-primary-600/30 ml-12 mr-0'  // Agent
                                            }`}
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <span className={`text-xs ${msg.SenderType === 1 ? 'text-green-400' : 'text-blue-400'}`}>
                                                {msg.SenderType === 1 ? 'Visitor' : 'Agent'}
                                            </span>
                                            <span className="text-xs text-neutral-500">
                                                {new Date(msg.CreatedAt).toLocaleString('vi-VN')}
                                            </span>
                                        </div>
                                        <p className="text-neutral-200 text-sm whitespace-pre-wrap">{msg.Content}</p>
                                    </div>
                                ))}
                                {(!selectedConversation.messages || selectedConversation.messages.length === 0) && (
                                    <div className="text-center text-neutral-500 py-4">
                                        Không có tin nhắn
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ) : null}
            </Modal>
        </AdminLayout>
    );
};

export default ConversationsPage;
