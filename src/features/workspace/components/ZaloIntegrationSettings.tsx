/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/router';
import { Alert, Checkbox, Form, Input, InputNumber, Modal, Progress, Select, Spin, Tooltip, message } from 'antd';
import { useZaloStatus, useGenerateZaloQR, useDisconnectZalo } from '../../../domains/zalo/zalo.hooks';
import { Smartphone, RefreshCw, CheckCircle2, ScanLine, Wifi, WifiOff, Zap, Plus, Trash2, Users, Database, Loader2, MessageSquare, ArrowRight, Network } from 'lucide-react';
import { zaloService } from '../../../services/zalo.service';

interface ZaloAccount {
    accountId: string;
    name: string;
    avatar: string;
    zaloId: string;
    status: 'active' | 'disconnected';
    isOnline: boolean;
    hasCredentials?: boolean;
}

interface SyncStatus {
    status: 'idle' | 'running' | 'completed' | 'error';
    progress?: number;
    total?: number;
    completed?: number;
    message?: string;
}

export default function ZaloIntegrationSettings({ workspaceId }: { workspaceId: string }) {
    const router = useRouter();
    const [localQrUrl, setLocalQrUrl] = useState<string | null>(null);
    const [hoverBtn, setHoverBtn] = useState<string | null>(null);
    const [confirmDisconnect, setConfirmDisconnect] = useState<string | null>(null);
    const [networkAccountId, setNetworkAccountId] = useState<string | null>(null);
    const [networkLoading, setNetworkLoading] = useState(false);
    const [networkSaving, setNetworkSaving] = useState(false);
    const [networkTesting, setNetworkTesting] = useState(false);
    const [networkForm] = Form.useForm();

    // Track accounts count when QR was first shown — so we can detect NEW account login
    const accountsCountOnQrOpen = useRef<number>(0);

    // Sync state
    const [syncing, setSyncing] = useState(false);
    const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
    const syncPollRef = useRef<NodeJS.Timeout | null>(null);

    // Per-account sync state
    const [syncingAccountId, setSyncingAccountId] = useState<string | null>(null);
    // Per-account reconnect state
    const [reconnectingAccountId, setReconnectingAccountId] = useState<string | null>(null);
    const [reconnectingAll, setReconnectingAll] = useState(false);

    const { data: res, isLoading, refetch } = useZaloStatus(workspaceId, !!localQrUrl);
    const { mutate: generateQR, isPending: isGenerating } = useGenerateZaloQR();
    const { mutate: disconnect, isPending: isDisconnecting } = useDisconnectZalo();

    const statusObj = res?.data;
    const accounts: ZaloAccount[] = useMemo(() => statusObj?.accounts || [], [statusObj?.accounts]);
    const hasAnyConnected = accounts.some(a => a.isOnline);

    const handleConnect = () => {
        // Capture current accounts count BEFORE generating QR
        accountsCountOnQrOpen.current = accounts.length;
        generateQR(workspaceId, {
            onSuccess: (data: any) => {
                const qrUrl = data?.data?.qrUrl || data?.qrUrl;
                if (qrUrl) setLocalQrUrl(qrUrl);
            },
        });
    };

    const handleDisconnect = (accountId: string) => {
        disconnect({ workspaceId, accountId }, {
            onSuccess: () => { setLocalQrUrl(null); setConfirmDisconnect(null); },
        });
    };

    // ── Sync handlers ──
    const openZaloInbox = () => router.push(`/workspace/${workspaceId}/inbox?channel=zalo`);

    const pollSyncStatus = useCallback(async () => {
        try {
            const res = await zaloService.getSyncStatus(workspaceId);
            const data = res?.data;
            if (data) {
                setSyncStatus(data);
                if (data.status === 'completed' || data.status === 'error') {
                    setSyncing(false);
                    if (syncPollRef.current) { clearInterval(syncPollRef.current); syncPollRef.current = null; }
                    if (data.status === 'completed') {
                        message.success(`Đồng bộ hoàn tất! ${data.completed || 0} hội thoại đã được xử lý.`);
                    } else {
                        message.warning('Đồng bộ gặp lỗi, vui lòng thử lại.');
                    }
                }
            }
        } catch { /* silent */ }
    }, [workspaceId]);

    const handleStartSync = async () => {
        if (syncing) return;
        try {
            setSyncing(true);
            setSyncStatus({ status: 'running', progress: 0, message: 'Đang bắt đầu đồng bộ...' });
            await zaloService.startSync(workspaceId);
            syncPollRef.current = setInterval(pollSyncStatus, 2000);
        } catch (err: any) {
            setSyncing(false);
            setSyncStatus(null);
            message.error(err?.response?.data?.message || 'Lỗi khi bắt đầu đồng bộ');
        }
    };

    // ── Per-account sync handler ──
    const handleSyncAccount = async (accountId: string) => {
        if (syncingAccountId) return;
        setSyncingAccountId(accountId);
        try {
            const res = await zaloService.syncAccount(workspaceId, accountId);
            const data = res?.data;
            if (data?.name) {
                message.success(`Đã đồng bộ: ${data.name}`);
            } else {
                message.success('Đã đồng bộ dữ liệu tài khoản');
            }
            // Refresh status to show updated name
            refetch();
        } catch (err: any) {
            message.error(err?.response?.data?.message || 'Lỗi khi đồng bộ tài khoản');
        } finally {
            setSyncingAccountId(null);
        }
    };

    // ── Per-account reconnect handler ──
    const handleReconnectAccount = async (accountId: string) => {
        if (reconnectingAccountId) return;
        setReconnectingAccountId(accountId);
        try {
            const res = await zaloService.reconnectAccount(workspaceId, accountId);
            const data = res?.data;
            message.success(data?.message || 'Đã kết nối lại thành công!');
            // Refresh status to show updated connection state
            await refetch();
        } catch (err: any) {
            const errMsg = err?.response?.data?.error?.message || err?.response?.data?.message || 'Không thể kết nối lại. Vui lòng quét QR mới.';
            const errorCode = err?.response?.data?.error?.code;
            if (errorCode === 'NO_CREDENTIALS' || errorCode === 'RECONNECT_FAILED') {
                Modal.confirm({
                    title: 'Phiên Zalo đã hết hạn',
                    content: `${errMsg} Quét QR mới để tạo lại phiên kết nối?`,
                    okText: 'Quét QR mới',
                    cancelText: 'Để sau',
                    onOk: handleConnect,
                });
            } else {
                message.error(errMsg);
            }
        } finally {
            setReconnectingAccountId(null);
        }
    };

    const handleReconnectAll = async () => {
        if (reconnectingAll || reconnectingAccountId) return;
        const offlineAccounts = accounts.filter(account => !account.isOnline);
        const restorableAccounts = offlineAccounts.filter(account => account.hasCredentials !== false);
        if (restorableAccounts.length === 0) {
            handleConnect();
            return;
        }

        setReconnectingAll(true);
        let restored = 0;
        for (const account of restorableAccounts) {
            setReconnectingAccountId(account.accountId);
            try {
                await zaloService.reconnectAccount(workspaceId, account.accountId);
                restored += 1;
            } catch { /* tổng hợp kết quả sau khi chạy hết danh sách */ }
        }
        setReconnectingAccountId(null);
        setReconnectingAll(false);
        await refetch();

        if (restored === restorableAccounts.length) {
            message.success(`Đã kết nối lại ${restored} tài khoản Zalo`);
        } else if (restored > 0) {
            message.warning(`Đã khôi phục ${restored}/${restorableAccounts.length} tài khoản. Tài khoản còn lại cần quét QR mới.`);
        } else {
            Modal.confirm({
                title: 'Không thể khôi phục phiên đã lưu',
                content: 'Các phiên Zalo có thể đã hết hạn. Quét QR mới để kết nối lại?',
                okText: 'Quét QR mới',
                cancelText: 'Để sau',
                onOk: handleConnect,
            });
        }
    };

    const openNetworkProfile = async (accountId: string) => {
        setNetworkAccountId(accountId);
        setNetworkLoading(true);
        try {
            const response = await zaloService.getNetworkProfile(workspaceId, accountId);
            networkForm.setFieldsValue({
                enabled: false,
                protocol: 'http',
                expectedCountry: 'VN',
                ...response?.data,
                password: '',
            });
        } catch (error: any) {
            message.error(error?.response?.data?.error?.message || 'Không tải được Network Profile');
        } finally {
            setNetworkLoading(false);
        }
    };

    const saveNetworkProfile = async () => {
        if (!networkAccountId) return;
        try {
            const values = await networkForm.validateFields();
            setNetworkSaving(true);
            await zaloService.saveNetworkProfile(workspaceId, networkAccountId, values);
            networkForm.setFieldValue('password', '');
            message.success('Đã lưu Network Profile. Bấm kết nối lại để áp dụng proxy tĩnh.');
        } catch (error: any) {
            if (error?.errorFields) return;
            message.error(error?.response?.data?.error?.message || 'Không lưu được Network Profile');
        } finally {
            setNetworkSaving(false);
        }
    };

    const testNetworkProfile = async () => {
        if (!networkAccountId) return;
        setNetworkTesting(true);
        try {
            const response = await zaloService.testNetworkProfile(workspaceId, networkAccountId);
            const result = response?.data;
            if (result?.ok) message.success(`Proxy hoạt động · IP ${result.exitIp || '?'} · ${result.country || '?'}`);
            else message.warning(result?.error || 'IP proxy không đúng khu vực mong đợi');
        } catch (error: any) {
            message.error(error?.response?.data?.error?.message || 'Kiểm tra proxy thất bại');
        } finally {
            setNetworkTesting(false);
        }
    };

    useEffect(() => { return () => { if (syncPollRef.current) clearInterval(syncPollRef.current); }; }, []);

    // Auto-close QR only when a NEW account successfully logged in
    // (accounts.length increases compared to when QR was opened)
    useEffect(() => {
        if (localQrUrl && accounts.length > accountsCountOnQrOpen.current && accounts.some(a => a.isOnline)) {
            const timer = setTimeout(() => { if (localQrUrl) setLocalQrUrl(null); }, 2000);
            return () => clearTimeout(timer);
        }
    }, [accounts, localQrUrl]);

    const syncPercent = syncStatus?.progress != null
        ? Math.round(syncStatus.progress)
        : syncStatus?.total && syncStatus?.completed
            ? Math.round((syncStatus.completed / syncStatus.total) * 100)
            : 0;

    return (
        <div className="rounded-[28px] border border-slate-200/80 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)] overflow-hidden" style={{ marginTop: 24 }}>
            {/* ─── Header ─── */}
            <div className="flex items-center gap-4 border-b border-slate-100" style={{ padding: '24px 28px' }}>
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 ring-1 ring-blue-100">
                    <Smartphone size={20} strokeWidth={1.8} />
                </div>
                <div className="min-w-0 flex-1">
                    <h3 className="m-0 text-[16px] font-semibold tracking-tight text-slate-900">Tích hợp Zalo Cá Nhân</h3>
                    <p className="m-0 text-[13px] text-slate-500 leading-6">Kết nối nhiều tài khoản Zalo để nhận và trả lời tin nhắn trực tiếp</p>
                </div>
                {!isLoading && accounts.length > 0 && (
                    <span className="inline-flex h-7 items-center gap-2 rounded-full px-3 text-[12px] font-semibold shrink-0 border border-emerald-200 bg-emerald-50 text-emerald-700">
                        <Users size={13} />
                        {accounts.length} tài khoản
                    </span>
                )}
            </div>

            {/* ─── Body ─── */}
            <div style={{ padding: '28px' }}>
                {isLoading ? (
                    <div className="flex min-h-[200px] items-center justify-center"><Spin size="large" /></div>
                ) : (
                    <div className="space-y-5">
                        <div className="grid gap-3 md:grid-cols-3">
                            {[
                                { icon: ScanLine, title: '1. Kết nối phiên', desc: 'Quét QR hoặc khôi phục phiên đã lưu để giữ kênh online.', tone: '#2563eb' },
                                { icon: Database, title: '2. Đồng bộ hội thoại', desc: 'Kéo avatar, tên khách và lịch sử chat về Inbox CSKH.', tone: '#7c3aed' },
                                { icon: MessageSquare, title: '3. Agent xử lý', desc: 'Mở Inbox Zalo, phân công agent và bật AI auto-reply khi cần.', tone: '#059669' },
                            ].map((item) => (
                                <div key={item.title} className="rounded-2xl border border-slate-200 bg-white" style={{ padding: 14 }}>
                                    <div className="flex items-start gap-3">
                                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: `${item.tone}14`, color: item.tone }}>
                                            <item.icon size={17} />
                                        </div>
                                        <div>
                                            <div className="text-[13px] font-bold text-slate-900">{item.title}</div>
                                            <div className="mt-1 text-[12px] leading-5 text-slate-500">{item.desc}</div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* ── Disconnected Alert Banner ── */}
                        {accounts.some(a => !a.isOnline) && (
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-amber-900">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                                        <WifiOff size={18} />
                                    </div>
                                    <div>
                                        <div className="text-[13px] font-bold">Phát hiện tài khoản Zalo bị Mất kết nối</div>
                                        <div className="text-[12px] text-amber-700">Hệ thống đang tự động khôi phục ngầm. Bạn cũng có thể bấm "Kết nối lại" để khôi phục ngay lập tức.</div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => void handleReconnectAll()}
                                    disabled={reconnectingAll}
                                    className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-amber-600 px-4 text-[12px] font-semibold text-white transition-colors hover:bg-amber-700 shadow-sm"
                                >
                                    {reconnectingAll ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                                    {reconnectingAll ? 'Đang khôi phục...' : 'Kết nối lại tất cả'}
                                </button>
                            </div>
                        )}

                        {/* ── Connected Accounts List ── */}
                        {accounts.length > 0 && (
                            <div className="space-y-3">
                                {accounts.map(account => (
                                    <div key={account.accountId} className="flex items-center gap-4 rounded-2xl border border-slate-200/70 bg-slate-50/70 transition-all duration-200 hover:border-slate-300/80 hover:shadow-sm" style={{ padding: '16px 20px' }}>
                                        <div className="relative shrink-0">
                                            {account.avatar ? (
                                                <img src={account.avatar} alt={account.name} className="rounded-xl object-cover" style={{ width: 44, height: 44 }} />
                                            ) : (
                                                <div className="flex items-center justify-center rounded-xl bg-blue-50 text-blue-600" style={{ width: 44, height: 44, fontSize: 18, fontWeight: 600 }}>
                                                    {account.name?.charAt(0) || 'Z'}
                                                </div>
                                            )}
                                            <span className={['absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white', account.isOnline ? 'bg-emerald-500' : 'bg-slate-300'].join(' ')} />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <h4 className="m-0 text-[15px] font-semibold tracking-tight text-slate-900 truncate">{account.name}</h4>
                                            <div className="flex items-center gap-2 text-[12px] text-slate-500">
                                                {account.isOnline ? (<><Wifi size={12} className="text-emerald-500" /><span className="text-emerald-600 font-medium">Đang hoạt động</span></>) : (<><WifiOff size={12} className="text-slate-400" /><span className="text-amber-600 font-medium">Mất kết nối</span></>)}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <Tooltip title="Cấu hình Proxy tĩnh (HTTP/HTTPS/SOCKS5) giữ IP mạng ổn định cho tài khoản này">
                                                <button onClick={() => void openNetworkProfile(account.accountId)}
                                                    className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50/80 px-3 text-[12px] font-semibold text-blue-700 transition-colors hover:border-blue-300 hover:bg-blue-100">
                                                    <Network size={14} /> Proxy & Chuyên sâu
                                                </button>
                                            </Tooltip>
                                            {/* Per-account reconnect button */}
                                            {!account.isOnline && (
                                                account.hasCredentials !== false ? (
                                                    <Tooltip title="Kết nối lại từ phiên đã lưu">
                                                        <button onClick={() => handleReconnectAccount(account.accountId)}
                                                            disabled={reconnectingAccountId === account.accountId}
                                                            onMouseEnter={() => setHoverBtn(`reconnect-${account.accountId}`)} onMouseLeave={() => setHoverBtn(null)}
                                                            className="inline-flex h-9 items-center gap-1.5 rounded-xl border transition-all duration-200"
                                                            style={{ padding: '0 12px', cursor: reconnectingAccountId === account.accountId ? 'not-allowed' : 'pointer', opacity: reconnectingAccountId === account.accountId ? 0.5 : 1, background: hoverBtn === `reconnect-${account.accountId}` ? '#ecfdf5' : 'white', borderColor: hoverBtn === `reconnect-${account.accountId}` ? '#6ee7b7' : '#e2e8f0', color: '#059669', fontSize: 12, fontWeight: 600 }}
                                                        >
                                                            {reconnectingAccountId === account.accountId ? <Loader2 size={14} className="animate-spin" /> : <Wifi size={14} />}
                                                            {reconnectingAccountId === account.accountId ? 'Đang kết nối...' : 'Kết nối lại'}
                                                        </button>
                                                    </Tooltip>
                                                ) : (
                                                    <Tooltip title="Bấm để quét mã QR mới kết nối lại">
                                                        <button onClick={handleConnect}
                                                            disabled={isGenerating}
                                                            onMouseEnter={() => setHoverBtn(`reconnect-qr-${account.accountId}`)} onMouseLeave={() => setHoverBtn(null)}
                                                            className="inline-flex h-9 items-center gap-1.5 rounded-xl border transition-all duration-200"
                                                            style={{ padding: '0 12px', cursor: isGenerating ? 'not-allowed' : 'pointer', opacity: isGenerating ? 0.5 : 1, background: hoverBtn === `reconnect-qr-${account.accountId}` ? '#eff6ff' : 'white', borderColor: hoverBtn === `reconnect-qr-${account.accountId}` ? '#93c5fd' : '#cbd5e1', color: '#2563eb', fontSize: 12, fontWeight: 600 }}
                                                        >
                                                            {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <ScanLine size={14} />}
                                                            {isGenerating ? 'Đang tạo QR...' : 'Quét QR kết nối lại'}
                                                        </button>
                                                    </Tooltip>
                                                )
                                            )}
                                            {/* Per-account sync button */}
                                            {account.isOnline && (
                                                <Tooltip title="Đồng bộ tên & dữ liệu">
                                                    <button onClick={() => handleSyncAccount(account.accountId)}
                                                        disabled={syncingAccountId === account.accountId}
                                                        onMouseEnter={() => setHoverBtn(`sync-${account.accountId}`)} onMouseLeave={() => setHoverBtn(null)}
                                                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border transition-all duration-200"
                                                        style={{ cursor: syncingAccountId === account.accountId ? 'not-allowed' : 'pointer', opacity: syncingAccountId === account.accountId ? 0.5 : 1, background: hoverBtn === `sync-${account.accountId}` ? '#eef2ff' : 'white', borderColor: hoverBtn === `sync-${account.accountId}` ? '#c7d2fe' : '#e2e8f0', color: '#6366f1' }}
                                                    >
                                                        {syncingAccountId === account.accountId ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                                                    </button>
                                                </Tooltip>
                                            )}
                                            <button onClick={() => setConfirmDisconnect(account.accountId)} disabled={isDisconnecting}
                                                onMouseEnter={() => setHoverBtn(`del-${account.accountId}`)} onMouseLeave={() => setHoverBtn(null)}
                                                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border transition-all duration-200"
                                                style={{ cursor: isDisconnecting ? 'not-allowed' : 'pointer', opacity: isDisconnecting ? 0.5 : 1, background: hoverBtn === `del-${account.accountId}` ? '#fef2f2' : 'white', borderColor: hoverBtn === `del-${account.accountId}` ? '#fecaca' : '#e2e8f0', color: '#ef4444' }}
                                                title="Ngắt kết nối">
                                                <Trash2 size={15} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* ── Advanced Configuration & Bot Automation Panel ── */}
                        {accounts.length > 0 && !localQrUrl && (
                            <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-5 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2.5">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm">
                                            <Zap size={16} />
                                        </div>
                                        <div>
                                            <h4 className="m-0 text-[14px] font-bold text-slate-900">Cấu hình chuyên sâu & Bot Tự động hóa Zalo</h4>
                                            <p className="m-0 text-[12px] text-slate-500">Quản lý Proxy tĩnh, kịch bản Bot AI và tự động kết bạn nhóm Zalo</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid gap-3 md:grid-cols-3">
                                    <div className="rounded-xl border border-slate-200 bg-white p-3.5 flex flex-col justify-between space-y-3">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2 text-[13px] font-semibold text-slate-800">
                                                <Network size={15} className="text-blue-600" />
                                                <span>Proxy Tĩnh (Dedicated)</span>
                                            </div>
                                            <p className="m-0 text-[11px] leading-4 text-slate-500">Gán IP tĩnh riêng (HTTP/HTTPS/SOCKS5) cho từng nick Zalo để bảo vệ tài khoản.</p>
                                        </div>
                                        <button
                                            onClick={() => accounts[0] && void openNetworkProfile(accounts[0].accountId)}
                                            className="w-full inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 text-[11px] font-semibold text-blue-700 hover:bg-blue-100 transition-colors"
                                        >
                                            <Network size={13} /> Thiết lập Proxy Zalo
                                        </button>
                                    </div>

                                    <div className="rounded-xl border border-slate-200 bg-white p-3.5 flex flex-col justify-between space-y-3">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2 text-[13px] font-semibold text-slate-800">
                                                <Zap size={15} className="text-amber-500" />
                                                <span>Bot AI Auto-Reply</span>
                                            </div>
                                            <p className="m-0 text-[11px] leading-4 text-slate-500">AI tự trả lời khách Zalo theo kho trí thức, giả lập gõ phím & theo dõi kịch bản bán hàng.</p>
                                        </div>
                                        <button
                                            onClick={() => router.push(`/workspace/${workspaceId}/chatbot`)}
                                            className="w-full inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 text-[11px] font-semibold text-amber-700 hover:bg-amber-100 transition-colors"
                                        >
                                            <Zap size={13} /> Cấu hình Bot AI
                                        </button>
                                    </div>

                                    <div className="rounded-xl border border-slate-200 bg-white p-3.5 flex flex-col justify-between space-y-3">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2 text-[13px] font-semibold text-slate-800">
                                                <Users size={15} className="text-emerald-600" />
                                                <span>Auto Kết bạn & Quét Nhóm</span>
                                            </div>
                                            <p className="m-0 text-[11px] leading-4 text-slate-500">Tự động kết bạn với thành viên trong Nhóm Zalo & lưu tự động vào tập Leads CRM.</p>
                                        </div>
                                        <button
                                            onClick={() => router.push(`/workspace/${workspaceId}/contacts`)}
                                            className="w-full inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors"
                                        >
                                            <Users size={13} /> Quản lý Tự động hóa
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ── Sync Section ── */}
                        {accounts.length > 0 && !localQrUrl && (
                            <div className="grid gap-3">
                                <button
                                    onClick={openZaloInbox}
                                    onMouseEnter={() => setHoverBtn('open-zalo-inbox')}
                                    onMouseLeave={() => setHoverBtn(null)}
                                    className="flex items-center gap-3 rounded-lg border text-left transition-all duration-200"
                                    style={{
                                        padding: '16px 18px',
                                        cursor: 'pointer',
                                        background: hoverBtn === 'open-zalo-inbox' ? '#f0fdf4' : '#fff',
                                        borderColor: hoverBtn === 'open-zalo-inbox' ? '#bbf7d0' : '#e2e8f0',
                                    }}
                                >
                                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-600">
                                        <MessageSquare size={18} />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block text-[13px] font-semibold text-slate-900">Mở Inbox CSKH · Zalo</span>
                                        <span className="block text-[12px] leading-5 text-slate-500">Xử lý hội thoại đã đồng bộ trong Inbox hợp nhất.</span>
                                    </span>
                                    <ArrowRight size={16} color="#94a3b8" />
                                </button>
                            </div>
                        )}

                        {accounts.length > 0 && hasAnyConnected && !localQrUrl && (
                            <div className="rounded-2xl border border-indigo-200/80 bg-gradient-to-r from-indigo-50/80 to-violet-50/60" style={{ padding: '20px 24px' }}>
                                <div className="flex items-start gap-4">
                                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600 ring-1 ring-indigo-200">
                                        <Database size={18} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <h4 className="m-0 text-[14px] font-semibold text-slate-900 tracking-tight">Đồng bộ dữ liệu Zalo</h4>
                                        <p className="m-0 text-[12px] text-slate-500 leading-5 mt-1">
                                            Khôi phục toàn bộ hội thoại, thu thập avatar và thông tin khách hàng từ tất cả tài khoản Zalo đã kết nối.
                                        </p>

                                        {syncing && syncStatus && (
                                            <div className="mt-3 space-y-2">
                                                <Progress percent={syncPercent} size="small" strokeColor={{ from: '#6366f1', to: '#8b5cf6' }} status={syncStatus.status === 'error' ? 'exception' : 'active'} />
                                                <p className="m-0 text-[11px] text-slate-500 flex items-center gap-1.5">
                                                    <Loader2 size={11} className="animate-spin" />
                                                    {syncStatus.message || `Đang đồng bộ... ${syncStatus.completed || 0}/${syncStatus.total || '?'} hội thoại`}
                                                </p>
                                            </div>
                                        )}

                                        {!syncing && syncStatus?.status === 'completed' && (
                                            <div className="mt-3 flex items-center gap-2 text-emerald-600 text-[12px] font-medium">
                                                <CheckCircle2 size={14} />
                                                Đồng bộ hoàn tất! {syncStatus.completed || 0} hội thoại đã xử lý.
                                            </div>
                                        )}
                                    </div>

                                    <button onClick={handleStartSync} disabled={syncing}
                                        onMouseEnter={() => setHoverBtn('sync')} onMouseLeave={() => setHoverBtn(null)}
                                        className="inline-flex h-10 items-center gap-2 rounded-xl border text-[13px] font-semibold transition-all duration-200 shrink-0 whitespace-nowrap"
                                        style={{ padding: '0 18px', cursor: syncing ? 'not-allowed' : 'pointer', opacity: syncing ? 0.6 : 1, background: syncing ? '#eef2ff' : hoverBtn === 'sync' ? '#4f46e5' : '#6366f1', borderColor: 'transparent', color: '#fff', boxShadow: syncing ? 'none' : '0 4px 12px rgba(99, 102, 241, 0.25)' }}>
                                        {syncing ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                                        {syncing ? 'Đang đồng bộ...' : 'Đồng bộ ngay'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* ── QR Code ── */}
                        {localQrUrl && (
                            <div className="space-y-5">
                                <div className="flex items-center gap-3 rounded-2xl border border-blue-200/80 bg-blue-50/60" style={{ padding: '14px 18px' }}>
                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-600"><ScanLine size={16} /></div>
                                    <div className="min-w-0">
                                        <p className="m-0 text-[13px] font-semibold text-blue-800">Quét mã QR bằng Zalo</p>
                                        <p className="m-0 text-[12px] text-blue-600">Mở ứng dụng Zalo → Quét mã bên dưới để thêm tài khoản mới</p>
                                    </div>
                                </div>
                                <div className="flex justify-center">
                                    <div className="relative rounded-[20px] border border-slate-200/80 bg-white shadow-[0_4px_24px_rgba(15,23,42,0.06)]" style={{ padding: '28px' }}>
                                        <img src={localQrUrl} alt="Zalo QR Code" className="block rounded-xl" style={{ width: 220, height: 220 }} />
                                    </div>
                                </div>
                                <div className="flex justify-center gap-3">
                                    <button onClick={() => refetch()} onMouseEnter={() => setHoverBtn('refresh')} onMouseLeave={() => setHoverBtn(null)}
                                        className="inline-flex h-10 items-center gap-2 rounded-xl border text-[13px] font-medium transition-all duration-200"
                                        style={{ padding: '0 16px', cursor: 'pointer', background: hoverBtn === 'refresh' ? '#f8fafc' : 'white', borderColor: hoverBtn === 'refresh' ? '#cbd5e1' : '#e2e8f0', color: '#475569' }}>
                                        <RefreshCw size={14} /> Kiểm tra
                                    </button>
                                    <button onClick={() => setLocalQrUrl(null)} onMouseEnter={() => setHoverBtn('cancel')} onMouseLeave={() => setHoverBtn(null)}
                                        className="inline-flex h-10 items-center gap-2 rounded-xl border text-[13px] font-medium transition-all duration-200"
                                        style={{ padding: '0 16px', cursor: 'pointer', background: hoverBtn === 'cancel' ? '#fef2f2' : 'white', borderColor: hoverBtn === 'cancel' ? '#fecaca' : '#e2e8f0', color: '#ef4444' }}>
                                        Huỷ
                                    </button>
                                </div>
                                <p className="m-0 text-center text-[11px] text-slate-400">Trạng thái tự động cập nhật sau khi quét mã</p>
                            </div>
                        )}

                        {/* ── Add Account Button ── */}
                        {!localQrUrl && (
                            <button onClick={handleConnect} disabled={isGenerating}
                                onMouseEnter={() => setHoverBtn('add')} onMouseLeave={() => setHoverBtn(null)}
                                className="inline-flex h-12 w-full items-center justify-center gap-2.5 rounded-2xl border-2 border-dashed text-[14px] font-semibold transition-all duration-200"
                                style={{ cursor: isGenerating ? 'not-allowed' : 'pointer', opacity: isGenerating ? 0.7 : 1, background: hoverBtn === 'add' && !isGenerating ? '#eef2ff' : '#fafbfc', borderColor: hoverBtn === 'add' && !isGenerating ? '#818cf8' : '#e2e8f0', color: hoverBtn === 'add' && !isGenerating ? '#4f46e5' : '#64748b' }}>
                                {isGenerating ? <Spin size="small" /> : <Plus size={18} />}
                                {accounts.length === 0 ? 'Kết nối Zalo đầu tiên' : 'Thêm tài khoản Zalo'}
                            </button>
                        )}

                        {/* Feature hints */}
                        {accounts.length === 0 && !localQrUrl && (
                            <div className="flex flex-wrap justify-center gap-3 pt-2">
                                {[{ icon: Wifi, text: 'Đồng bộ tin nhắn' }, { icon: Zap, text: 'Phản hồi nhanh' }, { icon: Users, text: 'Nhiều tài khoản' }, { icon: CheckCircle2, text: 'Quản lý tập trung' }].map((f, i) => (
                                    <span key={i} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50/80 px-3 py-1.5 text-[12px] font-medium text-slate-500">
                                        <f.icon size={13} /> {f.text}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            <Modal open={!!confirmDisconnect} title="Ngắt kết nối Zalo" onCancel={() => setConfirmDisconnect(null)}
                okText="Ngắt kết nối" cancelText="Huỷ" okButtonProps={{ danger: true, loading: isDisconnecting }}
                onOk={() => confirmDisconnect && handleDisconnect(confirmDisconnect)}>
                <p>Bạn có chắc muốn ngắt kết nối tài khoản Zalo này? Tin nhắn mới từ tài khoản này sẽ không được đồng bộ nữa.</p>
            </Modal>

            <Modal
                open={!!networkAccountId}
                title={<span className="inline-flex items-center gap-2"><Network size={18} /> Network Profile · Proxy tĩnh</span>}
                onCancel={() => { setNetworkAccountId(null); networkForm.resetFields(); }}
                onOk={() => void saveNetworkProfile()}
                okText="Lưu cấu hình"
                cancelText="Đóng"
                confirmLoading={networkSaving}
                width={620}
            >
                {networkLoading ? <div className="grid min-h-52 place-items-center"><Spin /></div> : <>
                    <Alert
                        showIcon
                        type="info"
                        message="Mỗi tài khoản dùng một proxy ổn định"
                        description="Proxy giúp giữ đường mạng nhất quán, không bảo đảm Zalo không hạn chế tài khoản. Không xoay IP và không dùng để né chính sách."
                        className="mb-4"
                    />
                    <Form form={networkForm} layout="vertical" initialValues={{ enabled: false, protocol: 'http', expectedCountry: 'VN' }}>
                        <Form.Item name="enabled" valuePropName="checked"><Checkbox>Bật proxy cho tài khoản này</Checkbox></Form.Item>
                        <div className="grid grid-cols-[140px_1fr_120px] gap-3">
                            <Form.Item name="protocol" label="Giao thức"><Select options={['http', 'https', 'socks5'].map(value => ({ value, label: value.toUpperCase() }))} /></Form.Item>
                            <Form.Item name="host" label="Host proxy"><Input placeholder="proxy.example.com" /></Form.Item>
                            <Form.Item name="port" label="Port"><InputNumber min={1} max={65535} className="w-full" /></Form.Item>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <Form.Item name="username" label="Username"><Input autoComplete="off" /></Form.Item>
                            <Form.Item name="password" label="Password" extra="Để trống để giữ mật khẩu đã lưu."><Input.Password autoComplete="new-password" /></Form.Item>
                        </div>
                        <Form.Item name="expectedCountry" label="Mã quốc gia IP mong đợi"><Input maxLength={2} placeholder="VN" style={{ width: 120 }} /></Form.Item>
                        <Form.Item
                            name="staticAcknowledged"
                            valuePropName="checked"
                            rules={[{ validator: (_, value) => value ? Promise.resolve() : Promise.reject(new Error('Cần xác nhận trước khi lưu')) }]}
                        >
                            <Checkbox>Tôi xác nhận dùng proxy tĩnh, không xoay IP và không dùng để né chính sách.</Checkbox>
                        </Form.Item>
                    </Form>
                    <button
                        type="button"
                        onClick={() => void testNetworkProfile()}
                        disabled={networkTesting}
                        className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[12px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                        {networkTesting ? <Loader2 size={14} className="animate-spin" /> : <Wifi size={14} />}
                        Kiểm tra IP đã lưu
                    </button>
                </>}
            </Modal>
        </div>
    );
}
