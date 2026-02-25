# Workflow Orchestration Feature

## Problem
Users need to compose multi-step, multi-agent workflows where agents, tools, MCP servers, and human approvals work together in a defined graph. Current Agent Teams (master + sub-agents via Copilot SDK) have fundamental limitations: excluded_tools cascade, no custom tools on sub-agents, no nesting. A workflow engine bypasses all of these by running each agent in its own independent session.

## Key Concept
**LLM designs the workflow → User approves → Deterministic execution.** The user describes what they want in natural language. An LLM generates the workflow graph (nodes, edges, config). The user reviews and edits in a visual editor. Once approved, execution is fully deterministic — no LLM decides routing at runtime (except for Group Chat orchestrators, which are explicit).

## Design Decisions
- **Engine**: Microsoft Agent Framework (Python, `agent-framework` + `agent-framework-github-copilot`)
- **Independent module** — does NOT refactor existing code. Reads agents/tools/MCPs from existing stores.
- **Agent Teams stays as-is** — lightweight option for simple master→sub-agent delegation. Workflows are the "pro mode."
- **5 node types for v1 design** (but Phase 1 implements Agent + Human only): Agent, Tool, MCP Action, Human, Aggregator
- **5 edge types** (matching AF exactly): Direct, Conditional, Switch-Case, Fan-out, Fan-in
- **Phase 1 scope**: Agent nodes + Human nodes + all edge types (including fan-out/fan-in). Tool/MCP/Aggregator nodes deferred.
- **No "Router" node** — routing is an edge property in AF, not a node type. LLM-based routing = Agent node (classifier) + Switch-Case edges on its output.
- **Group Chat and Magentic are orchestration patterns** (how agents collaborate over multiple turns), not graph primitives. Deferred to v2 as composite nodes or workflow templates.
- **Data model is extensible** — new node types can be added later without schema changes
- **Visual editor**: YAML editor + Mermaid visualization + Chat (all AF-native). React Flow deferred to v2.
- **Storage**: YAML files (AF declarative format) + metadata JSON in `~/.copilot-console/workflows/`
- **Execution**: Each agent node gets its own independent Copilot session (no tool cascade)

## Implementation Principles (Phase 1)

> **No existing pages are modified.** Phase 1 only adds new things — it does NOT touch ChatView, Schedule Manager, or Task Board.

> **SDK-first: use Microsoft Agent Framework, don't reinvent.** All workflow execution, edge routing, fan-out/fan-in, checkpointing, `as_agent()`, streaming, and human-in-the-loop must use AF's built-in capabilities. If a feature appears missing from the SDK, **stop and confirm with user before building a custom implementation.** Never build SDK-level functionality ourselves.

