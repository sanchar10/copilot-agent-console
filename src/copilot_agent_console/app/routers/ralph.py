"""Ralph AI Runner API router."""

import asyncio
import json
from typing import AsyncGenerator

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from copilot_agent_console.app.models.ralph import (
    CreateBatchRequest,
    ExecutionBatch,
    FeedbackRequest,
    RalphRun,
    RunSummary,
    StartRunRequest,
)
from copilot_agent_console.app.services.ralph_service import get_ralph_service

router = APIRouter(prefix="/ralph", tags=["ralph"])


# ==================== Batches ====================

@router.post("/batches", response_model=ExecutionBatch)
async def create_batch(request: CreateBatchRequest) -> ExecutionBatch:
    """Create a new execution batch."""
    service = get_ralph_service()
    return service.create_batch(request)


@router.get("/batches", response_model=list[ExecutionBatch])
async def list_batches() -> list[ExecutionBatch]:
    """List all execution batches."""
    service = get_ralph_service()
    return service.list_batches()


@router.get("/batches/{batch_id}", response_model=ExecutionBatch)
async def get_batch(batch_id: str) -> ExecutionBatch:
    """Get an execution batch by ID."""
    service = get_ralph_service()
    batch = service.get_batch(batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail=f"Batch {batch_id} not found")
    return batch


@router.delete("/batches/{batch_id}")
async def delete_batch(batch_id: str) -> dict:
    """Delete an execution batch."""
    service = get_ralph_service()
    if not service.delete_batch(batch_id):
        raise HTTPException(status_code=404, detail=f"Batch {batch_id} not found")
    return {"status": "deleted"}


# ==================== Runs ====================

@router.post("/runs", response_model=RalphRun)
async def start_run(request: StartRunRequest) -> RalphRun:
    """Start a new Ralph run for a batch."""
    service = get_ralph_service()
    try:
        return await service.start_run(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/runs", response_model=list[RunSummary])
async def list_runs() -> list[RunSummary]:
    """List all runs as summaries."""
    service = get_ralph_service()
    return service.list_run_summaries()


@router.get("/runs/active", response_model=list[RunSummary])
async def list_active_runs() -> list[RunSummary]:
    """List all active runs."""
    service = get_ralph_service()
    active_runs = service.get_active_runs()
    summaries = []
    for run in active_runs:
        summary = service.get_run_summary(run.id)
        if summary:
            summaries.append(summary)
    return summaries


@router.get("/runs/{run_id}", response_model=RunSummary)
async def get_run(run_id: str) -> RunSummary:
    """Get a run summary by ID."""
    service = get_ralph_service()
    summary = service.get_run_summary(run_id)
    if not summary:
        raise HTTPException(status_code=404, detail=f"Run {run_id} not found")
    return summary


@router.get("/runs/{run_id}/full", response_model=dict)
async def get_run_full(run_id: str) -> dict:
    """Get full run details including batch."""
    service = get_ralph_service()
    run = service.get_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail=f"Run {run_id} not found")
    
    batch = service.get_batch(run.batch_id)
    
    return {
        "run": run.model_dump(),
        "batch": batch.model_dump() if batch else None,
    }


@router.delete("/runs/{run_id}")
async def delete_run(run_id: str) -> dict:
    """Delete a run (must be completed, cancelled, or failed)."""
    service = get_ralph_service()
    if not service.delete_run(run_id):
        raise HTTPException(status_code=400, detail="Cannot delete active run or run not found")
    return {"status": "deleted"}


# ==================== Run Control ====================

@router.post("/runs/{run_id}/approve", response_model=RalphRun)
async def approve_job(run_id: str) -> RalphRun:
    """Approve the current job and continue."""
    service = get_ralph_service()
    run = await service.approve_job(run_id)
    if not run:
        raise HTTPException(status_code=400, detail="Cannot approve job")
    return run


@router.post("/runs/{run_id}/skip", response_model=RalphRun)
async def skip_job(run_id: str) -> RalphRun:
    """Skip the current job and continue."""
    service = get_ralph_service()
    run = await service.skip_job(run_id)
    if not run:
        raise HTTPException(status_code=400, detail="Cannot skip job")
    return run


@router.post("/runs/{run_id}/retry", response_model=RalphRun)
async def retry_job(run_id: str) -> RalphRun:
    """Retry the current job."""
    service = get_ralph_service()
    run = await service.retry_job(run_id)
    if not run:
        raise HTTPException(status_code=400, detail="Cannot retry job")
    return run


@router.post("/runs/{run_id}/feedback", response_model=RalphRun)
async def submit_feedback(run_id: str, request: FeedbackRequest) -> RalphRun:
    """Submit feedback for the current job."""
    service = get_ralph_service()
    run = await service.submit_feedback(run_id, request)
    if not run:
        raise HTTPException(status_code=400, detail="Cannot submit feedback")
    return run


@router.post("/runs/{run_id}/auto-approve", response_model=RalphRun)
async def set_auto_approve(run_id: str, auto_approve: bool) -> RalphRun:
    """Set auto-approve mode for a run."""
    service = get_ralph_service()
    run = await service.set_auto_approve(run_id, auto_approve)
    if not run:
        raise HTTPException(status_code=404, detail=f"Run {run_id} not found")
    return run


@router.post("/runs/{run_id}/stop", response_model=RalphRun)
async def stop_run(run_id: str, force: bool = False) -> RalphRun:
    """Stop a run (graceful or forced)."""
    service = get_ralph_service()
    run = await service.stop_run(run_id, force=force)
    if not run:
        raise HTTPException(status_code=400, detail="Cannot stop run")
    return run


@router.post("/runs/{run_id}/resume", response_model=RalphRun)
async def resume_run(run_id: str) -> RalphRun:
    """Resume a paused or cancelled run."""
    service = get_ralph_service()
    run = await service.resume_run(run_id)
    if not run:
        raise HTTPException(status_code=400, detail="Cannot resume run")
    return run


# ==================== Job History ====================

@router.get("/runs/{run_id}/jobs/{job_id}/history")
async def get_job_history(run_id: str, job_id: str) -> dict:
    """Get history for a specific job including SDK events and raw events.
    
    Returns messages and tool executions from the job's SDK session.
    """
    service = get_ralph_service()
    history = await service.get_job_history(run_id, job_id)
    if not history:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found in run {run_id}")
    return history


# ==================== Streaming ====================

@router.get("/runs/{run_id}/stream")
async def stream_run(run_id: str) -> StreamingResponse:
    """Stream run updates via Server-Sent Events."""
    service = get_ralph_service()
    
    # Verify run exists
    run = service.get_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail=f"Run {run_id} not found")
    
    async def event_generator() -> AsyncGenerator[str, None]:
        async for event in service.stream_run(run_id):
            yield f"data: {json.dumps(event, default=str)}\n\n"
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    )
