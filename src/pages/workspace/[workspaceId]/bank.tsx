import { useRouter } from 'next/router';
import { useEffect, useState, useCallback } from 'react';
import Head from 'next/head';
import { Spin, Card, Table, Tag, Statistic, Badge, Button, Input, Tooltip, message } from 'antd';
import { ReloadOutlined, SearchOutlined, CopyOutlined } from '@ant-design/icons';
import { Landmark, ArrowDownLeft, ArrowUpRight, Wallet, TrendingUp, RefreshCw } from 'lucide-react';
import AppLayout from '../../../components/layout/AppLayout';
import { httpClient } from '../../../lib/http/client';

interface Transaction {
    id: string;
    refNo: string;
    tranId: string;
    postingDate: string;
    transactionDate: string;
    accountNo: string;
    creditAmount: number;
    debitAmount: number;
    currency: string;
    description: string;
    addDescription: string;
    availableBalance: number;
    transactionType: string;
    type: 'credit' | 'debit';
}

interface BankData {
    account: { number: string; holder: string; bank: string };
    balance: number;
    totalCredit: number;
    totalDebit: number;
    transactionCount: number;
    transactions: Transaction[];
}

const formatVND = (n: number) => new Intl.NumberFormat('vi-VN').format(n) + ' ₫';

const formatDate = (d: string) => {
    if (!d) return '';
    // Parse DD/MM/YYYY HH:mm:ss
    const parts = d.split(' ');
    const dateParts = parts[0]?.split('/');
    if (dateParts?.length === 3) {
        return `${dateParts[0]}/${dateParts[1]}/${dateParts[2]} ${parts[1] || ''}`.trim();
    }
    return d;
};

