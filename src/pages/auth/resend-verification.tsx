import { useState } from 'react';
import { useRouter } from 'next/router';
import { useResendVerification } from '@/hooks/useAuth';
import { Form, Input, Button, Card, Typography, Result } from 'antd';
import { MailOutlined, CheckCircleOutlined } from '@ant-design/icons';
import Link from 'next/link';

const { Title, Text } = Typography;

export default function ResendVerificationPage() {
    const router = useRouter();
    const { mutate: resend, isPending, isSuccess } = useResendVerification();
    const [form] = Form.useForm();

    const onFinish = (values: { email: string }) => {
        resend(values);
    };

    if (isSuccess) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
                <div className="max-w-md w-full">
                    <Result
                        icon={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
                        title="Email đã được gửi!"
                        subTitle="Vui lòng kiểm tra hộp thư của bạn và nhấn vào link xác thực."
                        extra={
                            <Button type="primary" size="large" onClick={() => router.push('/auth/login')}>
                                Về trang đăng nhập
                            </Button>
                        }
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
            <Card className="w-full max-w-md shadow-lg">
                <div className="text-center mb-6">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                        <MailOutlined style={{ fontSize: 32, color: '#1890ff' }} />
                    </div>
                    <Title level={3}>Gửi lại email xác thực</Title>
                    <Text type="secondary">
                        Nhập email của bạn để nhận link xác thực mới
                    </Text>
                </div>

                <Form
                    form={form}
                    layout="vertical"
                    onFinish={onFinish}
                    requiredMark={false}
                >
                    <Form.Item
                        name="email"
                        label="Email"
                        rules={[
                            { required: true, message: 'Vui lòng nhập email' },
                            { type: 'email', message: 'Email không hợp lệ' }
                        ]}
                    >
                        <Input
                            prefix={<MailOutlined />}
                            placeholder="email@example.com"
                            size="large"
                        />
                    </Form.Item>

                    <Form.Item>
                        <Button
                            type="primary"
                            htmlType="submit"
                            loading={isPending}
                            block
                            size="large"
                        >
                            {isPending ? 'Đang gửi...' : 'Gửi email xác thực'}
                        </Button>
                    </Form.Item>

                    <div className="text-center mt-4">
                        <Text type="secondary">
                            Đã có tài khoản?{' '}
                            <Link href="/auth/login" className="text-blue-600 hover:underline">
                                Đăng nhập
                            </Link>
                        </Text>
                    </div>
                </Form>
            </Card>
        </div>
    );
}
