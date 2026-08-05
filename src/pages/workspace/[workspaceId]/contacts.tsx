import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState, useCallback } from 'react';
import {
    Input, Table, Tag, Button, Drawer, message, Select,
    Tooltip, Empty, Badge, Spin,
} from 'antd';
import {
    Search, Download, Users, UserCheck, Phone, Mail, Globe, Clock,
    MessageSquare, Eye, Edit2, X as XIcon, Filter,
    UserPlus, Send, MessageCircle, ArrowUpRight, Zap, Star,
    ChevronRight, Calendar, TrendingUp, ExternalLink,
} from 'lucide-react';
import { useGetMe } from '../../../domains/auth/auth.hooks';
import { httpClient } from '../../../lib/http/client';
import AppLayout from '../../../components/layout/AppLayout';
import type { ColumnsType } from 'antd/es/table';

// ── Types ──
interface Contact {
    _id: string;
    name: string;
    email?: string;
    phone?: string;
    channel: 'widget' | 'zalo';
    source?: string;
    avatar?: string;
    totalConversations?: number;
    totalMessages?: number;
    firstSeen: string;
    lastSeen: string;
    lastMessagePreview?: string;
    visitorId?: string;
    zaloUserId?: string;
    attributes?: Record<string, any>;
    metadata?: Record<string, any>;
}

interface ZaloFriend {
    threadId: string;
    threadType: string;
    displayName: string;
    avatar: string;
    lastMessage: string;
    lastMessageAt: string;
}

