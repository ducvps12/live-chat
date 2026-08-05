import Head from 'next/head';
import Link from 'next/link';
import AuthLayout from '../../components/layout/AuthLayout';
import { Form, Input, Button, Alert, message, Divider } from 'antd';
import { ArrowRight, Lock, Mail, User } from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/router';
import { httpClient } from '../../lib/http/client';
import { useRecaptcha } from '../../lib/hooks/useRecaptcha';
import { resolveApiBaseUrl } from '../../lib/http/api-base';

const API_URL = resolveApiBaseUrl();

export default function RegisterPage() {
    const router = useRouter();
    const [isPending, setIsPending] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [googleLoading, setGoogleLoading] = useState(false);
    const { executeRecaptcha } = useRecaptcha();

    const onFinish = async (values: any) => {
        try {
            setIsPending(true);
            setErrorMsg(null);

            // Get reCAPTCHA token
            const recaptchaToken = await executeRecaptcha('register');

            const res = await httpClient.post('/auth/register', {
                email: values.email,
                password: values.password,
                name: values.name,
                recaptchaToken,
            });

            if (res.data.success) {
                message.success('Đăng ký thành công! Vui lòng đăng nhập.');
                const invite = typeof router.query.invite === 'string' ? router.query.invite : '';
                const email = typeof router.query.email === 'string' ? router.query.email : values.email;
                router.push(invite ? `/auth/login?invite=${encodeURIComponent(invite)}&email=${encodeURIComponent(email)}` : '/auth/login');
            }
        } catch (err: any) {
            setErrorMsg(err.response?.data?.error?.message || 'Có lỗi xảy ra, vui lòng thử lại.');
        } finally {
            setIsPending(false);
        }
    };

    const handleGoogleLogin = () => {
        setGoogleLoading(true);
        const apiBase = typeof window !== 'undefined' ? `${window.location.origin}/api` : '/api';
        window.location.href = `${apiBase}/auth/google`;
    };

    return (
        <AuthLayout>
            <Head>
                <title>Đăng ký | NemarkChat</title>
                <meta name="robots" content="noindex,follow" />
            </Head>

            <div className="enterprise-card auth-card" style={{ width: '100%', padding: '34px 36px' }}>
                <div style={{ marginBottom: 26 }}>
                    <span className="enterprise-kicker">Tạo workspace miễn phí</span>
                    <h1 style={{ margin: '14px 0 8px', color: 'var(--ent-text)', fontSize: 28, lineHeight: 1.2, fontWeight: 900, letterSpacing: 0 }}>
                        Bắt đầu cùng NemarkChat
                    </h1>
                    <p style={{ margin: 0, color: 'var(--ent-text-muted)', fontSize: 14, lineHeight: 1.65 }}>
                        Tạo tài khoản quản trị, sau đó mời đội ngũ và kết nối kênh khi bạn sẵn sàng.
                    </p>
                </div>

                {errorMsg && (
                    <Alert
                        message={errorMsg}
                        type="error"
                        showIcon
                        style={{ marginBottom: 20, borderRadius: 8 }}
                    />
                )}

                <Button
                    id="google-register-btn"
                    block
                    size="large"
                    loading={googleLoading}
                    onClick={handleGoogleLogin}
                    style={{
                        height: 46,
                        borderRadius: 10,
                        border: '1px solid var(--ent-border)',
                        background: '#fff',
                        color: 'var(--ent-text)',
                        fontWeight: 750,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 10,
                    }}
                >
                    <svg width="18" height="18" viewBox="0 0 48 48" style={{ flexShrink: 0 }}>
                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.66 0 6.6 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.28-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.6 42.62 14.66 48 24 48z" />
                    </svg>
                    Tiếp tục với Google
                </Button>

                <Divider style={{ margin: '20px 0', color: 'var(--ent-text-muted)', fontSize: 13 }}>
                    hoặc đăng ký bằng email
                </Divider>

                <Form
                    layout="vertical"
                    onFinish={onFinish}
                    requiredMark={false}
                    style={{ width: '100%' }}
                    initialValues={{ email: typeof router.query.email === 'string' ? router.query.email : undefined }}
                >
                    <Form.Item
                        name="name"
                        rules={[{ required: true, message: 'Vui lòng nhập họ và tên' }]}
                    >
                        <Input
                            size="large"
                            prefix={<User size={16} style={{ color: 'var(--ent-text-muted)', marginRight: 6 }} />}
                            placeholder="Họ và tên"
                            style={{ height: 44, borderRadius: 8 }}
                        />
                    </Form.Item>

                    <Form.Item
                        name="email"
                        rules={[
                            { required: true, message: 'Vui lòng nhập email' },
                            { type: 'email', message: 'Email không hợp lệ' }
                        ]}
                    >
                        <Input
                            size="large"
                            prefix={<Mail size={16} style={{ color: 'var(--ent-text-muted)', marginRight: 6 }} />}
                            placeholder="Email"
                            style={{ height: 44, borderRadius: 8 }}
                        />
                    </Form.Item>

                    <Form.Item
                        name="password"
                        rules={[
                            { required: true, message: 'Vui lòng nhập mật khẩu' },
                            { min: 6, message: 'Mật khẩu phải từ 6 ký tự trở lên' }
                        ]}
                    >
                        <Input.Password
                            size="large"
                            prefix={<Lock size={16} style={{ color: 'var(--ent-text-muted)', marginRight: 6 }} />}
                            placeholder="Mật khẩu"
                            style={{ height: 44, borderRadius: 8 }}
                        />
                    </Form.Item>

                    <Form.Item style={{ marginBottom: 0, marginTop: 10 }}>
                        <Button
                            type="primary"
                            htmlType="submit"
                            block
                            size="large"
                            loading={isPending}
                            style={{
                                height: 46,
                                borderRadius: 10,
                                background: 'var(--ent-primary)',
                                fontWeight: 800,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 8,
                            }}
                        >
                            Tạo tài khoản <ArrowRight size={16} />
                        </Button>
                    </Form.Item>
                </Form>

                <div style={{ marginTop: 22, textAlign: 'center', fontSize: 14 }}>
                    <span style={{ color: 'var(--ent-text-muted)' }}>Đã có tài khoản? </span>
                    <Link href="/auth/login" style={{ color: 'var(--ent-primary)', fontWeight: 800, textDecoration: 'none' }}>
                        Đăng nhập
                    </Link>
                </div>
            </div>
        </AuthLayout>
    );
}
