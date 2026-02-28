# MCP Servers

MCP servers provide external tools (e.g., GitHub, databases, internal APIs) that agents can call.

## Config Files

Copilot Console supports two MCP configs:

- **Global (shared with Copilot CLI):** `C:\Users\<username>\.copilot\mcp-config.json`
- **App-only:** `C:\Users\<username>\.copilot-console\mcp-config.json`

## Enable MCP Servers in the UI

- In **Agent Editor**, select which MCP servers the agent should have.
- In **Session Settings**, you can override per session.

Keep MCP selections minimal — only enable what the session needs.

## Troubleshooting

- If a server doesn’t show up, validate the JSON config and restart Copilot Console.
- If tools appear but calls fail, check the server’s own logs and credentials.
