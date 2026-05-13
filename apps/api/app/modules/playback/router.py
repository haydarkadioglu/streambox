import uuid
from pathlib import Path
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import decode_token
from app.db.models import DomainRule, DomainRuleType, Video, VideoStatus
from app.db.session import get_db

router = APIRouter(prefix="/playback", tags=["playback"])


def referrer_host(request: Request) -> str | None:
    referrer = request.headers.get("referer") or request.headers.get("origin")
    if not referrer:
        return None
    return urlparse(referrer).netloc.lower()


def is_domain_allowed(db: Session, host: str | None) -> bool:
    active_rules = db.scalars(select(DomainRule).where(DomainRule.is_active.is_(True))).all()
    if not active_rules:
        return True
    if not host:
        return False
    blocked = {rule.domain for rule in active_rules if rule.rule_type == DomainRuleType.block}
    allowed = {rule.domain for rule in active_rules if rule.rule_type == DomainRuleType.allow}
    if any(host == domain or host.endswith(f".{domain}") for domain in blocked):
        return False
    if allowed:
        return any(host == domain or host.endswith(f".{domain}") for domain in allowed)
    return True


def resolve_segment(video: Video, filename: str) -> Path:
    if not video.hls_path:
        raise HTTPException(status_code=404, detail="Stream is not ready")
    base = Path(video.hls_path).resolve()
    target = (base / filename).resolve()
    if base not in target.parents and target != base:
        raise HTTPException(status_code=400, detail="Invalid segment path")
    if not target.exists():
        raise HTTPException(status_code=404, detail="Segment not found")
    return target


def playlist_with_token(path: Path, token: str) -> Response:
    lines = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if line and not line.startswith("#") and "://" not in line:
            separator = "&" if "?" in line else "?"
            lines.append(f"{line}{separator}token={token}")
        else:
            lines.append(line)
    return Response("\n".join(lines) + "\n", media_type="application/vnd.apple.mpegurl")


@router.get("/{video_id}/{filename:path}", response_model=None)
def serve_hls(
    video_id: uuid.UUID,
    filename: str,
    token: str,
    request: Request,
    db: Session = Depends(get_db),
) -> Response:
    payload = decode_token(token)
    if not payload or payload.get("type") != "playback" or payload.get("sub") != str(video_id):
        raise HTTPException(status_code=401, detail="Invalid playback token")
    if not is_domain_allowed(db, referrer_host(request)):
        raise HTTPException(status_code=403, detail="Domain is not allowed")
    video = db.get(Video, str(video_id))
    if not video or video.status != VideoStatus.ready:
        raise HTTPException(status_code=404, detail="Stream is not ready")
    path = resolve_segment(video, filename)
    if path.suffix == ".m3u8":
        return playlist_with_token(path, token)
    media_type = "video/mp2t"
    return FileResponse(path, media_type=media_type)
