from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from sqlalchemy import text
import time

health_router = APIRouter(
    prefix="/health",
    tags=["health"],
)

# ── Liveness ──────────────────────────────────────────────────────────────────
# Answers: "Is the process alive?"
# Returns 200 as long as the Python process is running and the event-loop is
# responsive.  No external checks — if this fails the container needs restart.
@health_router.get(
    "/live",
    summary="Liveness probe",
    description="Returns 200 when the process is running and the event-loop is alive.",
)
async def liveness():
    return JSONResponse(
        status_code=200,
        content={
            "status": "alive",
            "timestamp": time.time(),
        },
    )


# ── Readiness ─────────────────────────────────────────────────────────────────
# Answers: "Is the app ready to serve real traffic?"
# Verifies every critical dependency.  Returns 200 only when ALL checks pass;
# returns 503 (Service Unavailable) otherwise so that load-balancers / k8s can
# stop routing traffic to the pod until it recovers.
@health_router.get(
    "/ready",
    summary="Readiness probe",
    description="Returns 200 when all dependencies (Postgres, VectorDB, LLM clients) are reachable.",
)
async def readiness(request: Request):
    checks: dict[str, dict] = {}
    all_ok = True

    # ── 1. PostgreSQL ──────────────────────────────────────────────────────────
    db_client = getattr(request.app, "db_client", None)
    if db_client is None:
        checks["postgres"] = {"status": "unavailable", "detail": "db_client not initialised"}
        all_ok = False
    else:
        try:
            async with db_client() as session:
                await session.execute(text("SELECT 1"))
            checks["postgres"] = {"status": "ok"}
        except Exception as exc:
            checks["postgres"] = {"status": "error", "detail": str(exc)}
            all_ok = False

    # ── 2. VectorDB ────────────────────────────────────────────────────────────
    vectordb_client = getattr(request.app, "vectordb_client", None)
    if vectordb_client is None:
        checks["vectordb"] = {"status": "unavailable", "detail": "vectordb_client not initialised"}
        all_ok = False
    else:
        try:
            # list_all_collections is a lightweight ping for both Qdrant and PGVector
            await vectordb_client.list_all_collections()
            checks["vectordb"] = {"status": "ok"}
        except Exception as exc:
            checks["vectordb"] = {"status": "error", "detail": str(exc)}
            all_ok = False

    # ── 3. Generation LLM client ───────────────────────────────────────────────
    gen_client = getattr(request.app, "genration_client", None)
    if gen_client is None:
        checks["llm_generation"] = {"status": "unavailable", "detail": "genration_client not initialised"}
        all_ok = False
    else:
        checks["llm_generation"] = {"status": "ok"}

    # ── 4. Embedding client ────────────────────────────────────────────────────
    emb_client = getattr(request.app, "embedding_client", None)
    if emb_client is None:
        checks["llm_embedding"] = {"status": "unavailable", "detail": "embedding_client not initialised"}
        all_ok = False
    else:
        checks["llm_embedding"] = {"status": "ok"}

    # ── Response ───────────────────────────────────────────────────────────────
    http_status = 200 if all_ok else 503
    return JSONResponse(
        status_code=http_status,
        content={
            "status": "ready" if all_ok else "not_ready",
            "timestamp": time.time(),
            "checks": checks,
        },
    )
