import Head from 'next/head';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { type ReactNode } from 'react';

interface StaticPageLayoutProps {
    title: string;
    description?: string;
    children: ReactNode;
}

export default function StaticPageLayout({ title, description, children }: StaticPageLayoutProps) {
    return (
        <>
            <Head>
                <title>{title} | NemarkChat</title>
                {description && <meta name="description" content={description} />}
                <link rel="icon" href="/images/favicon.png" type="image/png" />
            </Head>

            <header className="static-page-header">
                <div className="container static-page-header-inner">
                    <Link href="/" className="static-page-brand">
                        <Image src="/images/logo.png" alt="NemarkChat" width={36} height={36} priority style={{ borderRadius: 8 }} />
                        <span style={{ fontWeight: 800, fontSize: 20, color: 'var(--color-text)' }}>
                            Nemark<span style={{ color: 'var(--color-primary)' }}>Chat</span>
                        </span>
                    </Link>
                    <div className="static-page-actions">
                        <Link href="/" className="static-page-home-link">
                            <ArrowLeft size={16} />
                            <span>Trang chủ</span>
                        </Link>
                        <Link href="/auth/login" className="btn btn-sm btn-outline static-login-link">Đăng nhập</Link>
                        <Link href="/auth/register" className="btn btn-sm btn-primary">Dùng thử</Link>
                    </div>
                </div>
            </header>

            <main className="static-page-main">
                <div className="container static-page-content">{children}</div>
            </main>

            <footer className="static-page-footer">
                <div className="container static-page-footer-inner">
                    <p style={{ color: 'var(--color-text-muted)', fontSize: 13, margin: 0 }}>
                        © 2026 NemarkChat. Mọi quyền được bảo lưu.
                    </p>
                    <div className="static-page-footer-links">
                        {[
                            { label: 'Điều khoản', href: '/terms' },
                            { label: 'Quyền riêng tư', href: '/privacy' },
                            { label: 'Bảo mật', href: '/security' },
                            { label: 'Xử lý dữ liệu', href: '/data-processing' },
                            { label: 'Xóa dữ liệu', href: '/data-deletion' },
                            { label: 'Sử dụng', href: '/acceptable-use' },
                            { label: 'Hoàn tiền', href: '/refund' },
                        ].map((item) => <Link key={item.label} href={item.href}>{item.label}</Link>)}
                    </div>
                </div>
            </footer>

            <style jsx global>{`
                .static-page-header { position: sticky; top: 0; z-index: 1000; border-bottom: 1px solid var(--color-border); background: rgba(255,255,255,.94); backdrop-filter: blur(16px); }
                .static-page-header-inner { display: flex; height: 72px; align-items: center; justify-content: space-between; gap: 20px; padding-inline: 20px; }
                .static-page-brand, .static-page-home-link { display: inline-flex; align-items: center; gap: 10px; text-decoration: none; }
                .static-page-home-link { color: var(--color-text-secondary); font-size: 14px; font-weight: 650; }
                .static-page-actions { display: flex; align-items: center; gap: 10px; }
                .static-page-main { min-height: calc(100vh - 200px); }
                .static-page-content { max-width: 1120px; padding: 56px 20px 80px; }
                .static-page-footer { border-top: 1px solid var(--color-border); padding: 24px 0; }
                .static-page-footer-inner { display: flex; align-items: center; justify-content: space-between; gap: 18px; padding-inline: 20px; }
                .static-page-footer-links { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 10px 22px; }
                .static-page-footer-links a { color: var(--color-text-muted); font-size: 13px; text-decoration: none; }
                .static-page-footer-links a:hover { color: var(--color-primary); }
                @media (max-width: 720px) {
                    .static-page-header-inner { height: 64px; padding-inline: 14px; }
                    .static-page-brand img { width: 32px !important; height: 32px !important; }
                    .static-page-brand > span { font-size: 17px !important; }
                    .static-page-home-link span, .static-login-link { display: none !important; }
                    .static-page-actions { gap: 7px; }
                    .static-page-content { padding: 34px 16px 56px; }
                    .static-page-footer-inner { align-items: flex-start; flex-direction: column; padding-inline: 16px; }
                    .static-page-footer-links { justify-content: flex-start; }
                }
            `}</style>
        </>
    );
}
