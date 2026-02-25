"""Automation models for the autonomous agent platform.

An automation connects an agent to a cron trigger with a fixed prompt and optional CWD.
One agent can have multiple automations.
"""

from datetime import datetime, timezone
from enum import Enum

from pydantic import BaseModel, Field


class TaskRunStatus(str, Enum):
    """Status of a task run."""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    TIMED_OUT = "timed_out"
    ABORTED = "aborted"


class Automation(BaseModel):
    """A recurring automation that triggers an agent run."""
    id: str = Field(..., description="Unique automation ID (UUID)")
    agent_id: str = Field(..., description="Agent to run")
    name: str = Field(..., description="Display name (e.g. 'Morning news check')")
    cron: str = Field(..., description="Cron expression (e.g. '0 8 * * *')")
    prompt: str = Field(..., description="Fixed prompt sent to agent each run")
    cwd: str | None = Field(default=None, description="Working directory for the run")
    enabled: bool = Field(default=True, description="Whether automation is active")
    max_runtime_minutes: int = Field(default=30, description="Kill task after N minutes")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class AutomationCreate(BaseModel):
    """Request to create an automation."""
    agent_id: str
    name: str
    cron: str
    prompt: str
    cwd: str | None = None
    enabled: bool = True
    max_runtime_minutes: int = 30


class AutomationUpdate(BaseModel):
    """Request to update an automation. All fields optional."""
    agent_id: str | None = None
    name: str | None = None
    cron: str | None = None
    prompt: str | None = None
    cwd: str | None = None
    enabled: bool | None = None
    max_runtime_minutes: int | None = None


class TaskRun(BaseModel):
    """A single execution of an automated (or manual) agent run."""
    id: str = Field(..., description="Unique run ID (UUID)")
    automation_id: str | None = Field(default=None, description="Source automation (null for manual Run Now)")
    agent_id: str = Field(..., description="Agent that was run")
    agent_name: str = Field(default="", description="Agent name snapshot for display")
    prompt: str = Field(default="", description="Prompt sent to agent")
    cwd: str | None = Field(default=None, description="Working directory used")
    status: TaskRunStatus = Field(default=TaskRunStatus.PENDING)
    started_at: datetime | None = Field(default=None)
    completed_at: datetime | None = Field(default=None)
    duration_seconds: float | None = Field(default=None)
    output: str | None = Field(default=None, description="Full agent response text")
    error: str | None = Field(default=None, description="Error message if failed")
    token_usage: dict | None = Field(default=None, description="Token usage stats")
    session_id: str | None = Field(default=None, description="Copilot SDK session ID used")


class TaskRunSummary(BaseModel):
    """Lightweight task run for listing (no output body)."""
    id: str
    automation_id: str | None
    agent_id: str
    agent_name: str
    prompt: str
    cwd: str | None
    status: TaskRunStatus
    started_at: datetime | None
    completed_at: datetime | None
    duration_seconds: float | None
    error: str | None
    session_id: str | None = None
    token_usage: dict | None = None


class AutomationWithNextRun(Automation):
    """Automation with computed next-run-time for API responses."""
    next_run: datetime | None = Field(default=None, description="Next automation run time")
    agent_name: str = Field(default="", description="Resolved agent name for display")
