import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Head from 'next/head';
import { Spin, Card, Switch, TimePicker, message, Button, Tag } from 'antd';
import { Clock } from 'lucide-react';
import AppLayout from '../../../components/layout/AppLayout';
import { httpClient } from '../../../lib/http/client';

const DAYS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];

export default function BusinessHoursPage() {
    const router = useRouter();
    const { workspaceId } = router.query;
    const [ready, setReady] = useState(false);
    const [config, setConfig] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => { setReady(true); if (!localStorage.getItem('nemark_token')) router.replace('/auth/login'); }, [router]);

    useEffect(() => {
        if (!workspaceId) return;
        setLoading(true);
        httpClient.get(`/business-hours?workspaceId=${workspaceId}`).then(r => setConfig(r.data?.data || null)).catch(() => {}).finally(() => setLoading(false));
    }, [workspaceId]);

    if (!ready || !workspaceId) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spin size="large" /></div>;

    return (
        <AppLayout headerTitle={<><Clock size={22} style={{ marginRight: 8 }} /> Giờ làm việc</>}>
            <Head><title>Giờ làm việc | NemarkChat</title></Head>
            <main style={{ padding: 24, maxWidth: 800 }}>
                <Card loading={loading}>
                    <div style={{ marginBottom: 24 }}>
                        <h3 style={{ margin: 0 }}>Cài đặt giờ làm việc</h3>
                        <p style={{ color: '#666', marginTop: 4 }}>Thiết lập thời gian hoạt động để hệ thống tự động hiển thị trạng thái online/offline cho khách.</p>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {DAYS.map((day, idx) => (
                            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 16px', background: '#fafafa', borderRadius: 8, border: '1px solid #f0f0f0' }}>
                                <span style={{ width: 80, fontWeight: 600 }}>{day}</span>
                                <Switch defaultChecked={idx < 6} size="small" />
                                <Tag color="blue">08:00 - 22:00</Tag>
                            </div>
                        ))}
                    </div>
                    <div style={{ marginTop: 24 }}>
                        <Button type="primary" onClick={() => message.info('Tính năng đang phát triển')}>Lưu cài đặt</Button>
                    </div>
                </Card>
            </main>
        </AppLayout>
    );
}
