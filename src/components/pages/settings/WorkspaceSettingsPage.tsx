import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { message, Tabs, Input, Button, Card, Spin, Select, Switch, TimePicker, InputNumber, ColorPicker } from 'antd';
import { WorkspaceService } from '@/services/workspace.service';
import { useMyStore } from '@/contexts/MyStoreContext';
import { useRouter } from 'next/router';
import api from '@/lib/http';
import dayjs from 'dayjs';

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
    reassignOnOffline: boolean;
    workingHours: {
        type: 'business' | '24/7' | 'custom';
        start?: string;
        end?: string;
    };
    afterHoursMessage: string;
    notifications: {
        newConversation: boolean;
        assigned: boolean;
        sound: boolean;
    };
    reminderMinutes: number;
}

const DEFAULT_INBOX_SETTINGS: InboxSettings = {
    assignmentMode: 'auto',
    strategy: 'round-robin',
    onlineOnly: true,
    reassignOnOffline: true,
    workingHours: {
        type: 'business',
        start: '09:00',
        end: '18:00',
    },
    afterHoursMessage: 'Hiện tại chúng tôi đang ngoài giờ làm việc. Bạn để lại lời nhắn, chúng tôi sẽ phản hồi sớm nhất.',
    notifications: {
        newConversation: true,
        assigned: true,
        sound: true,
    },
    reminderMinutes: 2,
};

