/**
 * Slug-based routing: /w/:slug/:page → /workspace/:workspaceId/:page
 * 
 * Resolves human-readable workspace slugs (e.g., "mtdvps") to workspace IDs,
 * then renders the correct workspace page without visible redirect.
 * 
 * Examples:
 *   /w/mtdvps/inbox     → /workspace/cmnbk4yit.../inbox
 *   /w/mtdvps/settings  → /workspace/cmnbk4yit.../settings
 *   /w/mtdvps           → /workspace/cmnbk4yit.../
 */
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { Spin } from 'antd';
import { httpClient } from '../../../lib/http/client';

export default function SlugRedirectPage() {
    const router = useRouter();
    const { slug, page } = router.query;
    const [error, setError] = useState('');

    useEffect(() => {
        if (!slug || !router.isReady) return;

        const resolveAndRedirect = async () => {
            try {
                const res = await httpClient.get(`/workspaces/resolve/${slug}`);
                if (res.data?.success && res.data?.data?.id) {
                    const workspaceId = res.data.data.id;
                    const pagePath = Array.isArray(page) ? page.join('/') : (page || '');
                    // Use replace to avoid adding to browser history
                    router.replace(`/workspace/${workspaceId}/${pagePath}`);
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
    }, [slug, page, router]);

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
                <div style={{
                    fontSize: 64,
                    marginBottom: 16,
                }}>🔍</div>
                <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>
                    Workspace không tìm thấy
                </h1>
                <p style={{ color: '#64748b', fontSize: 14, marginBottom: 24 }}>
                    Slug &ldquo;{slug}&rdquo; không tồn tại hoặc bạn không có quyền truy cập.
                </p>
                <button
                    onClick={() => router.push('/workspace')}
                    style={{
                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                        color: '#fff',
                        border: 'none',
                        padding: '10px 24px',
                        borderRadius: 10,
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: 'pointer',
                    }}
                >
                    ← Về trang chủ
                </button>
            </div>
        );
    }

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#f8fafc',
        }}>
            <Spin size="large" tip="Đang chuyển hướng..." />
        </div>
    );
}
