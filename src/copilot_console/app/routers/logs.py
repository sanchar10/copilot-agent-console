"""Logs API endpoints."""

from typing import Optional

from fastapi import APIRouter, Query

from copilot_console.app.services.logging_service import (
    read_session_logs,
    read_ralph_logs,
    read_server_logs,
)

router = APIRouter(prefix="/logs", tags=["logs"])


@router.get("/server")
async def get_server_logs(
    tail: int = Query(default=100, ge=1, le=10000, description="Number of lines to return")
) -> dict:
    """Get recent server logs."""
    lines = read_server_logs(tail=tail)
    return {
        "lines": lines,
        "count": len(lines),
    }


@router.get("/sessions/{session_id}")
async def get_session_logs(
    session_id: str,
    tail: Optional[int] = Query(default=None, ge=1, le=10000, description="Number of lines to return"),
    level: Optional[str] = Query(default=None, description="Filter by log level (INFO, WARNING, ERROR)")
) -> dict:
    """Get logs for a specific session."""
    lines = read_session_logs(session_id, tail=tail, level=level)
    return {
        "session_id": session_id,
        "lines": lines,
        "count": len(lines),
    }


@router.get("/ralph/{run_id}")
async def get_ralph_logs(
    run_id: str,
    tail: Optional[int] = Query(default=None, ge=1, le=10000, description="Number of lines to return")
) -> dict:
    """Get logs for a specific Ralph run."""
    lines = read_ralph_logs(run_id, tail=tail)
    return {
        "run_id": run_id,
        "lines": lines,
        "count": len(lines),
    }
