import { Alert } from '@/components/alert';
import i18n from '@/i18n';
import { HTTP_STATUS } from '@/utils/enums';
import axios, { InternalAxiosRequestConfig, AxiosError, AxiosRequestConfig } from 'axios';
import { message as antMessage } from 'antd';

// Detect base URL - always use /api (Next.js handles rewrite to backend)
const getBaseUrl = (): string => {
  if (typeof window !== 'undefined') {
    // Always use relative /api path - Next.js rewrites will proxy to backend
    // This works for both local dev (localhost:3000) and tunnel (chat.mtdvps.com)
    return '/api';
  }
  // SSR fallback - use full URL (merged server runs on port 3001)
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
};

export const BASE_URL = getBaseUrl();
export const EMPTY_URL = '';
export const DGJ_URL = ''; // api identify

// Flags to prevent infinite loops and manage concurrency
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: unknown) => void;
  reject: (reason?: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });

  failedQueue = [];
};

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 3 * 60 * 1000,
  headers: {
    'Content-Type': 'application/json',
  },
});

const emptyApi = axios.create({
  baseURL: EMPTY_URL,
  timeout: 3 * 60 * 1000,
  headers: {
    'Content-Type': 'application/json',
  },
});

const apiDGJ = axios.create({
  baseURL: DGJ_URL,
  timeout: 10 * 60 * 1000,
});

const addAuthToken = (config: InternalAxiosRequestConfig) => {
  try {
    const authToken = localStorage.getItem('auth_token');
    let token: string | undefined = undefined;
    if (authToken) {
      try {
        const parsedToken = JSON.parse(authToken) as { code: string; time: string };
        token = parsedToken.code;
      } catch (e) {
        // Fallback: assume the stored value is the token string itself if not JSON
        console.warn('Auth token is not JSON, using raw value');
        token = authToken;
      }
    }
    if (token) {
      config.headers = config.headers || {};
      // Send raw token as per successful CURL command (no Bearer prefix)
      config.headers.Authorization = `${token}`;
      console.log('Attaching Authorization header:', token.substring(0, 10) + '...');
    } else {
      console.log('No auth token found in local storage');
    }
  } catch (error) {
    console.error("Error parsing auth token", error);
    localStorage.removeItem('auth_token');
  }
  return config;
};

api.interceptors.request.use(addAuthToken);
emptyApi.interceptors.request.use(addAuthToken);
apiDGJ.interceptors.request.use(addAuthToken);

let isNetworkAlertOpen = false;

