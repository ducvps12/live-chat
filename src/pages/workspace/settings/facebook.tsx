import React, { useState, useEffect, useCallback } from 'react';
import { Button, Card, Table, Tag, Modal, Checkbox, message, Spin, Switch, Avatar, Tooltip, Popconfirm } from 'antd';
import { SettingsLayout } from '@/components/layout/SettingsLayout';
import { useParams, useSearchParams } from 'next/navigation';
import facebookService, {
    FacebookPage,
    AvailableFacebookPage,
    PAGE_STATUS
} from '@/services/facebook.service';

const FacebookSettingsPage: React.FC = () => {
    const params = useParams();
    const searchParams = useSearchParams();
    const workspaceId = params?.workspaceId as string;

    // State
    const [loading, setLoading] = useState(true);
    const [pages, setPages] = useState<FacebookPage[]>([]);
    const [selectedPage, setSelectedPage] = useState<FacebookPage | null>(null);

    // OAuth & Page selection
    const [oauthLoading, setOauthLoading] = useState(false);
    const [selectModalOpen, setSelectModalOpen] = useState(false);
    const [availablePages, setAvailablePages] = useState<AvailableFacebookPage[]>([]);
    const [selectedPageIds, setSelectedPageIds] = useState<Set<string>>(new Set());
    const [oauthToken, setOauthToken] = useState<string | null>(null);
    const [connectLoading, setConnectLoading] = useState(false);

    // Settings panel
    const [settingsLoading, setSettingsLoading] = useState(false);

    // Load connected pages
    const loadPages = useCallback(async () => {
        if (!workspaceId) return;

        try {
            setLoading(true);
            const connectedPages = await facebookService.getConnectedPages(workspaceId);
            setPages(connectedPages);

            // Select first page by default
            if (connectedPages.length > 0 && !selectedPage) {
                setSelectedPage(connectedPages[0]);
            }
        } catch (error) {
            console.error('Failed to load pages:', error);
            message.error('Không thể tải danh sách Fanpage');
        } finally {
            setLoading(false);
        }
    }, [workspaceId, selectedPage]);

    // Handle OAuth callback from URL params
    useEffect(() => {
        const token = searchParams?.get('token');
        const error = searchParams?.get('error');
        const success = searchParams?.get('success');

        if (token && success) {
            setOauthToken(token);
            handleOAuthSuccess(token);

            // Clean URL
            window.history.replaceState({}, document.title, window.location.pathname);
        } else if (error) {
            message.error(decodeURIComponent(error));
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }, [searchParams]);

    // Load pages on mount
    useEffect(() => {
        loadPages();
    }, [loadPages]);

    // Handle OAuth success - load available pages
    const handleOAuthSuccess = async (token: string) => {
        try {
            setOauthLoading(true);
            const available = await facebookService.getAvailablePages(workspaceId, token);
            setAvailablePages(available);
            setSelectModalOpen(true);
            setSelectedPageIds(new Set());
        } catch (error) {
            console.error('Failed to get available pages:', error);
            message.error('Không thể lấy danh sách Fanpage từ Facebook');
        } finally {
            setOauthLoading(false);
        }
    };

    // Start OAuth flow
    const handleConnectClick = async () => {
        try {
            setOauthLoading(true);
            const { url } = await facebookService.getOAuthUrl(workspaceId);

            // Open popup
            const result = await facebookService.openOAuthPopup(url);

            if (result.token) {
                setOauthToken(result.token);
                await handleOAuthSuccess(result.token);
            } else if (result.error) {
                message.error(result.error);
            }
        } catch (error) {
            console.error('OAuth error:', error);
            message.error('Không thể kết nối Facebook');
        } finally {
            setOauthLoading(false);
        }
    };

    // Connect selected pages
    const handleConnectPages = async () => {
        if (!oauthToken || selectedPageIds.size === 0) return;

        try {
            setConnectLoading(true);
            const pagesToConnect = availablePages
                .filter(p => selectedPageIds.has(p.id))
                .map(p => ({ id: p.id, name: p.name }));

            const result = await facebookService.connectPages(workspaceId, pagesToConnect, oauthToken);

            if (result.connected.length > 0) {
                message.success(`Đã kết nối ${result.connected.length} Fanpage`);
            }

            if (result.errors.length > 0) {
                result.errors.forEach(err => {
                    message.warning(`${err.pageName}: ${err.error}`);
                });
            }

            setSelectModalOpen(false);
            setOauthToken(null);
            loadPages();
        } catch (error) {
            console.error('Connect error:', error);
            message.error('Không thể kết nối Fanpage');
        } finally {
            setConnectLoading(false);
        }
    };

    // Disconnect page
    const handleDisconnect = async (pageId: string) => {
        try {
            await facebookService.disconnectPage(workspaceId, pageId);
            message.success('Đã ngắt kết nối Fanpage');

            if (selectedPage?.pageId === pageId) {
                setSelectedPage(null);
            }
            loadPages();
        } catch (error) {
            console.error('Disconnect error:', error);
            message.error('Không thể ngắt kết nối');
        }
    };

    // Update settings
    const handleSettingChange = async (key: string, value: boolean) => {
        if (!selectedPage) return;

        try {
            setSettingsLoading(true);
            await facebookService.updatePageSettings(workspaceId, selectedPage.pageId, {
                [key]: value
            });

            // Update local state
            setSelectedPage({
                ...selectedPage,
                settings: { ...selectedPage.settings, [key]: value }
            });

            setPages(pages.map(p =>
                p.pageId === selectedPage.pageId
                    ? { ...p, settings: { ...p.settings, [key]: value } }
                    : p
            ));

            message.success('Đã lưu cài đặt');
        } catch (error) {
            console.error('Settings error:', error);
            message.error('Không thể lưu cài đặt');
        } finally {
            setSettingsLoading(false);
        }
    };

    // Toggle page selection
    const togglePageSelection = (pageId: string) => {
        const newSet = new Set(selectedPageIds);
        if (newSet.has(pageId)) {
            newSet.delete(pageId);
        } else {
            newSet.add(pageId);
        }
        setSelectedPageIds(newSet);
    };

    // Select all pages
    const selectAllPages = () => {
        const notConnected = availablePages.filter(p => !p.isConnected);
        setSelectedPageIds(new Set(notConnected.map(p => p.id)));
    };

    // Deselect all
    const deselectAll = () => {
        setSelectedPageIds(new Set());
    };

    // Get status tag
    const getStatusTag = (status: number) => {
        switch (status) {
            case PAGE_STATUS.ACTIVE:
                return <Tag color="success">HOẠT ĐỘNG</Tag>;
            case PAGE_STATUS.DISCONNECTED:
                return <Tag color="default">ĐÃ NGẮT</Tag>;
            case PAGE_STATUS.TOKEN_EXPIRED:
                return <Tag color="warning">TOKEN HẾT HẠN</Tag>;
            case PAGE_STATUS.ERROR:
                return <Tag color="error">LỖI</Tag>;
            default:
                return <Tag>KHÔNG XÁC ĐỊNH</Tag>;
        }
    };

    // Table columns
    const columns = [
        {
            title: 'FANPAGE',
            key: 'page',
            render: (_: unknown, record: FacebookPage) => (
                <div className="flex items-center gap-3">
                    <Avatar
                        src={record.facebookPageAvatar}
                        size={40}
                        className="bg-gray-200"
                    >
                        {record.facebookPageName[0]}
                    </Avatar>
                    <div>
                        <div className="font-medium text-neutral-900">{record.facebookPageName}</div>
                        <div className="text-xs text-neutral-500">{record.facebookPageId}</div>
                    </div>
                </div>
            )
        },
        {
            title: 'TRẠNG THÁI',
            key: 'status',
            width: 140,
            render: (_: unknown, record: FacebookPage) => (
                <div>
                    {getStatusTag(record.status)}
                    {record.errorMessage && (
                        <Tooltip title={record.errorMessage}>
                            <span className="text-red-500 text-xs ml-2 cursor-help">ⓘ</span>
                        </Tooltip>
                    )}
                </div>
            )
        },
        {
            title: 'HÀNH ĐỘNG',
            key: 'actions',
            width: 120,
            render: (_: unknown, record: FacebookPage) => (
                <div className="flex items-center gap-2">
                    <Tooltip title="Cài đặt">
                        <Button
                            type="text"
                            size="small"
                            icon={<span className="material-symbols-outlined text-base">settings</span>}
                            onClick={() => setSelectedPage(record)}
                            className={selectedPage?.pageId === record.pageId ? 'text-primary-600' : ''}
                        />
                    </Tooltip>
                    <Popconfirm
                        title="Ngắt kết nối Fanpage?"
                        description="Bạn sẽ không nhận được tin nhắn từ Fanpage này nữa."
                        onConfirm={() => handleDisconnect(record.pageId)}
                        okText="Ngắt kết nối"
                        cancelText="Hủy"
                        okButtonProps={{ danger: true }}
                    >
                        <Tooltip title="Ngắt kết nối">
                            <Button
                                type="text"
                                size="small"
                                danger
                                icon={<span className="material-symbols-outlined text-base">link_off</span>}
                            />
                        </Tooltip>
                    </Popconfirm>
                </div>
            )
        }
    ];

    // Has connected pages
    const hasPages = pages.length > 0;

    return (
        <SettingsLayout>
            <div className="max-w-6xl">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-[#1877F2] rounded-lg flex items-center justify-center shadow-sm">
                                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                                </svg>
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-neutral-900">Facebook Messenger</h1>
                                <p className="text-sm text-neutral-500">Kết nối Fanpage để nhận và trả lời tin nhắn</p>
                            </div>
                        </div>
                    </div>
                    <Button
                        type="primary"
                        size="large"
                        className="flex items-center gap-2"
                        onClick={handleConnectClick}
                        loading={oauthLoading}
                    >
                        <span className="material-symbols-outlined text-lg">add</span>
                        Kết nối Fanpage
                    </Button>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <Spin size="large" />
                    </div>
                ) : hasPages ? (
                    // Connected pages layout
                    <div className="flex gap-6">
                        {/* Pages table */}
                        <div className="flex-1">
                            <Card className="shadow-sm">
                                <div className="mb-4 flex items-center justify-between">
                                    <div className="text-sm text-neutral-500">
                                        Đã kết nối {pages.length} Fanpage
                                    </div>
                                </div>
                                <Table
                                    dataSource={pages}
                                    columns={columns}
                                    rowKey="pageId"
                                    pagination={false}
                                    size="middle"
                                    onRow={(record) => ({
                                        onClick: () => setSelectedPage(record),
                                        className: selectedPage?.pageId === record.pageId
                                            ? 'bg-primary-50 cursor-pointer'
                                            : 'cursor-pointer hover:bg-gray-50'
                                    })}
                                />
                            </Card>
                        </div>

                        {/* Settings panel */}
                        {selectedPage && (
                            <div className="w-80">
                                <Card className="shadow-sm sticky top-4">
                                    {/* Page header */}
                                    <div className="flex items-center gap-3 pb-4 border-b">
                                        <Avatar
                                            src={selectedPage.facebookPageAvatar}
                                            size={48}
                                            className="bg-gray-200"
                                        >
                                            {selectedPage.facebookPageName[0]}
                                        </Avatar>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-semibold text-neutral-900 truncate">
                                                {selectedPage.facebookPageName}
                                            </div>
                                            {getStatusTag(selectedPage.status)}
                                        </div>
                                        <Button
                                            type="text"
                                            size="small"
                                            icon={<span className="material-symbols-outlined">close</span>}
                                            onClick={() => setSelectedPage(null)}
                                        />
                                    </div>

                                    {/* Settings */}
                                    <div className="pt-4">
                                        <h4 className="font-semibold text-neutral-900 mb-4">Cài đặt chung</h4>

                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <div className="font-medium text-sm">Tự động trả lời bình luận</div>
                                                    <div className="text-xs text-neutral-500">
                                                        Gửi tin nhắn khi có bình luận mới
                                                    </div>
                                                </div>
                                                <Switch
                                                    checked={selectedPage.settings?.autoReplyComment || false}
                                                    onChange={(checked) => handleSettingChange('autoReplyComment', checked)}
                                                    loading={settingsLoading}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Last sync */}
                                    {selectedPage.lastSyncAt && (
                                        <div className="mt-6 pt-4 border-t">
                                            <div className="text-xs text-neutral-400">
                                                Đồng bộ lần cuối: {new Date(selectedPage.lastSyncAt).toLocaleString('vi-VN')}
                                            </div>
                                        </div>
                                    )}
                                </Card>
                            </div>
                        )}
                    </div>
                ) : (
                    // Empty state
                    <>
                        <Card className="text-center py-16">
                            <div className="w-24 h-24 mx-auto mb-6 bg-blue-50 rounded-full flex items-center justify-center">
                                <div className="w-14 h-14 bg-[#1877F2] rounded-xl flex items-center justify-center shadow-lg">
                                    <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                                    </svg>
                                </div>
                            </div>
                            <h3 className="text-lg font-semibold text-neutral-900 mb-2">Chưa có Fanpage nào được kết nối</h3>
                            <p className="text-neutral-500 mb-6 max-w-md mx-auto">
                                Kết nối Fanpage Facebook để nhận tin nhắn từ khách hàng trực tiếp trong LiveChat
                            </p>
                            <Button
                                type="primary"
                                size="large"
                                className="flex items-center gap-2 mx-auto"
                                onClick={handleConnectClick}
                                loading={oauthLoading}
                            >
                                <span className="material-symbols-outlined text-lg">link</span>
                                Kết nối Fanpage đầu tiên
                            </Button>
                        </Card>

                        {/* Instructions */}
                        <div className="mt-6 p-5 bg-blue-50 rounded-xl border border-blue-100">
                            <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                                <span className="material-symbols-outlined text-lg">info</span>
                                Hướng dẫn kết nối
                            </h4>
                            <ol className="text-sm text-blue-800 space-y-2 list-decimal list-inside ml-1">
                                <li>Đăng nhập Facebook với tài khoản quản trị Fanpage</li>
                                <li>Chọn Fanpage bạn muốn kết nối</li>
                                <li>Cấp quyền cho ứng dụng truy cập tin nhắn</li>
                                <li>Hoàn tất kết nối và bắt đầu nhận tin nhắn</li>
                            </ol>
                        </div>
                    </>
                )}

                {/* Page Selection Modal */}
                <Modal
                    title={
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-[#1877F2]">pages</span>
                            Chọn trang
                        </div>
                    }
                    open={selectModalOpen}
                    onCancel={() => {
                        setSelectModalOpen(false);
                        setOauthToken(null);
                    }}
                    width={500}
                    footer={
                        <div className="flex items-center justify-between">
                            <Button onClick={() => setSelectModalOpen(false)}>
                                Hủy
                            </Button>
                            <div className="flex items-center gap-3">
                                <span className="text-sm text-neutral-500">
                                    Chọn {selectedPageIds.size}/{availablePages.filter(p => !p.isConnected).length} trang
                                </span>
                                <Button
                                    type="primary"
                                    onClick={handleConnectPages}
                                    loading={connectLoading}
                                    disabled={selectedPageIds.size === 0}
                                >
                                    Hoàn thành
                                </Button>
                            </div>
                        </div>
                    }
                >
                    <p className="text-neutral-600 mb-4">
                        Vui lòng chọn các trang bạn muốn tích hợp vào tài khoản này.
                    </p>

                    {/* Select all / Deselect */}
                    <div className="mb-3 flex gap-2">
                        <Button size="small" type="primary" ghost onClick={selectAllPages}>
                            Chọn tất cả
                        </Button>
                        <Button size="small" onClick={deselectAll}>
                            Bỏ chọn tất cả
                        </Button>
                    </div>

                    {/* Pages list */}
                    <div className="max-h-80 overflow-y-auto border rounded-lg divide-y">
                        {availablePages.map(page => (
                            <div
                                key={page.id}
                                className={`p-3 flex items-center gap-3 hover:bg-gray-50 cursor-pointer ${page.isConnected ? 'opacity-50' : ''
                                    }`}
                                onClick={() => !page.isConnected && togglePageSelection(page.id)}
                            >
                                <Checkbox
                                    checked={selectedPageIds.has(page.id) || page.isConnected}
                                    disabled={page.isConnected}
                                />
                                <Avatar src={page.avatar} size={40} className="bg-gray-200">
                                    {page.name[0]}
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                    <div className="font-medium text-neutral-900 truncate">{page.name}</div>
                                    <div className="text-xs text-neutral-500 truncate">{page.category}</div>
                                </div>
                                {page.isConnected ? (
                                    <Tag color="success">Đã kết nối</Tag>
                                ) : selectedPageIds.has(page.id) ? (
                                    <Button type="primary" size="small">Đã chọn</Button>
                                ) : (
                                    <Button size="small" ghost type="primary">Chọn</Button>
                                )}
                            </div>
                        ))}
                    </div>
                </Modal>
            </div>
        </SettingsLayout>
    );
};

export default FacebookSettingsPage;
