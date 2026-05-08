import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { Modal, Form, Input, message, Spin } from 'antd';
import {
    Plus,
    Settings,
    Users,
    ExternalLink,
    Globe,
    ArrowRight,
    Sparkles,
    MessageSquare,
    Crown,
    LayoutDashboard,
    Zap,
    ChevronRight,
} from 'lucide-react';
import { useGetMe } from '../../domains/auth/auth.hooks';
import { useMyWorkspaces, useCreateWorkspace } from '../../domains/workspace/workspace.hooks';
import AppLayout from '../../components/layout/AppLayout';
import { httpClient } from '../../lib/http/client';

/* ─── Helpers ─── */
function maskEmail(email: string): string {
    if (!email || !email.includes('@')) return email || '';
    const [local, domain] = email.split('@');
    const visible = local.slice(0, Math.min(4, local.length));
    return `${visible}***@${domain}`;
}

/* ─── Google/Apple-Inspired Minimal Color System ─── */
const ACCENT_COLORS = [
    { accent: '#1a73e8', soft: '#e8f0fe', glow: 'rgba(26,115,232,0.08)' },
    { accent: '#34a853', soft: '#e6f4ea', glow: 'rgba(52,168,83,0.08)' },
    { accent: '#ea4335', soft: '#fce8e6', glow: 'rgba(234,67,53,0.08)' },
    { accent: '#fbbc04', soft: '#fef7e0', glow: 'rgba(251,188,4,0.08)' },
    { accent: '#9334e6', soft: '#f3e8fd', glow: 'rgba(147,52,230,0.08)' },
    { accent: '#00acc1', soft: '#e0f7fa', glow: 'rgba(0,172,193,0.08)' },
];

const PLAN_CONFIG: Record<string, { label: string; color: string; bg: string; icon: boolean }> = {
    free:     { label: 'Free',     color: '#5f6368', bg: '#f1f3f4', icon: false },
    pro:      { label: 'Pro',      color: '#1a73e8', bg: '#e8f0fe', icon: true },
    business: { label: 'Business', color: '#e37400', bg: '#fef7e0', icon: true },
};

