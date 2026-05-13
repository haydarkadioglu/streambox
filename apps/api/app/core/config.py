from functools import lru_cache
from pathlib import Path

from pydantic import AnyHttpUrl, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "StreamBox"
    environment: str = "local"
    database_url: str = "sqlite:///./stream-local.db"
    redis_url: str = "memory://"
    celery_task_always_eager: bool = True
    jwt_secret: str = "change-me-before-production"
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 60
    playback_token_seconds: int = 300
    admin_email: str = "admin@example.com"
    admin_password: str = "admin12345"
    cors_origins: list[AnyHttpUrl] | list[str] = Field(default_factory=lambda: ["http://localhost:5173"])
    storage_root: Path = Path("./storage")
    upload_max_mb: int = 2048
    public_base_url: str = "http://localhost:8000"

    model_config = SettingsConfigDict(
        env_file=(".env", "../../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def uploads_dir(self) -> Path:
        return self.storage_root / "uploads"

    @property
    def hls_dir(self) -> Path:
        return self.storage_root / "hls"

    @property
    def thumbs_dir(self) -> Path:
        return self.storage_root / "thumbs"


@lru_cache
def get_settings() -> Settings:
    return Settings()