export default function BankPage() {
    const router = useRouter();
    const { workspaceId } = router.query;
    const [ready, setReady] = useState(false);
    const [bankData, setBankData] = useState<BankData | null>(null);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [autoRefresh, setAutoRefresh] = useState(false);

    useEffect(() => {
        setReady(true);
        if (!localStorage.getItem('nemark_token')) router.replace('/auth/login');
    }, [router]);

    const fetchBank = useCallback(async () => {
        setLoading(true);
        try {
            const res = await httpClient.get('/bank/transactions');
            if (res.data?.success) {
                setBankData(res.data.data);
            }
        } catch (e: any) {
            message.error('Không thể tải dữ liệu ngân hàng');
        }
        setLoading(false);
    }, []);

    useEffect(() => { if (ready) fetchBank(); }, [ready, fetchBank]);

    // Auto refresh every 15 seconds
    useEffect(() => {
        if (!autoRefresh) return;
        const interval = setInterval(fetchBank, 15000);
        return () => clearInterval(interval);
    }, [autoRefresh, fetchBank]);

    const filtered = bankData?.transactions?.filter(tx =>
        tx.description?.toLowerCase().includes(search.toLowerCase()) ||
        tx.addDescription?.toLowerCase().includes(search.toLowerCase()) ||
        tx.refNo?.toLowerCase().includes(search.toLowerCase()) ||
        String(tx.creditAmount).includes(search) ||
        String(tx.debitAmount).includes(search)
    ) || [];

    const columns = [
        {
            title: '', dataIndex: 'type', key: 'type', width: 40,
            render: (t: string) => t === 'credit'
                ? <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #10b981, #059669)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ArrowDownLeft size={16} color="#fff" /></div>
                : <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #ef4444, #dc2626)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ArrowUpRight size={16} color="#fff" /></div>
        },
        {
            title: 'Nội dung', dataIndex: 'description', key: 'description',
            render: (desc: string, record: Transaction) => (
                <div>
                    <div style={{ fontWeight: 500, fontSize: 13, lineHeight: 1.4, maxWidth: 500, wordBreak: 'break-word' as const }}>{desc}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                        Mã GD: {record.refNo}
                    </div>
                </div>
            )
        },
        {
            title: 'Thời gian', dataIndex: 'transactionDate', key: 'transactionDate', width: 160,
            render: (d: string) => <span style={{ fontSize: 12, color: '#64748b' }}>{formatDate(d)}</span>
        },
        {
            title: 'Số tiền', key: 'amount', width: 150, align: 'right' as const,
            render: (_: any, record: Transaction) => {
                if (record.creditAmount > 0) {
                    return <span style={{ color: '#10b981', fontWeight: 700, fontSize: 14 }}>+{formatVND(record.creditAmount)}</span>;
                }
                return <span style={{ color: '#ef4444', fontWeight: 700, fontSize: 14 }}>-{formatVND(record.debitAmount)}</span>;
            }
        },
        {
            title: 'Số dư', dataIndex: 'availableBalance', key: 'availableBalance', width: 140, align: 'right' as const,
            render: (b: number) => <span style={{ fontSize: 13, color: '#64748b' }}>{formatVND(b)}</span>
        },
    ];

    if (!ready || !workspaceId) {
        return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spin size="large" /></div>;
    }

    return (
        <AppLayout headerTitle={<><Landmark size={22} style={{ marginRight: 8 }} /> Auto Bank</>}>
            <Head><title>Auto Bank | NemarkChat</title></Head>
            <main style={{ padding: 24 }}>
                <style>{`
                    .bank-stats .ant-statistic-title { color: #94a3b8; font-size: 12px; font-weight: 500; }
                    .bank-stats .ant-statistic-content { font-size: 20px; }
                    .bank-card { border-radius: 16px; overflow: hidden; }
                    .bank-account-card {
                        background: linear-gradient(135deg, #1e3a5f 0%, #0c4a6e 40%, #0369a1 100%);
                        border-radius: 16px;
                        padding: 28px;
                        color: #fff;
                        position: relative;
                        overflow: hidden;
                        min-height: 180px;
                    }
                    .bank-account-card::before {
                        content: '';
                        position: absolute;
                        top: -40px;
                        right: -40px;
                        width: 200px;
                        height: 200px;
                        background: rgba(255,255,255,0.04);
                        border-radius: 50%;
                    }
                    .bank-account-card::after {
                        content: '';
                        position: absolute;
                        bottom: -60px;
                        left: -20px;
                        width: 180px;
                        height: 180px;
                        background: rgba(255,255,255,0.03);
                        border-radius: 50%;
                    }
                    .pulse-dot {
                        width: 8px;
                        height: 8px;
                        border-radius: 50%;
                        background: #10b981;
                        display: inline-block;
                        margin-right: 6px;
                        animation: pulse 2s infinite;
                    }
                    @keyframes pulse {
                        0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); }
                        70% { box-shadow: 0 0 0 8px rgba(16, 185, 129, 0); }
                        100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
                    }
                `}</style>

                {/* Account Card + Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16, marginBottom: 24 }}>
                    <div className="bank-account-card" style={{ gridColumn: 'span 2' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, position: 'relative', zIndex: 1 }}>
                            <div>
                                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.5, opacity: 0.6, marginBottom: 4 }}>MB BANK</div>
                                <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: 2 }}>
                                    {bankData?.account?.number || '•••••••••'}
                                </div>
                            </div>
                            <img src="https://upload.wikimedia.org/wikipedia/commons/2/25/Logo_MB_new.png" alt="MB" style={{ height: 36, filter: 'brightness(10)', opacity: 0.8 }} />
                        </div>
                        <div style={{ position: 'relative', zIndex: 1 }}>
                            <div style={{ fontSize: 12, opacity: 0.5, marginBottom: 2 }}>Chủ tài khoản</div>
                            <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: 0.5 }}>
                                {bankData?.account?.holder || 'Đang tải...'}
                                <Tooltip title="Copy STK">
                                    <CopyOutlined
                                        style={{ marginLeft: 12, cursor: 'pointer', opacity: 0.5, fontSize: 14 }}
                                        onClick={() => { navigator.clipboard.writeText(bankData?.account?.number || ''); message.success('Đã copy STK'); }}
                                    />
                                </Tooltip>
                            </div>
                        </div>
                        <div style={{ position: 'relative', zIndex: 1, marginTop: 20 }}>
                            <div style={{ fontSize: 12, opacity: 0.5, marginBottom: 2 }}>Số dư khả dụng</div>
                            <div style={{ fontSize: 28, fontWeight: 800 }}>
                                {bankData ? formatVND(bankData.balance) : '---'}
                            </div>
                        </div>
                    </div>

                    <Card className="bank-card bank-stats" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <Statistic
                            title={<><ArrowDownLeft size={14} style={{ color: '#10b981', marginRight: 4 }} /> Tổng tiền vào</>}
                            value={bankData?.totalCredit || 0}
                            suffix="₫"
                            valueStyle={{ color: '#10b981', fontWeight: 700 }}
                            formatter={(v) => new Intl.NumberFormat('vi-VN').format(v as number)}
                        />
                        <div style={{ marginTop: 8, fontSize: 12, color: '#94a3b8' }}>
                            {bankData?.transactions?.filter(t => t.type === 'credit').length || 0} giao dịch
                        </div>
                    </Card>

                    <Card className="bank-card bank-stats" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <Statistic
                            title={<><ArrowUpRight size={14} style={{ color: '#ef4444', marginRight: 4 }} /> Tổng tiền ra</>}
                            value={bankData?.totalDebit || 0}
                            suffix="₫"
                            valueStyle={{ color: '#ef4444', fontWeight: 700 }}
                            formatter={(v) => new Intl.NumberFormat('vi-VN').format(v as number)}
                        />
                        <div style={{ marginTop: 8, fontSize: 12, color: '#94a3b8' }}>
                            {bankData?.transactions?.filter(t => t.type === 'debit').length || 0} giao dịch
                        </div>
                    </Card>
                </div>

                {/* Transaction Table */}
                <Card className="bank-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <Input
                                prefix={<SearchOutlined />}
                                placeholder="Tìm giao dịch..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                style={{ width: 300 }}
                                allowClear
                            />
                            <Tag color={filtered.length > 0 ? 'blue' : 'default'}>{filtered.length} giao dịch</Tag>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Button
                                onClick={() => setAutoRefresh(!autoRefresh)}
                                type={autoRefresh ? 'primary' : 'default'}
                                icon={<span className={autoRefresh ? 'pulse-dot' : ''} style={!autoRefresh ? { display: 'none' } : {}} />}
                                style={autoRefresh ? { background: '#10b981', borderColor: '#10b981' } : {}}
                            >
                                {autoRefresh ? 'Auto (15s)' : 'Auto Refresh'}
                            </Button>
                            <Button icon={<ReloadOutlined spin={loading} />} onClick={fetchBank} loading={loading}>
                                Làm mới
                            </Button>
                        </div>
                    </div>
                    <Table
                        dataSource={filtered}
                        columns={columns}
                        rowKey="id"
                        loading={loading}
                        size="small"
                        pagination={{ pageSize: 20, showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100'] }}
                        rowClassName={(record) => record.type === 'credit' ? 'bank-row-credit' : 'bank-row-debit'}
                    />
                </Card>
            </main>
        </AppLayout>
    );
}
