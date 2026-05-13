import shutil
import uuid
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import create_playback_token
from app.db.models import EncodingJob, User, Video, VideoStatus
from app.db.session import get_db
from app.modules.auth.router import get_current_user
from app.workers.encoding import encode_video

router = APIRouter(prefix="/videos", tags=["videos"])


class VideoResponse(BaseModel):
    id: uuid.UUID
    title: str
    original_filename: str
    status: VideoStatus
    is_public: bool
    duration_seconds: int | None
    width: int | None
    height: int | None
    error_message: str | None
    playback_url: str | None

    model_config = {"from_attributes": True}


class VideoListResponse(BaseModel):
    items: list[VideoResponse]


class PlaybackLinkResponse(BaseModel):
    playback_url: str
    expires_in_seconds: int


def playback_url_for(video: Video) -> str:
    settings = get_settings()
    token = create_playback_token(video.id)
    return f"{settings.public_base_url}/api/playback/{video.id}/master.m3u8?token={token}"


def build_response(video: Video) -> VideoResponse:
    playback_url = None
    if video.status == VideoStatus.ready:
        playback_url = playback_url_for(video)
    return VideoResponse(
        id=uuid.UUID(video.id),
        title=video.title,
        original_filename=video.original_filename,
        status=video.status,
        is_public=video.is_public,
        duration_seconds=video.duration_seconds,
        width=video.width,
        height=video.height,
        error_message=video.error_message,
        playback_url=playback_url,
    )


@router.get("", response_model=VideoListResponse)
def list_videos(
    _user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> VideoListResponse:
    videos = db.scalars(select(Video).order_by(desc(Video.created_at))).all()
    return VideoListResponse(items=[build_response(video) for video in videos])


@router.post("", response_model=VideoResponse, status_code=status.HTTP_201_CREATED)
def upload_video(
    _user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    title: Annotated[str, Form()],
    file: Annotated[UploadFile, File()],
) -> VideoResponse:
    settings = get_settings()
    if not file.content_type or not file.content_type.startswith("video/"):
        raise HTTPException(status_code=400, detail="Only video uploads are allowed")

    video_id = str(uuid.uuid4())
    extension = Path(file.filename or "upload.mp4").suffix.lower() or ".mp4"
    safe_name = f"{video_id}{extension}"
    settings.uploads_dir.mkdir(parents=True, exist_ok=True)
    source_path = settings.uploads_dir / safe_name

    max_bytes = settings.upload_max_mb * 1024 * 1024
    written = 0
    with source_path.open("wb") as out:
        while chunk := file.file.read(1024 * 1024):
            written += len(chunk)
            if written > max_bytes:
                source_path.unlink(missing_ok=True)
                raise HTTPException(status_code=413, detail="Upload is larger than allowed")
            out.write(chunk)

    video = Video(
        id=video_id,
        title=title,
        original_filename=file.filename or safe_name,
        source_path=str(source_path),
    )
    db.add(video)
    db.add(EncodingJob(video_id=video.id))
    db.commit()
    db.refresh(video)

    encode_video.delay(str(video.id))
    return build_response(video)


@router.get("/{video_id}", response_model=VideoResponse)
def get_video(
    video_id: uuid.UUID,
    _user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> VideoResponse:
    video = db.get(Video, str(video_id))
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    return build_response(video)


@router.post("/{video_id}/playback-link", response_model=PlaybackLinkResponse)
def create_video_playback_link(
    video_id: uuid.UUID,
    _user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> PlaybackLinkResponse:
    video = db.get(Video, str(video_id))
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    if video.status != VideoStatus.ready:
        raise HTTPException(status_code=409, detail="Video is not ready yet")
    settings = get_settings()
    return PlaybackLinkResponse(
        playback_url=playback_url_for(video),
        expires_in_seconds=settings.playback_token_seconds,
    )


@router.post("/{video_id}/reencode", response_model=VideoResponse)
def reencode_video(
    video_id: uuid.UUID,
    _user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> VideoResponse:
    video = db.get(Video, str(video_id))
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    if video.hls_path:
        shutil.rmtree(video.hls_path, ignore_errors=True)
    video.status = VideoStatus.uploaded
    video.error_message = None
    db.add(EncodingJob(video_id=video.id))
    db.commit()
    encode_video.delay(str(video.id))
    db.refresh(video)
    return build_response(video)
