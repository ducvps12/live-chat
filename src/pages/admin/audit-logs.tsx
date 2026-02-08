import React, { useEffect, useState } from 'react';
import { Card, Table, Tag, Select, Input, DatePicker, Button, Spin, Empty, Row, Col } from 'antd';
import { AdminLayout } from '@/components/layout/AdminLayout';
import api from '@/lib/http';
import dayjs from 'dayjs';

interface AuditLog {
    LogKey: number;
    LogId: string;
    Action: string;
    EntityType: string | null;
    EntityId: string | null;
    ActorKey: number | null;
    ActorEmail: string | null;
    IpAddress: string | null;
    Status: string;
    CreatedAt: string;
    Details: any;
}

const AuditLogsPage: React.FC = () => {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);

    // Filters
    const [action, setAction] = useState<string | null>(null);
    const [entityType, setEntityType] = useState<string | null>(null);
    const [status, setStatus] = useState<string | null>(null);
    const [actorEmail, setActorEmail] = useState('');
    const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([null, null]);

    // Filter options
    const [actions, setActions] = useState<string[]>([]);
    const [entityTypes, setEntityTypes] = useState<string[]>([]);

    const fetchLogs = async () => {
        try {
            setLoading(true);
            const params: any = { page, limit: 50 };
            if (action) params.action = action;
            if (entityType) params.entityType = entityType;
            if (status) params.status = status;
            if (actorEmail) params.actorEmail = actorEmail;
            if (dateRange[0]) params.startDate = dateRange[0].toISOString();
            if (dateRange[1]) params.endDate = dateRange[1].toISOString();

            const res = await api.get('/admin/audit-logs', { params });
            setLogs(res.data.logs || []);
            setTotal(res.data.total || 0);
        } catch (error) {
            console.error('Failed to fetch audit logs:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchFilters = async () => {
        try {
            const [actionsRes, typesRes] = await Promise.all([
                api.get('/admin/audit-logs/actions'),
                api.get('/admin/audit-logs/entity-types')
            ]);
            setActions(actionsRes.data || []);
            setEntityTypes(typesRes.data || []);
        } catch (error) {
            console.error('Failed to fetch filter options:', error);
        }
    };

    useEffect(() => {
        fetchFilters();
    }, []);

    useEffect(() => {
        fetchLogs();
    }, [page]);

    const handleFilter = () => {
        setPage(1);
        fetchLogs();
    };

    const handleReset = () => {
        setAction(null);
        setEntityType(null);
        setStatus(null);
        setActorEmail('');
        setDateRange([null, null]);
        setPage(1);
        setTimeout(fetchLogs, 100);
    };

    const getActionColor = (action: string) => {
        const colors: Record<string, string> = {
            'login': 'green',
            'logout': 'default',
            'create': 'blue',
            'update': 'orange',
            'delete': 'red',
            'ban': 'volcano',
            'unban': 'cyan',
            'admin_grant': 'purple',
            'admin_revoke': 'magenta'
        };
        return colors[action.toLowerCase()] || 'default';
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'success': return 'green';
            case 'failed': return 'red';
            case 'warning': return 'orange';
            default: return 'default';
        }
    };

    const columns = [
        {
            title: 'Time',
            dataIndex: 'CreatedAt',
            key: 'time',
            width: 160,
            render: (date: string) => (
                <span className="text-neutral-300 text-sm">
                    {dayjs(date).format('DD/MM/YYYY HH:mm:ss')}
                </span>
            )
        },
        {
            title: 'Action',
            dataIndex: 'Action',
            key: 'action',
            render: (action: string) => (
                <Tag color={getActionColor(action)}>{action.toUpperCase()}</Tag>
            )
        },
        {
            title: 'Entity',
            key: 'entity',
            render: (_: any, record: AuditLog) => (
                <div>
                    {record.EntityType && (
                        <span className="text-neutral-400">{record.EntityType}: </span>
                    )}
                    <span className="text-white font-mono text-xs">
                        {record.EntityId ? record.EntityId.substring(0, 20) + '...' : '-'}
                    </span>
                </div>
            )
        },
        {
            title: 'Actor',
            dataIndex: 'ActorEmail',
            key: 'actor',
            render: (email: string | null) => (
                <span className="text-neutral-300">{email || 'System'}</span>
            )
        },
        {
            title: 'IP Address',
            dataIndex: 'IpAddress',
            key: 'ip',
            render: (ip: string | null) => (
                <span className="text-neutral-500 font-mono text-xs">{ip || '-'}</span>
            )
        },
        {
            title: 'Status',
            dataIndex: 'Status',
            key: 'status',
            render: (status: string) => (
                <Tag color={getStatusColor(status)}>{status}</Tag>
            )
        }
    ];

    return (
        <AdminLayout>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold text-white">Audit Logs</h1>
                        <p className="text-neutral-400 mt-1">Lịch sử hoạt động hệ thống</p>
                    </div>
                    <div className="text-neutral-400">
                        Tổng: <span className="text-white font-medium">{total}</span> logs
                    </div>
                </div>

                {/* Filters */}
                <Card className="bg-neutral-800 border-neutral-700">
                    <Row gutter={[16, 16]}>
                        <Col span={6}>
                            <Select
                                placeholder="Action"
                                value={action}
                                onChange={setAction}
                                allowClear
                                style={{ width: '100%' }}
                                options={actions.map(a => ({ value: a, label: a.toUpperCase() }))}
                            />
                        </Col>
                        <Col span={6}>
                            <Select
                                placeholder="Entity Type"
                                value={entityType}
                                onChange={setEntityType}
                                allowClear
                                style={{ width: '100%' }}
                                options={entityTypes.map(t => ({ value: t, label: t }))}
                            />
                        </Col>
                        <Col span={6}>
                            <Select
                                placeholder="Status"
                                value={status}
                                onChange={setStatus}
                                allowClear
                                style={{ width: '100%' }}
                                options={[
                                    { value: 'success', label: 'Success' },
                                    { value: 'failed', label: 'Failed' },
                                    { value: 'warning', label: 'Warning' }
                                ]}
                            />
                        </Col>
                        <Col span={6}>
                            <Input
                                placeholder="Actor Email"
                                value={actorEmail}
                                onChange={e => setActorEmail(e.target.value)}
                                allowClear
                            />
                        </Col>
                        <Col span={12}>
                            <DatePicker.RangePicker
                                value={dateRange as any}
                                onChange={(dates) => setDateRange(dates as any)}
                                style={{ width: '100%' }}
                                showTime
                            />
                        </Col>
                        <Col span={12} className="flex gap-2 justify-end">
                            <Button onClick={handleReset}>Reset</Button>
                            <Button type="primary" onClick={handleFilter}>Lọc</Button>
                        </Col>
                    </Row>
                </Card>

                {/* Table */}
                <Card className="bg-neutral-800 border-neutral-700">
                    {loading ? (
                        <div className="flex justify-center py-8">
                            <Spin size="large" />
                        </div>
                    ) : logs.length > 0 ? (
                        <Table
                            dataSource={logs.map(l => ({ ...l, key: l.LogKey }))}
                            columns={columns}
                            pagination={{
                                current: page,
                                total,
                                pageSize: 50,
                                onChange: setPage,
                                showSizeChanger: false,
                                showTotal: (total, range) => `${range[0]}-${range[1]} of ${total}`
                            }}
                            className="admin-table"
                        />
                    ) : (
                        <Empty
                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                            description={
                                <span className="text-neutral-500">
                                    Chưa có audit log nào
                                </span>
                            }
                        />
                    )}
                </Card>
            </div>
        </AdminLayout>
    );
};

export default AuditLogsPage;
