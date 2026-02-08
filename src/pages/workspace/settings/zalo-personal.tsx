import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button, Card, Modal, Tag, Table, message, Tooltip, Spin, Alert, Dropdown, Input, Popconfirm, Tabs, Switch, TimePicker, Form, Empty } from 'antd';
import type { MenuProps } from 'antd';
import { SettingsLayout } from '@/components/layout/SettingsLayout';
import { QRCodeSVG } from 'qrcode.react';
import api from '@/lib/http';
import { io, Socket } from 'socket.io-client';
import { useMyStore } from '@/contexts/MyStoreContext';

interface ZaloAccount {
    id: string;
    name: string;
    phone: string;
    avatar: string;
    connectedAt: string;
    status: 'connected' | 'expired';
}

// Get socket URL - use same origin since backend is merged into Next.js server
const getSocketUrl = (): string => {
    if (typeof window !== 'undefined') {
        return window.location.origin;
    }
    return 'http://localhost:3001';
};

const ZaloPersonalSettingsPage: React.FC = () => {
    const { activeWorkspace } = useMyStore();
    const [qrModalOpen, setQrModalOpen] = useState(false);
    const [qrLoading, setQrLoading] = useState(false);
    const [qrData, setQrData] = useState<string>('');
    const [qrImage, setQrImage] = useState<string>(''); // Base64 image from server
    const [sessionId, setSessionId] = useState<string>('');
    const [loginStatus, setLoginStatus] = useState<'idle' | 'waiting' | 'confirming' | 'success' | 'failed'>('idle');
    const [qrError, setQrError] = useState<string>('');
    const [accounts, setAccounts] = useState<ZaloAccount[]>([]);
    const [loadingAccounts, setLoadingAccounts] = useState(true);
    const socketRef = useRef<Socket | null>(null);

    // Edit modal state
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editingAccount, setEditingAccount] = useState<ZaloAccount | null>(null);
    const [editName, setEditName] = useState('');
    const [editLoading, setEditLoading] = useState(false);

    // Check connection state
    const [checkingId, setCheckingId] = useState<string | null>(null);

    // Tab state
    const [activeTab, setActiveTab] = useState('accounts');

    // Auto-reply settings state
    const [autoReplySettings, setAutoReplySettings] = useState({
        enabled: false,
        greetingMessage: '',
        outsideHoursMessage: '',
        workingHoursEnabled: false,
        workingHoursStart: '08:00',
        workingHoursEnd: '18:00',
    });
    const [settingsLoading, setSettingsLoading] = useState(false);
    const [settingsSaving, setSettingsSaving] = useState(false);

    // Templates state
    interface MessageTemplate {
        id: string;
        name: string;
        shortcode: string;
        content: string;
        category: string;
    }
    const [templates, setTemplates] = useState<MessageTemplate[]>([]);
    const [templatesLoading, setTemplatesLoading] = useState(false);
    const [templateModalOpen, setTemplateModalOpen] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);

    // Cookie Import state
    const [cookieImportLoading, setCookieImportLoading] = useState(false);
    const [cookieData, setCookieData] = useState('');
    const [imeiValue, setImeiValue] = useState('');
    const [userAgentValue, setUserAgentValue] = useState('');
    const [templateForm] = Form.useForm();

    // Use activeWorkspace ID from context
    const workspaceId = activeWorkspace?.workspaceId || 'default';

    // Initialize Socket.IO for real-time QR updates
    useEffect(() => {
        const socketUrl = getSocketUrl();
        console.log('[ZaloPersonal] Connecting to socket:', socketUrl);

        const socket = io(socketUrl, {
            transports: ['websocket', 'polling'],
            reconnection: true,
        });

        socket.on('connect', () => {
            console.log('[ZaloPersonal] Socket connected');
        });

        // Listen for QR code updates from Puppeteer backend
        socket.on('zalo:qr_code', (data: { sessionId: string; qrBase64: string; expiresAt: number; isRefresh?: boolean }) => {
            console.log('[ZaloPersonal] Received QR code via socket', data.isRefresh ? '(refresh)' : '');
            setQrImage(data.qrBase64);
            setQrLoading(false);
            setLoginStatus('waiting');
            if (!qrModalOpen) {
                setQrModalOpen(true);
            }
        });

        // Listen for login success
        socket.on('zalo:login_success', (data: { sessionId: string; workspaceId: string; account: any }) => {
            console.log('[ZaloPersonal] Login success via socket');
            setLoginStatus('success');
            message.success('Kết nối Zalo thành công!');
            setTimeout(() => {
                setQrModalOpen(false);
                fetchAccounts();
            }, 1500);
        });

        // Listen for errors
        socket.on('zalo:error', (data: { sessionId: string; error: string }) => {
            console.error('[ZaloPersonal] Error via socket:', data.error);
            setQrError(data.error);
            setLoginStatus('failed');
            setQrLoading(false);
        });

        // Listen for QR code scanned (user scanned but not yet confirmed)
        socket.on('zalo:qr_scanned', (data: { sessionId: string; displayName: string; avatar: string }) => {
            console.log('[ZaloPersonal] QR scanned by:', data.displayName);
            setLoginStatus('confirming');
            message.info(`${data.displayName} đang xác nhận đăng nhập...`);
        });

        // Listen for QR code expired (will auto-retry)
        socket.on('zalo:qr_expired', (data: { sessionId: string; retryCount: number }) => {
            console.log('[ZaloPersonal] QR expired, retry:', data.retryCount);
            setQrLoading(true);
            setLoginStatus('waiting');
            message.warning('Mã QR đã hết hạn, đang tạo mã mới...');
        });

        socketRef.current = socket;

        return () => {
            socket.disconnect();
        };
    }, []);

    // Fetch connected accounts
    const fetchAccounts = useCallback(async () => {
        try {
            setLoadingAccounts(true);
            const res = await api.get(`/zalo-personal/accounts/${workspaceId}`);
            if (res.data.success) {
                setAccounts(res.data.data || []);
            }
        } catch (error) {
            console.error('Failed to fetch accounts:', error);
        } finally {
            setLoadingAccounts(false);
        }
    }, [workspaceId]);

    useEffect(() => {
        fetchAccounts();
    }, [fetchAccounts]);

    // Generate QR code
    const generateQRCode = async () => {
        setQrLoading(true);
        setLoginStatus('idle');
        setQrError('');

        try {
            const res = await api.post(`/zalo-personal/qr/${workspaceId}`);

            if (res.data.success) {
                setQrData(res.data.data.qrData || '');
                setQrImage(res.data.data.qrImage || ''); // Base64 image fallback
                setSessionId(res.data.data.sessionId);
                setQrModalOpen(true);
                setLoginStatus('waiting');

                // Start polling for status
                startPolling(res.data.data.sessionId);
            }
        } catch (error: any) {
            console.error('Failed to generate QR:', error);
            const errorMsg = error?.response?.data?.message || error?.message || 'Không thể tạo mã QR. Vui lòng thử lại.';
            setQrError(errorMsg);
            message.error(errorMsg);
            setQrModalOpen(true);
            setLoginStatus('failed');
        } finally {
            setQrLoading(false);
        }
    };

    // Poll for login status
    const startPolling = (sid: string) => {
        const pollInterval = setInterval(async () => {
            try {
                const res = await api.get(`/zalo-personal/status/${sid}`);

                if (res.data.success) {
                    const status = res.data.data.status;

                    if (status === 'success') {
                        clearInterval(pollInterval);
                        setLoginStatus('success');
                        message.success('Kết nối Zalo thành công!');
                        setQrModalOpen(false);
                        fetchAccounts();
                    } else if (status === 'failed' || status === 'expired' || status === 'not_found') {
                        clearInterval(pollInterval);
                        setLoginStatus('failed');

                        if (status === 'expired') {
                            message.warning('Mã QR đã hết hạn. Vui lòng tạo mã mới.');
                        }
                    }
                }
            } catch (error) {
                console.error('Polling error:', error);
            }
        }, 3000); // Poll every 3 seconds

        // Stop polling after 5 minutes
        setTimeout(() => {
            clearInterval(pollInterval);
        }, 5 * 60 * 1000);
    };

    // Refresh QR code
    const handleRefreshQR = async () => {
        if (!sessionId) {
            await generateQRCode();
            return;
        }

        setQrLoading(true);

        try {
            const res = await api.post(`/zalo-personal/refresh/${sessionId}`);

            if (res.data.success) {
                setQrData(res.data.data.qrData);
                setLoginStatus('waiting');
                startPolling(sessionId);
            }
        } catch (error) {
            // If refresh fails, generate new QR
            await generateQRCode();
        } finally {
            setQrLoading(false);
        }
    };

    // Disconnect account
    const handleDisconnect = async (accountId: string) => {
        try {
            await api.delete(`/zalo-personal/accounts/${workspaceId}/${accountId}`);
            message.success('Đã ngắt kết nối tài khoản Zalo');
            fetchAccounts();
        } catch (error) {
            message.error('Lỗi khi ngắt kết nối');
        }
    };

    // Check connection status
    const handleCheckConnection = async (account: ZaloAccount) => {
        setCheckingId(account.id);
        try {
            const res = await api.get(`/zalo-personal/check/${workspaceId}/${account.id}`);
            if (res.data.success && res.data.data.connected) {
                message.success(`Tài khoản "${account.name}" đang kết nối tốt`);
            } else {
                message.warning(`Tài khoản "${account.name}" mất kết nối: ${res.data.data.error || 'Unknown'}`);
            }
        } catch (error) {
            message.error('Lỗi kiểm tra kết nối');
        } finally {
            setCheckingId(null);
        }
    };

    // Open edit modal
    const handleOpenEdit = (account: ZaloAccount) => {
        setEditingAccount(account);
        setEditName(account.name);
        setEditModalOpen(true);
    };

    // Import session via cookie
    const handleCookieImport = async () => {
        if (!cookieData.trim()) {
            message.error('Vui lòng dán dữ liệu cookie từ J2TEAM Cookies');
            return;
        }

        setCookieImportLoading(true);
        try {
            // Parse JSON if it's valid
            let parsedCookie;
            try {
                parsedCookie = JSON.parse(cookieData);
            } catch {
                // If not JSON, use as string
                parsedCookie = cookieData;
            }

            const res = await api.post(`/zalo-personal/import-session/${workspaceId}`, {
                cookie: parsedCookie,
                imei: imeiValue.trim() || undefined,
                userAgent: userAgentValue.trim() || undefined
            });

            if (res.data.success) {
                message.success('Kết nối Zalo thành công qua cookie!');
                setCookieData('');
                setImeiValue('');
                setUserAgentValue('');
                fetchAccounts();
                setActiveTab('accounts');
            }
        } catch (error: any) {
            const errorMsg = error?.response?.data?.message || error?.message || 'Lỗi kết nối';
            message.error(`Không thể kết nối: ${errorMsg}`);
        } finally {
            setCookieImportLoading(false);
        }
    };

    // Save edited name
    const handleSaveEdit = async () => {
        if (!editingAccount || !editName.trim()) return;
        setEditLoading(true);
        try {
            await api.patch(`/zalo-personal/accounts/${workspaceId}/${editingAccount.id}`, {
                name: editName.trim(),
            });
            message.success('Đã cập nhật tên tài khoản');
            setEditModalOpen(false);
            fetchAccounts();
        } catch (error) {
            message.error('Lỗi cập nhật tên');
        } finally {
            setEditLoading(false);
        }
    };

    // Get dropdown menu items for an account
    const getActionMenuItems = (record: ZaloAccount): MenuProps['items'] => [
        {
            key: 'edit',
            icon: <span className="material-symbols-outlined text-base">edit</span>,
            label: 'Chỉnh sửa tên',
            onClick: () => handleOpenEdit(record),
        },
        {
            key: 'check',
            icon: <span className="material-symbols-outlined text-base">wifi_find</span>,
            label: checkingId === record.id ? 'Đang kiểm tra...' : 'Kiểm tra kết nối',
            disabled: checkingId === record.id,
            onClick: () => handleCheckConnection(record),
        },
        {
            key: 'reconnect',
            icon: <span className="material-symbols-outlined text-base">sync</span>,
            label: 'Kết nối lại',
            onClick: () => generateQRCode(),
        },
        { type: 'divider' },
        {
            key: 'disconnect',
            icon: <span className="material-symbols-outlined text-base">link_off</span>,
            label: 'Ngắt kết nối',
            danger: true,
            onClick: () => handleDisconnect(record.id),
        },
    ];

    const columns = [
        {
            title: 'TÀI KHOẢN',
            dataIndex: 'name',
            key: 'name',
            render: (name: string, record: ZaloAccount) => (
                <div className="flex items-center gap-3">
                    {record.avatar ? (
                        <img src={record.avatar} alt={name} className="w-10 h-10 rounded-full" />
                    ) : (
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                            {name.charAt(0)}
                        </div>
                    )}
                    <div>
                        <div className="font-medium">{name}</div>
                        <div className="text-xs text-neutral-500">{record.phone}</div>
                    </div>
                </div>
            ),
        },
        {
            title: 'TRẠNG THÁI',
            dataIndex: 'status',
            key: 'status',
            render: (status: string) => (
                <Tag color={status === 'connected' ? 'green' : 'orange'}>
                    {status === 'connected' ? 'Đang kết nối' : 'Hết hạn'}
                </Tag>
            ),
        },
        {
            title: 'NGÀY KẾT NỐI',
            dataIndex: 'connectedAt',
            key: 'connectedAt',
            render: (date: string) => (
                <span className="text-neutral-500">
                    {new Date(date).toLocaleDateString('vi-VN')}
                </span>
            ),
        },
        {
            title: 'THAO TÁC',
            key: 'actions',
            width: 100,
            render: (_: any, record: ZaloAccount) => (
                <Dropdown
                    menu={{ items: getActionMenuItems(record) }}
                    trigger={['click']}
                    placement="bottomRight"
                >
                    <Button
                        type="text"
                        size="small"
                        className="flex items-center justify-center"
                        loading={checkingId === record.id}
                    >
                        <span className="material-symbols-outlined">more_vert</span>
                    </Button>
                </Dropdown>
            ),
        },
    ];

    return (
        <SettingsLayout>
            <div className="max-w-4xl">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-[#0068FF] rounded-lg flex items-center justify-center shadow-sm">
                                <span className="material-symbols-outlined text-white text-xl">qr_code_scanner</span>
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h1 className="text-xl font-bold text-neutral-900">Zalo cá nhân</h1>
                                    <Tag color="blue">BETA</Tag>
                                </div>
                                <p className="text-sm text-neutral-500">
                                    Nhận và trả lời tin nhắn Zalo cá nhân trên dashboard
                                </p>
                            </div>
                        </div>
                    </div>
                    {activeTab === 'accounts' && (
                        <Button
                            type="primary"
                            size="large"
                            className="flex items-center gap-2"
                            onClick={generateQRCode}
                            loading={qrLoading}
                            disabled={accounts.length >= 3}
                        >
                            <span className="material-symbols-outlined text-lg">add</span>
                            Thêm Zalo cá nhân
                        </Button>
                    )}
                </div>

                {/* Tabs */}
                <Tabs
                    activeKey={activeTab}
                    onChange={setActiveTab}
                    items={[
                        {
                            key: 'accounts',
                            label: (
                                <span className="flex items-center gap-2">
                                    <span className="material-symbols-outlined text-lg">account_circle</span>
                                    Tài khoản
                                </span>
                            ),
                            children: (
                                <div className="pt-4">
                                    {/* Limit indicator */}
                                    <div className="mb-4 text-sm text-neutral-500">
                                        Đã tích hợp {accounts.length} / 3 tài khoản
                                    </div>

                                    {/* Important Notice */}
                                    <Alert
                                        message="LƯU Ý QUAN TRỌNG"
                                        description="Tài khoản Zalo sau khi thêm vào sẽ bị đăng xuất trên Zalo Web. Để giữ kết nối ổn định, vui lòng không đăng nhập lại Zalo Web (vẫn dùng bình thường trên điện thoại và app Desktop)"
                                        type="warning"
                                        showIcon
                                        className="mb-6"
                                    />

                                    {/* Content */}
                                    {loadingAccounts ? (
                                        <Card className="text-center py-16">
                                            <Spin size="large" />
                                        </Card>
                                    ) : accounts.length > 0 ? (
                                        <Card className="shadow-sm">
                                            <Table
                                                dataSource={accounts.map((a, i) => ({ ...a, key: i }))}
                                                columns={columns}
                                                pagination={false}
                                            />
                                        </Card>
                                    ) : (
                                        <Card className="text-center py-16">
                                            <div className="w-24 h-24 mx-auto mb-6 bg-blue-50 rounded-full flex items-center justify-center">
                                                <div className="w-14 h-14 bg-[#0068FF] rounded-xl flex items-center justify-center shadow-lg">
                                                    <span className="material-symbols-outlined text-white text-2xl">qr_code_scanner</span>
                                                </div>
                                            </div>
                                            <h3 className="text-lg font-semibold text-neutral-900 mb-2">
                                                Chưa có Zalo cá nhân nào được kết nối
                                            </h3>
                                            <p className="text-neutral-500 mb-6 max-w-md mx-auto">
                                                Kết nối tài khoản Zalo cá nhân để nhận và trả lời tin nhắn trực tiếp trong LiveChat
                                            </p>
                                            <Button
                                                type="primary"
                                                size="large"
                                                className="flex items-center gap-2 mx-auto"
                                                onClick={generateQRCode}
                                                loading={qrLoading}
                                            >
                                                <span className="material-symbols-outlined text-lg">qr_code</span>
                                                Thêm Zalo cá nhân đầu tiên
                                            </Button>
                                        </Card>
                                    )}

                                    {/* Instructions */}
                                    <div className="mt-6 p-5 bg-blue-50 rounded-xl border border-blue-100">
                                        <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                                            <span className="material-symbols-outlined text-lg">info</span>
                                            Hướng dẫn kết nối
                                        </h4>
                                        <ol className="text-sm text-blue-800 space-y-2 list-decimal list-inside ml-1">
                                            <li>Nhấn nút "Thêm Zalo cá nhân" để hiển thị mã QR</li>
                                            <li>Mở app Zalo trên điện thoại</li>
                                            <li>Vào phần Quét mã QR (biểu tượng QR góc trên)</li>
                                            <li>Quét mã QR trên màn hình</li>
                                            <li>Xác nhận đăng nhập trên điện thoại</li>
                                        </ol>
                                    </div>
                                </div>
                            ),
                        },
                        {
                            key: 'auto-reply',
                            label: (
                                <span className="flex items-center gap-2">
                                    <span className="material-symbols-outlined text-lg">reply_all</span>
                                    Tự động trả lời
                                </span>
                            ),
                            children: (
                                <div className="pt-4">
                                    <Card className="shadow-sm">
                                        <div className="space-y-6">
                                            {/* Enable Auto-reply */}
                                            <div className="flex items-center justify-between p-4 bg-neutral-50 rounded-lg">
                                                <div>
                                                    <h4 className="font-medium text-neutral-900">Bật tự động trả lời</h4>
                                                    <p className="text-sm text-neutral-500">Tự động gửi tin nhắn khi có người liên hệ</p>
                                                </div>
                                                <Switch
                                                    checked={autoReplySettings.enabled}
                                                    onChange={(checked) => setAutoReplySettings(prev => ({ ...prev, enabled: checked }))}
                                                />
                                            </div>

                                            {autoReplySettings.enabled && (
                                                <>
                                                    {/* Greeting Message */}
                                                    <div>
                                                        <label className="block text-sm font-medium text-neutral-700 mb-2">
                                                            Tin nhắn chào mừng
                                                        </label>
                                                        <Input.TextArea
                                                            rows={3}
                                                            placeholder="Xin chào! Cảm ơn bạn đã liên hệ. Chúng tôi sẽ phản hồi trong thời gian sớm nhất."
                                                            value={autoReplySettings.greetingMessage}
                                                            onChange={(e) => setAutoReplySettings(prev => ({ ...prev, greetingMessage: e.target.value }))}
                                                            maxLength={500}
                                                        />
                                                        <p className="text-xs text-neutral-500 mt-1">Tin nhắn này sẽ được gửi khi khách hàng nhắn lần đầu</p>
                                                    </div>

                                                    {/* Working Hours */}
                                                    <div className="p-4 bg-neutral-50 rounded-lg">
                                                        <div className="flex items-center justify-between mb-4">
                                                            <div>
                                                                <h4 className="font-medium text-neutral-900">Giờ làm việc</h4>
                                                                <p className="text-sm text-neutral-500">Gửi tin nhắn khác ngoài giờ làm việc</p>
                                                            </div>
                                                            <Switch
                                                                checked={autoReplySettings.workingHoursEnabled}
                                                                onChange={(checked) => setAutoReplySettings(prev => ({ ...prev, workingHoursEnabled: checked }))}
                                                            />
                                                        </div>

                                                        {autoReplySettings.workingHoursEnabled && (
                                                            <div className="space-y-4">
                                                                <div className="flex items-center gap-4">
                                                                    <div>
                                                                        <label className="block text-xs text-neutral-600 mb-1">Từ</label>
                                                                        <Input
                                                                            type="time"
                                                                            value={autoReplySettings.workingHoursStart}
                                                                            onChange={(e) => setAutoReplySettings(prev => ({ ...prev, workingHoursStart: e.target.value }))}
                                                                            className="w-32"
                                                                        />
                                                                    </div>
                                                                    <div>
                                                                        <label className="block text-xs text-neutral-600 mb-1">Đến</label>
                                                                        <Input
                                                                            type="time"
                                                                            value={autoReplySettings.workingHoursEnd}
                                                                            onChange={(e) => setAutoReplySettings(prev => ({ ...prev, workingHoursEnd: e.target.value }))}
                                                                            className="w-32"
                                                                        />
                                                                    </div>
                                                                </div>

                                                                <div>
                                                                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                                                                        Tin nhắn ngoài giờ làm việc
                                                                    </label>
                                                                    <Input.TextArea
                                                                        rows={2}
                                                                        placeholder="Xin lỗi, hiện tại đã ngoài giờ làm việc. Chúng tôi sẽ phản hồi vào ngày làm việc tiếp theo."
                                                                        value={autoReplySettings.outsideHoursMessage}
                                                                        onChange={(e) => setAutoReplySettings(prev => ({ ...prev, outsideHoursMessage: e.target.value }))}
                                                                        maxLength={500}
                                                                    />
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </>
                                            )}

                                            {/* Save Button */}
                                            <div className="flex justify-end pt-4 border-t">
                                                <Button
                                                    type="primary"
                                                    loading={settingsSaving}
                                                    onClick={() => {
                                                        message.success('Đã lưu cài đặt tự động trả lời');
                                                    }}
                                                >
                                                    Lưu cài đặt
                                                </Button>
                                            </div>
                                        </div>
                                    </Card>
                                </div>
                            ),
                        },
                        {
                            key: 'templates',
                            label: (
                                <span className="flex items-center gap-2">
                                    <span className="material-symbols-outlined text-lg">description</span>
                                    Mẫu tin nhắn
                                </span>
                            ),
                            children: (
                                <div className="pt-4">
                                    <div className="flex justify-between items-center mb-4">
                                        <p className="text-neutral-600">Tạo mẫu tin nhắn để trả lời nhanh với shortcode</p>
                                        <Button
                                            type="primary"
                                            onClick={() => {
                                                setEditingTemplate(null);
                                                templateForm.resetFields();
                                                setTemplateModalOpen(true);
                                            }}
                                        >
                                            <span className="material-symbols-outlined text-lg mr-1">add</span>
                                            Thêm mẫu
                                        </Button>
                                    </div>

                                    {templates.length === 0 ? (
                                        <Card className="text-center py-12">
                                            <Empty
                                                image={Empty.PRESENTED_IMAGE_SIMPLE}
                                                description="Chưa có mẫu tin nhắn nào"
                                            />
                                            <Button
                                                type="primary"
                                                className="mt-4"
                                                onClick={() => {
                                                    setEditingTemplate(null);
                                                    templateForm.resetFields();
                                                    setTemplateModalOpen(true);
                                                }}
                                            >
                                                Tạo mẫu đầu tiên
                                            </Button>
                                        </Card>
                                    ) : (
                                        <div className="grid gap-4">
                                            {templates.map((template) => (
                                                <Card key={template.id} className="shadow-sm hover:shadow-md transition-shadow">
                                                    <div className="flex justify-between items-start">
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <h4 className="font-medium text-neutral-900">{template.name}</h4>
                                                                <Tag color="blue">/{template.shortcode}</Tag>
                                                            </div>
                                                            <p className="text-sm text-neutral-600 line-clamp-2">{template.content}</p>
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <Button
                                                                size="small"
                                                                onClick={() => {
                                                                    setEditingTemplate(template);
                                                                    templateForm.setFieldsValue(template);
                                                                    setTemplateModalOpen(true);
                                                                }}
                                                            >
                                                                Sửa
                                                            </Button>
                                                            <Button size="small" danger>
                                                                Xóa
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </Card>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ),
                        },
                        {
                            key: 'cookie-import',
                            label: (
                                <span className="flex items-center gap-2">
                                    <span className="material-symbols-outlined text-lg">cookie</span>
                                    Import Cookie
                                </span>
                            ),
                            children: (
                                <div className="pt-4">
                                    <Alert
                                        message="Phương thức thay thế"
                                        description="Sử dụng khi không thể quét QR (Zalo bị chặn). Cần cài tiện ích J2TEAM Cookies để export cookie."
                                        type="info"
                                        showIcon
                                        className="mb-6"
                                    />

                                    <Card className="shadow-sm">
                                        <div className="space-y-6">
                                            {/* Cookie Input */}
                                            <div>
                                                <label className="block text-sm font-medium text-neutral-700 mb-2">
                                                    Cookie (J2TEAM format) <span className="text-red-500">*</span>
                                                </label>
                                                <Input.TextArea
                                                    rows={6}
                                                    placeholder='{"url":"https://chat.zalo.me","cookies":[...]}'
                                                    value={cookieData}
                                                    onChange={(e) => setCookieData(e.target.value)}
                                                    className="font-mono text-xs"
                                                />
                                                <p className="text-xs text-neutral-500 mt-1">
                                                    Mở chat.zalo.me → J2TEAM Cookies → Export → Paste vào đây
                                                </p>
                                            </div>

                                            {/* IMEI Input */}
                                            <div>
                                                <label className="block text-sm font-medium text-neutral-700 mb-2">
                                                    IMEI (z_uuid) <span className="text-neutral-400">(tùy chọn)</span>
                                                </label>
                                                <Input
                                                    placeholder="0b06201d-41df-4567-..."
                                                    value={imeiValue}
                                                    onChange={(e) => setImeiValue(e.target.value)}
                                                    className="font-mono"
                                                />
                                                <p className="text-xs text-neutral-500 mt-1">
                                                    DevTools Console: localStorage.getItem('z_uuid')
                                                </p>
                                            </div>

                                            {/* UserAgent Input */}
                                            <div>
                                                <label className="block text-sm font-medium text-neutral-700 mb-2">
                                                    User Agent <span className="text-neutral-400">(tùy chọn)</span>
                                                </label>
                                                <Input
                                                    placeholder="Mozilla/5.0 (Windows NT 10.0; Win64; x64)..."
                                                    value={userAgentValue}
                                                    onChange={(e) => setUserAgentValue(e.target.value)}
                                                    className="font-mono text-xs"
                                                />
                                            </div>

                                            {/* Submit Button */}
                                            <div className="flex justify-end pt-4 border-t">
                                                <Button
                                                    type="primary"
                                                    size="large"
                                                    loading={cookieImportLoading}
                                                    onClick={handleCookieImport}
                                                    disabled={!cookieData.trim()}
                                                >
                                                    <span className="material-symbols-outlined text-lg mr-1">login</span>
                                                    Kết nối Zalo
                                                </Button>
                                            </div>
                                        </div>
                                    </Card>

                                    {/* Instructions */}
                                    <div className="mt-6 p-5 bg-amber-50 rounded-xl border border-amber-100">
                                        <h4 className="font-semibold text-amber-900 mb-3 flex items-center gap-2">
                                            <span className="material-symbols-outlined text-lg">help</span>
                                            Hướng dẫn lấy cookie
                                        </h4>
                                        <ol className="text-sm text-amber-800 space-y-2 list-decimal list-inside ml-1">
                                            <li>Cài tiện ích <a href="https://chrome.google.com/webstore/detail/j2team-cookies/okpidcojinmlaakglciglbpcpajaibco" target="_blank" rel="noopener" className="text-blue-600 underline">J2TEAM Cookies</a></li>
                                            <li>Truy cập <a href="https://chat.zalo.me" target="_blank" rel="noopener" className="text-blue-600 underline">chat.zalo.me</a> và đăng nhập</li>
                                            <li>Click icon J2TEAM Cookies → Export → Copy</li>
                                            <li>Dán vào ô Cookie ở trên và nhấn "Kết nối Zalo"</li>
                                        </ol>
                                    </div>
                                </div>
                            ),
                        },
                    ]}
                />
            </div>

            {/* QR Code Modal */}
            <Modal
                title={null}
                open={qrModalOpen}
                onCancel={() => setQrModalOpen(false)}
                footer={null}
                width={400}
                centered
                destroyOnClose
            >
                <div className="text-center py-4">
                    <h3 className="text-lg font-semibold mb-2">Thêm Zalo cá nhân</h3>
                    <p className="text-neutral-500 text-sm mb-6">
                        Đăng nhập Zalo cá nhân bằng mã QR
                    </p>

                    <div className="bg-white p-6 rounded-xl border-2 border-neutral-200 inline-block mb-4">
                        {qrLoading ? (
                            <div className="w-48 h-48 flex items-center justify-center">
                                <Spin size="large" />
                            </div>
                        ) : loginStatus === 'success' ? (
                            <div className="w-48 h-48 flex flex-col items-center justify-center text-green-600">
                                <span className="material-symbols-outlined text-5xl mb-2">check_circle</span>
                                <span className="font-medium">Kết nối thành công!</span>
                            </div>
                        ) : qrImage ? (
                            // Use base64 image from server (preferred)
                            <img
                                src={qrImage.startsWith('data:') ? qrImage : `data:image/png;base64,${qrImage}`}
                                alt="Zalo QR Code"
                                className="w-48 h-48 object-contain"
                            />
                        ) : qrData ? (
                            // Fallback to QRCodeSVG if no image
                            <QRCodeSVG
                                value={qrData}
                                size={192}
                                level="M"
                            />
                        ) : loginStatus === 'failed' ? (
                            <div className="w-48 h-48 flex flex-col items-center justify-center text-red-500">
                                <span className="material-symbols-outlined text-5xl mb-2">error</span>
                                <span className="font-medium text-sm">Lỗi tạo QR</span>
                            </div>
                        ) : (
                            <div className="w-48 h-48 flex items-center justify-center text-neutral-400">
                                <span className="material-symbols-outlined text-4xl">qr_code_2</span>
                            </div>
                        )}
                    </div>

                    {loginStatus === 'waiting' && (
                        <div className="mb-4 text-sm text-neutral-500 flex items-center justify-center gap-2">
                            <Spin size="small" />
                            <span>Đang chờ quét mã...</span>
                        </div>
                    )}

                    <p className="text-sm text-neutral-500 mb-2">
                        Quét mã bằng app Zalo trên điện thoại
                    </p>
                    <button
                        className="text-primary-600 hover:text-primary-700 font-medium text-sm"
                        onClick={handleRefreshQR}
                        disabled={qrLoading}
                    >
                        Lấy mã mới
                    </button>

                    {loginStatus === 'failed' && (
                        <div className="mt-4">
                            {qrError && (
                                <Alert
                                    message="Lỗi máy chủ"
                                    description={qrError}
                                    type="error"
                                    showIcon
                                    className="mb-4 text-left"
                                />
                            )}
                            <Button type="primary" onClick={generateQRCode} loading={qrLoading}>
                                Thử lại
                            </Button>
                        </div>
                    )}
                </div>
            </Modal>

            {/* Edit Name Modal */}
            <Modal
                title="Chỉnh sửa tên tài khoản"
                open={editModalOpen}
                onCancel={() => setEditModalOpen(false)}
                onOk={handleSaveEdit}
                confirmLoading={editLoading}
                okText="Lưu"
                cancelText="Hủy"
            >
                <div className="py-4">
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                        Tên hiển thị
                    </label>
                    <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="Nhập tên tài khoản"
                        maxLength={50}
                    />
                    <p className="text-xs text-neutral-500 mt-2">
                        Tên này chỉ hiển thị trong hệ thống, không ảnh hưởng đến tài khoản Zalo thực
                    </p>
                </div>
            </Modal>
        </SettingsLayout>
    );
};

export default ZaloPersonalSettingsPage;
