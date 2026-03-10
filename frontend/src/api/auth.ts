import { apiClient } from './client';
import type { LoginRequest, RegisterRequest, TokenResponse, MessageResponse } from './auth.types';

export const loginUser = async (data: LoginRequest): Promise<TokenResponse> => {
    const response = await apiClient.post<TokenResponse>('/auth/login', data);
    return response.data;
};

export const registerUser = async (data: RegisterRequest): Promise<MessageResponse> => {
    const response = await apiClient.post<MessageResponse>('/auth/register', data);
    return response.data;
};

export const verifyEmail = async (token: string): Promise<MessageResponse> => {
    const response = await apiClient.get<MessageResponse>('/auth/verify', { params: { token } });
    return response.data;
};

export const resendVerification = async (email: string): Promise<MessageResponse> => {
    const response = await apiClient.post<MessageResponse>('/auth/resend-verification', { email });
    return response.data;
};
