import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { Button, Modal, Form, Input, message, Empty, Spin, Tag, Dropdown } from 'antd';
import { Plus, Settings, Users, ExternalLink } from 'lucide-react';
import { useGetMe } from '../../domains/auth/auth.hooks';
import { useMyWorkspaces, useCreateWorkspace } from '../../domains/workspace/workspace.hooks';
import AppLayout from '../../components/layout/AppLayout';

export default function WorkspacePage() {
    const router = useRouter();
    const [ready, setReady] = useState(false);
    const [showCreate, setShowCreate] = useState(false);
    const [form] = Form.useForm();

    useEffect(() => {
        const stored = localStorage.getItem('nemark_token');
        setReady(true);
        if (!stored) router.replace('/auth/login');
    }, [router]);

    const { data: meData, isLoading: meLoading, isError: meError } = useGetMe(ready);
    const { data: wsData, isLoading: wsLoading } = useMyWorkspaces();
    const { mutateAsync: createWs, isPending: creating } = useCreateWorkspace();

    // Auto-generate slug from name
    const handleNameChange = (e: any) => {
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
                message.success('Tạo workspace thành công!');
                setShowCreate(false);
                form.resetFields();
            }
        } catch (err: any) {
            message.error(err.response?.data?.error?.message || 'Có lỗi xảy ra');
        }
    };

    if (!ready || meLoading) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg-soft)' }}>
                <Spin size="large" />
            </div>
        );
    }

    if (meError || !meData?.data?.user) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg-soft)' }}>
                <div className="card" style={{ padding: 40, textAlign: 'center', maxWidth: 400 }}>
                    <h2 style={{ marginBottom: 12 }}>Phiên đăng nhập hết hạn</h2>
                    <p style={{ color: 'var(--color-text-secondary)', marginBottom: 24 }}>Vui lòng đăng nhập lại.</p>
                    <a href="/auth/login" className="btn btn-primary" style={{ display: 'inline-block' }}>Đăng nhập</a>
                </div>
            </div>
        );
    }

    const user = meData.data.user;
    const workspaces = wsData?.data || [];

    return (
        <AppLayout headerTitle="Workspace của bạn">
            <Head><title>Workspace | NemarChat</title></Head>

            {/* ─── Content ─── */}
            <main style={{ maxWidth: 960, margin: '0 auto', padding: '40px 24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
                    <div>
                        <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 4 }}>Workspace của bạn</h1>
                        <p style={{ color: 'var(--color-text-secondary)', fontSize: 14 }}>
                            Quản lý các workspace và cấu hình live-chat.
                        </p>
                    </div>
                    <Button
                        type="primary"
                        icon={<Plus size={16} />}
                        onClick={() => setShowCreate(true)}
                        style={{
                            height: 40, borderRadius: 'var(--radius-full)',
                            background: 'var(--gradient-hero)', border: 'none',
                            fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6,
                            boxShadow: '0 4px 14px rgba(99,102,241,0.25)'
                        }}
                    >
                        Tạo Workspace
                    </Button>
                </div>

                {/* ─── Workspace List ─── */}
                {wsLoading ? (
                    <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
                ) : workspaces.length === 0 ? (
                    <div className="card" style={{ padding: '60px 40px', textAlign: 'center' }}>
                        <Empty
                            description={
                                <span style={{ color: 'var(--color-text-secondary)' }}>
                                    Bạn chưa có workspace nào. Hãy tạo workspace đầu tiên!
                                </span>
                            }
                        />
                        <Button
                            type="primary"
                            onClick={() => setShowCreate(true)}
                            style={{
                                marginTop: 24, height: 40, borderRadius: 'var(--radius-full)',
                                background: 'var(--gradient-hero)', border: 'none', fontWeight: 600
                            }}
                        >
                            Tạo Workspace đầu tiên
                        </Button>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
                        {workspaces.map((ws: any) => (
                            <div
                                key={ws._id}
                                className="card"
                                style={{
                                    padding: 24, cursor: 'pointer',
                                    transition: 'transform 0.2s, box-shadow 0.2s',
                                }}
                                onMouseEnter={(e) => {
                                    (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
                                    (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 30px rgba(0,0,0,0.08)';
                                }}
                                onMouseLeave={(e) => {
                                    (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                                    (e.currentTarget as HTMLElement).style.boxShadow = '';
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
                                    <div style={{
                                        width: 44, height: 44, borderRadius: 12,
                                        background: 'var(--gradient-hero)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: 'white', fontWeight: 'bold', fontSize: 20
                                    }}>
                                        {ws.name.charAt(0).toUpperCase()}
                                    </div>
                                    <Tag color={ws.plan === 'free' ? 'default' : 'blue'} style={{ borderRadius: 12 }}>
                                        {ws.plan?.toUpperCase() || 'FREE'}
                                    </Tag>
                                </div>

                                <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>{ws.name}</h3>
                                <p style={{ color: 'var(--color-text-muted)', fontSize: 13, marginBottom: 16 }}>
                                    /{ws.slug}
                                </p>

                                <div style={{ display: 'flex', alignItems: 'center', gap: 16, color: 'var(--color-text-secondary)', fontSize: 13 }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <Users size={14} /> {ws.members?.length || 0} thành viên
                                    </span>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <Settings size={14} /> {ws.settings?.language || 'vi'}
                                    </span>
                                </div>

                                <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--color-border)', display: 'flex', gap: 8 }}>
                                    <Button
                                        size="small"
                                        type="primary"
                                        ghost
                                        icon={<ExternalLink size={13} />}
                                        onClick={() => router.push(`/workspace/${ws._id}`)}
                                        style={{ borderRadius: 8, fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}
                                    >
                                        Mở
                                    </Button>
                                    <Button
                                        size="small"
                                        icon={<Users size={13} />}
                                        onClick={() => router.push(`/workspace/${ws._id}/teams`)}
                                        style={{ borderRadius: 8, fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}
                                    >
                                        Đội ngũ
                                    </Button>
                                    <Button
                                        size="small"
                                        icon={<Settings size={13} />}
                                        onClick={() => router.push(`/workspace/${ws._id}/settings`)}
                                        style={{ borderRadius: 8, fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}
                                    >
                                        Cài đặt
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {/* ─── Create Workspace Modal ─── */}
            <Modal
                title="Tạo Workspace mới"
                open={showCreate}
                onCancel={() => { setShowCreate(false); form.resetFields(); }}
                footer={null}
                destroyOnClose
            >
                <Form form={form} layout="vertical" onFinish={handleCreate} requiredMark={false} style={{ marginTop: 16 }}>
                    <Form.Item
                        label="Tên workspace"
                        name="name"
                        rules={[{ required: true, message: 'Vui lòng nhập tên workspace!' }]}
                    >
                        <Input placeholder="VD: Công ty ABC" onChange={handleNameChange} />
                    </Form.Item>

                    <Form.Item
                        label="Slug (URL)"
                        name="slug"
                        rules={[
                            { required: true, message: 'Vui lòng nhập slug!' },
                            { pattern: /^[a-z0-9-]+$/, message: 'Slug chỉ chấp nhận chữ thường, số và dấu gạch ngang' }
                        ]}
                    >
                        <Input placeholder="cong-ty-abc" addonBefore="/" />
                    </Form.Item>

                    <Form.Item style={{ marginBottom: 0, marginTop: 24, textAlign: 'right' }}>
                        <Button onClick={() => { setShowCreate(false); form.resetFields(); }} style={{ marginRight: 8 }}>
                            Huỷ
                        </Button>
                        <Button
                            type="primary"
                            htmlType="submit"
                            loading={creating}
                            style={{
                                background: 'var(--gradient-hero)', border: 'none', fontWeight: 600,
                                borderRadius: 'var(--radius-md)'
                            }}
                        >
                            Tạo workspace
                        </Button>
                    </Form.Item>
                </Form>
            </Modal>
        </AppLayout>
    );
}
