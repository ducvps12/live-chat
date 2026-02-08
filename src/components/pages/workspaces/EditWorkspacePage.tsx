import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { message, Button, Card, Spin, Tabs, Input, Select, Switch } from 'antd';
import { WorkspaceService } from '@/services/workspace.service';
import { WorkspaceWithMembership, WorkspaceMember, PendingInvite } from '@/types/workspace';
import { Avatar, Table, Tag, Popconfirm, Tooltip } from 'antd'; // Added UI components
import api from '@/lib/http';
import { useMyStore } from '@/contexts/MyStoreContext';

interface WidgetData {
    widgetId: string;
    widgetKey: number;
    siteKey: string;
    name: string;
    allowedDomains: string[];
    theme: {
        mainColor?: string;
        position?: 'br' | 'bl';
        welcomeMessage?: string;
    };
    status: number;
}

interface InboxSettings {
    assignmentMode: 'auto' | 'manual';
    strategy: 'round-robin' | 'least-busy';
    onlineOnly: boolean;
    workingHours: { type: 'business' | '24/7' | 'custom'; };
    afterHoursMessage: string;
    notifications: { newConversation: boolean; assigned: boolean; sound: boolean; };
}

const DEFAULT_INBOX_SETTINGS: InboxSettings = {
    assignmentMode: 'auto',
    strategy: 'round-robin',
    onlineOnly: true,
    workingHours: { type: 'business' },
    afterHoursMessage: 'Hiện tại chúng tôi đang ngoài giờ làm việc.',
    notifications: { newConversation: true, assigned: true, sound: true },
};

interface EditWorkspacePageProps {
    workspaceId: string;
}

