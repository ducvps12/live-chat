import React, { useEffect, useState } from 'react';
import { Card, Table, Tag, Spin, message, Button } from 'antd';
import { AdminLayout } from '@/components/layout/AdminLayout';
import api from '@/lib/http';
import dynamic from 'next/dynamic';
import Link from 'next/link';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

interface DashboardStats {
    totalUsers: number;
    totalWorkspaces: number;
    totalAdmins: number;
    activeUsers: number;
    totalWidgets: number;
    totalConversations: number;
    totalMessages: number;
}

interface Workspace {
    key: number;
    WorkspaceId: string;
    Name: string;
    OwnerEmail: string;
    MemberCount: number;
    WidgetCount: number;
    Status: number;
    CreatedAt: string;
}

interface ChartData {
    Date: string;
    MessageCount?: number;
    ConversationCount?: number;
}

// Stat Card Component - Light theme with colored left border
const StatCard: React.FC<{
    title: string;
    value: number;
    icon: string;
    color: 'blue' | 'green' | 'orange' | 'purple';
    link?: string;
}> = ({ title, value, icon, color, link }) => {
    const colorClasses = {
        blue: { border: 'border-l-blue-500', bg: 'bg-blue-100', text: 'text-blue-600' },
        green: { border: 'border-l-green-500', bg: 'bg-green-100', text: 'text-green-600' },
        orange: { border: 'border-l-orange-500', bg: 'bg-orange-100', text: 'text-orange-500' },
        purple: { border: 'border-l-purple-500', bg: 'bg-purple-100', text: 'text-purple-600' },
    };

    const classes = colorClasses[color];

    return (
        <div className={`bg-white rounded-lg border-l-4 ${classes.border} p-5 shadow-sm hover:shadow-md transition-shadow`}>
            <div className="flex items-start justify-between">
                <div className={`w-12 h-12 ${classes.bg} rounded-full flex items-center justify-center`}>
                    <span className={`material-symbols-outlined ${classes.text} text-2xl`}>{icon}</span>
                </div>
            </div>
            <div className="mt-4">
                <h3 className="text-3xl font-bold text-gray-900">{value.toLocaleString()}</h3>
                <p className="text-gray-500 text-sm mt-1">{title}</p>
            </div>
            {link && (
                <Link href={link} className={`${classes.text} text-sm font-medium mt-3 inline-flex items-center hover:underline`}>
                    Xem chi tiết <span className="material-symbols-outlined text-sm ml-1">arrow_forward</span>
                </Link>
            )}
        </div>
    );
};

// Quick Action Button
const QuickAction: React.FC<{
    icon: string;
    label: string;
    href: string;
    variant?: 'primary' | 'secondary' | 'danger';
}> = ({ icon, label, href, variant = 'secondary' }) => {
    const variants = {
        primary: 'bg-blue-500 text-white hover:bg-blue-600',
        secondary: 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50',
        danger: 'bg-red-500 text-white hover:bg-red-600',
    };

    return (
        <Link href={href}>
            <Button className={`${variants[variant]} flex items-center gap-2 h-10 px-4 rounded-full`}>
                <span className="material-symbols-outlined text-lg">{icon}</span>
                {label}
            </Button>
        </Link>
    );
};

