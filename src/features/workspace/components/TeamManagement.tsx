import React, { useMemo, useState } from 'react';
import Head from 'next/head';
import { Button, Modal, Form, Input, Select, Table, Tag, Space, Popconfirm, Avatar, Spin, message, Alert } from 'antd';
import { Users, Plus, Trash2, Mail, ShieldCheck, Headphones, Eye, Search, UserRoundCheck, Clock3, Send } from 'lucide-react';
import { useGetMe } from '../../../domains/auth/auth.hooks';
import {
    useWorkspace,
    useWorkspaceMembers,
    useWorkspaceInvitations,
    useAddWorkspaceMember,
    useUpdateWorkspaceMemberRole,
    useCancelWorkspaceInvitation,
    useResendWorkspaceInvitation,
    useRemoveWorkspaceMember,
} from '../../../domains/workspace/workspace.hooks';
import AppLayout from '../../../components/layout/AppLayout';

type WorkspaceMember = {
    role: 'owner' | 'admin' | 'agent' | 'member' | string;
    joinedAt?: string;
    user?: {
        id?: string;
        _id?: string;
        name?: string;
        fullName?: string;
        email?: string;
        avatarUrl?: string;
    };
    userId?: {
        _id?: string;
        id?: string;
        fullName?: string;
        email?: string;
    } | string;
};

type WorkspaceInvitation = {
    id: string;
    email: string;
    role: string;
    status: 'pending' | 'expired' | string;
    createdAt?: string;
    expiresAt?: string;
    invitedBy?: {
        id?: string;
        name?: string | null;
        email?: string | null;
    } | null;
};

const roleLabel: Record<string, string> = {
    owner: 'Chủ sở hữu',
    admin: 'Quản trị viên',
    agent: 'Nhân viên hỗ trợ',
    member: 'Thành viên',
};

const cleanRoleLabel: Record<string, string> = {
    owner: 'Chủ sở hữu',
    admin: 'Quản trị viên',
    agent: 'Nhân viên hỗ trợ',
    member: 'Chỉ xem',
};

const memberId = (member: WorkspaceMember) => {
    if (member.user?.id || member.user?._id) return member.user.id || member.user._id || '';
    if (typeof member.userId === 'string') return member.userId;
    return member.userId?._id || member.userId?.id || '';
};

const memberName = (member: WorkspaceMember) => {
    if (member.user) return member.user.name || member.user.fullName || 'Chưa cập nhật tên';
    if (typeof member.userId === 'string') return 'Chưa cập nhật tên';
    return member.userId?.fullName || 'Chưa cập nhật tên';
};

const memberEmail = (member: WorkspaceMember) => {
    if (member.user) return member.user.email || '';
    if (typeof member.userId === 'string') return '';
    return member.userId?.email || '';
};