// ── Helpers ──
function timeAgo(dateStr: string) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Vừa xong';
    if (diffMin < 60) return `${diffMin} phút trước`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH} giờ trước`;
    const diffD = Math.floor(diffH / 24);
    if (diffD < 30) return `${diffD} ngày trước`;
    return d.toLocaleDateString('vi-VN');
}

function getAvatarGradient(name: string, channel: string) {
    if (channel === 'zalo') return 'linear-gradient(135deg, #0068ff, #00c3ff)';
    const hue = (name.charCodeAt(0) * 47 + (name.charCodeAt(1) || 0) * 23) % 360;
    return `linear-gradient(135deg, hsl(${hue}, 65%, 55%), hsl(${(hue + 30) % 360}, 55%, 60%))`;
}

const CUSTOMER_TRACKING_FIELDS = new Set(['primaryIssue', 'customerGoal', 'nextAction', 'issuePriority']);

type TrackingFilter = 'all' | 'high' | 'missingIssue' | 'missingNextAction' | 'ready';

function getContactTracking(contact: Contact): Record<string, any> {
    return contact.channel === 'zalo' ? (contact.metadata || {}) : (contact.attributes || {});
}

function normalizeIssuePriority(value: unknown): '' | 'high' | 'medium' | 'low' {
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized) return '';
    if (['high', 'cao', 'urgent', 'khẩn', 'khan'].includes(normalized)) return 'high';
    if (['medium', 'trung bình', 'trung binh', 'normal'].includes(normalized)) return 'medium';
    if (['low', 'thấp', 'thap'].includes(normalized)) return 'low';
    return '';
}

function issuePriorityLabel(value: unknown): string {
    const priority = normalizeIssuePriority(value);
    if (priority === 'high') return 'Cao';
    if (priority === 'medium') return 'Trung bình';
    if (priority === 'low') return 'Thấp';
    return String(value || 'Chưa đặt');
}

export default function ContactsPage() {
    const router = useRouter();
    const { workspaceId } = router.query as { workspaceId: string };
    const { data: meData, isLoading: meLoading } = useGetMe();

    const [contacts, setContacts] = useState<Contact[]>([]);
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [searchText, setSearchText] = useState('');
    const [activeTab, setActiveTab] = useState<'all' | 'widget' | 'zalo' | 'friends'>('all');
    const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [editingField, setEditingField] = useState<string | null>(null);
    const [editValue, setEditValue] = useState('');
    const [exporting, setExporting] = useState(false);

    const [friends, setFriends] = useState<ZaloFriend[]>([]);
    const [friendsTotal, setFriendsTotal] = useState(0);
    const [friendsLoading, setFriendsLoading] = useState(false);
    const [friendsConnected, setFriendsConnected] = useState(false);
    const [friendSearch, setFriendSearch] = useState('');

    const [stats, setStats] = useState({ total: 0, widget: 0, zalo: 0, friends: 0 });
    const [trackingFilter, setTrackingFilter] = useState<TrackingFilter>('all');

    const pageInsights = useMemo(() => contacts.reduce((result, contact) => {
        const tracking = getContactTracking(contact);
        const hasIssue = Boolean(String(tracking.primaryIssue || '').trim());
        const hasGoal = Boolean(String(tracking.customerGoal || '').trim());
        const hasNextAction = Boolean(String(tracking.nextAction || '').trim());
        if (normalizeIssuePriority(tracking.issuePriority) === 'high') result.high += 1;
        if (!hasIssue) result.missingIssue += 1;
        if (hasIssue && !hasNextAction) result.missingNextAction += 1;
        if (hasIssue && hasGoal && hasNextAction) result.ready += 1;
        return result;
    }, { high: 0, missingIssue: 0, missingNextAction: 0, ready: 0 }), [contacts]);

    const filteredContacts = useMemo(() => contacts.filter(contact => {
        if (trackingFilter === 'all') return true;
        const tracking = getContactTracking(contact);
        const hasIssue = Boolean(String(tracking.primaryIssue || '').trim());
        const hasGoal = Boolean(String(tracking.customerGoal || '').trim());
        const hasNextAction = Boolean(String(tracking.nextAction || '').trim());
        if (trackingFilter === 'high') return normalizeIssuePriority(tracking.issuePriority) === 'high';
        if (trackingFilter === 'missingIssue') return !hasIssue;
        if (trackingFilter === 'missingNextAction') return hasIssue && !hasNextAction;
        return hasIssue && hasGoal && hasNextAction;
    }), [contacts, trackingFilter]);

    // ── Fetch contacts ──
    const fetchContacts = useCallback(async () => {
        if (!workspaceId || activeTab === 'friends') return;
        setLoading(true);
        try {
            let widgetContacts: Contact[] = [];
            let zaloContacts: Contact[] = [];
            let wTotal = 0;
            let zTotal = 0;

            if (activeTab === 'all' || activeTab === 'widget') {
                const wRes = await httpClient.get(`/conversations/workspace/${workspaceId}/visitors`, {
                    params: { page, limit: pageSize, search: searchText || undefined },
                });
                const wData = wRes.data?.data;
                wTotal = wData?.total || 0;
                widgetContacts = (wData?.items || []).map((v: any) => ({
                    _id: v._id,
                    name: v.name || v.email || v.visitorId?.slice(0, 8) || 'Khách',
                    email: v.email,
                    phone: v.phone,
                    channel: 'widget' as const,
                    totalConversations: v.totalConversations || 0,
                    firstSeen: v.firstSeenAt || v.createdAt,
                    lastSeen: v.lastSeenAt || v.updatedAt,
                    visitorId: v.visitorId,
                    attributes: v.attributes || {},
                }));
            }

            if (activeTab === 'all' || activeTab === 'zalo') {
                try {
                    const zRes = await httpClient.get(`/workspaces/${workspaceId}/zalo/contacts`, {
                        params: { page, limit: pageSize, search: searchText || undefined },
                    });
                    const zData = zRes.data?.data;
                    zTotal = zData?.total || 0;
                    zaloContacts = (zData?.items || []).map((c: any) => ({
                        _id: c._id,
                        name: c.displayName || `Zalo ${c.zaloUserId?.slice(0, 6)}`,
                        phone: c.phoneNumber,
                        channel: 'zalo' as const,
                        source: c.source,
                        avatar: c.avatar,
                        totalMessages: c.totalMessages || 0,
                        firstSeen: c.firstContactAt || c.createdAt,
                        lastSeen: c.lastMessageAt || c.updatedAt,
                        lastMessagePreview: c.lastMessagePreview,
                        zaloUserId: c.zaloUserId,
                        metadata: c.metadata || {},
                    }));
                } catch {
                    console.warn('Zalo contacts not available');
                }
            }

            if (activeTab === 'all') {
                const zaloUserIds = new Set(zaloContacts.map(c => c.zaloUserId).filter(Boolean));
                const filteredWidget = widgetContacts.filter(v => {
                    if (!v.visitorId) return true;
                    if (v.visitorId.startsWith('zalo_')) {
                        const zaloId = v.visitorId.replace('zalo_', '');
                        return !zaloUserIds.has(zaloId);
                    }
                    return true;
                });
                const combined = [...filteredWidget, ...zaloContacts]
                    .sort((a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime());
                setContacts(combined);
                setTotal(wTotal + zTotal);
            } else if (activeTab === 'widget') {
                const filteredWidget = widgetContacts.filter(v => !v.visitorId?.startsWith('zalo_'));
                setContacts(filteredWidget);
                setTotal(wTotal);
            } else {
                setContacts(zaloContacts);
                setTotal(zTotal);
            }

            setStats(prev => ({ ...prev, total: wTotal + zTotal, widget: wTotal, zalo: zTotal }));
        } catch (err) {
            console.error('[Contacts] Fetch error:', err);
            message.error('Lỗi tải danh sách liên hệ');
        } finally {
            setLoading(false);
        }
    }, [workspaceId, page, pageSize, searchText, activeTab]);

    const fetchFriends = useCallback(async () => {
        if (!workspaceId || activeTab !== 'friends') return;
        setFriendsLoading(true);
        try {
            const res = await httpClient.get(`/workspaces/${workspaceId}/zalo/friends`, {
                params: { search: friendSearch || undefined, page: 1, limit: 200 },
            });
            const data = res.data?.data;
            setFriends(data?.items || []);
            setFriendsTotal(data?.total || 0);
            setFriendsConnected(data?.connected !== false);
            setStats(prev => ({ ...prev, friends: data?.total || 0 }));
        } catch {
            console.warn('Friends list not available');
            setFriendsConnected(false);
        } finally {
            setFriendsLoading(false);
        }
    }, [workspaceId, friendSearch, activeTab]);

    useEffect(() => { fetchContacts(); }, [fetchContacts]);
    useEffect(() => { fetchFriends(); }, [fetchFriends]);
    useEffect(() => {
        if (!workspaceId) return;
        let cancelled = false;
        httpClient.get(`/workspaces/${workspaceId}/zalo/friends`, {
            params: { page: 1, limit: 1 },
        }).then((res) => {
            if (cancelled) return;
            setStats(prev => ({ ...prev, friends: res.data?.data?.total || 0 }));
        }).catch(() => { /* Zalo may not be connected yet */ });
        return () => { cancelled = true; };
    }, [workspaceId]);

    const handleChatWithFriend = (friend: ZaloFriend) => {
        router.push(`/workspace/${workspaceId}/inbox?zaloThread=${friend.threadId}&zaloName=${encodeURIComponent(friend.displayName)}`);
    };

    const handleExport = async () => {
        if (!workspaceId) return;
        setExporting(true);
        try {
            const downloads: Promise<void>[] = [];
            if (activeTab === 'all' || activeTab === 'widget') {
                downloads.push(
                    httpClient.get(`/conversations/workspace/${workspaceId}/visitors/export`, {
                        responseType: 'blob', params: { search: searchText || undefined },
                    }).then(res => {
                        const url = window.URL.createObjectURL(new Blob([res.data]));
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = `widget_visitors_${new Date().toISOString().slice(0, 10)}.csv`;
                        link.click();
                        window.URL.revokeObjectURL(url);
                    })
                );
            }
            if (activeTab === 'all' || activeTab === 'zalo') {
                downloads.push(
                    httpClient.get(`/workspaces/${workspaceId}/zalo/contacts/export`, { responseType: 'blob' }).then(res => {
                        const url = window.URL.createObjectURL(new Blob([res.data]));
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = `zalo_contacts_${new Date().toISOString().slice(0, 10)}.csv`;
                        link.click();
                        window.URL.revokeObjectURL(url);
                    }).catch(() => {})
                );
            }
            await Promise.all(downloads);
            message.success('Đã xuất file CSV thành công!');
        } catch {
            message.error('Lỗi khi export');
        } finally {
            setExporting(false);
        }
    };

    const handleUpdateContact = async (contact: Contact, field: string, value: string) => {
        try {
            const isTrackingField = CUSTOMER_TRACKING_FIELDS.has(field);
            const storedValue = field === 'issuePriority'
                ? (normalizeIssuePriority(value) || '')
                : value;
            if (contact.channel === 'widget' && contact.visitorId) {
                await httpClient.patch(
                    `/conversations/workspace/${workspaceId}/visitors/${contact.visitorId}`,
                    isTrackingField ? { attributes: { [field]: storedValue } } : { [field]: storedValue },
                );
            } else if (contact.channel === 'zalo' && contact.zaloUserId) {
                const payload: any = {};
                if (isTrackingField) payload.metadata = { ...(contact.metadata || {}), [field]: storedValue };
                else if (field === 'name') payload.displayName = storedValue;
                else if (field === 'phone') payload.phoneNumber = storedValue;
                else payload[field] = storedValue;
                await httpClient.patch(`/workspaces/${workspaceId}/zalo/contacts/${contact.zaloUserId}`, payload);
            }
            message.success('Đã cập nhật');
            setEditingField(null);
            setEditValue('');
            fetchContacts();
            if (selectedContact?._id === contact._id) {
                setSelectedContact(isTrackingField
                    ? {
                        ...contact,
                        ...(contact.channel === 'zalo'
                            ? { metadata: { ...(contact.metadata || {}), [field]: storedValue } }
                            : { attributes: { ...(contact.attributes || {}), [field]: storedValue } }),
                    }
                    : { ...contact, [field]: storedValue } as Contact);
            }
        } catch {
            message.error('Lỗi cập nhật');
        }
    };

    // ── Table columns ──
    const columns: ColumnsType<Contact> = [
        {
            title: 'Khách hàng',
            dataIndex: 'name',
            key: 'name',
            width: 260,
            render: (value: string, record: Contact) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {record.avatar ? (
                        <img src={record.avatar} alt="" style={{
                            width: 40, height: 40, borderRadius: 12, objectFit: 'cover',
                            border: '2px solid #f1f5f9',
                        }} />
                    ) : (
                        <div style={{
                            width: 40, height: 40, borderRadius: 12,
                            background: getAvatarGradient(value || '?', record.channel),
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#fff', fontSize: 15, fontWeight: 700,
                            boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                        }}>
                            {(value || '?')[0]?.toUpperCase()}
                        </div>
                    )}
                    <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 13.5, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {value || 'Khách'}
                        </div>
                        {record.email && <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>{record.email}</div>}
                    </div>
                </div>
            ),
        },
        {
            title: 'Kênh',
            dataIndex: 'channel',
            key: 'channel',
            width: 100,
            align: 'center' as const,
            render: (ch: string) => (
                <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    fontSize: 11.5, fontWeight: 600,
                    padding: '3px 10px', borderRadius: 8,
                    background: ch === 'zalo' ? '#eff6ff' : '#f5f3ff',
                    color: ch === 'zalo' ? '#2563eb' : '#7c3aed',
                    border: `1px solid ${ch === 'zalo' ? '#dbeafe' : '#ede9fe'}`,
                }}>
                    {ch === 'zalo' ? '💬' : '🌐'} {ch === 'zalo' ? 'Zalo' : 'Widget'}
                </span>
            ),
        },
        {
            title: 'Liên hệ',
            key: 'contact',
            width: 180,
            render: (_: any, record: Contact) => (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {record.phone && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}>
                            <div style={{ width: 22, height: 22, borderRadius: 6, background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Phone size={11} color="#10b981" />
                            </div>
                            <span style={{ color: '#334155', fontWeight: 500 }}>{record.phone}</span>
                        </div>
                    )}
                    {record.email && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}>
                            <div style={{ width: 22, height: 22, borderRadius: 6, background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Mail size={11} color="#6366f1" />
                            </div>
                            <span style={{ color: '#334155', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>{record.email}</span>
                        </div>
                    )}
                    {!record.phone && !record.email && <span style={{ color: '#cbd5e1', fontSize: 12, fontStyle: 'italic' }}>Chưa có</span>}
                </div>
            ),
        },
        {
            title: 'Hoạt động',
            key: 'activity',
            width: 150,
            render: (_: any, record: Contact) => (
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}>
                        <div style={{ width: 22, height: 22, borderRadius: 6, background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <MessageSquare size={11} color="#64748b" />
                        </div>
                        <span style={{ color: '#334155', fontWeight: 600 }}>
                            {record.totalConversations ?? record.totalMessages ?? 0}
                        </span>
                        <span style={{ color: '#94a3b8', fontSize: 11.5 }}>
                            {record.channel === 'zalo' ? 'tin nhắn' : 'hội thoại'}
                        </span>
                    </div>
                    {record.lastMessagePreview && (
                        <div style={{
                            color: '#94a3b8', fontSize: 11, marginTop: 4,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            maxWidth: 140, paddingLeft: 28,
                        }}>
                            {record.lastMessagePreview}
                        </div>
                    )}
                </div>
            ),
        },
        {
            title: 'Lần cuối',
            dataIndex: 'lastSeen',
            key: 'lastSeen',
            width: 130,
            sorter: (a: Contact, b: Contact) => new Date(a.lastSeen).getTime() - new Date(b.lastSeen).getTime(),
            defaultSortOrder: 'descend',
            render: (v: string) => (
                <Tooltip title={v ? new Date(v).toLocaleString('vi-VN') : ''}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <Clock size={12} color="#cbd5e1" />
                        <span style={{ fontSize: 12, color: '#64748b' }}>{timeAgo(v)}</span>
                    </div>
                </Tooltip>
            ),
        },
        {
            title: '',
            key: 'actions',
            width: 50,
            render: (_: any, record: Contact) => (
                <div
                    onClick={(e) => { e.stopPropagation(); setSelectedContact(record); setDrawerOpen(true); }}
                    style={{
                        width: 32, height: 32, borderRadius: 8,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', transition: 'all 0.15s',
                        color: '#94a3b8',
                    }}
                    onMouseEnter={e => { (e.currentTarget as any).style.background = '#eef2ff'; (e.currentTarget as any).style.color = '#6366f1'; }}
                    onMouseLeave={e => { (e.currentTarget as any).style.background = 'transparent'; (e.currentTarget as any).style.color = '#94a3b8'; }}
                >
                    <ChevronRight size={16} />
                </div>
            ),
        },
    ];

    if (meLoading || !workspaceId) {
        return <AppLayout><div style={{ textAlign: 'center', padding: 100 }}><Spin size="large" /></div></AppLayout>;
    }

    const tabItems = [
        { key: 'all', label: 'Tất cả', icon: '📋', count: stats.total },
        { key: 'widget', label: 'Widget', icon: '🌐', count: stats.widget },
        { key: 'zalo', label: 'Zalo', icon: '💬', count: stats.zalo },
        { key: 'friends', label: 'Bạn bè Zalo', icon: '👥', count: stats.friends },
    ] as const;

    return (
        <AppLayout>
            <Head><title>Khách hàng 360 | NemarkChat</title></Head>

            <div style={{ padding: '24px 28px 64px', maxWidth: 1280, margin: '0 auto' }}>

                {/* ═══ Header ═══ */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                            <div style={{
                                width: 42, height: 42, borderRadius: 14,
                                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                boxShadow: '0 4px 12px rgba(99,102,241,0.25)',
                            }}>
                                <Users size={20} color="white" />
                            </div>
                            <div>
                                <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: -0.5 }}>
                                    Khách hàng 360
                                </h1>
                                <p style={{ color: '#94a3b8', fontSize: 13, margin: 0 }}>
                                    Hồ sơ hợp nhất, vấn đề ưu tiên và bước chăm sóc tiếp theo của từng khách
                                </p>
                            </div>
                        </div>
                    </div>
                    {activeTab !== 'friends' && (
                        <button
                            onClick={handleExport}
                            disabled={exporting}
                            style={{
                                height: 40, display: 'inline-flex', alignItems: 'center', gap: 8,
                                padding: '0 18px', borderRadius: 12, fontSize: 13, fontWeight: 600,
                                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                color: 'white', border: 'none', cursor: 'pointer',
                                boxShadow: '0 4px 14px rgba(99,102,241,0.3)',
                                transition: 'all 0.2s', opacity: exporting ? 0.7 : 1,
                            }}
                        >
                            <Download size={15} /> Export CSV
                        </button>
                    )}
                </div>

                {/* ═══ Stats Cards ═══ */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14, marginBottom: 18 }}>
                    {[
                        { label: 'Tổng liên hệ', value: stats.total, icon: <Users size={18} />, color: '#6366f1', gradient: 'linear-gradient(135deg, #6366f1, #818cf8)', light: '#eef2ff' },
                        { label: 'Widget Chat', value: stats.widget, icon: <Globe size={18} />, color: '#8b5cf6', gradient: 'linear-gradient(135deg, #8b5cf6, #a78bfa)', light: '#f5f3ff' },
                        { label: 'Zalo Contacts', value: stats.zalo, icon: <MessageSquare size={18} />, color: '#0ea5e9', gradient: 'linear-gradient(135deg, #0ea5e9, #38bdf8)', light: '#f0f9ff' },
                        { label: 'Bạn bè Zalo', value: stats.friends, icon: <UserPlus size={18} />, color: '#10b981', gradient: 'linear-gradient(135deg, #10b981, #34d399)', light: '#ecfdf5' },
                    ].map((s, i) => (
                        <div
                            key={i}
                            onClick={i === 3 ? () => setActiveTab('friends') : undefined}
                            style={{
                                background: 'white',
                                borderRadius: 16,
                                padding: '20px 20px',
                                border: '1px solid #e8ecf0',
                                display: 'flex', alignItems: 'center', gap: 14,
                                cursor: i === 3 ? 'pointer' : 'default',
                                transition: 'all 0.2s',
                                position: 'relative',
                                overflow: 'hidden',
                            }}
                            onMouseEnter={e => {
                                if (i === 3) {
                                    (e.currentTarget as any).style.borderColor = '#a7f3d0';
                                    (e.currentTarget as any).style.transform = 'translateY(-2px)';
                                    (e.currentTarget as any).style.boxShadow = '0 4px 16px rgba(0,0,0,0.06)';
                                }
                            }}
                            onMouseLeave={e => {
                                if (i === 3) {
                                    (e.currentTarget as any).style.borderColor = '#e8ecf0';
                                    (e.currentTarget as any).style.transform = 'none';
                                    (e.currentTarget as any).style.boxShadow = 'none';
                                }
                            }}
                        >
                            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: s.gradient }} />
                            <div style={{
                                width: 44, height: 44, borderRadius: 12,
                                background: s.light,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: s.color, flexShrink: 0,
                            }}>
                                {s.icon}
                            </div>
                            <div>
                                <div style={{ fontSize: 11.5, color: '#94a3b8', fontWeight: 500, letterSpacing: 0.3 }}>{s.label}</div>
                                <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', letterSpacing: -0.5, lineHeight: 1.2 }}>{s.value}</div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* ═══ Main Card ═══ */}
                {activeTab !== 'friends' && (
                    <section style={{ marginBottom: 24 }} aria-labelledby="customer-action-queue-title">
                        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
                            <div>
                                <h2 id="customer-action-queue-title" style={{ margin: 0, color: '#0f172a', fontSize: 15, fontWeight: 800 }}>
                                    Hàng đợi chăm sóc
                                </h2>
                                <p style={{ margin: '3px 0 0', color: '#94a3b8', fontSize: 11.5 }}>
                                    Chỉ số hành động trên {contacts.length} khách đang hiển thị ở trang này.
                                </p>
                            </div>
                            {trackingFilter !== 'all' && (
                                <button
                                    type="button"
                                    onClick={() => setTrackingFilter('all')}
                                    style={{ border: 0, background: 'transparent', color: '#6366f1', fontSize: 11.5, fontWeight: 750, cursor: 'pointer' }}
                                >
                                    Xóa bộ lọc
                                </button>
                            )}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
                            {([
                                { key: 'high', label: 'Ưu tiên cao', value: pageInsights.high, note: 'Cần phản hồi trước', icon: <Zap size={16} />, color: '#dc2626', bg: '#fef2f2' },
                                { key: 'missingIssue', label: 'Chưa rõ vấn đề', value: pageInsights.missingIssue, note: 'Cần xác định nhu cầu', icon: <Search size={16} />, color: '#d97706', bg: '#fffbeb' },
                                { key: 'missingNextAction', label: 'Thiếu bước tiếp', value: pageInsights.missingNextAction, note: 'Đã có vấn đề, chưa có việc', icon: <Calendar size={16} />, color: '#7c3aed', bg: '#f5f3ff' },
                                { key: 'ready', label: 'Hồ sơ sẵn sàng', value: pageInsights.ready, note: 'Đủ vấn đề, mục tiêu, hành động', icon: <UserCheck size={16} />, color: '#059669', bg: '#ecfdf5' },
                            ] as const).map(item => {
                                const isActive = trackingFilter === item.key;
                                return (
                                    <button
                                        type="button"
                                        key={item.key}
                                        onClick={() => setTrackingFilter(isActive ? 'all' : item.key)}
                                        aria-pressed={isActive}
                                        style={{
                                            display: 'grid', gridTemplateColumns: '36px minmax(0, 1fr) auto', alignItems: 'center', gap: 10,
                                            minHeight: 72, padding: '12px 13px', borderRadius: 13, textAlign: 'left', cursor: 'pointer',
                                            background: isActive ? item.bg : '#fff',
                                            border: `1.5px solid ${isActive ? item.color : '#e8ecf0'}`,
                                            boxShadow: isActive ? `0 8px 20px ${item.color}18` : 'none',
                                        }}
                                    >
                                        <span style={{ width: 36, height: 36, borderRadius: 10, display: 'grid', placeItems: 'center', color: item.color, background: item.bg }}>
                                            {item.icon}
                                        </span>
                                        <span style={{ minWidth: 0 }}>
                                            <span style={{ display: 'block', color: '#334155', fontSize: 12, fontWeight: 800 }}>{item.label}</span>
                                            <span style={{ display: 'block', marginTop: 2, color: '#94a3b8', fontSize: 10.5, lineHeight: 1.3 }}>{item.note}</span>
                                        </span>
                                        <strong style={{ color: item.color, fontSize: 21 }}>{item.value}</strong>
                                    </button>
                                );
                            })}
                        </div>
                    </section>
                )}

                <div style={{
                    background: 'white',
                    borderRadius: 16,
                    border: '1px solid #e8ecf0',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                    overflow: 'hidden',
                }}>
                    {/* ── Toolbar ── */}
                    <div style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        flexWrap: 'wrap', gap: 10,
                        padding: '14px 20px',
                        borderBottom: '1px solid #f1f5f9',
                    }}>
                        {/* Tabs */}
                        <div style={{ display: 'flex', gap: 4, background: '#f8fafc', borderRadius: 10, padding: 3 }}>
                            {tabItems.map(tab => {
                                const isActive = activeTab === tab.key;
                                return (
                                    <button
                                        key={tab.key}
                                        onClick={() => { setActiveTab(tab.key); setPage(1); setSearchText(''); setFriendSearch(''); setTrackingFilter('all'); }}
                                        style={{
                                            padding: '7px 14px', border: 'none', cursor: 'pointer',
                                            borderRadius: 8, fontSize: 12.5, fontWeight: 600,
                                            background: isActive ? 'white' : 'transparent',
                                            color: isActive ? '#0f172a' : '#94a3b8',
                                            boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                                            transition: 'all 0.2s',
                                            display: 'flex', alignItems: 'center', gap: 5,
                                        }}
                                    >
                                        <span style={{ fontSize: 13 }}>{tab.icon}</span>
                                        {tab.label}
                                        {tab.count > 0 && (
                                            <span style={{
                                                fontSize: 10.5, fontWeight: 700,
                                                padding: '1px 6px', borderRadius: 6,
                                                background: isActive ? '#eef2ff' : '#f1f5f9',
                                                color: isActive ? '#6366f1' : '#94a3b8',
                                            }}>{tab.count}</span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Search */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            {activeTab !== 'friends' && (
                                <Select
                                    value={trackingFilter}
                                    onChange={setTrackingFilter}
                                    style={{ width: 178 }}
                                    suffixIcon={<Filter size={14} />}
                                    options={[
                                        { value: 'all', label: 'Tất cả hồ sơ' },
                                        { value: 'high', label: `Ưu tiên cao (${pageInsights.high})` },
                                        { value: 'missingIssue', label: `Chưa rõ vấn đề (${pageInsights.missingIssue})` },
                                        { value: 'missingNextAction', label: `Thiếu bước tiếp (${pageInsights.missingNextAction})` },
                                        { value: 'ready', label: `Hồ sơ sẵn sàng (${pageInsights.ready})` },
                                    ]}
                                />
                            )}
                            <div style={{ position: 'relative' }}>
                            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none', zIndex: 1 }} />
                            <input
                                value={activeTab === 'friends' ? friendSearch : searchText}
                                onChange={e => activeTab === 'friends' ? setFriendSearch(e.target.value) : (() => { setSearchText(e.target.value); setPage(1); })()}
                                placeholder={activeTab === 'friends' ? 'Tìm bạn bè Zalo...' : 'Tìm theo tên, email, SĐT...'}
                                style={{
                                    width: 260, maxWidth: '70vw', height: 38, paddingLeft: 36, paddingRight: 12,
                                    borderRadius: 10, border: '1.5px solid #e2e8f0',
                                    fontSize: 12.5, outline: 'none', transition: 'all 0.2s',
                                    background: '#fafbfc',
                                }}
                                onFocus={e => { e.target.style.borderColor = '#818cf8'; e.target.style.background = 'white'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.08)'; }}
                                onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.background = '#fafbfc'; e.target.style.boxShadow = 'none'; }}
                            />
                            </div>
                        </div>
                    </div>

                    {/* ── Content ── */}
                    {activeTab === 'friends' ? (
                        /* ═══ Friends Grid ═══ */
                        <div style={{ padding: '16px 20px' }}>
                            {friendsLoading ? (
                                <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
                            ) : !friendsConnected ? (
                                <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                                    <div style={{
                                        width: 64, height: 64, borderRadius: 20,
                                        background: 'linear-gradient(135deg, #eef2ff, #f5f3ff)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        margin: '0 auto 16px',
                                    }}>
                                        <Zap size={28} color="#818cf8" />
                                    </div>
                                    <p style={{ fontSize: 15, fontWeight: 600, color: '#334155', margin: '0 0 6px' }}>Chưa kết nối Zalo</p>
                                    <p style={{ fontSize: 13, color: '#94a3b8', margin: '0 0 18px' }}>Vui lòng kết nối tài khoản Zalo trước</p>
                                    <button
                                        onClick={() => router.push(`/workspace/${workspaceId}/settings`)}
                                        style={{
                                            height: 38, padding: '0 20px', borderRadius: 10,
                                            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                            color: 'white', border: 'none', fontSize: 13, fontWeight: 600,
                                            cursor: 'pointer',
                                        }}
                                    >Đi tới Cài đặt</button>
                                </div>
                            ) : friends.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                                    <Users size={32} color="#cbd5e1" style={{ margin: '0 auto 12px', display: 'block' }} />
                                    <p style={{ fontSize: 14, fontWeight: 500, color: '#64748b' }}>
                                        {friendSearch ? 'Không tìm thấy bạn bè phù hợp' : 'Danh sách bạn bè trống'}
                                    </p>
                                </div>
                            ) : (
                                <>
                                    <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 14, fontWeight: 500 }}>
                                        Hiển thị {friends.length} / {friendsTotal} bạn bè
                                    </div>
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                                        gap: 10,
                                    }}>
                                        {friends.map(friend => (
                                            <div
                                                key={friend.threadId}
                                                onClick={() => handleChatWithFriend(friend)}
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: 14,
                                                    padding: '14px 18px', borderRadius: 14,
                                                    border: '1px solid #e8ecf0',
                                                    background: 'white',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                                }}
                                                onMouseEnter={e => {
                                                    (e.currentTarget as HTMLElement).style.borderColor = '#c7d2fe';
                                                    (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
                                                    (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(99,102,241,0.1)';
                                                }}
                                                onMouseLeave={e => {
                                                    (e.currentTarget as HTMLElement).style.borderColor = '#e8ecf0';
                                                    (e.currentTarget as HTMLElement).style.transform = 'none';
                                                    (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                                                }}
                                            >
                                                {friend.avatar ? (
                                                    <img
                                                        src={friend.avatar} alt=""
                                                        style={{ width: 44, height: 44, borderRadius: 14, objectFit: 'cover', flexShrink: 0, border: '2px solid #f1f5f9' }}
                                                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                                    />
                                                ) : (
                                                    <div style={{
                                                        width: 44, height: 44, borderRadius: 14, flexShrink: 0,
                                                        background: `hsl(${(friend.displayName.charCodeAt(0) * 37) % 360}, 55%, 55%)`,
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        color: '#fff', fontWeight: 700, fontSize: 16,
                                                    }}>
                                                        {friend.displayName[0]?.toUpperCase() || '?'}
                                                    </div>
                                                )}
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontWeight: 600, fontSize: 13.5, color: '#0f172a', marginBottom: 2 }}>
                                                        {friend.displayName}
                                                    </div>
                                                    <div style={{ fontSize: 11.5, color: '#94a3b8' }}>
                                                        Zalo · {friend.threadId.slice(-8)}
                                                    </div>
                                                </div>
                                                <Tooltip title="Nhắn tin">
                                                    <div
                                                        onClick={e => { e.stopPropagation(); handleChatWithFriend(friend); }}
                                                        style={{
                                                            width: 36, height: 36, borderRadius: 10,
                                                            background: '#eef2ff',
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            cursor: 'pointer', transition: 'all 0.15s',
                                                        }}
                                                        onMouseEnter={e => { (e.currentTarget as any).style.background = '#6366f1'; (e.currentTarget.querySelector('svg') as any).style.color = 'white'; }}
                                                        onMouseLeave={e => { (e.currentTarget as any).style.background = '#eef2ff'; (e.currentTarget.querySelector('svg') as any).style.color = '#6366f1'; }}
                                                    >
                                                        <Send size={15} color="#6366f1" style={{ transition: 'color 0.15s' }} />
                                                    </div>
                                                </Tooltip>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    ) : (
                        /* ═══ Contacts Table ═══ */
                        <Table
                            dataSource={filteredContacts}
                            columns={columns}
                            rowKey="_id"
                            loading={loading}
                            title={trackingFilter === 'all' ? undefined : () => (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, color: '#64748b', fontSize: 11.5 }}>
                                    <span>Đang hiển thị {filteredContacts.length}/{contacts.length} khách trên trang theo bộ lọc chăm sóc.</span>
                                    <button type="button" onClick={() => setTrackingFilter('all')} style={{ border: 0, background: 'transparent', color: '#6366f1', fontWeight: 750, cursor: 'pointer' }}>Xóa lọc</button>
                                </div>
                            )}
                            pagination={{
                                current: page,
                                pageSize,
                                total,
                                onChange: (p, ps) => { setPage(p); setPageSize(ps || 20); },
                                showSizeChanger: true,
                                pageSizeOptions: ['10', '20', '50', '100'],
                                showTotal: (t) => <span style={{ fontSize: 12, color: '#94a3b8' }}>{t} liên hệ</span>,
                                size: 'small',
                                style: { padding: '0 20px 12px' },
                            }}
                            size="middle"
                            scroll={{ x: 800 }}
                            onRow={(record) => ({
                                onClick: () => { setSelectedContact(record); setDrawerOpen(true); },
                                style: { cursor: 'pointer', transition: 'background 0.15s' },
                                onMouseEnter: (e: any) => { e.currentTarget.style.background = '#fafbfe'; },
                                onMouseLeave: (e: any) => { e.currentTarget.style.background = 'transparent'; },
                            })}
                            locale={{ emptyText: (
                                <div style={{ padding: '50px 20px', textAlign: 'center' }}>
                                    <div style={{
                                        width: 56, height: 56, borderRadius: 16,
                                        background: 'linear-gradient(135deg, #eef2ff, #f5f3ff)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        margin: '0 auto 14px',
                                    }}>
                                        <Users size={24} color="#818cf8" />
                                    </div>
                                    <p style={{ fontSize: 14, fontWeight: 600, color: '#334155', margin: '0 0 4px' }}>Chưa có liên hệ nào</p>
                                    <p style={{ fontSize: 12.5, color: '#94a3b8', margin: 0 }}>Liên hệ sẽ xuất hiện khi có khách nhắn tin</p>
                                </div>
                            ) }}
                        />
                    )}
                </div>
            </div>

            {/* ═══ Contact Detail Drawer ═══ */}
            <Drawer
                title={null}
                placement="right"
                width={440}
                open={drawerOpen}
                onClose={() => { setDrawerOpen(false); setSelectedContact(null); setEditingField(null); }}
                styles={{ body: { padding: 0, background: '#fafbfc' }, header: { display: 'none' } }}
            >
                {selectedContact && (
                    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                        {/* ── Header ── */}
                        <div style={{
                            background: selectedContact.channel === 'zalo'
                                ? 'linear-gradient(135deg, #0068ff, #00c3ff)'
                                : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                            padding: '28px 24px',
                            position: 'relative',
                            overflow: 'hidden',
                        }}>
                            <div style={{ position: 'absolute', right: -20, top: -20, width: 100, height: 100, background: 'rgba(255,255,255,0.06)', borderRadius: '50%' }} />
                            <div style={{ position: 'absolute', right: 40, bottom: -25, width: 60, height: 60, background: 'rgba(255,255,255,0.04)', borderRadius: '50%' }} />

                            <button
                                onClick={() => { setDrawerOpen(false); setSelectedContact(null); }}
                                style={{
                                    position: 'absolute', top: 14, right: 14,
                                    background: 'rgba(255,255,255,0.15)', border: 'none',
                                    borderRadius: 10, padding: 8, cursor: 'pointer', color: 'white',
                                }}
                            >
                                <XIcon size={16} />
                            </button>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                {selectedContact.avatar ? (
                                    <img src={selectedContact.avatar} alt="" style={{
                                        width: 56, height: 56, borderRadius: 16,
                                        border: '3px solid rgba(255,255,255,0.3)', objectFit: 'cover',
                                    }} />
                                ) : (
                                    <div style={{
                                        width: 56, height: 56, borderRadius: 16,
                                        background: 'rgba(255,255,255,0.15)',
                                        backdropFilter: 'blur(10px)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: 'white', fontWeight: 700, fontSize: 22,
                                        border: '2px solid rgba(255,255,255,0.2)',
                                    }}>
                                        {(selectedContact.name || '?')[0]?.toUpperCase()}
                                    </div>
                                )}
                                <div>
                                    <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'white', letterSpacing: -0.3 }}>
                                        {selectedContact.name}
                                    </h2>
                                    <div style={{
                                        display: 'inline-flex', alignItems: 'center', gap: 4,
                                        marginTop: 6, fontSize: 11.5, fontWeight: 600,
                                        padding: '3px 10px', borderRadius: 6,
                                        background: 'rgba(255,255,255,0.2)',
                                        color: 'white',
                                    }}>
                                        {selectedContact.channel === 'zalo' ? '💬 Zalo' : '🌐 Widget'}
                                        {selectedContact.source ? ` · ${selectedContact.source}` : ''}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ── Stats Row ── */}
                        <div style={{ padding: '16px 24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, borderBottom: '1px solid #f1f5f9', background: 'white' }}>
                            <div style={{ background: '#f8fafc', borderRadius: 12, padding: '14px 16px', textAlign: 'center' }}>
                                <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a' }}>
                                    {selectedContact.totalConversations ?? selectedContact.totalMessages ?? 0}
                                </div>
                                <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500 }}>
                                    {selectedContact.channel === 'zalo' ? 'Tin nhắn' : 'Hội thoại'}
                                </div>
                            </div>
                            <div style={{ background: '#f8fafc', borderRadius: 12, padding: '14px 16px', textAlign: 'center' }}>
                                <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>{timeAgo(selectedContact.lastSeen)}</div>
                                <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500 }}>Hoạt động cuối</div>
                            </div>
                        </div>

                        {/* ── Contact Info ── */}
                        <div style={{ padding: '18px 24px', background: 'white', borderBottom: '1px solid #f1f5f9' }}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 16 }}>
                                Thông tin liên hệ
                            </div>
                            {[
                                { key: 'name', label: 'Tên', icon: <UserCheck size={15} color="#6366f1" />, iconBg: '#eef2ff', value: selectedContact.name },
                                { key: 'email', label: 'Email', icon: <Mail size={15} color="#0ea5e9" />, iconBg: '#f0f9ff', value: selectedContact.email },
                                { key: 'phone', label: 'Số điện thoại', icon: <Phone size={15} color="#10b981" />, iconBg: '#ecfdf5', value: selectedContact.phone },
                            ].map(field => (
                                <div key={field.key} style={{
                                    display: 'flex', alignItems: 'center', gap: 12,
                                    padding: '10px 0',
                                    borderBottom: '1px solid #f8fafc',
                                }}>
                                    <div style={{
                                        width: 34, height: 34, borderRadius: 10,
                                        background: field.iconBg,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        flexShrink: 0,
                                    }}>
                                        {field.icon}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: 10.5, color: '#94a3b8', fontWeight: 500 }}>{field.label}</div>
                                        {editingField === field.key ? (
                                            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4 }}>
                                                <input
                                                    value={editValue}
                                                    onChange={e => setEditValue(e.target.value)}
                                                    autoFocus
                                                    onKeyDown={e => { if (e.key === 'Enter') handleUpdateContact(selectedContact, field.key, editValue); }}
                                                    style={{
                                                        flex: 1, height: 32, padding: '0 10px',
                                                        borderRadius: 8, border: '1.5px solid #818cf8',
                                                        fontSize: 12.5, outline: 'none',
                                                    }}
                                                />
                                                <button onClick={() => handleUpdateContact(selectedContact, field.key, editValue)} style={{
                                                    height: 32, padding: '0 12px', borderRadius: 8,
                                                    background: '#6366f1', color: 'white', border: 'none',
                                                    fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
                                                }}>Lưu</button>
                                                <button onClick={() => setEditingField(null)} style={{
                                                    height: 32, padding: '0 10px', borderRadius: 8,
                                                    background: '#f1f5f9', color: '#64748b', border: 'none',
                                                    fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
                                                }}>Huỷ</button>
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                                                <span style={{
                                                    fontSize: 13.5, fontWeight: field.value ? 600 : 400,
                                                    color: field.value ? '#0f172a' : '#cbd5e1',
                                                }}>
                                                    {field.value || 'Chưa có'}
                                                </span>
                                                <Edit2
                                                    size={12} color="#cbd5e1"
                                                    style={{ cursor: 'pointer', transition: 'color 0.15s' }}
                                                    onClick={(e: any) => { e.stopPropagation(); setEditingField(field.key); setEditValue(field.value || ''); }}
                                                    onMouseEnter={(e: any) => { e.target.style.color = '#6366f1'; }}
                                                    onMouseLeave={(e: any) => { e.target.style.color = '#cbd5e1'; }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* ── Customer Success tracking ── */}
                        <div style={{ padding: '18px 24px', background: '#fff', borderBottom: '1px solid #f1f5f9' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
                                <div>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: '#6366f1', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                        Theo dõi CSKH
                                    </div>
                                    <div style={{ marginTop: 3, fontSize: 12, color: '#94a3b8' }}>
                                        Hồ sơ riêng để đội ngũ nắm đúng việc cần giải quyết.
                                    </div>
                                </div>
                                <div style={{ width: 34, height: 34, borderRadius: 10, background: '#eef2ff', color: '#6366f1', display: 'grid', placeItems: 'center' }}>
                                    <TrendingUp size={16} />
                                </div>
                            </div>
                            <div style={{ display: 'grid', gap: 9 }}>
                                {[
                                    { key: 'primaryIssue', label: 'Vấn đề tiên quyết', placeholder: 'Ví dụ: cần chốt cấu hình VPS' },
                                    { key: 'customerGoal', label: 'Mục tiêu khách hàng', placeholder: 'Kết quả khách đang muốn đạt được' },
                                    { key: 'nextAction', label: 'Bước tiếp theo', placeholder: 'Việc đội ngũ cần làm tiếp' },
                                    { key: 'issuePriority', label: 'Mức ưu tiên', placeholder: 'Cao / Trung bình / Thấp' },
                                ].map((field) => {
                                    const tracking = selectedContact.channel === 'zalo'
                                        ? (selectedContact.metadata || {})
                                        : (selectedContact.attributes || {});
                                    const fieldValue = String(tracking[field.key] || '');
                                    const isEditingTracking = editingField === field.key;
                                    return (
                                        <div key={field.key} style={{ border: '1px solid #eef2f7', borderRadius: 12, padding: '10px 12px', background: '#fafbff' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                                                <span style={{ fontSize: 10.5, color: '#64748b', fontWeight: 700 }}>{field.label}</span>
                                                {!isEditingTracking && (
                                                    <button
                                                        type="button"
                                                        onClick={() => { setEditingField(field.key); setEditValue(fieldValue); }}
                                                        style={{ border: 0, background: 'transparent', color: '#94a3b8', cursor: 'pointer', display: 'grid', placeItems: 'center', padding: 2 }}
                                                        aria-label={`Chỉnh sửa ${field.label}`}
                                                    >
                                                        <Edit2 size={12} />
                                                    </button>
                                                )}
                                            </div>
                                            {isEditingTracking ? (
                                                <div style={{ display: 'flex', gap: 6, marginTop: 7 }}>
                                                    {field.key === 'issuePriority' ? (
                                                        <Select
                                                            value={normalizeIssuePriority(editValue) || undefined}
                                                            onChange={setEditValue}
                                                            autoFocus
                                                            placeholder="Chọn mức ưu tiên"
                                                            style={{ flex: 1, minWidth: 0 }}
                                                            options={[
                                                                { value: 'high', label: 'Cao · cần xử lý trước' },
                                                                { value: 'medium', label: 'Trung bình' },
                                                                { value: 'low', label: 'Thấp' },
                                                            ]}
                                                        />
                                                    ) : (
                                                        <input
                                                            value={editValue}
                                                            onChange={(event) => setEditValue(event.target.value)}
                                                            onKeyDown={(event) => { if (event.key === 'Enter') handleUpdateContact(selectedContact, field.key, editValue); }}
                                                            autoFocus
                                                            placeholder={field.placeholder}
                                                            style={{ flex: 1, minWidth: 0, height: 34, borderRadius: 8, border: '1.5px solid #a5b4fc', padding: '0 10px', outline: 'none', fontSize: 12 }}
                                                        />
                                                    )}
                                                    <button type="button" onClick={() => handleUpdateContact(selectedContact, field.key, editValue)} style={{ border: 0, borderRadius: 8, background: '#6366f1', color: '#fff', padding: '0 10px', fontWeight: 700, cursor: 'pointer' }}>Lưu</button>
                                                    <button type="button" onClick={() => setEditingField(null)} style={{ border: 0, borderRadius: 8, background: '#eef2f7', color: '#64748b', padding: '0 9px', cursor: 'pointer' }}>Huỷ</button>
                                                </div>
                                            ) : (
                                                <div style={{ marginTop: 4, color: fieldValue ? '#0f172a' : '#94a3b8', fontSize: 12.5, lineHeight: 1.45, fontWeight: fieldValue ? 600 : 400 }}>
                                                    {field.key === 'issuePriority' ? issuePriorityLabel(fieldValue) : (fieldValue || field.placeholder)}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* ── Timeline ── */}
                        <div style={{ padding: '18px 24px', flex: 1, overflowY: 'auto' }}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 16 }}>
                                Lịch sử
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                {[
                                    { label: 'Lần đầu liên hệ', date: selectedContact.firstSeen, color: '#10b981', bg: '#ecfdf5' },
                                    { label: 'Hoạt động cuối', date: selectedContact.lastSeen, color: '#6366f1', bg: '#eef2ff' },
                                ].map((item, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                        <div style={{
                                            width: 10, height: 10, borderRadius: '50%',
                                            background: item.color,
                                            boxShadow: `0 0 6px ${item.color}30`,
                                            flexShrink: 0,
                                        }} />
                                        <div>
                                            <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500 }}>{item.label}</div>
                                            <div style={{ fontSize: 13, color: '#0f172a', fontWeight: 600 }}>
                                                {item.date ? new Date(item.date).toLocaleString('vi-VN') : '—'}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Last message */}
                            {selectedContact.lastMessagePreview && (
                                <div style={{ marginTop: 20 }}>
                                    <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
                                        Tin nhắn gần nhất
                                    </div>
                                    <div style={{
                                        background: 'white', borderRadius: 12, padding: '14px 16px',
                                        border: '1px solid #e8ecf0',
                                        borderLeft: '3px solid #6366f1',
                                        fontSize: 13, color: '#334155', lineHeight: 1.5,
                                    }}>
                                        {selectedContact.lastMessagePreview}
                                    </div>
                                </div>
                            )}

                            {/* ID Info */}
                            <div style={{
                                marginTop: 24, padding: '14px 16px',
                                background: 'white', borderRadius: 12,
                                border: '1px solid #e8ecf0',
                                fontSize: 11.5, color: '#94a3b8',
                                display: 'flex', flexDirection: 'column', gap: 6,
                            }}>
                                {selectedContact.visitorId && <div>Visitor ID: <code style={{ color: '#64748b', background: '#f1f5f9', padding: '1px 6px', borderRadius: 4, fontSize: 11 }}>{selectedContact.visitorId}</code></div>}
                                {selectedContact.zaloUserId && <div>Zalo ID: <code style={{ color: '#64748b', background: '#f1f5f9', padding: '1px 6px', borderRadius: 4, fontSize: 11 }}>{selectedContact.zaloUserId}</code></div>}
                                <div>DB ID: <code style={{ color: '#64748b', background: '#f1f5f9', padding: '1px 6px', borderRadius: 4, fontSize: 11 }}>{selectedContact._id}</code></div>
                            </div>
                        </div>
                    </div>
                )}
            </Drawer>
        </AppLayout>
    );
}
