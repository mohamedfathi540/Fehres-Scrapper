from sqlalchemy import Column, Integer, Date, UniqueConstraint, ForeignKey
from sqlalchemy.sql import func

from .minirag_base import SQLAlchemyBase


class UserUsageQuota(SQLAlchemyBase):
    """Tracks per-user, per-day usage counts for rate-limited actions.

    A new row is automatically created on the first request of each day;
    counts reset implicitly because the date changes at midnight.
    """

    __tablename__ = "user_usage_quotas"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False, index=True)
    date = Column(Date, nullable=False, server_default=func.current_date())

    # ── tracked actions ────────────────────────────────────────────────
    query_count = Column(Integer, default=0, server_default="0", nullable=False)
    scrape_count = Column(Integer, default=0, server_default="0", nullable=False)

    __table_args__ = (
        UniqueConstraint("user_id", "date", name="uq_user_usage_date"),
    )
