import Head from 'next/head';
import Link from 'next/link';
import AuthLoginFeature from '../../features/auth/index';
import AuthLayout from '../../components/layout/AuthLayout';

export default function LoginPage() {
    return (
        <AuthLayout>
            <Head>
                <title>Đăng nhập | NemarkChat</title>
                <meta name="robots" content="noindex,follow" />
            </Head>

            <AuthLoginFeature />

            <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, fontSize: 14 }}>
                <Link href="/auth/forgot-password" style={{ color: 'var(--ent-text-muted)', fontWeight: 700, textDecoration: 'none' }}>
                    Quên mật khẩu?
                </Link>
                <Link href="/auth/register" style={{ color: 'var(--ent-primary)', fontWeight: 800, textDecoration: 'none' }}>
                    Tạo tài khoản mới
                </Link>
            </div>
        </AuthLayout>
    );
}
