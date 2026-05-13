from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.db.session import Base, engine
from app.modules.auth.router import ensure_default_admin, router as auth_router
from app.modules.domains.router import router as domains_router
from app.modules.playback.router import router as playback_router
from app.modules.videos.router import router as videos_router
from app.db.session import SessionLocal

settings = get_settings()

app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[str(origin) for origin in settings.cors_origins],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup() -> None:
    settings.uploads_dir.mkdir(parents=True, exist_ok=True)
    settings.hls_dir.mkdir(parents=True, exist_ok=True)
    settings.thumbs_dir.mkdir(parents=True, exist_ok=True)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        ensure_default_admin(db)
    finally:
        db.close()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(auth_router, prefix="/api")
app.include_router(videos_router, prefix="/api")
app.include_router(domains_router, prefix="/api")
app.include_router(playback_router, prefix="/api")

