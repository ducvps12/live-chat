import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Spin, Modal, message } from 'antd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { httpClient } from '../../../lib/http/client';
import {
    Facebook,
    Link2,
    ExternalLink,
    CheckCircle2,
    Plus,
    Trash2,
    Globe,
    MessageCircle,
    AlertTriangle,
    Activity,
    Settings,
} from 'lucide-react';

interface FBPage {
    id: string;
    pageId: string;
    pageName: string;
    pageAvatar: string;
    status: 'active' | 'disconnected' | 'token_expired';
    createdAt: string;
}

function useFBPages(workspaceId: string) {
    return useQuery({
        queryKey: ['facebook', 'pages', workspaceId],
        queryFn: async () => {
            const res = await httpClient.get(`/workspaces/${workspaceId}/facebook/pages`);
            return res.data?.data;
        },
        enabled: !!workspaceId,
    });
}

function useConnectFB() {
    return useMutation({
        mutationFn: async (workspaceId: string) => {
            const res = await httpClient.get(`/workspaces/${workspaceId}/facebook/oauth-url`);
            return res.data?.data?.url;
        },
    });
}

type FacebookConfigStatus = {
    oauthReady: boolean;
    webhookReady: boolean;
    redirectUri: string;
    webhookUrl: string;
    missing: string[];
};

function useFacebookConfigStatus(workspaceId: string) {
    return useQuery({
        queryKey: ['facebook', 'config-status', workspaceId],
        queryFn: async () => {
            const res = await httpClient.get(`/workspaces/${workspaceId}/facebook/status`);
            return res.data?.data as FacebookConfigStatus;
        },
        enabled: !!workspaceId,
        retry: false,
    });
}

function useDisconnectFBPage() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ workspaceId, pageDbId }: { workspaceId: string; pageDbId: string }) => {
            const res = await httpClient.delete(`/workspaces/${workspaceId}/facebook/pages/${pageDbId}`);
            return res.data;
        },
        onSuccess: (_, { workspaceId }) => {
            message.success('Đã ngắt kết nối Facebook Page');
            queryClient.invalidateQueries({ queryKey: ['facebook', 'pages', workspaceId] });
        },
        onError: (error: unknown) => {
            const err = error as { response?: { data?: { error?: string } } };
            message.error(err.response?.data?.error || 'Lỗi ngắt kết nối');
        },
    });
}

