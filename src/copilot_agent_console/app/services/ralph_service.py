"""Ralph AI Runner execution service.

Orchestrates job execution using the Copilot SDK.
"""

import asyncio
import json
import re
import uuid
from datetime import datetime
from pathlib import Path
from typing import AsyncGenerator, Callable

from copilot import CopilotClient

from copilot_agent_console.app.models.ralph import (
    CreateBatchRequest,
    ExecutionBatch,
    FeedbackRequest,
    RalphRun,
    RunStatus,
    RunSummary,
    StartRunRequest,
    Job,
    JobResult,
    JobSource,
    JobStatus,
    JobType,
)
from copilot_agent_console.app.services.ralph_storage import get_ralph_storage
from copilot_agent_console.app.services.mcp_service import mcp_service
from copilot_agent_console.app.services.tools_service import get_tools_service
from copilot_agent_console.app.services.copilot_service import find_copilot_cli
from copilot_agent_console.app.services.logging_service import get_logger, set_ralph_context
from copilot_agent_console.app.config import APP_HOME

logger = get_logger(__name__)

# Paths for prompts
PROMPTS_DIR = APP_HOME / "prompts"

# Default prompts
DEFAULT_JOB_PROMPT = """You are completing a single job.

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
"""

DEFAULT_FEEDBACK_PROMPT = """You are fixing an issue from a previous job.

## Context
- Working directory: {cwd}

## Original Job
{previous_description}

## What Was Done
{previous_summary}

Files changed: {previous_files}

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
"""


def _ensure_prompts_dir() -> None:
    """Ensure prompts directory exists with default prompts."""
    PROMPTS_DIR.mkdir(parents=True, exist_ok=True)
    
    # Create default prompts if they don't exist
    job_prompt_file = PROMPTS_DIR / "RALPH_PROMPT.md"
    feedback_prompt_file = PROMPTS_DIR / "RALPH_FEEDBACK_PROMPT.md"
    
    if not job_prompt_file.exists():
        job_prompt_file.write_text(DEFAULT_JOB_PROMPT, encoding="utf-8")
    
    if not feedback_prompt_file.exists():
        feedback_prompt_file.write_text(DEFAULT_FEEDBACK_PROMPT, encoding="utf-8")


def _load_prompt(prompt_name: str) -> str:
    """Load a prompt template from disk."""
    _ensure_prompts_dir()
    
    prompt_file = PROMPTS_DIR / prompt_name
    if prompt_file.exists():
        return prompt_file.read_text(encoding="utf-8")
    
    # Return defaults
    if prompt_name == "RALPH_PROMPT.md":
        return DEFAULT_JOB_PROMPT
    elif prompt_name == "RALPH_FEEDBACK_PROMPT.md":
        return DEFAULT_FEEDBACK_PROMPT
    
    return ""


def _parse_ralph_summary(response: str) -> JobResult:
    """Parse RALPH_SUMMARY block from agent response."""
    # Look for the summary block
    pattern = r"---RALPH_SUMMARY---\s*(.*?)\s*---END_SUMMARY---"
    match = re.search(pattern, response, re.DOTALL | re.IGNORECASE)
    
    if not match:
        # No summary block found - create basic result from response
        return JobResult(
            summary=response[:500] + "..." if len(response) > 500 else response,
            files=[],
            assumptions=[],
        )
    
    summary_text = match.group(1).strip()
    
    # Parse the summary sections
    files: list[str] = []
    changes: list[str] = []
    assumptions: list[str] = []
    
    current_section = None
    for line in summary_text.split("\n"):
        line = line.strip()
        if not line:
            continue
        
        lower_line = line.lower()
        if lower_line.startswith("files:"):
            current_section = "files"
            # Try to extract inline files
            files_part = line[6:].strip()
            if files_part and files_part != "[list files created/modified]":
                files.extend([f.strip() for f in files_part.strip("[]").split(",") if f.strip()])
        elif lower_line.startswith("changes:") or lower_line.startswith("fix:"):
            current_section = "changes"
            changes_part = line.split(":", 1)[1].strip()
            if changes_part and changes_part != "[bullet points of what you did]":
                changes.append(changes_part)
        elif lower_line.startswith("assumptions:"):
            current_section = "assumptions"
            assumptions_part = line[12:].strip()
            if assumptions_part and assumptions_part != "[any decisions you made without asking]":
                assumptions.append(assumptions_part)
        elif line.startswith("-") or line.startswith("•"):
            # Bullet point - add to current section
            item = line[1:].strip()
            if current_section == "files":
                files.append(item)
            elif current_section == "changes":
                changes.append(item)
            elif current_section == "assumptions":
                assumptions.append(item)
        elif current_section == "changes":
            changes.append(line)
    
    # Build summary from changes
    summary = "\n".join(changes) if changes else summary_text
    
    return JobResult(
        summary=summary,
        files=files,
        assumptions=assumptions,
    )


