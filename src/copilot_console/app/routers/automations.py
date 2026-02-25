"""Automation management API routes."""

from fastapi import APIRouter, HTTPException, Request

from copilot_console.app.models.automation import AutomationCreate, AutomationUpdate
from copilot_console.app.services.automation_storage_service import automation_storage_service

router = APIRouter(prefix="/automations", tags=["automations"])


@router.get("")
async def list_automations(request: Request):
    """List all automations with next-run-time and agent names."""
    svc = request.app.state.automation_service
    return svc.list_automations_with_next_run()


@router.post("", status_code=201)
async def create_automation(request: Request, body: AutomationCreate):
    """Create a new automation."""
    automation = automation_storage_service.create_automation(body)
    svc = request.app.state.automation_service
    svc.add_automation(automation)
    return automation


@router.get("/{automation_id}")
async def get_automation(automation_id: str):
    """Get an automation by ID."""
    automation = automation_storage_service.load_automation(automation_id)
    if not automation:
        raise HTTPException(status_code=404, detail="Automation not found")
    return automation


@router.put("/{automation_id}")
async def update_automation(request: Request, automation_id: str, body: AutomationUpdate):
    """Update an automation."""
    automation = automation_storage_service.update_automation(automation_id, body)
    if not automation:
        raise HTTPException(status_code=404, detail="Automation not found")
    # Re-register with updated config
    svc = request.app.state.automation_service
    svc.remove_automation(automation_id)
    svc.add_automation(automation)
    return automation


@router.delete("/{automation_id}")
async def delete_automation(request: Request, automation_id: str):
    """Delete an automation."""
    svc = request.app.state.automation_service
    svc.remove_automation(automation_id)
    if not automation_storage_service.delete_automation(automation_id):
        raise HTTPException(status_code=404, detail="Automation not found")
    return {"ok": True}


@router.post("/{automation_id}/toggle")
async def toggle_automation(request: Request, automation_id: str):
    """Toggle an automation's enabled state."""
    automation = automation_storage_service.load_automation(automation_id)
    if not automation:
        raise HTTPException(status_code=404, detail="Automation not found")

    update = AutomationUpdate(enabled=not automation.enabled)
    automation = automation_storage_service.update_automation(automation_id, update)

    svc = request.app.state.automation_service
    svc.toggle_automation(automation_id, automation.enabled)
    return automation


@router.post("/{automation_id}/run-now")
async def run_now(request: Request, automation_id: str):
    """Trigger an immediate run of an automation."""
    svc = request.app.state.automation_service
    run_id = await svc.run_now(automation_id)
    if not run_id:
        raise HTTPException(status_code=404, detail="Automation or agent not found")
    return {"run_id": run_id}
