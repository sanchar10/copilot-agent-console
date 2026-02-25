"""MCP servers router - list available MCP servers and manage session selections."""

from fastapi import APIRouter

from copilot_console.app.models.mcp import MCPServer, MCPServerConfig
from copilot_console.app.services.mcp_service import mcp_service
from copilot_console.app.services.logging_service import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/mcp", tags=["mcp"])


@router.get("/servers", response_model=MCPServerConfig)
async def list_mcp_servers() -> MCPServerConfig:
    """Get all available MCP server configurations.
    
    Returns servers from:
    - Global config: ~/.copilot/mcp-config.json
    - Plugin configs: ~/.copilot/installed-plugins/copilot-plugins/[plugin]/.mcp.json
    """
    return mcp_service.get_available_servers()


@router.post("/servers/refresh", response_model=MCPServerConfig)
async def refresh_mcp_servers() -> MCPServerConfig:
    """Force refresh the MCP server cache from disk."""
    return mcp_service.refresh()
