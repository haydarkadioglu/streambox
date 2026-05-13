import enum
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from uuid import uuid4

from app.db.session import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def uuid_string() -> str:
    return str(uuid4())


class UserRole(str, enum.Enum):
    admin = "admin"


class VideoStatus(str, enum.Enum):
    uploaded = "uploaded"
    processing = "processing"
    ready = "ready"
    failed = "failed"


class DomainRuleType(str, enum.Enum):
    allow = "allow"
    block = "block"


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_string)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), default=UserRole.admin)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Video(Base):
    __tablename__ = "videos"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_string)
    title: Mapped[str] = mapped_column(String(255))
    original_filename: Mapped[str] = mapped_column(String(255))
    source_path: Mapped[str] = mapped_column(Text)
    hls_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    thumbnail_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[VideoStatus] = mapped_column(Enum(VideoStatus), default=VideoStatus.uploaded)
    duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    width: Mapped[int | None] = mapped_column(Integer, nullable=True)
    height: Mapped[int | None] = mapped_column(Integer, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_public: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )
    jobs: Mapped[list["EncodingJob"]] = relationship(back_populates="video", cascade="all,delete")


class EncodingJob(Base):
    __tablename__ = "encoding_jobs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_string)
    video_id: Mapped[str] = mapped_column(ForeignKey("videos.id", ondelete="CASCADE"))
    status: Mapped[VideoStatus] = mapped_column(Enum(VideoStatus), default=VideoStatus.uploaded)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )
    video: Mapped[Video] = relationship(back_populates="jobs")


class DomainRule(Base):
    __tablename__ = "domain_rules"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_string)
    domain: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    rule_type: Mapped[DomainRuleType] = mapped_column(Enum(DomainRuleType))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
