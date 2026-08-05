import React from 'react';
import Link from 'next/link';
import { Bot, CheckCircle2, LockKeyhole, MessageSquare, ShieldCheck, Smartphone } from 'lucide-react';

interface AuthLayoutProps {
    children: React.ReactNode;
}

const proofItems = [
    { icon: MessageSquare, label: 'Inbox hợp nhất', desc: 'Web chat, Facebook, Email, Zalo' },
    { icon: Bot, label: 'AI hỗ trợ agent', desc: 'Gợi ý trả lời và tự động hóa CSKH' },
    { icon: Smartphone, label: 'Zalo vận hành', desc: 'Kết nối phiên chăm sóc khách hàng' },
];

export default function AuthLayout({ children }: AuthLayoutProps) {
    return (
        <div className="auth-shell" style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: 'minmax(420px, 0.88fr) minmax(500px, 1.12fr)', background: 'var(--ent-bg)', fontFamily: 'var(--font-sans)' }}>
            <section
                className="auth-product-panel"
                style={{
                    minHeight: '100vh',
                    padding: '34px 38px',
                    display: 'flex',
                    flexDirection: 'column',
                    background: 'linear-gradient(180deg, #0f172a 0%, #111827 58%, #172033 100%)',
                    color: '#fff',
                    position: 'relative',
                    overflow: 'hidden',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <img src="/images/logo.png" alt="NemarkChat" style={{ width: 42, height: 42, borderRadius: 8, background: '#fff' }} />
                    <div>
                        <div style={{ fontSize: 20, fontWeight: 900, lineHeight: 1 }}>NemarkChat</div>
                        <div style={{ color: '#94a3b8', fontSize: 12, fontWeight: 700 }}>Omnichannel Customer Operations</div>
                    </div>
                </div>

                <div style={{ margin: 'auto 0', maxWidth: 620 }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 30, padding: '0 12px', borderRadius: 999, border: '1px solid rgba(147,197,253,0.25)', background: 'rgba(37,99,235,0.16)', color: '#bfdbfe', fontSize: 12, fontWeight: 800, marginBottom: 22 }}>
                        <ShieldCheck size={15} />
                        Một inbox cho toàn bộ đội CSKH
                    </div>

                    <h1 style={{ margin: 0, fontSize: 46, lineHeight: 1.06, fontWeight: 900, letterSpacing: '-0.035em', color: '#fff', maxWidth: 600 }}>
                        Mỗi cuộc trò chuyện đều có người phụ trách.
                    </h1>
                    <p style={{ margin: '18px 0 0', color: '#cbd5e1', fontSize: 16, lineHeight: 1.75, maxWidth: 540 }}>
                        Gom Zalo, Facebook, website và email vào một nơi. Phân phối cho đúng team,
                        theo dõi SLA và để AI xử lý phần lặp lại mà không làm mất ngữ cảnh khách hàng.
                    </p>

                    <div className="auth-proof-list" style={{ display: 'grid', gap: 12, marginTop: 34 }}>
                        {proofItems.map(({ icon: Icon, label, desc }) => (
                            <div className="auth-proof-item" key={label} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 14, borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.045)' }}>
                                <div style={{ width: 42, height: 42, borderRadius: 8, background: 'rgba(37,99,235,0.22)', display: 'grid', placeItems: 'center', color: '#93c5fd' }}>
                                    <Icon size={19} />
                                </div>
                                <div>
                                    <div style={{ fontSize: 14, fontWeight: 850 }}>{label}</div>
                                    <div style={{ color: '#94a3b8', fontSize: 13, marginTop: 2 }}>{desc}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="auth-stat-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                    {[
                        ['4+ kênh', 'trong một inbox'],
                        ['SLA live', 'ưu tiên đúng việc'],
                        ['AI + người', 'tiếp quản liền mạch'],
                    ].map(([value, label]) => (
                        <div className="auth-stat-item" key={label} style={{ padding: 14, borderRadius: 8, background: 'rgba(255,255,255,0.055)', border: '1px solid rgba(255,255,255,0.08)' }}>
                            <div style={{ fontSize: 20, fontWeight: 900 }}>{value}</div>
                            <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 2 }}>{label}</div>
                        </div>
                    ))}
                </div>
            </section>

            <section className="auth-form-panel" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#fff' }}>
                <header className="auth-header" style={{ height: 70, padding: '0 36px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Link className="auth-mobile-brand" href="/" aria-label="Về trang chủ NemarkChat">
                        <img src="/images/logo.png" alt="" />
                        <strong>NemarkChat</strong>
                    </Link>
                    <Link className="auth-back-link" href="/" style={{ color: 'var(--ent-text-muted)', textDecoration: 'none', fontSize: 14, fontWeight: 750 }}>
                        Về trang giới thiệu
                    </Link>
                    <span className="auth-security-note" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: 'var(--ent-text-muted)', fontSize: 13, fontWeight: 700 }}>
                        <LockKeyhole size={15} />
                        Phiên đăng nhập bảo mật
                    </span>
                </header>

                <main className="auth-main" style={{ flex: 1, display: 'grid', placeItems: 'center', padding: '24px 28px 48px' }}>
                    <div className="auth-content" style={{ width: '100%', maxWidth: 480 }}>
                        {children}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 20, color: 'var(--ent-text-muted)', fontSize: 12, fontWeight: 650 }}>
                            <CheckCircle2 size={14} color="#12b76a" />
                            Dành cho khách thuê workspace và đội vận hành CSKH
                        </div>
                    </div>
                </main>
            </section>

            <style jsx global>{`
                .auth-mobile-brand {
                    display: none;
                    align-items: center;
                    gap: 9px;
                    color: #0f172a;
                    text-decoration: none;
                    font-size: 15px;
                }
                .auth-mobile-brand img {
                    width: 30px;
                    height: 30px;
                    border-radius: 7px;
                }
                @media (max-width: 920px) {
                    .auth-product-panel { display: none !important; }
                    .auth-shell { grid-template-columns: minmax(0, 1fr) !important; }
                    .auth-form-panel { min-height: 100dvh !important; }
                    .auth-mobile-brand { display: inline-flex !important; }
                    .auth-back-link { display: none !important; }
                }
                @media (max-width: 560px) {
                    .auth-header { height: 60px !important; padding: 0 18px !important; }
                    .auth-security-note { display: none !important; }
                    .auth-main { place-items: start center !important; padding: 24px 16px 32px !important; }
                    .auth-content { max-width: 440px !important; }
                    .auth-content .enterprise-card { padding: 24px 20px !important; border-radius: 12px !important; }
                }
            `}</style>
        </div>
    );
}
