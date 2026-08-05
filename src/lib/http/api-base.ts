const LOCAL_API_PORT = '4010';
const LOCAL_API_PATH = '/api';

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

const normalizeApiBaseUrl = (value: string) => {
    const trimmed = trimTrailingSlash(value.trim());
    if (!trimmed) return `http://localhost:${LOCAL_API_PORT}${LOCAL_API_PATH}`;
    return trimmed.endsWith(LOCAL_API_PATH) ? trimmed : `${trimmed}${LOCAL_API_PATH}`;
};

const isLocalHost = (hostname: string) => (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname === '::1' ||
    hostname === '[::1]'
);

const formatLocalHost = (hostname: string) => {
    if (hostname === '::1' || hostname === '[::1]') return '[::1]';
    if (hostname === '0.0.0.0') return 'localhost';
    return hostname;
};

export const resolveApiBaseUrl = () => {
    const rawConfig = process.env.NEXT_PUBLIC_API_URL || '';
    const configuredUrl = (rawConfig.includes('3010') || rawConfig.includes('163.61.111.226')) ? '' : rawConfig;

    if (typeof window !== 'undefined') {
        if (!isLocalHost(window.location.hostname)) {
            // The production frontend and API are deployed on the same origin.
            return `${window.location.origin}${LOCAL_API_PATH}`;
        }

        if (configuredUrl) {
            try {
                return normalizeApiBaseUrl(configuredUrl);
            } catch {
                // Fall through to the local API convention used by npm run dev.
            }
        }

        const protocol = window.location.protocol === 'https:' ? 'https' : 'http';
        return `${protocol}://${formatLocalHost(window.location.hostname)}:${LOCAL_API_PORT}${LOCAL_API_PATH}`;
    }

    return normalizeApiBaseUrl(configuredUrl || `http://localhost:${LOCAL_API_PORT}${LOCAL_API_PATH}`);
};
