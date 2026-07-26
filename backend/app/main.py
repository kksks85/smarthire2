import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.background import BackgroundScheduler

from app.api.v1.router import api_router
from app.core.config import settings
from app.services.cleanup import cleanup_old_location_logs

logging.basicConfig(level=logging.INFO)

# Initialize scheduler globally
scheduler = BackgroundScheduler()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage app startup and shutdown events."""
    # Startup
    scheduler.add_job(
        cleanup_old_location_logs,
        "interval",
        hours=24,
        id="cleanup_old_location_logs",
        replace_existing=True,
        kwargs={"retention_days": 7},
    )
    scheduler.start()
    logger.info("Started scheduled cleanup task for old location logs (7-day retention)")
    
    yield
    
    # Shutdown
    scheduler.shutdown()
    logger.info("Scheduler shut down")


app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_PREFIX}/openapi.json",
    docs_url="/docs",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_PREFIX)


@app.get("/health", tags=["health"])
def health():
    return {"status": "ok", "app": settings.PROJECT_NAME}
