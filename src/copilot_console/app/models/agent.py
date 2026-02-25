"""Agent definition models for the autonomous agent platform.

An agent is a pure capability template: system prompt, model, tools, MCP servers.
Automations are separate — one agent can have multiple automations with different CWDs and inputs.
"""

from datetime import datetime, timezone

from pydantic import BaseModel, Field


class SystemMessage(BaseModel):
    """System message configuration for an agent."""
    mode: str = Field(
        default="replace",
        description="How to apply the system message: 'replace' overrides Copilot default, 'append' adds to it"
    )
    content: str = Field(default="", description="The system prompt content")


class AgentTools(BaseModel):
    """Tool configuration for an agent."""
    custom: list[str] = Field(
        default_factory=list,
        description="List of custom/local tool names from ~/.copilot-console/tools/"
    )
    builtin: list[str] = Field(
        default_factory=list,
        description="Opt-in: list of SDK built-in tool names to enable. Empty = all built-in tools."
    )
    excluded_builtin: list[str] = Field(
        default_factory=list,
        description="Opt-out: list of SDK built-in tool names to disable. Ignored if builtin is non-empty."
    )


class StarterPrompt(BaseModel):
    """A starter prompt suggestion shown when a session is created from an agent."""
    title: str = Field(..., description="Short label for the prompt (3-5 words)")
    prompt: str = Field(..., description="Full prompt text sent to chat on click")


class AgentBase(BaseModel):
    """Base agent fields shared across create/update/full models."""
    name: str = Field(..., description="Display name of the agent")
    description: str = Field(default="", description="What this agent does — shown in UI and sent to LLM")
    icon: str = Field(default="🤖", description="Emoji icon for the agent")
    system_message: SystemMessage = Field(
        default_factory=SystemMessage,
        description="System prompt configuration"
    )
    model: str = Field(default="claude-sonnet-4", description="Model to use")
    tools: AgentTools = Field(
        default_factory=AgentTools,
        description="Tool configuration"
    )
    mcp_servers: list[str] = Field(
        default_factory=list,
        description="List of enabled MCP server names (references globally-configured MCP servers)"
    )
    sub_agents: list[str] = Field(
        default_factory=list,
        description="List of agent IDs to use as sub-agents (Agent Teams)"
    )
    starter_prompts: list[StarterPrompt] = Field(
        default_factory=list,
        description="Starter prompt suggestions shown in chat when session is created from this agent (max 4)"
    )


class AgentCreate(AgentBase):
    """Request to create a new agent."""
    pass


class AgentUpdate(BaseModel):
    """Request to update an agent. All fields optional."""
    name: str | None = None
    description: str | None = None
    icon: str | None = None
    system_message: SystemMessage | None = None
    model: str | None = None
    tools: AgentTools | None = None
    mcp_servers: list[str] | None = None
    sub_agents: list[str] | None = None
    starter_prompts: list[StarterPrompt] | None = None


class Agent(AgentBase):
    """Full agent model with metadata."""
    id: str = Field(..., description="Unique agent ID (slug)")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Config:
        from_attributes = True
