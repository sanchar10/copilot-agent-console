# Autonomous Agent Platform — Architecture & Vision

## The Big Picture

Transform the Copilot Console from a **chat interface** into a **personal AI operations platform** — an always-running local assistant that manages professional and personal tasks autonomously, with human oversight through the web UI.

```
┌─────────────────────────────────────────────────────────────┐
│                     Copilot Console                          │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │  Chat    │  │  Agent   │  │  Task    │  │ Automate │    │
│  │  (today) │  │  Library │  │  Board   │  │  Manager │    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Agent Runtime Engine                     │   │
│  │  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐     │   │
│  │  │Scheduler│  │ Runner │  │ Queue  │  │ Logger │     │   │
│  │  └────────┘  └────────┘  └────────┘  └────────┘     │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Copilot SDK + CLI                        │   │
│  │  Sessions, Tools, MCP Servers, Models                 │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Core Concepts

### Agent
A reusable capability definition — system prompt, model, tools, MCP servers, output settings, runtime settings.
Stored as JSON in `~/.copilot-console/agents/`. Agents are pure templates, NOT tied to a folder or schedule.

### Task
A single execution of an agent with specific input.
Can be triggered manually (on-demand) or by the scheduler.

### Task Run
The actual execution — maps to a Copilot SDK session under the hood.
Has status (pending, running, completed, failed), output, logs.

### Automation
A separate entity (Phase 3) that connects an agent to a cron trigger.
One agent can have multiple automations with different CWDs and inputs.
Automations are NOT part of the agent definition.

---

## Agent Types & Use Cases

### 1. News Monitor Agent
- **Schedule:** Every 6 hours
- **System prompt:** "You are an AI news analyst. Find the latest developments in AI/ML..."
- **Tools:** `web_search`, `web_fetch`
- **MCP servers:** None
- **Output:** Markdown report → saved to file, notification sent
- **Notification:** Desktop toast + optional email

### 2. Email Digest Agent
- **Schedule:** Every morning at 8 AM
- **System prompt:** "You are an email assistant. Summarize important emails..."
- **Tools:** Default tools
- **MCP servers:** Gmail MCP server, Yahoo Mail MCP server
- **Output:** Priority-sorted email digest
- **Notification:** Desktop toast with digest summary

### 3. Repo Guardian Agent
- **Schedule:** Daily at midnight
- **System prompt:** "You are a code maintainer. Check for open issues, analyze bugs..."
- **Tools:** Default tools + GitHub MCP server
- **MCP servers:** `github-mcp-server`
- **Output:** Issues triaged, PRs created for fixes
- **Notification:** Summary of actions taken

### 4. Research Agent
- **Trigger:** On-demand
- **System prompt:** "You are a research analyst. Research the given topic thoroughly..."
- **Tools:** `web_search`, `web_fetch`, `create` (for report files)
- **MCP servers:** None
- **Input:** Topic from user
- **Output:** Comprehensive report saved as markdown/PDF

### 5. Personal Assistant Agent
- **Schedule:** Every hour (lightweight check)
- **System prompt:** "You are a personal assistant. Check calendar, reminders..."
- **Tools:** Default tools
- **MCP servers:** Google Calendar MCP, Todoist MCP
- **Output:** Upcoming reminders, schedule conflicts

---

## Architecture Design

### Layer 1: Agent Definition Store

```
~/.copilot-console/agents/
├── news-monitor.json
├── email-digest.json
├── repo-guardian.json
└── research-agent.json
```

**Agent definition schema:**
```json
{
    "id": "news-monitor",
    "name": "AI News Monitor",
    "description": "Monitors AI/ML news and creates digests",
    "icon": "📰",
    "system_message": {
        "mode": "replace",
        "content": "You are an AI news analyst..."
    },
    "model": "claude-sonnet-4",
    "tools": {
        "available": ["web_search", "web_fetch", "create"],
        "custom": []
    },
    "mcp_servers": {"github": true, "filesystem": false},
    "output": {
        "save_to": "~/ai-reports/news/",
        "filename_pattern": "news-{date}.md",
        "notify": true
    },
    "settings": {
        "max_runtime_minutes": 10,
        "auto_approve_tools": true,
        "require_human_review": false
    }
}
```

### Layer 2: Scheduler Service (Backend)

New service: `automation_service.py`

- Uses `APScheduler` (Python library) for cron-based scheduling
- Persists automations to disk (survives restarts)
- On trigger: creates a Task, enqueues it
- Runs as part of the FastAPI backend (not a separate process)

```python
class AutomationService:
    def start(self):
        """Load all automations and start the scheduler."""
    
    def create_automation(self, agent_id: str, cron: str, default_input: str):
        """Add/update an automation."""
    
    def remove_automation(self, agent_id: str):
        """Remove an automation."""
    
    def list_automations(self) -> list[AutomationInfo]:
        """List all active automations with next run times."""
    
    async def _trigger_task(self, agent_id: str, input: str):
        """Called by scheduler — creates and runs a task."""
