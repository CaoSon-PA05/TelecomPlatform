"""
Application configuration — all settings are read from environment variables.
Copy .env.example → .env and fill in values before running.

Usage:
    from backend.app.core.config import settings
    print(settings.DATABASE_URL)
"""

from __future__ import annotations

import os
from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # ------------------------------------------------------------------
    # Application identity
    # ------------------------------------------------------------------
    APP_TITLE: str = "Sentinel CDR Analytics API"
    APP_DESCRIPTION: str = (
        "Enterprise telecom analytics backend — "
        "CDR parsing, subscriber analysis, and cross-file forensics."
    )
    APP_VERSION: str = "0.1.0"
    ENV: Literal["development", "testing", "production"] = "development"
    DEBUG: bool = True

    # ------------------------------------------------------------------
    # API routing
    # ------------------------------------------------------------------
    API_V1_PREFIX: str = "/api/v1"

    # ------------------------------------------------------------------
    # Database
    # ------------------------------------------------------------------
    DATABASE_URL: str = Field(
        default="sqlite:///./telecom.db",
        description="SQLAlchemy connection string. SQLite for dev, PostgreSQL for prod.",
    )
    DB_ECHO_SQL: bool = False   # set True to log every SQL statement
    DB_POOL_SIZE: int = 5
    DB_MAX_OVERFLOW: int = 10

    # ------------------------------------------------------------------
    # CORS
    # ------------------------------------------------------------------
    CORS_ORIGINS: list[str] = [
        "http://localhost:5500",
        "http://127.0.0.1:5500",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]
    CORS_ALLOW_CREDENTIALS: bool = True

    # ------------------------------------------------------------------
    # File uploads
    # ------------------------------------------------------------------
    MAX_UPLOAD_SIZE_MB: int = 50
    UPLOAD_DIR: str = "./uploads"

    # ------------------------------------------------------------------
    # Logging
    # ------------------------------------------------------------------
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: Literal["json", "text"] = "text"   # json for prod, text for dev

    # ------------------------------------------------------------------
    # Pagination defaults
    # ------------------------------------------------------------------
    DEFAULT_PAGE_SIZE: int = 50
    MAX_PAGE_SIZE: int = 500

    # ------------------------------------------------------------------
    # Computed helpers
    # ------------------------------------------------------------------

    @property
    def is_development(self) -> bool:
        return self.ENV == "development"

    @property
    def is_production(self) -> bool:
        return self.ENV == "production"

    @property
    def is_testing(self) -> bool:
        return self.ENV == "testing"

    @property
    def docs_url(self) -> str | None:
        return "/docs" if not self.is_production else None

    @property
    def redoc_url(self) -> str | None:
        return "/redoc" if not self.is_production else None

    @property
    def max_upload_bytes(self) -> int:
        return self.MAX_UPLOAD_SIZE_MB * 1024 * 1024

    @field_validator("LOG_LEVEL")
    @classmethod
    def validate_log_level(cls, v: str) -> str:
        valid = {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}
        upper = v.upper()
        if upper not in valid:
            raise ValueError(f"LOG_LEVEL must be one of {valid}")
        return upper


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Cached settings instance — import this in application code."""
    return Settings()


settings: Settings = get_settings()
