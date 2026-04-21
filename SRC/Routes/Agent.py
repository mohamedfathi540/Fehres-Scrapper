"""
Agent Routes — POST /api/v1/agent/run

Follows the exact same pattern as Routes/NLP.py:
  - Depends(require_quota("query"))  for quota enforcement
  - Depends(get_current_user)        via main.py router include
  - projectModel                     to resolve the project
  - NLPController + AgentController  instantiated per-request
"""
import logging

from fastapi import APIRouter, Request, Depends, status
from fastapi.responses import JSONResponse

from Controllers.AgentController import AgentController
from Controllers.NLPController import NLPController
from Controllers.SecurityController import require_quota
from Models.Project_Model import projectModel
from Models.enums.ResponsEnums import ResponseSignal
from Helpers.Config import get_settings
from .Schemes.Agent_Schemes import AgentRequest

logger = logging.getLogger("uvicorn.error")

agent_router = APIRouter(
    prefix="/api/v1/agent",
    tags=["api_v1", "agent"],
)


@agent_router.post("/run")
async def run_agent(
    request: Request,
    body: AgentRequest,
    _user=Depends(require_quota("query")),
):
    """
    Execute a multi-step ADK agent to answer the user's goal using indexed documents.

    The agent will:
    1. Search the RAG index for relevant document chunks
    2. Optionally summarize long retrieved content
    3. Return a final synthesized answer with the steps it took
    """
    settings = get_settings()

    # ── Feature flag check ────────────────────────────────────────────────────
    if not settings.AGENT_ENABLED:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "signal": ResponseSignal.AGENT_DISABLED.value,
                "message": "Agent feature is currently disabled.",
            },
        )

    # ── Resolve project ───────────────────────────────────────────────────────
    project_model = await projectModel.create_instance(db_client=request.app.db_client)

    if body.project_name:
        project = await project_model.get_project_or_create_one(
            project_name=body.project_name
        )
    else:
        project = await project_model.get_project_or_create_one(
            project_id=settings.DEFAULT_PROJECT_ID
        )

    if not project:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"signal": ResponseSignal.PROJECT_NOT_FOUND.value},
        )

    # ── Instantiate controllers (same pattern as NLP.py) ─────────────────────
    nlp_controller = NLPController(
        genration_client=request.app.genration_client,
        embedding_client=request.app.embedding_client,
        vectordb_client=request.app.vectordb_client,
        template_parser=request.app.template_parser,
    )

    agent_controller = AgentController(
        generation_client=request.app.genration_client,
        embedding_client=request.app.embedding_client,
        vectordb_client=request.app.vectordb_client,
        template_parser=request.app.template_parser,
    )

    # ── Run the agent ─────────────────────────────────────────────────────────
    try:
        result = await agent_controller.run_agent(
            goal=body.goal,
            project=project,
            nlp_controller=nlp_controller,
            max_steps=body.max_steps,
            chat_history=[
                m.model_dump() for m in (body.chat_history or [])
            ],
        )
    except Exception as e:
        logger.error("Agent run failed: %s", e, exc_info=True)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "signal": ResponseSignal.AGENT_ERROR.value,
                "message": "Agent encountered an unexpected error.",
            },
        )

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={
            "signal":  ResponseSignal.AGENT_RUN_DONE.value,
            "answer":  result["answer"],
            "steps":   result["steps"],
            "sources": result["sources"],
        },
    )
