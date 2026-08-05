import Head from 'next/head';
import { useRouter } from 'next/router';
import { useState, useEffect, useCallback } from 'react';
import {
    Input, Select, Slider, Switch, Modal, DatePicker, InputNumber,
    message, Spin
} from 'antd';
import {
    Megaphone, Plus, Play, Pause, Trash2, Eye, Users, Send, Clock, Shield,
    CheckCircle, XCircle, AlertTriangle, ArrowLeft, Filter, UserCheck, ChevronRight,
    BarChart3, Zap, Radio, Mail
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import AppLayout from '../../../components/layout/AppLayout';
import { httpClient } from '../../../lib/http/client';
import dayjs from 'dayjs';

const { TextArea } = Input;

interface Campaign {
    _id: string;
    name: string;
    channel: 'zalo' | 'telegram' | 'email';
    status: 'draft' | 'scheduled' | 'running' | 'paused' | 'completed' | 'failed';
    messages: string[];
    subject?: string;
    emailHtml?: string | null;
    emailText?: string | null;
    emailAccountId?: string | null;
    audience: {
        type: 'all' | 'filter' | 'manual';
        filters?: { source?: string; minMessages?: number; lastActiveWithinDays?: number };
        manualIds?: string[];
    };
    schedule: { startAt: string; sendWindow?: { startHour: number; endHour: number } };
    antiSpam: { delayBetweenMs: number; messageDelayMs?: number; maxPerHour: number; randomizeDelay: boolean };
    stats: {
        total: number;
        sent: number;
        failed: number;
        pending: number;
        suppressed?: number;
        unsubscribed?: number;
        retried?: number;
    };
    createdAt: string;
    liveProgress?: { sent: number; failed: number; total: number; status: string; estimatedRemainingMs?: number };
    recipients?: Array<{
        id: string;
        recipient: string;
        displayName: string;
        status: 'pending' | 'sending' | 'sent' | 'failed' | 'suppressed' | 'unsubscribed';
        attemptCount: number;
        providerMessageId?: string | null;
        lastError?: string | null;
        sentAt?: string | null;
    }>;
    failedRecipients?: Array<{
        threadId: string;
        error: string;
        timestamp?: string;
    }>;
}

interface EmailAccount {
    id: string;
    email: string;
    displayName: string;
    isActive: boolean;
    allowSend: boolean;
}

interface WorkspaceStats {
    totalCampaigns: number;
    activeCampaigns: number;
    totalSent: number;
    totalFailed: number;
}

interface TelegramDestinationOption {
    id: string;
    type: string;
    title: string;
    username?: string;
}

type View = 'list' | 'create' | 'detail';
type CampaignApiItem = Omit<Campaign, '_id'> & { id?: string; _id?: string };

const normalizeManualRecipientIds = (ids: string[]) => {
    const uniqueIds = new Set<string>();
    ids.forEach(rawId => {
        const id = rawId.trim();
        if (id) uniqueIds.add(id);
    });
    return Array.from(uniqueIds);
};

const TELEGRAM_DESTINATION_RE = /^(-?\d{1,20}|@[A-Za-z][A-Za-z0-9_]{4,31})(?:#\d{1,10})?$/;
const normalizeTelegramDestinations = (values: string[]) => Array.from(new Set(
    values.map(value => value.trim()).filter(value => TELEGRAM_DESTINATION_RE.test(value)),
));

const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const normalizeManualEmails = (values: string[]) => Array.from(new Set(
    values.map(value => value.trim().toLowerCase()).filter(value => EMAIL_RE.test(value)),
));

const normalizeCampaigns = (items: CampaignApiItem[]): Campaign[] =>
    items.map(campaign => ({
        ...campaign,
        channel: campaign.channel || 'zalo',
        _id: campaign._id || campaign.id || '',
    }));

/* ─── Tone helpers ─── */
type Tone = 'indigo' | 'sky' | 'rose' | 'emerald' | 'violet' | 'amber';
const toneIcon: Record<Tone, string> = {
    indigo: 'bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100',
    sky: 'bg-sky-50 text-sky-600 ring-1 ring-sky-100',
    rose: 'bg-rose-50 text-rose-600 ring-1 ring-rose-100',
    emerald: 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100',
    violet: 'bg-violet-50 text-violet-600 ring-1 ring-violet-100',
    amber: 'bg-amber-50 text-amber-600 ring-1 ring-amber-100',
};
const toneText: Record<Tone, string> = {
    indigo: 'text-indigo-700', sky: 'text-sky-700', rose: 'text-rose-700',
    emerald: 'text-emerald-700', violet: 'text-violet-700', amber: 'text-amber-700',
};
const toneBg: Record<Tone, string> = {
    indigo: 'bg-indigo-50 border-indigo-200', sky: 'bg-sky-50 border-sky-200',
    rose: 'bg-rose-50 border-rose-200', emerald: 'bg-emerald-50 border-emerald-200',
    violet: 'bg-violet-50 border-violet-200', amber: 'bg-amber-50 border-amber-200',
};

const getApiErrorMessage = (error: unknown, fallback: string) => {
    if (typeof error !== 'object' || error === null || !('response' in error)) return fallback;
    const response = (error as { response?: { data?: { error?: { message?: unknown } } } }).response;
    const apiMessage = response?.data?.error?.message;
    return typeof apiMessage === 'string' ? apiMessage : fallback;
};

/* ─── Reusable Atoms ─── */
const DCard = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
    <div className={`campaign-card rounded-lg border border-slate-200 bg-white ${className}`}>
        {children}
    </div>
);

const SectionLabel = ({ icon: Icon, label }: { icon: LucideIcon; label: string }) => (
    <div className="campaign-section-label flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            <Icon size={16} />
        </span>
        <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-slate-600">{label}</span>
    </div>
);

const StatusBadge = ({ status, text, tone }: { status: string; text: string; tone: Tone }) => (
    <span className={`campaign-status-badge inline-flex items-center gap-1.5 rounded-md border text-[12px] font-semibold ${toneBg[tone]} ${toneText[tone]}`}>
        <span className={`h-2 w-2 rounded-full ${status === 'running' ? 'animate-pulse' : ''}`}
            style={{ backgroundColor: 'currentColor' }} />
        {text}
    </span>
);

const IconBtn = ({
    icon: Icon, label, onClick, danger = false, primary = false, size = 36, disabled = false, loading = false,
}: {
    icon: LucideIcon; label: string; onClick?: () => void; danger?: boolean; primary?: boolean; size?: number;
    disabled?: boolean; loading?: boolean;
}) => (
    <button
        title={label}
        onClick={onClick}
        disabled={disabled || loading}
        aria-busy={loading}
        aria-label={label}
        className={[
            'campaign-icon-button inline-flex items-center justify-center rounded-lg border transition-all duration-200',
            danger
                ? 'border-rose-200 bg-white text-rose-500 hover:bg-rose-50 hover:border-rose-300'
                : primary
                    ? 'border-transparent bg-indigo-600 text-white shadow-[0_4px_12px_rgba(79,70,229,0.25)] hover:bg-indigo-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300',
        ].join(' ')}
        style={{ width: size, height: size }}
    >
        {loading ? <Spin size="small" /> : <Icon size={15} />}
    </button>
);

export default function CampaignsPage() {
    const router = useRouter();
    const { workspaceId } = router.query;

    const [view, setView] = useState<View>('list');
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [stats, setStats] = useState<WorkspaceStats | null>(null);
    const [loading, setLoading] = useState(false);
    const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
    const [startingCampaignId, setStartingCampaignId] = useState<string | null>(null);
    const [emailAccounts, setEmailAccounts] = useState<EmailAccount[]>([]);

    // Wizard state
    const [step, setStep] = useState(0);
    const [formName, setFormName] = useState('');
    const [campaignChannel, setCampaignChannel] = useState<'zalo' | 'telegram' | 'email'>('zalo');
    const [formMessages, setFormMessages] = useState<string[]>(['']);
    const [emailSubject, setEmailSubject] = useState('');
    const [emailHtml, setEmailHtml] = useState('');
    const [emailText, setEmailText] = useState('');
    const [emailAccountId, setEmailAccountId] = useState<string>();
    const [audienceType, setAudienceType] = useState<'all' | 'filter' | 'manual'>('all');
    const [filterSource, setFilterSource] = useState<string | undefined>();
    const [filterMinMessages, setFilterMinMessages] = useState<number>(0);
    const [filterLastActiveDays, setFilterLastActiveDays] = useState<number>(90);
    const [manualIds, setManualIds] = useState<string[]>([]);
    const [scheduleStartAt, setScheduleStartAt] = useState(dayjs().add(1, 'hour'));
    const [sendWindowEnabled, setSendWindowEnabled] = useState(true);
    const [sendWindowStart, setSendWindowStart] = useState(8);
    const [sendWindowEnd, setSendWindowEnd] = useState(21);
    const [antiSpamDelay, setAntiSpamDelay] = useState(8);
    const [messageDelay, setMessageDelay] = useState(1.2);
    const [antiSpamMaxPerHour, setAntiSpamMaxPerHour] = useState(30);
    const [antiSpamRandomize, setAntiSpamRandomize] = useState(true);
    const [creating, setCreating] = useState(false);
    const [telegramStatus, setTelegramStatus] = useState<{ configured: boolean; defaultChatId: string } | null>(null);
    const [telegramDestinations, setTelegramDestinations] = useState<TelegramDestinationOption[]>([]);
    const [discoveringTelegram, setDiscoveringTelegram] = useState(false);

    // Load data
    const loadCampaigns = useCallback(async () => {
        if (!workspaceId) return;
        setLoading(true);
        try {
            const [campRes, statsRes] = await Promise.all([
                httpClient.get(`/workspaces/${workspaceId}/campaigns`),
                httpClient.get(`/workspaces/${workspaceId}/campaigns/stats`),
            ]);
            const rawCampaigns: CampaignApiItem[] = campRes.data?.data?.items || [];
            // Normalize: Prisma returns `id`, frontend uses `_id`
            setCampaigns(normalizeCampaigns(rawCampaigns));
            setStats(statsRes.data?.data || null);
        } catch { /* silent */ }
        finally { setLoading(false); }
    }, [workspaceId]);

    useEffect(() => { loadCampaigns(); }, [loadCampaigns]);

    useEffect(() => {
        if (!workspaceId) return;
        httpClient.get(`/workspaces/${workspaceId}/campaigns/telegram/status`)
            .then(response => setTelegramStatus(response.data?.data || null))
            .catch(() => setTelegramStatus(null));
    }, [workspaceId]);

    const discoverTelegramDestinations = useCallback(async (showFeedback = false) => {
        if (!workspaceId) return;
        setDiscoveringTelegram(true);
        try {
            const response = await httpClient.get(`/workspaces/${workspaceId}/campaigns/telegram/destinations`);
            const chats = Array.isArray(response.data?.data?.chats) ? response.data.data.chats : [];
            setTelegramDestinations(chats);
            if (showFeedback) message.success(chats.length ? `Đã tìm thấy ${chats.length} chat` : 'Chưa thấy chat mới. Hãy nhắn bot hoặc thêm bot vào nhóm trước.');
        } catch (error) {
            if (showFeedback) message.error(getApiErrorMessage(error, 'Không thể tự dò chat Telegram'));
        } finally {
            setDiscoveringTelegram(false);
        }
    }, [workspaceId]);

    useEffect(() => {
        if (telegramStatus?.configured) void discoverTelegramDestinations(false);
    }, [telegramStatus?.configured, discoverTelegramDestinations]);

    useEffect(() => {
        if (!workspaceId) return;
        httpClient.get(`/email-accounts/workspace/${workspaceId}`)
            .then(response => {
                const accounts = (response.data?.data || []) as EmailAccount[];
                const senders = accounts.filter(account => account.isActive && account.allowSend);
                setEmailAccounts(senders);
                setEmailAccountId(current => current || senders[0]?.id);
            })
            .catch(() => setEmailAccounts([]));
    }, [workspaceId]);

    // Poll progress for active campaigns, including schedules that may become due.
    useEffect(() => {
        const active = campaigns.filter(c => c.status === 'running' || c.status === 'scheduled');
        if (active.length === 0) return;
        const interval = setInterval(async () => {
            try {
                const res = await httpClient.get(`/workspaces/${workspaceId}/campaigns`);
                const rawCampaigns: CampaignApiItem[] = res.data?.data?.items || [];
                setCampaigns(normalizeCampaigns(rawCampaigns));
            } catch { /* silent */ }
        }, 5000);
        return () => clearInterval(interval);
    }, [campaigns, workspaceId]);

    // Actions
    const handleStartCampaign = async (id: string): Promise<boolean> => {
        if (startingCampaignId) return false;
        setStartingCampaignId(id);
        try {
            const response = await httpClient.post(`/workspaces/${workspaceId}/campaigns/${id}/start`);
            const scheduledAt = response.data?.data?.scheduledAt;
            message.success(scheduledAt
                ? `Đã lên lịch lúc ${dayjs(scheduledAt).format('DD/MM/YYYY HH:mm')}`
                : 'Campaign đã bắt đầu gửi!');
            loadCampaigns();
            return true;
        } catch (err: unknown) {
            message.error(getApiErrorMessage(err, 'Lỗi khi bắt đầu campaign'));
            return false;
        } finally {
            setStartingCampaignId(null);
        }
    };

    const handlePause = async (id: string) => {
        try {
            await httpClient.post(`/workspaces/${workspaceId}/campaigns/${id}/pause`);
            message.success('Đã tạm dừng');
            loadCampaigns();
        } catch { message.error('Lỗi'); }
    };

    const handleResume = async (id: string) => {
        try {
            await httpClient.post(`/workspaces/${workspaceId}/campaigns/${id}/resume`);
            message.success('Đã tiếp tục');
            loadCampaigns();
        } catch { message.error('Lỗi'); }
    };

    const handleDelete = async (id: string) => {
        Modal.confirm({
            title: 'Xóa campaign?',
            content: 'Hành động này không thể hoàn tác.',
            okButtonProps: { danger: true },
            onOk: async () => {
                try {
                    await httpClient.delete(`/workspaces/${workspaceId}/campaigns/${id}`);
                    message.success('Đã xóa');
                    loadCampaigns();
                } catch { message.error('Lỗi khi xóa'); }
            },
        });
    };

    const handleCreateCampaign = async () => {
        if (!formName.trim()) { message.warning('Cần đặt tên campaign'); return; }
        if (campaignChannel !== 'email' && !formMessages.filter(m => m.trim()).length) {
            message.warning('Cần ít nhất 1 tin nhắn'); return;
        }
        if (campaignChannel === 'telegram' && !telegramStatus?.configured) {
            message.warning('Hãy cấu hình Telegram Bot Token tại Radar tín hiệu trước'); return;
        }
        if (campaignChannel === 'email' && (!emailSubject.trim() || (!emailHtml.trim() && !emailText.trim()))) {
            message.warning('Email cần tiêu đề và ít nhất một nội dung HTML hoặc văn bản'); return;
        }
        if (campaignChannel === 'email' && !emailAccountId) {
            message.warning('Cần chọn tài khoản gửi Email'); return;
        }
        const normalizedManualRecipients = campaignChannel === 'email'
            ? normalizeManualEmails(manualIds)
            : campaignChannel === 'telegram'
                ? normalizeTelegramDestinations(manualIds)
                : normalizeManualRecipientIds(manualIds);
        if (audienceType === 'manual' && normalizedManualRecipients.length === 0) {
            message.warning(campaignChannel === 'email'
                ? 'Cần ít nhất 1 email hợp lệ của lead đã đồng ý marketing'
                : campaignChannel === 'telegram'
                    ? 'Cần ít nhất 1 Chat ID Telegram hợp lệ'
                : 'Cần ít nhất 1 Zalo User ID khi chọn đối tượng thủ công');
            return;
        }

        setCreating(true);
        try {
            await httpClient.post(`/workspaces/${workspaceId}/campaigns`, {
                name: formName,
                channel: campaignChannel,
                messages: campaignChannel !== 'email' ? formMessages.filter(m => m.trim()) : [],
                subject: campaignChannel === 'email' ? emailSubject.trim() : undefined,
                emailHtml: campaignChannel === 'email' ? emailHtml.trim() : undefined,
                emailText: campaignChannel === 'email' ? emailText.trim() : undefined,
                emailAccountId: campaignChannel === 'email' ? emailAccountId : undefined,
                audience: {
                    type: audienceType,
                    filters: audienceType === 'filter' ? {
                        source: filterSource,
                        minMessages: filterMinMessages || undefined,
                        lastActiveWithinDays: filterLastActiveDays || undefined,
                    } : undefined,
                    manualIds: audienceType === 'manual' ? normalizedManualRecipients : undefined,
                },
                schedule: {
                    startAt: scheduleStartAt.toISOString(),
                    sendWindow: sendWindowEnabled ? { startHour: sendWindowStart, endHour: sendWindowEnd } : undefined,
                },
                antiSpam: {
                    delayBetweenMs: antiSpamDelay * 1000,
                    messageDelayMs: Math.round(messageDelay * 1000),
                    maxPerHour: antiSpamMaxPerHour,
                    randomizeDelay: antiSpamRandomize,
                    batchSize: 10,
                },
            });
            message.success('Campaign đã tạo thành công!');
            setView('list');
            resetForm();
            loadCampaigns();
        } catch (err: unknown) {
            message.error(getApiErrorMessage(err, 'Lỗi khi tạo campaign'));
        }
        finally { setCreating(false); }
    };

    const resetForm = () => {
        setStep(0); setFormName(''); setFormMessages(['']);
        setCampaignChannel('zalo'); setEmailSubject(''); setEmailHtml(''); setEmailText('');
        setEmailAccountId(emailAccounts[0]?.id);
        setAudienceType('all'); setFilterSource(undefined);
        setFilterMinMessages(0); setFilterLastActiveDays(90);
        setManualIds([]); setScheduleStartAt(dayjs().add(1, 'hour'));
        setMessageDelay(1.2);
        setSendWindowEnabled(true); setAntiSpamDelay(8);
        setAntiSpamMaxPerHour(30); setAntiSpamRandomize(true);
    };

    const statusLookup: Record<string, { text: string; tone: Tone }> = {
        draft: { text: 'Nháp', tone: 'sky' },
        scheduled: { text: 'Đã lên lịch', tone: 'indigo' },
        running: { text: 'Đang gửi', tone: 'emerald' },
        paused: { text: 'Tạm dừng', tone: 'amber' },
        completed: { text: 'Hoàn tất', tone: 'violet' },
        failed: { text: 'Lỗi', tone: 'rose' },
    };

    // ═══════════════════════════════════
    // RENDER: STAT CARDS
    // ═══════════════════════════════════
    const renderStats = () => {
        if (!stats) return null;
        const successRate = stats.totalSent + stats.totalFailed > 0
            ? Math.round((stats.totalSent / (stats.totalSent + stats.totalFailed)) * 100)
            : 0;

        const items: { icon: LucideIcon; tone: Tone; label: string; value: string | number }[] = [
            { icon: Megaphone, tone: 'indigo', label: 'Tổng luồng gửi', value: stats.totalCampaigns },
            { icon: Radio, tone: 'emerald', label: 'Đang hoạt động', value: stats.activeCampaigns },
            { icon: Send, tone: 'sky', label: 'Đã gửi', value: stats.totalSent },
            { icon: CheckCircle, tone: 'amber', label: 'Tỷ lệ thành công', value: `${successRate}%` },
        ];

        return (
            <section className="campaign-kpi-grid" aria-label="Tổng quan chiến dịch">
                {items.map((s, i) => (
                    <div
                        key={i}
                        className="campaign-kpi-card group border border-slate-200 bg-white transition-colors duration-200 hover:border-slate-300"
                    >
                        <div className="campaign-kpi-content flex items-start justify-between">
                            <div className="min-w-0">
                                <p className="m-0 text-[12px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                                    {s.label}
                                </p>
                                <div className="campaign-kpi-value text-[32px] font-bold leading-none tracking-tight text-slate-900">
                                    {s.value}
                                </div>
                            </div>
                            <div className={`campaign-kpi-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${toneIcon[s.tone]}`}>
                                <s.icon size={18} />
                            </div>
                        </div>
                    </div>
                ))}
            </section>
        );
    };

    // ═══════════════════════════════════
    // RENDER: CAMPAIGN LIST
    // ═══════════════════════════════════
    const renderList = () => (
        <div className="campaign-view-stack">
            <header className="campaign-page-header">
                <div className="campaign-page-heading">
                    <div className="campaign-eyebrow">
                        <Zap size={14} />
                        Tự động hóa chăm sóc khách hàng
                    </div>
                    <h1>Automation Hub</h1>
                    <p>Tạo luồng gửi Zalo, Telegram và Email; quản lý lịch, tốc độ, trạng thái và lỗi trong một màn hình.</p>
                </div>
                <button
                    onClick={() => { resetForm(); setView('create'); }}
                    className="campaign-action-button campaign-action-button--primary"
                >
                    <Plus size={17} />
                    Tạo chiến dịch
                </button>
            </header>

            {renderStats()}

            <DCard className="campaign-card--flush campaign-list-panel overflow-hidden">
                <div className="campaign-list-heading">
                    <SectionLabel icon={Megaphone} label="Luồng tự động đa kênh" />
                    <span className="campaign-list-hint">Zalo · Telegram Bot · Email có consent</span>
                </div>

                {loading ? (
                    <div className="campaign-loading"><Spin size="large" /></div>
                ) : campaigns.length === 0 ? (
                    <div className="campaign-empty-state">
                        <div className="campaign-empty-icon">
                            <Megaphone size={30} strokeWidth={1.6} />
                        </div>
                        <h2>Chưa có chiến dịch nào</h2>
                        <p>Bắt đầu với một chiến dịch gửi tin có lịch trình, giới hạn tốc độ và báo cáo rõ ràng.</p>
                        <button
                            onClick={() => { resetForm(); setView('create'); }}
                            className="campaign-action-button campaign-action-button--primary"
                        >
                            <Plus size={17} />
                            Tạo chiến dịch đầu tiên
                        </button>
                    </div>
                ) : (
                    <div className="campaign-table" role="table" aria-label="Danh sách chiến dịch">
                        <div className="campaign-table-header" role="row">
                            <span role="columnheader">Chiến dịch</span>
                            <span role="columnheader">Trạng thái</span>
                            <span role="columnheader">Tiến trình</span>
                            <span role="columnheader">Đối tượng</span>
                            <span role="columnheader">Thao tác</span>
                        </div>

                        <div className="campaign-table-body" role="rowgroup">
                            {campaigns.map(c => {
                                const cfg = statusLookup[c.status] || statusLookup.draft;
                                const processed = c.stats.sent + c.stats.failed + (c.stats.suppressed || 0) + (c.stats.unsubscribed || 0);
                                const pct = c.stats.total > 0 ? Math.round((processed / c.stats.total) * 100) : 0;
                                return (
                                    <div key={c._id} className="campaign-table-row" role="row">
                                        <div className="campaign-table-name" role="cell">
                                            <p>{c.name}</p>
                                            <span>
                                                {c.channel === 'email' ? 'Email' : `${c.messages.length} tin ${c.channel === 'telegram' ? 'Telegram' : 'Zalo'}`}
                                                {' · '}{new Date(c.createdAt).toLocaleDateString('vi-VN')}
                                            </span>
                                        </div>

                                        <div className="campaign-table-status" role="cell">
                                            <StatusBadge status={c.status} text={cfg.text} tone={cfg.tone} />
                                        </div>

                                        <div className="campaign-table-progress" role="cell">
                                            {c.stats.total === 0 ? (
                                                <span className="campaign-progress-empty">Chưa bắt đầu</span>
                                            ) : (
                                                <div>
                                                    <div className="campaign-progress-track">
                                                        <div className="campaign-progress-value" style={{ width: `${pct}%` }} />
                                                    </div>
                                                    <p>
                                                        ✓ {c.stats.sent} · ✗ {c.stats.failed} · ⏳ {c.stats.pending}
                                                        {c.channel === 'email' && ` · ⛔ ${(c.stats.suppressed || 0) + (c.stats.unsubscribed || 0)}`}
                                                    </p>
                                                </div>
                                            )}
                                        </div>

                                        <div className="campaign-table-audience" role="cell">
                                            <span>
                                                {c.audience.type === 'all' ? 'Tất cả' : c.audience.type === 'filter' ? 'Bộ lọc' : 'Chọn tay'}
                                            </span>
                                        </div>

                                        <div className="campaign-table-actions" role="cell">
                                            {c.status === 'draft' && (
                                                <IconBtn
                                                    icon={Play}
                                                    label="Bắt đầu gửi"
                                                    primary
                                                    loading={startingCampaignId === c._id}
                                                    disabled={startingCampaignId !== null}
                                                    onClick={() => { void handleStartCampaign(c._id); }}
                                                />
                                            )}
                                            {c.status === 'running' && (
                                                <IconBtn icon={Pause} label="Tạm dừng" onClick={() => handlePause(c._id)} />
                                            )}
                                            {c.status === 'paused' && (
                                                <IconBtn icon={Play} label="Tiếp tục" primary onClick={() => handleResume(c._id)} />
                                            )}
                                            {c.status === 'scheduled' && (
                                                <IconBtn icon={XCircle} label="Hủy lịch" danger onClick={() => handleCancelSchedule(c._id)} />
                                            )}
                                            <IconBtn icon={Eye} label="Chi tiết" onClick={async () => {
                                                try {
                                                    const res = await httpClient.get(`/workspaces/${workspaceId}/campaigns/${c._id}`);
                                                    const detail = res.data?.data as CampaignApiItem | undefined;
                                                    setSelectedCampaign(detail ? normalizeCampaigns([detail])[0] : null);
                                                    setView('detail');
                                                } catch { message.error('Lỗi tải chi tiết'); }
                                            }} />
                                            {['draft', 'completed', 'failed'].includes(c.status) && (
                                                <IconBtn icon={Trash2} label="Xóa" danger onClick={() => handleDelete(c._id)} />
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </DCard>
        </div>
    );

    // ═══════════════════════════════════
    // RENDER: CREATE WIZARD
    // ═══════════════════════════════════
    const wizardSteps = [
        { icon: Send, label: 'Nội dung' },
        { icon: Users, label: 'Đối tượng' },
        { icon: Clock, label: 'Lịch trình' },
        { icon: Shield, label: 'Chống spam' },
    ];

    const canNext = () => {
        if (step === 0) {
            if (!formName.trim()) return false;
            if (campaignChannel === 'email') {
                return Boolean(emailAccountId && emailSubject.trim() && (emailHtml.trim() || emailText.trim()));
            }
            return formMessages.some(m => m.trim());
        }
        if (step === 1 && audienceType === 'manual') {
            return campaignChannel === 'email'
                ? normalizeManualEmails(manualIds).length > 0
                : campaignChannel === 'telegram'
                    ? normalizeTelegramDestinations(manualIds).length > 0
                    : normalizeManualRecipientIds(manualIds).length > 0;
        }
        return true;
    };

    const handleCancelSchedule = (id: string, onSuccess?: () => void) => {
        Modal.confirm({
            title: 'Hủy lịch campaign?',
            content: 'Campaign sẽ không tự chạy vào thời gian đã chọn.',
            okText: 'Hủy lịch',
            okButtonProps: { danger: true },
            onOk: async () => {
                await httpClient.delete(`/workspaces/${workspaceId}/campaigns/${id}`);
                message.success('Đã hủy lịch');
                await loadCampaigns();
                onSuccess?.();
            },
        });
    };

    const renderWizard = () => (
        <div className="campaign-view-stack campaign-wizard-view">
            {/* Header */}
            <div className="campaign-subheader">
                <button
                    onClick={() => setView('list')}
                    className="campaign-back-button flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-all duration-200 hover:bg-slate-50 hover:border-slate-300"
                >
                    <ArrowLeft size={18} />
                </button>
                <h1 className="m-0 text-[22px] font-semibold tracking-tight text-slate-900">Tạo Campaign mới</h1>
            </div>

            <DCard className="campaign-wizard-card">
                {/* Step Indicator */}
                <div className="campaign-stepper">
                    {wizardSteps.map((s, i) => {
                        const active = i === step;
                        const done = i < step;
                        return (
                            <div key={i} className="campaign-step-wrap">
                                <div className="campaign-step">
                                    <div className={[
                                        'flex h-10 w-10 items-center justify-center rounded-lg transition-all duration-300',
                                        active ? 'bg-indigo-600 text-white shadow-[0_8px_20px_rgba(79,70,229,0.3)]'
                                            : done ? 'bg-indigo-100 text-indigo-600'
                                                : 'bg-slate-100 text-slate-400',
                                    ].join(' ')}>
                                        {done ? <CheckCircle size={16} /> : <s.icon size={16} />}
                                    </div>
                                    <span className={`text-[12px] font-medium ${active ? 'text-indigo-600' : done ? 'text-indigo-500' : 'text-slate-400'}`}>
                                        {s.label}
                                    </span>
                                </div>
                                {i < wizardSteps.length - 1 && (
                                    <div className={`campaign-step-connector h-[2px] w-8 rounded-full transition-colors duration-300 ${i < step ? 'bg-indigo-400' : 'bg-slate-200'}`} />
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* ── Step 0: Content ── */}
                {step === 0 && (
                    <div className="campaign-form-stack">
                        <div>
                            <label className="mb-2 block text-[13px] font-semibold text-slate-700">Kênh gửi</label>
                            <div className="campaign-form-grid">
                                {([
                                    { key: 'zalo', icon: Send, title: 'Zalo cá nhân', desc: 'Gửi tin qua tài khoản Zalo đã kết nối' },
                                    { key: 'telegram', icon: Radio, title: 'Telegram Bot', desc: 'Gửi tới chat, group, channel hoặc topic' },
                                    { key: 'email', icon: Mail, title: 'Email', desc: 'Chỉ gửi lead có email và consent marketing' },
                                ] as const).map(option => {
                                    const selected = campaignChannel === option.key;
                                    return (
                                        <button
                                            key={option.key}
                                            type="button"
                                            onClick={() => {
                                                setCampaignChannel(option.key);
                                                setAudienceType(option.key === 'telegram' ? 'manual' : 'all');
                                                setManualIds([]);
                                                setFilterSource(undefined);
                                                setAntiSpamDelay(option.key === 'email' ? 2 : option.key === 'telegram' ? 3 : 8);
                                                setAntiSpamMaxPerHour(option.key === 'email' ? 100 : option.key === 'telegram' ? 120 : 30);
                                            }}
                                            className={`flex items-center gap-3 rounded-lg border-2 p-4 text-left transition-colors ${selected ? 'border-indigo-500 bg-indigo-50/60' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                                        >
                                            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${selected ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}>
                                                <option.icon size={19} />
                                            </span>
                                            <span>
                                                <strong className="block text-[14px] text-slate-800">{option.title}</strong>
                                                <span className="mt-0.5 block text-[12px] leading-5 text-slate-500">{option.desc}</span>
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div>
                            <label className="mb-2 block text-[13px] font-semibold text-slate-700">Tên campaign</label>
                            <Input
                                placeholder="VD: Nhắc nhở gia hạn tháng 4, Upsale Gemini Pro..."
                                value={formName}
                                onChange={e => setFormName(e.target.value)}
                                style={{ borderRadius: 8, height: 44, fontSize: 14 }}
                            />
                        </div>

                        {campaignChannel !== 'email' ? (
                        <div>
                            <div className="mb-2 flex items-center justify-between">
                                <label className="text-[13px] font-semibold text-slate-700">
                                    Nội dung tin nhắn
                                </label>
                                <span className="text-[12px] text-slate-400">{formMessages.length}/10</span>
                            </div>
                            <div className="mb-3 rounded-lg border border-indigo-100 bg-indigo-50/50 px-3 py-2 text-[12px] text-indigo-600">
                                {campaignChannel === 'telegram'
                                    ? (telegramStatus?.configured
                                        ? 'Bot Telegram đã sẵn sàng. Mỗi ô bên dưới là một bước trong chuỗi gửi.'
                                        : 'Chưa có Bot Token. Mở Radar tín hiệu để cấu hình Telegram trước.')
                                    : <>Biến hỗ trợ: <code className="rounded bg-indigo-100 px-1.5 py-0.5 font-mono text-[11px]">{'{{customer_name}}'}</code> — Tên khách hàng</>}
                            </div>

                            <div className="mb-4 flex flex-wrap items-center gap-2">
                                <span className="text-[12px] font-semibold text-slate-500">Preset nhanh:</span>
                                {[
                                    { label: 'Tư vấn sản phẩm', messages: ['Mình xem ngay cho bạn nha.', 'Bạn gửi giúp mình mẫu hoặc nhu cầu đang quan tâm nhé.'] },
                                    { label: 'Chăm sóc sau mua', messages: ['Bạn đã nhận được hàng chưa ạ?', 'Nếu cần hướng dẫn sử dụng, bạn nhắn mình hỗ trợ ngay nhé.'] },
                                    { label: 'Nhắc lịch', messages: ['Mình nhắc bạn lịch hẹn sắp tới nha.', 'Nếu cần đổi giờ, bạn trả lời trực tiếp tin nhắn này giúp mình.'] },
                                ].map(preset => (
                                    <button
                                        key={preset.label}
                                        type="button"
                                        onClick={() => setFormMessages(preset.messages)}
                                        className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-medium text-slate-600 hover:border-indigo-300 hover:text-indigo-600"
                                    >
                                        {preset.label}
                                    </button>
                                ))}
                            </div>

                            <div className="space-y-3">
                                {formMessages.map((msg, i) => (
                                    <div key={i} className="flex gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[12px] font-bold text-white">{i + 1}</span>
                                        <TextArea
                                            value={msg}
                                            onChange={e => {
                                                const next = [...formMessages];
                                                next[i] = e.target.value;
                                                setFormMessages(next);
                                            }}
                                            placeholder={`Tin nhắn ${i + 1}...`}
                                            autoSize={{ minRows: 2, maxRows: 5 }}
                                            style={{ borderRadius: 8, flex: 1 }}
                                        />
                                        {formMessages.length > 1 && (
                                            <button
                                                onClick={() => setFormMessages(formMessages.filter((_, j) => j !== i))}
                                                className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-rose-200 bg-white text-rose-400 transition-colors hover:bg-rose-50 hover:text-rose-500"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {formMessages.length < 10 && (
                                <button
                                    onClick={() => setFormMessages([...formMessages, ''])}
                                    className="campaign-add-message-button mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-200 bg-slate-50/50 text-[13px] font-medium text-slate-500 transition-colors hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50/30"
                                >
                                    <Plus size={14} />
                                    Thêm tin nhắn
                                </button>
                            )}
                            {formMessages.length > 1 && (
                                <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3">
                                    <label className="mb-2 block text-[12px] font-semibold text-slate-700">Khoảng nghỉ giữa các bước: {messageDelay.toFixed(1)} giây</label>
                                    <Slider value={messageDelay} onChange={setMessageDelay} min={0.5} max={10} step={0.1} />
                                </div>
                            )}
                        </div>
                        ) : (
                            <div className="space-y-4">
                                {emailAccounts.length === 0 && (
                                    <div className="campaign-form-panel rounded-lg border border-amber-200 bg-amber-50 text-[13px] leading-5 text-amber-800">
                                        Chưa có tài khoản Email đang bật quyền gửi. Hãy cấu hình SMTP trong Kết nối kênh trước khi tạo campaign.
                                    </div>
                                )}
                                <div>
                                    <label className="mb-2 block text-[13px] font-semibold text-slate-700">Tài khoản gửi</label>
                                    <Select
                                        value={emailAccountId}
                                        onChange={setEmailAccountId}
                                        placeholder="Chọn tài khoản Email"
                                        style={{ width: '100%' }}
                                        options={emailAccounts.map(account => ({
                                            value: account.id,
                                            label: account.displayName ? `${account.displayName} <${account.email}>` : account.email,
                                        }))}
                                    />
                                </div>
                                <div>
                                    <label className="mb-2 block text-[13px] font-semibold text-slate-700">Tiêu đề Email</label>
                                    <Input
                                        value={emailSubject}
                                        maxLength={240}
                                        showCount
                                        onChange={event => setEmailSubject(event.target.value)}
                                        placeholder="VD: Ưu đãi tháng 8 dành cho {{customer_name}}"
                                    />
                                </div>
                                <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 px-3 py-2 text-[12px] leading-5 text-indigo-700">
                                    Biến hỗ trợ: <code>{'{{customer_name}}'}</code> và <code>{'{{unsubscribe_url}}'}</code>. Hệ thống luôn tự thêm liên kết hủy đăng ký nếu nội dung chưa có.
                                </div>
                                <div>
                                    <label className="mb-2 block text-[13px] font-semibold text-slate-700">Nội dung HTML</label>
                                    <TextArea
                                        value={emailHtml}
                                        onChange={event => setEmailHtml(event.target.value)}
                                        placeholder="<h2>Xin chào {{customer_name}}</h2><p>Nội dung chiến dịch...</p>"
                                        autoSize={{ minRows: 7, maxRows: 16 }}
                                    />
                                </div>
                                <div>
                                    <label className="mb-2 block text-[13px] font-semibold text-slate-700">Bản văn bản thuần</label>
                                    <TextArea
                                        value={emailText}
                                        onChange={event => setEmailText(event.target.value)}
                                        placeholder="Xin chào {{customer_name}}, nội dung chiến dịch..."
                                        autoSize={{ minRows: 5, maxRows: 12 }}
                                    />
                                    <p className="m-0 mt-1.5 text-[12px] text-slate-500">Cần ít nhất một trong hai bản HTML hoặc văn bản thuần.</p>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ── Step 1: Audience ── */}
                {step === 1 && (
                    <div className="campaign-form-stack">
                        <label className="block text-[13px] font-semibold text-slate-700">Chọn đối tượng nhận</label>

                        <div className="campaign-audience-grid">
                            {([
                                { key: 'all', icon: Users, title: 'Tất cả', desc: campaignChannel === 'email' ? 'Lead có consent marketing' : 'Gửi toàn bộ danh bạ Zalo' },
                                { key: 'filter', icon: Filter, title: 'Bộ lọc', desc: 'Lọc theo điều kiện' },
                                { key: 'manual', icon: UserCheck, title: 'Chọn tay', desc: 'Nhập ID cụ thể' },
                            ] as const).filter(opt => campaignChannel !== 'telegram' || opt.key === 'manual').map(opt => {
                                const selected = audienceType === opt.key;
                                return (
                                    <button
                                        key={opt.key}
                                        onClick={() => setAudienceType(opt.key)}
                                        className={[
                                            'campaign-audience-option flex flex-col items-center gap-2 rounded-lg border-2 text-center transition-all duration-200',
                                            selected
                                                ? 'border-indigo-500 bg-indigo-50/60 shadow-[0_0_0_3px_rgba(99,102,241,0.1)]'
                                                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50',
                                        ].join(' ')}
                                    >
                                        <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${selected ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                                            <opt.icon size={22} />
                                        </div>
                                        <span className={`text-[14px] font-semibold ${selected ? 'text-indigo-700' : 'text-slate-800'}`}>{opt.title}</span>
                                        <span className="text-[12px] text-slate-500">{opt.desc}</span>
                                    </button>
                                );
                            })}
                        </div>

                        {audienceType === 'filter' && (
                            <div className="campaign-form-panel rounded-lg border border-slate-200 bg-slate-50/70 space-y-4">
                                <div className="campaign-form-grid">
                                    <div>
                                        <label className="mb-1.5 block text-[12px] font-medium text-slate-600">Nguồn liên hệ</label>
                                        <Select
                                            value={filterSource} onChange={setFilterSource} allowClear
                                            placeholder="Tất cả nguồn" style={{ width: '100%' }}
                                            options={campaignChannel === 'email' ? [
                                                { label: 'Website', value: 'widget' },
                                                { label: 'Zalo', value: 'zalo' },
                                                { label: 'Facebook', value: 'facebook' },
                                                { label: 'Nhập thủ công', value: 'manual' },
                                            ] : [
                                                { label: '👤 Bạn bè', value: 'friend' },
                                                { label: '🔵 Người lạ', value: 'stranger' },
                                                { label: '👥 Nhóm', value: 'group' },
                                            ]}
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-1.5 block text-[12px] font-medium text-slate-600">Tối thiểu tin nhắn</label>
                                        <InputNumber value={filterMinMessages} onChange={v => setFilterMinMessages(v || 0)}
                                            min={0} style={{ width: '100%' }} placeholder="0 = tất cả" />
                                    </div>
                                </div>
                                <div>
                                    <label className="mb-1.5 block text-[12px] font-medium text-slate-600">
                                        Hoạt động trong <strong className="text-indigo-600">{filterLastActiveDays}</strong> ngày gần đây
                                    </label>
                                    <Slider value={filterLastActiveDays} onChange={setFilterLastActiveDays}
                                        min={7} max={365} marks={{ 7: '7d', 30: '30d', 90: '90d', 180: '6m', 365: '1y' }} />
                                </div>
                            </div>
                        )}

                        {audienceType === 'manual' && (
                            <div>
                                <label className="mb-1.5 block text-[12px] font-medium text-slate-600">
                                    {campaignChannel === 'email'
                                        ? 'Nhập email của lead đã đồng ý marketing (mỗi dòng 1 email)'
                                        : campaignChannel === 'telegram'
                                            ? 'Nhập Chat ID Telegram; topic dùng chat_id#topic_id (mỗi dòng 1 đích)'
                                        : 'Nhập Zalo User IDs (mỗi dòng 1 ID)'}
                                </label>
                                {campaignChannel === 'telegram' ? (
                                    <div className="space-y-2">
                                        <Select
                                            mode="tags"
                                            value={manualIds.filter(Boolean)}
                                            onChange={values => setManualIds(values)}
                                            loading={discoveringTelegram}
                                            tokenSeparators={[',', ' ']}
                                            placeholder="Chọn chat bot đã thấy hoặc nhập chat_id#topic_id"
                                            style={{ width: '100%' }}
                                            options={telegramDestinations.map(chat => ({
                                                value: chat.id,
                                                label: `${chat.title} · ${chat.type}${chat.username ? ` · @${chat.username}` : ''}`,
                                            }))}
                                        />
                                        <div className="flex items-center justify-between gap-3 text-[12px] text-slate-500">
                                            <span>Topic: thêm <code>#topic_id</code> sau Chat ID.</span>
                                            <button
                                                type="button"
                                                disabled={discoveringTelegram}
                                                onClick={() => void discoverTelegramDestinations(true)}
                                                className="font-semibold text-indigo-600 disabled:opacity-50"
                                            >
                                                {discoveringTelegram ? 'Đang dò…' : 'Dò lại chat'}
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <TextArea
                                        value={manualIds.join('\n')}
                                        onChange={e => setManualIds(e.target.value.split('\n'))}
                                        placeholder={campaignChannel === 'email'
                                            ? 'khachhang@example.com'
                                            : 'Nhập mỗi Zalo User ID trên 1 dòng...'}
                                        autoSize={{ minRows: 5, maxRows: 10 }}
                                        style={{ borderRadius: 8 }}
                                    />
                                )}
                                <p className={`m-0 mt-1.5 text-[12px] ${(campaignChannel === 'email' ? normalizeManualEmails(manualIds) : campaignChannel === 'telegram' ? normalizeTelegramDestinations(manualIds) : normalizeManualRecipientIds(manualIds)).length > 0 ? 'text-slate-500' : 'text-rose-600'}`}>
                                    {(campaignChannel === 'email' ? normalizeManualEmails(manualIds) : campaignChannel === 'telegram' ? normalizeTelegramDestinations(manualIds) : normalizeManualRecipientIds(manualIds)).length > 0
                                        ? `${(campaignChannel === 'email' ? normalizeManualEmails(manualIds) : campaignChannel === 'telegram' ? normalizeTelegramDestinations(manualIds) : normalizeManualRecipientIds(manualIds)).length} ${campaignChannel === 'email' ? 'email' : 'đích'} hợp lệ (đã loại trùng)`
                                        : `Cần ít nhất 1 ${campaignChannel === 'email' ? 'email hợp lệ' : campaignChannel === 'telegram' ? 'Chat ID Telegram' : 'Zalo User ID'} để tiếp tục`}
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {/* ── Step 2: Schedule ── */}
                {step === 2 && (
                    <div className="campaign-form-stack">
                        <div>
                            <label className="mb-2 block text-[13px] font-semibold text-slate-700">Thời gian bắt đầu</label>
                            <DatePicker
                                showTime
                                value={scheduleStartAt}
                                onChange={v => v && setScheduleStartAt(v)}
                                style={{ width: '100%', borderRadius: 8, height: 44 }}
                                format="DD/MM/YYYY HH:mm"
                            />
                        </div>

                        <div className="campaign-form-panel rounded-lg border border-slate-200 bg-slate-50/70">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <p className="m-0 text-[14px] font-semibold text-slate-700">🕐 Khung giờ gửi</p>
                                    <p className="m-0 mt-0.5 text-[12px] text-slate-500">Chỉ gửi trong giờ hành chính (tránh quấy rối)</p>
                                </div>
                                <Switch checked={sendWindowEnabled} onChange={setSendWindowEnabled} />
                            </div>
                            {sendWindowEnabled && (
                                <div className="flex items-center gap-3">
                                    <div className="space-y-1">
                                        <label className="text-[11px] font-medium text-slate-500">Từ</label>
                                        <InputNumber value={sendWindowStart} onChange={v => setSendWindowStart(v || 8)}
                                            min={0} max={23} style={{ width: 80 }} />
                                    </div>
                                    <span className="mt-4 text-slate-300">→</span>
                                    <div className="space-y-1">
                                        <label className="text-[11px] font-medium text-slate-500">Đến</label>
                                        <InputNumber value={sendWindowEnd} onChange={v => setSendWindowEnd(v || 21)}
                                            min={0} max={23} style={{ width: 80 }} />
                                    </div>
                                    <span className="mt-4 text-[12px] text-slate-400">giờ</span>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ── Step 3: Anti-spam ── */}
                {step === 3 && (
                    <div className="campaign-form-stack">
                        {/* Warning */}
                        <div className="campaign-form-panel campaign-warning flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50">
                            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-600" />
                            <p className="m-0 text-[13px] leading-5 text-amber-800">
                                <strong>Lưu ý:</strong> {campaignChannel === 'email'
                                    ? 'Chỉ gửi cho lead đã opt-in. Mỗi email có link hủy đăng ký và suppression được áp dụng tự động.'
                                    : campaignChannel === 'telegram'
                                        ? 'Bot phải được thêm vào group/channel và có quyền gửi. Chỉ gửi nội dung người nhận đã đồng ý nhận.'
                                    : 'Gửi quá nhanh có thể khiến tài khoản Zalo bị giới hạn. Nên giữ delay ≥ 8s và tối đa 30 tin/giờ.'}
                            </p>
                        </div>

                        <div>
                            <label className="mb-2 block text-[13px] font-semibold text-slate-700">
                                ⏱️ Delay giữa mỗi người nhận: <strong className="text-indigo-600">{antiSpamDelay}s</strong>
                            </label>
                            <Slider value={antiSpamDelay} onChange={setAntiSpamDelay}
                                min={campaignChannel === 'zalo' ? 5 : 1} max={30} step={1}
                                marks={campaignChannel === 'email'
                                    ? { 1: '1s', 2: '2s ✓', 10: '10s', 30: '30s' }
                                    : campaignChannel === 'telegram'
                                        ? { 1: '1s', 3: '3s ✓', 10: '10s', 30: '30s' }
                                    : { 5: '5s', 8: '8s ✓', 15: '15s', 30: '30s' }}
                                tooltip={{ formatter: v => `${v}s` }} />
                        </div>

                        <div>
                            <label className="mb-2 block text-[13px] font-semibold text-slate-700">
                                📊 Tối đa tin nhắn/giờ: <strong className="text-indigo-600">{antiSpamMaxPerHour}</strong>
                            </label>
                            <Slider value={antiSpamMaxPerHour} onChange={setAntiSpamMaxPerHour}
                                min={5} max={campaignChannel === 'email' ? 500 : campaignChannel === 'telegram' ? 300 : 100} step={5}
                                marks={campaignChannel === 'email'
                                    ? { 5: '5', 100: '100 ✓', 300: '300', 500: '500' }
                                    : campaignChannel === 'telegram'
                                        ? { 5: '5', 120: '120 ✓', 200: '200', 300: '300' }
                                    : { 5: '5', 30: '30 ✓', 60: '60', 100: '100' }} />
                        </div>

                        <div className="campaign-form-panel rounded-lg border border-slate-200 bg-slate-50/70">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="m-0 text-[14px] font-semibold text-slate-700">🎲 Randomize delay</p>
                                    <p className="m-0 mt-0.5 text-[12px] text-slate-500">Thêm ±30% biến đổi để phân bổ tải gửi đều hơn</p>
                                </div>
                                <Switch checked={antiSpamRandomize} onChange={setAntiSpamRandomize} />
                            </div>
                        </div>

                        {/* Summary */}
                        <div className="campaign-form-panel rounded-lg border border-indigo-200 bg-gradient-to-br from-indigo-50/80 to-violet-50/80">
                            <h4 className="m-0 mb-3 text-[14px] font-semibold text-indigo-700">📋 Tóm tắt Campaign</h4>
                            <div className="space-y-1.5 text-[13px] leading-6 text-indigo-700">
                                <p className="m-0">• Tên: <strong>{formName || '(chưa đặt)'}</strong></p>
                                <p className="m-0">• Kênh: {campaignChannel === 'email' ? 'Email' : campaignChannel === 'telegram' ? 'Telegram Bot' : 'Zalo cá nhân'}</p>
                                <p className="m-0">• {campaignChannel === 'email' ? `Tiêu đề: ${emailSubject || '(chưa nhập)'}` : `${formMessages.filter(m => m.trim()).length} tin nhắn`}</p>
                                <p className="m-0">• Đối tượng: {audienceType === 'all' ? (campaignChannel === 'email' ? 'Lead có consent' : 'Tất cả danh bạ') : audienceType === 'filter' ? 'Theo bộ lọc' : `${(campaignChannel === 'email' ? normalizeManualEmails(manualIds) : campaignChannel === 'telegram' ? normalizeTelegramDestinations(manualIds) : normalizeManualRecipientIds(manualIds)).length} ${campaignChannel === 'email' ? 'email' : 'đích'} thủ công`}</p>
                                <p className="m-0">• Delay: {antiSpamDelay}s {antiSpamRandomize ? '(±30%)' : ''} · Max {antiSpamMaxPerHour}/giờ</p>
                                <p className="m-0">• Khung giờ: {sendWindowEnabled ? `${sendWindowStart}:00 - ${sendWindowEnd}:00` : 'Không giới hạn'}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Navigation */}
                <div className="campaign-wizard-navigation">
                    <button
                        onClick={() => step > 0 ? setStep(step - 1) : setView('list')}
                        className="campaign-action-button campaign-action-button--secondary"
                    >
                        {step === 0 ? 'Hủy' : 'Quay lại'}
                    </button>

                    {step < 3 ? (
                        <button
                            disabled={!canNext()}
                            onClick={() => setStep(step + 1)}
                            className="campaign-action-button campaign-action-button--primary"
                        >
                            Tiếp theo
                            <ChevronRight size={16} />
                        </button>
                    ) : (
                        <button
                            disabled={creating}
                            onClick={handleCreateCampaign}
                            className="campaign-action-button campaign-action-button--primary"
                        >
                            {creating && <Spin size="small" />}
                            <Megaphone size={16} />
                            Tạo Campaign
                        </button>
                    )}
                </div>
            </DCard>
        </div>
    );

    // ═══════════════════════════════════
    // RENDER: DETAIL VIEW
    // ═══════════════════════════════════
    const renderDetail = () => {
        if (!selectedCampaign) return null;
        const c = selectedCampaign;
        const cfg = statusLookup[c.status] || statusLookup.draft;
        const processed = c.stats.sent + c.stats.failed + (c.stats.suppressed || 0) + (c.stats.unsubscribed || 0);
        const pct = c.stats.total > 0 ? Math.round((processed / c.stats.total) * 100) : 0;

        return (
            <div className="campaign-view-stack campaign-detail-view">
                {/* Header */}
                <div className="campaign-subheader campaign-detail-header">
                    <button
                        onClick={() => { setView('list'); setSelectedCampaign(null); }}
                        className="campaign-back-button flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-all duration-200 hover:bg-slate-50"
                    >
                        <ArrowLeft size={18} />
                    </button>
                    <h1 className="m-0 text-[22px] font-semibold tracking-tight text-slate-900">{c.name}</h1>
                    <StatusBadge status={c.status} text={cfg.text} tone={cfg.tone} />
                </div>

                {/* Stats Grid */}
                <div className="campaign-detail-kpis">
                    {[
                        { label: 'Đã gửi', value: c.stats.sent, icon: CheckCircle, tone: 'emerald' as Tone },
                        { label: 'Thất bại', value: c.stats.failed, icon: XCircle, tone: 'rose' as Tone },
                        { label: 'Đang chờ', value: c.stats.pending, icon: Clock, tone: 'amber' as Tone },
                        ...(c.channel === 'email' ? [
                            { label: 'Đã chặn', value: c.stats.suppressed || 0, icon: Shield, tone: 'amber' as Tone },
                            { label: 'Hủy đăng ký', value: c.stats.unsubscribed || 0, icon: UserCheck, tone: 'violet' as Tone },
                        ] : []),
                        { label: 'Tổng', value: c.stats.total, icon: Users, tone: 'indigo' as Tone },
                    ].map((s, i) => (
                        <div key={i} className="campaign-detail-kpi rounded-lg border border-slate-200 bg-white">
                            <div className="flex items-center gap-3 mb-3">
                                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${toneIcon[s.tone]}`}>
                                    <s.icon size={15} />
                                </div>
                                <span className="text-[12px] font-semibold uppercase tracking-[0.12em] text-slate-500">{s.label}</span>
                            </div>
                            <p className={`m-0 text-[28px] font-bold leading-none ${toneText[s.tone]}`}>{s.value}</p>
                        </div>
                    ))}
                </div>

                {/* Progress */}
                <DCard className="campaign-detail-progress-card">
                    <div className="campaign-detail-progress-heading">
                        <span className="text-[13px] font-medium text-slate-600">Tiến trình tổng thể</span>
                        <span className="text-[13px] font-semibold text-indigo-600">{pct}%</span>
                    </div>
                    <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                            className={`h-full rounded-full transition-all duration-700 ${c.stats.failed > 0 ? 'bg-amber-500' : 'bg-indigo-500'}`}
                            style={{ width: `${pct}%` }}
                        />
                    </div>
                    {c.liveProgress?.estimatedRemainingMs && c.status === 'running' && (
                        <p className="m-0 mt-3 text-[12px] text-slate-500">
                            ⏱️ Ước tính còn: {Math.round(c.liveProgress.estimatedRemainingMs / 60000)} phút
                        </p>
                    )}
                </DCard>

                {/* Actions */}
                <DCard className="campaign-actions-card">
                    <div className="campaign-detail-actions">
                        {c.status === 'draft' && (
                            <button
                                disabled={startingCampaignId !== null}
                                aria-busy={startingCampaignId === c._id}
                                onClick={async () => {
                                    const started = await handleStartCampaign(c._id);
                                    if (started) setView('list');
                                }}
                                className="campaign-action-button campaign-action-button--success">
                                {startingCampaignId === c._id ? <Spin size="small" /> : <Play size={15} />}
                                {startingCampaignId === c._id ? 'Đang bắt đầu…' : 'Bắt đầu gửi'}
                            </button>
                        )}
                        {c.status === 'running' && (
                            <button onClick={() => handlePause(c._id)}
                                className="campaign-action-button campaign-action-button--warning">
                                <Pause size={15} /> Tạm dừng
                            </button>
                        )}
                        {c.status === 'paused' && (
                            <button onClick={() => handleResume(c._id)}
                                className="campaign-action-button campaign-action-button--success">
                                <Play size={15} /> Tiếp tục
                            </button>
                        )}
                        {c.status === 'scheduled' && (
                            <button onClick={() => handleCancelSchedule(c._id, () => setView('list'))}
                                className="campaign-action-button campaign-action-button--danger">
                                <XCircle size={15} /> Hủy lịch
                            </button>
                        )}
                        {['draft', 'completed', 'failed'].includes(c.status) && (
                            <button onClick={() => { handleDelete(c._id); setView('list'); }}
                                className="campaign-action-button campaign-action-button--danger">
                                <Trash2 size={15} /> Xóa
                            </button>
                        )}
                    </div>
                </DCard>

                {/* Messages */}
                <DCard className="campaign-messages-card">
                    <SectionLabel icon={c.channel === 'email' ? Mail : Send} label={c.channel === 'email' ? 'Nội dung Email' : 'Chuỗi tin nhắn'} />
                    <div className="campaign-message-list">
                        {c.channel === 'email' ? (
                            <>
                                <div className="campaign-message-preview rounded-lg border border-slate-200 bg-slate-50/70 text-[14px] leading-6 text-slate-700">
                                    <strong>Tiêu đề:</strong> {c.subject}
                                </div>
                                {c.emailText && (
                                    <div className="campaign-message-preview whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50/70 text-[14px] leading-6 text-slate-700">
                                        {c.emailText}
                                    </div>
                                )}
                                {c.emailHtml && (
                                    <div className="campaign-message-preview rounded-lg border border-slate-200 bg-slate-50/70 text-[12px] leading-5 text-slate-600">
                                        <strong>HTML:</strong><pre className="m-0 mt-2 overflow-auto whitespace-pre-wrap">{c.emailHtml}</pre>
                                    </div>
                                )}
                            </>
                        ) : c.messages.map((m, i) => (
                            <div key={i} className="campaign-message-preview rounded-lg border border-slate-200 bg-slate-50/70 text-[14px] leading-6 text-slate-700">
                                {m}
                            </div>
                        ))}
                    </div>
                </DCard>

                {/* Config */}
                <DCard className="campaign-config-card">
                    <SectionLabel icon={BarChart3} label="Cấu hình" />
                    <div className="campaign-config-grid">
                        {[
                            { label: 'Kênh', value: c.channel === 'email' ? 'Email' : c.channel === 'telegram' ? 'Telegram Bot' : 'Zalo cá nhân' },
                            { label: 'Đối tượng', value: c.audience.type === 'all' ? 'Tất cả' : c.audience.type === 'filter' ? 'Bộ lọc' : 'Chọn tay' },
                            { label: 'Delay', value: `${c.antiSpam.delayBetweenMs / 1000}s ${c.antiSpam.randomizeDelay ? '(±30%)' : ''}` },
                            ...(c.channel !== 'email' && c.messages.length > 1 ? [{ label: 'Nghỉ giữa bước', value: `${(c.antiSpam.messageDelayMs || 1200) / 1000}s` }] : []),
                            { label: 'Max/giờ', value: String(c.antiSpam.maxPerHour) },
                            { label: 'Bắt đầu', value: dayjs(c.schedule.startAt).format('DD/MM/YYYY HH:mm') },
                            { label: 'Khung giờ', value: c.schedule.sendWindow ? `${c.schedule.sendWindow.startHour}:00 - ${c.schedule.sendWindow.endHour}:00` : 'Không giới hạn' },
                        ].map((item, i) => (
                            <div key={i} className="campaign-config-item rounded-lg border border-slate-200 bg-slate-50/70">
                                <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">{item.label}</p>
                                <p className="m-0 mt-1 text-[14px] font-semibold text-slate-800">{item.value}</p>
                            </div>
                        ))}
                    </div>
                </DCard>

                {c.channel !== 'email' && c.failedRecipients && c.failedRecipients.length > 0 && (
                    <DCard className="campaign-config-card">
                        <SectionLabel icon={AlertTriangle} label="Nhật ký gửi lỗi" />
                        <div className="mt-4 space-y-2">
                            {c.failedRecipients.slice(-50).reverse().map((failure, index) => (
                                <div key={`${failure.threadId}-${failure.timestamp || index}`} className="rounded-lg border border-rose-100 bg-rose-50/60 px-4 py-3">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <code className="text-[12px] font-semibold text-rose-700">{failure.threadId}</code>
                                        {failure.timestamp && <span className="text-[11px] text-slate-400">{dayjs(failure.timestamp).format('DD/MM/YYYY HH:mm:ss')}</span>}
                                    </div>
                                    <p className="m-0 mt-1 break-words text-[12px] leading-5 text-rose-700">{failure.error}</p>
                                </div>
                            ))}
                        </div>
                    </DCard>
                )}

                {c.channel === 'telegram' && c.recipients && (
                    <DCard className="campaign-config-card">
                        <SectionLabel icon={Radio} label="Hàng đợi Telegram" />
                        <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
                            <div className="grid min-w-[680px] grid-cols-[1.3fr_120px_100px_1.5fr] gap-3 bg-slate-50 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                                <span>Đích</span><span>Trạng thái</span><span>Lần thử</span><span>Kết quả</span>
                            </div>
                            {c.recipients.map(recipient => {
                                const labels: Record<string, string> = {
                                    pending: 'Đang chờ', sending: 'Đang gửi', sent: 'Đã gửi', failed: 'Thất bại',
                                };
                                return (
                                    <div key={recipient.id} className="grid min-w-[680px] grid-cols-[1.3fr_120px_100px_1.5fr] gap-3 border-t border-slate-100 px-4 py-3 text-[12px] text-slate-600">
                                        <code className="break-all font-semibold text-slate-700">{recipient.recipient}</code>
                                        <span className={recipient.status === 'sent' ? 'text-emerald-600' : recipient.status === 'failed' ? 'text-rose-600' : 'text-amber-600'}>{labels[recipient.status] || recipient.status}</span>
                                        <span>{recipient.attemptCount}</span>
                                        <span className="break-words">{recipient.lastError || (recipient.providerMessageId ? `Telegram message #${recipient.providerMessageId}` : '—')}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </DCard>
                )}

                {c.channel === 'email' && c.recipients && (
                    <DCard className="campaign-config-card">
                        <SectionLabel icon={Mail} label="Trạng thái người nhận" />
                        <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
                            <div className="grid min-w-[640px] grid-cols-[1.4fr_1fr_120px_100px] gap-3 bg-slate-50 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                                <span>Email</span><span>Trạng thái</span><span>Số lần thử</span><span>Thời gian</span>
                            </div>
                            {c.recipients.map(recipient => {
                                const statusLabel: Record<string, string> = {
                                    pending: 'Đang chờ', sending: 'Đang gửi', sent: 'SMTP đã nhận', failed: 'Thất bại',
                                    suppressed: 'Suppression', unsubscribed: 'Đã hủy đăng ký',
                                };
                                return (
                                    <div key={recipient.id} className="grid min-w-[640px] grid-cols-[1.4fr_1fr_120px_100px] gap-3 border-t border-slate-100 px-4 py-3 text-[12px] text-slate-600">
                                        <span className="truncate font-medium text-slate-800" title={recipient.recipient}>{recipient.recipient}</span>
                                        <span>{statusLabel[recipient.status] || recipient.status}</span>
                                        <span>{recipient.attemptCount}</span>
                                        <span>{recipient.sentAt ? new Date(recipient.sentAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : '—'}</span>
                                    </div>
                                );
                            })}
                            {c.recipients.length === 0 && (
                                <div className="px-4 py-8 text-center text-[13px] text-slate-500">Chưa chuẩn bị danh sách người nhận.</div>
                            )}
                        </div>
                        {c.stats.total > c.recipients.length && (
                            <p className="m-0 mt-3 text-[12px] text-slate-500">Hiển thị 100 người nhận đầu tiên trong tổng số {c.stats.total}.</p>
                        )}
                    </DCard>
                )}
            </div>
        );
    };

    return (
        <AppLayout>
            <Head>
                <title>Automation Hub | NemarkChat</title>
            </Head>
            <div id="campaign-page">
                {view === 'list' && renderList()}
                {view === 'create' && renderWizard()}
                {view === 'detail' && renderDetail()}
            </div>
            <style jsx global>{`
                #campaign-page,
                #campaign-page * {
                    box-sizing: border-box;
                }

                #campaign-page {
                    width: 100%;
                    max-width: 1380px;
                    margin: 0 auto;
                    padding: 28px 24px 64px;
                    color: #0f172a;
                }

                #campaign-page button {
                    font: inherit;
                }

                #campaign-page .campaign-view-stack > * + * {
                    margin-top: 24px !important;
                }

                #campaign-page .campaign-card {
                    padding: 24px !important;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px !important;
                    background: #fff;
                    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04), 0 8px 24px rgba(15, 23, 42, 0.035);
                }

                #campaign-page .campaign-card--flush {
                    padding: 0 !important;
                }

                #campaign-page .campaign-page-header {
                    display: flex;
                    align-items: flex-end;
                    justify-content: space-between;
                    gap: 24px;
                    min-height: 92px;
                }

                #campaign-page .campaign-page-heading {
                    min-width: 0;
                    max-width: 720px;
                }

                #campaign-page .campaign-eyebrow {
                    display: inline-flex;
                    align-items: center;
                    gap: 7px;
                    margin-bottom: 9px;
                    color: #4f46e5;
                    font-size: 12px;
                    font-weight: 700;
                    letter-spacing: 0.09em;
                    text-transform: uppercase;
                }

                #campaign-page .campaign-page-heading h1 {
                    margin: 0;
                    color: #0f172a;
                    font-size: clamp(26px, 2.2vw, 34px);
                    font-weight: 720;
                    line-height: 1.14;
                    letter-spacing: -0.035em;
                }

                #campaign-page .campaign-page-heading p {
                    margin: 9px 0 0;
                    color: #64748b;
                    font-size: 14px;
                    line-height: 1.6;
                }

                #campaign-page .campaign-action-button {
                    display: inline-flex !important;
                    min-height: 44px !important;
                    align-items: center !important;
                    justify-content: center !important;
                    gap: 8px !important;
                    padding: 0 18px !important;
                    border: 1px solid transparent;
                    border-radius: 8px !important;
                    appearance: none;
                    cursor: pointer;
                    font-size: 14px !important;
                    font-weight: 650 !important;
                    line-height: 1 !important;
                    white-space: nowrap;
                    transition: background-color 160ms ease, border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease;
                }

                #campaign-page .campaign-action-button:active:not(:disabled) {
                    transform: translateY(1px);
                }

                #campaign-page .campaign-action-button:disabled {
                    cursor: not-allowed;
                    opacity: 0.45;
                    box-shadow: none !important;
                }

                #campaign-page .campaign-action-button--primary {
                    border-color: #4f46e5;
                    background: #4f46e5;
                    color: #fff;
                    box-shadow: 0 6px 16px rgba(79, 70, 229, 0.18);
                }

                #campaign-page .campaign-action-button--primary:hover:not(:disabled) {
                    border-color: #4338ca;
                    background: #4338ca;
                }

                #campaign-page .campaign-action-button--secondary {
                    border-color: #cbd5e1;
                    background: #fff;
                    color: #475569;
                }

                #campaign-page .campaign-action-button--secondary:hover:not(:disabled) {
                    border-color: #94a3b8;
                    background: #f8fafc;
                }

                #campaign-page .campaign-action-button--success {
                    border-color: #059669;
                    background: #059669;
                    color: #fff;
                }

                #campaign-page .campaign-action-button--warning {
                    border-color: #f59e0b;
                    background: #fff;
                    color: #b45309;
                }

                #campaign-page .campaign-action-button--danger {
                    border-color: #fecdd3;
                    background: #fff;
                    color: #e11d48;
                }

                #campaign-page .campaign-kpi-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
                    gap: 16px;
                }

                #campaign-page .campaign-kpi-card {
                    min-width: 0;
                    min-height: 112px;
                    padding: 20px !important;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px !important;
                    background: #fff;
                    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
                }

                #campaign-page .campaign-kpi-content {
                    gap: 16px !important;
                }

                #campaign-page .campaign-kpi-value {
                    margin-top: 15px !important;
                }

                #campaign-page .campaign-kpi-icon {
                    display: flex;
                    width: 40px;
                    height: 40px;
                    align-items: center;
                    justify-content: center;
                    border-radius: 8px !important;
                }

                #campaign-page .campaign-section-label {
                    display: flex !important;
                    align-items: center !important;
                    gap: 10px !important;
                    min-width: 0;
                }

                #campaign-page .campaign-section-label > span:first-child {
                    display: flex;
                    width: 32px;
                    height: 32px;
                    flex: 0 0 auto;
                    align-items: center;
                    justify-content: center;
                    border-radius: 8px !important;
                }

                #campaign-page .campaign-list-panel {
                    overflow: hidden;
                }

                #campaign-page .campaign-list-heading {
                    display: flex;
                    min-height: 65px;
                    align-items: center;
                    justify-content: space-between;
                    gap: 16px;
                    padding: 16px 20px !important;
                    border-bottom: 1px solid #e2e8f0;
                    background: #fff;
                }

                #campaign-page .campaign-list-hint {
                    flex: 0 0 auto;
                    padding: 5px 9px !important;
                    border: 1px solid #dbeafe;
                    border-radius: 6px;
                    background: #eff6ff;
                    color: #2563eb;
                    font-size: 12px;
                    font-weight: 600;
                }

                #campaign-page .campaign-loading {
                    display: flex;
                    min-height: 360px;
                    align-items: center;
                    justify-content: center;
                }

                #campaign-page .campaign-empty-state {
                    display: flex;
                    min-height: 360px;
                    max-width: 520px;
                    margin: 0 auto;
                    padding: 52px 24px !important;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    text-align: center;
                }

                #campaign-page .campaign-empty-icon {
                    display: flex;
                    width: 64px;
                    height: 64px;
                    margin-bottom: 20px;
                    align-items: center;
                    justify-content: center;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    background: #f8fafc;
                    color: #94a3b8;
                }

                #campaign-page .campaign-empty-state h2 {
                    margin: 0;
                    color: #0f172a;
                    font-size: 19px;
                    font-weight: 700;
                    letter-spacing: -0.015em;
                }

                #campaign-page .campaign-empty-state p {
                    max-width: 430px;
                    margin: 9px 0 22px;
                    color: #64748b;
                    font-size: 14px;
                    line-height: 1.65;
                }

                #campaign-page .campaign-table-header,
                #campaign-page .campaign-table-row {
                    display: grid;
                    grid-template-columns: minmax(220px, 1.5fr) 130px minmax(160px, 0.9fr) 110px 140px;
                    align-items: center;
                    column-gap: 18px;
                }

                #campaign-page .campaign-table-header {
                    min-height: 43px;
                    padding: 10px 20px !important;
                    border-bottom: 1px solid #e2e8f0;
                    background: #f8fafc;
                    color: #64748b;
                    font-size: 11px;
                    font-weight: 700;
                    letter-spacing: 0.09em;
                    text-transform: uppercase;
                }

                #campaign-page .campaign-table-header span:last-child {
                    text-align: right;
                }

                #campaign-page .campaign-table-row {
                    min-height: 78px;
                    padding: 15px 20px !important;
                    border-bottom: 1px solid #f1f5f9;
                    background: #fff;
                    transition: background-color 150ms ease;
                }

                #campaign-page .campaign-table-row:last-child {
                    border-bottom: 0;
                }

                #campaign-page .campaign-table-row:hover {
                    background: #fafbfc;
                }

                #campaign-page .campaign-table-name {
                    min-width: 0;
                }

                #campaign-page .campaign-table-name p {
                    overflow: hidden;
                    margin: 0;
                    color: #0f172a;
                    font-size: 14px;
                    font-weight: 650;
                    line-height: 1.4;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                #campaign-page .campaign-table-name span {
                    display: block;
                    margin-top: 4px;
                    color: #94a3b8;
                    font-size: 12px;
                }

                #campaign-page .campaign-status-badge {
                    display: inline-flex !important;
                    min-height: 27px;
                    align-items: center;
                    gap: 6px !important;
                    padding: 4px 8px !important;
                    border-radius: 6px !important;
                    white-space: nowrap;
                }

                #campaign-page .campaign-progress-track {
                    width: 100%;
                    height: 6px;
                    overflow: hidden;
                    border-radius: 4px;
                    background: #e2e8f0;
                }

                #campaign-page .campaign-progress-value {
                    height: 100%;
                    border-radius: 4px;
                    background: #4f46e5;
                    transition: width 500ms ease;
                }

                #campaign-page .campaign-table-progress p {
                    margin: 7px 0 0;
                    color: #94a3b8;
                    font-size: 11px;
                    line-height: 1;
                }

                #campaign-page .campaign-progress-empty {
                    color: #94a3b8;
                    font-size: 12px;
                }

                #campaign-page .campaign-table-audience > span {
                    display: inline-flex;
                    align-items: center;
                    min-height: 27px;
                    padding: 4px 8px !important;
                    border: 1px solid #e2e8f0;
                    border-radius: 6px;
                    background: #f8fafc;
                    color: #475569;
                    font-size: 12px;
                    font-weight: 600;
                    white-space: nowrap;
                }

                #campaign-page .campaign-table-actions {
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    gap: 7px !important;
                }

                #campaign-page .campaign-icon-button,
                #campaign-page .campaign-back-button {
                    display: inline-flex !important;
                    align-items: center;
                    justify-content: center;
                    padding: 0 !important;
                    border-radius: 8px !important;
                    cursor: pointer;
                }

                #campaign-page .campaign-icon-button:disabled {
                    cursor: not-allowed;
                    opacity: 0.5;
                }

                #campaign-page .campaign-back-button {
                    width: 40px;
                    height: 40px;
                    flex: 0 0 40px;
                }

                #campaign-page .campaign-subheader {
                    display: flex;
                    align-items: center;
                    gap: 12px !important;
                    min-height: 44px;
                }

                #campaign-page .campaign-subheader h1 {
                    margin: 0;
                    color: #0f172a;
                    font-size: 23px;
                    font-weight: 700;
                    line-height: 1.25;
                    letter-spacing: -0.025em;
                }

                #campaign-page .campaign-wizard-card,
                #campaign-page .campaign-wizard-view > .campaign-subheader {
                    width: 100%;
                    max-width: 960px;
                    margin-right: auto;
                    margin-left: auto;
                }

                #campaign-page .campaign-stepper {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin-bottom: 32px !important;
                }

                #campaign-page .campaign-step-wrap {
                    display: flex;
                    flex: 0 0 auto;
                    align-items: center;
                }

                #campaign-page .campaign-step {
                    display: flex;
                    width: 120px;
                    flex-direction: column;
                    align-items: center;
                    gap: 8px !important;
                }

                #campaign-page .campaign-step > div:first-child {
                    display: flex;
                    width: 40px;
                    height: 40px;
                    align-items: center;
                    justify-content: center;
                    border-radius: 8px !important;
                }

                #campaign-page .campaign-step-connector {
                    width: 32px;
                    margin-top: -20px;
                }

                #campaign-page .campaign-form-stack > * + * {
                    margin-top: 24px !important;
                }

                #campaign-page .campaign-form-panel {
                    padding: 20px !important;
                    border-radius: 8px !important;
                }

                #campaign-page .campaign-form-grid {
                    display: grid;
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                    gap: 16px !important;
                }

                #campaign-page .campaign-audience-grid {
                    display: grid;
                    grid-template-columns: repeat(3, minmax(0, 1fr));
                    gap: 12px !important;
                }

                #campaign-page .campaign-audience-option {
                    display: flex !important;
                    min-height: 154px;
                    flex-direction: column;
                    align-items: center;
                    gap: 8px !important;
                    padding: 18px !important;
                    border-radius: 8px !important;
                    text-align: center;
                }

                #campaign-page .campaign-add-message-button {
                    padding: 0 16px !important;
                    border-radius: 8px !important;
                }

                #campaign-page :where(.ant-input, textarea.ant-input, .ant-picker, .ant-input-number, .ant-select-selector) {
                    border-radius: 8px !important;
                }

                #campaign-page .campaign-wizard-navigation {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 12px !important;
                    margin-top: 32px !important;
                    padding-top: 24px !important;
                    border-top: 1px solid #e2e8f0;
                }

                #campaign-page .campaign-detail-header {
                    flex-wrap: wrap;
                }

                #campaign-page .campaign-detail-kpis {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
                    gap: 16px !important;
                }

                #campaign-page .campaign-detail-kpi {
                    padding: 18px !important;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px !important;
                    background: #fff;
                    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
                }

                #campaign-page .campaign-detail-progress-heading {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 16px;
                    margin-bottom: 12px !important;
                }

                #campaign-page .campaign-detail-actions {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 10px !important;
                }

                #campaign-page .campaign-message-list {
                    margin-top: 16px !important;
                }

                #campaign-page .campaign-message-list > * + * {
                    margin-top: 8px !important;
                }

                #campaign-page .campaign-message-preview,
                #campaign-page .campaign-config-item {
                    padding: 12px 14px !important;
                    border-radius: 8px !important;
                }

                #campaign-page .campaign-config-grid {
                    display: grid;
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                    gap: 14px !important;
                    margin-top: 16px !important;
                }

                @media (max-width: 1120px) {
                    #campaign-page .campaign-table-header {
                        display: none;
                    }

                    #campaign-page .campaign-table-body {
                        padding: 12px !important;
                        background: #f8fafc;
                    }

                    #campaign-page .campaign-table-row {
                        grid-template-columns: minmax(0, 1fr) auto;
                        gap: 14px 18px !important;
                        min-height: 0;
                        padding: 18px !important;
                        border: 1px solid #e2e8f0;
                        border-radius: 8px;
                    }

                    #campaign-page .campaign-table-row + .campaign-table-row {
                        margin-top: 10px;
                    }

                    #campaign-page .campaign-table-name,
                    #campaign-page .campaign-table-progress,
                    #campaign-page .campaign-table-actions {
                        grid-column: 1 / -1;
                    }

                    #campaign-page .campaign-table-status {
                        grid-column: 1;
                    }

                    #campaign-page .campaign-table-audience {
                        grid-column: 2;
                        justify-self: end;
                    }

                    #campaign-page .campaign-table-actions {
                        justify-content: flex-start;
                    }
                }

                @media (max-width: 700px) {
                    #campaign-page {
                        padding: 20px 16px 48px;
                    }

                    #campaign-page .campaign-page-header {
                        min-height: 0;
                        flex-direction: column;
                        align-items: stretch;
                    }

                    #campaign-page .campaign-page-header > .campaign-action-button {
                        width: 100%;
                    }

                    #campaign-page .campaign-card {
                        padding: 20px !important;
                    }

                    #campaign-page .campaign-card--flush {
                        padding: 0 !important;
                    }

                    #campaign-page .campaign-stepper {
                        display: grid;
                        grid-template-columns: repeat(4, minmax(0, 1fr));
                        gap: 6px !important;
                        margin-bottom: 26px !important;
                    }

                    #campaign-page .campaign-step-wrap {
                        display: block;
                        min-width: 0;
                    }

                    #campaign-page .campaign-step {
                        width: auto;
                        min-width: 0;
                    }

                    #campaign-page .campaign-step span {
                        overflow: hidden;
                        width: 100%;
                        font-size: 10px !important;
                        text-align: center;
                        text-overflow: ellipsis;
                        white-space: nowrap;
                    }

                    #campaign-page .campaign-step-connector {
                        display: none;
                    }

                    #campaign-page .campaign-audience-grid,
                    #campaign-page .campaign-form-grid {
                        grid-template-columns: 1fr;
                    }

                    #campaign-page .campaign-audience-option {
                        display: grid !important;
                        grid-template-columns: 48px minmax(0, 1fr);
                        min-height: 0;
                        align-items: center;
                        justify-items: start;
                        gap: 3px 12px !important;
                        text-align: left !important;
                    }

                    #campaign-page .campaign-audience-option > div {
                        grid-row: 1 / 3;
                    }

                    #campaign-page .campaign-wizard-navigation .campaign-action-button {
                        min-width: 0;
                        flex: 1 1 0;
                        padding-right: 12px !important;
                        padding-left: 12px !important;
                    }
                }

                @media (max-width: 540px) {
                    #campaign-page .campaign-kpi-grid {
                        grid-template-columns: 1fr;
                        gap: 10px;
                    }

                    #campaign-page .campaign-kpi-card {
                        min-height: 96px;
                        padding: 17px !important;
                    }

                    #campaign-page .campaign-kpi-value {
                        margin-top: 11px !important;
                        font-size: 28px !important;
                    }

                    #campaign-page .campaign-list-heading {
                        align-items: flex-start;
                        flex-direction: column;
                        gap: 10px;
                    }

                    #campaign-page .campaign-empty-state {
                        min-height: 330px;
                        padding: 42px 18px !important;
                    }

                    #campaign-page .campaign-empty-state .campaign-action-button {
                        width: 100%;
                    }

                    #campaign-page .campaign-detail-kpis {
                        grid-template-columns: repeat(2, minmax(0, 1fr));
                        gap: 10px !important;
                    }

                    #campaign-page .campaign-detail-kpi {
                        padding: 14px !important;
                    }

                    #campaign-page .campaign-config-grid {
                        grid-template-columns: 1fr;
                    }
                }

                @media (max-width: 400px) {
                    #campaign-page {
                        padding-right: 12px;
                        padding-left: 12px;
                    }

                    #campaign-page .campaign-table-body {
                        padding: 8px !important;
                    }

                    #campaign-page .campaign-table-row {
                        padding: 15px !important;
                    }

                    #campaign-page .campaign-detail-kpis {
                        grid-template-columns: 1fr;
                    }

                    #campaign-page .campaign-wizard-navigation {
                        gap: 8px !important;
                    }

                    #campaign-page .campaign-wizard-navigation .campaign-action-button {
                        font-size: 13px !important;
                    }
                }
            `}</style>
        </AppLayout>
    );
}