```

### Layer 3: Task Queue & Runner (Backend)

New service: `task_runner_service.py`

- Tasks execute sequentially (one at a time) or with configurable concurrency
- Each task creates a Copilot SDK session with the agent's config
- Uses `system_message: {mode: "replace"}` to override the default prompt
- Captures output, logs, duration
- Updates task status in real-time

```python
class TaskRunner:
    async def run_task(self, task: Task) -> TaskResult:
        """Execute a task using the Copilot SDK."""
        agent = load_agent(task.agent_id)
        
        session = await client.create_session({
            "model": agent.model,
            "system_message": agent.system_message,
            "available_tools": agent.tools.available,
            "mcp_servers": agent.mcp_servers,
            "tools": agent.tools.custom,
        })
        
        result = await session.send_and_wait({"prompt": task.input})
        
        # Save output
        if agent.output.save_to:
            save_report(result, agent.output)
        
        # Notify
        if agent.output.notify:
            send_notification(task, result)
        
        return TaskResult(status="completed", output=result)
```

### Layer 4: Notification Service (Backend)

New service: `notification_service.py`

- **Desktop toast:** Uses `win10toast` or `plyer` for cross-platform desktop notifications
- **Email:** Optional SMTP integration for email alerts
- **In-app:** Badge/counter in the UI + notification panel
- **Webhook:** Optional webhook URL for external integrations

```python
class NotificationService:
    async def notify(self, task: Task, result: TaskResult):
        """Send notification based on agent config."""
        # Desktop toast
        send_desktop_notification(
            title=f"✅ {task.agent_name} completed",
            body=result.summary[:200]
        )
        
        # In-app notification (stored for UI)
        store_notification({
            "task_id": task.id,
            "agent_id": task.agent_id,
            "title": f"{task.agent_name} completed",
            "body": result.summary,
            "timestamp": now(),
            "read": False,
        })