const handleResponseError = async (error: AxiosError) => {
  const t = i18n.t;
  const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

  // Handle 401 Unauthorized with Token Refresh
  if (error.response?.status === HTTP_STATUS.UNAUTHORIZED_STATUS && !originalRequest._retry) {
    console.log('401 Unauthorized detected. Attempting refresh...');
    if (isRefreshing) {
      return new Promise(function (resolve, reject) {
        failedQueue.push({ resolve, reject });
      })
        .then((token) => {
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `${token}`;
          }
          return api(originalRequest);
        })
        .catch((err) => {
          return Promise.reject(err);
        });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const refreshToken = localStorage.getItem('refresh_token');
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      // Use a clean axios instance to avoid interceptors loops
      const refreshResponse = await axios.post(`${BASE_URL}/auth/refresh`, {
        refreshToken: refreshToken
      });

      const { token, refreshToken: newRefreshToken } = refreshResponse.data.data || refreshResponse.data;

      // Update local storage
      localStorage.setItem('auth_token', JSON.stringify({
        code: token,
        time: new Date().toISOString()
      }));

      if (newRefreshToken) {
        localStorage.setItem('refresh_token', newRefreshToken);
      }

      // Update the header for the original request
      if (originalRequest.headers) {
        originalRequest.headers.Authorization = `${token}`;
      }

      processQueue(null, token);
      return api(originalRequest);

    } catch (refreshError) {
      console.error('Refresh token failed:', refreshError);
      processQueue(refreshError, null);

      // Logout logic
      console.log('Clearing auth token due to refresh failure');
      localStorage.removeItem('auth_token');
      localStorage.removeItem('refresh_token');
      if (window.location.pathname !== '/auth/login') {
        // Use router if possible, but window.location is safer here outside React context
        window.location.href = '/auth/login';
      }
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }

  // Standard Error Handling for other errors
  let status = error?.response?.status;
  const data = error?.response?.data as { detail?: string; message?: string; title?: string } | string;
  let message = '';
  let title = '';

  const isGatewayError =
    status === HTTP_STATUS.SERVER_ERROR_BUILD ||
    status === HTTP_STATUS.SERVICE_UNAVAILABLE ||
    status === HTTP_STATUS.GATEWAY_TIMEOUT ||
    (typeof data === 'string' &&
      (data.startsWith('<!DOCTYPE') || data.startsWith('<html')));

  if (isGatewayError) {
    status = HTTP_STATUS.SERVER_ERROR_BUILD;
    title = t('message.gateway_error') || 'Gateway Error';
    message = t('message.gateway_error') || 'Bad Gateway';
  } else if (status === HTTP_STATUS.SERVER_ERROR) {
    title = t('message.server_error') || 'Server Error';
    message = (typeof data === 'object' ? data?.detail || data?.message : null) || t('message.server_error') || 'Internal Server Error';
  } else {
    title = (typeof data === 'object' ? data?.title : null) || t('message.server_error') || 'Error';
    message = (typeof data === 'object' ? data?.detail || data?.message : null) || t('message.server_error') || 'An error occurred';
  }

  if (
    status === HTTP_STATUS.SERVER_ERROR ||
    status === HTTP_STATUS.SERVER_ERROR_BUILD ||
    status === HTTP_STATUS.SERVICE_UNAVAILABLE ||
    status === HTTP_STATUS.GATEWAY_TIMEOUT ||
    status === HTTP_STATUS.NOT_FOUND
  ) {
    if (!isNetworkAlertOpen) {
      isNetworkAlertOpen = true;
      Alert.show({
        title,
        message,
        icon: "error",
        confirmText: t("common.ok") || "OK",
      }).finally(() => {
        isNetworkAlertOpen = false;
      });
    }
    console.error('Server Error:', message);

    return Promise.reject({
      isGatewayError: isGatewayError,
      status,
      message,
      title,
      original: error,
    });
  }

  else if (!error.response && error.code !== "ERR_CANCELED") { // Ignore canceled requests
    if (!isNetworkAlertOpen) {
      isNetworkAlertOpen = true;
      Alert.show({
        title: t('message.connection_lost') || 'Connection Lost',
        message: t('message.internet_error') || 'Please check your internet connection',
        icon: 'error',
        confirmText: t("common.ok") || "OK",
      }).finally(() => {
        isNetworkAlertOpen = false;
      });
    }
    return Promise.reject({
      status: null,
      message: t('message.internet_error') || 'Network Error',
      title: t('message.connection_lost') || 'Connection Lost',
      original: error,
    });
  }

  return Promise.reject(error);
};

api.interceptors.response.use(
  (response) => response,
  handleResponseError
);

emptyApi.interceptors.response.use(
  (response) => response,
  handleResponseError
);

apiDGJ.interceptors.response.use((res) => res, handleResponseError);

export const formatFetchError = (
  error: unknown,
  response?: Response,
  errorData?: { detail?: string; message?: string; title?: string } | string
): {
  status: number | null;
  message: string;
  title: string;
  original?: unknown;
  response?: { status?: number; statusText?: string; data?: unknown };
} => {
  const t = i18n.t;
  let status: number | null = response?.status || null;
  let message = '';
  let title = '';

  if (error instanceof TypeError && error.message === "Failed to fetch") {
    status = HTTP_STATUS.GATEWAY_TIMEOUT;
    title = t('message.gateway_error');
    message = t('message.gateway_error');
  } else if (response) {
    const isGatewayError =
      status === HTTP_STATUS.SERVER_ERROR_BUILD ||
      status === HTTP_STATUS.SERVICE_UNAVAILABLE ||
      status === HTTP_STATUS.GATEWAY_TIMEOUT;

    if (isGatewayError) {
      status = HTTP_STATUS.SERVER_ERROR_BUILD;
      title = t('message.gateway_error');
      message = t('message.gateway_error');
    } else if (status === HTTP_STATUS.SERVER_ERROR) {
      title = t('message.server_error');
      message = (errorData && typeof errorData === 'object' ? errorData?.detail || errorData?.message : null) || t('message.server_error');
    } else {
      title = (errorData && typeof errorData === 'object' ? errorData?.title : null) || t('message.server_error');
      message = (errorData && typeof errorData === 'object' ? errorData?.detail || errorData?.message : null) || t('message.server_error');
    }
  } else {
    title = t('message.connection_lost');
    message = t('message.internet_error');
  }

  return {
    status,
    message,
    title,
    original: error,
    response: response ? {
      status: response.status,
      statusText: response.statusText,
      data: errorData,
    } : undefined,
  };
};

export default api;
export { emptyApi, apiDGJ };
