"""Ralph AI Runner models."""

from datetime import datetime, timezone
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class JobType(str, Enum):
    """Type of job in the execution batch."""
    PLANNED = "planned"
    FEEDBACK = "feedback"


class JobStatus(str, Enum):
    """Status of a job in the execution batch."""
    PENDING = "pending"
    RUNNING = "running"
    APPROVED = "approved"
    SKIPPED = "skipped"
    NEEDS_FIX = "needs_fix"
    FAILED = "failed"


class RunStatus(str, Enum):
    """Status of a Ralph run."""
    PENDING = "pending"       # Created but not started
    RUNNING = "running"       # Actively processing jobs
    PAUSED = "paused"         # Paused by user (waiting for review)
    COMPLETED = "completed"   # All jobs done
    CANCELLED = "cancelled"   # Cancelled by user
    FAILED = "failed"         # Failed due to error


class JobSource(BaseModel):
    """Optional source tracking for a job."""
    file: str = Field(..., description="Source file path")
    line: int | None = Field(default=None, description="Line number in source file")
    pattern: str | None = Field(default=None, description="Pattern to match in file for updates")
    update_on_complete: bool = Field(default=False, description="Whether to update source file on completion")


class JobResult(BaseModel):
    """Result from executing a job."""
    summary: str = Field(..., description="Summary of what was done")
    files: list[str] = Field(default_factory=list, description="Files created/modified")
    assumptions: list[str] = Field(default_factory=list, description="Assumptions made during execution")


class Job(BaseModel):
    """A single job in the execution batch."""
    id: str = Field(..., description="Unique job ID")
    type: JobType = Field(default=JobType.PLANNED, description="Job type")
    description: str = Field(..., description="What needs to be done")
    context: str = Field(default="", description="Additional context for the job")
    source: JobSource | None = Field(default=None, description="Optional source tracking")
    status: JobStatus = Field(default=JobStatus.PENDING, description="Current status")
    result: JobResult | None = Field(default=None, description="Result after execution")
    
    # SDK session tracking - stores the session ID of the sub-agent that executed this job
    # Used to retrieve conversation history via SDK.get_session(sdk_session_id)
    sdk_session_id: str | None = Field(default=None, description="SDK session ID of the sub-agent that executed this job")
    
    # Feedback job specific fields
    feedback_for: str | None = Field(default=None, description="Job ID this feedback is for")
    feedback_text: str | None = Field(default=None, description="User's feedback text")
    previous_job: dict[str, Any] | None = Field(default=None, description="Previous job context for feedback")


class ExecutionBatch(BaseModel):
    """Execution batch for Ralph AI Runner."""
    id: str = Field(..., description="Unique batch ID")
    workspace: str = Field(..., description="Workspace directory path")
    source_description: str = Field(default="", description="Description of where jobs came from")
    model: str = Field(..., description="Model to use for execution")
    auto_approve: bool = Field(default=False, description="Auto-approve jobs without human review")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    jobs: list[Job] = Field(default_factory=list, description="List of jobs to execute")
    # Inherited from parent chat session - stored as selection dicts (name -> enabled)
    # These are converted to SDK objects at execution time using the same services as main session
    mcp_servers: dict[str, bool] | None = Field(default=None, description="MCP server selections inherited from parent session (name -> enabled)")
    tools: dict[str, bool] | None = Field(default=None, description="Tool selections inherited from parent session (name -> enabled)")


class RalphRun(BaseModel):
    """A Ralph AI Runner execution run."""
    id: str = Field(..., description="Unique run ID")
    batch_id: str = Field(..., description="Associated execution batch ID")
    workspace: str = Field(..., description="Workspace directory path")
    status: RunStatus = Field(default=RunStatus.PENDING, description="Current run status")
    current_job_index: int = Field(default=0, description="Index of current job being processed")
    auto_approve: bool = Field(default=False, description="Auto-approve mode")
    started_at: datetime | None = Field(default=None, description="When run started")
    completed_at: datetime | None = Field(default=None, description="When run completed")
    error: str | None = Field(default=None, description="Error message if failed")


class CreateBatchRequest(BaseModel):
    """Request to create an execution batch."""
    workspace: str = Field(..., description="Workspace directory path")
    source_description: str = Field(default="", description="Description of where jobs came from")
    model: str = Field(..., description="Model to use for execution")
    auto_approve: bool = Field(default=False, description="Auto-approve jobs")
    jobs: list[Job] = Field(..., description="List of jobs to execute")
    # Inherited from parent chat session - stored as selection dicts (name -> enabled)
    # These are converted to SDK objects at execution time using the same services as main session
    mcp_servers: dict[str, bool] | None = Field(default=None, description="MCP server selections inherited from parent session (name -> enabled)")
    tools: dict[str, bool] | None = Field(default=None, description="Tool selections inherited from parent session (name -> enabled)")


class StartRunRequest(BaseModel):
    """Request to start a Ralph run."""
    batch_id: str = Field(..., description="Batch ID to execute")
    auto_approve: bool | None = Field(default=None, description="Override batch's auto_approve setting")


class FeedbackRequest(BaseModel):
    """Request to provide feedback on a job."""
    feedback_text: str = Field(..., description="User's feedback on the job")


class RunSummary(BaseModel):
    """Summary of a Ralph run for listing."""
    id: str
    batch_id: str
    workspace: str
    status: RunStatus
    current_job_index: int
    total_jobs: int
    auto_approve: bool
    started_at: datetime | None
    completed_at: datetime | None
    current_job_description: str | None = None


# ==================== Backwards Compatibility Aliases ====================
# These allow existing code and stored JSON files to work during migration

TaskType = JobType
TaskStatus = JobStatus
TaskSource = JobSource
TaskResult = JobResult
Task = Job
ExecutionPlan = ExecutionBatch
CreatePlanRequest = CreateBatchRequest
