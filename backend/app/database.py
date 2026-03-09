import certifi
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.config import settings

_client: AsyncIOMotorClient | None = None


async def connect_db() -> None:
    global _client
    _client = AsyncIOMotorClient(
        settings.MONGODB_URI,
        tlsCAFile=certifi.where(),
        serverSelectionTimeoutMS=10000,
    )
    # Ping to verify connection — non-fatal so the server can still start
    try:
        await _client.admin.command("ping")
        print(f"[DB] Connected to MongoDB at {settings.MONGODB_URI}")
    except Exception as exc:
        print(f"[DB] WARNING: MongoDB ping failed ({exc}). "
              "Server will start anyway — DB calls will fail until the connection is available.")


async def close_db() -> None:
    global _client
    if _client:
        _client.close()
        print("[DB] MongoDB connection closed")


def get_db() -> AsyncIOMotorDatabase:
    global _client
    # Lazy-init for serverless environments where lifespan may not have run
    if _client is None:
        _client = AsyncIOMotorClient(
            settings.MONGODB_URI,
            tlsCAFile=certifi.where(),
            serverSelectionTimeoutMS=10000,
        )
    return _client[settings.MONGODB_DB]
