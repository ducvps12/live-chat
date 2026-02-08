import { useEffect, useState } from 'react';

interface DbStatus {
    status: 'ok' | 'error';
    database: 'connected' | 'disconnected';
    error: string | null;
    timestamp: string | null;
}

export function DbStatusBanner() {
    const [dbStatus, setDbStatus] = useState<DbStatus | null>(null);
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        let interval: NodeJS.Timeout;

        const checkHealth = async () => {
            try {
                const res = await fetch('/api/health', { cache: 'no-store' });
                const data: DbStatus = await res.json();
                setDbStatus(data);
            } catch {
                setDbStatus({
                    status: 'error',
                    database: 'disconnected',
                    error: 'Cannot reach server',
                    timestamp: new Date().toISOString(),
                });
            }
        };

        // Initial check
        checkHealth();

        // Re-check every 30 seconds
        interval = setInterval(checkHealth, 30000);

        return () => clearInterval(interval);
    }, []);

    // Don't show if connected or dismissed
    if (!dbStatus || dbStatus.database === 'connected' || dismissed) {
        return null;
    }

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                zIndex: 99999,
                background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                color: '#fff',
                padding: '12px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                fontSize: '14px',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            }}
        >
            <span style={{ fontSize: '18px' }}>⚠️</span>
            <span>
                <strong>Database Connection Failed</strong>
                {dbStatus.error ? ` — ${dbStatus.error}` : ''}
                . Một số tính năng sẽ không hoạt động cho đến khi kết nối lại.
            </span>
            <button
                onClick={() => setDismissed(true)}
                style={{
                    background: 'rgba(255,255,255,0.2)',
                    border: '1px solid rgba(255,255,255,0.4)',
                    color: '#fff',
                    borderRadius: '4px',
                    padding: '4px 12px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    whiteSpace: 'nowrap',
                }}
            >
                Dismiss
            </button>
        </div>
    );
}