export default function WorkspacePage() {
    const router = useRouter();
    const [ready, setReady] = useState(false);
    const [showCreate, setShowCreate] = useState(false);
    const [form] = Form.useForm();
    const [hoveredCard, setHoveredCard] = useState<string | null>(null);
    const [showUpgrade, setShowUpgrade] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState<'pro' | 'business'>('pro');
    const [selDur, setSelDur] = useState(1);
    const [bankInfo, setBankInfo] = useState<{ number: string; holder: string; bank: string } | null>(null);

    useEffect(() => {
        const stored = localStorage.getItem('nemark_token');
        setReady(true);
        if (!stored) router.replace('/auth/login');
    }, [router]);

    // Fetch ACB payment config for subscription payment modal
    useEffect(() => {
        httpClient.get('/admin/payment-config').then(r => {
            if (r.data?.data) setBankInfo(r.data.data);
        }).catch(() => { /* fallback to defaults */ });
    }, []);

    const { data: meData, isLoading: meLoading, isError: meError } = useGetMe(ready);
    const user = meData?.data?.user;
    const { data: wsData, isLoading: wsLoading } = useMyWorkspaces();
    const { mutateAsync: createWs, isPending: creating } = useCreateWorkspace();

    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const name = e.target.value;
        const slug = name
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim();
        form.setFieldValue('slug', slug);
    };

    const handleCreate = async (values: any) => {
        try {
            const res = await createWs(values);
            if (res.success) {
                message.success('Workspace đã được tạo thành công');
                setShowCreate(false);
                form.resetFields();
            }
        } catch (err: unknown) {
            const error = err as { response?: { data?: { error?: { message?: string } } } };
            message.error(error.response?.data?.error?.message || 'Có lỗi xảy ra');
        }
    };

    if (!ready || meLoading) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8f9fa' }}>
                <Spin size="large" />
            </div>
        );
    }

    if (meError || !meData?.data?.user) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8f9fa' }}>
                <div style={{
                    padding: '48px 40px', textAlign: 'center', maxWidth: 400,
                    background: '#fff', borderRadius: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                }}>
                    <h2 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 8px', color: '#202124' }}>Phiên đăng nhập hết hạn</h2>
                    <p style={{ color: '#5f6368', marginBottom: 24, fontSize: 14 }}>Vui lòng đăng nhập lại để tiếp tục.</p>
                    <a href="/auth/login" style={{
                        display: 'inline-flex', alignItems: 'center', height: 40, padding: '0 24px',
                        background: '#1a73e8', color: '#fff', borderRadius: 20, fontWeight: 500, fontSize: 14,
                        textDecoration: 'none',
                    }}>Đăng nhập</a>
                </div>
            </div>
        );
    }

    const workspaces = wsData?.data || [];

    return (
        <AppLayout headerTitle="Workspace">
            <Head><title>Workspace | NemarkChat</title></Head>

            <main style={{ maxWidth: 960, margin: '0 auto', padding: '40px 32px 80px' }}>
                {/* ─── Page Header ─── */}
                <div style={{
                    display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
                    marginBottom: 40, gap: 16,
                }}>
                    <div>
                        <h1 style={{
                            fontSize: 24, fontWeight: 600, margin: '0 0 4px',
                            color: '#202124', letterSpacing: '-0.01em',
                            fontFamily: "'Google Sans', 'SF Pro Display', -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
                        }}>
                            Workspace
                        </h1>
                        <p style={{
                            color: '#5f6368', fontSize: 14, margin: 0, lineHeight: 1.5,
                        }}>
                            Quản lý các workspace và cấu hình live-chat cho từng dự án
                        </p>
                    </div>

                    <button
                        onClick={() => setShowCreate(true)}
                        style={{
                            height: 36,
                            borderRadius: 18,
                            background: '#1a73e8',
                            border: 'none',
                            color: '#fff',
                            fontWeight: 500,
                            fontSize: 14,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '0 20px 0 16px',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.1), 0 1px 3px rgba(0,0,0,0.08)',
                            flexShrink: 0,
                        }}
                        onMouseEnter={e => {
                            e.currentTarget.style.background = '#1765cc';
                            e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.15), 0 4px 8px rgba(26,115,232,0.2)';
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.background = '#1a73e8';
                            e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.1), 0 1px 3px rgba(0,0,0,0.08)';
                        }}
                    >
                        <Plus size={18} strokeWidth={2} />
                        Tạo mới
                    </button>
                </div>

                {/* ─── Content ─── */}
                {wsLoading ? (
                    <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>
                ) : workspaces.length === 0 ? (
                    /* Empty State — Apple-style centered card */
                    <div style={{
                        padding: '80px 40px', textAlign: 'center',
                        background: '#fff', borderRadius: 16,
                        border: '1px solid #e0e0e0',
                    }}>
                        <div style={{
                            width: 64, height: 64, borderRadius: 16,
                            background: '#e8f0fe', display: 'flex',
                            alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto 20px',
                        }}>
                            <LayoutDashboard size={28} color="#1a73e8" strokeWidth={1.5} />
                        </div>
                        <h3 style={{
                            fontSize: 18, fontWeight: 600, margin: '0 0 8px', color: '#202124',
                        }}>Chưa có workspace nào</h3>
                        <p style={{
                            color: '#5f6368', fontSize: 14, margin: '0 0 28px', maxWidth: 340,
                            marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.5,
                        }}>
                            Tạo workspace đầu tiên để bắt đầu quản lý hỗ trợ khách hàng.
                        </p>
                        <button
                            onClick={() => setShowCreate(true)}
                            style={{
                                height: 40, borderRadius: 20,
                                background: '#1a73e8', border: 'none', color: '#fff',
                                fontWeight: 500, fontSize: 14, padding: '0 28px',
                                cursor: 'pointer',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                            }}
                        >
                            <Plus size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                            Tạo workspace
                        </button>
                    </div>
                ) : (
                    /* Workspace Cards */
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {workspaces.map((ws: any, idx: number) => {
                            const palette = ACCENT_COLORS[idx % ACCENT_COLORS.length];
                            const planKey = ((ws.plan as string) || 'free').toLowerCase();
                            const plan = PLAN_CONFIG[planKey] || PLAN_CONFIG.free;
                            const members = (ws.members as unknown[]) || [];
                            const settings = (ws.settings as Record<string, string>) || {};
                            const isHovered = hoveredCard === ws.id;

                            return (
                                <div
                                    key={ws.id as string}
                                    onClick={() => router.push(`/workspace/${ws.id}`)}
                                    onMouseEnter={() => setHoveredCard(ws.id)}
                                    onMouseLeave={() => setHoveredCard(null)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 20,
                                        padding: '20px 24px',
                                        background: isHovered ? '#f8f9fa' : '#fff',
                                        borderRadius: 12,
                                        border: '1px solid #e0e0e0',
                                        cursor: 'pointer',
                                        transition: 'all 0.15s ease',
                                        boxShadow: isHovered
                                            ? '0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04)'
                                            : '0 1px 2px rgba(0,0,0,0.04)',
                                    }}
                                >
                                    {/* Avatar */}
                                    <div style={{
                                        width: 48, height: 48, borderRadius: 12,
                                        background: palette.soft,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: palette.accent, fontWeight: 600, fontSize: 20,
                                        flexShrink: 0,
                                        transition: 'transform 0.15s ease',
                                        transform: isHovered ? 'scale(1.05)' : 'scale(1)',
                                    }}>
                                        {(ws.name as string).charAt(0).toUpperCase()}
                                    </div>

                                    {/* Info */}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                                            <h3 style={{
                                                fontSize: 15, fontWeight: 600, margin: 0,
                                                color: '#202124', lineHeight: 1.3,
                                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                            }}>
                                                {ws.name as string}
                                            </h3>
                                            <span style={{
                                                padding: '2px 8px', borderRadius: 4,
                                                background: plan.bg, color: plan.color,
                                                fontSize: 11, fontWeight: 600,
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.02em',
                                                display: 'inline-flex', alignItems: 'center', gap: 3,
                                                flexShrink: 0,
                                            }}>
                                                {plan.icon && <Crown size={10} />}
                                                {plan.label}
                                            </span>
                                        </div>
                                        <div style={{
                                            display: 'flex', alignItems: 'center', gap: 16,
                                            fontSize: 13, color: '#5f6368',
                                        }}>
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                                <Users size={13} color="#9aa0a6" />
                                                {members.length} thành viên
                                            </span>
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                                <Globe size={13} color="#9aa0a6" />
                                                {settings.language || 'vi'}
                                            </span>
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                                <span style={{
                                                    width: 6, height: 6, borderRadius: '50%',
                                                    background: '#34a853', flexShrink: 0,
                                                }} />
                                                Đang hoạt động
                                            </span>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div style={{
                                        display: 'flex', alignItems: 'center', gap: 4,
                                        opacity: isHovered ? 1 : 0,
                                        transition: 'opacity 0.15s ease',
                                    }}>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); router.push(`/workspace/${ws.id}/teams`); }}
                                            title="Nhân sự"
                                            style={{
                                                width: 36, height: 36, borderRadius: 18,
                                                background: 'transparent', border: 'none',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                cursor: 'pointer', color: '#5f6368',
                                                transition: 'background 0.15s',
                                            }}
                                            onMouseEnter={e => e.currentTarget.style.background = '#e8eaed'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                        >
                                            <Users size={18} />
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); router.push(`/workspace/${ws.id}/settings`); }}
                                            title="Cài đặt"
                                            style={{
                                                width: 36, height: 36, borderRadius: 18,
                                                background: 'transparent', border: 'none',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                cursor: 'pointer', color: '#5f6368',
                                                transition: 'background 0.15s',
                                            }}
                                            onMouseEnter={e => e.currentTarget.style.background = '#e8eaed'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                        >
                                            <Settings size={18} />
                                        </button>
                                        <ChevronRight size={20} color="#9aa0a6" style={{ marginLeft: 4 }} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
                {/* ─── Pricing Plans ─── */}
                <div style={{ marginTop: 56 }}>
                    <div style={{ textAlign: 'center', marginBottom: 32 }}>
                        <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 8px', color: '#202124' }}>Chọn gói phù hợp</h2>
                        <p style={{ color: '#5f6368', fontSize: 14, margin: 0 }}>Nâng cấp để mở khóa tính năng nâng cao cho doanh nghiệp</p>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                        {/* Free */}
                        <div style={{ padding: '28px 24px', background: '#fff', borderRadius: 16, border: '1px solid #e0e0e0', position: 'relative' }}>
                            <p style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, color: '#5f6368', margin: '0 0 4px' }}>Free</p>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 16 }}>
                                <span style={{ fontSize: 32, fontWeight: 800, color: '#202124' }}>0₫</span>
                                <span style={{ fontSize: 13, color: '#9aa0a6' }}>/tháng</span>
                            </div>
                            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {['1 workspace', '1 agent', '100 hội thoại/tháng', 'Widget live-chat cơ bản', 'Hỗ trợ email'].map(f => (
                                    <li key={f} style={{ fontSize: 13, color: '#3c4043', display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ color: '#34a853', fontWeight: 700, fontSize: 15 }}>✓</span> {f}
                                    </li>
                                ))}
                            </ul>
                            <button style={{ width: '100%', height: 40, borderRadius: 20, background: '#f1f3f4', border: 'none', color: '#5f6368', fontWeight: 500, fontSize: 14, cursor: 'default' }}>Gói hiện tại</button>
                        </div>
                        {/* Pro */}
                        <div style={{ padding: '28px 24px', background: '#fff', borderRadius: 16, border: '2px solid #1a73e8', position: 'relative', boxShadow: '0 4px 20px rgba(26,115,232,0.12)' }}>
                            <div style={{ position: 'absolute', top: -12, right: 20, background: '#1a73e8', color: '#fff', fontSize: 10, fontWeight: 700, padding: '4px 12px', borderRadius: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Phổ biến</div>
                            <p style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, color: '#1a73e8', margin: '0 0 4px' }}>Pro</p>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 16 }}>
                                <span style={{ fontSize: 32, fontWeight: 800, color: '#202124' }}>299K</span>
                                <span style={{ fontSize: 13, color: '#9aa0a6' }}>/tháng</span>
                            </div>
                            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {['3 workspaces', '5 agents', 'Không giới hạn hội thoại', 'Nhân viên AI tự động', 'Zalo cá nhân tích hợp', 'Thống kê & báo cáo', 'Hỗ trợ ưu tiên 24/7'].map(f => (
                                    <li key={f} style={{ fontSize: 13, color: '#3c4043', display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ color: '#1a73e8', fontWeight: 700, fontSize: 15 }}>✓</span> {f}
                                    </li>
                                ))}
                            </ul>
                            <button onClick={() => { setSelectedPlan('pro'); setShowUpgrade(true); }} style={{ width: '100%', height: 40, borderRadius: 20, background: '#1a73e8', border: 'none', color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer', boxShadow: '0 2px 8px rgba(26,115,232,0.3)' }}>Nâng cấp Pro</button>
                        </div>
                        {/* Business */}
                        <div style={{ padding: '28px 24px', background: '#fff', borderRadius: 16, border: '1px solid #e0e0e0', position: 'relative' }}>
                            <p style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, color: '#e37400', margin: '0 0 4px' }}>Business</p>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 16 }}>
                                <span style={{ fontSize: 32, fontWeight: 800, color: '#202124' }}>799K</span>
                                <span style={{ fontSize: 13, color: '#9aa0a6' }}>/tháng</span>
                            </div>
                            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {['Không giới hạn workspace', 'Không giới hạn agents', 'AI nâng cao + Knowledge Base', 'Auto Bank tích hợp', 'Multi-channel (Zalo, FB, Email)', 'Phân phối hội thoại tự động', 'API & Webhook tùy chỉnh', 'SLA & Hỗ trợ chuyên biệt'].map(f => (
                                    <li key={f} style={{ fontSize: 13, color: '#3c4043', display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ color: '#e37400', fontWeight: 700, fontSize: 15 }}>✓</span> {f}
                                    </li>
                                ))}
                            </ul>
                            <button onClick={() => { setSelectedPlan('business'); setShowUpgrade(true); }} style={{ width: '100%', height: 40, borderRadius: 20, background: '#fff', border: '1px solid #dadce0', color: '#202124', fontWeight: 500, fontSize: 14, cursor: 'pointer' }}>Liên hệ tư vấn</button>
                        </div>
                    </div>
                </div>

                {/* ─── Features Introduction ─── */}
                <div style={{ marginTop: 56, padding: '40px 0' }}>
                    <div style={{ textAlign: 'center', marginBottom: 36 }}>
                        <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 8px', color: '#202124' }}>Tại sao chọn NemarkChat?</h2>
                        <p style={{ color: '#5f6368', fontSize: 14, margin: 0, maxWidth: 480, marginLeft: 'auto', marginRight: 'auto' }}>Nền tảng live-chat & CRM thông minh giúp doanh nghiệp chăm sóc khách hàng hiệu quả</p>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
                        {[
                            { icon: '🤖', title: 'Nhân viên AI', desc: 'Chatbot AI tự động trả lời 24/7 với kiến thức doanh nghiệp' },
                            { icon: '💬', title: 'Đa kênh', desc: 'Tích hợp Zalo, Facebook, Email trong một giao diện duy nhất' },
                            { icon: '🏦', title: 'Auto Bank', desc: 'Theo dõi giao dịch ngân hàng real-time, tự động xác nhận thanh toán' },
                            { icon: '📊', title: 'Thống kê', desc: 'Báo cáo chi tiết về hiệu suất nhân viên và khách hàng' },
                            { icon: '⚡', title: 'Phản hồi nhanh', desc: 'Macro và template giúp tiết kiệm thời gian trả lời' },
                            { icon: '🔒', title: 'Bảo mật', desc: 'Mã hóa end-to-end, phân quyền chi tiết theo vai trò' },
                        ].map(f => (
                            <div key={f.title} style={{ padding: '24px', background: '#f8f9fa', borderRadius: 16, border: '1px solid #f1f3f4', transition: 'all 0.2s' }}>
                                <div style={{ fontSize: 28, marginBottom: 12 }}>{f.icon}</div>
                                <h3 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 6px', color: '#202124' }}>{f.title}</h3>
                                <p style={{ fontSize: 13, color: '#5f6368', margin: 0, lineHeight: 1.5 }}>{f.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </main>

            {/* ─── Footer ─── */}
            <footer style={{ borderTop: '1px solid #e0e0e0', background: '#f8f9fa', padding: '40px 32px 24px' }}>
                <div style={{ maxWidth: 960, margin: '0 auto' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 32, marginBottom: 32 }}>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                                <div style={{ width: 28, height: 28, borderRadius: 8, background: '#1a73e8', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14, fontWeight: 700 }}>N</div>
                                <span style={{ fontSize: 15, fontWeight: 700, color: '#202124' }}>NemarkChat</span>
                            </div>
                            <p style={{ fontSize: 13, color: '#5f6368', lineHeight: 1.6, margin: 0, maxWidth: 260 }}>Nền tảng live-chat & CRM thông minh cho doanh nghiệp Việt Nam. Tích hợp AI, đa kênh, tự động hóa.</p>
                            <p style={{ fontSize: 12, color: '#9aa0a6', margin: '12px 0 0' }}>📍 Linh Sơn, Thái Nguyên</p>
                            <p style={{ fontSize: 12, color: '#9aa0a6', margin: '4px 0 0' }}>📞 0964 543 556</p>
                        </div>
                        <div>
                            <h4 style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, color: '#5f6368', margin: '0 0 12px' }}>Sản phẩm</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {['Live Chat', 'AI Chatbot', 'CRM', 'Auto Bank', 'Analytics'].map(l => (
                                    <a key={l} style={{ fontSize: 13, color: '#5f6368', textDecoration: 'none', cursor: 'pointer' }}>{l}</a>
                                ))}
                            </div>
                        </div>
                        <div>
                            <h4 style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, color: '#5f6368', margin: '0 0 12px' }}>Hỗ trợ</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {['Hướng dẫn', 'API Docs', 'Liên hệ', 'Cộng đồng'].map(l => (
                                    <a key={l} style={{ fontSize: 13, color: '#5f6368', textDecoration: 'none', cursor: 'pointer' }}>{l}</a>
                                ))}
                            </div>
                        </div>
                        <div>
                            <h4 style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, color: '#5f6368', margin: '0 0 12px' }}>Pháp lý</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {['Điều khoản', 'Bảo mật', 'DMCA'].map(l => (
                                    <a key={l} style={{ fontSize: 13, color: '#5f6368', textDecoration: 'none', cursor: 'pointer' }}>{l}</a>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div style={{ borderTop: '1px solid #e0e0e0', paddingTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <p style={{ fontSize: 12, color: '#9aa0a6', margin: 0 }}>© 2026 NemarkChat. All rights reserved.</p>
                        <p style={{ fontSize: 12, color: '#9aa0a6', margin: 0 }}>Made with ❤️ in Vietnam</p>
                    </div>
                </div>
            </footer>
            {/* ─── Upgrade Plan Modal — thatim.vn inspired ─── */}
            <Modal
                title={null}
                open={showUpgrade}
                onCancel={() => setShowUpgrade(false)}
                footer={null}
                destroyOnClose
                width={900}
                className="upgrade-plan-modal"
                styles={{ body: { padding: 0 }, header: { display: 'none' } }}
            >
                <style>{`
                    .upgrade-plan-modal { max-width: 95vw !important; }
                    @media (max-width: 768px) {
                        .upgrade-plan-modal { max-width: 100vw !important; top: 10px !important; }
                        .upgrade-plan-modal .ant-modal-content { border-radius: 16px !important; }
                        .upgrade-col-wrap { flex-direction: column !important; }
                        .upgrade-col-left { border-right: none !important; border-bottom: 1px solid #f0f0f0; padding: 20px 16px !important; }
                        .upgrade-col-right { width: 100% !important; padding: 20px 16px !important; }
                        .upgrade-dur-grid { grid-template-columns: repeat(2, 1fr) !important; }
                    }
                `}</style>
                {(() => {
                    const basePrice = selectedPlan === 'pro' ? 299000 : 799000;
                    const durations = [
                        { months: 1, label: '1 tháng', discount: 0 },
                        { months: 3, label: '3 tháng', discount: 5 },
                        { months: 6, label: '6 tháng', discount: 10 },
                        { months: 12, label: '12 tháng', discount: 20 },
                    ];
                    const durInfo = durations.find(d => d.months === selDur) || durations[0];
                    const totalPrice = Math.round(basePrice * selDur * (1 - durInfo.discount / 100));
                    const fmtPrice = (n: number) => new Intl.NumberFormat('vi-VN').format(n);
                    const transferContent = `NEMARK ${selectedPlan.toUpperCase()} ${selDur}T ${maskEmail(user?.email || '')}`;

                    return (
                        <div className="upgrade-col-wrap" style={{ display: 'flex', minHeight: 520 }}>
                            {/* ═══ Left Column — Payment Info ═══ */}
                            <div className="upgrade-col-left" style={{ flex: 1, padding: '28px 28px 24px', borderRight: '1px solid #f0f0f0' }}>
                                {/* Plan header */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                                    <div style={{
                                        width: 44, height: 44, borderRadius: 12,
                                        background: selectedPlan === 'pro' ? 'linear-gradient(135deg, #1a73e8, #4285f4)' : 'linear-gradient(135deg, #e37400, #f59e0b)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    }}>
                                        <Crown size={20} color="#fff" />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 18, fontWeight: 700, color: '#202124' }}>Nâng cấp {selectedPlan === 'pro' ? 'Pro' : 'Business'}</div>
                                        <div style={{ fontSize: 12, color: '#5f6368' }}>{fmtPrice(basePrice)}₫/tháng</div>
                                    </div>
                                </div>

                                {/* Bank card */}
                                <div style={{
                                    background: 'linear-gradient(135deg, #0d47a1, #1565c0)', borderRadius: 14,
                                    padding: '18px 20px', color: '#fff', marginBottom: 20, position: 'relative', overflow: 'hidden',
                                }}>
                                    <div style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
                                    <div style={{ position: 'absolute', bottom: -30, right: 40, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                                        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.5, opacity: 0.9 }}>{(bankInfo?.bankName || bankInfo?.bank || 'ACB - Ngân hàng Á Châu').toUpperCase()}</div>
                                        <div style={{ fontSize: 10, background: 'rgba(255,255,255,0.2)', padding: '3px 10px', borderRadius: 10, fontWeight: 600 }}>NAPAS</div>
                                    </div>
                                    <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: 3, marginBottom: 12, fontFamily: 'monospace' }}>{bankInfo?.number || '24488671'}</div>
                                    <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.85, textTransform: 'uppercase', letterSpacing: 0.5 }}>{bankInfo?.holder || 'NEMARK DIGITAL'}</div>
                                </div>

                                {/* Duration selection */}
                                <div style={{ marginBottom: 16 }}>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: '#202124', marginBottom: 10 }}>Chọn thời hạn</div>
                                    <div className="upgrade-dur-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                                        {durations.map(d => (
                                            <button
                                                key={d.months}
                                                onClick={() => setSelDur(d.months)}
                                                style={{
                                                    padding: '10px 0', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                                                    border: selDur === d.months ? '2px solid #1a73e8' : '1px solid #e0e0e0',
                                                    background: selDur === d.months ? '#e8f0fe' : '#fff',
                                                    color: selDur === d.months ? '#1a73e8' : '#3c4043',
                                                    position: 'relative', transition: 'all 0.15s',
                                                }}
                                            >
                                                {d.label}
                                                {d.discount > 0 && (
                                                    <span style={{
                                                        position: 'absolute', top: -8, right: -4,
                                                        background: '#ea4335', color: '#fff', fontSize: 9, fontWeight: 700,
                                                        padding: '2px 6px', borderRadius: 8,
                                                    }}>-{d.discount}%</span>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Amount display */}
                                <div style={{ background: '#f8f9fa', borderRadius: 12, padding: '14px 18px', marginBottom: 16, border: '1px solid #e8eaed' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: 13, color: '#5f6368' }}>Số tiền thanh toán</span>
                                        <span style={{ fontSize: 13, color: '#5f6368', fontWeight: 500 }}>VNĐ</span>
                                    </div>
                                    <div style={{ fontSize: 28, fontWeight: 800, color: '#202124', marginTop: 4, fontFamily: 'monospace' }}>
                                        {fmtPrice(totalPrice)}
                                        {durInfo.discount > 0 && (
                                            <span style={{ fontSize: 13, color: '#ea4335', fontWeight: 600, marginLeft: 8, fontFamily: 'inherit' }}>
                                                Tiết kiệm {fmtPrice(basePrice * selDur - totalPrice)}₫
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Transfer content */}
                                <div style={{ background: '#fff', borderRadius: 12, padding: '14px 18px', border: '1px solid #e8eaed', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ fontSize: 11, color: '#9aa0a6', marginBottom: 4 }}>Nội dung chuyển khoản</div>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: '#202124', fontFamily: 'monospace', wordBreak: 'break-all' }}>{transferContent}</div>
                                    </div>
                                    <button
                                        onClick={() => { navigator.clipboard.writeText(transferContent); message.success('Đã sao chép nội dung CK!'); }}
                                        style={{ background: '#e8f0fe', border: 'none', borderRadius: 8, padding: '8px 16px', color: '#1a73e8', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
                                    >📋 Sao chép</button>
                                </div>

                                {/* Create invoice button */}
                                <button
                                    onClick={() => { message.success('Đã tạo hóa đơn! Vui lòng quét QR để thanh toán.'); }}
                                    style={{
                                        width: '100%', height: 48, borderRadius: 12,
                                        background: selectedPlan === 'pro' ? 'linear-gradient(135deg, #1a73e8, #4285f4)' : 'linear-gradient(135deg, #e37400, #f59e0b)',
                                        border: 'none', color: '#fff', fontWeight: 700, fontSize: 15,
                                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                        boxShadow: '0 4px 14px rgba(26,115,232,0.3)', transition: 'all 0.2s',
                                    }}
                                >
                                    <Zap size={18} /> TẠO HÓA ĐƠN
                                </button>
                            </div>

                            {/* ═══ Right Column — QR + Instructions ═══ */}
                            <div className="upgrade-col-right" style={{ width: 380, padding: '28px 24px', background: '#fafbfc', display: 'flex', flexDirection: 'column' }}>
                                {/* QR Code */}
                                <div style={{ textAlign: 'center', marginBottom: 24 }}>
                                    <div style={{ background: '#fff', borderRadius: 16, padding: 12, border: '1px solid #e8eaed', display: 'inline-block' }}>
                                        <img
                                            src={`https://img.vietqr.io/image/${bankInfo?.bank || 'ACB'}-${bankInfo?.number || '24488671'}-compact2.png?amount=${totalPrice}&addInfo=${encodeURIComponent(transferContent)}&accountName=${encodeURIComponent(bankInfo?.holder || 'NEMARK DIGITAL')}`}
                                            alt="QR Code thanh toán"
                                            style={{ width: 260, height: 260, borderRadius: 8, display: 'block' }}
                                            onError={(e) => { (e.target as HTMLImageElement).src = `https://img.vietqr.io/image/${bankInfo?.bank || 'ACB'}-${bankInfo?.number || '24488671'}-compact.png?amount=${totalPrice}&addInfo=${encodeURIComponent(transferContent)}&accountName=${encodeURIComponent(bankInfo?.holder || 'NEMARK DIGITAL')}`; }}
                                        />
                                    </div>
                                    <p style={{ fontSize: 12, color: '#5f6368', margin: '10px 0 0', fontWeight: 500 }}>Quét mã bằng app ngân hàng</p>
                                </div>

                                {/* Steps */}
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 14, fontWeight: 700, color: '#202124', marginBottom: 16 }}>Hướng dẫn thanh toán</div>
                                    {[
                                        { step: 1, title: 'Chọn thời hạn', desc: 'Chọn gói và thời hạn sử dụng phù hợp.' },
                                        { step: 2, title: 'Quét mã QR', desc: 'Mở app ngân hàng, quét mã QR hoặc chuyển khoản thủ công.' },
                                        { step: 3, title: 'Nhập đúng nội dung CK', desc: 'Ghi đúng nội dung chuyển khoản để hệ thống xác nhận tự động.' },
                                        { step: 4, title: 'Hoàn tất', desc: 'Sau 1-5 phút, gói sẽ được kích hoạt tự động.' },
                                    ].map(s => (
                                        <div key={s.step} style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
                                            <div style={{
                                                width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                                                background: '#1a73e8', color: '#fff', fontSize: 12, fontWeight: 700,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            }}>{s.step}</div>
                                            <div>
                                                <div style={{ fontSize: 13, fontWeight: 600, color: '#202124', marginBottom: 2 }}>{s.title}</div>
                                                <div style={{ fontSize: 11, color: '#5f6368', lineHeight: 1.5 }}>{s.desc}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Support notice */}
                                <div style={{ background: '#fff3cd', borderRadius: 10, padding: '10px 14px', border: '1px solid #ffc107', marginTop: 8 }}>
                                    <div style={{ fontSize: 11, color: '#856404', lineHeight: 1.5 }}>
                                        ⚠️ Nếu quá 10 phút chưa thấy kích hoạt, vui lòng liên hệ <strong>0964 543 556</strong> hoặc chat trực tiếp.
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })()}
            </Modal>

            {/* ─── Create Modal — Apple-style clean sheet ─── */}
            <Modal
                title={null}
                open={showCreate}
                onCancel={() => { setShowCreate(false); form.resetFields(); }}
                footer={null}
                destroyOnClose
                styles={{
                    body: { padding: '32px 32px 28px' },
                    header: { display: 'none' },
                }}
                width={440}
            >
                <div style={{ marginBottom: 28 }}>
                    <div style={{
                        width: 48, height: 48, borderRadius: 14,
                        background: '#e8f0fe',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        marginBottom: 16,
                    }}>
                        <Zap size={22} color="#1a73e8" strokeWidth={2} />
                    </div>
                    <h2 style={{
                        fontSize: 20, fontWeight: 600, margin: '0 0 6px', color: '#202124',
                        fontFamily: "'Google Sans', 'SF Pro Display', -apple-system, sans-serif",
                    }}>
                        Tạo workspace mới
                    </h2>
                    <p style={{ fontSize: 14, color: '#5f6368', margin: 0, lineHeight: 1.5 }}>
                        Thiết lập workspace để bắt đầu hỗ trợ khách hàng.
                    </p>
                </div>

                <Form form={form} layout="vertical" onFinish={handleCreate} requiredMark={false}>
                    <Form.Item
                        label={<span style={{ fontWeight: 500, fontSize: 13, color: '#202124' }}>Tên workspace</span>}
                        name="name"
                        rules={[{ required: true, message: 'Vui lòng nhập tên workspace' }]}
                    >
                        <Input
                            placeholder="VD: Công ty ABC"
                            onChange={handleNameChange}
                            style={{ height: 44, borderRadius: 8, fontSize: 14, border: '1px solid #dadce0' }}
                        />
                    </Form.Item>

                    <Form.Item
                        label={<span style={{ fontWeight: 500, fontSize: 13, color: '#202124' }}>Slug (URL)</span>}
                        name="slug"
                        rules={[
                            { required: true, message: 'Vui lòng nhập slug' },
                            { pattern: /^[a-z0-9-]+$/, message: 'Chỉ chấp nhận chữ thường, số và dấu gạch ngang' }
                        ]}
                    >
                        <Input
                            placeholder="cong-ty-abc"
                            addonBefore="/"
                            style={{ borderRadius: 8, fontSize: 14 }}
                        />
                    </Form.Item>

                    <div style={{
                        display: 'flex', justifyContent: 'flex-end', gap: 12,
                        marginTop: 28, paddingTop: 20,
                        borderTop: '1px solid #e0e0e0',
                    }}>
                        <button
                            type="button"
                            onClick={() => { setShowCreate(false); form.resetFields(); }}
                            style={{
                                height: 36, borderRadius: 18, padding: '0 20px',
                                background: 'transparent', border: '1px solid #dadce0',
                                color: '#1a73e8', fontSize: 14, fontWeight: 500,
                                cursor: 'pointer', transition: 'background 0.15s',
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = '#e8f0fe'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                            Huỷ
                        </button>
                        <button
                            type="button"
                            disabled={creating}
                            onClick={() => form.submit()}
                            style={{
                                height: 36, borderRadius: 18, padding: '0 24px',
                                background: '#1a73e8', border: 'none',
                                color: '#fff', fontSize: 14, fontWeight: 500,
                                cursor: creating ? 'not-allowed' : 'pointer',
                                opacity: creating ? 0.7 : 1,
                                display: 'flex', alignItems: 'center', gap: 6,
                                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                                transition: 'background 0.15s',
                            }}
                            onMouseEnter={e => { if (!creating) e.currentTarget.style.background = '#1765cc'; }}
                            onMouseLeave={e => { if (!creating) e.currentTarget.style.background = '#1a73e8'; }}
                        >
                            {creating && <Spin size="small" />}
                            Tạo workspace
                        </button>
                    </div>
                </Form>
            </Modal>
        </AppLayout>
    );
}
