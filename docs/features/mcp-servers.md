# Feature: MCP Servers

## Summary
Users can configure Model Context Protocol (MCP) servers per session, enabling Copilot to use external tools and data sources.

## Acceptance Criteria
- [x] MCP servers loaded from config files (~/.copilot/mcp-config.json and plugin .mcp.json files)
- [x] MCP selector dropdown in session header
- [x] Shows server name and source (global vs plugin)
- [x] Toggle individual servers on/off
- [x] Select All / Deselect All buttons
- [x] Selections persist with session
- [x] SDK receives selected servers on create/resume
