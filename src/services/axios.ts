import { Alert } from '@/components/alert'
import i18n from '@/i18n'
import { HTTP_STATUS } from '@/utils/enums'
import axios, { InternalAxiosRequestConfig, AxiosError } from 'axios'

export const BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api'
export const EMPTY_URL = ''
export const DGJ_URL = '' // api identify

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 3 * 60 * 1000,
  headers: {
    'Content-Type': 'application/json'
  }
})

const emptyApi = axios.create({
  baseURL: EMPTY_URL,
  timeout: 3 * 60 * 1000,
  headers: {
    'Content-Type': 'application/json'
  }
})

const apiDGJ = axios.create({
  baseURL: DGJ_URL,
  timeout: 10 * 60 * 1000, // 10 minutes timeout for identify API calls
});


const addAuthToken = (config: InternalAxiosRequestConfig) => {
  const authToken = localStorage.getItem('auth_token')
  let token: string | undefined = undefined;
  if (authToken) {
    const { code } = JSON.parse(authToken) as { code: string; time: string };
    token = code;
  }
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config
}

api.interceptors.request.use(addAuthToken)
emptyApi.interceptors.request.use(addAuthToken)
apiDGJ.interceptors.request.use(addAuthToken) 

let isNetworkAlertOpen = false;

const handleResponseError = (error: AxiosError) => {
  
  const t = i18n.t;
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
    title = t('message.gateway_error');
    message = t('message.gateway_error');
  } else if (status === HTTP_STATUS.SERVER_ERROR) {
    title = t('message.server_error');
    message = (typeof data === 'object' ? data?.detail || data?.message : null) || t('message.server_error');
  } else {
    title = (typeof data === 'object' ? data?.title : null) || t('message.server_error');
    message = (typeof data === 'object' ? data?.detail || data?.message : null) || t('message.server_error');
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
        confirmText: t("common.ok"),
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
  else if (status === HTTP_STATUS.UNAUTHORIZED_STATUS) {
    localStorage.removeItem('auth_token');
    if (window.location.pathname !== '/home?isLogin') {
      window.location.href = '/home?isLogin';
    }
    console.warn('Unauthorized - reLogin');
    return Promise.reject({
      status,
      message: t('message.unauthorized'),
      title: t('message.unauthorized'),
      original: error,
    });
    
  }

  else if (!error.response) {
    if (!isNetworkAlertOpen) {
      isNetworkAlertOpen = true;
      Alert.show({
        title: t('message.connection_lost'),
        message: t('message.internet_error'),
        icon: 'error',
        confirmText: t("common.ok"),
      }).finally(() => {
        isNetworkAlertOpen = false;
      });
    }
    return Promise.reject({
      status: null,
      message: t('message.internet_error'),
      title: t('message.connection_lost'),
      original: error,
    });
  }

  return Promise.reject(error)
}

api.interceptors.response.use(
  response => response,
  handleResponseError
)

emptyApi.interceptors.response.use(
  response => response,
  handleResponseError
)

apiDGJ.interceptors.response.use((res) => res, handleResponseError);

// Helper function to format fetch errors (for use in identify.ts and other fetch-based services)
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

  // Handle "Failed to fetch" (network/timeout errors) - map to 504
  if (error instanceof TypeError && error.message === "Failed to fetch") {
    status = HTTP_STATUS.GATEWAY_TIMEOUT;
    title = t('message.gateway_error');
    message = t('message.gateway_error');
  } else if (response) {
    // Handle response errors
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
    // Network errors without response
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

export default api
export { emptyApi ,apiDGJ }