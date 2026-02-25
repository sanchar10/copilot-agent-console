# Workflow Checkpoint & Recovery

> **Status:** Planned — not yet implemented  
> **Depends on:** W1 workflow orchestration (complete)  
> **AF support:** Built-in via `CheckpointStorage` / `FileCheckpointStorage`

## Problem

When a workflow run crashes mid-execution (server restart, process kill, unhandled error),
the run is lost. Long-running workflows (10+ steps, human-in-the-loop) are especially
vulnerable. AF provides checkpoint storage but no auto-recovery — that's on us.

## What AF Provides (Built-in)

```python
from agent_framework import FileCheckpointStorage

storage = FileCheckpointStorage("~/.copilot-console/workflow-checkpoints")

# Normal run — checkpoints saved automatically after each step
async for event in workflow.run(message="start", checkpoint_storage=storage, stream=True):
    ...

# Resume from checkpoint — skips completed steps
async for event in workflow.run(checkpoint_id="abc-123", checkpoint_storage=storage, stream=True):
    ...

# Query checkpoints
storage.get_latest(workflow_name="my-workflow")
storage.list_checkpoints(workflow_name="my-workflow")
storage.list_checkpoint_ids(workflow_name="my-workflow")
```

**WorkflowCheckpoint** contains: `workflow_name`, `graph_signature_hash`, `checkpoint_id`,
`previous_checkpoint_id`, `timestamp`, `messages`, `state`, `pending_request_info_events`,
`iteration_count`, `metadata`, `version`.

## What We Need to Build

### 1. Enable Checkpoint Storage (Quick Win)

- Pass `FileCheckpointStorage` to `run_oneshot()` and `run_as_agent()` by default
- Storage path: `~/.copilot-console/workflow-checkpoints/{run_id}/`
- Store `checkpoint_id` in `WorkflowRun` model for resume reference

### 2. Manual Resume (UI)

- Add "Resume" button on failed/stuck runs in WorkflowRunView
- Backend: `POST /workflows/{id}/runs/{run_id}/resume`
- Loads workflow YAML, gets latest checkpoint, calls `workflow.run(checkpoint_id=...)`
- Shows resumed event stream via SSE (same as normal run)

### 3. Startup Recovery (Automatic)

- On server startup, scan for runs with status `in_progress` that have checkpoints
- Mark as `interrupted` (new status) — not failed, not completed
- Option A: Auto-resume interrupted runs on startup
- Option B: Show them in UI with "Resume" prompt (safer — user decides)

### 4. Scheduled Run Recovery

- Task scheduler fires runs via `task_runner_service`
- If server crashes mid-run, the cron job won't re-trigger that instance
- Startup recovery (above) catches these — same mechanism

### 5. Checkpoint Cleanup

- Delete checkpoints when run completes successfully
- Retain for configurable period on failure (for debugging)
- Add cleanup to workflow run delete endpoint

## Model Changes

```python
class WorkflowRun(BaseModel):
    # ... existing fields ...
    checkpoint_id: str | None = None         # Latest checkpoint ID for resume
    checkpoint_storage_path: str | None = None  # Path to checkpoint files
```

New run status: `interrupted` — run was in progress when server stopped.

## Open Questions

- Should we checkpoint every step or only on long-running workflows?
  (AF checkpoints after every step by default when storage is provided)
- Checkpoint retention policy — how long to keep on disk?
- Should resumed runs create a new run ID or reuse the original?
