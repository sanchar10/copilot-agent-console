"""Resolver for which model + reasoning effort an agent should use.

Centralizes the fallback chain so automation, workflows, and any other agent
runner all behave identically. Pair (model, reasoning_effort) is atomic:
either both come from the agent, or both come from app settings — never crossed.
"""

from copilot_console.app.models.agent import Agent
from copilot_console.app.services.storage_service import storage_service


def resolve_agent_model(agent: Agent) -> tuple[str, str | None]:
    """Resolve (model_id, reasoning_effort) for the given agent.

    Resolution order:
      1. If the agent has a model set, return (agent.model, agent.reasoning_effort).
      2. Otherwise fall back to (settings.default_model, settings.default_reasoning_effort).

    The pair is atomic: never mix the agent's model with settings' effort or
    vice versa, because reasoning_effort is meaningful only in the context of
    a specific model.

    Raises:
        ValueError: if no model can be resolved (agent has none AND settings
            has no default_model). Message is user-facing — surfaced in
            TaskRun.error and server log.
    """
    if agent.model:
        return agent.model, agent.reasoning_effort

    settings = storage_service.get_settings()
    default_model = settings.get("default_model")
    if not default_model:
        raise ValueError(
            f"No model configured. Agent '{agent.name}' has no model and "
            f"no default_model is set. Configure one in Settings → Default Model."
        )
    return default_model, settings.get("default_reasoning_effort")