- **Sidebar**: restructure from `AGENTS: [Library, Automations, Runs]` → flat `[Agents, Workflows, Automations, Runs]`. The sidebar entries still open the SAME existing tabs (Agent Library, Schedule Manager, Task Board) — just the menu layout changes.
- **ChatView**: untouched. No changes to agent chat sessions.
- **Schedule Manager (Automations)**: untouched. Unified agent+workflow scheduling is a later phase.
- **Task Board (Runs)**: untouched. Unified agent+workflow run list with type filters is a later phase.
- **New pages only**: Workflow Library, Workflow Editor (YAML + Mermaid + Chat), Workflow Run View — all new tabs, no modifications to existing ones.
- Workflow runs are stored contextually (accessible from Workflow Editor's run history panel). Global Runs page integration is deferred.

## Why Workflows > Agent Teams

| Limitation | Agent Teams (SDK) | Workflows (AF) |
|---|---|---|
| Tool cascade | Parent's `excluded_tools` propagate to ALL sub-agents | ❌ No cascade — each agent is independent |
| Custom tools | Sub-agents can't have custom tools | ✅ Each agent has its own tools |
| MCP servers | Sub-agents inherit parent's MCP config | ✅ Each agent has its own MCP |
| Nesting | No sub-agents of sub-agents | ✅ Agents are peers, no nesting concept |
| Model | All sub-agents use parent's model | ✅ Each agent can use different model |
| Architecture | Star topology (master → sub-agents) | ✅ Any graph topology |
| Tools + agents | Mutually exclusive at session level | ✅ No conflict |

## Architecture

### Node Types (5 — full design; Phase 1 implements Agent + Human only)

#### 1. Agent Node → AF Agent Executor
- Wraps a `GitHubCopilotAgent` from our agent library
- Each agent gets its own independent Copilot SDK session
- Config: agent_id, prompt override (optional), CWD override (optional)
- Input: receives output from previous node(s)
- Output: agent's response text + any files created
- **Also used for LLM-based routing**: an agent with a classifier prompt + structured output → downstream Switch-Case edges route based on agent's decision

#### 2. Tool Node → AF Function Executor
- Wraps a custom tool from our Tool Builder (`~/.copilot-console/tools/`)
- Deterministic Python function execution
- Config: tool_id, parameters (static or mapped from input)
- Input: parameters from previous node
- Output: tool return value

#### 3. MCP Action Node → AF Function Executor (wrapped)
- Wraps a specific MCP server tool call
- Thin Python wrapper that connects to MCP server and invokes tool
- Config: mcp_server_id, tool_name, parameters
- Input: parameters from previous node
- Output: MCP tool response

#### 4. Human Node → AF Human-in-the-loop
- Pauses workflow execution, notifies user via UI
- Two modes:
  - **Approval Gate**: Shows context, user clicks Approve/Reject. Reject can abort or route to alternate path.
  - **Input Step**: Shows context + input form, user provides data that flows to next node.
- Config: mode (approval/input), prompt/instructions, timeout (optional)
- Input: context from previous node (displayed to user)
- Output: approval decision or user-provided data

#### 5. Aggregator Node → AF Fan-in target
- The natural counterpart to fan-out — collects outputs from parallel branches into one
- Two modes:
  - **Collect**: Gathers all outputs into a list/dict (deterministic, no LLM)
  - **Summarize**: Uses an LLM agent to merge/synthesize outputs into one coherent result
- Config: mode (collect/summarize), summarizer_agent_id (if summarize)
- Input: multiple outputs from concurrent branches via `add_fan_in_edge()`
- Output: single merged result

### Future Node Types (v2)
- **Group Chat**: AF Group Chat Orchestration — multi-agent shared conversation (orchestration pattern, not a graph primitive)
- **Magentic**: AF Magentic Orchestration — manager agent dynamically assigns agent teams

### Edge Types (5 — how they map to YAML declarative format)

> Edge types below show both the imperative Python API (for reference) and the YAML declarative equivalent (what we use in Phase 1). In YAML, edges are implicit — they're expressed as step types and sequential ordering.

#### 1. Direct Edge → Python: `add_edge(A, B)` | YAML: sequential steps
- Simple one-to-one connection, no conditions
- In YAML: step B appears after step A — ordering IS the edge
- Use case: linear pipelines (A→B→C)

#### 2. Conditional Edge → Python: `add_edge(A, B, condition=lambda)` | YAML: `If` step
- Binary routing (if/else) based on a PowerFx condition
- In YAML: `type: If`, `condition: "=expression"`, `steps:` (if-true), `elseSteps:` (if-false)
- Use case: simple branching (e.g., "if approved → continue, else → abort")

#### 3. Switch-Case Edge → Python: `add_switch_case_edge_group(...)` | YAML: `Switch` step
- Multi-branch routing from one node to N targets
- In YAML: `type: Switch`, `condition: "=expression"`, `cases:` with `case:` values + `steps:` per case, `default:` block
- Use case: multi-way classification (e.g., agent classifies input → route to different handlers)
- **This is how "LLM routing" works**: Agent node (classifier) → Switch step routes on its output

#### 4. Fan-out → Python: target assigner function | YAML: `parallel` step with branches
- One step launches multiple branches concurrently
- In YAML: `type: parallel`, `branches:` array, each branch has its own `steps:` list
- All branches execute simultaneously — AF manages concurrency
- Use case: parallel processing (e.g., send to researcher + writer + reviewer simultaneously)

#### 5. Fan-in → Python: `add_fan_in_edge(...)` | YAML: implicit — `parallel` block completion
- All branches within a `parallel` step must complete before the next sequential step runs
- Fan-in is **automatic** in YAML — the step after a `parallel` block receives all branch outputs
- No explicit Aggregator node needed for basic fan-in (outputs are collected as a list/dict)
- The **Aggregator node** (Phase W7) adds custom merging logic (LLM summarization) — not required for basic fan-in
- Use case: collecting parallel results for the next step

### Data Models

```
WorkflowMetadata:
  id: str (uuid)
  name: str                    # Display name
  description: str             # What this workflow does
  yaml_filename: str           # Filename of the YAML definition (e.g. "content-pipeline.yaml")
  created_at: datetime
  updated_at: datetime

WorkflowRun:
  id: str (uuid)
  workflow_id: str
  workflow_name: str           # Snapshot
  status: pending | running | paused | completed | failed | aborted
  input: dict | None           # Input parameters
  started_at: datetime | None
  completed_at: datetime | None
  duration_seconds: float | None
  node_results: dict           # {node_id: {status, output, started_at, completed_at, error}}
  error: str | None
  session_id: str | None       # AF session for as_agent() resumption
```

> **No custom WorkflowNode/WorkflowEdge models.** The workflow definition IS the YAML file — AF's declarative format is the source of truth. We only store metadata (name, description, id) alongside it.

### Storage Layout

```
~/.copilot-console/
├── workflows/
│   ├── {workflow-id}.yaml        # AF declarative YAML (the workflow definition)
│   ├── {workflow-id}.meta.json   # Metadata (name, description, id, timestamps)
├── workflow-runs/
│   ├── {date}/
│   │   ├── {run-id}.json        # Run metadata + node results
│   │   └── {run-id}-output.md   # Final output (markdown)
```

### AF Integration Layer (SDK-native — no custom translation)

```python
# workflow_engine.py — loads YAML via AF, executes, streams events

from agent_framework.declarative import AgentFactory
from agent_framework import WorkflowViz, Message

class WorkflowEngine:
    def __init__(self):
        self.agent_factory = AgentFactory()

    async def load(self, yaml_path: str):
        """Load workflow from AF-native YAML — no custom parsing."""
        return self.agent_factory.create_workflow_from_yaml_path(yaml_path)

    async def run_as_agent(self, workflow, user_message: str, session=None):
        """For Agent-start workflows — conversational via as_agent()."""
        agent = workflow.as_agent(name=workflow.name)
        if session is None:
            session = await agent.create_session()
        messages = [Message(role="user", contents=[user_message])]
        async for update in agent.run(messages, session=session, stream=True):
            yield update  # Stream to frontend via SSE (same pattern as agent chat)

    async def run_oneshot(self, workflow, input_params: dict):
        """For non-Agent-start workflows — one-shot execution."""
        result = await workflow.run(input_params)
        return result

    def visualize(self, workflow) -> str:
        """Generate Mermaid diagram from AF's built-in visualization."""
        viz = WorkflowViz(workflow)
        return viz.to_mermaid()
```

> **Principle**: If AF SDK doesn't support something we need (e.g., a step type, a visualization feature), stop and confirm with user before building a custom implementation.

### Agent Name Resolution (Critical Detail)

YAML `CallAgent` steps reference agents by name. Two approaches to connect our agent library:

1. **Inline agent definitions** (preferred for Phase 1): The YAML file includes an `agents:` section defining each agent (name, instructions, model). When saving, we generate this section from our agent library metadata. The YAML is self-contained.
2. **Factory bindings** (v2): Pre-register our agent objects with `AgentFactory`, YAML references them by name only. Requires custom resolver.

Approach 1 is simpler — the YAML editor shows the full agent definitions, users can tweak instructions per-workflow, and AF's `AgentFactory.create_workflow_from_yaml_path()` handles everything natively. **Verify this works during W1 — if it doesn't, stop and discuss.**

### Mermaid Update Flow (Editor ↔ Backend)

When user edits YAML in the editor:
1. Frontend debounces YAML changes (300ms)
2. Sends updated YAML to `GET /api/workflows/{id}/visualize` (or a validation endpoint)
3. Backend loads YAML via `AgentFactory`, calls `WorkflowViz(workflow).to_mermaid()`, returns Mermaid string
4. Frontend renders Mermaid string via `mermaid.js` library
5. If YAML is invalid → backend returns validation error → frontend shows inline error in YAML editor, Mermaid pane shows last valid state

### Frontend Libraries (Phase W4)

- **YAML editor**: Monaco Editor (already used by VS Code — familiar, built-in YAML syntax highlighting, validation hooks)
- **Mermaid renderer**: `mermaid` npm package (renders Mermaid strings to SVG)
- If these choices cause issues during implementation, stop and discuss alternatives.

### Services

- `workflow_storage_service.py` — CRUD for workflow YAML files + metadata JSON
- `workflow_engine.py` — Loads YAML via `AgentFactory`, executes via `as_agent()` or `run()`, visualizes via `WorkflowViz(workflow).to_mermaid()`
- `workflow_run_service.py` — Manages WorkflowRun lifecycle, saves results
- Reuses: `agent_storage_service.py` (load agents), `tool_service.py` (load tools), `mcp_service.py` (MCP connections)

### API Routes

```
POST   /api/workflows              — Create workflow
GET    /api/workflows              — List all workflows
GET    /api/workflows/{id}         — Get workflow detail (metadata + YAML content)
PUT    /api/workflows/{id}         — Update workflow (YAML + metadata)
DELETE /api/workflows/{id}         — Delete workflow
POST   /api/workflows/{id}/run     — Execute workflow (returns run_id, starts SSE stream)
POST   /api/workflows/{id}/design  — LLM generates workflow from description
GET    /api/workflows/{id}/visualize — Get Mermaid diagram string
GET    /api/workflows/{id}/runs    — List runs for this workflow (paginated)
GET    /api/workflow-runs/{run_id} — Get run detail (status, node results)
POST   /api/workflow-runs/{run_id}/input — Send user input (chat message or human approval)
GET    /api/workflow-runs/{run_id}/stream — SSE stream for run events (reconnectable)
```

Workflow runs use our own WorkflowRun model (not TaskRun) in Phase 1:
- Stored in `~/.copilot-console/workflow-runs/{date}/{run-id}.json`
- Accessed from Workflow Editor's run history panel
- TaskRun integration (shared Task Board) is a later phase

### Frontend

#### Sidebar (4 flat entries — no section headers)

```
🤖 Agents (23)       → Agent Library tab (card view of all agents)
🔀 Workflows (5)     → Workflow Library tab (card view of all workflows)
⏰ Automations        → Unified schedule list (agents + workflows, with filters)
📋 Runs               → Unified run list (agents + workflows, with filters)
```

- **Agents** and **Workflows** are separate concepts — not grouped under a section header
- **Automations** and **Runs** are shared across both agent and workflow types
- **Sidebar badges**: Agents/Workflows show total count; Runs shows **active count** (running + paused), not total
- Current sidebar layout: replaces the old "AGENTS" section (Library, Automations, Runs sub-entries)

#### Navigation Hierarchy

```
Workflow Library (card view)
  → Click workflow card → Workflow Editor tab (editor + run history)
    → Click Run or ▶️ → Workflow Run tab (graph + chat/events)

Agent Library (card view)
  → Click agent card → Agent Detail tab
    → Click Chat → Chat Session tab

Runs (unified list)
  → Click agent run → simple text output view
  → Click workflow run → Workflow Run tab (graph + node-by-node)

Automations (unified list)
  → Click schedule → edit form (type-specific: agent prompt/CWD vs workflow input params)
```

#### Automations (Unified Schedule Manager) — FUTURE PHASE, not Phase 1

> Phase 1: Automations sidebar entry opens the existing Schedule Manager tab unchanged.

Future design — extends the Schedule Manager to handle both agents and workflows:

- **Unified list** with type column: shows all schedules (agent + workflow) in one table
- **Filter bar**: `[All] [Agent ▾] [Workflow ▾]`
  - Agent selected → secondary filter: specific agent dropdown
  - Workflow selected → secondary filter: specific workflow dropdown
- **"New Schedule" button** → **Step 1: pick target type** (Agent or Workflow) — this selection drives the entire form layout
  - **Agent schedule form**: agent selector, prompt, CWD, cron expression, output format
  - **Workflow schedule form**: workflow selector, input parameters (dynamic form from workflow's `input_schema`), cron expression
  - Type selection is first because it determines which fields, selectors, and validation rules apply
- **Shared columns**: Name, Type, Schedule (cron), Enabled, Next Run, Last Status
- **Click row** → opens type-specific edit form

#### Runs (Unified Task Board) — FUTURE PHASE, not Phase 1

> Phase 1: Runs sidebar entry opens the existing Task Board tab unchanged.

Future design — extends the Task Board to handle both agents and workflows:

- **Unified list** with type column: shows all runs in one table
- **Filter bar**: `[All] [Agent ▾] [Workflow ▾]` + status filter `[Running] [Completed] [Failed] [Paused]`
  - Agent selected → secondary filter: specific agent dropdown
  - Workflow selected → secondary filter: specific workflow dropdown
- **Date range filter**: essential at 1000s of runs — default to "Last 7 days", presets for 24h/7d/30d/custom
- **Server-side pagination**: API returns paginated results (`skip`/`top`), not all runs loaded client-side
- **Summary bar** at top: `12 Running · 3 Paused · 847 Completed · 5 Failed` (quick glance)
- **Shared columns**: Name, Type, Status, Started, Duration, Error
- **Click agent run** → text output view (existing behavior)
- **Click workflow run** → Workflow Run View (see below)

#### Workflow Library

- Card view showing all saved workflows (like Agent Library)
- **Search bar**: type-ahead filter by name/description (essential at 100+ items)
- **Sort options**: name, last edited, last run status
- Each card: name, description, node count, last run status, last edited
- Cards: click to open Workflow Editor, hover for quick actions (Run, Duplicate, Delete)
- **Client-side filtering** is fine up to ~500 items (JSON files are small); add server-side if needed later
- **"+ New Workflow"** button → opens blank Workflow Editor
- **"Generate with AI"** button → prompt dialog → LLM creates workflow → opens in editor

> **Note on Agent Library**: same search/sort enhancements should be added to Agent Library for consistency at scale.

#### Workflow Editor (YAML + Mermaid + Chat — all AF-native)

Three-pane layout:

```
┌──────────────────────────┬───────────────────────────┐
│                          │                           │
│   Mermaid Diagram        │   YAML Editor             │
│   (read-only viz from    │   (editable, AF-native    │
│    WorkflowViz.to_mermaid)│    declarative format)    │
│                          │                           │
├──────────────────────────┴───────────────────────────┤
│   Chat panel (collapsible bottom)                    │
│   "Add a conditional branch after the researcher"   │
│   → LLM updates YAML → diagram + editor refresh     │
└──────────────────────────────────────────────────────┘
```

- **YAML pane** (right): AF's declarative YAML format — `kind: Workflow`, `steps:`, `If`, `Switch`, `CallAgent`, PowerFx conditions. User can edit directly. Syntax highlighting + validation.
- **Mermaid pane** (left): auto-generated from AF's `WorkflowViz(workflow).to_mermaid()` — read-only visualization of the workflow graph. Re-renders on every YAML change (debounced — send to backend, get Mermaid string back).
- **Chat pane** (bottom, collapsible): natural language workflow building. User describes what they want → LLM generates/modifies the YAML → both panes update. Handles complex logic (conditions, fan-out, branches) that's hard to write by hand.
- **Workflow loading**: `AgentFactory.create_workflow_from_yaml_path()` — AF parses YAML natively, no custom parser needed.
- **Top toolbar**: Save, Run, Export, Undo/Redo
- **Run history panel** (collapsible): shows runs of THIS workflow, loads 10 at a time with infinite scroll (load more on scroll to bottom). Click run → opens Workflow Run tab. **Built in Phase 1.**
  - Global Runs page also shows workflow runs (with filters) — **deferred to when Runs page is extended for workflows.**
- **No React Flow in Phase 1** — Mermaid visualization is sufficient. React Flow drag-drop editor is a v2 enhancement.

#### Workflow Run View

Opened when user clicks Run (from editor toolbar or library card). Opens as a new tab.

- **Left panel**: Mermaid diagram (from AF's `WorkflowViz.to_mermaid()`)
  - In Phase 1: static diagram showing workflow structure with node status indicators
  - Status conveyed via node labels or styling (e.g., `✅ Researcher`, `⏳ Writer`, `❌ Reviewer`)
  - Click node → detail popover shows input/output/duration/error
- **Right panel**: Chat-like panel (always the same component — behavior varies by start node)
  - **If first node is Agent → `workflow.as_agent()` (conversational)** ← Phase 1 primary path:
    - Text input is active — user types first message → workflow starts
    - Multi-turn: after workflow completes, user can send follow-up messages (session persists via `InMemoryHistoryProvider`)
    - Streaming: each agent's output appears with `[author_name]` attribution
    - Human-in-the-loop: surfaced as `FunctionApprovalRequestContent` → rendered as Approve/Reject buttons in chat
    - Always uses `as_agent()` — strictly more capable than `run()`, no downside
  - **If first node is Human → `workflow.run()` (one-shot)** ← Phase 1 edge case:
    - If workflow has `input_schema` → form rendered in chat panel, user fills and clicks submit
    - If no input needed → workflow auto-starts
    - After start, **input is disabled** — one-shot execution, no follow-up messages
    - Outputs stream in as event cards (node name, output, duration)
    - Human nodes show Approve/Reject/Input form inline in the event stream
  - **If first node is Tool/MCP → `workflow.run()` (one-shot)** ← Phase W7 (deferred):
    - Same as Human-start but triggered by Tool/MCP node availability
  - **Same panel component** — just toggles between chat input enabled/disabled based on start node type
- **Status bar**: overall workflow status, elapsed time, current node

## User Experience Flows

### 1. Create a Workflow
**Manual**: Sidebar → Workflows → ➕ New Workflow → blank YAML editor → write YAML directly → Save
**AI-assisted**: ➕ New Workflow → type description in chat pane → LLM generates AF-native YAML → review/tweak in YAML editor → Save

### 2. Run a Workflow
- Click ▶️ Run (from editor toolbar or library card hover action)
- **New tab opens**: Workflow Run View (graph left, chat panel right)
- **Agent-start workflow** (Phase 1 primary): chat input is active → user types first message → workflow starts → streaming responses appear → user can send follow-ups (multi-turn)
- **Human-start workflow** (Phase 1 edge case): form appears for user input → workflow starts → events stream in → input disabled
- **Human nodes mid-workflow**: workflow pauses → Approve/Reject/Input form appears inline → user responds → workflow resumes

### 3. See Results
- **From the Run tab** (still open): graph shows final state (all green/red), chat panel shows full output
- **From Runs sidebar entry**: unified list of all runs → click a workflow run → reopens Workflow Run View with completed state
- Each node expandable: input received, output produced, duration, tokens, errors

## Tasks

### Phase W1: Foundation — Models, Storage, Engine
- [ ] Install `agent-framework` and `agent-framework-github-copilot` packages
- [ ] Create `models/workflow.py` — WorkflowMetadata + WorkflowRun models
- [ ] Create `services/workflow_storage_service.py` — CRUD for workflow YAML files + metadata JSON
- [ ] Create `services/workflow_engine.py` — Load YAML via `AgentFactory`, execute, visualize via `WorkflowViz`
  - `as_agent()` for Agent-start workflows (conversational)
  - `run()` for non-Agent-start workflows (one-shot)
  - Agent name resolution: map our agent library names → AF agents
- [ ] Create `services/workflow_run_service.py` — WorkflowRun lifecycle, save results to `workflow-runs/`
- [ ] Verify AF integration works end-to-end with a simple 2-agent sequential YAML workflow
- [ ] **Streaming**: SSE for workflow events (same pattern as agent chat — `EventSourceResponse`)
- [ ] **User input**: POST endpoint for chat messages and human approvals

### Phase W2: Human Node + All Edge Types
- [ ] Human step — `RequestInfoExecutor` for approval gates and user input
- [ ] Conditional steps — `If` with PowerFx conditions in YAML
- [ ] Switch-Case steps — `Switch` with multiple branches in YAML
- [ ] Fan-out — parallel execution via YAML declarative syntax
- [ ] Fan-in — collecting parallel outputs into a single result

### Phase W3: API Routes
- [ ] Create `routers/workflows.py` — Workflow CRUD + run + design + visualization + run detail + input
- [ ] Register routes in main.py

### Phase W4: Frontend — Workflow Editor + Library
- [ ] Workflow Library tab (card view with search/sort)
- [ ] Workflow Editor tab — three-pane layout:
  - Mermaid diagram pane (`WorkflowViz.to_mermaid()`, re-renders on YAML change)
  - YAML editor pane (syntax highlighting, validation, editable)
  - Chat pane (collapsible bottom — LLM generates/modifies YAML)
- [ ] Workflow Run View tab — Mermaid diagram (left) + chat/events panel (right)
- [ ] Run history panel in editor (paginated, infinite scroll)
- [ ] Sidebar restructure — flat 4 entries: Agents, Workflows, Automations, Runs
- [ ] Add workflow tab types to tab store

### Phase W5: Frontend — LLM Workflow Design (Chat)
- [ ] Chat pane in editor — user describes workflow → LLM generates AF-native YAML
- [ ] POST /api/workflows/{id}/design endpoint — LLM reads available agents/tools/MCPs, generates YAML

### Phase W6: Types, Store & Tests
- [ ] TypeScript types for Workflow metadata
- [ ] API client functions for workflow endpoints
- [ ] Zustand store for workflows
- [ ] Error handling — YAML validation errors, execution failures
- [ ] Tests for workflow engine, storage, API routes

### Phase W7 (Future): Tool/MCP/Aggregator Nodes
- [ ] Tool node — AF Function Executor wrapping our custom tools. Bind via `AgentFactory(bindings={...})`
- [ ] MCP Action node — AF Function Executor wrapping MCP server tool calls
- [ ] Aggregator node — collect mode (list) + summarize mode (LLM merge), fan-in target
- [ ] YAML `type: tool` step support for standalone function execution

### Phase W8 (Future): Orchestration Patterns & Visual Editor
- [ ] React Flow drag-drop editor (visual editing layer on top of YAML)
- [ ] **Orchestration patterns as a separate workflow type** — these use Python builders (NOT YAML):
  - Handoff orchestration — `HandoffBuilder`: mesh topology, agents transfer control dynamically
  - Group Chat orchestration — `GroupChatBuilder`: star topology with orchestrator, iterative refinement
  - Magentic orchestration — `MagenticBuilder`: dynamic planning manager, stall detection, HITL plan review
- [ ] Workflow type selector on creation: "Graph Workflow" (YAML, Phase 1) vs "Handoff" / "Group Chat" / "Magentic" (config form, Phase W8)
- [ ] Configuration form for orchestration patterns (select agents, set rules/parameters, termination conditions)
- [ ] Sub-workflows — a workflow node that contains another workflow
- [ ] Checkpointing — AF checkpoint/resume for long-running workflows
- [ ] Workflow templates — pre-built workflows shipped as seed data

## Notes
- Agent Framework is pre-release (`pip install agent-framework --pre`) — risk is manageable since workflow module is independent
- AF has native `GitHubCopilotAgent` via `agent-framework-github-copilot` package
- Each agent node creates its own Copilot SDK session — true isolation, no tool cascade
- **Visualization**: `WorkflowViz(workflow).to_mermaid()` (Python) — returns Mermaid string. Also supports `.to_digraph()` for DOT format.
- AF has OpenTelemetry observability built in
- AF supports checkpointing natively — useful for resuming after Human nodes or failures
- **Streaming transport**: SSE (`sse_starlette` / `EventSourceResponse`) — same pattern as agent chat. User input via POST endpoints.
- **Phase 1 node types**: Agent + Human only. Tool, MCP, Aggregator deferred to Phase W7.
- Group Chat / Magentic / Handoff are orchestration patterns — they use dedicated Python builders (`GroupChatBuilder`, `MagenticBuilder`, `HandoffBuilder`), NOT the declarative YAML format. They're a fundamentally different workflow type. Deferred to Phase W8.
- Workflow definitions are separate from agent definitions (one agent → many workflows)
- LLM workflow generation: agent reads available agents/tools/MCPs, generates AF-native declarative YAML
- Agent Teams stays as-is — lightweight option, not replaced by workflows
- **WorkflowRun is our own model** in Phase 1 — not integrated with TaskRun / Task Board. Integration deferred.

## Scale Considerations

Designed for: **100s of agents/workflows, 1000s of runs, 10s of schedules**

| View | Expected Scale | Strategy |
|---|---|---|
| Agent Library | 100s | Client-side search/filter/sort (JSON metadata is small). Search bar + sort dropdown. |
| Workflow Library | 100s | Same as agents — client-side search/filter/sort. Card view with search. |
| Automations | 10-99 | Simple list — no pagination needed. Filter by type + specific agent/workflow. |
| Runs | 1000s | **Server-side pagination** (`skip`/`top` on API). Date range filter (default: 7 days). Status filter. Summary bar. |

Key patterns:
- **Libraries**: load all metadata once (file count × ~1KB = ~100KB for 100 items), filter/search client-side. If scale exceeds ~500, add server-side search.
- **Runs**: never load all — always paginated. Default view shows recent + active runs. API supports `skip`, `top`, `status`, `target_type`, `target_id`, `date_from`, `date_to` query params.
- **Sidebar badge for Runs**: shows active count (running + paused), not total — useful at any scale.
- **No virtual scrolling needed in v1**: card views paginate at ~50/page, run list paginates at ~25/page. Virtual scroll is a v2 optimization if needed.
