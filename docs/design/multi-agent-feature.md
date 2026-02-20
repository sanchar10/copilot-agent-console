# Agent Teams — Design & Specification

## Overview

Enable users to compose agents with sub-agents that run in separate contexts. When a user selects an agent to chat with, any configured sub-agents are passed to the Copilot SDK as `custom_agents` — the main agent can then delegate tasks to them automatically.

### Motivation

Currently, agents in the Agent Library run as system message configurations (default, append or replace) in a single context. All tools, MCP servers, and logic share the same session. Agent Teams provide:

- **Context isolation** — each sub-agent runs independently with its own prompt and tool scope
- **Automatic delegation** — the main agent decides when to hand off based on the sub-agent's description (`infer: true`)
- **Composability** — users build specialized agents and compose them into teams

### SDK Foundation

The Copilot SDK supports `custom_agents` as a session-level config:

```python
class CustomAgentConfig(TypedDict, total=False):
    name: str                                          # Unique agent ID
    display_name: NotRequired[str]                     # UI display name
    description: NotRequired[str]                      # What the agent does
    prompt: str                                        # Agent's system prompt
    tools: NotRequired[list[str] | None]               # Built-in tool whitelist
    mcp_servers: NotRequired[dict[str, MCPServerConfig]]  # Agent-specific MCP servers
    infer: NotRequired[bool]                           # Auto-dispatch by model
```

Passed to `create_session` and `resume_session` as `session_opts["custom_agents"]`.

**SDK limitations:**
- No `custom_agents` field inside `CustomAgentConfig` — no nesting
- `tools` is whitelist only — no exclusion concept
- No custom tool handlers (`Tool` objects) — session-level only
- No per-agent model override
- CLI built-in and custom agents (inside `~/.copilot/agents/`) are always loaded — cannot be disabled via SDK

---

## Functional Requirements

### FR-1: Sub-Agent Selection in Agent Editor

**Description:** When editing an agent in the Agent Editor, users can select which other agents should be available as sub-agents.

**Acceptance Criteria:**
- [ ] Agent Editor shows a "Sub-Agents" selector (same UX pattern as MCP and Tools selectors)
- [ ] Selector lists eligible agents from `~/.copilot-agent-console/agents/`
- [ ] User can select/deselect individual agents
- [ ] Selected sub-agents are saved to the agent's JSON config as `sub_agents: ["agent-id-1", "agent-id-2"]`

### FR-2: Sub-Agent Eligibility Rules

**Description:** Not all agents can be used as sub-agents due to SDK limitations. The picker must filter to eligible agents only.

**Acceptance Criteria:**
- [ ] Agents with non-empty `tools.custom` are excluded from the picker
- [ ] Agents with non-empty `tools.excluded_builtin` are excluded from the picker
- [ ] Agents that already have sub-agents of their own are excluded (no nesting)
- [ ] The agent being edited is excluded from its own picker (no self-reference)
- [ ] Agents without a `system_message.content` are excluded (prompt is required for sub-agents)
- [ ] Agents without a `description` are excluded (required for auto-dispatch)

### FR-3: Sub-Agent Selector in Chat View

**Description:** When a session is started with an agent, the chat view shows the configured sub-agents with the ability to toggle them per session, just like other items; model, MCP and Tools

