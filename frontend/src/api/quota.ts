import { apiClient } from './client';

export interface QuotaUsage {
    used: number;
    limit: number;
}

export interface QuotaStatus {
    queries: QuotaUsage;
    scrapes: QuotaUsage;
}

export async function getQuotaStatus(): Promise<QuotaStatus> {
    const res = await apiClient.get<QuotaStatus>('/auth/quota-status');
    return res.data;
}
