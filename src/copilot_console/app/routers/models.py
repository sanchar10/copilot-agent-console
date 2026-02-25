"""Models router - LLM model listing."""

from fastapi import APIRouter

from copilot_console.app.services.copilot_service import copilot_service

router = APIRouter(prefix="/models", tags=["models"])


@router.get("")
async def list_models() -> dict:
    """Get list of available LLM models from SDK."""
    models = await copilot_service.get_models()
    # models is list of {"id": "...", "name": "..."}
    return {"models": models}
