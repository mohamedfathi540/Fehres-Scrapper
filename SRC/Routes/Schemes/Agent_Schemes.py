from pydantic import BaseModel, Field
from typing import Optional, List


class AgentChatMessage(BaseModel):
    role: str          # "user" | "assistant"
    content: str


class AgentRequest(BaseModel):
    goal: str = Field(..., min_length=1, description="The research goal or question for the agent.")
    project_name: Optional[str] = None
    max_steps: Optional[int]    = None
    chat_history: Optional[List[AgentChatMessage]] = None
