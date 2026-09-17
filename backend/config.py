"""Configuration management for VybeCod.ing Launch Ops."""

from decimal import Decimal
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict

# The placeholder older .env.example files suggested; never acceptable outside debug mode.
PLACEHOLDER_SECRET = "change-me-in-production"
MIN_JWT_SECRET_LENGTH = 32


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # App
    app_name: str = "VybeCod.ing Launch Ops"
    app_version: str = "1.0.0"
    # Debug mode: API docs at /docs, and a weak JWT_SECRET is tolerated. Never in production.
    debug: bool = False
    secret_key: str = ""  # unused; kept so existing .env files still load
    # Comma-separated origins allowed to call the API from another site. Empty: same origin only
    # (the production image serves the frontend itself; local dev uses the Vite proxy).
    cors_origins: str = ""

    # Anthropic
    anthropic_api_key: str = ""
    # Every operation uses claude_model, except the deep reports (market analysis, pricing).
    claude_model: str = "claude-sonnet-5"
    claude_report_model: str = "claude-opus-5"

    # PostgreSQL (Railway provides DATABASE_URL)
    database_url: str = ""

    # Auth: access tokens are short-lived; a rotating refresh token in an HttpOnly cookie renews them
    jwt_secret: str = ""
    access_token_minutes: int = 15
    refresh_token_days: int = 30
    # The first account becomes the platform admin. When set, only this address can create it.
    admin_email: str = ""

    # Email LaunchOps sends itself (password resets, invitations). Unset: nothing is emailed.
    app_url: str = ""  # e.g. https://launchops.run, for links in emails
    mail_smtp_host: str = ""
    mail_smtp_port: int = 587
    mail_smtp_user: str = ""
    mail_smtp_password: str = ""
    mail_from_email: str = ""
    mail_from_name: str = "LaunchOps"
    mail_use_tls: bool = True

    # Fernet key(s) for secrets stored in the database (see services/field_crypto.py)
    field_encryption_key: str = ""

    # Background jobs (services/jobs.py): the worker runs inside the web process unless disabled,
    # e.g. when a separate service runs `python -m worker`
    worker_enabled: bool = True
    worker_concurrency: int = 3
    job_timeout_minutes: float = 15

    # Limits
    rate_limit_enabled: bool = True
    ai_operations_per_hour: int = 60
    max_concurrent_tasks: int = 5
    max_emails_per_day: int = 20
    # Applies to any organisation that has not set a budget of its own, so a self-registered
    # account cannot spend without limit on the deployment's API key. 0 means no default cap.
    default_monthly_ai_budget_usd: Decimal = Decimal(25)


def check_startup_settings(settings: Settings) -> None:
    """Refuse to run outside debug mode with settings that would make the deployment unsafe."""
    if settings.debug:
        return
    secret = settings.jwt_secret
    if secret == PLACEHOLDER_SECRET or len(secret) < MIN_JWT_SECRET_LENGTH:
        raise RuntimeError(
            f"JWT_SECRET must be a random value of at least {MIN_JWT_SECRET_LENGTH} characters. "
            'Generate one with: python -c "import secrets; print(secrets.token_urlsafe(48))"'
        )


@lru_cache
def get_settings() -> Settings:
    """Cached settings singleton."""
    return Settings()
