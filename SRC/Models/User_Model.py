from .Base_DataModel import BaseDataModel
from .DB_Schemes.minirag.Schemes.User import User
from sqlalchemy.future import select


class UserModel(BaseDataModel):

    def __init__(self, db_client):
        super().__init__(db_client)

    @classmethod
    async def create_instance(cls, db_client: object):
        return cls(db_client)

    async def get_user_by_email(self, email: str) -> User | None:
        async with self.db_client() as session:
            async with session.begin():
                result = await session.execute(
                    select(User).where(User.email == email)
                )
                return result.scalar_one_or_none()

    async def get_user_by_verification_token(self, token: str) -> User | None:
        async with self.db_client() as session:
            async with session.begin():
                result = await session.execute(
                    select(User).where(User.verification_token == token)
                )
                return result.scalar_one_or_none()

    async def create_user(self, user: User) -> User:
        async with self.db_client() as session:
            async with session.begin():
                session.add(user)
            await session.commit()
            await session.refresh(user)
        return user

    async def verify_user(self, user_id: int) -> None:
        async with self.db_client() as session:
            async with session.begin():
                result = await session.execute(
                    select(User).where(User.user_id == user_id)
                )
                user = result.scalar_one_or_none()
                if user:
                    user.is_verified = True
                    user.verification_token = None
            await session.commit()

    async def update_verification_token(self, user_id: int, token: str) -> None:
        async with self.db_client() as session:
            async with session.begin():
                result = await session.execute(
                    select(User).where(User.user_id == user_id)
                )
                user = result.scalar_one_or_none()
                if user:
                    user.verification_token = token
            await session.commit()

    async def delete_user(self, user_id: int) -> bool:
        async with self.db_client() as session:
            async with session.begin():
                result = await session.execute(
                    select(User).where(User.user_id == user_id)
                )
                user = result.scalar_one_or_none()
                if not user:
                    return False
                await session.delete(user)
            await session.commit()
            return True
