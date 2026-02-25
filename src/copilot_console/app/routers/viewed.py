"""API endpoints for session viewed timestamps."""

import time
from fastapi import APIRouter

from copilot_console.app.services.viewed_service import viewed_service
from copilot_console.app.services.logging_service import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/viewed", tags=["viewed"])


@router.get("")
async def get_viewed_timestamps() -> dict[str, float]:
    """Get all session viewed timestamps.
    
    Returns:
        Dict mapping session_id to Unix timestamp (seconds since epoch)
    """
    return viewed_service.get_all()


@router.post("/{session_id}")
async def mark_session_viewed(session_id: str, timestamp: float | None = None) -> dict:
    """Mark a session as viewed.
    
    Args:
        session_id: Session to mark as viewed
        timestamp: Optional Unix timestamp. If not provided, uses current time.
        
    Returns:
        {"session_id": str, "viewed_at": float}
    """
    ts = viewed_service.mark_viewed(session_id, timestamp)
    return {"session_id": session_id, "viewed_at": ts}
