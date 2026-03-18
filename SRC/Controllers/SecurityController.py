"""SecurityController — FastAPI dependency for per-user daily quota enforcement.

Usage in a route:
    from Controllers.SecurityController import require_quota

    @router.post("/search")
    async def search(request: Request, user=Depends(require_quota("query"))):
        ...

Action keys  → DB column   → settings field
  "query"    → query_count → QUOTA_DAILY_QUERIES
  "scrape"   → scrape_count→ QUOTA_DAILY_SCRAPES
"""

from datetime import date

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.future import select

from Controllers.AuthController import get_current_user
from Helpers.Config import get_settings
from Models.DB_Schemes.minirag.Schemes.User import User
from Models.DB_Schemes.minirag.Schemes.UserUsageQuota import UserUsageQuota

# Maps action name → (DB column name, settings field name)
_ACTION_MAP: dict[str, tuple[str, str]] = {
    "query": ("query_count", "QUOTA_DAILY_QUERIES"),
    "scrape": ("scrape_count", "QUOTA_DAILY_SCRAPES"),
}


def require_quota(action: str):
    """Return a FastAPI dependency that enforces the daily quota for *action*.

    If the configured limit is 0 (default) the check is skipped entirely,
    effectively making the action unlimited.

    On success the dependency returns an enriched user dict:
        {"email": str, "user_id": int}
    """
    if action not in _ACTION_MAP:
        raise ValueError(f"Unknown quota action '{action}'. Valid: {list(_ACTION_MAP)}")

    count_field, setting_name = _ACTION_MAP[action]

    async def _check_quota(
        request: Request,
        current_user: dict = Depends(get_current_user),
    ) -> dict:
        settings = get_settings()
        limit: int = getattr(settings, setting_name, 0)

        # Fetch the User ORM row so we have the integer user_id
        async with request.app.db_client() as session:
            result = await session.execute(
                select(User).where(User.email == current_user["email"])
            )
            db_user: User | None = result.scalar_one_or_none()

        if db_user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found",
            )

        # Skip enforcement when limit is 0 (unlimited)
        if limit <= 0:
            return {**current_user, "user_id": db_user.user_id}

        today = date.today()

        async with request.app.db_client() as session:
            # Get or create today's quota record
            result = await session.execute(
                select(UserUsageQuota).where(
                    UserUsageQuota.user_id == db_user.user_id,
                    UserUsageQuota.date == today,
                )
            )
            quota: UserUsageQuota | None = result.scalar_one_or_none()

            if quota is None:
                quota = UserUsageQuota(user_id=db_user.user_id, date=today)
                session.add(quota)
                await session.flush()

            current_count: int = getattr(quota, count_field)

            # Enforce the limit
            if current_count >= limit:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=(
                        f"Daily {action} quota exceeded "
                        f"({current_count}/{limit}). Resets at midnight."
                    ),
                )

            # Increment and persist
            setattr(quota, count_field, current_count + 1)
            await session.commit()

        return {**current_user, "user_id": db_user.user_id}

    return _check_quota
