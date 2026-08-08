import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
import { Form, Input, Modal, Spin, message } from 'antd';
import {
    ArrowRight,
    Bot,
    Building2,
    CheckCircle2,
    Clock,
    CreditCard,
    Globe2,
    MessageSquare,
    Plus,
    ShieldCheck,
    Smartphone,
    Users,
    Zap,
} from 'lucide-react';
import AppLayout from '../../components/layout/AppLayout';
import { useGetMe } from '../../domains/auth/auth.hooks';
import { useCreateWorkspace, useMyWorkspaces } from '../../domains/workspace/workspace.hooks';
import { getStoredAccessToken, refreshAccessToken } from '../../lib/http/client';

const planMeta: Record<string, { label: string; color: string; bg: string }> = {
    free: { label: 'Free', color: '#475467', bg: '#f2f4f7' },
    pro: { label: 'Pro', color: '#1d4ed8', bg: '#eff6ff' },
    business: { label: 'Business', color: '#0f766e', bg: '#ecfdf5' },
    enterprise: { label: 'Enterprise', color: '#6d28d9', bg: '#f5f3ff' },
};

export default function WorkspacePage() {
    const router = useRouter();
    const [ready, setReady] = useState(false);
    const [showCreate, setShowCreate] = useState(false);
    const [form] = Form.useForm();

    useEffect(() => {
        let mounted = true;

        const ensureSession = async () => {
            const token = getStoredAccessToken() || await refreshAccessToken();
            if (!mounted) return;
            setReady(true);
            if (!token) router.replace('/auth/login');
        };

        ensureSession();

        return () => {
            mounted = false;
        };
    }, [router]);

    const { data: meData, isLoading: meLoading, isError } = useGetMe(ready);
    const { data: wsData, isLoading: wsLoading } = useMyWorkspaces();
    const { mutateAsync: createWorkspace, isPending: creating } = useCreateWorkspace();

    const user = meData?.data?.user;
    const workspaces = useMemo(() => wsData?.data || [], [wsData]);

    const totals = useMemo(() => {
        const members = workspaces.reduce((sum: number, workspace: any) => sum + ((workspace.members as any[])?.length || 0), 0);
        const active = workspaces.filter((workspace: any) => workspace.isActive !== false).length;
        return { members, active };
    }, [workspaces]);

    const handleNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const value = event.target.value;
        const slug = value
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9\s-]/g, '')
            .trim()
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-');
        form.setFieldValue('slug', slug);
    };

    const handleCreate = async (values: any) => {
        try {
            const response = await createWorkspace(values);
            if (response.success) {
                message.success('Đã tạo workspace mới');
                setShowCreate(false);
                form.resetFields();
            }
        } catch (error: any) {
            message.error(error.response?.data?.error?.message || 'Không thể tạo workspace. Vui lòng thử lại.');
        }
    };

    if (!ready || meLoading) {
        return (
            <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--ent-bg)' }}>
                <Spin size="large" />
            </div>
        );
    }

    if (isError || !user) {
        return (
            <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--ent-bg)' }}>
                <div className="enterprise-card" style={{ maxWidth: 420, padding: 30, textAlign: 'center' }}>
                    <ShieldCheck size={34} color="var(--ent-rose)" />
                    <h2 style={{ margin: '14px 0 8px', fontSize: 20, fontWeight: 900 }}>Phiên đăng nhập đã hết hạn</h2>
                    <p style={{ margin: '0 0 22px', color: 'var(--ent-text-muted)' }}>Vui lòng đăng nhập lại để tiếp tục quản lý workspace.</p>
                    <a href="/auth/login" className="enterprise-button enterprise-button-primary">Đăng nhập lại</a>
                </div>
            </div>
        );
    }

    return (
        <AppLayout headerTitle="Workspace">
            <Head>
                <title>Workspace | NemarkChat</title>
            </Head>

            <div className="enterprise-page">
                <div className="enterprise-container">
                    {/* Personalized Greeting */}
                    <div className="ws-greeting" style={{ marginBottom: 20 }}>
                        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: 'var(--ent-text)' }}>
                            <span className="ws-greeting-emoji">{getGreetingEmoji()}</span>{' '}
                            {getGreeting()}, {user?.name?.split(' ').pop() || 'bạn'}
                        </h2>
                        <p style={{ margin: '4px 0 0', color: 'var(--ent-text-muted)', fontSize: 14 }}>
                            Sẵn sàng vận hành workspace và chăm sóc khách hàng hôm nay.
                        </p>
                    </div>
                    <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 18, alignItems: 'stretch' }} className="workspace-hero-grid">
                        <div className="enterprise-section workspace-overview-panel" style={{ padding: 26 }}>
                            <div className="workspace-hero-heading-row" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20 }}>
                                <div style={{ maxWidth: 760 }}>
                                    <span className="enterprise-kicker">
                                        <Building2 size={14} />
                                        Tenant Operations
                                    </span>
                                    <h1 className="workspace-hero-title" style={{ margin: '16px 0 10px', fontSize: 34, lineHeight: 1.14, fontWeight: 950, letterSpacing: 0, color: 'var(--ent-text)' }}>
                                        Quản lý các workspace khách thuê từ một trung tâm vận hành.
                                    </h1>
                                    <p style={{ margin: 0, maxWidth: 680, color: 'var(--ent-text-muted)', fontSize: 15, lineHeight: 1.75 }}>
                                        Mỗi workspace là một doanh nghiệp sử dụng live chat, Zalo/Facebook/email, đội CSKH và AI riêng. Mục tiêu là giúp khách vào là hiểu trạng thái, biết bước tiếp theo và bắt đầu vận hành ngay.
                                    </p>
                                </div>
                                <button onClick={() => setShowCreate(true)} className="enterprise-button enterprise-button-primary workspace-create-button" style={{ flexShrink: 0 }}>
                                    <Plus size={17} />
                                    Tạo workspace
                                </button>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, marginTop: 26 }} className="workspace-stat-grid">
                                <StatTile icon={Building2} label="Workspace" value={String(workspaces.length)} tone="blue" />
                                <StatTile icon={CheckCircle2} label="Đang hoạt động" value={String(totals.active)} tone="green" />
                                <StatTile icon={Users} label="Thành viên" value={String(totals.members)} tone="violet" />
                                <StatTile icon={Clock} label="Sẵn sàng triển khai" value="< 10 phút" tone="amber" />
                            </div>
                        </div>

                        <div className="enterprise-section" style={{ padding: 22 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                                <div>
                                    <div style={{ color: 'var(--ent-text)', fontWeight: 900, fontSize: 16 }}>Onboarding chuẩn</div>
                                    <div style={{ color: 'var(--ent-text-muted)', fontSize: 13, marginTop: 4 }}>Luồng giúp khách thuê bắt đầu nhanh</div>
                                </div>
                                <Zap size={20} color="var(--ent-primary)" />
                            </div>
                            <div style={{ display: 'grid', gap: 12 }}>
                                {[
                                    ['Tạo workspace', 'Khai báo tên doanh nghiệp và URL'],
                                    ['Kết nối kênh', 'Web chat, Zalo, Facebook, Email'],
                                    ['Bật AI', 'Nạp tri thức và kịch bản trả lời'],
                                    ['Mời team', 'Phân quyền agent và quản lý SLA'],
                                ].map(([title, desc], index) => (
                                    <div key={title} className="ws-onboard-step" style={{ display: 'flex', gap: 12 }}>
                                        <div style={{ width: 26, height: 26, borderRadius: 999, background: index === 0 ? 'var(--ent-primary)' : '#eef2f7', color: index === 0 ? '#fff' : 'var(--ent-text-muted)', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 900, flexShrink: 0 }}>
                                            {index + 1}
                                        </div>
                                        <div>
                                            <div style={{ fontSize: 13, fontWeight: 850, color: 'var(--ent-text)' }}>{title}</div>
                                            <div style={{ fontSize: 12, color: 'var(--ent-text-muted)', marginTop: 2 }}>{desc}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>

                    <section style={{ marginTop: 18 }}>
                        {wsLoading ? (
                            <div className="enterprise-section" style={{ padding: 70, display: 'grid', placeItems: 'center' }}>
                                <Spin size="large" />
                            </div>
                        ) : workspaces.length === 0 ? (
                            <EmptyWorkspace onCreate={() => setShowCreate(true)} />
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))', gap: 14 }}>
                                {workspaces.map((workspace: any, index: number) => (
                                    <WorkspaceCard key={workspace.id} workspace={workspace} index={index} onOpen={() => router.push(`/workspace/${workspace.id}`)} className="ws-card-stagger" />
                                ))}
                            </div>
                        )}
                    </section>
                </div>
            </div>

            <Modal
                title={null}
                open={showCreate}
                onCancel={() => {
                    setShowCreate(false);
                    form.resetFields();
                }}
                footer={null}
                width={520}
                destroyOnHidden
                styles={{ body: { padding: 0 } }}
            >
                <div style={{ padding: 26, borderBottom: '1px solid var(--ent-border)' }}>
                    <span className="enterprise-icon-box"><Building2 size={19} /></span>
                    <h2 style={{ margin: '16px 0 6px', fontSize: 22, fontWeight: 950 }}>Tạo workspace khách thuê</h2>
                    <p style={{ margin: 0, color: 'var(--ent-text-muted)', lineHeight: 1.65 }}>
                        Workspace là không gian riêng để khách kết nối kênh, mời nhân sự và bật AI chăm sóc khách hàng.
                    </p>
                </div>

                <Form form={form} layout="vertical" onFinish={handleCreate} requiredMark={false} style={{ padding: 26 }}>
                    <Form.Item
                        label={<strong>Tên doanh nghiệp / dự án</strong>}
                        name="name"
                        rules={[{ required: true, message: 'Vui lòng nhập tên workspace.' }]}
                    >
                        <Input placeholder="VD: Nemark Retail" onChange={handleNameChange} style={{ height: 44, borderRadius: 8 }} />
                    </Form.Item>

                    <Form.Item
                        label={<strong>Đường dẫn workspace</strong>}
                        name="slug"
                        rules={[
                            { required: true, message: 'Vui lòng nhập slug.' },
                            { pattern: /^[a-z0-9-]+$/, message: 'Chỉ dùng chữ thường, số và dấu gạch ngang.' },
                        ]}
                    >
                        <Input addonBefore="/w/" placeholder="nemark-retail" style={{ height: 44, borderRadius: 8 }} />
                    </Form.Item>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 12 }}>
                        <button type="button" className="enterprise-button" onClick={() => setShowCreate(false)}>
                            Hủy
                        </button>
                        <button type="button" className="enterprise-button enterprise-button-primary" disabled={creating} onClick={() => form.submit()}>
                            {creating ? 'Đang tạo...' : 'Tạo workspace'}
                        </button>
                    </div>
                </Form>
            </Modal>

            <style jsx global>{`
                @media (max-width: 1280px) {
                    .workspace-hero-grid { grid-template-columns: 1fr !important; }
                }
                @media (max-width: 1080px) {
                    .workspace-stat-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
                }
                @media (max-width: 560px) {
                    .workspace-hero-heading-row { flex-direction: column !important; }
                    .workspace-create-button { width: 100% !important; justify-content: center !important; }
                    .workspace-hero-title { font-size: clamp(26px, 8vw, 32px) !important; overflow-wrap: normal !important; word-break: normal !important; }
                    .workspace-overview-panel { padding: 20px !important; }
                    .workspace-stat-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap: 10px !important; }
                    .workspace-stat-tile { padding: 13px !important; min-width: 0 !important; }
                    .workspace-stat-label { overflow-wrap: anywhere; line-height: 1.35 !important; }
                }
                @media (max-width: 360px) {
                    .workspace-stat-grid { grid-template-columns: 1fr !important; }
                }
            `}</style>
        </AppLayout>
    );
}

