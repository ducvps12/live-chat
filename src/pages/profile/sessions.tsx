import { useRouter } from 'next/router';
import { useSessions, useRevokeSession, useLogoutAll } from '@/hooks/useAuth';
import { Card, Typography, Table, Button, Tag, Popconfirm, Space, Spin } from 'antd';
import { DeleteOutlined, LoadingOutlined, LogoutOutlined, DesktopOutlined } from '@ant-design/icons';
import { format } from 'date-fns';

const { Title, Text } = Typography;

export default function SessionsPage() {
    const router = useRouter();
    const { data: sessions, isLoading } = useSessions();
    const { mutate: revokeSession } = useRevokeSession();
    const { mutate: logoutAll } = useLogoutAll();

    const columns = [
        {
            title: 'Thiết bị',
            dataIndex: 'UserAgent',
            key: 'device',
            render: (userAgent: string) => (
                <Space>
                    <DesktopOutlined />
                    <div>
                        <div className="font-medium">{parseUserAgent(userAgent).browser}</div>
                        <Text type="secondary" className="text-xs">{parseUserAgent(userAgent).os}</Text>
                    </div>
                </Space>
            ),
        },
        {
            title: 'Địa chỉ IP',
            dataIndex: 'CreatedByIp',
            key: 'ip',
            render: (ip: string) => <Text code>{ip || 'N/A'}</Text>,
        },
        {
            title: 'Đăng nhập lúc',
            dataIndex: 'CreatedAt',
            key: 'createdAt',
            render: (date: string) => format(new Date(date), 'dd/MM/yyyy HH:mm'),
        },
        {
            title: 'Hết hạn',
            dataIndex: 'ExpiresAt',
            key: 'expiresAt',
            render: (date: string) => {
                const isExpired = new Date(date) < new Date();
                return (
                    <Tag color={isExpired ? 'red' : 'green'}>
                        {isExpired ? 'Đã hết hạn' : format(new Date(date), 'dd/MM/yyyy')}
                    </Tag>
                );
            },
        },
        {
            title: 'Hành động',
            key: 'action',
            render: (_: any, record: any) => (
                <Popconfirm
                    title="Thu hồi phiên?"
                    description="Bạn có chắc muốn thu hồi phiên này?"
                    onConfirm={() => revokeSession(record.RefreshTokenKey)}
                    okText="Có"
                    cancelText="Không"
                >
                    <Button danger type="text" size="small" icon={<DeleteOutlined />}>
                        Thu hồi
                    </Button>
                </Popconfirm>
            ),
        },
    ];

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Spin indicator={<LoadingOutlined style={{ fontSize: 48 }} spin />} />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 py-8 px-4">
            <div className="max-w-6xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <Title level={2} className="mb-2">Quản lý phiên đăng nhập</Title>
                        <Text type="secondary">
                            Xem và quản lý tất cả các phiên đăng nhập của bạn
                        </Text>
                    </div>
                    <Popconfirm
                        title="Đăng xuất tất cả?"
                        description="Bạn sẽ bị đăng xuất khỏi tất cả thiết bị. Bạn có chắc không?"
                        onConfirm={() => logoutAll()}
                        okText="Có"
                        cancelText="Không"
                    >
                        <Button danger icon={<LogoutOutlined />}>
                            Đăng xuất tất cả
                        </Button>
                    </Popconfirm>
                </div>

                <Card>
                    <Table
                        columns={columns}
                        dataSource={sessions || []}
                        rowKey="RefreshTokenKey"
                        pagination={{ pageSize: 10 }}
                        locale={{
                            emptyText: 'Không có phiên đăng nhập nào',
                        }}
                    />
                </Card>

                <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <Title level={5} className="text-blue-900 mb-2">💡 Mẹo bảo mật</Title>
                    <ul className="text-sm text-blue-800 space-y-1 ml-5">
                        <li>Thu hồi ngay lập tức các phiên đăng nhập từ thiết bị lạ</li>
                        <li>Sử dụng "Đăng xuất tất cả" nếu nghi ngờ tài khoản bị xâm nhập</li>
                        <li>Thường xuyên kiểm tra danh sách phiên đăng nhập</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}

// Helper function to parse user agent
function parseUserAgent(ua: string = '') {
    const browser = ua.match(/(Chrome|Firefox|Safari|Edge|Opera)\/[\d.]+/i)?.[1] || 'Unknown';
    const os = ua.match(/(Windows|Mac|Linux|Android|iOS)/i)?.[1] || 'Unknown';
    return { browser, os };
}