```

### Layer 5: Storage

```
~/.copilot-console/
├── agents/                    # Agent definitions (JSON)
│   ├── news-monitor.json
│   └── repo-guardian.json
├── tasks/                     # Task history
│   ├── 2026-02-15/
│   │   ├── task-abc123.json   # Task metadata + status
│   │   └── task-abc123.md     # Task output
│   └── 2026-02-14/
├── automations/               # Persisted automation state
│   └── automations.json
├── notifications/             # Unread notifications
│   └── notifications.json
├── sessions/                  # Existing session storage
└── settings.json              # Existing app settings
```

---

## Frontend UI Design

### New Tab Types

Add to the existing tab system:

```typescript
type TabType = 'session' | 'file' | 'agent-library' | 'task-board' | 'agent-detail';
```

### Screen 1: Agent Library (New sidebar section + tab)

A visual grid/list of all defined agents, similar to an app store.

```
┌─────────────────────────────────────────────┐
│  🤖 Agent Library                    [+ New] │
├─────────────────────────────────────────────┤
│                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ 📰       │  │ 📧       │  │ 🛡️       │  │
│  │ AI News  │  │ Email    │  │ Repo     │  │
│  │ Monitor  │  │ Digest   │  │ Guardian │  │
│  │          │  │          │  │          │  │
│  │ ⏰ 6h    │  │ ⏰ Daily │  │ ⏰ Daily │  │
│  │ ● Active │  │ ● Active │  │ ○ Paused │  │
│  │          │  │          │  │          │  │
│  │ [Run Now]│  │ [Run Now]│  │ [Run Now]│  │
│  └──────────┘  └──────────┘  └──────────┘  │
│                                              │
│  ┌──────────┐  ┌──────────┐                 │
│  │ 🔬       │  │ 🤵       │                 │
│  │ Research │  │ Personal │                 │
│  │ Agent    │  │ Assist   │                 │
│  │          │  │          │                 │
│  │ On-demand│  │ ⏰ 1h    │                 │
│  │          │  │ ● Active │                 │
│  │ [Run Now]│  │ [Run Now]│                 │
│  └──────────┘  └──────────┘                 │
└─────────────────────────────────────────────┘
```

### Screen 2: Agent Detail / Editor

Click an agent card → opens in a tab for editing.

```
┌─────────────────────────────────────────────┐
│  📰 AI News Monitor                  [Save] │
├─────────────────────────────────────────────┤
│                                              │
│  Name:     [AI News Monitor            ]     │
│  Model:    [claude-sonnet-4         ▾]       │
│  Icon:     [📰]                              │
│                                              │
│  System Prompt:                              │
│  ┌──────────────────────────────────────┐   │
│  │ You are an AI news analyst.          │   │
│  │ Find the latest developments in      │   │
│  │ AI/ML from reputable sources...      │   │
│  └──────────────────────────────────────┘   │
│                                              │
│  Tools:  ☑ web_search  ☑ web_fetch          │
│          ☐ view  ☐ edit  ☐ grep             │
│                                              │
│  MCP Servers:  ☑ github  ☐ filesystem        │
│                                              │
│  ─── Output ────────────────────────────     │
│  Save to: [~/ai-reports/news/         ]      │
│  ☑ Desktop notification                      │
│  ☐ Email notification                        │
│                                              │
│  ─── Settings ──────────────────────────     │
│  Max runtime: [10] minutes                   │
│  ☑ Auto-approve tool calls                   │
│  ☐ Require human review before action        │
│                                              │
│  [▶ Run Now]  [📋 View History]              │
└─────────────────────────────────────────────┘
```

### Screen 3: Task Board

A dashboard showing all task runs — recent, running, scheduled.

```
┌─────────────────────────────────────────────┐
│  📋 Task Board                              │
├─────────────────────────────────────────────┤
│                                              │
│  ── Running (1) ────────────────────────     │
│  🔄 AI News Monitor    Started 2m ago        │
│     "Find top 5 AI news..."  [View] [Abort] │
│                                              │
│  ── Upcoming (3) ───────────────────────     │
│  ⏳ Email Digest       In 2h 15m             │
│  ⏳ Repo Guardian      In 5h 30m             │
│  ⏳ Personal Assist    In 45m                │
│                                              │
│  ── Recent (10) ────────────────────────     │
│  ✅ AI News Monitor    Today 8:00 AM  [View] │
│  ✅ Email Digest       Today 8:00 AM  [View] │
│  ❌ Repo Guardian      Yesterday      [View] │
│  ✅ AI News Monitor    Yesterday      [View] │
│  ...                                         │
└─────────────────────────────────────────────┘
```

### Screen 4: Task Run Detail

Click "View" on a task → see full output, logs, duration.

```
┌─────────────────────────────────────────────┐
│  📰 AI News Monitor — Run #42               │
│  ✅ Completed · 3m 24s · Feb 15 8:00 AM     │
├─────────────────────────────────────────────┤
│                                              │
│  Input: "Find top 5 AI news stories..."     │
│                                              │
│  ── Output ─────────────────────────────     │
│  # AI News Digest — Feb 15, 2026            │
│                                              │
│  1. **OpenAI releases GPT-6** — ...         │
│  2. **Google DeepMind achieves...** — ...    │
│  ...                                         │
│                                              │
│  ── Saved to ───────────────────────────     │
│  📄 ~/ai-reports/news/news-2026-02-15.md    │
│                                              │
│  ── Tool Calls (12) ───────────────────     │
│  🔍 web_search: "latest AI news Feb 2026"   │
│  🌐 web_fetch: https://...                   │
│  ...                                         │
└─────────────────────────────────────────────┘
```

### Sidebar Changes

```
┌──────────────────┐
│ 🤖 Copilot Console │
├──────────────────┤
│                  │
│ CHAT             │
│  + New Session   │
│  Session 1       │
│  Session 2       │
│                  │
│ AGENTS           │
│  📚 Library      │
│  📋 Task Board   │
│  ⏰ Automations   │
│                  │
│ RECENT RUNS      │
│  ✅ News 8:00am  │
│  ✅ Email 8:00am │
│  ❌ Repo yday    │
│                  │
│ 🔔 3 unread      │
└──────────────────┘
```

---

## How Copilot SDK is Used

### Chat Sessions (existing)
- Default system prompt (Copilot default)
- All tools available
- User-driven conversation
- No changes needed

### Manual Agent Runs ("Run Now") — NEW
- Opens as a **regular chat tab** with agent config pre-loaded
- `system_message: {mode: "replace"}` — agent's custom prompt
- `available_tools` — only tools the agent needs
- `mcp_servers` — agent's MCP server selections (`dict[str, bool]`, selects from both global + agent-only pools)
- `model` — agent's configured model
- Session created lazily on first user message (same as regular chat)
- Appears in **chat sidebar** (not Task Board)
- Header: session name + agent badge (clickable) + model + CWD + MCP + tools + token slider
- After first message: model, MCP, tools become **read-only** (from snapshot). CWD stays editable.

### Scheduled Agent Runs (background) — NEW
- Same SDK config as manual runs
- `auto_approve_tools: true` (via permission handler) — no human confirmation
- Session is created, prompt sent, output captured, session destroyed
- No chat UI — runs silently in the background
- Appears in **Task Board** (not chat sidebar)
- Output saved to configured location, notifications sent

---

## Implementation Phases

### Phase 1: Agent Definition & Library UI
**Goal:** Users can create, edit, view, and manage agent definitions.

- Agent definition schema (JSON)
- Agent CRUD API (backend routes)
- Agent Library UI (grid view)
- Agent Editor UI (form-based)
- Storage in `~/.copilot-console/agents/`

**No execution yet — just defining agents.**

### Phase 2: On-Demand Execution ("Run Now")
**Goal:** Users can run agents manually as interactive chat sessions.

- "Run Now" button on agent cards → opens chat tab with agent config pre-loaded
- SDK session created lazily on first message (with agent's model, system_message, tools, mcp_servers, cwd)
- Session metadata: `agent_id` + `trigger: "manual"` on session
- Simplified header: agent badge (clickable), read-only model, editable CWD, read-only MCP/Tools selectors (from snapshot)
- Token slider works same as regular chat
- Manual runs appear in chat sidebar (same as regular sessions)

**Scheduled execution not yet — manual only.**

### Phase 3: Scheduler & Task Board
**Goal:** Agents run automatically on schedule, results visible in Task Board.

- Scheduler service (APScheduler)
- Cron expression support
- Automation persistence across restarts
- Task Runner service (headless — creates SDK session, sends prompt, captures output, destroys session)
- Task Board UI (list of scheduled runs with status)
- Task Detail UI (view output, logs, duration)
- Automation management UI
- Next-run-time display

### Phase 4: Notifications
**Goal:** Users get alerted when tasks complete.

- Desktop notifications (win10toast / plyer)
- In-app notification panel with badge
- Notification preferences per agent
- Optional email notifications (SMTP config)

### Phase 5: Advanced Features
**Goal:** Production-grade autonomous operation.

- Task output history & search
- Agent templates / marketplace (pre-built agents)
- Task chaining (output of one agent feeds into another)
- Conditional scheduling (run only if condition met)
- Resource limits (max concurrent tasks, API rate limiting)
- Agent versioning (track prompt changes)
- Human-in-the-loop mode (agent pauses for approval on certain actions)

---

## Key Design Decisions

### 1. Manual "Run Now" = Regular Chat Session with Agent Preset ✅ DECIDED
"Run Now" from Agent Library opens a **regular chat tab** — identical to clicking "+ New Session", except:
- Session metadata has `agent_id` set (links to agent config)
- SDK session created with agent's `system_message`, `available_tools`, `mcp_servers`, `model`
- Header shows agent badge (clickable → opens agent editor)
- Lazy creation: no SDK session until user sends first message (matches current behavior)

**This is NOT a separate concept.** It's just "New Session with agent preset applied."

### 2. Where Runs Appear ✅ DECIDED

| Run type | Chat sidebar | Task Board |
|----------|:---:|:---:|
| Regular chat | ✅ | ❌ |
| Manual "Run Now" | ✅ | ❌ |
| Scheduled background | ❌ | ✅ |

- **Manual runs are attended** — user is interacting, so they belong in chat sidebar
- **Scheduled runs are unattended** — no user interaction, so Task Board only
- Sidebar filter: show if `trigger !== "automation"`

### 3. Session Metadata Model ✅ DECIDED
Only two fields needed on session metadata:

| Field | Regular chat | Manual "Run Now" | Scheduled run |
|-------|:---:|:---:|:---:|
| `agent_id` | `null` | `"news-monitor"` | `"news-monitor"` |
| `trigger` | `null` | `"manual"` | `"automation"` |

No separate `type` field needed — `agent_id` presence tells us it's an agent run, `trigger` tells us manual vs scheduled.

### 4. "Run Now" Header ✅ DECIDED

**Before first message (session not yet created):**
Everything is editable — user can adjust model, MCP, tools, CWD before committing. Values pre-filled from agent definition but changeable.

| Header element | Regular new session | Agent "Run Now" (before 1st msg) |
|---|---|---|
| Session Name | ✅ editable | ✅ editable |
| **Agent Badge** | ❌ | ✅ `🤖 Agent Name` — clickable → opens agent editor |
| Model | ✅ dropdown | ✅ dropdown (pre-filled from agent) |
| 📁 CWD | ✅ editable | ✅ editable (app default) |
| MCP Selector | ✅ interactive | ✅ interactive (pre-filled from agent) |
| Tools Selector | ✅ interactive | ✅ interactive (pre-filled from agent) |
| Token Slider | hidden | hidden |

**After first message (session created, snapshot taken):**
Everything locks to read-only **except CWD** (which remains editable, same as regular sessions).

| Header element | Regular session (active) | Agent "Run Now" (after 1st msg) |
|---|---|---|
| Session Name | ✅ editable | ✅ editable |
| **Agent Badge** | ❌ | ✅ `🤖 Agent Name` — clickable → opens agent editor |
| Model | 🔒 read-only gray badge | 🔒 read-only gray badge (from snapshot) |
| 📁 CWD | ✅ editable | ✅ **editable** (same behavior as regular chat) |
| MCP Selector | ✅ interactive | 🔒 read-only (from snapshot) |
| Tools Selector | ✅ interactive | 🔒 read-only (from snapshot) |
| Token Slider | ✅ shown | ✅ shown |

**Drift banner:** If agent definition was modified after the snapshot was taken:
```
ℹ️ Agent "AI News Monitor" has been updated since this run. Run Now for latest config.
```

### 5. Agent CWD (Working Directory) ✅ DECIDED
**CWD is NOT part of the agent definition.** Agents are capabilities, not tied to folders.

**"Run Now" flow:**
- CWD behaves **identically to regular new session** — pre-filled with app default, editable in header
- Remains editable even after first message (same as regular chat)
- On CWD change mid-session: backend destroys SessionClient, frontend calls `clearReadySession()`, next message creates new CopilotClient + SDK session with updated CWD (existing behavior)
- CWD is snapshotted in `agent_snapshot` for reference but NOT locked (unlike model/prompt/tools/MCP)

**Scheduled runs:**
- CWD is set **on the automation**, not on the agent definition
- Same agent can have multiple automations targeting different folders:
  - Automation 1: "Repo Guardian" → `E:\repos\project-a` — daily at midnight
  - Automation 2: "Repo Guardian" → `E:\repos\project-b` — daily at 2am
- Automation editor has a CWD field with folder browser
- Default: app default CWD (or `~` if none)

**Why not in agent definition:**
- One agent, many folders — "Code Tester" works on any repo
- One agent, many automations — each automation targets a different folder
- No duplication — no need for "Code Tester (Project A)" and "Code Tester (Project B)"
- Matches mental model — the agent is a skill, the folder is a workspace

### 6. Agent Config Snapshot ✅ DECIDED
When the first message is sent in an agent session, the **entire agent config is snapshotted** into session metadata:

```json
{
  "agent_id": "news-monitor",
  "trigger": "manual",
  "agent_snapshot": {
    "model": "claude-sonnet-4",
    "system_message": {"mode": "replace", "content": "You are..."},
    "tools": {"available": ["web_search", "web_fetch"]},
    "mcp_servers": {"github": true},
    "cwd": "E:\\repos\\my-project",
    "snapshotted_at": "2026-02-15T08:00:00Z",
    "agent_version": "..." 
  }
}
```

**Rules:**
- **Before first message:** Model, tools, MCP pre-filled from agent definition but fully editable. CWD pre-filled from app default, editable.
- **On first message:** Snapshot taken, SDK session created with these values. Model, system_message, tools, MCP lock. CWD stays editable.
- **After first message:** Model, prompt, tools, MCP are read-only. CWD remains editable (on change: backend destroys SessionClient, next message creates new one with updated CWD — existing behavior).
- **Agent edits never affect existing sessions** — only future "Run Now" or automation runs pick up changes
- **Prompt iteration workflow:** Edit agent → Run Now → test → close tab → Edit → Run Now → repeat. Each test is a clean session (better for prompt testing — no conversation history pollution)
- **Drift banner:** If agent definition changed since snapshot, show informational banner with "Run Now for latest config" link

**Why snapshot everything (including tools/MCP that SDK CAN update on resume)?**
Consistency. If model and prompt are locked but tools change, the agent may behave unpredictably — its prompt was written assuming certain tools. All-or-nothing snapshot is simpler to reason about.

### 7. System message mode
Use `mode: "replace"` for agents that need full control. Use `mode: "append"` for agents that should retain Copilot's default capabilities but with additional instructions.

### 7b. Agent description ✅ DECIDED
The `description` field serves **dual purpose**:
- **UI**: Shown on Agent Library cards and Editor for user reference
- **SDK**: Passed to `custom_agents[].description` when creating SDK sessions (Phase 2)

This matches the SDK's `CustomAgentConfig` which accepts `name`, `display_name`, `description`, and `prompt`. The LLM sees the description as context about what the agent is for.

### 8. Tool approval
Scheduled agents should auto-approve tool calls (no human to confirm). The SDK supports a `on_permission_request` handler — return auto-approve for scheduled tasks.

### 9. Concurrency ✅ DECIDED
**System-level setting** (in `~/.copilot-console/settings.json`):
```json
{
  "max_concurrent_tasks": 3
}
```
- Default: **3** — at most 3 agent tasks running simultaneously
- Configurable in app Settings UI
- Applies globally across all agents (manual + scheduled)
- If limit reached, new tasks queue up and wait
- Each task needs its own CopilotClient to avoid session conflicts

### 10. MCP server lifecycle
MCP servers specified in agent config are started when the task begins and stopped when it ends. Long-running MCP servers (like email) could be shared across tasks.

### 10. Error handling
Failed tasks should be retried once, then marked as failed with full error logs. Notification sent on failure. User can retry manually from Task Board.

### 11. Security
- No credentials stored in agent definitions — use environment variables or secret manager
- MCP servers handle their own auth (OAuth, API keys via env vars)
- Agent definitions are local files — no cloud sync

### 12. Sidebar Session Filtering ✅ DECIDED
The chat sidebar should only show sessions the user directly interacts with. Other session types are accessed from their own dedicated UIs.

**Filter rule:** Show session in sidebar if `trigger` is `null` OR `"manual"`.

| Session type | `trigger` value | Sidebar | Accessed from |
|---|---|---|---|
| Regular chat | `null` | ✅ | Sidebar |
| Manual agent "Run Now" | `"manual"` | ✅ | Sidebar |
| Scheduled agent run | `"automation"` | ❌ | Task Board |

**Future-proof filter logic:**
```typescript
// Sidebar shows only user-interactive sessions
const sidebarSessions = sessions.filter(s => 
  s.trigger === null || s.trigger === undefined || s.trigger === 'manual'
);
```

### 13. MCP Server Architecture ✅ DECIDED

MCP servers come from **two pools**, both using the same JSON format (`{"mcpServers": {...}}`):

| Pool | Config file | Visible to CLI? | Source label |
|---|---|---|---|
| **Global** | `~/.copilot/mcp-config.json` | ✅ Yes | `"global"` |
| **Agent Only** | `~/.copilot-console/mcp-config.json` | ❌ No | `"agent-only"` |
| **Plugin** | `~/.copilot/installed-plugins/.../mcp.json` | ✅ Yes | Plugin name |

**Why two pools?**
- Global servers are shared with the Copilot CLI — changing them affects CLI behavior
- Agent-only servers are specific to this app — custom integrations, databases, internal APIs that only custom agents need
- Both pools support the same server types (local and remote)

**Server types** (matching Copilot SDK types):
- **Local/stdio**: `command`, `args`, `env`, `cwd`, `tools`
- **Remote (http/sse)**: `url`, `headers`, `tools`

**How agents select servers:**
- Agent definition stores `mcp_servers: dict[str, bool]` — server name → enabled
- Names reference servers from ANY pool (global, agent-only, or plugin)
- At runtime, `get_servers_for_sdk(selections)` merges selected servers into SDK format
- Agent Editor shows all available servers grouped by source with checkboxes

---

## Tab System

### Current Architecture (5 types, conditionals)
```typescript
type TabType = 'session' | 'file' | 'agent-library' | 'task-board' | 'agent-detail';
```

Currently uses conditional rendering in `ChatPane`:
```typescript
{activeTab?.type === 'agent-library' && <AgentLibrary />}
{activeTab?.type === 'agent-detail' && <AgentDetail agentId={activeTab.agentId} />}
{activeTab?.type === 'task-board' && <TaskBoard />}
{/* session tabs rendered in a loop */}
```

Works fine for 5-6 types. No refactoring needed for Phase 1-3.

### Tab Registry Spec (implement when 8+ types)

**When to refactor:** When we add types beyond `agent-library`, `agent-detail`, `task-board` (e.g. `settings`, `agent-history`, `marketplace`, `automation-editor`).

**Design:**

```typescript
// tabRegistry.ts — single source of truth for tab behavior