export const WorkspaceSettingsPage: React.FC = () => {
    const { t } = useTranslation();
    const router = useRouter();
    const { activeWorkspace, setActiveWorkspace } = useMyStore();

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    // General tab state
    const [workspaceName, setWorkspaceName] = useState('');

    // Widget tab state
    const [widgets, setWidgets] = useState<WidgetData[]>([]);
    const [selectedWidget, setSelectedWidget] = useState<WidgetData | null>(null);
    const [widgetName, setWidgetName] = useState('');
    const [widgetDomains, setWidgetDomains] = useState('');
    const [widgetColor, setWidgetColor] = useState('#6366F1');
    const [widgetPosition, setWidgetPosition] = useState<'br' | 'bl'>('br');
    const [welcomeMessage, setWelcomeMessage] = useState('');

    // Inbox tab state
    const [inboxSettings, setInboxSettings] = useState<InboxSettings>(DEFAULT_INBOX_SETTINGS);

    const workspaceId = activeWorkspace?.workspaceId;

    // Fetch all data
    const fetchData = useCallback(async () => {
        if (!workspaceId) return;

        setLoading(true);
        try {
            // Set workspace name
            setWorkspaceName(activeWorkspace?.name || '');

            // Fetch widgets
            const widgetsRes = await api.get(`/workspaces/${workspaceId}/widgets`);
            const widgetsList = widgetsRes.data?.data?.widgets || [];
            setWidgets(widgetsList);

            if (widgetsList.length > 0) {
                selectWidget(widgetsList[0]);
            }

            // Fetch inbox settings from localStorage (no API yet)
            const storedSettings = localStorage.getItem(`inbox_settings_${workspaceId}`);
            if (storedSettings) {
                setInboxSettings(JSON.parse(storedSettings));
            }
        } catch (error: any) {
            console.error('Failed to fetch settings:', error);
        } finally {
            setLoading(false);
        }
    }, [workspaceId, activeWorkspace?.name]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const selectWidget = (widget: WidgetData) => {
        setSelectedWidget(widget);
        setWidgetName(widget.name);
        setWidgetDomains(widget.allowedDomains.join(', '));
        setWidgetColor(widget.theme?.mainColor || '#6366F1');
        setWidgetPosition(widget.theme?.position || 'br');
        setWelcomeMessage(widget.theme?.welcomeMessage || '');
    };

    // Save General settings
    const handleSaveGeneral = async () => {
        if (!workspaceId || !workspaceName.trim()) return;

        setSaving(true);
        try {
            await WorkspaceService.update(workspaceId, { name: workspaceName.trim() });
            message.success('Workspace settings saved');

            // Update active workspace
            if (activeWorkspace) {
                setActiveWorkspace({
                    ...activeWorkspace,
                    name: workspaceName.trim(),
                });
            }
        } catch (error: any) {
            message.error(error.response?.data?.message || 'Failed to save');
        } finally {
            setSaving(false);
        }
    };

    // Save Widget settings
    const handleSaveWidget = async () => {
        if (!workspaceId || !selectedWidget) return;

        setSaving(true);
        try {
            const domains = widgetDomains.split(',').map(d => d.trim()).filter(Boolean);
            await api.patch(`/workspaces/${workspaceId}/widgets/${selectedWidget.widgetId}`, {
                name: widgetName,
                allowedDomains: domains,
                theme: {
                    mainColor: widgetColor,
                    position: widgetPosition,
                    welcomeMessage: welcomeMessage,
                },
            });
            message.success('Widget settings saved');
            fetchData();
        } catch (error: any) {
            message.error(error.response?.data?.message || 'Failed to save widget');
        } finally {
            setSaving(false);
        }
    };

    // Save Inbox settings (localStorage for now)
    const handleSaveInbox = () => {
        if (!workspaceId) return;

        localStorage.setItem(`inbox_settings_${workspaceId}`, JSON.stringify(inboxSettings));
        message.success('Inbox settings saved');
    };

    if (!workspaceId) {
        return (
            <div className="flex items-center justify-center h-full">
                <p className="text-neutral-500">Please select a workspace</p>
            </div>
        );
    }

    const tabItems = [
        {
            key: 'general',
            label: (
                <span className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-lg">settings</span>
                    General
                </span>
            ),
            children: (
                <div className="space-y-6">
                    <div>
                        <h3 className="text-lg font-semibold text-neutral-900 mb-4">Workspace Information</h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-neutral-700 mb-1">
                                    Workspace Name
                                </label>
                                <Input
                                    value={workspaceName}
                                    onChange={(e) => setWorkspaceName(e.target.value)}
                                    placeholder="My Company"
                                    className="max-w-md"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-neutral-700 mb-1">
                                    Workspace ID
                                </label>
                                <Input
                                    value={workspaceId}
                                    disabled
                                    className="max-w-md font-mono text-sm"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 border-t">
                        <Button type="primary" onClick={handleSaveGeneral} loading={saving}>
                            Save Changes
                        </Button>
                    </div>
                </div>
            ),
        },
        {
            key: 'widget',
            label: (
                <span className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-lg">widgets</span>
                    Widget
                </span>
            ),
            children: (
                <div className="space-y-6">
                    <div>
                        <h3 className="text-lg font-semibold text-neutral-900 mb-4">Chat Widget Settings</h3>

                        {widgets.length === 0 ? (
                            <div className="text-center py-8">
                                <span className="material-symbols-outlined text-5xl text-neutral-300 mb-2">widgets</span>
                                <p className="text-neutral-500">No widgets configured. Create one in Onboarding.</p>
                                <Button type="primary" className="mt-4" onClick={() => router.push('/onboarding?step=3')}>
                                    Create Widget
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {widgets.length > 1 && (
                                    <div>
                                        <label className="block text-sm font-medium text-neutral-700 mb-1">
                                            Select Widget
                                        </label>
                                        <Select
                                            value={selectedWidget?.widgetId}
                                            onChange={(id) => {
                                                const w = widgets.find(w => w.widgetId === id);
                                                if (w) selectWidget(w);
                                            }}
                                            className="w-full max-w-md"
                                        >
                                            {widgets.map(w => (
                                                <Select.Option key={w.widgetId} value={w.widgetId}>{w.name}</Select.Option>
                                            ))}
                                        </Select>
                                    </div>
                                )}

                                <div>
                                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                                        Widget Name
                                    </label>
                                    <Input
                                        value={widgetName}
                                        onChange={(e) => setWidgetName(e.target.value)}
                                        className="max-w-md"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                                        Allowed Domains (comma separated)
                                    </label>
                                    <Input
                                        value={widgetDomains}
                                        onChange={(e) => setWidgetDomains(e.target.value)}
                                        placeholder="example.com, *.example.com"
                                        className="max-w-md"
                                    />
                                    <p className="text-xs text-neutral-500 mt-1">Use * to allow all domains</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                                        Main Color
                                    </label>
                                    <div className="flex items-center gap-3">
                                        <Input
                                            value={widgetColor}
                                            onChange={(e) => setWidgetColor(e.target.value)}
                                            className="w-32"
                                        />
                                        <div
                                            className="w-8 h-8 rounded border"
                                            style={{ backgroundColor: widgetColor }}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                                        Widget Position
                                    </label>
                                    <Select
                                        value={widgetPosition}
                                        onChange={setWidgetPosition}
                                        className="w-48"
                                    >
                                        <Select.Option value="br">Bottom Right</Select.Option>
                                        <Select.Option value="bl">Bottom Left</Select.Option>
                                    </Select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                                        Welcome Message
                                    </label>
                                    <Input.TextArea
                                        value={welcomeMessage}
                                        onChange={(e) => setWelcomeMessage(e.target.value)}
                                        rows={3}
                                        className="max-w-md"
                                        placeholder="Xin chào! Chúng tôi có thể giúp gì cho bạn?"
                                    />
                                </div>

                                <div className="pt-4 border-t">
                                    <Button type="primary" onClick={handleSaveWidget} loading={saving}>
                                        Save Widget Settings
                                    </Button>
                                </div>

                                {/* Embed Code */}
                                <div className="mt-6 p-4 bg-neutral-50 rounded-lg">
                                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                                        Embed Code
                                    </label>
                                    <code className="block p-3 bg-neutral-900 text-green-400 rounded text-xs overflow-x-auto">
                                        {`<script async src="${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/embed/widget.js" data-site-key="${selectedWidget?.siteKey || ''}" data-api-base="${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}"></script>`}
                                    </code>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            ),
        },
        {
            key: 'inbox',
            label: (
                <span className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-lg">inbox</span>
                    Inbox
                </span>
            ),
            children: (
                <div className="space-y-6">
                    <div>
                        <h3 className="text-lg font-semibold text-neutral-900 mb-4">Inbox & Assignment Settings</h3>

                        <div className="space-y-6">
                            {/* Assignment Mode */}
                            <div className="flex items-center justify-between max-w-md">
                                <div>
                                    <p className="font-medium text-neutral-900">Auto Assignment</p>
                                    <p className="text-sm text-neutral-500">Automatically assign conversations to agents</p>
                                </div>
                                <Switch
                                    checked={inboxSettings.assignmentMode === 'auto'}
                                    onChange={(checked) => setInboxSettings({
                                        ...inboxSettings,
                                        assignmentMode: checked ? 'auto' : 'manual',
                                    })}
                                />
                            </div>

                            {inboxSettings.assignmentMode === 'auto' && (
                                <div>
                                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                                        Assignment Strategy
                                    </label>
                                    <Select
                                        value={inboxSettings.strategy}
                                        onChange={(value) => setInboxSettings({ ...inboxSettings, strategy: value })}
                                        className="w-48"
                                    >
                                        <Select.Option value="round-robin">Round Robin</Select.Option>
                                        <Select.Option value="least-busy">Least Busy</Select.Option>
                                    </Select>
                                </div>
                            )}

                            {/* Working Hours */}
                            <div>
                                <label className="block text-sm font-medium text-neutral-700 mb-2">
                                    Working Hours
                                </label>
                                <Select
                                    value={inboxSettings.workingHours.type}
                                    onChange={(value) => setInboxSettings({
                                        ...inboxSettings,
                                        workingHours: { ...inboxSettings.workingHours, type: value },
                                    })}
                                    className="w-48"
                                >
                                    <Select.Option value="24/7">24/7</Select.Option>
                                    <Select.Option value="business">Business Hours (9-18)</Select.Option>
                                    <Select.Option value="custom">Custom</Select.Option>
                                </Select>
                            </div>

                            {/* After Hours Message */}
                            <div>
                                <label className="block text-sm font-medium text-neutral-700 mb-1">
                                    After Hours Message
                                </label>
                                <Input.TextArea
                                    value={inboxSettings.afterHoursMessage}
                                    onChange={(e) => setInboxSettings({
                                        ...inboxSettings,
                                        afterHoursMessage: e.target.value,
                                    })}
                                    rows={2}
                                    className="max-w-md"
                                />
                            </div>

                            {/* Notifications */}
                            <div className="space-y-3">
                                <p className="font-medium text-neutral-900">Notifications</p>

                                <div className="flex items-center justify-between max-w-md">
                                    <span className="text-sm text-neutral-600">New Conversation</span>
                                    <Switch
                                        checked={inboxSettings.notifications.newConversation}
                                        onChange={(checked) => setInboxSettings({
                                            ...inboxSettings,
                                            notifications: { ...inboxSettings.notifications, newConversation: checked },
                                        })}
                                    />
                                </div>

                                <div className="flex items-center justify-between max-w-md">
                                    <span className="text-sm text-neutral-600">When Assigned</span>
                                    <Switch
                                        checked={inboxSettings.notifications.assigned}
                                        onChange={(checked) => setInboxSettings({
                                            ...inboxSettings,
                                            notifications: { ...inboxSettings.notifications, assigned: checked },
                                        })}
                                    />
                                </div>

                                <div className="flex items-center justify-between max-w-md">
                                    <span className="text-sm text-neutral-600">Sound</span>
                                    <Switch
                                        checked={inboxSettings.notifications.sound}
                                        onChange={(checked) => setInboxSettings({
                                            ...inboxSettings,
                                            notifications: { ...inboxSettings.notifications, sound: checked },
                                        })}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 border-t">
                        <Button type="primary" onClick={handleSaveInbox}>
                            Save Inbox Settings
                        </Button>
                    </div>
                </div>
            ),
        },
    ];

    return (
        <Spin spinning={loading}>
            <div className="max-w-4xl mx-auto">
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-neutral-900">
                        Workspace Settings
                    </h1>
                    <p className="text-neutral-500 mt-1">
                        Configure your workspace, widget, and inbox preferences
                    </p>
                </div>

                <Card className="shadow-sm">
                    <Tabs items={tabItems} />
                </Card>
            </div>
        </Spin>
    );
};

export default WorkspaceSettingsPage;
