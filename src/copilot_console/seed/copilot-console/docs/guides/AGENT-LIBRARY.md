# Agent Library

The **Agent Library** is where you define reusable agent personalities (prompt + configuration) and launch new sessions from them.

## Create an Agent

1. Open **Agents** in the sidebar
2. Click **+ New Agent**
3. Set:
   - **Name** and **Description** (important — the app uses the description to decide when to delegate)
   - **System prompt** (the agent’s behavior)
   - Optional: **Model** (leave empty to use your default model)

## Configure Capabilities

In the Agent Editor, you can select:

- **MCP servers** (and by extension, the tools they expose)
- **Custom tools** (from `~/.copilot-console/tools/`)
- **Sub-agents** (to create an agent team)

See:
- [MCP Servers](MCP-SERVERS.md)
- [Custom Tools](CUSTOM-TOOLS.md)
- [Agent Teams](AGENT-TEAMS.md)

## Start a Session from an Agent

From the agent card (or editor), click **New Session**. The new session inherits the agent’s prompt and selections.

## Where Agents Are Stored

Agents are stored under:

- `C:\Users\<username>\.copilot-console\agents\`

Copilot CLI agents in `~/.copilot/agents/` may also appear depending on your environment.
