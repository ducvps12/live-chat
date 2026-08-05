import Head from 'next/head';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Spin, message } from 'antd';
import { ArrowLeft, BanknoteIcon, CheckCircle, Clock, Copy, Loader2, QrCode, Receipt, RefreshCw, ShieldCheck } from 'lucide-react';
import AppLayout from '../../../../components/layout/AppLayout';
import { httpClient } from '../../../../lib/http/client';

interface PaymentInfo {
    bankId?: string;
    bankName: string;
    accountNumber: string;
    accountName: string;
    amount: number;
    transferContent: string;
    invoiceNumber: string;
    currency: string;
}

function formatVND(amount: number) {
    return `${amount.toLocaleString('vi-VN')}đ`;
}

function generateVietQRUrl(bankId: string, accountNumber: string, amount: number, content: string, accountName: string): string {
    return `https://img.vietqr.io/image/${bankId}-${accountNumber}-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(content)}&accountName=${encodeURIComponent(accountName)}`;
}

export default function InvoicePaymentPage() {
    const router = useRouter();
    const { workspaceId, invoiceId } = router.query;
    const wsId = Array.isArray(workspaceId) ? workspaceId[0] : workspaceId;
    const invId = Array.isArray(invoiceId) ? invoiceId[0] : invoiceId;

    const [ready, setReady] = useState(false);
    const [loading, setLoading] = useState(true);
    const [checking, setChecking] = useState(false);
    const [paid, setPaid] = useState(false);
    const [copied, setCopied] = useState('');
    const [paymentInfo, setPaymentInfo] = useState<PaymentInfo | null>(null);
    const pollingRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        const token = localStorage.getItem('nemark_token');
        setReady(true);
        if (!token) router.replace('/auth/login');
    }, [router]);

    const loadPaymentInfo = useCallback(async () => {
        if (!wsId || !invId) return;
        setLoading(true);
        try {
            const res = await httpClient.get(`/workspaces/${wsId}/subscription/invoices/${invId}/payment-info`);
            setPaymentInfo(res.data?.data || null);
        } catch (error: unknown) {
            const err = error as { response?: { data?: { error?: string } } };
            message.error(err.response?.data?.error || 'Không thể tải thông tin thanh toán');
        } finally {
            setLoading(false);
        }
    }, [wsId, invId]);

    const checkPayment = useCallback(async () => {
        if (!wsId || !invId) return false;
        try {
            const res = await httpClient.get(`/workspaces/${wsId}/subscription/invoices/${invId}/check-payment`);
            if (res.data?.data?.found) {
                setPaid(true);
                setChecking(false);
                if (pollingRef.current) clearInterval(pollingRef.current);
                message.success('Thanh toán đã được xác nhận. Gói đã kích hoạt.');
                return true;
            }
        } catch (error) {
            console.error('Payment check error:', error);
        }
        return false;
    }, [wsId, invId]);

    const startPolling = useCallback(() => {
        if (pollingRef.current) clearInterval(pollingRef.current);
        setChecking(true);
        let elapsed = 0;
        const intervalMs = 5000;
        const maxMs = 15 * 60 * 1000;
        pollingRef.current = setInterval(async () => {
            elapsed += intervalMs;
            if (elapsed >= maxMs) {
                if (pollingRef.current) clearInterval(pollingRef.current);
                setChecking(false);
                return;
            }
            await checkPayment();
        }, intervalMs);
    }, [checkPayment]);

    useEffect(() => {
        if (!ready || !wsId || !invId) return;
        loadPaymentInfo();
    }, [ready, wsId, invId, loadPaymentInfo]);

    useEffect(() => {
        if (!paymentInfo || paid) return;
        startPolling();
        return () => {
            if (pollingRef.current) clearInterval(pollingRef.current);
        };
    }, [paymentInfo, paid, startPolling]);

    const copyValue = async (value: string, key: string) => {
        await navigator.clipboard.writeText(value);
        setCopied(key);
        setTimeout(() => setCopied(''), 1800);
    };

    if (!ready || !wsId || !invId) {
        return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}><Spin size="large" /></div>;
    }

    const qrUrl = paymentInfo
        ? generateVietQRUrl(paymentInfo.bankId || 'ACB', paymentInfo.accountNumber, paymentInfo.amount, paymentInfo.transferContent, paymentInfo.accountName)
        : '';

    return (
        <AppLayout headerTitle="Thanh toán hóa đơn">
            <Head><title>Thanh toán hóa đơn | NemarkChat</title></Head>
            <style>{`
                .payment-page { max-width: 1120px; margin: 0 auto; padding: 32px 24px 64px; }
                .payment-hero { display: flex; justify-content: space-between; gap: 18px; align-items: flex-start; margin-bottom: 22px; }
                .payment-title { margin: 0; color: #0f172a; font-size: 28px; font-weight: 900; letter-spacing: 0; }
                .payment-subtitle { margin: 8px 0 0; color: #64748b; font-size: 14px; line-height: 1.6; }
                .back-btn { height: 38px; border-radius: 12px; border: 1px solid #e2e8f0; background: #fff; color: #334155; padding: 0 14px; font-weight: 800; display: inline-flex; align-items: center; gap: 8px; cursor: pointer; }
                .payment-shell { display: grid; grid-template-columns: minmax(320px, .9fr) minmax(0, 1.1fr); gap: 18px; align-items: start; }
                .payment-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 24px; box-shadow: 0 18px 45px rgba(15,23,42,.07); overflow: hidden; }
                .qr-panel { padding: 28px; text-align: center; }
                .qr-box { display: inline-flex; flex-direction: column; align-items: center; gap: 10px; border: 1px solid #dbeafe; border-radius: 22px; padding: 18px; background: #f8fafc; }
                .qr-box img { width: min(280px, 70vw); height: min(280px, 70vw); object-fit: contain; border-radius: 16px; background: #fff; }
                .status-card { margin-top: 18px; border-radius: 18px; padding: 16px; display: flex; align-items: center; justify-content: center; gap: 10px; font-weight: 850; }
                .status-waiting { background: #fffbeb; color: #92400e; border: 1px solid #fde68a; }
                .status-paid { background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; }
                .detail-header { padding: 22px 24px; background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: #fff; }
                .detail-header h2 { margin: 0; font-size: 18px; font-weight: 900; }
                .detail-header p { margin: 6px 0 0; color: rgba(255,255,255,.76); font-size: 13px; }
                .detail-body { padding: 22px 24px 24px; display: grid; gap: 12px; }
                .pay-row { border: 1px solid #e2e8f0; background: #f8fafc; border-radius: 16px; padding: 15px; display: flex; align-items: center; justify-content: space-between; gap: 14px; }
                .pay-label { color: #64748b; font-size: 11px; font-weight: 900; text-transform: uppercase; margin-bottom: 4px; }
                .pay-value { color: #0f172a; font-size: 15px; font-weight: 850; word-break: break-word; }
                .pay-value.mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
                .copy-btn { border: 1px solid #c7d2fe; background: #fff; color: #4f46e5; border-radius: 12px; height: 34px; padding: 0 12px; font-size: 12px; font-weight: 850; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; white-space: nowrap; }
                .copy-btn.done { border-color: #86efac; color: #059669; }
                .payment-note { border: 1px solid #fed7aa; background: #fff7ed; color: #9a3412; border-radius: 16px; padding: 14px; font-size: 13px; line-height: 1.55; }
                .payment-actions { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 4px; }
                .primary-btn { border: none; background: #4f46e5; color: #fff; border-radius: 13px; height: 40px; padding: 0 16px; font-weight: 850; display: inline-flex; align-items: center; gap: 8px; cursor: pointer; }
                .secondary-btn { border: 1px solid #e2e8f0; background: #fff; color: #334155; border-radius: 13px; height: 40px; padding: 0 16px; font-weight: 850; display: inline-flex; align-items: center; gap: 8px; cursor: pointer; }
                @keyframes payment-spin { to { transform: rotate(360deg); } }
                .spin-icon { animation: payment-spin 1.2s linear infinite; }
                @media (max-width: 880px) { .payment-page { padding: 20px 14px 44px; } .payment-shell { grid-template-columns: 1fr; } .payment-hero { flex-direction: column; } }
            `}</style>

            <main className="payment-page">
                <div className="payment-hero">
                    <div>
                        <h1 className="payment-title">Thanh toán chuyển khoản</h1>
                        <p className="payment-subtitle">Quét VietQR hoặc chuyển khoản thủ công. Hệ thống sẽ tự kiểm tra giao dịch và kích hoạt gói khi nội dung khớp hóa đơn.</p>
                    </div>
                    <button className="back-btn" onClick={() => router.push(`/workspace/${wsId}/billing`)}>
                        <ArrowLeft size={16} /> Quay lại billing
                    </button>
                </div>

                {loading ? (
                    <div className="payment-card" style={{ padding: 80, textAlign: 'center' }}><Spin size="large" /></div>
                ) : paymentInfo ? (
                    <div className="payment-shell">
                        <section className="payment-card qr-panel">
                            <div className="qr-box">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={qrUrl} alt="QR thanh toán" />
                                <span style={{ color: '#64748b', fontSize: 12, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                    <QrCode size={14} /> VietQR tự điền số tiền và nội dung
                                </span>
                            </div>
                            <div className={`status-card ${paid ? 'status-paid' : 'status-waiting'}`}>
                                {paid ? <CheckCircle size={18} /> : checking ? <Loader2 size={18} className="spin-icon" /> : <Clock size={18} />}
                                {paid ? 'Đã xác nhận thanh toán' : checking ? 'Đang chờ Auto Bank xác nhận...' : 'Chờ kiểm tra lại giao dịch'}
                            </div>
                        </section>

                        <section className="payment-card">
                            <div className="detail-header">
                                <h2><BanknoteIcon size={18} style={{ verticalAlign: 'middle', marginRight: 8 }} /> Thông tin chuyển khoản</h2>
                                <p>Hóa đơn {paymentInfo.invoiceNumber}</p>
                            </div>
                            <div className="detail-body">
                                <PaymentRow label="Ngân hàng" value={paymentInfo.bankName} />
                                <PaymentRow label="Số tài khoản" value={paymentInfo.accountNumber} copyKey="account" copied={copied} onCopy={copyValue} />
                                <PaymentRow label="Chủ tài khoản" value={paymentInfo.accountName} />
                                <PaymentRow label="Số tiền" value={formatVND(paymentInfo.amount)} copyValue={String(paymentInfo.amount)} copyKey="amount" copied={copied} onCopy={copyValue} danger />
                                <PaymentRow label="Nội dung chuyển khoản" value={paymentInfo.transferContent} copyKey="content" copied={copied} onCopy={copyValue} highlight />

                                <div className="payment-note">
                                    <strong>Quan trọng:</strong> Nội dung chuyển khoản phải đúng chính xác để Auto Bank khớp hóa đơn. Nếu chuyển sai nội dung, admin cần xác nhận thủ công.
                                </div>

                                <div className="payment-actions">
                                    <button className="primary-btn" onClick={() => checkPayment()}>
                                        <RefreshCw size={15} /> Kiểm tra ngay
                                    </button>
                                    <button className="secondary-btn" onClick={() => router.push(`/workspace/${wsId}/billing`)}>
                                        <Receipt size={15} /> Xem hóa đơn
                                    </button>
                                    <button className="secondary-btn" onClick={() => router.push(`/workspace/${wsId}/chatbot`)}>
                                        <ShieldCheck size={15} /> Xem gói AI
                                    </button>
                                </div>
                            </div>
                        </section>
                    </div>
                ) : (
                    <div className="payment-card" style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Không tìm thấy thông tin thanh toán.</div>
                )}
            </main>
        </AppLayout>
    );
}

function PaymentRow({
    label,
    value,
    copyValue,
    copyKey,
    copied,
    onCopy,
    danger,
    highlight,
}: {
    label: string;
    value: string;
    copyValue?: string;
    copyKey?: string;
    copied?: string;
    onCopy?: (value: string, key: string) => void;
    danger?: boolean;
    highlight?: boolean;
}) {
    return (
        <div className="pay-row" style={highlight ? { background: '#fffbeb', borderColor: '#fde68a' } : undefined}>
            <div>
                <div className="pay-label">{label}</div>
                <div className="pay-value mono" style={danger ? { color: '#dc2626', fontSize: 17 } : undefined}>{value}</div>
            </div>
            {copyKey && onCopy && (
                <button className={`copy-btn ${copied === copyKey ? 'done' : ''}`} onClick={() => onCopy(copyValue || value, copyKey)}>
                    {copied === copyKey ? <CheckCircle size={13} /> : <Copy size={13} />}
                    {copied === copyKey ? 'Đã copy' : 'Copy'}
                </button>
            )}
        </div>
    );
}
