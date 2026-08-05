const DEFAULT_CLOUD_AI_BASE_URL = 'https://api.nemarkchat.com/v1';
const DEFAULT_AI_MODEL = 'qwen2.5:14b';

const LEGACY_LOCAL_AI_HOSTS = new Set([
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
    '::1',
    '163.61.111.226',
    'rk674rm.9router.com',
    'api.nemarkdigital.com',
]);

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

const parseBaseUrl = (value: string) => {
    const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    return new URL(withProtocol);
};

export const normalizeAIBaseUrl = (value?: string | null) => {
    const raw = trimTrailingSlash((value || '').trim());
    if (!raw) return DEFAULT_CLOUD_AI_BASE_URL;

    try {
        const parsed = parseBaseUrl(raw);
        if (LEGACY_LOCAL_AI_HOSTS.has(parsed.hostname)) return DEFAULT_CLOUD_AI_BASE_URL;

        const pathname = trimTrailingSlash(parsed.pathname);
        if (parsed.hostname === 'api.nemarkchat.com' && (!pathname || pathname === '/')) {
            return DEFAULT_CLOUD_AI_BASE_URL;
        }

        return `${parsed.origin}${pathname || ''}`;
    } catch {
        return DEFAULT_CLOUD_AI_BASE_URL;
    }
};

export const getAIBaseUrl = () => normalizeAIBaseUrl(
    process.env.NEMARK_AI_API_URL || process.env.AI_API_URL || DEFAULT_CLOUD_AI_BASE_URL
);

export const getAIAPIKey = () => (
    process.env.NEMARK_AI_API_KEY || process.env.AI_API_KEY || ''
);

export const getAIModel = () => (
    process.env.NEMARK_AI_MODEL || process.env.AI_MODEL || DEFAULT_AI_MODEL
);

export const isMaskedAIKey = (value?: string | null) => {
    if (!value) return false;
    return value.startsWith('****') || value.startsWith('••••') || value.startsWith('â€¢â€¢â€¢â€¢');
};

export const maskAIKey = (value?: string | null) => (
    value ? `****${value.slice(-4)}` : ''
);