export default function FacebookIntegrationSettings({ workspaceId }: { workspaceId: string }) {
    const [hoverBtn, setHoverBtn] = useState<string | null>(null);
    const [confirmDisconnect, setConfirmDisconnect] = useState<string | null>(null);
    const [syncingPageId, setSyncingPageId] = useState<string | null>(null);
    const oauthPopupRef = useRef<Window | null>(null);
    const queryClient = useQueryClient();

    const { data, isLoading } = useFBPages(workspaceId);
    const { data: configStatus } = useFacebookConfigStatus(workspaceId);
    const { mutate: connectFB, isPending: isConnecting } = useConnectFB();
    const { mutate: disconnectPage, isPending: isDisconnecting } = useDisconnectFBPage();

    const pages: FBPage[] = data?.pages || [];

    useEffect(() => {
        const handleOAuthMessage = (event: MessageEvent) => {
            if (event.origin !== window.location.origin) return;
            const payload = event.data as {
                type?: string;
                success?: boolean;
                workspaceId?: string;
                pages?: number;
                failed?: number;
                error?: string;
            } | null;
            if (!payload || payload.type !== 'nemarkchat:facebook-oauth') return;
            if (payload.workspaceId && payload.workspaceId !== workspaceId) return;

            if (oauthPopupRef.current && !oauthPopupRef.current.closed) oauthPopupRef.current.close();
            oauthPopupRef.current = null;

            if (payload.success) {
                void queryClient.invalidateQueries({ queryKey: ['facebook', 'pages', workspaceId] });
                void queryClient.invalidateQueries({ queryKey: ['facebook', 'config-status', workspaceId] });
                const failed = payload.failed || 0;
                if (failed > 0) {
                    message.warning(`Kết nối ${payload.pages || 0} Fanpage; ${failed} Fanpage chưa subscribe được webhook`);
                } else {
                    message.success(`Đã kết nối ${payload.pages || 0} Fanpage Facebook`);
                }
            } else {
                message.error(payload.error || 'Chưa thể kết nối Facebook Fanpage');
            }
        };

        window.addEventListener('message', handleOAuthMessage);
        return () => window.removeEventListener('message', handleOAuthMessage);
    }, [queryClient, workspaceId]);

    const statusMap: Record<string, { color: string; bg: string; border: string; label: string }> = {
        active: { color: '#059669', bg: '#ecfdf5', border: '#a7f3d0', label: 'Đang hoạt động' },
        disconnected: { color: '#9ca3af', bg: '#f9fafb', border: '#e5e7eb', label: 'Mất kết nối' },
        token_expired: { color: '#d97706', bg: '#fffbeb', border: '#fde68a', label: 'Token hết hạn' },
    };

    const activePages = pages.filter((page) => page.status === 'active').length;
    const warningPages = pages.filter((page) => page.status !== 'active').length;

    const handleConnect = () => {
        if (configStatus && !configStatus.oauthReady) {
            message.error('Facebook App chưa được cấu hình đầy đủ trên máy chủ. Quản trị viên cần bổ sung biến môi trường trước.');
            return;
        }
        connectFB(workspaceId, {
            onSuccess: (url: string) => {
                if (!url) return;
                const popup = window.open(url, 'nemarkchat-facebook-oauth', 'width=600,height=700');
                oauthPopupRef.current = popup;
                if (!popup) message.warning('Trình duyệt đang chặn popup. Hãy cho phép popup rồi thử lại.');
            },
            onError: () => {
                message.error('Chưa thể tạo link Facebook OAuth. Vui lòng kiểm tra cấu hình Facebook App của nền tảng.');
            },
        });
    };

    const handleDisconnect = (pageDbId: string) => {
        disconnectPage({ workspaceId, pageDbId }, {
            onSuccess: () => setConfirmDisconnect(null),
        });
    };

    const handleSync = async (page: FBPage) => {
        setSyncingPageId(page.id);
        try {
            const res = await httpClient.post(`/workspaces/${workspaceId}/facebook/pages/${page.id}/sync`);
            message.success(res.data?.message || `Đồng bộ hoàn tất: ${res.data?.data?.synced || 0} tin nhắn`);
        } catch (error: unknown) {
            const err = error as { response?: { data?: { error?: string } } };
            message.error(err.response?.data?.error || 'Lỗi đồng bộ tin nhắn');
        } finally {
            setSyncingPageId(null);
        }
    };

    return (
        <div
            className="rounded-[28px] border border-slate-200/80 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)] overflow-hidden"
            style={{ marginTop: 24 }}
        >
            <div className="flex items-center gap-4 border-b border-slate-100" style={{ padding: '24px 28px' }}>
                <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white ring-1 ring-blue-100 transition-transform duration-200 hover:scale-[1.03]"
                    style={{ background: 'linear-gradient(135deg, #1877F2, #42A5F5)' }}
                >
                    <Facebook size={22} strokeWidth={1.8} />
                </div>
                <div className="min-w-0 flex-1">
                    <h3 className="m-0 text-[16px] font-semibold tracking-tight text-slate-900">
                        Tích hợp Facebook Fanpage
                    </h3>
                    <p className="m-0 text-[13px] text-slate-500 leading-6">
                        Kết nối Fanpage để nhận tin nhắn Messenger trong NemarkChat
                    </p>
                </div>

                {!isLoading && pages.length > 0 && (
                    <span className="inline-flex h-7 items-center gap-2 rounded-full px-3 text-[12px] font-semibold shrink-0 border border-blue-200 bg-blue-50 text-blue-700">
                        <Globe size={13} />
                        {pages.length} trang
                    </span>
                )}
            </div>

            <div style={{ padding: '28px' }}>
                {isLoading ? (
                    <div className="flex min-h-[200px] items-center justify-center">
                        <Spin size="large" />
                    </div>
                ) : (
                    <div className="space-y-5">
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
                            {[
                                { label: 'Fanpage đã kết nối', value: pages.length, hint: `${activePages} đang hoạt động`, icon: Globe, color: '#1877F2', bg: '#eff6ff' },
                                { label: 'Sức khoẻ kênh', value: warningPages > 0 ? `${warningPages} cảnh báo` : 'Ổn định', hint: warningPages > 0 ? 'Cần kiểm tra token' : 'Webhook sẵn sàng', icon: warningPages > 0 ? AlertTriangle : Activity, color: warningPages > 0 ? '#d97706' : '#059669', bg: warningPages > 0 ? '#fffbeb' : '#ecfdf5' },
                                { label: 'Inbox Facebook', value: pages.length > 0 ? 'Sẵn sàng' : 'Chưa bật', hint: 'Lọc riêng trong Inbox CSKH', icon: MessageCircle, color: '#4f46e5', bg: '#eef2ff' },
                            ].map((item) => {
                                const Icon = item.icon;
                                return (
                                    <div key={item.label} style={{ border: '1px solid #e2e8f0', borderRadius: 16, padding: 14, background: '#fff', display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                                        <div style={{ minWidth: 0 }}>
                                            <div style={{ color: '#64748b', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0 }}>{item.label}</div>
                                            <div style={{ marginTop: 6, color: '#0f172a', fontSize: 20, fontWeight: 900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.value}</div>
                                            <div style={{ marginTop: 6, color: '#64748b', fontSize: 12, fontWeight: 600 }}>{item.hint}</div>
                                        </div>
                                        <div style={{ width: 38, height: 38, borderRadius: 12, background: item.bg, color: item.color, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                                            <Icon size={18} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                            <Link href={`/workspace/${workspaceId}/inbox?channel=facebook`} className="enterprise-button enterprise-button-primary" style={{ height: 38, padding: '0 14px', textDecoration: 'none' }}>
                                <MessageCircle size={15} />
                                Mở Inbox Facebook
                            </Link>
                            <Link href={`/workspace/${workspaceId}/settings?tab=webhook`} className="enterprise-button" style={{ height: 38, padding: '0 14px', textDecoration: 'none' }}>
                                <Settings size={15} />
                                Kiểm tra Webhook
                            </Link>
                        </div>

                        {configStatus && !configStatus.oauthReady && (
                            <div className="rounded-2xl border border-amber-200 bg-amber-50" style={{ padding: '14px 18px' }}>
                                <p className="m-0 text-[13px] font-semibold text-amber-900">Facebook OAuth chưa sẵn sàng trên máy chủ</p>
                                <p className="m-0 mt-1 text-[12px] text-amber-800">
                                    Thiếu: <code>{configStatus.missing.join(', ')}</code>. Sau khi quản trị viên cấu hình xong, dùng Redirect URI <code>{configStatus.redirectUri}</code> trong Meta App rồi tải lại trang này.
                                </p>
                            </div>
                        )}

                        {configStatus?.oauthReady && (
                            <div className="rounded-2xl border border-blue-200 bg-blue-50" style={{ padding: '14px 18px' }}>
                                <p className="m-0 text-[13px] font-semibold text-blue-950">Các giá trị bắt buộc trên Meta for Developers</p>
                                <div className="mt-2 grid gap-1 text-[12px] text-blue-900" style={{ lineHeight: 1.6 }}>
                                    <div>Miền ứng dụng: <code>nemarkchat.com</code></div>
                                    <div>Website Site URL: <code>https://nemarkchat.com/</code></div>
                                    <div>Valid OAuth Redirect URI: <code>{configStatus.redirectUri}</code></div>
                                    <div>Webhook Callback URL: <code>{configStatus.webhookUrl}</code></div>
                                </div>
                            </div>
                        )}

                        {pages.length > 0 && (
                            <div className="space-y-3">
                                {pages.map((page) => {
                                    const st = statusMap[page.status] || statusMap.disconnected;
                                    return (
                                        <div
                                            key={page.id}
                                            className="flex items-center gap-4 rounded-2xl border border-slate-200/70 bg-slate-50/70 transition-all duration-200 hover:border-slate-300/80 hover:shadow-sm"
                                            style={{ padding: '16px 20px' }}
                                        >
                                            <div className="shrink-0">
                                                {page.pageAvatar ? (
                                                    <img src={page.pageAvatar} alt={page.pageName} className="rounded-xl object-cover" style={{ width: 44, height: 44 }} />
                                                ) : (
                                                    <div className="flex items-center justify-center rounded-xl text-white" style={{ width: 44, height: 44, fontSize: 18, fontWeight: 600, background: '#1877F2' }}>
                                                        {page.pageName?.charAt(0) || 'F'}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="min-w-0 flex-1">
                                                <h4 className="m-0 text-[15px] font-semibold tracking-tight text-slate-900 truncate">{page.pageName}</h4>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: st.bg, color: st.color, border: `1px solid ${st.border}` }}>
                                                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: st.color }} />
                                                        {st.label}
                                                    </span>
                                                </div>
                                            </div>

                                            <button
                                                onClick={() => handleSync(page)}
                                                disabled={syncingPageId === page.id}
                                                onMouseEnter={() => setHoverBtn(`sync-${page.id}`)}
                                                onMouseLeave={() => setHoverBtn(null)}
                                                className="inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 transition-all duration-200 shrink-0 text-[12px] font-semibold"
                                                style={{
                                                    cursor: syncingPageId === page.id ? 'not-allowed' : 'pointer',
                                                    opacity: syncingPageId === page.id ? 0.6 : 1,
                                                    background: hoverBtn === `sync-${page.id}` ? '#eff6ff' : 'white',
                                                    borderColor: hoverBtn === `sync-${page.id}` ? '#93c5fd' : '#e2e8f0',
                                                    color: '#1877F2',
                                                }}
                                                title="Đồng bộ tin nhắn từ Fanpage"
                                            >
                                                {syncingPageId === page.id ? <Spin size="small" /> : <><ExternalLink size={13} /> Đồng bộ</>}
                                            </button>

                                            <button
                                                onClick={() => setConfirmDisconnect(page.id)}
                                                disabled={isDisconnecting}
                                                onMouseEnter={() => setHoverBtn(`del-${page.id}`)}
                                                onMouseLeave={() => setHoverBtn(null)}
                                                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border transition-all duration-200 shrink-0"
                                                style={{
                                                    cursor: isDisconnecting ? 'not-allowed' : 'pointer',
                                                    opacity: isDisconnecting ? 0.5 : 1,
                                                    background: hoverBtn === `del-${page.id}` ? '#fef2f2' : 'white',
                                                    borderColor: hoverBtn === `del-${page.id}` ? '#fecaca' : '#e2e8f0',
                                                    color: '#ef4444',
                                                }}
                                                title="Ngắt kết nối"
                                            >
                                                <Trash2 size={15} />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        <button
                            onClick={handleConnect}
                            disabled={isConnecting || configStatus?.oauthReady === false}
                            onMouseEnter={() => setHoverBtn('add-fb')}
                            onMouseLeave={() => setHoverBtn(null)}
                            className="inline-flex h-12 w-full items-center justify-center gap-2.5 rounded-2xl border-2 border-dashed text-[14px] font-semibold transition-all duration-200"
                            style={{
                                cursor: isConnecting || configStatus?.oauthReady === false ? 'not-allowed' : 'pointer',
                                opacity: isConnecting || configStatus?.oauthReady === false ? 0.7 : 1,
                                background: hoverBtn === 'add-fb' && !isConnecting ? '#eff6ff' : '#fafbfc',
                                borderColor: hoverBtn === 'add-fb' && !isConnecting ? '#60a5fa' : '#e2e8f0',
                                color: hoverBtn === 'add-fb' && !isConnecting ? '#1877F2' : '#64748b',
                            }}
                        >
                            {isConnecting ? <Spin size="small" /> : <Plus size={18} />}
                            {pages.length === 0 ? 'Kết nối Facebook Fanpage' : 'Thêm Fanpage'}
                        </button>

                        <div className="space-y-4 pt-2">
                            <div className="flex flex-wrap justify-center gap-3">
                                {[
                                    { icon: Facebook, text: 'Messenger' },
                                    { icon: Globe, text: 'Nhiều Fanpage' },
                                    { icon: Link2, text: 'Webhook tự động' },
                                    { icon: CheckCircle2, text: 'Quản lý tập trung' },
                                ].map((feature) => (
                                    <span key={feature.text} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50/80 px-3 py-1.5 text-[12px] font-medium text-slate-500">
                                        <feature.icon size={13} />
                                        {feature.text}
                                    </span>
                                ))}
                            </div>

                            {pages.length === 0 && (
                                <div className="rounded-2xl border border-blue-200/80 bg-blue-50/70" style={{ padding: '14px 18px' }}>
                                    <p className="m-0 text-[13px] font-semibold text-blue-900 mb-1">Kết nối Fanpage của bạn</p>
                                    <ul className="m-0 pl-4 text-[12px] text-blue-800 space-y-1">
                                        <li>Bấm <strong>Kết nối Facebook Fanpage</strong> để bắt đầu.</li>
                                        <li>Đăng nhập tài khoản Facebook có quyền quản trị Fanpage.</li>
                                        <li>Chọn Fanpage bạn muốn nhận và trả lời tin nhắn Messenger tại NemarkChat.</li>
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <Modal
                open={!!confirmDisconnect}
                title="Ngắt kết nối Facebook Page"
                onCancel={() => setConfirmDisconnect(null)}
                okText="Ngắt kết nối"
                cancelText="Huỷ"
                okButtonProps={{ danger: true, loading: isDisconnecting }}
                onOk={() => confirmDisconnect && handleDisconnect(confirmDisconnect)}
            >
                <p>Bạn có chắc muốn ngắt kết nối Facebook Page này? Tin nhắn Messenger mới sẽ không được đồng bộ nữa.</p>
            </Modal>
        </div>
    );
}
