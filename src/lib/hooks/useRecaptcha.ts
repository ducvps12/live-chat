import { useEffect, useState, useCallback, useRef } from 'react';

const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || '';

/**
 * Hook for reCAPTCHA v2 (checkbox "I'm not a robot").
 * Fetches settings from the admin API to check if reCAPTCHA is enabled.
 * If disabled (or no site key), returns empty string and skips rendering.
 */
export function useRecaptcha() {
    const [isEnabled, setIsEnabled] = useState(false);
    const [siteKey, setSiteKey] = useState('');
    const [loaded, setLoaded] = useState(false);

    // Fetch settings to check if reCAPTCHA is enabled
    useEffect(() => {
        // Check admin settings API for reCAPTCHA config
        const checkSettings = async () => {
            try {
                const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4020/api';
                const res = await fetch(`${apiUrl}/admin/settings`, {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('nemark_token') || ''}`,
                    },
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data.success && data.data) {
                        const enabled = data.data.recaptcha_enabled === 'true';
                        const key = data.data.recaptcha_site_key || RECAPTCHA_SITE_KEY;
                        setIsEnabled(enabled);
                        setSiteKey(key);
                    }
                }
            } catch {
                // If can't reach admin API, use env defaults
                setIsEnabled(false);
                setSiteKey(RECAPTCHA_SITE_KEY);
            }
        };
        checkSettings();
    }, []);

    // Load reCAPTCHA v2 script when enabled
    useEffect(() => {
        if (!isEnabled || !siteKey) return;
        if (document.getElementById('recaptcha-v2-script')) {
            setLoaded(true);
            return;
        }

        const script = document.createElement('script');
        script.id = 'recaptcha-v2-script';
        script.src = 'https://www.google.com/recaptcha/api.js';
        script.async = true;
        script.defer = true;
        script.onload = () => setLoaded(true);
        document.head.appendChild(script);

        return () => {
            const existing = document.getElementById('recaptcha-v2-script');
            if (existing) existing.remove();
        };
    }, [isEnabled, siteKey]);

    /**
     * For reCAPTCHA v2, tokens are obtained via the widget callback.
     * This function returns empty string (v2 uses widget, not programmatic execution).
     */
    const executeRecaptcha = useCallback(async (_action: string): Promise<string> => {
        // reCAPTCHA v2 uses checkbox widget, token is set via callback
        return '';
    }, []);

    return {
        executeRecaptcha,
        isEnabled,
        siteKey,
        loaded,
    };
}
