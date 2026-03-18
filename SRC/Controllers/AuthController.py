import os
import uuid
import logging
from datetime import timedelta

import httpx
import jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from .BaseController import basecontroller
from Models.User_Model import UserModel
from Models.DB_Schemes.minirag.Schemes.User import User

logger = logging.getLogger("uvicorn.error")

# ── JWT / password configuration ──────────────────────────────────────
from Helpers.Config import get_settings

# ── Shared singletons (used by FastAPI dependency) ────────────────────
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


class AuthController(basecontroller):
    """Handles registration, login, email verification, and JWT utilities."""

    def __init__(self):
        super().__init__()

    # ── password helpers ──────────────────────────────────────────────
    @staticmethod
    def verify_password(plain: str, hashed: str) -> bool:
        return pwd_context.verify(plain, hashed)

    @staticmethod
    def hash_password(password: str) -> str:
        return pwd_context.hash(password)

    # ── JWT helpers ───────────────────────────────────────────────────
    @staticmethod
    def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
        settings = get_settings()
        to_encode = data.copy()
        from datetime import datetime, timezone
        expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=settings.JWT_EXPIRE_MINUTES))
        to_encode.update({"exp": expire})
        return jwt.encode(to_encode, settings.JWT_SECRET or "change-me-in-production", algorithm="HS256")

    @staticmethod
    def decode_access_token(token: str) -> dict:
        settings = get_settings()
        try:
            return jwt.decode(token, settings.JWT_SECRET or "change-me-in-production", algorithms=["HS256"])
        except jwt.ExpiredSignatureError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has expired",
                headers={"WWW-Authenticate": "Bearer"},
            )
        except jwt.PyJWTError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )

    # ── email ─────────────────────────────────────────────────────────
    @staticmethod
    async def send_verification_email(email: str, token: str) -> None:
        settings = get_settings()
        if not settings.BREVO_API_KEY:
            logger.warning("BREVO_API_KEY not set — skipping verification email for %s", email)
            return

        verification_link = f"{settings.FRONTEND_URL or 'http://localhost:5173'}/verify-email?token={token}"
        payload = {
            "sender": {"email": settings.SENDER_EMAIL or "noreply@yourdomain.com", "name": settings.SENDER_NAME or "Fehres System"},
            "to": [{"email": email}],
            "subject": "Verify Your Email Address",
            "htmlContent": (
                "<html><body>"
                f"<p>Click <a href='{verification_link}'>here</a> to verify your email.</p>"
                "</body></html>"
            ),
        }
        headers = {
            "accept": "application/json",
            "api-key": settings.BREVO_API_KEY,
            "content-type": "application/json",
        }
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                "https://api.brevo.com/v3/smtp/email", json=payload, headers=headers,
            )
            response.raise_for_status()
            logger.info("Verification email sent to %s", email)

    # ── business logic ────────────────────────────────────────────────
    async def register_user(self, email: str, password: str, db_client) -> dict:
        user_model = await UserModel.create_instance(db_client=db_client)

        if await user_model.get_user_by_email(email):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A user with this email already exists",
            )

        verification_token = str(uuid.uuid4())
        new_user = User(
            email=email,
            hashed_password=self.hash_password(password),
            verification_token=verification_token,
        )
        await user_model.create_user(new_user)
        await self.send_verification_email(email, verification_token)

        return {"message": "User registered. Please check your email to verify."}

    async def login_user(self, email: str, password: str, db_client) -> dict:
        user_model = await UserModel.create_instance(db_client=db_client)

        user = await user_model.get_user_by_email(email)
        if not user or not self.verify_password(password, user.hashed_password):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

        if not user.is_verified:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Email not verified")

        if not user.is_active:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is deactivated")

        access_token = self.create_access_token(data={"sub": user.email})
        return {"access_token": access_token, "token_type": "bearer"}

    async def verify_email(self, token: str, db_client) -> dict:
        user_model = await UserModel.create_instance(db_client=db_client)

        user = await user_model.get_user_by_verification_token(token)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired verification token",
            )

        await user_model.verify_user(user.user_id)
        return {"message": "Email successfully verified"}

    async def resend_verification(self, email: str, db_client) -> dict:
        user_model = await UserModel.create_instance(db_client=db_client)

        user = await user_model.get_user_by_email(email)
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

        if user.is_verified:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email is already verified")

        new_token = str(uuid.uuid4())
        await user_model.update_verification_token(user.user_id, new_token)
        await self.send_verification_email(email, new_token)

        return {"message": "Verification email resent. Please check your inbox."}


# ── FastAPI dependency (module-level for Depends()) ───────────────────
_auth = AuthController()


def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    """Extract and validate the current user from the JWT bearer token."""
    payload = _auth.decode_access_token(token)
    email: str = payload.get("sub")
    if email is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return {"email": email}