export function TeamManagement({ workspaceId }: { workspaceId: string }) {
    const [form] = Form.useForm();
    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');

    const { data: meData, isLoading: meLoading } = useGetMe(true);
    const { data: wsData, isLoading: wsLoading } = useWorkspace(workspaceId, !!workspaceId);
    const { data: membersData, isLoading: membersLoading } = useWorkspaceMembers(workspaceId);
    const { data: invitationsData, isLoading: invitationsLoading } = useWorkspaceInvitations(workspaceId);

    const { mutateAsync: addMember, isPending: isAdding } = useAddWorkspaceMember();
    const { mutateAsync: updateRole, isPending: isUpdatingRole } = useUpdateWorkspaceMemberRole();
    const { mutateAsync: cancelInvitation, isPending: isCancelingInvitation } = useCancelWorkspaceInvitation();
    const { mutateAsync: resendInvitation, isPending: isResendingInvitation } = useResendWorkspaceInvitation();
    const { mutateAsync: removeMember, isPending: isRemoving } = useRemoveWorkspaceMember();

    const workspace = wsData?.data;
    const members: WorkspaceMember[] = useMemo(() => membersData?.data || [], [membersData?.data]);
    const invitations: WorkspaceInvitation[] = useMemo(() => invitationsData?.data || [], [invitationsData?.data]);
    const me = meData?.data;

    const myId = me?.user?.id || (me?.user as { _id?: string })?._id || (me as { _id?: string })?._id;
    const myRole = members.find((member) => memberId(member) === myId)?.role;
    const canManage = myRole === 'admin' || myRole === 'owner';

    const teamStats = useMemo(() => {
        const ownerAdmin = members.filter((member) => member.role === 'owner' || member.role === 'admin').length;
        const agents = members.filter((member) => member.role === 'agent').length;
        const viewers = members.filter((member) => member.role === 'member').length;
        return { total: members.length, ownerAdmin, agents, viewers };
    }, [members]);

    const filteredMembers = useMemo(() => {
        const normalizedSearch = search.trim().toLowerCase();
        return members.filter((member) => {
            if (roleFilter !== 'all' && member.role !== roleFilter) return false;
            if (!normalizedSearch) return true;
            return `${memberName(member)} ${memberEmail(member)} ${roleLabel[member.role] || member.role}`.toLowerCase().includes(normalizedSearch);
        });
    }, [members, roleFilter, search]);

    const handleInvite = async (values: { email: string; role: string }) => {
        try {
            const res = await addMember({ workspaceId, email: values.email, role: values.role });
            if (res.success) {
                message.success('Đã cấp quyền vào workspace thành công');
                setIsInviteModalOpen(false);
                form.resetFields();
            }
        } catch (error: unknown) {
            const err = error as { response?: { data?: { error?: { message?: string } } } };
            message.error(err.response?.data?.error?.message || 'Lỗi khi mời thành viên');
        }
    };

    const handleCancelInvitation = async (invitationId: string) => {
        try {
            const res = await cancelInvitation({ workspaceId, invitationId });
            if (res.success) message.success('Đã hủy lời mời');
        } catch (error: unknown) {
            const err = error as { response?: { data?: { error?: { message?: string } } } };
            message.error(err.response?.data?.error?.message || 'Lỗi khi hủy lời mời');
        }
    };

    const handleResendInvitation = async (invitationId: string) => {
        try {
            const res = await resendInvitation({ workspaceId, invitationId });
            if (res.success) message.success('Đã gửi lại email mời');
        } catch (error: unknown) {
            const err = error as { response?: { data?: { error?: { message?: string } } } };
            message.error(err.response?.data?.error?.message || 'Lỗi khi gửi lại lời mời');
        }
    };

    const handleRemove = async (userId: string) => {
        try {
            const res = await removeMember({ workspaceId, userId });
            if (res.success) message.success('Đã xoá thành viên khỏi workspace');
        } catch (error: unknown) {
            const err = error as { response?: { data?: { error?: { message?: string } } } };
            message.error(err.response?.data?.error?.message || 'Lỗi khi xoá thành viên');
        }
    };

    const handleRoleChange = async (userId: string, role: string) => {
        try {
            const res = await updateRole({ workspaceId, userId, role });
            if (res.success) message.success('Đã cập nhật vai trò thành viên');
        } catch (error: unknown) {
            const err = error as { response?: { data?: { error?: { message?: string } } } };
            message.error(err.response?.data?.error?.message || 'Lỗi khi cập nhật vai trò');
        }
    };

    const columns = [
        {
            title: 'Thành viên',
            key: 'user',
            render: (_: unknown, record: WorkspaceMember) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Avatar style={{ backgroundColor: '#6366f1' }}>
                        {(memberName(record).charAt(0) || memberEmail(record).charAt(0) || 'N').toUpperCase()}
                    </Avatar>
                    <div>
                        <div style={{ fontWeight: 750, color: 'var(--ent-text)' }}>{memberName(record)}</div>
                        <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{memberEmail(record) || 'Chưa có email'}</div>
                    </div>
                </div>
            ),
        },
        {
            title: 'Vai trò',
            dataIndex: 'role',
            key: 'role',
            render: (role: string, record: WorkspaceMember) => {
                const id = memberId(record);
                if (canManage && record.role !== 'owner' && id !== myId) {
                    return (
                        <Select
                            value={role}
                            size="small"
                            loading={isUpdatingRole}
                            style={{ minWidth: 190 }}
                            onChange={(nextRole) => handleRoleChange(id, nextRole)}
                            options={[
                                { value: 'admin', label: 'Quản trị viên' },
                                { value: 'agent', label: 'Nhân viên hỗ trợ' },
                                { value: 'member', label: 'Chỉ xem' },
                            ]}
                        />
                    );
                }
                const color = role === 'admin' || role === 'owner' ? 'red' : role === 'agent' ? 'blue' : 'default';
                return <Tag color={color}>{(roleLabel[role] || role).toUpperCase()}</Tag>;
            },
        },
        {
            title: 'Ngày tham gia',
            dataIndex: 'joinedAt',
            key: 'joinedAt',
            render: (date: string) => date ? new Date(date).toLocaleDateString('vi-VN') : '-',
        },
        {
            title: 'Thao tác',
            key: 'action',
            render: (_: unknown, record: WorkspaceMember) => {
                const id = memberId(record);
                if (!canManage || record.role === 'owner' || id === myId) return null;
                return (
                    <Popconfirm
                        title="Xoá thành viên"
                        description="Bạn có chắc chắn muốn xoá thành viên này khỏi workspace?"
                        onConfirm={() => handleRemove(id)}
                        okText="Xoá"
                        cancelText="Hủy"
                        okButtonProps={{ danger: true, loading: isRemoving }}
                    >
                        <Button danger type="text" icon={<Trash2 size={16} />} />
                    </Popconfirm>
                );
            },
        },
    ];

    const invitationColumns = [
        {
            title: 'Email được mời',
            dataIndex: 'email',
            key: 'email',
            render: (email: string) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Avatar style={{ backgroundColor: '#eef2ff', color: '#4f46e5' }}>{email.charAt(0).toUpperCase()}</Avatar>
                    <div>
                        <div style={{ fontWeight: 800, color: 'var(--ent-text)' }}>{email}</div>
                        <div style={{ fontSize: 12, color: 'var(--ent-text-muted)' }}>Chờ click email join link</div>
                    </div>
                </div>
            ),
        },
        {
            title: 'Vai trò',
            dataIndex: 'role',
            key: 'role',
            render: (role: string) => <Tag color={role === 'admin' ? 'red' : role === 'agent' ? 'blue' : 'default'}>{cleanRoleLabel[role] || role}</Tag>,
        },
        {
            title: 'Trạng thái',
            dataIndex: 'status',
            key: 'status',
            render: (status: string) => status === 'expired'
                ? <Tag color="red">Hết hạn</Tag>
                : <Tag color="gold">Đang chờ</Tag>,
        },
        {
            title: 'Hết hạn',
            dataIndex: 'expiresAt',
            key: 'expiresAt',
            render: (date?: string) => date ? new Date(date).toLocaleString('vi-VN') : '-',
        },
        {
            title: 'Người mời',
            dataIndex: 'invitedBy',
            key: 'invitedBy',
            render: (invitedBy?: WorkspaceInvitation['invitedBy']) => invitedBy?.name || invitedBy?.email || '-',
        },
        {
            title: 'Thao tác',
            key: 'action',
            render: (_: unknown, record: WorkspaceInvitation) => (
                <Space>
                    <Button
                        type="text"
                        icon={<Send size={16} />}
                        loading={isResendingInvitation}
                        onClick={() => handleResendInvitation(record.id)}
                    >
                        Gửi lại
                    </Button>
                    <Popconfirm
                        title="Hủy lời mời"
                        description="Email này sẽ không thể dùng link mời cũ để vào workspace nữa."
                        onConfirm={() => handleCancelInvitation(record.id)}
                        okText="Hủy lời mời"
                        cancelText="Giữ lại"
                        okButtonProps={{ danger: true, loading: isCancelingInvitation }}
                    >
                        <Button danger type="text" icon={<Trash2 size={16} />} />
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    if (wsLoading || meLoading) {
        return (
            <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--color-bg-soft)' }}>
                <Spin size="large" />
            </div>
        );
    }

    return (
        <AppLayout headerTitle="Đội ngũ hỗ trợ (Teams)">
            <Head><title>Quản lý thành viên | NemarkChat</title></Head>

            <main className="enterprise-page">
                <div className="enterprise-container" style={{ paddingTop: 24 }}>
                    <section className="enterprise-section" style={{ padding: 24 }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                            <div>
                                <span className="enterprise-kicker">
                                    <span style={{ width: 7, height: 7, borderRadius: 999, background: canManage ? '#12b76a' : '#f79009' }} />
                                    {canManage ? 'Bạn có quyền quản trị đội ngũ' : 'Bạn đang ở quyền xem'}
                                </span>
                                <h1 style={{ margin: '12px 0 8px', fontSize: 30, fontWeight: 950, color: 'var(--ent-text)' }}>
                                    {workspace?.name ? `Đội ngũ ${workspace.name}` : 'Đội ngũ hỗ trợ'}
                                </h1>
                                <p style={{ color: 'var(--ent-text-muted)', fontSize: 14, margin: 0 }}>
                                    Chia sẻ workspace cho bất kỳ tài khoản nào, kể cả khi họ đang sở hữu workspace riêng. Dữ liệu, gói thuê và cấu hình của từng workspace vẫn tách biệt.
                                </p>
                            </div>
                            {canManage && (
                                <Button
                                    type="primary"
                                    icon={<Plus size={16} />}
                                    onClick={() => setIsInviteModalOpen(true)}
                                    style={{ height: 40, borderRadius: 10, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6 }}
                                >
                                    Chia sẻ workspace
                                </Button>
                            )}
                        </div>
                    </section>

                    <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginTop: 16 }}>
                        {[
                            { label: 'Tổng thành viên', value: teamStats.total, hint: `${filteredMembers.length} đang hiển thị`, icon: Users, color: '#4f46e5', bg: '#eef2ff' },
                            { label: 'Quản trị', value: teamStats.ownerAdmin, hint: 'Owner và admin', icon: ShieldCheck, color: '#dc2626', bg: '#fef2f2' },
                            { label: 'Agent hỗ trợ', value: teamStats.agents, hint: 'Có thể trả lời inbox', icon: Headphones, color: '#0369a1', bg: '#e0f2fe' },
                            { label: 'Chỉ xem', value: teamStats.viewers, hint: 'Theo dõi vận hành', icon: Eye, color: '#0f766e', bg: '#ecfdf5' },
                        ].map((item) => {
                            const Icon = item.icon;
                            return (
                                <div key={item.label} className="enterprise-section" style={{ padding: 18, display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                                    <div>
                                        <div style={{ fontSize: 12, color: 'var(--ent-text-muted)', fontWeight: 850, textTransform: 'uppercase', letterSpacing: 0 }}>{item.label}</div>
                                        <div style={{ marginTop: 8, fontSize: 24, fontWeight: 950, color: 'var(--ent-text)' }}>{item.value}</div>
                                        <div style={{ marginTop: 6, fontSize: 12, color: 'var(--ent-text-muted)', fontWeight: 650 }}>{item.hint}</div>
                                    </div>
                                    <div style={{ width: 42, height: 42, borderRadius: 10, display: 'grid', placeItems: 'center', background: item.bg, color: item.color, flexShrink: 0 }}>
                                        <Icon size={20} />
                                    </div>
                                </div>
                            );
                        })}
                    </section>

                    {canManage && (
                        <section className="enterprise-section" style={{ marginTop: 16, overflow: 'hidden' }}>
                            <div style={{ padding: 18, borderBottom: '1px solid var(--ent-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <div style={{ width: 38, height: 38, borderRadius: 12, background: '#fff7ed', color: '#f97316', display: 'grid', placeItems: 'center' }}>
                                        <Clock3 size={18} />
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 900, color: 'var(--ent-text)' }}>Lời mời đang chờ</div>
                                        <div style={{ fontSize: 13, color: 'var(--ent-text-muted)' }}>
                                            Thành viên chưa cần có tài khoản sẵn. Hệ thống gửi email SMTP, họ click link rồi đăng nhập/đăng ký để vào workspace.
                                        </div>
                                    </div>
                                </div>
                                <Tag color="gold">{invitations.length} lời mời</Tag>
                            </div>
                            <Table
                                dataSource={invitations}
                                columns={invitationColumns}
                                rowKey={(record) => record.id}
                                loading={invitationsLoading}
                                pagination={false}
                                locale={{
                                    emptyText: (
                                        <div style={{ padding: 28, color: 'var(--ent-text-muted)' }}>
                                            Chưa có lời mời nào đang chờ.
                                        </div>
                                    ),
                                }}
                            />
                        </section>
                    )}

                    <section className="enterprise-section" style={{ marginTop: 16, overflow: 'hidden' }}>
                        <div style={{ padding: 18, borderBottom: '1px solid var(--ent-border)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                            <Input
                                allowClear
                                prefix={<Search size={15} color="#94a3b8" />}
                                placeholder="Tìm tên, email, vai trò..."
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                style={{ height: 40, borderRadius: 10, maxWidth: 360 }}
                            />
                            <Select
                                value={roleFilter}
                                onChange={setRoleFilter}
                                style={{ width: 180 }}
                                options={[
                                    { value: 'all', label: 'Mọi vai trò' },
                                    { value: 'owner', label: 'Chủ sở hữu' },
                                    { value: 'admin', label: 'Quản trị viên' },
                                    { value: 'agent', label: 'Nhân viên hỗ trợ' },
                                    { value: 'member', label: 'Thành viên' },
                                ]}
                            />
                        </div>
                        <Table
                            dataSource={filteredMembers}
                            columns={columns}
                            rowKey={(record) => memberId(record)}
                            loading={membersLoading}
                            pagination={false}
                            locale={{
                                emptyText: (
                                    <div style={{ padding: 34 }}>
                                        <UserRoundCheck size={36} color="#94a3b8" />
                                        <div style={{ marginTop: 10, fontWeight: 850, color: 'var(--ent-text)' }}>Chưa tìm thấy thành viên phù hợp</div>
                                        <div style={{ color: 'var(--ent-text-muted)', marginTop: 4 }}>Thử đổi bộ lọc hoặc mời thêm thành viên mới.</div>
                                    </div>
                                ),
                            }}
                        />
                    </section>
                </div>
            </main>

            <Modal
                title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Users size={20} className="text-primary" />
                        <span>Chia sẻ workspace</span>
                    </div>
                }
                open={isInviteModalOpen}
                onCancel={() => { setIsInviteModalOpen(false); form.resetFields(); }}
                footer={null}
                destroyOnClose
            >
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleInvite}
                    initialValues={{ role: 'agent' }}
                    style={{ marginTop: 24 }}
                >
                    <Alert
                        type="info"
                        showIcon
                        style={{ marginBottom: 18, borderRadius: 12 }}
                        message="Cấp quyền theo workspace — không ảnh hưởng workspace riêng"
                        description="Nếu email đã có tài khoản NemarkChat, họ được thêm ngay vào workspace này và vẫn giữ nguyên workspace riêng. Nếu chưa có tài khoản, hệ thống gửi email Join để họ đăng ký/đăng nhập rồi tự nhận đúng quyền."
                    />

                    <Form.Item
                        name="email"
                        label="Email tài khoản cần cấp quyền"
                        rules={[
                            { required: true, message: 'Vui lòng nhập email!' },
                            { type: 'email', message: 'Email không hợp lệ!' },
                        ]}
                    >
                        <Input prefix={<Mail size={16} className="text-muted" />} placeholder="Nhập email; tài khoản đã có workspace riêng vẫn dùng được" size="large" />
                    </Form.Item>

                    <Form.Item
                        name="role"
                        label="Vai trò"
                        rules={[{ required: true, message: 'Vui lòng chọn vai trò!' }]}
                    >
                        <Select size="large">
                            <Select.Option value="admin">Quản trị viên (Toàn quyền)</Select.Option>
                            <Select.Option value="agent">Nhân viên hỗ trợ (Chỉ trả lời tin nhắn)</Select.Option>
                            <Select.Option value="member">Thành viên (Chỉ xem)</Select.Option>
                        </Select>
                    </Form.Item>

                    <Form.Item style={{ marginBottom: 0, marginTop: 32, textAlign: 'right' }}>
                        <Space>
                            <Button onClick={() => setIsInviteModalOpen(false)} size="large">Hủy</Button>
                            <Button type="primary" htmlType="submit" loading={isAdding} size="large">
                                Cấp quyền truy cập
                            </Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Modal>
        </AppLayout>
    );
}
