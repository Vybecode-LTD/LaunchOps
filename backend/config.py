"""Configuration management for VybeCod.ing Launch Ops."""

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # App
    app_name: str = "VybeCod.ing Launch Ops"
    app_version: str = "1.0.0"
    debug: bool = False
    secret_key: str = "change-me-in-production"
    cors_origins: str = "*"

    # Anthropic
    anthropic_api_key: str = ""
    claude_model: str = "claude-sonnet-4-20250514"

    # PostgreSQL (Railway provides DATABASE_URL)
    database_url: str = ""

    # Auth
    jwt_secret: str = "change-me-in-production"
    jwt_expiration_hours: int = 72

    # Rate limits
    max_concurrent_tasks: int = 5
    max_emails_per_day: int = 20

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    """Cached settings singleton."""
    return Settings()
