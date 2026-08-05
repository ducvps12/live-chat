import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { Alert, Button, Form, Input, Modal, Popconfirm, Select, Spin, Switch, Tag, message } from 'antd';
import { BellRing, CheckCircle2, Clock3, ExternalLink, Pause, Play, Plus, Radar, RefreshCw, Send, Trash2, TriangleAlert } from 'lucide-react';
import AppLayout from '../../../components/layout/AppLayout';
import { useGetMe } from '../../../domains/auth/auth.hooks';
import { useMyWorkspaces } from '../../../domains/workspace/workspace.hooks';
import { signalRadarAPI, type SignalAlertSetting, type SignalAlertUpdate, type SignalMonitor, type SignalRadarEntitlements } from '../../../services/signal-radar.service';

type CreateValues = { name: string; url: string; intervalMinutes: number };
type AlertValues = SignalAlertUpdate;

const statusMeta: Record<string, { label: string; color: string }> = {
    pending: { label: 'Chờ kiểm tra', color: 'gold' },
    healthy: { label: 'Ổn định', color: 'green' },
    changed: { label: 'Có thay đổi', color: 'blue' },
    error: { label: 'Lỗi kiểm tra', color: 'red' },
    paused: { label: 'Tạm dừng', color: 'default' },
};

function errorText(error: unknown) {
    const candidate = error as { response?: { data?: { message?: string; error?: { message?: string } } }; message?: string };
    return candidate.response?.data?.error?.message || candidate.response?.data?.message || candidate.message || 'Có lỗi xảy ra';
}

function errorStatus(error: unknown) {
    return (error as { response?: { status?: number } })?.response?.status;
}