**Acceptance Criteria:**
- [ ] Chat view shows "Sub-Agents" selector next to Tools and MCP selectors
- [ ] Selector shows agent's `sub_agents` list / config as pre-selected
- [ ] Selector shows all other eligible sub-agents as unselected (excluding the session's own agent via stored `agent_id`)
- [ ] User can change individual sub-agents on/off for the session
- [ ] "All | None" toggle works consistently with MCP and Tools selectors
- [ ] Before the session is created on the first message, the toggling is in memory 
- [ ] For existing sessions, toggling changes are save immediately (same as MCP / Tools)

### FR-4: Sub-Agents Passed to SDK on Session Create/Resume

**Description:** When a session starts or resumes, selected sub-agents are converted to SDK `CustomAgentConfig` format and passed to the SDK.

**Acceptance Criteria:**
- [ ] Sub-agents are included in `session_opts["custom_agents"]` on `create_session`
- [ ] Sub-agents are included in `resume_opts["custom_agents"]` on `resume_session`
- [ ] Agent fields are mapped correctly (see Data Model section)
- [ ] MCP server names are resolved to full configs via `mcp_service.get_servers_for_sdk()`
- [ ] All sub-agents have `infer: True` set

### FR-5: Sub-Agent Validation at Session Start

**Description:** Before creating/resuming a session, validate all configured sub-agents are still eligible. If any are ineligible, fail with a clear error.

**Acceptance Criteria:**
- [ ] Validation runs before SDK `create_session` and `resume_session` calls
- [ ] If a sub-agent has custom tools → session fails with error naming the agent and reason
- [ ] If a sub-agent has excluded_builtin tools → session fails with error
- [ ] If a sub-agent has its own sub-agents → session fails with error
- [ ] Error is surfaced as an error message in the chat view (interactive) or task run failure (automation)
- [ ] Error message is actionable: tells user exactly what to fix

### FR-6: Ineligible Sub-Agent Handling in Agent Editor

**Description:** If a previously-added sub-agent becomes ineligible (e.g., user later adds custom tools to it), block saving and show the issue in the Agent Editor. Runtime validation at session start/resume remains as a safety net for background edits.

**Acceptance Criteria:**
- [ ] Sub-agents that are now ineligible appear visually flagged (red/warning) in the editor
- [ ] Reason for ineligibility is shown (e.g., "Has custom tools")
- [ ] Agent cannot be saved while it has ineligible sub-agents — save button disabled with explanation
- [ ] User must remove ineligible sub-agents before saving
- [ ] Runtime validation at session create/resume still runs as safety net (handles edits made outside the UI, e.g., direct JSON file changes)

### FR-7: Sub-Agent Eligibility Indicator and Filter in Agent Library

**Description:** Each agent in the Agent Library and Agent Editor shows a visual indicator of whether it is eligible to be used as a sub-agent. The library offers a filter to show only composable agents.

**Acceptance Criteria:**
- [ ] Eligible agents show a composable indicator (e.g., 🤝 badge or team icon) on their card in the library
- [ ] Agent Editor detail page shows composable status with explanation
- [ ] Ineligible agents show no indicator (or a greyed-out version with tooltip explaining why)
- [ ] Eligibility is based on the same rules as FR-2 (no custom tools, no excluded_builtin, no sub-agents of its own, has prompt, has description)
- [ ] Agent Library has a filter option to show only composable agents

---

## Data Model Changes

### Agent JSON Schema — New Field

Add `sub_agents` field to the agent config:

```json
{
  "name": "Engineering Lead",
  "description": "...",
  "icon": "👨‍💻",
  "system_message": { "mode": "replace", "content": "..." },
  "model": "claude-sonnet-4",
  "tools": { "custom": [], "builtin": [], "excluded_builtin": [] },
  "mcp_servers": ["github", "ado"],
  "sub_agents": ["build-health-monitor", "code-reviewer"],
  "id": "engineering-lead",
  "created_at": "...",
  "updated_at": "..."
}
```

`sub_agents` is a list of agent IDs (referencing other agents in `~/.copilot-agent-console/agents/`).

### Field Mapping: App Agent → SDK CustomAgentConfig

| App Agent Field | SDK CustomAgentConfig | Mapping |
|---|---|---|
| `id` | `name` | Direct |
| `name` | `display_name` | Direct |
| `description` | `description` | Direct |
| `system_message.content` | `prompt` | Extract content string |
| `tools.builtin` | `tools` | Direct (if non-empty) |
| `mcp_servers` (name list) | `mcp_servers` (full config) | Resolve via `mcp_service.get_servers_for_sdk()` |
| — | `infer` | Always `True` |
| `system_message.mode` | — | Not supported, ignored |
| `model` | — | Not supported, uses session model |
| `tools.custom` | — | Not supported, agent must not have any |
| `tools.excluded_builtin` | — | Not supported, agent must not have any |
| `icon` | — | UI-only, not sent to SDK |

---

## Implementation Details

### Backend Changes

#### `copilot_service.py` — Session Create/Resume

Add `custom_agents` parameter to `create_session()` and `resume_session()`:

```python
async def create_session(self, model, mcp_servers=None, tools=None, 
                         available_tools=None, excluded_tools=None, 
                         system_message=None, custom_agents=None):
    # ... existing code ...
    if custom_agents:
        session_opts["custom_agents"] = custom_agents
```

#### `copilot_service.py` — Validation Function

```python
def validate_sub_agents(sub_agent_configs: list[dict]) -> list[str]:
    """Validate sub-agents are SDK-compatible. Returns list of error messages."""
    errors = []
    for agent in sub_agent_configs:
        name = agent.get("name", "unknown")
        if agent.get("tools", {}).get("custom"):
            errors.append(f"Sub-agent '{name}' has custom tools")
        if agent.get("tools", {}).get("excluded_builtin"):
            errors.append(f"Sub-agent '{name}' has excluded built-in tools")
        if agent.get("sub_agents"):
            errors.append(f"Sub-agent '{name}' has its own sub-agents (nesting not supported)")
    return errors
```

#### `copilot_service.py` — Conversion Function

```python
def convert_to_sdk_custom_agent(agent: dict, mcp_service) -> dict:
    """Convert app agent format to SDK CustomAgentConfig."""
    sdk_agent = {
        "name": agent["id"],
        "display_name": agent["name"],
        "description": agent.get("description", ""),
        "prompt": agent.get("system_message", {}).get("content", ""),
        "infer": True,
    }
    builtin_tools = agent.get("tools", {}).get("builtin", [])
    if builtin_tools:
        sdk_agent["tools"] = builtin_tools
    mcp_names = agent.get("mcp_servers", [])
    if mcp_names:
        sdk_agent["mcp_servers"] = mcp_service.get_servers_for_sdk(mcp_names)
    return sdk_agent
```

#### `agents_service.py` — Eligibility Check

```python
def get_eligible_sub_agents(exclude_agent_id: str = None) -> list[dict]:
    """Return agents eligible to be sub-agents."""
    all_agents = load_all_agents()
    return [a for a in all_agents if 
            a["id"] != exclude_agent_id and
            not a.get("sub_agents") and
            not a.get("tools", {}).get("custom") and
            not a.get("tools", {}).get("excluded_builtin") and
            a.get("system_message", {}).get("content") and
            a.get("description")]
```

### Frontend Changes

#### New Component: `SubAgentSelector.tsx`

Same pattern as `MCPSelector.tsx` and `ToolsSelector.tsx`:
- Dropdown with checkboxes for each sub-agent
- "All | None" toggle
- Shows agent name + icon
- Dark theme support

#### `AgentEditor.tsx` — Sub-Agent Picker

- Add "Sub-Agents" section to the editor form
- Fetch eligible agents via API (`GET /api/agents/eligible-sub-agents?exclude={agentId}`)
- Show selected sub-agents, highlight ineligible ones with warning

#### `SessionItem.tsx` / `ChatPane.tsx`

- When agent has `sub_agents`, populate the SubAgentSelector
- Pass selected sub-agents through to session create API

#### API Endpoint

- `GET /api/agents/eligible-sub-agents?exclude={agentId}` — returns agents eligible as sub-agents

### Session Flow

```
User selects "Engineering Lead" agent
    ↓
Chat view opens
    ├── MCP selector: [github ✓] [ado ✓]
    ├── Tools selector: [grep ✓] [view ✓] ...
    └── Sub-Agents selector: [build-health-monitor ✓] [code-reviewer ✓]
    ↓
User sends first message
    ↓
Backend: validate_sub_agents(sub_agent_configs) → errors?
    ├── YES → return error event via SSE → error bubble in chat
    └── NO → continue
    ↓
Backend: convert_to_sdk_custom_agent(agent, mcp_service) for each
    ↓
Backend: session_opts["custom_agents"] = [converted_agents]
    ↓
SDK: create_session(session_opts)
    ↓
Main agent runs, delegates to sub-agents as needed
```

---

## Limitations & Future Considerations

### Current Limitations
- **One level only** — no agent → sub-agent → sub-sub-agent chains
- **No custom tools on sub-agents** — SDK limitation
- **No tool exclusions on sub-agents** — SDK only supports whitelists
- **No per-agent model** — sub-agents use the session's model
- **CLI agents always present** — `~/.copilot/agents/` agents load regardless

### Future Possibilities
- **Nested agents** — if SDK adds `custom_agents` inside `CustomAgentConfig`
- **Custom tool support** — if SDK adds tool handler attachment per agent
- **Agent marketplace** — shareable agent templates with sub-agent compositions
- **Auto-composition** — suggest sub-agents based on the main agent's prompt
