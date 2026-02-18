"""FastAPI application entry point."""

import logging
import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from copilot_agent_console.app.config import API_PREFIX, ensure_directories
from copilot_agent_console.app.routers import agents, filesystem, logs, mcp, models, ralph, schedules, sessions, settings, tools, task_runs, viewed
from copilot_agent_console.app.services.copilot_service import copilot_service
from copilot_agent_console.app.services.response_buffer import response_buffer_manager
from copilot_agent_console.app.services.task_runner_service import TaskRunnerService
from copilot_agent_console.app.services.scheduler_service import SchedulerService
from copilot_agent_console.app.services.logging_service import setup_logging, get_logger

# Configure logging with session-aware file logging (DEBUG level for comprehensive event logging)
setup_logging(level=logging.DEBUG)
logger = get_logger(__name__)

# Static files directory (bundled frontend)
STATIC_DIR = Path(__file__).parent.parent / "static"


def _set_sleep_prevention(enable: bool) -> None:
    """Enable or disable Windows sleep prevention via SetThreadExecutionState."""
    if sys.platform != "win32":
        return
    try:
        import ctypes
        ES_CONTINUOUS = 0x80000000
        ES_SYSTEM_REQUIRED = 0x00000001
        if enable:
            ctypes.windll.kernel32.SetThreadExecutionState(ES_CONTINUOUS | ES_SYSTEM_REQUIRED)
            logger.info("Sleep prevention enabled — Windows will not idle-sleep")
        else:
            ctypes.windll.kernel32.SetThreadExecutionState(ES_CONTINUOUS)
            logger.info("Sleep prevention cleared — normal sleep behavior restored")
    except Exception as e:
        logger.warning(f"Failed to set sleep prevention: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan - startup and shutdown."""
    # Startup
    logger.info("Starting Copilot Agent Console...")
    ensure_directories()
    # Pre-start main SDK client for reliable operation
    await copilot_service._start_main_client()
    # Start buffer cleanup task
    response_buffer_manager.start_cleanup_task()
    # Start task runner and scheduler
    task_runner = TaskRunnerService(copilot_service, response_buffer_manager)
    scheduler = SchedulerService(task_runner)
    scheduler.start()
    # Store on app state for access from routers
    app.state.task_runner = task_runner
    app.state.scheduler = scheduler
    # Enable sleep prevention if --no-sleep flag was passed
    no_sleep = os.environ.get("COPILOT_NO_SLEEP") == "1"
    if no_sleep:
        _set_sleep_prevention(True)
    logger.info("Copilot Agent Console started successfully")
    yield
    # Shutdown
    logger.info("Shutting down Copilot Agent Console...")
    if no_sleep:
        _set_sleep_prevention(False)
    scheduler.shutdown()
    await copilot_service.stop()


app = FastAPI(
    title="Copilot Agent Console API",
    description="Backend API for Copilot Agent Console - A beautiful web UI for GitHub Copilot",
    version="0.2.0",
    lifespan=lifespan,
)

# CORS configuration for frontend dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(agents.router, prefix=API_PREFIX)
app.include_router(filesystem.router, prefix=API_PREFIX)
app.include_router(logs.router, prefix=API_PREFIX)
app.include_router(mcp.router, prefix=API_PREFIX)
app.include_router(models.router, prefix=API_PREFIX)
app.include_router(ralph.router, prefix=API_PREFIX)
app.include_router(schedules.router, prefix=API_PREFIX)
app.include_router(sessions.router, prefix=API_PREFIX)
app.include_router(settings.router, prefix=API_PREFIX)
app.include_router(tools.router, prefix=API_PREFIX)
app.include_router(task_runs.router, prefix=API_PREFIX)
app.include_router(viewed.router, prefix=API_PREFIX)


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok"}


# Serve static files (built frontend) if available
if STATIC_DIR.exists():
    # Serve index.html for SPA routes
    @app.get("/")
    async def serve_root():
        return FileResponse(STATIC_DIR / "index.html")
    
    # Serve static assets
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")
    
    # Catch-all for SPA routing (must be last)
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # If it's an API route, let it 404 naturally
        if full_path.startswith("api/"):
            return {"error": "Not found"}
        # Otherwise serve index.html for SPA routing
        file_path = STATIC_DIR / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(STATIC_DIR / "index.html")
