from fastapi import APIRouter, Request, Depends
from fastapi.responses import JSONResponse
from datetime import date
from sqlalchemy.future import select
from .Schemes.Auth_Schemes import UserRegister, UserLogin, ResendVerification
from Controllers.AuthController import AuthController, get_current_user
from Helpers.Config import get_settings
from Models.DB_Schemes.minirag.Schemes.User import User
from Models.DB_Schemes.minirag.Schemes.UserUsageQuota import UserUsageQuota

auth_router = APIRouter(
    prefix="/api/v1/auth",
    tags=["api_v1", "auth"],
)

auth_controller = AuthController()


@auth_router.post("/register")
async def register(request: Request, body: UserRegister):
    result = await auth_controller.register_user(
        email=body.email,
        password=body.password,
        db_client=request.app.db_client,
    )
    return result


@auth_router.post("/login")
async def login(request: Request, body: UserLogin):
    result = await auth_controller.login_user(
        email=body.email,
        password=body.password,
        db_client=request.app.db_client,
    )
    return result


@auth_router.get("/verify")
async def verify_email(request: Request, token: str):
    result = await auth_controller.verify_email(
        token=token,
        db_client=request.app.db_client,
    )
    return result


@auth_router.post("/resend-verification")
async def resend_verification(request: Request, body: ResendVerification):
    result = await auth_controller.resend_verification(
        email=body.email,
        db_client=request.app.db_client,
    )
    return result


@auth_router.delete("/account")
async def delete_account(request: Request, current_user: dict = Depends(get_current_user)):
    result = await auth_controller.delete_account(
        email=current_user["email"],
        db_client=request.app.db_client,
    )
    return result


@auth_router.get("/quota-status")
async def get_quota_status(
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    """Return today's quota usage for the authenticated user."""
    settings = get_settings()
    today = date.today()

    async with request.app.db_client() as session:
        # Resolve user_id from email
        result = await session.execute(
            select(User).where(User.email == current_user["email"])
        )
        db_user: User | None = result.scalar_one_or_none()

    if db_user is None:
        return JSONResponse(content={
            "queries": {"used": 0, "limit": settings.QUOTA_DAILY_QUERIES},
            "scrapes": {"used": 0, "limit": settings.QUOTA_DAILY_SCRAPES},
        })

    async with request.app.db_client() as session:
        result = await session.execute(
            select(UserUsageQuota).where(
                UserUsageQuota.user_id == db_user.user_id,
                UserUsageQuota.date == today,
            )
        )
        quota: UserUsageQuota | None = result.scalar_one_or_none()

    return JSONResponse(content={
        "queries": {
            "used": quota.query_count if quota else 0,
            "limit": settings.QUOTA_DAILY_QUERIES,
        },
        "scrapes": {
            "used": quota.scrape_count if quota else 0,
            "limit": settings.QUOTA_DAILY_SCRAPES,
        },
    })
