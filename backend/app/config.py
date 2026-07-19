"""Environment-driven configuration. All values come from env vars — no secrets in code."""

from __future__ import annotations

from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str = Field(default="sqlite:///./garmin_coach.db")

    ollama_base_url: str = Field(default="http://localhost:11434")
    ollama_model: str = Field(default="qwen2.5")
    ollama_max_retries: int = Field(default=3)

    garmin_email: str = Field(default="")
    garmin_password: str = Field(default="")
    garmin_tokenstore: str = Field(default="./.garmin_tokens")

    @property
    def tokenstore_path(self) -> Path:
        return Path(self.garmin_tokenstore)


settings = Settings()
