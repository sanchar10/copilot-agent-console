"""Ralph AI Runner storage service.

Persists execution batches and run state to ~/.copilot-web/ralph/
"""

import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from copilot_agent_console.app.models.ralph import ExecutionBatch, RalphRun, RunStatus
from copilot_agent_console.app.config import APP_HOME
from copilot_agent_console.app.services.logging_service import get_logger

logger = get_logger(__name__)

# Storage paths
RALPH_DIR = APP_HOME / "ralph"
BATCHES_DIR = RALPH_DIR / "batches"
RUNS_DIR = RALPH_DIR / "runs"


def _ensure_dirs() -> None:
    """Ensure storage directories exist."""
    BATCHES_DIR.mkdir(parents=True, exist_ok=True)
    RUNS_DIR.mkdir(parents=True, exist_ok=True)


def _serialize_datetime(obj: Any) -> Any:
    """JSON serializer for datetime objects."""
    if isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError(f"Object of type {type(obj)} is not JSON serializable")


def _parse_datetime(value: str | None) -> datetime | None:
    """Parse ISO datetime string."""
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except (ValueError, TypeError):
        return None


class RalphStorageService:
    """Service for persisting Ralph batches and runs."""

    def __init__(self) -> None:
        _ensure_dirs()

    # ==================== Batches ====================

    def save_batch(self, batch: ExecutionBatch) -> None:
        """Save an execution batch."""
        _ensure_dirs()
        batch_file = BATCHES_DIR / f"{batch.id}.json"
        
        data = batch.model_dump()
        with open(batch_file, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, default=_serialize_datetime)
        
        logger.info(f"Saved batch {batch.id}")

    def load_batch(self, batch_id: str) -> ExecutionBatch | None:
        """Load an execution batch by ID."""
        batch_file = BATCHES_DIR / f"{batch_id}.json"
        
        if not batch_file.exists():
            return None
        
        try:
            with open(batch_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            
            # Parse datetime fields
            if "created_at" in data and isinstance(data["created_at"], str):
                data["created_at"] = _parse_datetime(data["created_at"])
            
            return ExecutionBatch(**data)
        except Exception as e:
            logger.error(f"Error loading batch {batch_id}: {e}")
            return None

    def delete_batch(self, batch_id: str) -> bool:
        """Delete an execution batch."""
        batch_file = BATCHES_DIR / f"{batch_id}.json"
        
        if batch_file.exists():
            batch_file.unlink()
            logger.info(f"Deleted batch {batch_id}")
            return True
        return False

    def list_batches(self) -> list[ExecutionBatch]:
        """List all execution batches."""
        _ensure_dirs()
        batches = []
        
        for batch_file in BATCHES_DIR.glob("*.json"):
            batch = self.load_batch(batch_file.stem)
            if batch:
                batches.append(batch)
        
        # Sort by created_at descending
        batches.sort(key=lambda b: b.created_at, reverse=True)
        return batches

    # ==================== Runs ====================

    def save_run(self, run: RalphRun) -> None:
        """Save a run state."""
        _ensure_dirs()
        run_file = RUNS_DIR / f"{run.id}.json"
        
        data = run.model_dump()
        with open(run_file, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, default=_serialize_datetime)
        
        logger.debug(f"Saved run {run.id}")

    def load_run(self, run_id: str) -> RalphRun | None:
        """Load a run by ID."""
        run_file = RUNS_DIR / f"{run_id}.json"
        
        if not run_file.exists():
            return None
        
        try:
            with open(run_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            
            # Parse datetime fields
            for field in ["started_at", "completed_at"]:
                if field in data and isinstance(data[field], str):
                    data[field] = _parse_datetime(data[field])
            
            return RalphRun(**data)
        except Exception as e:
            logger.error(f"Error loading run {run_id}: {e}")
            return None

    def delete_run(self, run_id: str) -> bool:
        """Delete a run."""
        run_file = RUNS_DIR / f"{run_id}.json"
        
        if run_file.exists():
            run_file.unlink()
            logger.info(f"Deleted run {run_id}")
            return True
        return False

    def list_runs(self) -> list[RalphRun]:
        """List all runs."""
        _ensure_dirs()
        runs = []
        
        for run_file in RUNS_DIR.glob("*.json"):
            run = self.load_run(run_file.stem)
            if run:
                runs.append(run)
        
        # Sort by started_at descending (pending runs first, then by start time)
        def sort_key(r: RalphRun) -> tuple:
            # Running runs first, then pending, then by time
            status_order = {
                RunStatus.RUNNING: 0,
                RunStatus.PAUSED: 1,
                RunStatus.PENDING: 2,
                RunStatus.COMPLETED: 3,
                RunStatus.CANCELLED: 4,
                RunStatus.FAILED: 5,
            }
            return (status_order.get(r.status, 99), -(r.started_at.timestamp() if r.started_at else 0))
        
        runs.sort(key=sort_key)
        return runs

    def get_active_runs(self) -> list[RalphRun]:
        """Get all active (running or paused) runs."""
        return [r for r in self.list_runs() if r.status in (RunStatus.RUNNING, RunStatus.PAUSED, RunStatus.PENDING)]

    def get_run_for_workspace(self, workspace: str) -> RalphRun | None:
        """Get active run for a workspace (if any)."""
        active_runs = self.get_active_runs()
        for run in active_runs:
            if run.workspace == workspace and run.status == RunStatus.RUNNING:
                return run
        return None


# Singleton instance
_storage_service: RalphStorageService | None = None


def get_ralph_storage() -> RalphStorageService:
    """Get the singleton storage service instance."""
    global _storage_service
    if _storage_service is None:
        _storage_service = RalphStorageService()
    return _storage_service