interface TabRegistration {
  /** Component to render for this tab type */
  component: React.ComponentType<TabProps>;
  /** Icon for the tab bar */
  icon: string | React.ReactNode;
  /** Called when tab is first opened */
  onOpen?: (tab: Tab) => void;
  /** Called when tab becomes active */
  onActivate?: (tab: Tab) => void;
  /** Called before tab closes — return false to prevent close */
  onClose?: (tab: Tab) => Promise<boolean>;
  /** Whether only one instance can exist (e.g. agent-library) */
  singleton?: boolean;
  /** Tab-specific data extractor (for props) */
  getProps?: (tab: Tab) => Record<string, unknown>;
}

// Registry — add new types here, nothing else changes
const tabRegistry: Record<TabType, TabRegistration> = {
  'session': {
    component: SessionTabContent,
    icon: '💬',
    singleton: false,
    onActivate: (tab) => loadCachedMessages(tab.sessionId),
    onClose: async (tab) => { disconnectSession(tab.sessionId); return true; },
    getProps: (tab) => ({ sessionId: tab.sessionId }),
  },
  'agent-library': {
    component: AgentLibrary,
    icon: '🤖',
    singleton: true,
    onActivate: () => refreshAgents(),
  },
  'agent-detail': {
    component: AgentDetail,
    icon: '📝',
    singleton: false,
    getProps: (tab) => ({ agentId: tab.agentId }),
  },
  'task-board': {
    component: TaskBoard,
    icon: '📋',
    singleton: true,
    onActivate: () => refreshTasks(),
  },
};
```

**Generic renderer (replaces all conditionals):**
```typescript
// ChatPane.tsx — ONE block for all tab types
function TabContent({ tab, isActive }: { tab: Tab; isActive: boolean }) {
  const registration = tabRegistry[tab.type];
  if (!registration) return null;
  
  const props = registration.getProps?.(tab) ?? {};
  return <registration.component {...props} isActive={isActive} />;
}
```

**Benefits when implemented:**
- Adding a new tab type = 1 registry entry (no ChatPane/TabBar/Sidebar edits)
- Lifecycle hooks (onOpen/onActivate/onClose) replace scattered logic
- Singleton enforcement automatic (no manual dedup in openTab)
- Tab-specific props extracted cleanly via getProps

**Tab interface extension:**
```typescript
interface Tab {
  id: string;
  type: TabType;
  label: string;
  // Type-specific optional fields
  sessionId?: string;    // session tabs
  filePath?: string;     // file tabs
  agentId?: string;      // agent-detail tabs
  taskId?: string;       // task-detail tabs (future)
}
```

---

## Technology Choices

| Component | Technology | Why |
|-----------|-----------|-----|
| Scheduler | APScheduler | Python, lightweight, cron support, persistence |
| Desktop notifications | plyer | Cross-platform (Windows/Mac/Linux) |
| Task storage | JSON files | Simple, no database needed, human-readable |
| Agent definitions | JSON | Easy to edit manually, version-controllable |
| Email sending | smtplib | Built-in Python, no dependencies |
| SDK integration | Copilot SDK | Already integrated in the app |

---

## Resolved Questions

1. ✅ **Should agent task runs appear in the chat sidebar?** — Manual "Run Now" → yes (chat sidebar). Scheduled → no (Task Board only).

2. ✅ **Interactive agent mode?** — "Run Now" always opens as interactive chat tab. There is no non-interactive manual run. If you want non-interactive, use scheduling.

3. ✅ **Agent sharing?** — Yes, trivially — they're already JSON files. Export = copy file, Import = paste file.

4. ✅ **Concurrency / rate limiting?** — System-level setting `max_concurrent_tasks: 3` in settings.json. At most 3 tasks run simultaneously; excess tasks queue. Configurable in Settings UI.

5. ✅ **Output format?** — Let the system prompt define it. Markdown by default.

---

## Backward Compatibility & Migration

### Existing Session Model Changes
The current `Session` model has: `session_id`, `session_name`, `agent_type` ("copilot"/"domain"), `model`, `cwd`, `mcp_servers`, `tools`, `name_set`, `created_at`, `updated_at`.

**New fields to add:**
- `agent_id: str | None` — which custom agent this session was created from (null for regular chat)
- `trigger: str | None` — `"manual"` or `"automation"` (null for regular chat)
- `agent_snapshot: dict | None` — frozen config at session creation time (null for regular chat)

**Note:** The existing `agent_type` ("copilot"/"domain") is about SDK backend type, NOT our custom agents. Keep it as-is. Our `agent_id` is separate.

### Migration Rules
- Old sessions (no `agent_id`/`trigger`/`agent_snapshot`) load with all three as `null` — treated as regular chat
- Sidebar filter: `trigger !== "automation"` — old sessions have `trigger: null`, passes filter ✅
- Header: `agent_id === null` → full interactive mode (existing behavior) ✅
- No data migration needed — new fields are all nullable with sensible defaults

---

## Testing Plan

### Backend Tests (Python)

**Agent CRUD:**
- `test_create_agent` — POST agent definition, verify stored on disk
- `test_get_agent` — GET by id, verify all fields returned
- `test_update_agent` — PUT with modified fields, verify persisted
- `test_delete_agent` — DELETE, verify file removed
- `test_list_agents` — GET all, verify list matches disk

**Session + Agent Integration:**
- `test_create_session_with_agent_id` — verify `agent_id` and `trigger` persisted in session.json
- `test_create_session_with_agent_snapshot` — verify snapshot frozen correctly
- `test_resume_session_preserves_snapshot` — verify snapshot not overwritten on resume
- `test_old_session_loads_without_agent_fields` — backward compat, null defaults
- `test_session_list_excludes_scheduled` — verify filter works
- `test_session_list_includes_manual_agent_runs` — verify manual runs appear

**Existing Session Tests (no regression):**
- `test_create_regular_session_unchanged` — no agent fields, works as before
- `test_update_cwd_unchanged` — CWD change still destroys client
- `test_delete_session_unchanged` — still uses rmtree, handles agent metadata

### Frontend Tests (TypeScript/Vitest)

**Header Component:**
- `test_header_readonly_mode_agent_session` — model/MCP/tools show read-only when `agent_id` set + session active
- `test_header_editable_mode_agent_session_before_message` — all editable before first message
- `test_header_agent_badge_renders` — badge visible with agent name
- `test_header_agent_badge_clickable` — click opens agent editor tab
- `test_header_drift_banner` — shows when agent updated_at > snapshot.snapshotted_at
- `test_header_no_badge_regular_session` — no badge when `agent_id` is null

**Sidebar:**
- `test_sidebar_shows_manual_agent_runs` — trigger="manual" visible
- `test_sidebar_hides_scheduled_runs` — trigger="automation" filtered out
- `test_sidebar_shows_regular_sessions` — trigger=null visible (backward compat)

**"Run Now" Flow:**
- `test_run_now_opens_new_tab` — creates tab with agent pre-fill
- `test_run_now_prefills_from_agent` — model, tools, MCP from agent definition
- `test_run_now_cwd_from_app_default` — CWD not from agent
- `test_run_now_snapshot_on_first_message` — agent_snapshot populated after send
- `test_run_now_cwd_editable_after_message` — CWD still changeable

**No-Regression:**
- `test_regular_new_session_unchanged` — no agent pre-fill, all interactive
- `test_regular_session_model_dropdown_works` — model editable for new, locked for active
- `test_regular_session_mcp_tools_interactive` — MCP/tools always interactive
- `test_cwd_change_destroys_client` — existing behavior preserved
- `test_file_attachments_work_in_agent_session` — pending files + upload flow
