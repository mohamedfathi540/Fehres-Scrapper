export interface AgentStep {
    step: number;
    tool: string;
    args: Record<string, unknown>;
    result: string;
}

export interface AgentRequest {
    goal: string;
    project_name?: string;
    max_steps?: number;
    chat_history?: { role: string; content: string }[];
}

export interface AgentResponse {
    signal: string;
    answer: string;
    steps: AgentStep[];
    sources: string[];
}
