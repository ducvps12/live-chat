import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Progress, Table, Tag, DatePicker, Button, Spin } from 'antd';
import { AdminLayout } from '@/components/layout/AdminLayout';
import api from '@/lib/http';
import dynamic from 'next/dynamic';
import dayjs from 'dayjs';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

interface DashboardStats {
    totalUsers: number;
    totalWorkspaces: number;
    totalConversations: number;
    totalMessages: number;
}

interface ChartData {
    Date: string;
    MessageCount?: number;
    ConversationCount?: number;
}

const AdminAnalyticsPage: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [messageStats, setMessageStats] = useState<ChartData[]>([]);
    const [conversationStats, setConversationStats] = useState<ChartData[]>([]);
    const [days, setDays] = useState(7);

    const fetchData = async (selectedDays: number) => {
        try {
            setLoading(true);
            const [statsRes, msgRes, convRes] = await Promise.all([
                api.get('/admin/dashboard'),
                api.get(`/admin/stats/messages?days=${selectedDays}`),
                api.get(`/admin/stats/conversations?days=${selectedDays}`)
            ]);
            setStats(statsRes.data);
            setMessageStats(msgRes.data || []);
            setConversationStats(convRes.data || []);
        } catch (error) {
            console.error('Failed to fetch analytics:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData(days);
    }, [days]);

    // Chart options
    const messageChartOptions: ApexCharts.ApexOptions = {
        chart: {
            type: 'area',
            toolbar: { show: true, tools: { download: true, zoom: true } },
            background: 'transparent',
        },
        theme: { mode: 'dark' },
        stroke: { curve: 'smooth', width: 3 },
        fill: {
            type: 'gradient',
            gradient: { shadeIntensity: 1, opacityFrom: 0.5, opacityTo: 0.1 }
        },
        dataLabels: { enabled: false },
        xaxis: {
            categories: messageStats.map(s => dayjs(s.Date).format('DD/MM')),
            labels: { style: { colors: '#9ca3af' } }
        },
        yaxis: { labels: { style: { colors: '#9ca3af' } } },
        grid: { borderColor: '#374151' },
        colors: ['#3b82f6', '#22c55e']
    };

    const conversationChartOptions: ApexCharts.ApexOptions = {
        chart: {
            type: 'line',
            toolbar: { show: false },
            background: 'transparent',
        },
        theme: { mode: 'dark' },
        stroke: { curve: 'smooth', width: 4 },
        markers: { size: 5 },
        dataLabels: { enabled: false },
        xaxis: {
            categories: conversationStats.map(s => dayjs(s.Date).format('DD/MM')),
            labels: { style: { colors: '#9ca3af' } }
        },
        yaxis: { labels: { style: { colors: '#9ca3af' } } },
        grid: { borderColor: '#374151' },
        colors: ['#22c55e']
    };

    if (loading && !stats) {
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
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold text-white">Analytics</h1>
                        <p className="text-neutral-400 mt-1">Thống kê và báo cáo hệ thống</p>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            type={days === 7 ? 'primary' : 'default'}
                            onClick={() => setDays(7)}
                        >
                            7 ngày
                        </Button>
                        <Button
                            type={days === 30 ? 'primary' : 'default'}
                            onClick={() => setDays(30)}
                        >
                            30 ngày
                        </Button>
                        <Button
                            type={days === 90 ? 'primary' : 'default'}
                            onClick={() => setDays(90)}
                        >
                            90 ngày
                        </Button>
                    </div>
                </div>

                {/* Overview Stats */}
                <Row gutter={16}>
                    <Col span={6}>
                        <Card className="bg-gradient-to-br from-primary-600 to-primary-800 border-0">
                            <div className="text-center">
                                <p className="text-4xl font-bold text-white">{stats?.totalWorkspaces || 0}</p>
                                <p className="text-primary-100 text-sm mt-1">Total Workspaces</p>
                            </div>
                        </Card>
                    </Col>
                    <Col span={6}>
                        <Card className="bg-gradient-to-br from-green-600 to-green-800 border-0">
                            <div className="text-center">
                                <p className="text-4xl font-bold text-white">{stats?.totalUsers || 0}</p>
                                <p className="text-green-100 text-sm mt-1">Total Users</p>
                            </div>
                        </Card>
                    </Col>
                    <Col span={6}>
                        <Card className="bg-gradient-to-br from-blue-600 to-blue-800 border-0">
                            <div className="text-center">
                                <p className="text-4xl font-bold text-white">
                                    {(stats?.totalConversations || 0).toLocaleString()}
                                </p>
                                <p className="text-blue-100 text-sm mt-1">Total Conversations</p>
                            </div>
                        </Card>
                    </Col>
                    <Col span={6}>
                        <Card className="bg-gradient-to-br from-orange-600 to-orange-800 border-0">
                            <div className="text-center">
                                <p className="text-4xl font-bold text-white">
                                    {(stats?.totalMessages || 0).toLocaleString()}
                                </p>
                                <p className="text-orange-100 text-sm mt-1">Total Messages</p>
                            </div>
                        </Card>
                    </Col>
                </Row>

                {/* Charts */}
                <Row gutter={16}>
                    <Col span={16}>
                        <Card
                            title={<span className="text-white">Messages Trend ({days} ngày)</span>}
                            className="bg-neutral-800 border-neutral-700"
                        >
                            {messageStats.length > 0 ? (
                                <Chart
                                    options={messageChartOptions}
                                    series={[{
                                        name: 'Messages',
                                        data: messageStats.map(s => s.MessageCount || 0)
                                    }]}
                                    type="area"
                                    height={300}
                                />
                            ) : (
                                <div className="h-64 flex items-center justify-center text-neutral-500">
                                    <div className="text-center">
                                        <span className="material-symbols-outlined text-5xl mb-2">trending_up</span>
                                        <p>Chưa có dữ liệu trong khoảng thời gian này</p>
                                    </div>
                                </div>
                            )}
                        </Card>
                    </Col>
                    <Col span={8}>
                        <Card title={<span className="text-white">Channel Distribution</span>} className="bg-neutral-800 border-neutral-700">
                            <div className="space-y-4">
                                <div>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-neutral-400">Website Widget</span>
                                        <span className="text-white">65%</span>
                                    </div>
                                    <Progress percent={65} strokeColor="#3b82f6" trailColor="#404040" showInfo={false} />
                                </div>
                                <div>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-neutral-400">Facebook</span>
                                        <span className="text-white">20%</span>
                                    </div>
                                    <Progress percent={20} strokeColor="#1877F2" trailColor="#404040" showInfo={false} />
                                </div>
                                <div>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-neutral-400">Zalo</span>
                                        <span className="text-white">10%</span>
                                    </div>
                                    <Progress percent={10} strokeColor="#0068FF" trailColor="#404040" showInfo={false} />
                                </div>
                                <div>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-neutral-400">Others</span>
                                        <span className="text-white">5%</span>
                                    </div>
                                    <Progress percent={5} strokeColor="#9333ea" trailColor="#404040" showInfo={false} />
                                </div>
                            </div>
                        </Card>
                    </Col>
                </Row>

                {/* Conversations Chart */}
                <Card
                    title={<span className="text-white">New Conversations ({days} ngày)</span>}
                    className="bg-neutral-800 border-neutral-700"
                >
                    {conversationStats.length > 0 ? (
                        <Chart
                            options={conversationChartOptions}
                            series={[{
                                name: 'Conversations',
                                data: conversationStats.map(s => s.ConversationCount || 0)
                            }]}
                            type="line"
                            height={250}
                        />
                    ) : (
                        <div className="h-48 flex items-center justify-center text-neutral-500">
                            Chưa có dữ liệu
                        </div>
                    )}
                </Card>

                {/* Summary */}
                <Card title={<span className="text-white">Tóm tắt {days} ngày</span>} className="bg-neutral-800 border-neutral-700">
                    <Row gutter={16}>
                        <Col span={6}>
                            <div className="text-center p-4 bg-neutral-700 rounded-lg">
                                <p className="text-2xl font-bold text-white">
                                    {messageStats.reduce((acc, s) => acc + (s.MessageCount || 0), 0).toLocaleString()}
                                </p>
                                <p className="text-neutral-400 text-sm">Messages trong {days} ngày</p>
                            </div>
                        </Col>
                        <Col span={6}>
                            <div className="text-center p-4 bg-neutral-700 rounded-lg">
                                <p className="text-2xl font-bold text-white">
                                    {conversationStats.reduce((acc, s) => acc + (s.ConversationCount || 0), 0).toLocaleString()}
                                </p>
                                <p className="text-neutral-400 text-sm">Conversations mới</p>
                            </div>
                        </Col>
                        <Col span={6}>
                            <div className="text-center p-4 bg-neutral-700 rounded-lg">
                                <p className="text-2xl font-bold text-white">
                                    {messageStats.length > 0
                                        ? Math.round(messageStats.reduce((acc, s) => acc + (s.MessageCount || 0), 0) / messageStats.length)
                                        : 0}
                                </p>
                                <p className="text-neutral-400 text-sm">Avg Messages/Day</p>
                            </div>
                        </Col>
                        <Col span={6}>
                            <div className="text-center p-4 bg-neutral-700 rounded-lg">
                                <p className="text-2xl font-bold text-white">
                                    {conversationStats.length > 0
                                        ? Math.round(conversationStats.reduce((acc, s) => acc + (s.ConversationCount || 0), 0) / conversationStats.length)
                                        : 0}
                                </p>
                                <p className="text-neutral-400 text-sm">Avg Conversations/Day</p>
                            </div>
                        </Col>
                    </Row>
                </Card>
            </div>
        </AdminLayout>
    );
};

export default AdminAnalyticsPage;
