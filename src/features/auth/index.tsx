import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Divider, Form, Input, message } from 'antd';
import { ArrowRight, Lock, Mail } from 'lucide-react';
import { useRouter } from 'next/router';
import { useLogin } from '../../domains/auth/auth.hooks';
import { useRecaptcha } from '../../lib/hooks/useRecaptcha';
import { resolveApiBaseUrl } from '../../lib/http/api-base';
import { httpClient } from '../../lib/http/client';

const API_URL = resolveApiBaseUrl();

export default function AuthLoginFeature() {
    const router = useRouter();
    const { mutateAsync: login, isPending } = useLogin();
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [googleLoading, setGoogleLoading] = useState(false);
    const { isEnabled: recaptchaEnabled, siteKey, loaded: recaptchaLoaded } = useRecaptcha();
    const [recaptchaToken, setRecaptchaToken] = useState('');
    const recaptchaRef = useRef<HTMLDivElement>(null);
    const recaptchaWidgetId = useRef<number | null>(null);

    const acceptInviteIfNeeded = async (token?: string | null) => {
        if (!token) return '';
        try {
            const res = await httpClient.post(`/workspaces/invitations/${token}/accept`);
            const workspaceId = res.data?.data?.workspaceId;
            if (workspaceId) {
                localStorage.removeItem('nemark_pending_invite');
                message.success('Đã tham gia workspace theo lời mời');
                return `/workspace/${workspaceId}`;
            }
        } catch (error: any) {
            setErrorMsg(error.response?.data?.error?.message || 'Không thể nhận lời mời workspace.');
        }
        return '';
    };

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const googleToken = params.get('google_token');
        const error = params.get('error');
        const invite = params.get('invite');
        if (invite) localStorage.setItem('nemark_pending_invite', invite);

        if (googleToken) {
            localStorage.setItem('nemark_token', googleToken);
            (async () => {
                const invitePath = await acceptInviteIfNeeded(localStorage.getItem('nemark_pending_invite'));
                window.location.href = invitePath || '/workspace';
            })();
            return;
        }

        if (error) {
            const errorMessages: Record<string, string> = {
                google_no_code: 'Google không trả về mã xác thực.',
                google_token_failed: 'Xác thực với Google thất bại.',
                google_no_email: 'Không lấy được email từ Google.',
                account_disabled: 'Tài khoản đã bị vô hiệu hóa.',
                google_internal_error: 'Lỗi hệ thống khi đăng nhập Google.',
                google_disabled: 'Đăng nhập Google hiện đang tắt.',
            };
            setErrorMsg(errorMessages[error] || 'Đăng nhập Google thất bại.');
            window.history.replaceState({}, '', '/auth/login');
            return;
        }

        // If user is already logged in (has nemark_token), redirect to workspace
        const storedToken = localStorage.getItem('nemark_token');
        if (storedToken) {
            (async () => {
                const invitePath = await acceptInviteIfNeeded(invite);
                window.location.href = invitePath || '/workspace';
            })();
        }
    }, [router]);

    useEffect(() => {
        if (!recaptchaEnabled || !siteKey || !recaptchaLoaded || !recaptchaRef.current) return;
        const grecaptcha = (window as any).grecaptcha;
        if (!grecaptcha) return;

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
                // reCAPTCHA can throw if the widget was already mounted during hot reload.
            }
        };

        if (grecaptcha.render) renderWidget();
        else grecaptcha.ready(renderWidget);

        return () => {
            recaptchaWidgetId.current = null;
        };
    }, [recaptchaEnabled, siteKey, recaptchaLoaded]);

    const onFinish = async (values: any) => {
        try {
            setErrorMsg(null);

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
                const inviteToken = typeof router.query.invite === 'string' ? router.query.invite : localStorage.getItem('nemark_pending_invite');
                const invitePath = await acceptInviteIfNeeded(inviteToken);
                if (invitePath) {
                    router.push(invitePath);
                    return;
                }
                const requestedPath = typeof router.query.next === 'string' ? router.query.next : '';
                const safePath = requestedPath.startsWith('/') && !requestedPath.startsWith('//')
                    ? requestedPath
                    : '/workspace';
                router.push(safePath);
            }
        } catch (err: any) {
            setErrorMsg(err.response?.data?.error?.message || 'Không thể đăng nhập. Vui lòng kiểm tra lại thông tin hoặc kết nối máy chủ.');
            if (recaptchaEnabled && (window as any).grecaptcha) {
                try {
                    (window as any).grecaptcha.reset(recaptchaWidgetId.current);
                } catch {}
                setRecaptchaToken('');
            }
        }
    };

    const handleGoogleLogin = () => {
        setGoogleLoading(true);
        const apiBase = typeof window !== 'undefined' ? `${window.location.origin}/api` : '/api';
        window.location.href = `${apiBase}/auth/google`;
    };

    return (
        <div className="enterprise-card auth-card" style={{ padding: '34px 36px' }}>
            <div style={{ marginBottom: 26 }}>
                <span className="enterprise-kicker">Đăng nhập workspace</span>
                <h1 style={{ margin: '14px 0 8px', color: 'var(--ent-text)', fontSize: 28, lineHeight: 1.2, fontWeight: 900, letterSpacing: 0 }}>
                    Chào mừng bạn trở lại
                </h1>
                <p style={{ margin: 0, color: 'var(--ent-text-muted)', fontSize: 14, lineHeight: 1.65 }}>
                    Đăng nhập để tiếp tục xử lý hội thoại và theo dõi hoạt động của đội ngũ.
                </p>
            </div>

            {errorMsg && (
                <Alert
                    title="Đăng nhập chưa thành công"
                    message={errorMsg}
                    type="error"
                    showIcon
                    style={{ marginBottom: 20, borderRadius: 8 }}
                />
            )}

            <Button
                id="google-login-btn"
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
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                </svg>
                Tiếp tục với Google
            </Button>

            <Divider style={{ margin: '18px 0', color: 'var(--ent-text-muted)', fontSize: 12 }}>
                hoặc đăng nhập bằng email
            </Divider>

            <Form
                name="auth-login"
                layout="vertical"
                onFinish={onFinish}
                requiredMark={false}
                size="large"
                initialValues={{ email: typeof router.query.email === 'string' ? router.query.email : undefined }}
            >
                <Form.Item
                    label={<span style={{ fontSize: 13, fontWeight: 750, color: 'var(--ent-text)' }}>Email</span>}
                    name="email"
                    rules={[
                        { required: true, message: 'Vui lòng nhập email.' },
                        { type: 'email', message: 'Email không đúng định dạng.' },
                    ]}
                >
                    <Input
                        prefix={<Mail size={16} color="var(--ent-text-muted)" />}
                        placeholder="admin@company.vn"
                        autoComplete="email"
                        autoFocus
                        style={{ height: 48, borderRadius: 10 }}
                    />
                </Form.Item>

                <Form.Item
                    label={<span style={{ fontSize: 13, fontWeight: 750, color: 'var(--ent-text)' }}>Mật khẩu</span>}
                    name="password"
                    rules={[{ required: true, message: 'Vui lòng nhập mật khẩu.' }]}
                >
                    <Input.Password
                        prefix={<Lock size={16} color="var(--ent-text-muted)" />}
                        placeholder="Nhập mật khẩu"
                        autoComplete="current-password"
                        style={{ height: 48, borderRadius: 10 }}
                    />
                </Form.Item>

                {recaptchaEnabled && siteKey && (
                    <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'center' }}>
                        <div ref={recaptchaRef} />
                    </div>
                )}

                <Form.Item style={{ marginTop: 24, marginBottom: 0 }}>
                    <Button
                        type="primary"
                        htmlType="submit"
                        block
                        loading={isPending}
                        style={{
                            height: 48,
                            borderRadius: 10,
                            background: 'var(--ent-primary)',
                            border: 'none',
                            fontWeight: 850,
                            boxShadow: '0 8px 18px rgba(37,99,235,0.18)',
                        }}
                    >
                        Đăng nhập
                        <ArrowRight size={16} />
                    </Button>
                </Form.Item>
            </Form>

            {recaptchaEnabled && (
                <p style={{ margin: '14px 0 0', textAlign: 'center', fontSize: 11, color: 'var(--ent-text-muted)', lineHeight: 1.55 }}>
                    Được bảo vệ bởi reCAPTCHA. Xem chính sách của Google để biết thêm chi tiết.
                </p>
            )}
        </div>
    );
}
