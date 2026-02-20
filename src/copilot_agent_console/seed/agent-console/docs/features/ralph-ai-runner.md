# Feature: Ralph AI Runner

## Summary
Intelligent batch job execution that spawns fresh agent sessions for each job. Named after the [Ralph Loop pattern](https://ghuntley.com/loop/) by Geoffrey Huntley, Ralph AI Runner extends the concept with AI-powered job discovery and flexible input sources. The Prep agent intelligently gathers jobs from ANY source (files, folders, URLs, direct prompts), creates an Execution Batch, then backend runs it deterministically.

## Background

### The Ralph Pattern
- Each iteration = fresh agent context (no memory bloat)
- One job per iteration (focused, predictable)
- Script orchestrates, agent executes
- Human reviews between iterations (manual mode) or runs unattended (auto mode)

### Architecture (Two-Phase)

**Phase 1: Prep (Intelligent Agent - Flexible Job Discovery)**
```
┌─────────────────────────────────────────────────────────────────┐
│  USER INPUT (flexible - any of these)                           │
│                                                                 │
│  "Start ralph"                   → Agent searches for job file  │
│  "Ralph on backlog.md"           → Agent reads specific file    │
│  "Ralph: do all features in docs/features/" → Agent scans dir   │
│  "Ralph on these: 1. X, 2. Y"    → Jobs from prompt directly    │
│  "Ralph: get jobs from https://..." → Agent fetches URL         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Ralph Skill Activated (~/.copilot/skills/ralph-runner/)        │
│                                                                 │
│  Prep Agent (normal chat session, follows skill instructions):  │
│    1. Interprets user intent                                    │
│    2. Gathers jobs using available tools:                       │
│       - read_file → parse job files                             │
│       - list_dir → scan folders                                 │
│       - fetch_webpage → get jobs from URLs                      │
│       - conversation → user provides directly                   │
│    3. Builds job list from ANY format/source                    │
│    4. Asks clarifying questions if needed                       │
│    5. Shows summary: "Found N jobs. Here's the batch..."        │
│    6. User confirms batch                                       │
│    7. Runs: scripts/create_batch.py --session-id X --jobs [...] │
│    8. Shows batch details, user confirms to start               │
│    9. Runs: scripts/start_batch.py --batch-id Y                 │
│  (Agent is FREE for other work)                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Phase 2: Execution (Deterministic Backend Loop)**
```
┌─────────────────────────────────────────┐
│  Backend Ralph Service (NO AI)          │
│  1. Load execution batch                │
│  2. For each pending job:               │
│     a. Read prompt template from app    │
│     b. Fill with job data               │
│     c. Spawn fresh SDK session          │
│     d. Stream response to Monitor UI    │
│     e. Parse & store RALPH_SUMMARY      │
│     f. Wait for human (manual mode)     │
│     g. Update job status                │
│  3. On complete: mark batch done        │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  Sub-Agent (fresh Copilot SDK session)  │
│  - Inherits parent session config:      │
│    • CWD (workspace folder)             │
│    • MCP server configurations          │
│    • Tool selections                    │
│    • Model                              │
│  - Receives ONE job prompt              │
│  - Has workspace file access            │
│  - Completes job, NO QUESTIONS          │
│  - Outputs RALPH_SUMMARY block          │
│  - Exits                                │
└─────────────────────────────────────────┘
```

### Session Inheritance

When Ralph creates sub-agent sessions for each job, they **inherit configuration from the parent chat session** that initiated the run:

| Setting | Inherited? | Notes |
|---------|------------|-------|
| **CWD (workspace)** | ✅ Yes | Used as working directory for file operations |
| **MCP Servers** | ✅ Yes | Same MCP server selections, converted to SDK format at execution time |
| **Tools** | ✅ Yes | Same tool selections, converted to SDK Tool objects at execution time |
| **Model** | ✅ Yes | Same model as specified in the execution batch |
| **System Prompt** | ❌ No | Sub-agent uses Ralph's job-specific prompt template |

**Why inherit?**
- **Consistency**: Jobs execute in the same environment as the orchestrating session
- **MCP Access**: If parent session has database or API MCP servers, sub-agents can use them
- **Tool Availability**: If parent has custom tools enabled, sub-agents get them too
- **CWD Context**: File operations are relative to the same workspace

**How it works:**
1. When creating an execution batch, the parent session's `mcp_servers` and `tools` **selections** (`dict[str, bool]`) are stored in the batch
2. When Ralph executes a job, these selections are converted to SDK objects:
   - `mcp_service.get_servers_for_sdk(selections)` → SDK-compatible MCP server dict
   - `tools_service.get_sdk_tools(selections)` → list of SDK `Tool` objects with handlers
3. The sub-agent session is created with these SDK objects, not strings
4. This uses the **same services** as the main chat session, ensuring identical configuration

### Job Sources (Fully Flexible)

| Source | Example |
|--------|---------|
| Direct prompt | "Ralph: write unit tests for all files in src/utils/" |
| File reference | "Ralph on backlog.md" |
| Folder scan | "Ralph: implement all features in docs/features/ that have unchecked items" |
| URL | "Ralph: get poem list from https://example.com/poems and write each one" |
| Combination | "Check TODO.md and also add the jobs I'm about to list..." |
| Auto-discovery | "Start ralph" → agent looks for backlog.md, queue.md, TODO.md, docs/features/ |

**The prep agent is intelligent.** It figures out WHERE jobs are and WHAT they mean.

### Why Execution Batch?
- **Source-agnostic** - doesn't matter where jobs came from
- **Clarifications persisted** - not lost in chat history
- **Deterministic loop** - backend just reads batch, no AI for orchestration
- **Feedback handled** - new jobs inserted into batch (see below)
- **Resumable** - batch has status per job
- **Auditable** - full record of what was planned vs executed

### Why Script for Execution, Not Agent?
The orchestration logic is deterministic:
- Read job from batch
- Fill prompt template
- Spawn session
- Parse output

No intelligence needed. Script is faster, cheaper, and more reliable.

## Execution Batch Format

The execution batch is source-agnostic - same format regardless of where jobs came from.

```json
{
  "id": "batch_20260131_143000",
  "workspace": "/path/to/project",
  "source": "backlog.md + user clarifications",
  "mode": "manual",
  "created_at": "2026-01-31T14:30:00Z",
  "current_job_index": 2,
  "jobs": [
    {
      "id": "j1",
      "type": "planned",
      "description": "Add user authentication with OAuth",
      "context": "Use Google OAuth. See existing auth patterns in src/auth/.",
      "source": {
        "file": "docs/features/auth.md",
        "line": 45,
        "pattern": "- [ ] Add user authentication with OAuth",
        "update_on_complete": true
      },
      "status": "approved",
      "result": {
        "summary": "Implemented Google OAuth login flow",
        "files": ["src/auth/google.ts", "src/pages/login.tsx"],
        "assumptions": ["Used next-auth library"]
      }
    },
    {
      "id": "j2",
      "type": "planned",
      "description": "Create dashboard page with user stats",
      "context": "Show login count, last active, etc. Use existing Card component.",
      "status": "needs_fix",
      "result": {
        "summary": "Created dashboard with stats cards",
        "files": ["src/pages/dashboard.tsx"],
        "assumptions": []
      }
    },
    {
      "id": "j2_fix1",
      "type": "feedback",
      "feedback_for": "j2",
      "feedback_text": "Stats should refresh automatically every 30 seconds",
      "previous_job": {
        "description": "Create dashboard page with user stats",
        "summary": "Created dashboard with stats cards",
        "files": ["src/pages/dashboard.tsx"]
      },
      "status": "pending"
    }
  ]
}
```

**Core fields:** `description`, `context`, `status`, `result` - the batch is generic, not tied to any specific file format.

**Optional `source` field:** For jobs extracted from files (feature docs, backlogs), the prep agent can track the source location. When `update_on_complete` is true and user approves the job, Ralph updates the source file (e.g., checks `[ ]` → `[x]`). This maintains dev workflow fidelity without requiring a fixed file structure.

## Feedback Handling (Deterministic)

When user submits feedback, backend does (NO AI):

1. **Create feedback job** from template data:
   ```json
   {
     "id": "{job_id}_fix{n}",
     "type": "feedback",
     "feedback_for": "{job_id}",
     "feedback_text": "{user's feedback}",
     "previous_job": {
       "description": "{original job's description}",
       "summary": "{original job's result.summary}",
       "files": "{original job's result.files}"
     },
     "status": "pending"
   }
   ```

2. **Insert as next job** in batch

3. **Mark original job** as `needs_fix`

4. **Continue loop** → picks up feedback job

**All context comes from stored data, not AI interpretation.**

## File Locations

| File | Location | Purpose |
|------|----------|--------|
| `RALPH_PROMPT.md` | **App:** `docs/RALPH_PROMPT.md` | Prompt template for planned jobs |
| `RALPH_FEEDBACK_PROMPT.md` | **App:** `docs/RALPH_FEEDBACK_PROMPT.md` | Prompt template for feedback jobs |
| Execution batches | **App data:** `~/.copilot-web/ralph/{batch_id}.json` | All batches (active + history) |

**Note:** No fixed workspace file requirements. Prep agent finds jobs from whatever source user specifies.

## Prompt Templates (in app)

### Planned Job Prompt
```markdown
<!-- docs/RALPH_PROMPT.md -->
You are completing a single job.

## Context
- Working directory: {cwd}

## Your Job
{description}

## Additional Context
{context}

## Rules
1. Complete ONLY this specific job - nothing more
2. DO NOT ask questions - make reasonable assumptions
3. If unsure, choose the simpler approach
4. Document assumptions in comments if significant
5. Make minimal, focused changes
6. Verify your changes work (run relevant commands if needed)
7. STOP when done - do not ask for feedback or next steps

## Output Format
When complete, output:

---RALPH_SUMMARY---
Files: [list files created/modified]
Changes: [bullet points of what you did]
Assumptions: [any decisions you made without asking]
---END_SUMMARY---
```

### Feedback Job Prompt
```markdown
<!-- docs/RALPH_FEEDBACK_PROMPT.md -->
You are fixing an issue from a previous job.

## Context
- Working directory: {cwd}

## Original Job
{previous_job.description}

## What Was Done
{previous_job.summary}

Files changed: {previous_job.files}

## Problem to Fix
{feedback_text}

## Rules
1. Fix ONLY the specific issue mentioned
2. DO NOT refactor or improve other things
3. DO NOT ask questions - the feedback IS the instruction
4. Verify the fix works
5. STOP when done

## Output Format
---RALPH_SUMMARY---
Files: [files modified]
Fix: [what you fixed]
---END_SUMMARY---
```

## Acceptance Criteria

### Ralph Skill (~/.copilot/skills/ralph-runner/)
- [ ] SKILL.md with name/description triggers on "ralph", "batch job", etc.
- [ ] SKILL.md contains complete prep workflow instructions
- [ ] scripts/create_batch.py - creates batch via backend API
- [ ] scripts/start_batch.py - starts run via backend API
- [ ] Scripts query session config (cwd, model, mcp_servers, tools) for inheritance

### Prep Phase (Skill-Guided Agent Workflow)
- [ ] User invokes in chat: "Start ralph", "Ralph on [file]", "Ralph: [jobs]", etc.
- [ ] Skill activates, agent follows SKILL.md instructions
- [ ] If no job source specified, agent searches for common files (backlog.md, queue.md, TODO.md)
- [ ] If not found, agent asks: "Which file has your job list?" or accepts direct jobs
- [ ] Agent uses tools to gather jobs (read_file, list_dir, fetch_webpage, conversation)
- [ ] Agent interprets jobs from ANY format (checklist, numbered list, prose, etc.)
- [ ] Agent asks clarifying questions for ambiguous jobs
- [ ] Agent shows batch summary: "Found N jobs. Here's the batch: ..."
- [ ] User confirms batch
- [ ] Agent runs scripts/create_batch.py with session-id and jobs
- [ ] Agent shows batch details (inherited config, job count)
- [ ] User confirms to start (or edits/cancels)
- [ ] Agent runs scripts/start_batch.py with batch-id
- [ ] Agent informs user run is active, they can monitor in Ralph panel
- [ ] Agent is free for other work after triggering run

### Execution (Deterministic Backend)
- [ ] `POST /api/ralph/batches` - save execution batch
- [ ] `POST /api/ralph/start` - start run for a batch → {run_id}
- [ ] Reads job from batch (source-agnostic)
- [ ] Selects prompt template based on job type (planned vs feedback)
- [ ] Fills template with job data
- [ ] Fresh SDK session created per iteration
- [ ] Sub-agent response streams via SSE to Monitor UI
- [ ] Parses RALPH_SUMMARY from output, stores in job.result
- [ ] Updates job status based on user action

### Human Controls (Deterministic - No AI)
- [ ] Approve: marks job `approved`, proceeds to next
- [ ] If job has `source.update_on_complete`, update source file on approve (e.g., `[ ]` → `[x]`)
- [ ] Skip: marks job `skipped`, proceeds to next
- [ ] Retry: same job, new sub-agent (job stays `pending`)
- [ ] Feedback: creates feedback job from template, inserts as next, marks original `needs_fix`

### Run Constraints
- [ ] Max 10 concurrent runs across all workspaces
- [ ] Only ONE run per workspace (prevent conflicts)
- [ ] Starting run in workspace with active run shows error

### Run Modes
- [ ] Manual mode: pause after each job, wait for human
- [ ] Auto mode: continue until queue empty or error

### Cancellation
- [ ] "Stop After Current" button: completes current iteration, then stops
- [ ] "Force Stop" button: kills current agent immediately (warns about partial state)
- [ ] Stopped runs can be resumed later

### Progress Display
- [ ] Auto-parsed activity from tool calls (file created, modified, command run)
- [ ] Agent summary parsed from RALPH_SUMMARY block
- [ ] Shows current job from batch
- [ ] Shows batch progress (e.g., "Job 3 of 12")

### History & Persistence
- [ ] All batches persisted to `~/.copilot-web/ralph/{batch_id}.json`
- [ ] Batch status derived from job states (no separate active/history folders)
- [ ] Batches survive app restart
- [ ] Each job stores: description, context, status, result
- [ ] History viewable in UI
- [ ] Can delete batch history

### Monitor UI
- [ ] Dedicated Ralph panel (sidebar or route)
- [ ] Run switcher: dropdown to select active run
- [ ] Shows all active runs with workspace/progress
- [ ] Click to switch monitor view to that run
- [ ] History section shows past completed runs

### API Endpoints
- [ ] `POST /api/ralph/batches` - save execution batch → {batch_id}
- [ ] `POST /api/ralph/start` - start run for batch → {run_id}
- [ ] `GET /api/ralph/active` - list active runs
- [ ] `GET /api/ralph/{id}` - get run state
- [ ] `GET /api/ralph/{id}/stream` - SSE stream for run
- [ ] `POST /api/ralph/{id}/approve` - approve current job
- [ ] `POST /api/ralph/{id}/skip` - skip current job
- [ ] `POST /api/ralph/{id}/retry` - retry current job
- [ ] `POST /api/ralph/{id}/feedback` - submit feedback (creates new job)
- [ ] `POST /api/ralph/{id}/stop` - graceful stop
- [ ] `POST /api/ralph/{id}/force-stop` - immediate stop
- [ ] `POST /api/ralph/{id}/resume` - resume stopped run
- [ ] `GET /api/ralph/history` - list completed batches
- [ ] `DELETE /api/ralph/history/{id}` - delete from history

### Error Handling
- [ ] Sub-agent timeout handling (configurable)
- [ ] Invalid batch format shows error
- [ ] Run can be stopped/resumed after errors

## UI Wireframes

### Ralph Dashboard
```
┌─────────────────────────────────────────────────────────┐
│  Ralph AI Runner            [Run: project-a/folder ▾]   │
├─────────────────────────────────────────────────────────┤
│  Active Runs:                                           │
│  ● project-a / folder-browser    3/8   ← viewing        │
│  ● project-b / auth-system       1/5                    │
│  ⏸ project-c / api-routes        2/7   (paused)         │
├─────────────────────────────────────────────────────────┤
```

### Run Monitor (selected run)
```
│                                                         │
│  Mode: Manual          Progress: 3/8 jobs               │
│  Job: Modal shows folder list from backend              │
│  Type: planned                                          │
│                                                         │
│  Activity:                                              │
│  ├─ 📄 Created: FolderBrowserModal.tsx                 │
│  ├─ ✏️ Modified: Header.tsx                            │
│  └─ 🖥️ Ran: npm run typecheck (✓)                      │
│                                                         │
│  Summary:                                               │
│  - Added modal component with folder list               │
│  - Assumed: Using existing Modal base component         │
│                                                         │
│  [✅ Approve] [⏭️ Skip] [🔄 Retry]                      │
│  Feedback: [____________________________] [Send]        │
│                                                         │
│  [⏸️ Stop After Current] [⏹️ Force Stop]               │
├─────────────────────────────────────────────────────────┤
│  History: [View completed runs →]                       │
└─────────────────────────────────────────────────────────┘
```

## Implementation Files

| Layer | File | Purpose |
|-------|------|--------|
| **Skill** | `~/.copilot/skills/ralph-runner/SKILL.md` | Prep workflow instructions |
| **Skill** | `~/.copilot/skills/ralph-runner/scripts/create_batch.py` | Creates execution batch via API |
| **Skill** | `~/.copilot/skills/ralph-runner/scripts/start_batch.py` | Starts run via API |
| Backend | `routers/ralph.py` | API endpoints |
| Backend | `services/ralph_service.py` | Loop orchestration |
| Backend | `services/ralph_storage.py` | Batch persistence |
| Backend | `models/ralph.py` | Data models |
| Frontend | `components/ralph/RalphMonitor.tsx` | Monitor UI |
| Frontend | `components/ralph/RunSwitcher.tsx` | Run selector |
| Frontend | `stores/ralphStore.ts` | State management |
| Frontend | `api/ralph.ts` | API client |
| App | `docs/RALPH_PROMPT.md` | Planned job template |
| App | `docs/RALPH_FEEDBACK_PROMPT.md` | Feedback job template |

## Decisions Made
1. ~~Feedback same session or new?~~ → New agent via feedback job in batch
2. ~~Where does UI live?~~ → Dedicated Ralph panel with run switcher
3. ~~Fixed file structure required?~~ → No, fully flexible job sources
4. ~~How prep triggers execution?~~ → Copilot Skill with bundled scripts (not generic tools)
5. ~~History persistence?~~ → Single folder ~/.copilot-web/ralph/, status derived from data
6. ~~Multiple runs?~~ → Yes, max 10, one per workspace
7. ~~Feedback handling?~~ → Deterministic: template + stored job data, no AI
8. ~~Job sources?~~ → Fully flexible: files, folders, URLs, direct prompt, auto-discovery
9. ~~Feature name?~~ → "Ralph AI Runner" - credits source, indicates intelligence, describes function
10. ~~Source file tracking?~~ → Optional `source` metadata for updating checkboxes in source files
11. ~~Skill vs Tools?~~ → Skill with scripts - self-contained, includes instructions + scripts in one package

## Future Considerations

### Parallelization
Current design runs jobs sequentially (one worker). Future enhancement:
- Multiple parallel workers (e.g., "Ralph is running 3 workers")
- Worker-aware job distribution
- Parallel progress display in Monitor UI
- Conflict detection for overlapping file changes
- Max workers per workspace setting