function AnimatedCounter({ value, tone }: { value: string; tone: string }) {
    const [display, setDisplay] = useState(value);
    const numericValue = parseInt(value, 10);

    useEffect(() => {
        if (isNaN(numericValue) || numericValue === 0) {
            setDisplay(value);
            return;
        }
        let start = 0;
        const duration = 600;
        const startTime = performance.now();
        const step = (now: number) => {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            start = Math.round(eased * numericValue);
            setDisplay(String(start));
            if (progress < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    }, [numericValue, value]);

    return <span className="ws-animated-counter">{display}</span>;
}

function StatTile({ icon: Icon, label, value, tone }: { icon: any; label: string; value: string; tone: 'blue' | 'green' | 'violet' | 'amber' }) {
    const tones = {
        blue: ['#eff6ff', '#2563eb'],
        green: ['#ecfdf5', '#0f766e'],
        violet: ['#f5f3ff', '#6d28d9'],
        amber: ['#fffbeb', '#b45309'],
    }[tone];

    return (
        <div className="workspace-stat-tile" style={{ border: '1px solid var(--ent-border)', borderRadius: 8, background: '#fff', padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div className="workspace-stat-label" style={{ color: 'var(--ent-text-muted)', fontSize: 12, fontWeight: 800, textTransform: 'uppercase' }}>{label}</div>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: tones[0], color: tones[1], display: 'grid', placeItems: 'center' }}>
                    <Icon size={17} />
                </div>
            </div>
            <div style={{ marginTop: 12, fontSize: 26, fontWeight: 950, color: 'var(--ent-text)' }}>
                <AnimatedCounter value={value} tone={tone} />
            </div>
        </div>
    );
}

function getGreetingEmoji() {
    const h = new Date().getHours();
    if (h < 12) return '☀️';
    if (h < 18) return '🌤️';
    return '🌙';
}

function getGreeting() {
    const h = new Date().getHours();
    if (h < 12) return 'Chào buổi sáng';
    if (h < 18) return 'Chào buổi chiều';
    return 'Chào buổi tối';
}

function EmptyWorkspace({ onCreate }: { onCreate: () => void }) {
    return (
        <div className="enterprise-section" style={{ padding: 34 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 360px', gap: 24, alignItems: 'center' }} className="empty-workspace-grid">
                <div>
                    <span className="enterprise-icon-box ws-empty-icon"><MessageSquare size={20} /></span>
                    <h2 style={{ margin: '18px 0 10px', fontSize: 26, fontWeight: 950 }}>Bắt đầu bằng workspace đầu tiên</h2>
                    <p style={{ margin: 0, color: 'var(--ent-text-muted)', maxWidth: 640, lineHeight: 1.75 }}>
                        Tạo workspace để khách có khu vực riêng: inbox CSKH, kết nối Zalo/Facebook/Web chat, mời agent, bật AI và quản lý gói thuê theo tháng.
                    </p>
                    <button onClick={onCreate} className="enterprise-button enterprise-button-primary" style={{ marginTop: 22 }}>
                        <Plus size={17} />
                        Tạo workspace
                    </button>
                </div>
                <div style={{ border: '1px solid var(--ent-border)', borderRadius: 8, background: '#f8fafc', padding: 18 }}>
                    {[
                        { icon: Globe2, text: 'Web chat widget sẵn sàng nhúng' },
                        { icon: Smartphone, text: 'Phiên Zalo phục vụ chăm sóc khách hàng' },
                        { icon: Bot, text: 'AI trả lời theo kho tri thức riêng' },
                        { icon: CreditCard, text: 'Gói thuê và giới hạn tiêu hao theo tháng' },
                    ].map(({ icon: Icon, text }) => (
                        <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid #eef2f7' }}>
                            <Icon size={18} color="var(--ent-primary)" />
                            <span style={{ color: 'var(--ent-text)', fontSize: 14, fontWeight: 750 }}>{text}</span>
                        </div>
                    ))}
                </div>
            </div>
            <style jsx global>{`
                @media (max-width: 900px) {
                    .empty-workspace-grid { grid-template-columns: 1fr !important; }
                }
            `}</style>
        </div>
    );
}

function WorkspaceCard({ workspace, index, onOpen, className }: { workspace: any; index: number; onOpen: () => void; className?: string }) {
    const planKey = String(workspace.plan || 'free').toLowerCase();
    const plan = planMeta[planKey] || planMeta.free;
    const members = (workspace.members as any[]) || [];
    const channels = [
        { icon: MessageSquare, label: 'Web' },
        { icon: Smartphone, label: 'Zalo' },
        { icon: Bot, label: 'AI' },
    ];

    return (
        <article className={`enterprise-card ${workspace.isActive !== false ? 'ws-card-active' : ''} ${className || ''}`} style={{ padding: 20, cursor: 'pointer' }} onClick={onOpen}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                    <div style={{ width: 46, height: 46, borderRadius: 8, background: ['#2563eb', '#0f766e', '#6d28d9', '#b45309'][index % 4], color: '#fff', display: 'grid', placeItems: 'center', fontSize: 18, fontWeight: 950, flexShrink: 0 }}>
                        {String(workspace.name || 'W').charAt(0).toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0 }}>
                        <h3 style={{ margin: 0, color: 'var(--ent-text)', fontSize: 16, fontWeight: 950, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{workspace.name}</h3>
                        <div style={{ marginTop: 5, color: 'var(--ent-text-muted)', fontSize: 13 }}>/{workspace.slug || workspace.id}</div>
                    </div>
                </div>
                <span style={{ padding: '5px 9px', borderRadius: 999, color: plan.color, background: plan.bg, fontSize: 12, fontWeight: 850 }}>{plan.label}</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 18 }}>
                <MiniMetric label="Agent" value={String(members.length || 1)} />
                <MiniMetric label="SLA" value="<5m" />
                <MiniMetric label="Trạng thái" value={workspace.isActive === false ? 'Tạm dừng' : 'Live'} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 18, paddingTop: 16, borderTop: '1px solid #eef2f7' }}>
                <div style={{ display: 'flex', gap: 8 }}>
                    {channels.map(({ icon: Icon, label }) => (
                        <span key={label} title={label} style={{ width: 32, height: 32, borderRadius: 8, background: '#f8fafc', border: '1px solid var(--ent-border)', color: 'var(--ent-text-muted)', display: 'grid', placeItems: 'center' }}>
                            <Icon size={15} />
                        </span>
                    ))}
                </div>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--ent-primary)', fontSize: 13, fontWeight: 850 }}>
                    Mở workspace
                    <ArrowRight size={15} />
                </span>
            </div>
        </article>
    );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
    return (
        <div style={{ padding: 10, borderRadius: 8, background: '#f8fafc', border: '1px solid #eef2f7' }}>
            <div style={{ color: 'var(--ent-text-muted)', fontSize: 11, fontWeight: 800 }}>{label}</div>
            <div style={{ color: 'var(--ent-text)', fontSize: 15, fontWeight: 950, marginTop: 4 }}>{value}</div>
        </div>
    );
}
