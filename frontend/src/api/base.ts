import { apiClient } from './client';
import type { HealthResponse } from './types';

export const checkHealth = async (): Promise<HealthResponse> => {
    const response = await apiClient.get<HealthResponse>('/');
    return response.data;
};
