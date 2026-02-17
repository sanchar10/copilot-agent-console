"""Schedule management API routes."""

from fastapi import APIRouter, HTTPException, Request

from copilot_agent_console.app.models.schedule import ScheduleCreate, ScheduleUpdate
from copilot_agent_console.app.services.schedule_storage_service import schedule_storage_service

router = APIRouter(prefix="/schedules", tags=["schedules"])


@router.get("")
async def list_schedules(request: Request):
    """List all schedules with next-run-time and agent names."""
    scheduler = request.app.state.scheduler
    return scheduler.list_schedules_with_next_run()


@router.post("", status_code=201)
async def create_schedule(request: Request, body: ScheduleCreate):
    """Create a new schedule."""
    schedule = schedule_storage_service.create_schedule(body)
    scheduler = request.app.state.scheduler
    scheduler.add_schedule(schedule)
    return schedule


@router.get("/{schedule_id}")
async def get_schedule(schedule_id: str):
    """Get a schedule by ID."""
    schedule = schedule_storage_service.load_schedule(schedule_id)
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    return schedule


@router.put("/{schedule_id}")
async def update_schedule(request: Request, schedule_id: str, body: ScheduleUpdate):
    """Update a schedule."""
    schedule = schedule_storage_service.update_schedule(schedule_id, body)
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    # Re-register in scheduler with updated config
    scheduler = request.app.state.scheduler
    scheduler.remove_schedule(schedule_id)
    scheduler.add_schedule(schedule)
    return schedule


@router.delete("/{schedule_id}")
async def delete_schedule(request: Request, schedule_id: str):
    """Delete a schedule."""
    scheduler = request.app.state.scheduler
    scheduler.remove_schedule(schedule_id)
    if not schedule_storage_service.delete_schedule(schedule_id):
        raise HTTPException(status_code=404, detail="Schedule not found")
    return {"ok": True}


@router.post("/{schedule_id}/toggle")
async def toggle_schedule(request: Request, schedule_id: str):
    """Toggle a schedule's enabled state."""
    schedule = schedule_storage_service.load_schedule(schedule_id)
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")

    update = ScheduleUpdate(enabled=not schedule.enabled)
    schedule = schedule_storage_service.update_schedule(schedule_id, update)

    scheduler = request.app.state.scheduler
    scheduler.toggle_schedule(schedule_id, schedule.enabled)
    return schedule


@router.post("/{schedule_id}/run-now")
async def run_now(request: Request, schedule_id: str):
    """Trigger an immediate run of a schedule."""
    scheduler = request.app.state.scheduler
    run_id = await scheduler.run_now(schedule_id)
    if not run_id:
        raise HTTPException(status_code=404, detail="Schedule or agent not found")
    return {"run_id": run_id}
