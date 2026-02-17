"""Agent storage service for CRUD operations on agent definitions.

Stores agent definitions as JSON files in ~/.copilot-agent-console/agents/.
"""

import json
import re
from datetime import datetime
from pathlib import Path

from copilot_agent_console.app.config import AGENTS_DIR, ensure_directories
from copilot_agent_console.app.models.agent import Agent, AgentCreate, AgentUpdate


class AgentStorageService:
    """Handles agent definition persistence."""

    def __init__(self) -> None:
        ensure_directories()

    def _agent_file(self, agent_id: str) -> Path:
        return AGENTS_DIR / f"{agent_id}.json"

    def _generate_id(self, name: str) -> str:
        """Generate a URL-safe slug from agent name."""
        slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
        if not slug:
            slug = "agent"
        # Ensure uniqueness
        candidate = slug
        counter = 1
        while self._agent_file(candidate).exists():
            candidate = f"{slug}-{counter}"
            counter += 1
        return candidate

    def save_agent(self, agent: Agent) -> None:
        """Save an agent definition to disk."""
        data = agent.model_dump()
        data["created_at"] = agent.created_at.isoformat()
        data["updated_at"] = agent.updated_at.isoformat()
        self._agent_file(agent.id).write_text(
            json.dumps(data, indent=2, default=str), encoding="utf-8"
        )

    def load_agent(self, agent_id: str) -> Agent | None:
        """Load an agent definition by ID."""
        agent_file = self._agent_file(agent_id)
        if not agent_file.exists():
            return None
        try:
            data = json.loads(agent_file.read_text(encoding="utf-8"))
            return Agent(**data)
        except (json.JSONDecodeError, IOError, ValueError):
            return None

    def list_agents(self) -> list[Agent]:
        """List all agent definitions."""
        agents = []
        if AGENTS_DIR.exists():
            for agent_file in sorted(AGENTS_DIR.glob("*.json")):
                try:
                    data = json.loads(agent_file.read_text(encoding="utf-8"))
                    agents.append(Agent(**data))
                except (json.JSONDecodeError, IOError, ValueError):
                    pass
        return agents

    def create_agent(self, request: AgentCreate) -> Agent:
        """Create a new agent definition."""
        agent_id = self._generate_id(request.name)
        now = datetime.utcnow()
        agent = Agent(
            id=agent_id,
            created_at=now,
            updated_at=now,
            **request.model_dump(),
        )
        self.save_agent(agent)
        return agent

    def update_agent(self, agent_id: str, request: AgentUpdate) -> Agent | None:
        """Update an existing agent definition. Returns None if not found."""
        agent = self.load_agent(agent_id)
        if not agent:
            return None

        update_data = request.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(agent, field, value)
        agent.updated_at = datetime.utcnow()

        self.save_agent(agent)
        return agent

    def delete_agent(self, agent_id: str) -> bool:
        """Delete an agent definition. Returns True if deleted."""
        agent_file = self._agent_file(agent_id)
        if not agent_file.exists():
            return False
        agent_file.unlink()
        return True


# Singleton instance
agent_storage_service = AgentStorageService()
