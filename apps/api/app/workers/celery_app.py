from celery import Celery

from app.core.config import get_settings

settings = get_settings()

celery_app = Celery(
    "streambox",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=["app.workers.encoding"],
)

celery_app.conf.update(
    task_track_started=True,
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    worker_prefetch_multiplier=1,
    task_always_eager=settings.celery_task_always_eager,
    task_eager_propagates=False,
)
