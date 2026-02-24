import axios, { type AxiosInstance, type AxiosError } from 'axios';
import { useSettingsStore } from '../stores/settingsStore';

// Create axios instance
const createApiClient = (): AxiosInstance => {
    const client = axios.create({
        baseURL: '', // Will be set per-request
        timeout: 120000, // 2 minutes default
        headers: {
            'Content-Type': 'application/json',
        },
    });

    // Request interceptor to add base URL from settings
    client.interceptors.request.use(
        (config) => {
            const { apiUrl } = useSettingsStore.getState();
            config.baseURL = apiUrl;
            return config;
        },
        (error) => Promise.reject(error)
    );

    // Response interceptor for error handling
    client.interceptors.response.use(
        (response) => response,
        (error: AxiosError) => {
            if (error.response) {
                // The request was made and the server responded with an error status
                const errorData = error.response.data as { signal?: string; Signal?: string; error?: string };
                const errorMessage = errorData.signal || errorData.Signal || errorData.error || 'An error occurred';
                return Promise.reject(new Error(errorMessage));
            } else if (error.request) {
                // The request was made but no response was received
                return Promise.reject(new Error('No response from server. Please check if the API is running.'));
            } else {
                // Something happened in setting up the request
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
    const formData = new FormData();
    formData.append('file', file);

    return axios.post(`${apiUrl}${url}`, formData, {
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
