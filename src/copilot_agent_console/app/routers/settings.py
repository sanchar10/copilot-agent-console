"""Settings router - user preferences and update checks."""

import os

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from copilot_agent_console.app.services.storage_service import storage_service

router = APIRouter(prefix="/settings", tags=["settings"])


class SettingsUpdate(BaseModel):
    default_model: str | None = None
    default_cwd: str | None = None


@router.get("")
async def get_settings() -> dict:
    """Get user settings."""
    return storage_service.get_settings()


@router.patch("")
async def update_settings(request: SettingsUpdate) -> dict:
    """Update user settings."""
    updates = {}
    if request.default_model is not None:
        updates["default_model"] = request.default_model
    if request.default_cwd is not None:
        # Validate CWD path exists
        if not os.path.isdir(request.default_cwd):
            raise HTTPException(
                status_code=400,
                detail=f"Directory does not exist: {request.default_cwd}"
            )
        updates["default_cwd"] = request.default_cwd
    return storage_service.update_settings(updates)


@router.get("/update-check")
async def check_for_update() -> dict:
    """Check GitHub releases for a newer version."""
    import httpx
    from copilot_agent_console import __version__

    repo = "sanchar10/copilot-agent-console"
    url = f"https://api.github.com/repos/{repo}/releases/latest"

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(url, headers={"Accept": "application/vnd.github.v3+json"})
            if resp.status_code == 404:
                return {"update_available": False, "current_version": __version__}
            resp.raise_for_status()
            data = resp.json()

        latest_tag = data.get("tag_name", "")
        latest_version = latest_tag.lstrip("v")

        # Find the wheel asset URL
        wheel_url = None
        for asset in data.get("assets", []):
            if asset["name"].endswith(".whl"):
                wheel_url = asset["browser_download_url"]
                break

        update_available = latest_version != __version__ and latest_version > __version__

        return {
            "update_available": update_available,
            "current_version": __version__,
            "latest_version": latest_version,
            "wheel_url": wheel_url,
            "release_url": data.get("html_url", ""),
        }
    except Exception:
        return {"update_available": False, "current_version": __version__}
