from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # MongoDB
    MONGODB_URI: str = "mongodb://localhost:27017"
    MONGODB_DB: str = "testgen_suite"

    # Gemini AI
    GEMINI_API_KEY: str = ""

    # App
    APP_ENV: str = "development"
    CORS_ORIGINS: list[str] = ["http://localhost:8080", "http://localhost:5173"]


settings = Settings()
