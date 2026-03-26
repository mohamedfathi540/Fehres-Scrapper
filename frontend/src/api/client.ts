import axios, { type AxiosInstance, type AxiosError } from 'axios';
import { useSettingsStore } from '../stores/settingsStore';
import { useAuthStore } from '../stores/authStore';
import { showToast } from '../stores/toastStore';

const DEFAULT_API_PREFIX = '/api/v1';

const normalizeApiUrl = (url?: string): string => {
    const trimmed = (url ?? '').trim();
    if (!trimmed) {
        return DEFAULT_API_PREFIX;
    }
    return trimmed.replace(/\/+$/, '');
};

const extractErrorMessage = (error: AxiosError): string => {
    const data = error.response?.data;

    if (typeof data === 'string') {
        return data || 'An error occurred';
    }

    if (data && typeof data === 'object') {
        const payload = data as Record<string, unknown>;
        const detail = payload.detail;

        if (typeof detail === 'string' && detail) {
            return detail;
        }

        if (Array.isArray(detail) && detail.length > 0) {
            const first = detail[0];
            if (typeof first === 'string') {
                return first;
            }
            if (first && typeof first === 'object' && 'msg' in first) {
                const msg = (first as { msg?: unknown }).msg;
                if (typeof msg === 'string' && msg) {
                    return msg;
                }
            }
        }

        const keys = ['signal', 'Signal', 'error', 'message'];
        for (const key of keys) {
            const value = payload[key];
            if (typeof value === 'string' && value) {
                return value;
            }
        }
    }

    return 'An error occurred';
};

// Create axios instance
const createApiClient = (): AxiosInstance => {
    const client = axios.create({
        baseURL: '', // Will be set per-request
        timeout: 120000, // 2 minutes default
        headers: {
            'Content-Type': 'application/json',
        },
    });

    // Request interceptor to add base URL and auth token
    client.interceptors.request.use(
        (config) => {
            const { apiUrl } = useSettingsStore.getState();
            config.baseURL = normalizeApiUrl(apiUrl);

            const { token } = useAuthStore.getState();
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
            return config;
        },
        (error) => Promise.reject(error)
    );

    // Response interceptor for error handling
    client.interceptors.response.use(
        (response) => response,
        (error: AxiosError) => {
            if (error.response) {
                // Auto-logout on 401
                if (error.response.status === 401) {
                    useAuthStore.getState().logout();
                }

                // Toast on 503 Service Unavailable
                if (error.response.status === 503) {
                    showToast('Server is temporarily unavailable. Please try again shortly.', 'error');
                }

                const errorMessage = extractErrorMessage(error);
                return Promise.reject(new Error(errorMessage));
            } else if (error.request) {
                // Network error — server unreachable
                showToast('No response from server. Check your connection or try again later.', 'error');
                return Promise.reject(new Error('No response from server. Check API URL in Settings and verify backend/proxy is reachable.'));
            } else {
                return Promise.reject(new Error(error.message));
            }
        }
    );

    return client;
};

export const apiClient = createApiClient();

// Helper function for file uploads with progress
export const uploadFileWithProgress = async (
    url: string,
    file: File,
    onProgress?: (progress: number) => void
) => {
    const { apiUrl } = useSettingsStore.getState();
    const baseUrl = normalizeApiUrl(apiUrl);
    const formData = new FormData();
    formData.append('file', file);

    return axios.post(`${baseUrl}${url}`, formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
            if (onProgress && progressEvent.total) {
                const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                onProgress(progress);
            }
        },
        timeout: 60000,
    });
};
