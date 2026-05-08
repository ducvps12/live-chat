/**
 * Slug-based routing: /w/:slug → /workspace/:workspaceId/
 */
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { Spin } from 'antd';
import { httpClient } from '../../../lib/http/client';

export default function SlugIndexPage() {
    const router = useRouter();
    const { slug } = router.query;
    const [error, setError] = useState('');

    useEffect(() => {
        if (!slug || !router.isReady) return;

        const resolveAndRedirect = async () => {
            try {
                const res = await httpClient.get(`/workspaces/resolve/${slug}`);
                if (res.data?.success && res.data?.data?.id) {
                    router.replace(`/workspace/${res.data.data.id}`);
                } else {
                    setError('Workspace không tồn tại');
                }
            } catch (err: any) {
                if (err?.response?.status === 401) {
                    router.replace('/auth/login');
                } else {
                    setError('Không tìm thấy workspace');
                }
            }
        };

        resolveAndRedirect();
    }, [slug, router]);

    if (error) {
        return (
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#f8fafc',
                fontFamily: 'Inter, sans-serif',
            }}>
                <div style={{ fontSize: 64, marginBottom: 16 }}>🔍</div>
                <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>
                    Workspace không tìm thấy
                </h1>
                <p style={{ color: '#64748b', fontSize: 14, marginBottom: 24 }}>
                    Slug &ldquo;{slug}&rdquo; không tồn tại.
                </p>
                <button
                    onClick={() => router.push('/workspace')}
                    style={{
                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                        color: '#fff', border: 'none', padding: '10px 24px',
                        borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer',
                    }}
                >
                    ← Về trang chủ
                </button>
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
            <Spin size="large" tip="Đang chuyển hướng..." />
        </div>
    );
}
