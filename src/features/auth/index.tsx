import { useState, useEffect, useRef, useCallback } from 'react';
import { Form, Input, Button, Alert, message, Divider } from 'antd';
import { Mail, Lock } from 'lucide-react';
import { useLogin } from '../../domains/auth/auth.hooks';
import { useRouter } from 'next/router';
import { useRecaptcha } from '../../lib/hooks/useRecaptcha';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4020/api';

export default function AuthLoginFeature() {
    const { mutateAsync: login, isPending } = useLogin();
    const router = useRouter();
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [googleLoading, setGoogleLoading] = useState(false);
    const { isEnabled: recaptchaEnabled, siteKey, loaded: recaptchaLoaded } = useRecaptcha();
    const [recaptchaToken, setRecaptchaToken] = useState('');
    const recaptchaRef = useRef<HTMLDivElement>(null);
    const recaptchaWidgetId = useRef<number | null>(null);

    // Handle Google OAuth callback token
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const googleToken = params.get('google_token');
        const error = params.get('error');

        if (googleToken) {
            localStorage.setItem('nemark_token', googleToken);
            message.success('Đăng nhập Google thành công!');
            window.history.replaceState({}, '', '/auth/login');
            router.push('/workspace');
        }

        if (error) {
            const errorMessages: Record<string, string> = {
                google_no_code: 'Google không trả về mã xác thực.',
                google_token_failed: 'Xác thực với Google thất bại.',
                google_no_email: 'Không lấy được email từ Google.',
                account_disabled: 'Tài khoản đã bị vô hiệu hoá.',
                google_internal_error: 'Lỗi hệ thống khi đăng nhập Google.',
                google_disabled: 'Đăng nhập Google hiện đang tắt.',
            };
            setErrorMsg(errorMessages[error] || 'Đăng nhập Google thất bại.');
            window.history.replaceState({}, '', '/auth/login');
        }
    }, [router]);

    // Render reCAPTCHA v2 widget
    useEffect(() => {
        if (!recaptchaEnabled || !siteKey || !recaptchaLoaded || !recaptchaRef.current) return;
        const grecaptcha = (window as any).grecaptcha;
        if (!grecaptcha) return;

        // Wait for grecaptcha to be ready
        const renderWidget = () => {
            if (recaptchaWidgetId.current !== null) return;
            try {
                recaptchaWidgetId.current = grecaptcha.render(recaptchaRef.current!, {
                    sitekey: siteKey,
                    callback: (token: string) => setRecaptchaToken(token),
                    'expired-callback': () => setRecaptchaToken(''),
                    theme: 'light',
                    size: 'normal',
                });
            } catch {
                // Widget may already be rendered
            }
        };

        if (grecaptcha.render) {
            renderWidget();
        } else {
            grecaptcha.ready(renderWidget);
        }

        return () => {
            recaptchaWidgetId.current = null;
        };
    }, [recaptchaEnabled, siteKey, recaptchaLoaded]);

    const onFinish = async (values: any) => {
        try {
            setErrorMsg(null);

            // If reCAPTCHA is enabled but no token, show error
            if (recaptchaEnabled && !recaptchaToken) {
                setErrorMsg('Vui lòng xác nhận reCAPTCHA.');
                return;
            }

            const res = await login({
                ...values,
                recaptchaToken: recaptchaEnabled ? recaptchaToken : undefined,
            });
            if (res.success) {
                message.success('Đăng nhập thành công');
                router.push('/workspace');
            }
        } catch (err: any) {
            const serverMsg = err.response?.data?.error?.message || 'Có lỗi xảy ra, vui lòng thử lại.';
            setErrorMsg(serverMsg);
            // Reset reCAPTCHA on error
            if (recaptchaEnabled && (window as any).grecaptcha) {
                try { (window as any).grecaptcha.reset(recaptchaWidgetId.current); } catch {}
                setRecaptchaToken('');
            }
        }
    };

    const handleGoogleLogin = () => {
        setGoogleLoading(true);
        window.location.href = `${API_URL}/auth/google`;
    };

    return (
        <div style={{ width: '100%', maxWidth: 400, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
                <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
                    Chào mừng trở lại
                </h1>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: 15 }}>
                    Đăng nhập để tiếp tục với NemarkChat
                </p>
            </div>

            {errorMsg && (
                <Alert
                    message={errorMsg}
                    type="error"
                    showIcon
                    style={{ marginBottom: 24, borderRadius: 'var(--radius-md)' }}
                />
            )}

            {/* Google Login Button */}
            <Button
                id="google-login-btn"
                block
                size="large"
                loading={googleLoading}
                onClick={handleGoogleLogin}
                style={{
                    height: 48,
                    borderRadius: 'var(--radius-full)',
                    border: '1.5px solid #dadce0',
                    background: '#fff',
                    color: '#3c4043',
                    fontWeight: 600,
                    fontSize: 15,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                    transition: 'all 0.2s ease',
                    cursor: 'pointer',
                    marginBottom: 0,
                }}
                onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(66,133,244,0.2)';
                    (e.currentTarget as HTMLElement).style.borderColor = '#4285f4';
                }}
                onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)';
                    (e.currentTarget as HTMLElement).style.borderColor = '#dadce0';
                }}
            >
                <svg width="20" height="20" viewBox="0 0 48 48" style={{ flexShrink: 0 }}>
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                    <path fill="none" d="M0 0h48v48H0z" />
                </svg>
                Đăng nhập với Google
            </Button>

            <Divider style={{ margin: '20px 0', color: '#999', fontSize: 13 }}>
                hoặc đăng nhập bằng email
            </Divider>

            <Form
                name="auth-login"
                layout="vertical"
                onFinish={onFinish}
                requiredMark={false}
                size="large"
            >
                <Form.Item
                    label="Email"
                    name="email"
                    rules={[
                        { required: true, message: 'Vui lòng nhập email!' },
                        { type: 'email', message: 'Email không đúng định dạng!' }
                    ]}
                >
                    <Input
                        prefix={<Mail size={16} color="var(--color-text-muted)" />}
                        placeholder="admin@nemark.io"
                        style={{ borderRadius: 'var(--radius-md)' }}
                    />
                </Form.Item>

                <Form.Item
                    label="Mật khẩu"
                    name="password"
                    rules={[{ required: true, message: 'Vui lòng nhập mật khẩu!' }]}
                >
                    <Input.Password
                        prefix={<Lock size={16} color="var(--color-text-muted)" />}
                        placeholder="••••••••"
                        style={{ borderRadius: 'var(--radius-md)' }}
                    />
                </Form.Item>

                {/* reCAPTCHA v2 widget */}
                {recaptchaEnabled && siteKey && (
                    <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'center' }}>
                        <div ref={recaptchaRef} />
                    </div>
                )}

                <Form.Item style={{ marginTop: 32 }}>
                    <Button
                        type="primary"
                        htmlType="submit"
                        block
                        loading={isPending}
                        style={{
                            height: 48,
                            borderRadius: 'var(--radius-full)',
                            background: 'var(--gradient-hero)',
                            border: 'none',
                            fontWeight: 600,
                            fontSize: 15,
                            boxShadow: '0 4px 16px rgba(99, 102, 241, 0.3)'
                        }}
                    >
                        Đăng nhập
                    </Button>
                </Form.Item>
            </Form>

            {/* reCAPTCHA notice */}
            {recaptchaEnabled && (
                <div style={{ textAlign: 'center', marginTop: 8 }}>
                    <p style={{ fontSize: 11, color: '#aaa', lineHeight: 1.5 }}>
                        Được bảo vệ bởi reCAPTCHA.{' '}
                        <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" style={{ color: '#aaa', textDecoration: 'underline' }}>
                            Chính sách
                        </a>{' '}
                        &{' '}
                        <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer" style={{ color: '#aaa', textDecoration: 'underline' }}>
                            Điều khoản
                        </a>
                    </p>
                </div>
            )}
        </div>
    );
}
