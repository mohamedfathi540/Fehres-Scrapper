import { apiClient } from './client';
import type { AgentRequest, AgentResponse } from './agent.types';

export const runAgent = async (request: AgentRequest): Promise<AgentResponse> => {
    const response = await apiClient.post<AgentResponse>(
        '/agent/run',
        request,
        { timeout: 5 * 60 * 1000 } // 5 minutes timeout for agent operations
    );
    return response.data;
};
