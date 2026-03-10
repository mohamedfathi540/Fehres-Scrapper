from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from .Schemes.Auth_Schemes import UserRegister, UserLogin, ResendVerification
from Controllers.AuthController import AuthController

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
