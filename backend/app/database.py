from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.config import settings

_client: AsyncIOMotorClient | None = None


async def connect_db() -> None:
    global _client
    _client = AsyncIOMotorClient(settings.MONGODB_URI)
    # Ping to verify connection
    await _client.admin.command("ping")
    print(f"[DB] Connected to MongoDB at {settings.MONGODB_URI}")


async def close_db() -> None:
    global _client
    if _client:
        _client.close()
        print("[DB] MongoDB connection closed")


def get_db() -> AsyncIOMotorDatabase:
    if _client is None:
        raise RuntimeError("Database not initialised. Call connect_db() first.")
    return _client[settings.MONGODB_DB]
