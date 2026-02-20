"""Agent definition API router."""

from fastapi import APIRouter, HTTPException

from copilot_agent_console.app.models.agent import Agent, AgentCreate, AgentUpdate
from copilot_agent_console.app.services.agent_storage_service import agent_storage_service

router = APIRouter(prefix="/agents", tags=["agents"])


@router.post("", response_model=Agent)
async def create_agent(request: AgentCreate) -> Agent:
    """Create a new agent definition."""
    return agent_storage_service.create_agent(request)


@router.get("", response_model=list[Agent])
async def list_agents() -> list[Agent]:
    """List all agent definitions."""
    return agent_storage_service.list_agents()


@router.get("/eligible-sub-agents", response_model=list[Agent])
async def get_eligible_sub_agents(exclude: str | None = None) -> list[Agent]:
    """Get agents eligible to be used as sub-agents."""
    return agent_storage_service.get_eligible_sub_agents(exclude_agent_id=exclude)


@router.get("/{agent_id}", response_model=Agent)
async def get_agent(agent_id: str) -> Agent:
    """Get an agent definition by ID."""
    agent = agent_storage_service.load_agent(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent


@router.put("/{agent_id}", response_model=Agent)
async def update_agent(agent_id: str, request: AgentUpdate) -> Agent:
    """Update an agent definition."""
    agent = agent_storage_service.update_agent(agent_id, request)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent


@router.delete("/{agent_id}")
async def delete_agent(agent_id: str) -> dict:
    """Delete an agent definition."""
    if not agent_storage_service.delete_agent(agent_id):
        raise HTTPException(status_code=404, detail="Agent not found")
    return {"deleted": True}
