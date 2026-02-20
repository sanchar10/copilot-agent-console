# Copilot Agent Console

A local desktop application for running and automating GitHub Copilot agents through a rich web interface.

![Copilot Agent Console](https://img.shields.io/badge/Copilot-Agent%20Console-blue?style=flat-square)
![Windows](https://img.shields.io/badge/Platform-Windows-0078D6?style=flat-square&logo=windows)
![Python 3.10+](https://img.shields.io/badge/Python-3.10%2B-3776AB?style=flat-square)
![License MIT](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)

![Main Interface](docs/screenshots/main.jpg)

---

## What Is This?

Copilot Agent Console is a feature-rich application built on the [GitHub Copilot CLI](https://docs.github.com/en/copilot/github-copilot-in-the-cli) and [Copilot Python SDK](https://github.com/github/copilot-sdk) that adds multi-session management, reusable agent personalities, scheduled automations, and external tool integration — all through a modern browser interface running on your machine.

It leverages Copilot's agentic capabilities — orchestration, context management, built-in tools — and provides a platform to extend them for different use cases through custom tools, MCP servers, and agent personalities.

> **Platform:** Windows only (tested and developed on Windows 10/11). macOS/Linux are untested.

---

## Features

### 💬 Multi-Session Chat
Multiple conversations run simultaneously in a tabbed interface. Each session has its own context, model selection, and tool configuration. Sessions persist across restarts.

### 🎨 Rich Message Rendering
Full Markdown with syntax-highlighted code blocks (Prism), GFM tables, Mermaid diagrams (with fullscreen view), and copy-to-clipboard. Responses render beautifully as they stream in real-time.

### 📎 File Attachments
Drag-and-drop or click to attach files to messages. Files are uploaded to the session and referenced by the agent.

### 🔍 Agent Transparency
Full visibility into the agent's reasoning process. Every tool call, file edit, and decision step is displayed in an expandable "Steps" panel — both during live streaming and in saved messages. See exactly what the agent did and why.

### 🤖 Agent Library
Reusable agent personalities — each with its own model, system prompt, MCP servers, and custom tools. Every agent gets exactly the context it needs, nothing more. New sessions launch from any agent with one click.

![Agent Library](docs/screenshots/agent-library.jpg)

### ⏰ Automations
Agents run on a cron schedule — configurable prompt, agent, and timing. The Runs dashboard shows all executions, with the ability to jump into a running agent's chat to watch it work live or review the full history later.

**Example automations:**
- **Daily PR Review** — Every morning at 8 AM, an agent checks for open pull requests, summarizes their status, and flags any that have been waiting for review for more than 2 days.
- **Build Health Monitor** — Every hour during work days, an agent checks the CI pipeline for failed builds and reports which commits broke the build.

![Automation Runs](docs/screenshots/AutomationRuns.jpg)

### 🔔 Unread Indicators
Blue dot indicators highlight sessions with unread responses — no activity is missed across multiple parallel sessions.

### 🔌 MCP Server Management
MCP servers can be defined globally (shared with CLI via `~/.copilot/mcp-config.json`) or app-only (`~/.copilot-agent-console/mcp-config.json`). Individual servers and tools can be toggled on/off at both agent and session level — keeping context focused and avoiding bloat.

### 🔧 Custom Tools
Python tools dropped into `~/.copilot-agent-console/tools/` become available to all agents. Each tool is defined with a `TOOL_SPECS` list containing name, description, JSON schema, and handler function. Tools auto-reload when files change — no restart needed. The built-in **Tool Builder** agent can generate custom tools from a natural language description — just describe what the tool should do.

### 🤝 Agent Teams
Compose agents into teams. A main agent can delegate tasks to specialized sub-agents that run in separate contexts — each with its own prompt, tools, and MCP servers. The main agent automatically decides when to delegate based on the sub-agent's description. See [Agent Teams](docs/MULTI-AGENT.md) for details.

### 🔄 Smart Ralph AI Runner (Experimental)
Batch job execution based on the [Ralph Loop pattern](https://ghuntley.com/loop/). A dynamic list of jobs is built collaboratively and handed to Ralph Runner, which runs each one in a fresh agent session — preventing context bloat and isolating workflows.

---

## Quick Install

The install script checks prerequisites, installs any missing dependencies, and sets up Agent Console — all in one command. Run the same command to upgrade.

**Windows (PowerShell):**
```powershell
irm https://raw.githubusercontent.com/sanchar10/copilot-agent-console/main/scripts/install.ps1 | iex
```

Then start:
```
agentconsole
```

> For manual setup, upgrading, or uninstalling, see **[Manual Installation](docs/INSTALL.md)**.

### First Things to Try

1. **Start a session** — Click `+` in the sidebar to create a new conversation.
2. **Chat** — Type a message and hit Enter. Responses stream in real-time.
3. **Create an agent** — Go to **Agents** in the sidebar, click **+ New Agent**, configure a name, system prompt, and model.
4. **Schedule an automation** — On an agent card, click **Automations**, then **+ New Automation** to set a cron schedule.
5. **Add custom tools** — Use the built-in **Tool Builder** agent to create tools via chat, or manually drop a `.py` file into `~/.copilot-agent-console/tools/` (see [Custom Tools](docs/CUSTOM-TOOLS.md)).

---

## Command Line Options

```
agentconsole [OPTIONS]

Options:
  --port, -p PORT    Port to run the server on (default: 8765)
  --host HOST        Host to bind to (default: 127.0.0.1)
  --no-browser       Don't automatically open browser on start
  --no-sleep         Prevent Windows from sleeping while running
                     (useful when scheduled tasks need to run overnight)
  --version, -v      Show version and exit
```

### Examples

```powershell
# Run on a custom port
agentconsole --port 9000

# Run without opening browser
agentconsole --no-browser

# Keep PC awake for overnight scheduled tasks
agentconsole --no-sleep
```

---

## Configuration

All data is stored in `C:\Users\<username>\.copilot-agent-console\`:

```
.copilot-agent-console\
├── settings.json        # Default model, working directory
├── sessions\            # Chat session history
├── agents\              # Agent library definitions
├── schedules\           # Automation schedules
├── task-runs\           # Automation run history
├── tools\               # Custom Python tools (drop .py files here)
├── mcp-servers\         # MCP server configurations
└── viewed.json          # Read/unread tracking
```

Custom tools can be created using the built-in **Tool Builder** agent or written manually. See [Custom Tools](docs/CUSTOM-TOOLS.md) for details.

---

## More Information

- [Manual Installation](docs/INSTALL.md) — Step-by-step setup, updating, and uninstalling
- [Custom Tools](docs/CUSTOM-TOOLS.md) — Creating tools with Tool Builder or manually
- [Agent Teams](docs/MULTI-AGENT.md) — Composing agents with sub-agents
- [Troubleshooting](docs/TROUBLESHOOTING.md) — Common issues and SDK/CLI compatibility
- [Contributing](docs/CONTRIBUTING.md) — Development setup, building, testing, and architecture

---

## License

MIT