def _update_source_file(source: JobSource, completed: bool = True) -> bool:
    """Update source file to mark job as complete.
    
    Returns True if update was successful.
    """
    if not source.update_on_complete or not source.file:
        return False
    
    try:
        file_path = Path(source.file)
        if not file_path.exists():
            logger.warning(f"Source file not found: {source.file}")
            return False
        
        content = file_path.read_text(encoding="utf-8")
        
        if source.pattern:
            # Try to update the specific pattern
            if "[ ]" in source.pattern:
                # Checkbox pattern
                old_pattern = source.pattern
                new_pattern = old_pattern.replace("[ ]", "[x]")
                if old_pattern in content:
                    content = content.replace(old_pattern, new_pattern, 1)
                    file_path.write_text(content, encoding="utf-8")
                    logger.info(f"Updated checkbox in {source.file}")
                    return True
            elif source.pattern.startswith("- ") and "[ ]" not in source.pattern:
                # Regular list item - append " - Done by Ralph"
                if source.pattern in content and "Done by Ralph" not in source.pattern:
                    new_pattern = source.pattern + " - Done by Ralph"
                    content = content.replace(source.pattern, new_pattern, 1)
                    file_path.write_text(content, encoding="utf-8")
                    logger.info(f"Marked list item as done in {source.file}")
                    return True
        
        # If we have line number, try line-based update
        if source.line:
            lines = content.split("\n")
            if 0 < source.line <= len(lines):
                line = lines[source.line - 1]
                if "[ ]" in line:
                    lines[source.line - 1] = line.replace("[ ]", "[x]", 1)
                    file_path.write_text("\n".join(lines), encoding="utf-8")
                    logger.info(f"Updated checkbox at line {source.line} in {source.file}")
                    return True
                elif line.strip().startswith("- ") and "Done by Ralph" not in line:
                    lines[source.line - 1] = line.rstrip() + " - Done by Ralph"
                    file_path.write_text("\n".join(lines), encoding="utf-8")
                    logger.info(f"Marked line {source.line} as done in {source.file}")
                    return True
        
        return False
    except Exception as e:
        logger.error(f"Error updating source file {source.file}: {e}")
        return False


