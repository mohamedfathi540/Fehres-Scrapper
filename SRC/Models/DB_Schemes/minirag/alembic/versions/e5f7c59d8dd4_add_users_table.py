"""add users table

Revision ID: e5f7c59d8dd4
Revises: 64f72e17dc2d
Create Date: 2026-03-10 16:50:18.714717

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'e5f7c59d8dd4'
down_revision: Union[str, None] = '64f72e17dc2d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('users',
    sa.Column('user_id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('user_uuid', sa.UUID(), nullable=False),
    sa.Column('email', sa.String(), nullable=False),
    sa.Column('hashed_password', sa.String(), nullable=False),
    sa.Column('is_active', sa.Boolean(), nullable=True),
    sa.Column('is_verified', sa.Boolean(), nullable=True),
    sa.Column('verification_token', sa.String(), nullable=True),
    sa.Column('create_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('update_at', sa.DateTime(timezone=True), nullable=False),
    sa.PrimaryKeyConstraint('user_id'),
    sa.UniqueConstraint('user_uuid')
    )
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.drop_table('users')