export const EditWorkspacePage: React.FC<EditWorkspacePageProps> = ({ workspaceId }) => {
    const router = useRouter();
    const { activeWorkspace, setActiveWorkspace } = useMyStore();

    const [loading, setLoading] = useState(true);
    const [workspace, setWorkspace] = useState<WorkspaceWithMembership | null>(null);
    const [saving, setSaving] = useState(false);

    // General state
    const [editName, setEditName] = useState('');

    // Widget state
    const [widgets, setWidgets] = useState<WidgetData[]>([]);
    const [selectedWidget, setSelectedWidget] = useState<WidgetData | null>(null);
    const [widgetName, setWidgetName] = useState('');
    const [widgetDomains, setWidgetDomains] = useState('');
    const [widgetColor, setWidgetColor] = useState('#6366F1');
    const [widgetPosition, setWidgetPosition] = useState<'br' | 'bl'>('br');
    const [welcomeMessage, setWelcomeMessage] = useState('');

    // Inbox state
    const [inboxSettings, setInboxSettings] = useState<InboxSettings>(DEFAULT_INBOX_SETTINGS);
    const [activeTab, setActiveTab] = useState('general');

    // Members state
    const [members, setMembers] = useState<WorkspaceMember[]>([]);
    const [invites, setInvites] = useState<PendingInvite[]>([]);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState('Agent');
    const [loadingMembers, setLoadingMembers] = useState(false);

    const fetchWorkspaceDetails = useCallback(async (silent = false) => {
        try {
            if (!silent) setLoading(true);
            // 1. Fetch workspace info
            const wsData = await WorkspaceService.getDetails(workspaceId);
            setWorkspace(wsData);
            setEditName(wsData.name);

            // 2. Fetch widgets
            try {
                const res = await api.get(`/workspaces/${workspaceId}/widgets`);
                const widgetsList = res.data?.data?.widgets || [];
                setWidgets(widgetsList);
                if (widgetsList.length > 0) {
                    const w = widgetsList[0];
                    setSelectedWidget(w);
                    setWidgetName(w.name);
                    setWidgetDomains(w.allowedDomains.join(', '));
                    setWidgetColor(w.theme?.mainColor || '#6366F1');
                    setWidgetPosition(w.theme?.position || 'br');
                    setWelcomeMessage(w.theme?.welcomeMessage || '');
                }
            } catch (e) {
                console.error('Failed to load widgets', e);
            }

            // 3. Load inbox settings
            if (wsData.settings && wsData.settings.inbox) {
                const incoming = wsData.settings.inbox;
                setInboxSettings({
                    ...DEFAULT_INBOX_SETTINGS,
                    ...incoming,
                    workingHours: {
                        ...DEFAULT_INBOX_SETTINGS.workingHours,
                        ...(incoming.workingHours || {})
                    },
                    notifications: {
                        ...DEFAULT_INBOX_SETTINGS.notifications,
                        ...(incoming.notifications || {})
                    }
                });
            } else {
                const stored = localStorage.getItem(`inbox_settings_${workspaceId}`);
                if (stored) {
                    try {
                        const parsed = JSON.parse(stored);
                        setInboxSettings({
                            ...DEFAULT_INBOX_SETTINGS,
                            ...parsed,
                            workingHours: {
                                ...DEFAULT_INBOX_SETTINGS.workingHours,
                                ...(parsed.workingHours || {})
                            },
                            notifications: {
                                ...DEFAULT_INBOX_SETTINGS.notifications,
                                ...(parsed.notifications || {})
                            }
                        });
                    } catch (e) {
                        setInboxSettings(DEFAULT_INBOX_SETTINGS);
                    }
                } else {
                    setInboxSettings(DEFAULT_INBOX_SETTINGS);
                }
            }

        } catch (error) {
            console.error('Failed to load workspace details:', error);
            message.error('Failed to load workspace details');
            router.push('/workspace/workspaces');
        } finally {
            if (!silent) setLoading(false);
        }
    }, [workspaceId, router]);

    useEffect(() => {
        if (workspaceId) {
            fetchWorkspaceDetails();
        }
    }, [fetchWorkspaceDetails, workspaceId]);

    // Save Handlers
    const handleSaveGeneral = async () => {
        if (!workspace || !editName.trim()) return;
        setSaving(true);
        try {
            await WorkspaceService.update(workspace.workspaceId, { name: editName.trim() });
            message.success('Workspace name updated');

            // Update context if current workspace
            if (activeWorkspace?.workspaceId === workspace.workspaceId) {
                setActiveWorkspace({ ...activeWorkspace, name: editName.trim() });
            }

            // Refetch to keep state fresh
            fetchWorkspaceDetails(true);
        } catch (error: any) {
            message.error(error.response?.data?.message || 'Failed to save');
        } finally {
            setSaving(false);
        }
    };

    const handleSaveWidget = async () => {
        if (!workspace || !selectedWidget) return;
        setSaving(true);
        try {
            const domains = widgetDomains.split(',').map(d => d.trim()).filter(Boolean);
            await api.patch(`/workspaces/${workspace.workspaceId}/widgets/${selectedWidget.widgetId}`, {
                name: widgetName,
                allowedDomains: domains,
                theme: { mainColor: widgetColor, position: widgetPosition, welcomeMessage },
            });
            message.success('Widget settings saved');
        } catch (error: any) {
            message.error(error.response?.data?.message || 'Failed to save widget');
        } finally {
            setSaving(false);
        }
    };

    const handleSaveInbox = async () => {
        if (!workspace) return;
        setSaving(true);
        try {
            const newSettings = {
                ...(workspace.settings || {}),
                inbox: inboxSettings
            };

            await WorkspaceService.update(workspace.workspaceId, {
                settings: newSettings
            });
            message.success('Inbox settings saved');

            setWorkspace(prev => prev ? { ...prev, settings: newSettings } : null);
        } catch (error: any) {
            message.error(error.response?.data?.message || 'Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    const fetchMembersAndInvites = useCallback(async () => {
        if (!workspaceId) return;
        setLoadingMembers(true);
        try {
            const [m, i] = await Promise.all([
                WorkspaceService.listMembers(workspaceId),
                WorkspaceService.listInvites(workspaceId)
            ]);
            setMembers(m);
            setInvites(i);
        } catch (error) {
            console.error('Failed to load members', error);
        } finally {
            setLoadingMembers(false);
        }
    }, [workspaceId]);

    useEffect(() => {
        if (activeTab === 'members') {
            fetchMembersAndInvites();
        }
    }, [activeTab, fetchMembersAndInvites]);

    const handleInvite = async () => {
        if (!inviteEmail.trim()) return;
        setSaving(true);
        try {
            await WorkspaceService.inviteMember(workspaceId, {
                email: inviteEmail.trim(),
                role: inviteRole
            });
            message.success('Invite sent successfully');
            setInviteEmail('');
            fetchMembersAndInvites();
        } catch (error: any) {
            message.error(error.response?.data?.message || 'Failed to send invite');
        } finally {
            setSaving(false);
        }
    };

    const handleRevoke = async (inviteKey: number) => {
        try {
            await WorkspaceService.revokeInvite(workspaceId, inviteKey);
            message.success('Invite revoked');
            setInvites(prev => prev.filter(i => i.inviteKey !== inviteKey));
        } catch (error) {
            message.error('Failed to revoke invite');
        }
    };

    const handleResend = async (inviteKey: number) => {
        try {
            await WorkspaceService.resendInvite(workspaceId, inviteKey);
            message.success('Invite resent successfully');
        } catch (error: any) {
            message.error(error.response?.data?.message || 'Failed to resend invite');
        }
    };

    const handleRemoveMember = async (membershipKey: number) => {
        try {
            await WorkspaceService.removeMember(workspaceId, membershipKey);
            message.success('Member removed');
            setMembers(prev => prev.filter(m => m.membershipKey !== membershipKey));
        } catch (error) {
            message.error('Failed to remove member');
        }
    };

    if (loading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <Spin size="large" />
            </div>
        );
    }

    if (!workspace) return null;

    const tabItems = [
        {
            key: 'general',
            label: 'General',
            children: (
                <div className="max-w-xl space-y-6 pt-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Workspace Name</label>
                        <Input value={editName} onChange={(e) => setEditName(e.target.value)} size="large" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Workspace ID</label>
                        <Input value={workspace.workspaceId} disabled className="font-mono text-sm bg-neutral-50" />
                    </div>
                    <div className="pt-2">
                        <Button type="primary" onClick={handleSaveGeneral} loading={saving}>Save Changes</Button>
                    </div>
                </div>
            ),
        },
        {
            key: 'widget',
            label: 'Widget',
            children: widgets.length === 0 ? (
                <div className="pt-4">
                    <div className="text-center py-8 mb-6 text-neutral-500 bg-neutral-50 rounded-lg border border-dashed border-neutral-200">
                        <p className="mb-2">No widgets configured for this workspace.</p>
                        <p className="text-sm text-neutral-400">Create a widget to start receiving live chat messages.</p>
                    </div>

                    {/* Inline Create Widget Form */}
                    <div className="max-w-xl space-y-6 bg-white rounded-lg border border-neutral-200 p-6">
                        <h3 className="font-semibold text-lg">Create New Widget</h3>

                        <div>
                            <label className="block text-sm font-medium mb-1">Widget Name *</label>
                            <Input
                                value={widgetName}
                                onChange={(e) => setWidgetName(e.target.value)}
                                placeholder="e.g., Support Chat"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Allowed Domains</label>
                            <Input
                                value={widgetDomains}
                                onChange={(e) => setWidgetDomains(e.target.value)}
                                placeholder="example.com, *.example.com (use * for all)"
                            />
                            <p className="text-xs text-neutral-500 mt-1">Comma separated. Use * to allow all domains.</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Main Color</label>
                                <div className="flex gap-2">
                                    <Input type="color" value={widgetColor} onChange={(e) => setWidgetColor(e.target.value)} className="w-12 p-1 h-9" />
                                    <Input value={widgetColor} onChange={(e) => setWidgetColor(e.target.value)} className="flex-1" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Position</label>
                                <Select value={widgetPosition} onChange={setWidgetPosition} className="w-full">
                                    <Select.Option value="br">Bottom Right</Select.Option>
                                    <Select.Option value="bl">Bottom Left</Select.Option>
                                </Select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Welcome Message</label>
                            <Input.TextArea
                                value={welcomeMessage}
                                onChange={(e) => setWelcomeMessage(e.target.value)}
                                rows={3}
                                placeholder="Hello! How can we help you today?"
                            />
                        </div>

                        <div className="pt-2">
                            <Button
                                type="primary"
                                loading={saving}
                                disabled={!widgetName.trim()}
                                onClick={async () => {
                                    if (!widgetName.trim()) {
                                        message.warning('Please enter a widget name');
                                        return;
                                    }
                                    setSaving(true);
                                    try {
                                        const domains = widgetDomains.split(',').map(d => d.trim()).filter(Boolean);
                                        await api.post(`/workspaces/${workspaceId}/widgets`, {
                                            name: widgetName.trim(),
                                            allowedDomains: domains.length > 0 ? domains : ['*'],
                                            theme: {
                                                color: widgetColor,
                                                position: widgetPosition
                                            }
                                        });
                                        message.success('Widget created successfully!');

                                        // Reset form for next creation
                                        setWidgetName('');
                                        setWidgetDomains('');
                                        setWidgetColor('#6366F1');
                                        setWidgetPosition('br');
                                        setWelcomeMessage('');
                                    } catch (error: any) {
                                        message.error(error.response?.data?.message || 'Failed to create widget');
                                    } finally {
                                        setSaving(false);
                                    }
                                }}
                            >
                                Create Widget
                            </Button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-4">
                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium mb-1">Widget Name</label>
                            <Input value={widgetName} onChange={(e) => setWidgetName(e.target.value)} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Allowed Domains</label>
                            <Input
                                value={widgetDomains}
                                onChange={(e) => setWidgetDomains(e.target.value)}
                                placeholder="example.com, *"
                                addonAfter={<span className="text-xs text-neutral-400">Comma separated</span>}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Main Color</label>
                                <div className="flex gap-2">
                                    <Input type="color" value={widgetColor} onChange={(e) => setWidgetColor(e.target.value)} className="w-12 p-1 h-9" />
                                    <Input value={widgetColor} onChange={(e) => setWidgetColor(e.target.value)} className="flex-1" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Position</label>
                                <Select value={widgetPosition} onChange={setWidgetPosition} className="w-full">
                                    <Select.Option value="br">Bottom Right</Select.Option>
                                    <Select.Option value="bl">Bottom Left</Select.Option>
                                </Select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Welcome Message</label>
                            <Input.TextArea
                                value={welcomeMessage}
                                onChange={(e) => setWelcomeMessage(e.target.value)}
                                rows={3}
                                placeholder="Hello! How can we help you?"
                            />
                        </div>

                        <div className="pt-2">
                            <Button type="primary" onClick={handleSaveWidget} loading={saving}>Save Widget Settings</Button>
                        </div>
                    </div>

                    <div className="bg-neutral-50 p-6 rounded-lg border border-neutral-200 h-fit">
                        <h3 className="font-semibold mb-4">Installation</h3>
                        <p className="text-sm text-neutral-600 mb-2">Copy this code and paste it before the closing <code>&lt;/body&gt;</code> tag of your website.</p>

                        <div className="relative group">
                            <pre className="bg-neutral-900 text-green-400 p-4 rounded text-xs overflow-x-auto font-mono whitespace-pre-wrap break-all">
                                {`<script 
  async 
  src="${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/embed/widget.js" 
  data-site-key="${selectedWidget?.siteKey}" 
  data-api-base="${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}"
></script>`}
                            </pre>
                            <Button
                                size="small"
                                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => {
                                    navigator.clipboard.writeText(`<script async src="${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/embed/widget.js" data-site-key="${selectedWidget?.siteKey}" data-api-base="${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}"></script>`);
                                    message.success('Copied to clipboard');
                                }}
                            >
                                Copy
                            </Button>
                        </div>
                    </div>
                </div>
            ),
        },
        {
            key: 'members',
            label: 'Members',
            children: (
                <div className="max-w-4xl space-y-8 pt-4">
                    {/* Invite Section */}
                    <div className="bg-white rounded-lg border border-neutral-200 p-6">
                        <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
                            <span className="material-symbols-outlined text-neutral-500">person_add</span>
                            Invite New Member
                        </h3>
                        <div className="flex gap-4 items-end">
                            <div className="flex-1">
                                <label className="block text-sm font-medium mb-1">Email Address</label>
                                <Input
                                    value={inviteEmail}
                                    onChange={e => setInviteEmail(e.target.value)}
                                    placeholder="colleague@example.com"
                                />
                            </div>
                            <div className="w-40">
                                <label className="block text-sm font-medium mb-1">Role</label>
                                <Select value={inviteRole} onChange={setInviteRole} className="w-full">
                                    <Select.Option value="Admin">Admin</Select.Option>
                                    <Select.Option value="Agent">Agent</Select.Option>
                                    <Select.Option value="Viewer">Viewer</Select.Option>
                                </Select>
                            </div>
                            <Button type="primary" onClick={handleInvite} loading={saving} disabled={!inviteEmail}>
                                Send Invite
                            </Button>
                        </div>
                    </div>

                    {/* Pending Invites */}
                    {invites.length > 0 && (
                        <div className="bg-white rounded-lg border border-neutral-200 p-6">
                            <h3 className="text-base font-semibold mb-4 text-orange-600 flex items-center gap-2">
                                <span className="material-symbols-outlined">mail</span>
                                Pending Invites
                            </h3>
                            <div className="space-y-2">
                                {invites.map(invite => (
                                    <div key={invite.inviteKey} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-100">
                                        <div className="flex items-center gap-3">
                                            <Avatar className="bg-orange-200 text-orange-700">{invite.email[0].toUpperCase()}</Avatar>
                                            <div>
                                                <div className="font-medium text-neutral-900">{invite.email}</div>
                                                <div className="text-xs text-orange-600">Invited as {invite.role} • {new Date(invite.createdAt).toLocaleDateString()}</div>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button size="small" type="default" onClick={() => handleResend(invite.inviteKey)}>📧 Resend</Button>
                                            <Button size="small" danger type="text" onClick={() => handleRevoke(invite.inviteKey)}>Revoke</Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Members List */}
                    <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
                        <div className="p-6 border-b border-neutral-200 flex justify-between items-center">
                            <h3 className="text-base font-semibold flex items-center gap-2">
                                <span className="material-symbols-outlined text-neutral-500">group</span>
                                Team Members ({members.length})
                            </h3>
                            <Button type="text" shape="circle" icon={<span className="material-symbols-outlined">refresh</span>} onClick={fetchMembersAndInvites} loading={loadingMembers} />
                        </div>

                        <Table
                            dataSource={members}
                            rowKey="membershipKey"
                            pagination={false}
                            loading={loadingMembers}
                            columns={[
                                {
                                    title: 'Member',
                                    key: 'member',
                                    render: (_, record) => (
                                        <div className="flex items-center gap-3">
                                            <Avatar className="bg-primary-100 text-primary-600">
                                                {record.user.displayName?.[0] || record.user.email[0]}
                                            </Avatar>
                                            <div>
                                                <div className="font-medium">{record.user.displayName || 'No Name'}</div>
                                                <div className="text-xs text-neutral-500">{record.user.email}</div>
                                            </div>
                                        </div>
                                    )
                                },
                                {
                                    title: 'Role',
                                    dataIndex: 'roles',
                                    key: 'roles',
                                    render: (roles: string[]) => (
                                        <Tag color={roles.includes('Owner') ? 'gold' : roles.includes('Admin') ? 'blue' : 'default'} className="rounded-full px-3">
                                            {roles.join(', ')}
                                        </Tag>
                                    )
                                },
                                {
                                    title: 'Status',
                                    key: 'status',
                                    render: (_, record) => (
                                        <span className="flex items-center gap-1.5 text-xs text-green-600 font-medium">
                                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                                            Active
                                        </span>
                                    )
                                },
                                {
                                    title: 'Actions',
                                    key: 'actions',
                                    render: (_, record) => (
                                        !record.roles.includes('Owner') && workspace?.membership?.role === 'Owner' ? (
                                            <Popconfirm title="Remove member?" onConfirm={() => handleRemoveMember(record.membershipKey)}>
                                                <Button type="text" danger size="small">Remove</Button>
                                            </Popconfirm>
                                        ) : null
                                    )
                                }
                            ]}
                        />
                    </div>
                </div>
            ),
        },
        {
            key: 'inbox',
            label: 'Inbox Settings',
            children: (
                <div className="max-w-2xl space-y-8 pt-4">
                    {/* Assignment */}
                    <div className="bg-white rounded-lg border border-neutral-200 p-6">
                        <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
                            <span className="material-symbols-outlined text-neutral-500">assignment_ind</span>
                            Assignment
                        </h3>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between pb-4 border-b border-neutral-100">
                                <div>
                                    <div className="font-medium">Auto Assignment</div>
                                    <div className="text-sm text-neutral-500">Automatically assign new conversations to agents</div>
                                </div>
                                <Switch
                                    checked={inboxSettings.assignmentMode === 'auto'}
                                    onChange={(c) => setInboxSettings({ ...inboxSettings, assignmentMode: c ? 'auto' : 'manual' })}
                                />
                            </div>

                            {inboxSettings.assignmentMode === 'auto' && (
                                <div className="pl-4 border-l-2 border-neutral-100">
                                    <label className="block text-sm font-medium mb-2">Assignment Strategy</label>
                                    <Select
                                        value={inboxSettings.strategy}
                                        onChange={(v) => setInboxSettings({ ...inboxSettings, strategy: v })}
                                        className="w-full max-w-xs"
                                    >
                                        <Select.Option value="round-robin">Round Robin (Equal distribution)</Select.Option>
                                        <Select.Option value="least-busy">Least Busy (Balanced load)</Select.Option>
                                    </Select>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Availability */}
                    <div className="bg-white rounded-lg border border-neutral-200 p-6">
                        <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
                            <span className="material-symbols-outlined text-neutral-500">schedule</span>
                            Availability
                        </h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-2">Working Hours</label>
                                <Select
                                    value={inboxSettings.workingHours.type}
                                    onChange={(v) => setInboxSettings({ ...inboxSettings, workingHours: { type: v } })}
                                    className="w-full max-w-xs mb-4"
                                >
                                    <Select.Option value="24/7">24/7 Always Open</Select.Option>
                                    <Select.Option value="business">Business Hours (Mon-Fri, 9AM-5PM)</Select.Option>
                                </Select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2">After Hours Message</label>
                                <Input.TextArea
                                    value={inboxSettings.afterHoursMessage}
                                    onChange={(e) => setInboxSettings({ ...inboxSettings, afterHoursMessage: e.target.value })}
                                    rows={3}
                                />
                                <p className="text-xs text-neutral-500 mt-1">Sent automatically when a customer messages outside working hours.</p>
                            </div>
                        </div>
                    </div>

                    {/* Notifications */}
                    <div className="bg-white rounded-lg border border-neutral-200 p-6">
                        <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
                            <span className="material-symbols-outlined text-neutral-500">notifications</span>
                            Notifications
                        </h3>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-sm">New conversation alerts</span>
                                <Switch
                                    checked={inboxSettings.notifications.newConversation}
                                    onChange={(c) => setInboxSettings({ ...inboxSettings, notifications: { ...inboxSettings.notifications, newConversation: c } })}
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm">Assignment alerts</span>
                                <Switch
                                    checked={inboxSettings.notifications.assigned}
                                    onChange={(c) => setInboxSettings({ ...inboxSettings, notifications: { ...inboxSettings.notifications, assigned: c } })}
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm">Sound effects</span>
                                <Switch
                                    checked={inboxSettings.notifications.sound}
                                    onChange={(c) => setInboxSettings({ ...inboxSettings, notifications: { ...inboxSettings.notifications, sound: c } })}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="pt-4">
                        <Button type="primary" onClick={handleSaveInbox} loading={saving}>Save Inbox Settings</Button>
                    </div>
                </div>
            ),
        },
    ];

    return (
        <div className="max-w-6xl mx-auto py-6">
            <div className="flex items-center gap-4 mb-6">
                <Button
                    type="text"
                    icon={<span className="material-symbols-outlined">arrow_back</span>}
                    onClick={() => router.push('/workspace/workspaces')}
                >
                    Back
                </Button>
                <div>
                    <h1 className="text-2xl font-bold text-neutral-900">Workspace Settings</h1>
                    {workspace && <p className="text-neutral-500">{workspace.name}</p>}
                </div>
            </div>

            <Card className="shadow-sm min-h-[600px]">
                <Tabs
                    activeKey={activeTab}
                    onChange={setActiveTab}
                    items={tabItems}
                    tabPosition="left"
                    className="h-full"
                />
            </Card>
        </div>
    );
};