class RalphService:
    """Service for executing Ralph AI Runner jobs."""

    def __init__(self) -> None:
        self._storage = get_ralph_storage()
        self._active_clients: dict[str, CopilotClient] = {}  # run_id -> client
        self._run_locks: dict[str, asyncio.Lock] = {}  # run_id -> lock
        self._stream_callbacks: dict[str, list[Callable[[str], None]]] = {}  # run_id -> callbacks
        # SSE event infrastructure for real-time streaming
        self._run_event_queues: dict[str, list[asyncio.Queue]] = {}  # run_id -> list of subscriber queues
        self._job_event_queues: dict[str, list[asyncio.Queue]] = {}  # job_key -> list of subscriber queues (key = run_id:job_id)

    def _get_job_key(self, run_id: str, job_id: str) -> str:
        """Get unique key for job event queues."""
        return f"{run_id}:{job_id}"

    async def _emit_run_event(self, run_id: str, event: dict) -> None:
        """Emit an event to all subscribers for a run."""
        if run_id in self._run_event_queues:
            for queue in self._run_event_queues[run_id]:
                try:
                    await queue.put(event)
                except Exception as e:
                    logger.warning(f"Error emitting run event: {e}")

    async def _emit_job_event(self, run_id: str, job_id: str, event: dict) -> None:
        """Emit an event to all subscribers for a specific job."""
        job_key = self._get_job_key(run_id, job_id)
        if job_key in self._job_event_queues:
            for queue in self._job_event_queues[job_key]:
                try:
                    await queue.put(event)
                except Exception as e:
                    logger.warning(f"Error emitting job event: {e}")
        # Also emit to run-level subscribers
        await self._emit_run_event(run_id, {"job_id": job_id, **event})

    def _subscribe_to_run(self, run_id: str) -> asyncio.Queue:
        """Subscribe to events for a run. Returns queue to consume."""
        if run_id not in self._run_event_queues:
            self._run_event_queues[run_id] = []
        queue: asyncio.Queue = asyncio.Queue()
        self._run_event_queues[run_id].append(queue)
        return queue

    def _unsubscribe_from_run(self, run_id: str, queue: asyncio.Queue) -> None:
        """Unsubscribe from run events."""
        if run_id in self._run_event_queues:
            try:
                self._run_event_queues[run_id].remove(queue)
                if not self._run_event_queues[run_id]:
                    del self._run_event_queues[run_id]
            except ValueError:
                pass

    def _subscribe_to_job(self, run_id: str, job_id: str) -> asyncio.Queue:
        """Subscribe to events for a specific job. Returns queue to consume."""
        job_key = self._get_job_key(run_id, job_id)
        if job_key not in self._job_event_queues:
            self._job_event_queues[job_key] = []
        queue: asyncio.Queue = asyncio.Queue()
        self._job_event_queues[job_key].append(queue)
        return queue

    def _unsubscribe_from_job(self, run_id: str, job_id: str, queue: asyncio.Queue) -> None:
        """Unsubscribe from job events."""
        job_key = self._get_job_key(run_id, job_id)
        if job_key in self._job_event_queues:
            try:
                self._job_event_queues[job_key].remove(queue)
                if not self._job_event_queues[job_key]:
                    del self._job_event_queues[job_key]
            except ValueError:
                pass

    # ==================== Batches ====================

    def create_batch(self, request: CreateBatchRequest) -> ExecutionBatch:
        """Create a new execution batch."""
        batch_id = f"batch_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:6]}"
        
        batch = ExecutionBatch(
            id=batch_id,
            workspace=request.workspace,
            source_description=request.source_description,
            model=request.model,
            auto_approve=request.auto_approve,
            jobs=request.jobs,
            # Inherit MCP servers and tools from parent session
            mcp_servers=request.mcp_servers,
            tools=request.tools,
        )
        
        self._storage.save_batch(batch)
        logger.info(f"Created batch {batch_id} with {len(request.jobs)} jobs, mcp_servers={bool(request.mcp_servers)}, tools={bool(request.tools)}")
        
        return batch

    def get_batch(self, batch_id: str) -> ExecutionBatch | None:
        """Get an execution batch by ID."""
        return self._storage.load_batch(batch_id)

    def list_batches(self) -> list[ExecutionBatch]:
        """List all execution batches."""
        return self._storage.list_batches()

    def delete_batch(self, batch_id: str) -> bool:
        """Delete an execution batch."""
        return self._storage.delete_batch(batch_id)

    # ==================== Runs ====================

    async def start_run(self, request: StartRunRequest) -> RalphRun:
        """Start a new Ralph run for a batch."""
        batch = self._storage.load_batch(request.batch_id)
        if not batch:
            raise ValueError(f"Batch {request.batch_id} not found")
        
        # Check if workspace already has an active run
        existing_run = self._storage.get_run_for_workspace(batch.workspace)
        if existing_run:
            raise ValueError(f"Workspace {batch.workspace} already has an active run: {existing_run.id}")
        
        # Check max concurrent runs
        active_runs = self._storage.get_active_runs()
        if len(active_runs) >= 10:
            raise ValueError("Maximum 10 concurrent runs reached")
        
        run_id = f"run_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:6]}"
        
        run = RalphRun(
            id=run_id,
            batch_id=batch.id,
            workspace=batch.workspace,
            status=RunStatus.PENDING,
            auto_approve=request.auto_approve if request.auto_approve is not None else batch.auto_approve,
        )
        
        self._storage.save_run(run)
        self._run_locks[run_id] = asyncio.Lock()
        
        logger.info(f"Created run {run_id} for batch {batch.id}")
        
        # Start execution in background with error handling
        task = asyncio.create_task(self._execute_run(run_id))
        task.add_done_callback(lambda t: self._handle_task_exception(t, run_id))
        
        return run
    
    def _handle_task_exception(self, task: asyncio.Task, run_id: str) -> None:
        """Handle exceptions from background tasks."""
        try:
            exc = task.exception()
            if exc:
                logger.error(f"Background task for run {run_id} failed: {exc}", exc_info=exc)
                # Update run status to failed
                run = self._storage.load_run(run_id)
                if run and run.status not in (RunStatus.COMPLETED, RunStatus.FAILED):
                    run.status = RunStatus.FAILED
                    run.error = str(exc)
                    self._storage.save_run(run)
        except asyncio.CancelledError:
            logger.warning(f"Background task for run {run_id} was cancelled")
        except asyncio.InvalidStateError:
            pass  # Task not done yet

    def get_run(self, run_id: str) -> RalphRun | None:
        """Get a run by ID."""
        return self._storage.load_run(run_id)

    def list_runs(self) -> list[RalphRun]:
        """List all runs."""
        return self._storage.list_runs()

    def get_active_runs(self) -> list[RalphRun]:
        """Get all active runs."""
        return self._storage.get_active_runs()

    def get_run_summary(self, run_id: str) -> RunSummary | None:
        """Get a summary of a run."""
        run = self._storage.load_run(run_id)
        if not run:
            return None
        
        batch = self._storage.load_batch(run.batch_id)
        if not batch:
            return None
        
        current_job_desc = None
        if 0 <= run.current_job_index < len(batch.jobs):
            current_job_desc = batch.jobs[run.current_job_index].description
        
        return RunSummary(
            id=run.id,
            batch_id=run.batch_id,
            workspace=run.workspace,
            status=run.status,
            current_job_index=run.current_job_index,
            total_jobs=len(batch.jobs),
            auto_approve=run.auto_approve,
            started_at=run.started_at,
            completed_at=run.completed_at,
            current_job_description=current_job_desc,
        )

    def list_run_summaries(self) -> list[RunSummary]:
        """List all runs as summaries."""
        runs = self._storage.list_runs()
        summaries = []
        for run in runs:
            summary = self.get_run_summary(run.id)
            if summary:
                summaries.append(summary)
        return summaries

    # ==================== Run Control ====================

    async def approve_job(self, run_id: str) -> RalphRun | None:
        """Approve the current job and continue."""
        run = self._storage.load_run(run_id)
        if not run or run.status not in (RunStatus.PAUSED, RunStatus.RUNNING):
            return None
        
        batch = self._storage.load_batch(run.batch_id)
        if not batch:
            return None
        
        # Mark current job as approved
        if 0 <= run.current_job_index < len(batch.jobs):
            job = batch.jobs[run.current_job_index]
            job.status = JobStatus.APPROVED
            
            # Update source file if needed
            if job.source and job.source.update_on_complete:
                _update_source_file(job.source)
            
            self._storage.save_batch(batch)
        
        # Move to next job
        run.current_job_index += 1
        run.status = RunStatus.RUNNING
        self._storage.save_run(run)
        
        logger.info(f"Approved job {run.current_job_index - 1} in run {run_id}")
        
        # Continue execution
        asyncio.create_task(self._execute_run(run_id))
        
        return run

    async def skip_job(self, run_id: str) -> RalphRun | None:
        """Skip the current job and continue."""
        run = self._storage.load_run(run_id)
        if not run or run.status not in (RunStatus.PAUSED, RunStatus.RUNNING):
            return None
        
        batch = self._storage.load_batch(run.batch_id)
        if not batch:
            return None
        
        # Mark current job as skipped
        if 0 <= run.current_job_index < len(batch.jobs):
            job = batch.jobs[run.current_job_index]
            job.status = JobStatus.SKIPPED
            self._storage.save_batch(batch)
        
        # Move to next job
        run.current_job_index += 1
        run.status = RunStatus.RUNNING
        self._storage.save_run(run)
        
        logger.info(f"Skipped job {run.current_job_index - 1} in run {run_id}")
        
        # Continue execution
        asyncio.create_task(self._execute_run(run_id))
        
        return run

    async def retry_job(self, run_id: str) -> RalphRun | None:
        """Retry the current job."""
        run = self._storage.load_run(run_id)
        if not run or run.status not in (RunStatus.PAUSED, RunStatus.RUNNING):
            return None
        
        batch = self._storage.load_batch(run.batch_id)
        if not batch:
            return None
        
        # Reset current job status
        if 0 <= run.current_job_index < len(batch.jobs):
            job = batch.jobs[run.current_job_index]
            job.status = JobStatus.PENDING
            job.result = None
            self._storage.save_batch(batch)
        
        run.status = RunStatus.RUNNING
        self._storage.save_run(run)
        
        logger.info(f"Retrying job {run.current_job_index} in run {run_id}")
        
        # Continue execution (will re-execute current job)
        asyncio.create_task(self._execute_run(run_id))
        
        return run

    async def submit_feedback(self, run_id: str, request: FeedbackRequest) -> RalphRun | None:
        """Submit feedback for the current job (creates feedback job)."""
        run = self._storage.load_run(run_id)
        if not run or run.status not in (RunStatus.PAUSED, RunStatus.RUNNING):
            return None
        
        batch = self._storage.load_batch(run.batch_id)
        if not batch:
            return None
        
        if not (0 <= run.current_job_index < len(batch.jobs)):
            return None
        
        current_job = batch.jobs[run.current_job_index]
        
        # Mark current job as needs_fix
        current_job.status = JobStatus.NEEDS_FIX
        
        # Create feedback job
        feedback_job_id = f"{current_job.id}_fix{sum(1 for j in batch.jobs if j.feedback_for == current_job.id) + 1}"
        
        feedback_job = Job(
            id=feedback_job_id,
            type=JobType.FEEDBACK,
            description=f"Fix: {request.feedback_text}",
            context="",
            feedback_for=current_job.id,
            feedback_text=request.feedback_text,
            previous_job={
                "description": current_job.description,
                "summary": current_job.result.summary if current_job.result else "",
                "files": current_job.result.files if current_job.result else [],
            },
        )
        
        # Insert feedback job as next job
        batch.jobs.insert(run.current_job_index + 1, feedback_job)
        self._storage.save_batch(batch)
        
        # Move to feedback job
        run.current_job_index += 1
        run.status = RunStatus.RUNNING
        self._storage.save_run(run)
        
        logger.info(f"Created feedback job {feedback_job_id} in run {run_id}")
        
        # Continue execution
        asyncio.create_task(self._execute_run(run_id))
        
        return run

    async def set_auto_approve(self, run_id: str, auto_approve: bool) -> RalphRun | None:
        """Toggle auto-approve mode for a run."""
        run = self._storage.load_run(run_id)
        if not run:
            return None
        
        run.auto_approve = auto_approve
        self._storage.save_run(run)
        
        logger.info(f"Set auto_approve={auto_approve} for run {run_id}")
        
        # If turning on auto-approve and paused, continue
        if auto_approve and run.status == RunStatus.PAUSED:
            run.status = RunStatus.RUNNING
            self._storage.save_run(run)
            asyncio.create_task(self._execute_run(run_id))
        
        return run

    async def stop_run(self, run_id: str, force: bool = False) -> RalphRun | None:
        """Stop a run (after current task if not force)."""
        run = self._storage.load_run(run_id)
        if not run or run.status not in (RunStatus.RUNNING, RunStatus.PAUSED, RunStatus.PENDING):
            return None
        
        if force:
            # Force stop - cancel immediately
            run.status = RunStatus.CANCELLED
            run.completed_at = datetime.utcnow()
            self._storage.save_run(run)
            
            # Cleanup client
            if run_id in self._active_clients:
                try:
                    await self._active_clients[run_id].stop()
                except Exception as e:
                    logger.warning(f"Error stopping client for run {run_id}: {e}")
                del self._active_clients[run_id]
            
            logger.info(f"Force stopped run {run_id}")
        else:
            # Graceful stop - mark as paused, will stop after current task
            run.status = RunStatus.PAUSED
            run.auto_approve = False  # Ensure we stop
            self._storage.save_run(run)
            logger.info(f"Requested stop for run {run_id}")
        
        return run

    async def resume_run(self, run_id: str) -> RalphRun | None:
        """Resume a paused or cancelled run."""
        run = self._storage.load_run(run_id)
        if not run or run.status not in (RunStatus.PAUSED, RunStatus.CANCELLED):
            return None
        
        run.status = RunStatus.RUNNING
        run.completed_at = None
        run.error = None
        self._storage.save_run(run)
        
        logger.info(f"Resumed run {run_id}")
        
        # Continue execution
        asyncio.create_task(self._execute_run(run_id))
        
        return run

    def delete_run(self, run_id: str) -> bool:
        """Delete a run (must be completed, cancelled, or failed)."""
        run = self._storage.load_run(run_id)
        if not run:
            return False
        
        if run.status in (RunStatus.RUNNING, RunStatus.PENDING):
            return False  # Can't delete active runs
        
        return self._storage.delete_run(run_id)

    # ==================== Streaming ====================

    async def stream_run(self, run_id: str) -> AsyncGenerator[dict, None]:
        """Stream run updates via SSE.
        
        For completed/cancelled/failed runs: sends final state and closes.
        For active runs: streams job events in real-time, sends state every 5s.
        """
        # Subscribe to run events
        queue = self._subscribe_to_run(run_id)
        
        try:
            # Send initial state
            run = self._storage.load_run(run_id)
            if not run:
                yield {"type": "error", "message": "Run not found"}
                return
            
            batch = self._storage.load_batch(run.batch_id)
            yield {
                "type": "state",
                "run": run.model_dump(),
                "batch": batch.model_dump() if batch else None,
            }
            
            # If already done, send complete and exit
            if run.status in (RunStatus.COMPLETED, RunStatus.CANCELLED, RunStatus.FAILED):
                yield {"type": "complete", "status": run.status}
                return
            
            # For active runs, stream events with periodic state refresh
            state_refresh_interval = 5.0  # Refresh state every 5 seconds
            last_state_time = asyncio.get_event_loop().time()
            
            while True:
                # Check for events (non-blocking with short timeout)
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=0.5)
                    yield event
                except asyncio.TimeoutError:
                    pass
                
                # Periodic state refresh
                current_time = asyncio.get_event_loop().time()
                if current_time - last_state_time >= state_refresh_interval:
                    run = self._storage.load_run(run_id)
                    if not run:
                        yield {"type": "error", "message": "Run not found"}
                        return
                    
                    batch = self._storage.load_batch(run.batch_id)
                    yield {
                        "type": "state",
                        "run": run.model_dump(),
                        "batch": batch.model_dump() if batch else None,
                    }
                    
                    # Check if done
                    if run.status in (RunStatus.COMPLETED, RunStatus.CANCELLED, RunStatus.FAILED):
                        yield {"type": "complete", "status": run.status}
                        return
                    
                    last_state_time = current_time
                    
        except Exception as e:
            logger.warning(f"Error in stream_run for {run_id}: {e}")
            yield {"type": "error", "message": str(e)}
        finally:
            # Always unsubscribe when done
            self._unsubscribe_from_run(run_id, queue)

    async def get_job_history(self, run_id: str, job_id: str) -> dict | None:
        """Get history for a specific job using its SDK session.
        
        Reuses the same pattern as session_service.get_session_with_messages():
        1. Get SDK events via copilot_service.get_session_messages()
        2. Read raw events.jsonl for reasoning text
        3. Merge them together
        
        Returns a dict with messages and job info, or None if not found.
        """
        run = self._storage.load_run(run_id)
        if not run:
            return None
        
        batch = self._storage.load_batch(run.batch_id)
        if not batch:
            return None
        
        # Find the job
        job = None
        for j in batch.jobs:
            if j.id == job_id:
                job = j
                break
        
        if not job:
            return None
        
        # If no SDK session, return just the result
        if not job.sdk_session_id:
            return {
                "job_id": job.id,
                "sdk_session_id": None,
                "status": job.status,
                "result": job.result.model_dump() if job.result else None,
                "messages": [],
                "raw_events": [],
            }
        
        # Get SDK events and raw events using the same pattern as session_service
        from copilot_agent_console.app.services.copilot_service import copilot_service
        from copilot_agent_console.app.services.session_service import read_raw_events
        
        try:
            sdk_events = await copilot_service.get_session_messages(job.sdk_session_id)
            raw_events = read_raw_events(job.sdk_session_id)
            
            # Format events for frontend (simplified compared to session_service)
            messages = []
            for evt in sdk_events:
                evt_type = evt.type.value if hasattr(evt.type, 'value') else str(evt.type)
                data = evt.data
                
                if evt_type == "user.message":
                    content = getattr(data, "content", None)
                    if content:
                        messages.append({"role": "user", "content": content})
                        
                elif evt_type == "assistant.message":
                    content = getattr(data, "content", None)
                    if content:
                        messages.append({"role": "assistant", "content": content})
                        
                elif evt_type == "tool.execution_start":
                    tool = getattr(data, "tool_name", None) or getattr(data, "name", None)
                    messages.append({"role": "tool_start", "tool": tool})
                    
                elif evt_type == "tool.execution_complete":
                    tool = getattr(data, "tool_name", None) or getattr(data, "name", None)
                    result = getattr(data, "result", None)
                    messages.append({
                        "role": "tool_complete",
                        "tool": tool,
                        "result": str(result)[:500] if result else None
                    })
            
            return {
                "job_id": job.id,
                "sdk_session_id": job.sdk_session_id,
                "status": job.status,
                "result": job.result.model_dump() if job.result else None,
                "messages": messages,
                "raw_events": raw_events[-100:],  # Last 100 raw events
            }
            
        except Exception as e:
            logger.error(f"Error getting job history for {job_id}: {e}")
            return {
                "job_id": job.id,
                "sdk_session_id": job.sdk_session_id,
                "status": job.status,
                "result": job.result.model_dump() if job.result else None,
                "messages": [],
                "raw_events": [],
                "error": str(e),
            }

    # ==================== Execution ====================

    async def _execute_run(self, run_id: str) -> None:
        """Execute jobs in a run."""
        # Set ralph context for logging
        set_ralph_context(run_id)
        
        # Acquire lock to prevent concurrent execution
        if run_id not in self._run_locks:
            self._run_locks[run_id] = asyncio.Lock()
        
        async with self._run_locks[run_id]:
            run = self._storage.load_run(run_id)
            if not run:
                logger.error(f"Run not found: {run_id}")
                return
            
            logger.info(f"Starting execution of run {run_id}")
            
            # Check if should continue
            if run.status not in (RunStatus.PENDING, RunStatus.RUNNING):
                logger.info(f"Run {run_id} status is {run.status}, skipping execution")
                return
            
            batch = self._storage.load_batch(run.batch_id)
            if not batch:
                run.status = RunStatus.FAILED
                run.error = "Batch not found"
                self._storage.save_run(run)
                logger.error(f"Batch not found for run {run_id}")
                return
            
            logger.info(f"Loaded batch {batch.id} with {len(batch.jobs)} jobs")
            
            # Start client if needed
            if run_id not in self._active_clients:
                # Find CLI path (same as copilot_service uses)
                cli_path = find_copilot_cli()
                if not cli_path:
                    run.status = RunStatus.FAILED
                    run.error = "Copilot CLI not found"
                    self._storage.save_run(run)
                    logger.error("Copilot CLI not found")
                    return
                
                client = CopilotClient({"cwd": batch.workspace, "cli_path": cli_path})
                await client.start()
                self._active_clients[run_id] = client
                logger.info(f"Started CopilotClient for run {run_id} with cli_path={cli_path}")
            
            client = self._active_clients[run_id]
            
            # Update run status
            if run.status == RunStatus.PENDING:
                run.status = RunStatus.RUNNING
                run.started_at = datetime.utcnow()
                self._storage.save_run(run)
                logger.info(f"Run {run_id} status changed to RUNNING")
            
            # Process jobs
            while run.current_job_index < len(batch.jobs):
                # Check if should stop
                run = self._storage.load_run(run_id)
                if not run or run.status != RunStatus.RUNNING:
                    break
                
                job = batch.jobs[run.current_job_index]
                logger.info(f"Processing job {run.current_job_index + 1}/{len(batch.jobs)}: {job.description[:50]}...")
                
                # Skip already processed jobs
                if job.status in (JobStatus.APPROVED, JobStatus.SKIPPED):
                    logger.info(f"Job {job.id} already processed (status={job.status}), skipping")
                    run.current_job_index += 1
                    self._storage.save_run(run)
                    continue
                
                logger.info(f"Executing job {job.id}: {job.description[:50]}...")
                
                # Mark job as running
                job.status = JobStatus.RUNNING
                self._storage.save_batch(batch)
                
                # Emit job start event
                await self._emit_run_event(run_id, {
                    "type": "job_start",
                    "job_id": job.id,
                    "job_index": run.current_job_index,
                    "description": job.description,
                })
                
                try:
                    # Execute job with streaming
                    result = await self._execute_job(client, batch, job, run_id)
                    job.result = result
                    job.status = JobStatus.PENDING  # Waiting for approval
                    self._storage.save_batch(batch)  # Save includes sdk_session_id
                    
                    logger.info(f"Job {job.id} completed: {result.summary[:100]}...")
                    
                    # Check auto-approve
                    run = self._storage.load_run(run_id)
                    if run and run.auto_approve:
                        # Auto-approve and continue
                        job.status = JobStatus.APPROVED
                        if job.source and job.source.update_on_complete:
                            _update_source_file(job.source)
                        self._storage.save_batch(batch)
                        run.current_job_index += 1
                        self._storage.save_run(run)
                    else:
                        # Pause for human review
                        run.status = RunStatus.PAUSED
                        self._storage.save_run(run)
                        break
                    
                except Exception as e:
                    logger.exception(f"Error executing job {job.id}")
                    job.status = JobStatus.FAILED
                    job.result = JobResult(
                        summary=f"Error: {str(e)}",
                        files=[],
                        assumptions=[],
                    )
                    self._storage.save_batch(batch)
                    
                    # Emit job error event
                    await self._emit_run_event(run_id, {
                        "type": "job_error",
                        "job_id": job.id,
                        "error": str(e),
                    })
                    
                    # Pause on error
                    run = self._storage.load_run(run_id)
                    if run:
                        run.status = RunStatus.PAUSED
                        self._storage.save_run(run)
                    break
            
            # Check if all jobs done
            run = self._storage.load_run(run_id)
            if run and run.current_job_index >= len(batch.jobs) and run.status == RunStatus.RUNNING:
                run.status = RunStatus.COMPLETED
                run.completed_at = datetime.utcnow()
                self._storage.save_run(run)
                
                # Cleanup client
                if run_id in self._active_clients:
                    try:
                        await self._active_clients[run_id].stop()
                    except Exception as e:
                        logger.warning(f"Error stopping client for run {run_id}: {e}")
                    del self._active_clients[run_id]
                
                logger.info(f"Run {run_id} completed")

    async def _execute_job(self, client: CopilotClient, batch: ExecutionBatch, job: Job, run_id: str) -> JobResult:
        """Execute a single job using the Copilot SDK with streaming.
        
        The session inherits configuration from the parent chat session:
        - CWD (workspace): Used as the working directory for the session
        - MCP servers: Same MCP server configurations as parent session
        - Tools: Same tool selections as parent session
        - Model: Same model as specified in the batch
        
        This ensures that job agent sessions have the same capabilities
        as the orchestrating chat session.
        
        Streams events in real-time via the run event queue for live UI updates.
        """
        # Build prompt
        if job.type == JobType.FEEDBACK:
            prompt_template = _load_prompt("RALPH_FEEDBACK_PROMPT.md")
            prompt = prompt_template.format(
                cwd=batch.workspace,
                previous_description=job.previous_job.get("description", "") if job.previous_job else "",
                previous_summary=job.previous_job.get("summary", "") if job.previous_job else "",
                previous_files=", ".join(job.previous_job.get("files", [])) if job.previous_job else "",
                feedback_text=job.feedback_text or "",
            )
        else:
            prompt_template = _load_prompt("RALPH_PROMPT.md")
            prompt = prompt_template.format(
                cwd=batch.workspace,
                description=job.description,
                context=job.context,
            )
        
        # Build session configuration inheriting from parent session
        session_config: dict = {
            "model": batch.model,
            "cwd": batch.workspace,  # Use workspace as CWD for file operations
        }
        
        # Convert MCP server selections to SDK format using the same service as main session
        # This creates the proper SDK-compatible dict format that the Copilot SDK expects
        if batch.mcp_servers:
            mcp_servers_sdk = mcp_service.get_servers_for_sdk(batch.mcp_servers)
            if mcp_servers_sdk:
                session_config["mcp_servers"] = mcp_servers_sdk
                logger.debug(f"Job {job.id}: Loaded {len(mcp_servers_sdk)} MCP servers from parent session selections")
        
        # Convert tool selections to SDK Tool objects using the same service as main session
        # This creates the actual SDK Tool objects with handlers, not just names
        if batch.tools:
            tools_service = get_tools_service()
            tools_sdk = tools_service.get_sdk_tools(batch.tools)
            if tools_sdk:
                session_config["tools"] = tools_sdk
                logger.debug(f"Job {job.id}: Loaded {len(tools_sdk)} tools from parent session selections")
        
        # Create session with inherited configuration (SDK objects, not strings)
        session = await client.create_session(session_config)
        
        # Capture the SDK session ID for history retrieval later
        job.sdk_session_id = session.session_id
        logger.info(f"Created session {session.session_id} for job {job.id} with config: model={batch.model}, cwd={batch.workspace}, mcp={len(session_config.get('mcp_servers', {}))}, tools={len(session_config.get('tools', []))}")
        
        try:
            # Set up streaming event handler
            accumulated_content = ""
            response_complete = asyncio.Event()
            final_content: str | None = None
            
            def handle_event(event):
                """Handle streaming events from SDK session."""
                nonlocal accumulated_content, final_content
                
                evt_type = event.type.value if hasattr(event.type, 'value') else str(event.type)
                data = event.data
                
                # Emit event to run subscribers for live UI updates
                asyncio.create_task(self._emit_run_event(run_id, {
                    "type": "job_event",
                    "job_id": job.id,
                    "event_type": evt_type,
                    "data": {
                        "content": getattr(data, "content", None),
                        "delta": getattr(data, "delta", None),
                        "tool_name": getattr(data, "tool_name", None) or getattr(data, "name", None),
                        "tool_call_id": getattr(data, "tool_call_id", None),
                    }
                }))
                
                # Track content for final result
                if evt_type == "assistant.message.delta":
                    delta = getattr(data, "delta", "")
                    if delta:
                        accumulated_content += delta
                elif evt_type == "assistant.message":
                    content = getattr(data, "content", None)
                    if content:
                        final_content = content
                        response_complete.set()
                elif evt_type == "session.error":
                    response_complete.set()
            
            # Subscribe to events
            unsubscribe = session.on(handle_event)
            
            try:
                # Send prompt (non-blocking, events will stream)
                await session.send({"prompt": prompt})
                
                # Wait for response to complete (with timeout)
                try:
                    await asyncio.wait_for(response_complete.wait(), timeout=600)  # 10 min timeout
                except asyncio.TimeoutError:
                    logger.warning(f"Job {job.id} timed out after 10 minutes")
                    final_content = accumulated_content or "Job timed out"
                
                # Use final content or accumulated content
                content = final_content or accumulated_content
                
                if content:
                    result = _parse_ralph_summary(content)
                else:
                    result = JobResult(
                        summary="No response from agent",
                        files=[],
                        assumptions=[],
                    )
            finally:
                # Unsubscribe from events
                unsubscribe()
                
            # Emit job complete event
            await self._emit_run_event(run_id, {
                "type": "job_complete",
                "job_id": job.id,
                "sdk_session_id": job.sdk_session_id,
                "summary": result.summary[:200] if result.summary else None,
            })
                
        finally:
            # Always destroy session (but keep history accessible via SDK)
            await session.destroy()
        
        return result


# Singleton instance
_ralph_service: RalphService | None = None


def get_ralph_service() -> RalphService:
    """Get the singleton Ralph service instance."""
    global _ralph_service
    if _ralph_service is None:
        _ralph_service = RalphService()
    return _ralph_service
