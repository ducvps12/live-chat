import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { resolveApiBaseUrl } from './api-base';

const apiBaseUrl = resolveApiBaseUrl();

export const httpClient = axios.create({
    baseURL: apiBaseUrl,
    timeout: 15000,
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
    },
});

const authFreeClient = axios.create({
    baseURL: apiBaseUrl,
    timeout: 15000,
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
    },
});

let refreshPromise: Promise<string | null> | null = null;

export const getStoredAccessToken = () => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('nemark_token');
};

export const setStoredAccessToken = (token: string) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('nemark_token', token);
};

export const clearStoredAccessToken = () => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('nemark_token');
};

export const refreshAccessToken = async () => {
    if (typeof window === 'undefined') return null;

    if (!refreshPromise) {
        refreshPromise = authFreeClient
            .post('/auth/refresh')
            .then((response) => {
                const nextToken = response.data?.data?.accessToken;
                if (!nextToken) return null;
                setStoredAccessToken(nextToken);
                return nextToken as string;
            })
            .catch(() => {
                clearStoredAccessToken();
                return null;
            })
            .finally(() => {
                refreshPromise = null;
            });
    }

    return refreshPromise;
};

const redirectToLogin = () => {
    if (typeof window === 'undefined') return;
    if (window.location.pathname !== '/auth/login') {
        const next = `${window.location.pathname}${window.location.search}`;
        window.location.href = `/auth/login?next=${encodeURIComponent(next)}`;
    }
};

httpClient.interceptors.request.use(
    (config) => {
        const token = getStoredAccessToken();
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        if ((config.method || 'get').toLowerCase() === 'get') {
            config.headers['Cache-Control'] = 'no-cache';
            config.headers.Pragma = 'no-cache';
            config.headers.Expires = '0';
        }
        return config;
    },
    (error) => Promise.reject(error)
);

httpClient.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        const originalRequest = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
        const requestUrl = originalRequest?.url || '';

        if (
            error.response?.status === 401 &&
            typeof window !== 'undefined' &&
            originalRequest &&
            !originalRequest._retry &&
            !requestUrl.includes('/auth/login') &&
            !requestUrl.includes('/auth/refresh')
        ) {
            originalRequest._retry = true;
            const nextToken = await refreshAccessToken();
            if (nextToken) {
                originalRequest.headers.Authorization = `Bearer ${nextToken}`;
                return httpClient(originalRequest);
            }
        }

        if (error.response?.status === 401) {
            redirectToLogin();
        }

        return Promise.reject(error);
    }
);
