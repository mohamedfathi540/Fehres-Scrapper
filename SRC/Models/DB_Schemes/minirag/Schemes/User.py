from .minirag_base import SQLAlchemyBase
from sqlalchemy import Column, Integer, String, Boolean, DateTime, func
from sqlalchemy.dialects.postgresql import UUID
import uuid


class User(SQLAlchemyBase):
    __tablename__ = "users"

    user_id = Column(Integer, primary_key=True, autoincrement=True)
    user_uuid = Column(UUID(as_uuid=True), default=uuid.uuid4, unique=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    verification_token = Column(String, nullable=True)

    create_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    update_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now(), nullable=False)
