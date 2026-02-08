import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { message, Modal, Select, Input, Button, Tabs, Table, Tag, Dropdown, Popconfirm, Spin } from 'antd';
import { WorkspaceService } from '@/services/workspace.service';
import { WorkspaceMember, PendingInvite } from '@/types/workspace';
import { useMyStore } from '@/contexts/MyStoreContext';

const { TabPane } = Tabs;

// Available roles (cannot assign Owner)
const ASSIGNABLE_ROLES = ['Admin', 'Agent', 'User'];

export const TeamsPage: React.FC = () => {
    const { t } = useTranslation();
    const { activeWorkspace } = useMyStore();

    const [members, setMembers] = useState<WorkspaceMember[]>([]);
    const [invites, setInvites] = useState<PendingInvite[]>([]);
    const [loading, setLoading] = useState(false);
    const [inviteModalOpen, setInviteModalOpen] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState('Agent');
    const [inviteLoading, setInviteLoading] = useState(false);

    const workspaceId = activeWorkspace?.workspaceId;
    const currentUserRole = activeWorkspace?.membership?.role;
    const isOwner = currentUserRole === 'Owner';

    // Fetch members and invites
    const fetchData = useCallback(async () => {
        if (!workspaceId) return;

        setLoading(true);
        try {
            const [membersData, invitesData] = await Promise.all([
                WorkspaceService.listMembers(workspaceId),
                WorkspaceService.listInvites(workspaceId),
            ]);
            setMembers(membersData);
            setInvites(invitesData);
        } catch (error: any) {
            console.error('Failed to fetch team data:', error);
            if (error.response?.status !== 403) {
                message.error(t('teams.fetchError') || 'Failed to load team data');
            }
        } finally {
            setLoading(false);
        }
    }, [workspaceId, t]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Invite member
    const handleInvite = async () => {
        if (!workspaceId || !inviteEmail.trim()) return;

        setInviteLoading(true);
        try {
            await WorkspaceService.inviteMember(workspaceId, {
                email: inviteEmail.trim().toLowerCase(),
                role: inviteRole,
            });
            message.success(t('teams.inviteSent') || 'Invite sent successfully');
            setInviteModalOpen(false);
            setInviteEmail('');
            setInviteRole('Agent');
            fetchData();
        } catch (error: any) {
            const errorMsg = error.response?.data?.message || t('teams.inviteError') || 'Failed to send invite';
            message.error(errorMsg);
        } finally {
            setInviteLoading(false);
        }
    };

    // Remove member
    const handleRemoveMember = async (membershipKey: number) => {
        if (!workspaceId) return;

        try {
            await WorkspaceService.removeMember(workspaceId, membershipKey);
            message.success(t('teams.memberRemoved') || 'Member removed');
            fetchData();
        } catch (error: any) {
            const errorMsg = error.response?.data?.message || t('teams.removeError') || 'Failed to remove member';
            message.error(errorMsg);
        }
    };

    // Assign role
    const handleAssignRole = async (membershipKey: number, newRole: string) => {
        if (!workspaceId) return;

        try {
            await WorkspaceService.assignRole(workspaceId, membershipKey, newRole);
            message.success(t('teams.roleAssigned') || `Role "${newRole}" assigned`);
            fetchData();
        } catch (error: any) {
            const errorMsg = error.response?.data?.message || t('teams.assignRoleError') || 'Failed to assign role';
            message.error(errorMsg);
        }
    };

    // Revoke invite
    const handleRevokeInvite = async (inviteKey: number) => {
        if (!workspaceId) return;

        try {
            await WorkspaceService.revokeInvite(workspaceId, inviteKey);
            message.success(t('teams.inviteRevoked') || 'Invite revoked');
            fetchData();
        } catch (error: any) {
            const errorMsg = error.response?.data?.message || t('teams.revokeError') || 'Failed to revoke invite';
            message.error(errorMsg);
        }
    };

    // Members table columns
    const memberColumns = [
        {
            title: t('teams.member') || 'Member',
            dataIndex: 'user',
            key: 'user',
            render: (user: WorkspaceMember['user']) => (
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-semibold">
                        {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <div className="font-medium text-neutral-900">{user.displayName || 'Unnamed'}</div>
                        <div className="text-sm text-neutral-500">{user.email}</div>
                    </div>
                </div>
            ),
        },
        {
            title: t('teams.role') || 'Role',
            dataIndex: 'roles',
            key: 'roles',
            render: (roles: string[], record: WorkspaceMember) => {
                const primaryRole = roles[0] || 'User';
                const isTargetOwner = primaryRole === 'Owner';

                if (isOwner && !isTargetOwner) {
                    return (
                        <Select
                            value={primaryRole}
                            onChange={(value) => handleAssignRole(record.membershipKey, value)}
                            style={{ width: 120 }}
                            size="small"
                        >
                            {ASSIGNABLE_ROLES.map(role => (
                                <Select.Option key={role} value={role}>{role}</Select.Option>
                            ))}
                        </Select>
                    );
                }

                return (
                    <Tag color={isTargetOwner ? 'gold' : primaryRole === 'Admin' ? 'blue' : 'default'}>
                        {primaryRole}
                    </Tag>
                );
            },
        },
        {
            title: t('teams.joinedAt') || 'Joined',
            dataIndex: 'joinedAt',
            key: 'joinedAt',
            render: (date: string) => new Date(date).toLocaleDateString(),
        },
        {
            title: t('teams.actions') || 'Actions',
            key: 'actions',
            render: (_: any, record: WorkspaceMember) => {
                const isTargetOwner = record.roles.includes('Owner');

                if (!isOwner || isTargetOwner) return null;

                return (
                    <Popconfirm
                        title={t('teams.confirmRemove') || 'Remove this member?'}
                        onConfirm={() => handleRemoveMember(record.membershipKey)}
                        okText={t('common.yes') || 'Yes'}
                        cancelText={t('common.no') || 'No'}
                    >
                        <Button type="text" danger size="small">
                            {t('teams.remove') || 'Remove'}
                        </Button>
                    </Popconfirm>
                );
            },
        },
    ];

    // Invites table columns
    const inviteColumns = [
        {
            title: t('teams.email') || 'Email',
            dataIndex: 'email',
            key: 'email',
        },
        {
            title: t('teams.role') || 'Role',
            dataIndex: 'role',
            key: 'role',
            render: (role: string) => <Tag>{role}</Tag>,
        },
        {
            title: t('teams.invitedBy') || 'Invited By',
            dataIndex: 'invitedBy',
            key: 'invitedBy',
        },
        {
            title: t('teams.expiresAt') || 'Expires',
            dataIndex: 'expiresAt',
            key: 'expiresAt',
            render: (date: string) => new Date(date).toLocaleDateString(),
        },
        {
            title: t('teams.actions') || 'Actions',
            key: 'actions',
            render: (_: any, record: PendingInvite) => {
                if (!isOwner) return null;

                return (
                    <Popconfirm
                        title={t('teams.confirmRevoke') || 'Revoke this invite?'}
                        onConfirm={() => handleRevokeInvite(record.inviteKey)}
                        okText={t('common.yes') || 'Yes'}
                        cancelText={t('common.no') || 'No'}
                    >
                        <Button type="text" danger size="small">
                            {t('teams.revoke') || 'Revoke'}
                        </Button>
                    </Popconfirm>
                );
            },
        },
    ];

    if (!workspaceId) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-neutral-500">
                    {t('teams.noWorkspace') || 'Please select a workspace'}
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-neutral-900">
                        {t('teams.title') || 'Team Management'}
                    </h1>
                    <p className="text-neutral-500 mt-1">
                        {t('teams.subtitle') || 'Manage your workspace members and invites'}
                    </p>
                </div>

                {isOwner && (
                    <Button type="primary" onClick={() => setInviteModalOpen(true)}>
                        <span className="material-symbols-outlined text-lg mr-1">person_add</span>
                        {t('teams.inviteMember') || 'Invite Member'}
                    </Button>
                )}
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-neutral-200">
                <Tabs defaultActiveKey="members" className="px-4">
                    <TabPane tab={`${t('teams.members') || 'Members'} (${members.length})`} key="members">
                        <Spin spinning={loading}>
                            <Table
                                dataSource={members}
                                columns={memberColumns}
                                rowKey="membershipKey"
                                pagination={false}
                                className="mt-2"
                            />
                        </Spin>
                    </TabPane>

                    <TabPane tab={`${t('teams.pendingInvites') || 'Pending Invites'} (${invites.length})`} key="invites">
                        <Spin spinning={loading}>
                            <Table
                                dataSource={invites}
                                columns={inviteColumns}
                                rowKey="inviteKey"
                                pagination={false}
                                className="mt-2"
                                locale={{ emptyText: t('teams.noInvites') || 'No pending invites' }}
                            />
                        </Spin>
                    </TabPane>
                </Tabs>
            </div>

            {/* Invite Modal */}
            <Modal
                title={t('teams.inviteMember') || 'Invite Member'}
                open={inviteModalOpen}
                onCancel={() => setInviteModalOpen(false)}
                onOk={handleInvite}
                confirmLoading={inviteLoading}
                okText={t('teams.sendInvite') || 'Send Invite'}
            >
                <div className="space-y-4 py-4">
                    <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-1">
                            {t('teams.emailLabel') || 'Email Address'}
                        </label>
                        <Input
                            type="email"
                            placeholder="email@example.com"
                            value={inviteEmail}
                            onChange={(e) => setInviteEmail(e.target.value)}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-1">
                            {t('teams.roleLabel') || 'Role'}
                        </label>
                        <Select
                            value={inviteRole}
                            onChange={setInviteRole}
                            style={{ width: '100%' }}
                        >
                            {ASSIGNABLE_ROLES.map(role => (
                                <Select.Option key={role} value={role}>{role}</Select.Option>
                            ))}
                        </Select>
                        <p className="text-xs text-neutral-500 mt-1">
                            {t('teams.roleHint') || 'Owner role cannot be assigned via invite'}
                        </p>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default TeamsPage;
