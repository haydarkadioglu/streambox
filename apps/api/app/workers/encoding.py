import json
import shutil
import subprocess
from pathlib import Path

from sqlalchemy import select

from app.core.config import get_settings
from app.db.models import EncodingJob, Video, VideoStatus
from app.db.session import SessionLocal
from app.workers.celery_app import celery_app


def run_command(command: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(command, capture_output=True, check=True, text=True)


def probe_video(source: str) -> dict[str, int | None]:
    command = [
        "ffprobe",
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-show_entries",
        "stream=width,height:format=duration",
        "-of",
        "json",
        source,
    ]
    result = run_command(command)
    data = json.loads(result.stdout)
    stream = (data.get("streams") or [{}])[0]
    duration = data.get("format", {}).get("duration")
    return {
        "width": stream.get("width"),
        "height": stream.get("height"),
        "duration_seconds": int(float(duration)) if duration else None,
    }


def encode_hls(source: str, output_dir: Path) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    master = output_dir / "master.m3u8"
    segment_pattern = output_dir / "segment_%05d.ts"
    command = [
        "ffmpeg",
        "-y",
        "-i",
        source,
        "-vf",
        "scale='min(1280,iw)':-2",
        "-c:v",
        "h264",
        "-preset",
        "veryfast",
        "-crf",
        "23",
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        "-hls_time",
        "6",
        "-hls_playlist_type",
        "vod",
        "-hls_segment_filename",
        str(segment_pattern),
        str(master),
    ]
    run_command(command)


def create_thumbnail(source: str, output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    command = [
        "ffmpeg",
        "-y",
        "-ss",
        "00:00:01",
        "-i",
        source,
        "-frames:v",
        "1",
        "-vf",
        "scale=640:-2",
        str(output_path),
    ]
    run_command(command)


@celery_app.task(bind=True, autoretry_for=(subprocess.CalledProcessError,), retry_backoff=True, max_retries=2)
def encode_video(self, video_id: str) -> None:
    settings = get_settings()
    db = SessionLocal()
    try:
        video = db.get(Video, video_id)
        if not video:
            return
        job = db.scalar(
            select(EncodingJob)
            .where(EncodingJob.video_id == video.id)
            .order_by(EncodingJob.created_at.desc())
        )
        video.status = VideoStatus.processing
        if job:
            job.status = VideoStatus.processing
            job.attempts += 1
        db.commit()

        output_dir = settings.hls_dir / str(video.id)
        if output_dir.exists():
            shutil.rmtree(output_dir)
        thumb_path = settings.thumbs_dir / f"{video.id}.jpg"

        metadata = probe_video(video.source_path)
        encode_hls(video.source_path, output_dir)
        create_thumbnail(video.source_path, thumb_path)

        video.hls_path = str(output_dir)
        video.thumbnail_path = str(thumb_path)
        video.duration_seconds = metadata["duration_seconds"]
        video.width = metadata["width"]
        video.height = metadata["height"]
        video.status = VideoStatus.ready
        video.error_message = None
        if job:
            job.status = VideoStatus.ready
            job.error_message = None
        db.commit()
    except Exception as exc:
        db.rollback()
        video = db.get(Video, video_id)
        if video:
            video.status = VideoStatus.failed
            video.error_message = str(exc)
        job = db.scalar(
            select(EncodingJob)
            .where(EncodingJob.video_id == video_id)
            .order_by(EncodingJob.created_at.desc())
        )
        if job:
            job.status = VideoStatus.failed
            job.error_message = str(exc)
        db.commit()
        raise
    finally:
        db.close()