function when(value?: string | null) {
    if (!value) return 'Chưa có';
    return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

export default function SignalRadarPage() {
    const router = useRouter();
    const workspaceId = typeof router.query.workspaceId === 'string' ? router.query.workspaceId : '';
    const { data: meData, isLoading: meLoading } = useGetMe(true);
    const { data: workspaceData, isLoading: workspacesLoading } = useMyWorkspaces();
    const [toast, contextHolder] = message.useMessage();
    const [monitors, setMonitors] = useState<SignalMonitor[]>([]);
    const [entitlements, setEntitlements] = useState<SignalRadarEntitlements | null>(null);
    const [alerts, setAlerts] = useState<SignalAlertSetting | null>(null);
    const [loading, setLoading] = useState(true);
    const [alertsLoading, setAlertsLoading] = useState(true);
    const [alertsForbidden, setAlertsForbidden] = useState(false);
    const [alertsError, setAlertsError] = useState('');
    const [checkingId, setCheckingId] = useState('');
    const [createOpen, setCreateOpen] = useState(false);
    const [createForm] = Form.useForm<CreateValues>();
    const [alertForm] = Form.useForm<AlertValues>();
    const telegramEnabled = Form.useWatch('telegramEnabled', alertForm);

    const user = meData?.data?.user;
    const workspaces = workspaceData?.data || [];
    const currentWorkspace = workspaces.find((workspace) => {
        const normalized = workspace as typeof workspace & { id?: string };
        return (normalized.id || normalized._id) === workspaceId;
    });
    const currentMembership = currentWorkspace?.members?.find((member) => member.userId === user?.id);
    const canManageRadar = Boolean(
        workspaceId
        && (
            user?.role === 'admin'
            || currentWorkspace?.ownerId === user?.id
            || currentMembership?.role === 'owner'
            || currentMembership?.role === 'admin'
        )
    );
    const workspaceAccessResolved = !meLoading && !workspacesLoading;

    const loadRadar = useCallback(async () => {
        if (!workspaceId || !canManageRadar) return;
        setLoading(true);
        try {
            const [monitorData, entitlementData] = await Promise.all([
                signalRadarAPI.list(workspaceId),
                signalRadarAPI.entitlements(workspaceId),
            ]);
            setMonitors(monitorData);
            setEntitlements(entitlementData);
        } catch (error) {
            toast.error(errorText(error));
        } finally {
            setLoading(false);
        }
    }, [canManageRadar, toast, workspaceId]);

    const loadAlerts = useCallback(async () => {
        if (!workspaceId || !canManageRadar) return;
        setAlertsLoading(true);
        setAlertsForbidden(false);
        setAlertsError('');
        try {
            const alertData = await signalRadarAPI.getAlerts(workspaceId);
            setAlerts(alertData);
            alertForm.setFieldsValue({ ...alertData, telegramBotToken: '' });
        } catch (error) {
            if (errorStatus(error) === 403) {
                setAlerts(null);
                setAlertsForbidden(true);
            } else {
                setAlertsError(errorText(error));
            }
        } finally {
            setAlertsLoading(false);
        }
    }, [alertForm, canManageRadar, workspaceId]);

    useEffect(() => {
        if (!workspaceAccessResolved) return;
        if (!canManageRadar) {
            setLoading(false);
            setAlertsLoading(false);
            return;
        }
        void loadRadar();
        void loadAlerts();
    }, [canManageRadar, loadAlerts, loadRadar, workspaceAccessResolved]);

    const stats = useMemo(() => ({
        active: monitors.filter((item) => item.isActive).length,
        changes: monitors.filter((item) => item.status === 'changed').length,
        errors: monitors.filter((item) => item.status === 'error').length,
    }), [monitors]);

    const createMonitor = async (values: CreateValues) => {
        try {
            await signalRadarAPI.create(workspaceId, values);
            setCreateOpen(false);
            createForm.resetFields();
            toast.success('Đã thêm nguồn theo dõi');
            await loadRadar();
        } catch (error) { toast.error(errorText(error)); }
    };

    const checkNow = async (monitor: SignalMonitor) => {
        setCheckingId(monitor.id);
        try {
            const result = await signalRadarAPI.check(workspaceId, monitor.id);
            const checkResult = result as typeof result & { status?: string; error?: string };
            if (checkResult.status === 'error' || checkResult.error) {
                toast.error(checkResult.error || checkResult.summary || 'Không thể kiểm tra website');
            } else {
                toast.success(checkResult.changed ? 'Phát hiện nội dung thay đổi' : 'Website chưa có thay đổi');
            }
            await loadRadar();
        } catch (error) { toast.error(errorText(error)); }
        finally { setCheckingId(''); }
    };

    const toggleMonitor = async (monitor: SignalMonitor) => {
        try {
            await signalRadarAPI.update(workspaceId, monitor.id, { isActive: !monitor.isActive });
            await loadRadar();
        } catch (error) { toast.error(errorText(error)); }
    };

    const deleteMonitor = async (monitor: SignalMonitor) => {
        try {
            await signalRadarAPI.remove(workspaceId, monitor.id);
            toast.success('Đã xóa nguồn theo dõi');
            await loadRadar();
        } catch (error) { toast.error(errorText(error)); }
    };

    const saveAlerts = async (values: AlertValues) => {
        try {
            const saved = await signalRadarAPI.saveAlerts(workspaceId, values);
            setAlerts(saved);
            alertForm.setFieldsValue({ ...saved, telegramBotToken: '' });
            toast.success('Đã lưu cấu hình cảnh báo riêng của workspace');
        } catch (error) { toast.error(errorText(error)); }
    };

    const testAlerts = async () => {
        try {
            const values = alertForm.getFieldsValue();
            await signalRadarAPI.testAlerts(workspaceId, { telegramBotToken: values.telegramBotToken, telegramChatId: values.telegramChatId });
            toast.success('Đã gửi tin nhắn thử tới Telegram');
        } catch (error) { toast.error(errorText(error)); }
    };

    const clearSavedToken = async () => {
        try {
            const values = alertForm.getFieldsValue();
            const saved = await signalRadarAPI.saveAlerts(workspaceId, {
                telegramEnabled: false,
                telegramChatId: values.telegramChatId || '',
                notifyOnChange: values.notifyOnChange !== false,
                notifyOnError: values.notifyOnError !== false,
                telegramBotToken: '',
                clearTelegramBotToken: true,
            });
            setAlerts(saved);
            alertForm.setFieldsValue({ ...saved, telegramBotToken: '' });
            toast.success('Đã xóa Bot Token và tắt cảnh báo Telegram');
        } catch (error) { toast.error(errorText(error)); }
    };

    if (!workspaceAccessResolved) {
        return (
            <AppLayout headerTitle={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}><Radar size={22} /> Radar tín hiệu</span>}>
                {contextHolder}
                <div style={{ minHeight: 420, display: 'grid', placeItems: 'center' }}><Spin size="large" /></div>
            </AppLayout>
        );
    }

    if (!canManageRadar) {
        return (
            <AppLayout headerTitle={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}><Radar size={22} /> Radar tín hiệu</span>}>
                {contextHolder}
                <main style={{ maxWidth: 920, margin: '0 auto', padding: 24 }}>
                    <Alert
                        showIcon
                        type="warning"
                        message="Bạn không có quyền quản lý Radar của workspace này"
                        description="Radar chỉ dành cho chủ sở hữu, quản trị viên workspace hoặc quản trị viên hệ thống. Hãy nhờ chủ workspace cấp đúng vai trò nếu bạn cần cấu hình nguồn theo dõi."
                    />
                </main>
            </AppLayout>
        );
    }

    return (
        <AppLayout headerTitle={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}><Radar size={22} /> Radar tín hiệu</span>}>
            {contextHolder}
            <main className="radar-page">
                <section className="radar-hero">
                    <div>
                        <span className="eyebrow">THEO DÕI THAY ĐỔI WEBSITE</span>
                        <h1>Biết tín hiệu quan trọng trước khi bỏ lỡ</h1>
                        <p>Theo dõi trang giá, học bổng, tuyển dụng hoặc chính sách. NemarkChat lưu mốc thay đổi và báo Telegram tự động.</p>
                    </div>
                    <Button type="primary" size="large" icon={<Plus size={17} />} onClick={() => setCreateOpen(true)} disabled={!entitlements?.active || monitors.length >= (entitlements?.maxMonitors || 0)}>
                        Thêm nguồn
                    </Button>
                </section>

                <section className="metric-grid">
                    <div className="metric"><Radar /><span>Đang theo dõi</span><strong>{stats.active}</strong></div>
                    <div className="metric"><BellRing /><span>Phát hiện thay đổi</span><strong>{stats.changes}</strong></div>
                    <div className="metric"><TriangleAlert /><span>Nguồn lỗi</span><strong>{stats.errors}</strong></div>
                    <div className="metric"><Clock3 /><span>Giới hạn gói</span><strong>{monitors.length}/{entitlements?.maxMonitors ?? '—'}</strong></div>
                </section>

                <div className="radar-grid">
                    <section className="panel sources-panel">
                        <div className="panel-head">
                            <div><h2>Nguồn đang theo dõi</h2><p>Tự kiểm tra theo lịch; bạn vẫn có thể kiểm tra ngay.</p></div>
                            <Button icon={<RefreshCw size={16} />} loading={loading} onClick={() => void loadRadar()}>Tải lại</Button>
                        </div>
                        {!loading && monitors.length === 0 ? (
                            <div className="empty-state"><Radar size={38} /><h3>Chưa có nguồn theo dõi</h3><p>Thêm URL đầu tiên để tạo snapshot nội dung.</p></div>
                        ) : monitors.map((monitor) => {
                            const meta = statusMeta[monitor.status] || statusMeta.pending;
                            const latest = monitor.snapshots?.[0];
                            return (
                                <article className="source" key={monitor.id}>
                                    <div className="source-main">
                                        <div className="source-title"><h3>{monitor.name}</h3><Tag color={meta.color}>{meta.label}</Tag></div>
                                        <a href={monitor.url} target="_blank" rel="noreferrer">{monitor.url}<ExternalLink size={13} /></a>
                                        <div className="source-meta"><span>Mỗi {monitor.intervalMinutes >= 1440 ? `${Math.round(monitor.intervalMinutes / 1440)} ngày` : `${monitor.intervalMinutes / 60} giờ`}</span><span>Lần cuối: {when(monitor.lastCheckedAt)}</span></div>
                                        {monitor.lastError && <p className="source-error">{monitor.lastError}</p>}
                                        {latest && <div className="snapshot"><strong>{latest.changed ? 'Thay đổi mới nhất' : 'Mốc ban đầu'}</strong><span>{latest.diffSummary}</span><small>{when(latest.createdAt)}</small></div>}
                                    </div>
                                    <div className="source-actions">
                                        <Button icon={monitor.isActive ? <Pause size={15} /> : <Play size={15} />} onClick={() => void toggleMonitor(monitor)}>{monitor.isActive ? 'Dừng' : 'Bật'}</Button>
                                        <Button
                                            className="radar-check-button"
                                            type="primary"
                                            icon={<RefreshCw size={15} />}
                                            loading={checkingId === monitor.id}
                                            disabled={Boolean(checkingId) && checkingId !== monitor.id}
                                            onClick={() => void checkNow(monitor)}
                                        >
                                            {checkingId === monitor.id ? 'Đang kiểm tra' : 'Kiểm tra'}
                                        </Button>
                                        <Popconfirm title="Xóa nguồn theo dõi này?" onConfirm={() => void deleteMonitor(monitor)}><Button danger aria-label="Xóa" icon={<Trash2 size={15} />} /></Popconfirm>
                                    </div>
                                </article>
                            );
                        })}
                    </section>

                    <section className="panel alert-panel">
                        <div className="alert-heading"><span className="alert-icon"><Send size={20} /></span><div><h2>Telegram riêng</h2><p>Khách tự nhập Bot Token và Chat ID nhận cảnh báo.</p></div></div>
                        {alertsLoading ? (
                            <div className="alerts-loading"><Spin /></div>
                        ) : alertsForbidden ? (
                            <Alert
                                showIcon
                                type="info"
                                message="Bạn chỉ có quyền xem Radar"
                                description="Chỉ chủ sở hữu hoặc quản trị viên workspace mới có thể đọc và thay đổi Bot Token, Chat ID cảnh báo. Danh sách nguồn phía bên trái vẫn hoạt động độc lập."
                            />
                        ) : alertsError ? (
                            <Alert
                                showIcon
                                type="warning"
                                message="Chưa tải được cấu hình Telegram"
                                description={alertsError}
                                action={<Button size="small" onClick={() => void loadAlerts()}>Thử lại</Button>}
                            />
                        ) : (
                            <>
                                {alerts?.hasTelegramBotToken && (
                                    <div className="secret-saved">
                                        <span className="secret-saved-copy"><CheckCircle2 size={16} /> Token đã mã hóa và lưu an toàn</span>
                                        <Popconfirm
                                            title="Xóa Bot Token đã lưu?"
                                            description="Cảnh báo Telegram sẽ được tắt để tránh cấu hình thiếu token."
                                            okText="Xóa token"
                                            cancelText="Hủy"
                                            okButtonProps={{ danger: true }}
                                            onConfirm={() => void clearSavedToken()}
                                        >
                                            <Button type="link" danger size="small">Xóa token</Button>
                                        </Popconfirm>
                                    </div>
                                )}
                                <Form form={alertForm} layout="vertical" onFinish={saveAlerts} initialValues={{ telegramEnabled: false, notifyOnChange: true, notifyOnError: true }}>
                                    <Form.Item name="telegramEnabled" label="Bật cảnh báo" valuePropName="checked"><Switch /></Form.Item>
                                    <Form.Item name="telegramBotToken" label="Bot Token" extra={alerts?.hasTelegramBotToken ? 'Để trống để giữ token hiện tại.' : 'Tạo bot qua @BotFather.'}>
                                        <Input.Password autoComplete="new-password" placeholder={alerts?.hasTelegramBotToken ? '•••••••• (đã lưu)' : '123456:ABC...'} />
                                    </Form.Item>
                                    <Form.Item
                                        name="telegramChatId"
                                        label="Chat ID"
                                        rules={[{ required: Boolean(telegramEnabled), whitespace: true, message: 'Nhập Chat ID nhận cảnh báo' }]}
                                        extra={telegramEnabled ? 'Bắt buộc khi bật cảnh báo.' : 'Có thể để trống khi chưa bật cảnh báo.'}
                                    >
                                        <Input placeholder="-100... hoặc ID cá nhân" />
                                    </Form.Item>
                                    <div className="switch-row"><span>Báo khi nội dung thay đổi</span><Form.Item name="notifyOnChange" valuePropName="checked" noStyle><Switch /></Form.Item></div>
                                    <div className="switch-row"><span>Báo khi nguồn lỗi nhiều lần</span><Form.Item name="notifyOnError" valuePropName="checked" noStyle><Switch /></Form.Item></div>
                                    <div className="alert-actions"><Button icon={<Send size={15} />} onClick={() => void testAlerts()}>Gửi thử</Button><Button type="primary" htmlType="submit">Lưu cảnh báo</Button></div>
                                </Form>
                                <div className="security-note">Token chỉ được gửi khi bạn lưu hoặc kiểm tra. Sau đó giao diện không thể đọc lại secret.</div>
                            </>
                        )}
                    </section>
                </div>
            </main>

            <Modal title="Thêm nguồn theo dõi" open={createOpen} onCancel={() => setCreateOpen(false)} onOk={() => createForm.submit()} okText="Thêm & tạo mốc" cancelText="Hủy">
                <Form form={createForm} layout="vertical" onFinish={createMonitor} initialValues={{ intervalMinutes: entitlements?.minIntervalMinutes || 1440 }}>
                    <Form.Item name="name" label="Tên nguồn" rules={[{ required: true, message: 'Nhập tên dễ nhận biết' }]}><Input placeholder="Giá sản phẩm đối thủ" maxLength={100} /></Form.Item>
                    <Form.Item name="url" label="URL công khai" rules={[{ required: true, type: 'url', message: 'Nhập URL HTTP/HTTPS hợp lệ' }]}><Input placeholder="https://example.com/pricing" /></Form.Item>
                    <Form.Item name="intervalMinutes" label="Tần suất"><Select options={[
                        { value: 15, label: '15 phút' }, { value: 60, label: '1 giờ' }, { value: 360, label: '6 giờ' }, { value: 1440, label: 'Mỗi ngày' }, { value: 10080, label: 'Mỗi tuần' },
                    ].filter((item) => item.value >= (entitlements?.minIntervalMinutes || 1440))} /></Form.Item>
                </Form>
            </Modal>

            <style jsx>{`
                .radar-page{padding:24px;max-width:1560px;margin:0 auto;color:#0f172a}.radar-hero{display:flex;justify-content:space-between;gap:24px;align-items:center;padding:28px 30px;border:1px solid #c7d7fe;border-radius:18px;background:linear-gradient(120deg,#f8fbff,#eef2ff)}.eyebrow{color:#2563eb;font-size:12px;font-weight:800;letter-spacing:.08em}.radar-hero h1{font-size:30px;margin:8px 0}.radar-hero p,.panel-head p,.alert-heading p{color:#64748b;margin:0;line-height:1.6}.metric-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:16px 0}.metric{display:grid;grid-template-columns:auto 1fr;gap:4px 12px;align-items:center;padding:18px;border:1px solid #e2e8f0;border-radius:14px;background:white}.metric svg{grid-row:1/3;color:#4f46e5}.metric span{color:#64748b;font-size:13px}.metric strong{font-size:24px}.radar-grid{display:grid;grid-template-columns:minmax(0,1fr) 370px;gap:16px}.panel{background:white;border:1px solid #e2e8f0;border-radius:16px;padding:20px}.panel-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:8px}.panel h2{font-size:19px;margin:0 0 3px}.source{display:flex;justify-content:space-between;gap:18px;padding:18px 0;border-top:1px solid #eef2f7}.source-main{min-width:0;flex:1}.source-title{display:flex;align-items:center;gap:8px}.source-title h3{font-size:16px;margin:0}.source a{display:flex;align-items:center;gap:5px;color:#2563eb;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:700px;margin:7px 0}.source-meta{display:flex;gap:18px;color:#64748b;font-size:12px}.source-actions{display:flex;gap:7px;align-items:flex-start}.source-actions :global(.radar-check-button){min-width:118px;background:#4f46e5;border-color:#4f46e5;color:#fff;font-weight:700;box-shadow:0 5px 14px rgba(79,70,229,.24)}.source-actions :global(.radar-check-button:hover){background:#4338ca!important;border-color:#4338ca!important;color:#fff!important}.source-actions :global(.radar-check-button.ant-btn-loading){opacity:1}.source-actions :global(.radar-check-button.ant-btn-loading span){opacity:1}.source-error{color:#dc2626;font-size:12px}.snapshot{display:grid;grid-template-columns:auto 1fr auto;gap:10px;margin-top:12px;padding:10px 12px;border-radius:10px;background:#f8fafc;font-size:12px}.snapshot span{color:#475569}.snapshot small{color:#94a3b8}.empty-state{text-align:center;padding:68px 20px;color:#94a3b8}.empty-state h3{color:#334155;margin:12px 0 4px}.alert-heading{display:flex;gap:12px;margin-bottom:16px}.alert-icon{display:grid;place-items:center;width:42px;height:42px;border-radius:12px;background:#eef2ff;color:#4f46e5;flex:0 0 auto}.alerts-loading{min-height:180px;display:grid;place-items:center}.secret-saved{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:8px 10px 8px 12px;margin-bottom:14px;border-radius:9px;background:#ecfdf5;color:#047857;font-size:12px;font-weight:700}.secret-saved-copy{display:flex;gap:7px;align-items:center;min-width:0}.switch-row{display:flex;justify-content:space-between;padding:11px 0;border-bottom:1px solid #eef2f7}.alert-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:18px}.security-note{padding:12px;margin-top:16px;border-radius:10px;background:#f8fafc;color:#64748b;font-size:12px;line-height:1.5}
                @media(max-width:1000px){.metric-grid{grid-template-columns:repeat(2,1fr)}.radar-grid{grid-template-columns:1fr}.alert-panel{order:-1}}
                @media(max-width:640px){.radar-page{padding:12px}.radar-hero{align-items:flex-start;flex-direction:column;padding:20px}.radar-hero h1{font-size:24px}.metric-grid{grid-template-columns:1fr 1fr}.metric{padding:13px}.metric strong{font-size:20px}.source{flex-direction:column}.source-actions{width:100%;flex-wrap:wrap}.snapshot{grid-template-columns:1fr}.panel{padding:15px}}
            `}</style>
        </AppLayout>
    );
}
