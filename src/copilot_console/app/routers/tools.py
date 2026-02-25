"""Local Tools API router."""

from fastapi import APIRouter, HTTPException

from copilot_console.app.models.tools import ToolInfo, ToolsConfig
from copilot_console.app.services.tools_service import get_tools_service

router = APIRouter(prefix="/tools", tags=["tools"])


@router.get("", response_model=ToolsConfig)
async def get_tools() -> ToolsConfig:
    """Get all available tools."""
    service = get_tools_service()
    return service.get_tools_config()


@router.get("/{name}", response_model=ToolInfo)
async def get_tool(name: str) -> ToolInfo:
    """Get a specific tool by name."""
    service = get_tools_service()
    tool = service.get_tool(name)
    
    if not tool:
        raise HTTPException(status_code=404, detail=f"Tool '{name}' not found")
    
    return tool


@router.post("/refresh", response_model=ToolsConfig)
async def refresh_tools() -> ToolsConfig:
    """Force refresh tools from disk."""
    service = get_tools_service()
    return service.refresh()