const AdminDashboard: React.FC = () => {
    const [stats, setStats] = useState<DashboardStats>({
        totalUsers: 0,
        totalWorkspaces: 0,
        totalAdmins: 0,
        activeUsers: 0,
        totalWidgets: 0,
        totalConversations: 0,
        totalMessages: 0
    });
    const [recentWorkspaces, setRecentWorkspaces] = useState<Workspace[]>([]);
    const [messageStats, setMessageStats] = useState<ChartData[]>([]);
    const [conversationStats, setConversationStats] = useState<ChartData[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const [statsRes, wsRes, msgStatsRes, convStatsRes] = await Promise.all([
                    api.get('/admin/dashboard'),
                    api.get('/admin/workspaces?limit=5'),
                    api.get('/admin/stats/messages?days=7'),
                    api.get('/admin/stats/conversations?days=7')
                ]);

                setStats(statsRes.data);
                const workspaces = wsRes.data.workspaces.map((ws: any, idx: number) => ({
                    key: idx,
                    ...ws
                }));
                setRecentWorkspaces(workspaces);
                setMessageStats(msgStatsRes.data || []);
                setConversationStats(convStatsRes.data || []);
            } catch (error: any) {
                console.error('Failed to fetch admin data:', error);
                if (error?.response?.status === 403) {
                    message.error('Bạn không có quyền truy cập trang Admin');
                }
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const messageChartOptions: ApexCharts.ApexOptions = {
        chart: { type: 'area', toolbar: { show: false }, background: 'transparent' },
        theme: { mode: 'dark' },
        stroke: { curve: 'smooth', width: 3 },
        fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.1 } },
        dataLabels: { enabled: false },
        xaxis: {
            categories: messageStats.map(s => new Date(s.Date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })),
            labels: { style: { colors: '#9ca3af' } }
        },
        yaxis: { labels: { style: { colors: '#9ca3af' } } },
        grid: { borderColor: '#374151' },
        colors: ['#3b82f6']
    };

    const conversationChartOptions: ApexCharts.ApexOptions = {
        chart: { type: 'bar', toolbar: { show: false }, background: 'transparent' },
        theme: { mode: 'dark' },
        plotOptions: { bar: { borderRadius: 4, horizontal: false } },
        dataLabels: { enabled: false },
        xaxis: {
            categories: conversationStats.map(s => new Date(s.Date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })),
            labels: { style: { colors: '#9ca3af' } }
        },
        yaxis: { labels: { style: { colors: '#9ca3af' } } },
        grid: { borderColor: '#374151' },
        colors: ['#22c55e']
    };

    const columns = [
        {
            title: 'Workspace',
            dataIndex: 'Name',
            key: 'name',
            render: (name: string) => <span className="font-medium text-white">{name}</span>
        },
        {
            title: 'Owner',
            dataIndex: 'OwnerEmail',
            key: 'owner',
            render: (email: string) => <span className="text-neutral-400">{email || 'N/A'}</span>
        },
        {
            title: 'Members',
            dataIndex: 'MemberCount',
            key: 'members',
            render: (count: number) => <span className="text-neutral-300">{count}</span>
        },
        {
            title: 'Widgets',
            dataIndex: 'WidgetCount',
            key: 'widgets',
            render: (count: number) => <span className="text-blue-400">{count}</span>
        },
        {
            title: 'Status',
            dataIndex: 'Status',
            key: 'status',
            render: (status: number) => (
                <Tag color={status === 1 ? 'green' : 'red'}>
                    {status === 1 ? 'ACTIVE' : 'INACTIVE'}
                </Tag>
            )
        },
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
                {/* Header with Breadcrumb */}
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                            <span className="material-symbols-outlined text-primary-500">dashboard</span>
                            Dashboard
                        </h1>
                        <p className="text-neutral-400 mt-1">Tổng quan hệ thống LiveChat</p>
                    </div>
                    <div className="text-neutral-400 text-sm">
                        <Link href="/admin" className="text-primary-500 hover:underline">Dashboard</Link>
                    </div>
                </div>

                {/* Alert Banner */}
                <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-white">check_circle</span>
                        <span className="text-white font-medium">Hệ thống đang hoạt động bình thường</span>
                    </div>
                    <span className="text-green-100 text-sm">{new Date().toLocaleDateString('vi-VN')}</span>
                </div>

                {/* Stats Cards - Grid 4 columns */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                    <StatCard
                        title="Tổng số gian hàng"
                        value={stats.totalWorkspaces}
                        icon="store"
                        color="blue"
                        link="/admin/workspaces"
                    />
                    <StatCard
                        title="Đang hoạt động"
                        value={stats.activeUsers}
                        icon="verified"
                        color="green"
                        link="/admin/users"
                    />
                    <StatCard
                        title="Chờ duyệt"
                        value={stats.totalAdmins}
                        icon="pending"
                        color="orange"
                        link="/admin/users"
                    />
                    <StatCard
                        title="Tổng sản phẩm"
                        value={stats.totalWidgets}
                        icon="widgets"
                        color="purple"
                        link="/admin/workspaces"
                    />
                </div>

                {/* Quick Actions */}
                <Card className="bg-neutral-800 border-neutral-700">
                    <div className="flex items-center gap-3 mb-4">
                        <span className="material-symbols-outlined text-yellow-500">bolt</span>
                        <span className="text-white font-medium">Thao tác nhanh</span>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <QuickAction icon="add_business" label="Quản lý Workspaces" href="/admin/workspaces" variant="primary" />
                        <QuickAction icon="category" label="Quản lý Users" href="/admin/users" />
                        <QuickAction icon="forum" label="Quản lý Conversations" href="/admin/conversations" variant="secondary" />
                        <QuickAction icon="analytics" label="Xem Analytics" href="/admin/analytics" variant="secondary" />
                    </div>
                </Card>

                {/* Charts Row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    <Card
                        title={<span className="text-white">Tin nhắn 7 ngày qua</span>}
                        className="bg-neutral-800 border-neutral-700"
                    >
                        {messageStats.length > 0 ? (
                            <Chart
                                options={messageChartOptions}
                                series={[{ name: 'Tin nhắn', data: messageStats.map(s => s.MessageCount || 0) }]}
                                type="area"
                                height={280}
                            />
                        ) : (
                            <div className="h-64 flex items-center justify-center text-neutral-500">
                                Chưa có dữ liệu
                            </div>
                        )}
                    </Card>
                    <Card
                        title={<span className="text-white">Hội thoại mới 7 ngày</span>}
                        className="bg-neutral-800 border-neutral-700"
                    >
                        {conversationStats.length > 0 ? (
                            <Chart
                                options={conversationChartOptions}
                                series={[{ name: 'Cuộc hội thoại', data: conversationStats.map(s => s.ConversationCount || 0) }]}
                                type="bar"
                                height={280}
                            />
                        ) : (
                            <div className="h-64 flex items-center justify-center text-neutral-500">
                                Chưa có dữ liệu
                            </div>
                        )}
                    </Card>
                </div>

                {/* Recent Workspaces */}
                <Card
                    title={<span className="text-white">Workspaces gần đây</span>}
                    extra={<Link href="/admin/workspaces" className="text-primary-500 hover:text-primary-400">Xem tất cả →</Link>}
                    className="bg-neutral-800 border-neutral-700"
                >
                    <Table
                        dataSource={recentWorkspaces}
                        columns={columns}
                        pagination={false}
                        className="admin-table"
                    />
                </Card>
            </div>
        </AdminLayout>
    );
};

export default AdminDashboard;
