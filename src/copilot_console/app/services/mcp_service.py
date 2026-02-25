"""MCP Server configuration service.

Reads MCP server configurations from three sources:
1. Global config: ~/.copilot/mcp-config.json (shared with CLI)
2. Plugin configs: ~/.copilot/installed-plugins/copilot-plugins/[plugin]/.mcp.json
3. Agent-only config: ~/.copilot-console/mcp-config.json (only visible to this app)
"""

import json
from pathlib import Path

from copilot_console.app.config import APP_HOME
from copilot_console.app.models.mcp import MCPServer, MCPServerConfig
from copilot_console.app.services.logging_service import get_logger

logger = get_logger(__name__)

# Paths for MCP configuration
COPILOT_HOME = Path.home() / ".copilot"
GLOBAL_MCP_CONFIG = COPILOT_HOME / "mcp-config.json"
PLUGINS_DIR = COPILOT_HOME / "installed-plugins" / "copilot-plugins"
AGENT_ONLY_MCP_CONFIG = APP_HOME / "mcp-config.json"


class MCPService:
    """Service to discover and manage MCP server configurations."""

    def __init__(self) -> None:
        self._cached_config: MCPServerConfig | None = None
        self._cache_mtime: float = 0.0

    def _should_refresh_cache(self) -> bool:
        """Check if cache needs refresh based on file modification times."""
        if self._cached_config is None:
            return True
        
        # Check global config mtime
        if GLOBAL_MCP_CONFIG.exists():
            mtime = GLOBAL_MCP_CONFIG.stat().st_mtime
            if mtime > self._cache_mtime:
                return True
        
        # Check plugins directory mtime
        if PLUGINS_DIR.exists():
            mtime = PLUGINS_DIR.stat().st_mtime
            if mtime > self._cache_mtime:
                return True
        
        # Check agent-only config mtime
        if AGENT_ONLY_MCP_CONFIG.exists():
            mtime = AGENT_ONLY_MCP_CONFIG.stat().st_mtime
            if mtime > self._cache_mtime:
                return True
        
        return False

    def _parse_mcp_servers_from_json(
        self, data: dict, source: str
    ) -> list[MCPServer]:
        """Parse mcpServers from JSON config data.
        
        Supports both local (command-based) and remote (url-based) servers.
        """
        servers: list[MCPServer] = []
        
        mcp_servers = data.get("mcpServers", {})
        if not isinstance(mcp_servers, dict):
            return servers
        
        for name, config in mcp_servers.items():
            if not isinstance(config, dict):
                continue
            
            try:
                server_type = config.get("type")
                tools = config.get("tools", ["*"])
                timeout = config.get("timeout")
                
                # Determine if this is a remote server (http/sse)
                is_remote = server_type in ("http", "sse") or "url" in config
                
                if is_remote:
                    url = config.get("url", "")
                    if not url:
                        logger.warning(f"Remote MCP server '{name}' has no url, skipping")
                        continue
                    server = MCPServer(
                        name=name,
                        type=server_type,
                        url=url,
                        headers=config.get("headers"),
                        tools=tools if isinstance(tools, list) else [str(tools)],
                        timeout=timeout,
                        enabled=True,
                        source=source,
                    )
                else:
                    command = config.get("command", "")
                    if not command:
                        logger.warning(f"MCP server '{name}' has no command, skipping")
                        continue
                    args = config.get("args", [])
                    server = MCPServer(
                        name=name,
                        type=server_type,
                        command=command,
                        args=args if isinstance(args, list) else [str(args)],
                        env=config.get("env"),
                        cwd=config.get("cwd"),
                        tools=tools if isinstance(tools, list) else [str(tools)],
                        timeout=timeout,
                        enabled=True,
                        source=source,
                    )
                
                servers.append(server)
                logger.info(f"Loaded MCP server: {name} (type={server_type}) from {source}")
            except Exception as e:
                logger.warning(f"Failed to parse MCP server '{name}': {e}")
        
        return servers

    def _load_global_config(self) -> list[MCPServer]:
        """Load MCP servers from global config file."""
        if not GLOBAL_MCP_CONFIG.exists():
            logger.info(f"Global MCP config not found: {GLOBAL_MCP_CONFIG}")
            return []
        
        try:
            data = json.loads(GLOBAL_MCP_CONFIG.read_text(encoding="utf-8"))
            return self._parse_mcp_servers_from_json(data, "global")
        except json.JSONDecodeError as e:
            logger.warning(f"Failed to parse global MCP config: {e}")
            return []
        except Exception as e:
            logger.error(f"Error reading global MCP config: {e}")
            return []

    def _load_plugin_configs(self) -> list[MCPServer]:
        """Load MCP servers from all plugin .mcp.json files."""
        servers: list[MCPServer] = []
        
        if not PLUGINS_DIR.exists():
            logger.info(f"Plugins directory not found: {PLUGINS_DIR}")
            return servers
        
        for plugin_dir in PLUGINS_DIR.iterdir():
            if not plugin_dir.is_dir():
                continue
            
            mcp_json = plugin_dir / ".mcp.json"
            if not mcp_json.exists():
                continue
            
            try:
                data = json.loads(mcp_json.read_text(encoding="utf-8"))
                plugin_name = plugin_dir.name
                plugin_servers = self._parse_mcp_servers_from_json(data, plugin_name)
                servers.extend(plugin_servers)
            except json.JSONDecodeError as e:
                logger.warning(f"Failed to parse plugin MCP config {mcp_json}: {e}")
            except Exception as e:
                logger.error(f"Error reading plugin MCP config {mcp_json}: {e}")
        
        return servers

    def _load_agent_only_config(self) -> list[MCPServer]:
        """Load MCP servers from agent-only config file.
        
        These servers are only visible to the agent console, not the CLI.
        Uses the same JSON format as global config: {"mcpServers": {...}}
        """
        if not AGENT_ONLY_MCP_CONFIG.exists():
            logger.info(f"Agent-only MCP config not found: {AGENT_ONLY_MCP_CONFIG}")
            return []
        
        try:
            data = json.loads(AGENT_ONLY_MCP_CONFIG.read_text(encoding="utf-8"))
            return self._parse_mcp_servers_from_json(data, "agent-only")
        except json.JSONDecodeError as e:
            logger.warning(f"Failed to parse agent-only MCP config: {e}")
            return []
        except Exception as e:
            logger.error(f"Error reading agent-only MCP config: {e}")
            return []

    def get_available_servers(self, force_refresh: bool = False) -> MCPServerConfig:
        """Get all available MCP server configurations.
        
        Args:
            force_refresh: Force reload from disk even if cached
            
        Returns:
            MCPServerConfig with all discovered servers (global + plugins + agent-only)
        """
        if not force_refresh and not self._should_refresh_cache():
            assert self._cached_config is not None
            return self._cached_config
        
        logger.info("Loading MCP server configurations...")
        
        servers: list[MCPServer] = []
        
        # Load global config
        global_servers = self._load_global_config()
        servers.extend(global_servers)
        
        # Load plugin configs
        plugin_servers = self._load_plugin_configs()
        servers.extend(plugin_servers)
        
        # Load agent-only config
        agent_only_servers = self._load_agent_only_config()
        servers.extend(agent_only_servers)
        
        logger.info(f"Loaded {len(servers)} MCP servers total")
        
        self._cached_config = MCPServerConfig(servers=servers)
        self._cache_mtime = max(
            GLOBAL_MCP_CONFIG.stat().st_mtime if GLOBAL_MCP_CONFIG.exists() else 0,
            PLUGINS_DIR.stat().st_mtime if PLUGINS_DIR.exists() else 0,
            AGENT_ONLY_MCP_CONFIG.stat().st_mtime if AGENT_ONLY_MCP_CONFIG.exists() else 0,
        )
        
        return self._cached_config

    def get_servers_for_sdk(
        self, selections: list[str] | None = None
    ) -> dict[str, dict]:
        """Get MCP servers formatted for the Copilot SDK.
        
        The SDK expects mcp_servers as: {"server-name": {"type": "local", "command": "...", ...}}
        Supports both local and remote server types.
        
        Args:
            selections: Optional list of enabled server names. If None, all enabled.
            
        Returns:
            Dict of server configs ready for SDK create_session/resume_session mcp_servers param
        """
        config = self.get_available_servers()
        sdk_servers: dict[str, dict] = {}
        
        for server in config.servers:
            # Check if server is selected
            if selections is not None:
                enabled = server.name in selections
            else:
                enabled = server.enabled
            
            if not enabled:
                continue
            
            # Build server config dict for SDK
            is_remote = server.type in ("http", "sse")
            
            if is_remote:
                server_config: dict = {
                    "type": server.type,
                    "url": server.url,
                    "tools": server.tools,
                }
                if server.headers:
                    server_config["headers"] = server.headers
            else:
                server_config = {
                    "command": server.command,
                    "args": server.args,
                    "tools": server.tools,
                }
                if server.type:
                    server_config["type"] = server.type
                if server.env:
                    server_config["env"] = server.env
                if server.cwd:
                    server_config["cwd"] = server.cwd
            
            if server.timeout is not None:
                server_config["timeout"] = server.timeout
            
            sdk_servers[server.name] = server_config
        
        return sdk_servers

    def refresh(self) -> MCPServerConfig:
        """Force refresh the MCP server cache."""
        return self.get_available_servers(force_refresh=True)


# Singleton instance
mcp_service = MCPService()
