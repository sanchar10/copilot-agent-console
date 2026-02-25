"""Schedule storage service for CRUD operations on schedules.

Stores schedule definitions as JSON files in ~/.copilot-console/schedules/.
"""

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path

from copilot_console.app.config import SCHEDULES_DIR, ensure_directories
from copilot_console.app.models.schedule import Schedule, ScheduleCreate, ScheduleUpdate


class ScheduleStorageService:
    """Handles schedule persistence."""

    def __init__(self) -> None:
        ensure_directories()

    def _schedule_file(self, schedule_id: str) -> Path:
        return SCHEDULES_DIR / f"{schedule_id}.json"

    def save_schedule(self, schedule: Schedule) -> None:
        """Save a schedule to disk."""
        data = schedule.model_dump()
        data["created_at"] = schedule.created_at.isoformat()
        data["updated_at"] = schedule.updated_at.isoformat()
        self._schedule_file(schedule.id).write_text(
            json.dumps(data, indent=2, default=str), encoding="utf-8"
        )

    def load_schedule(self, schedule_id: str) -> Schedule | None:
        """Load a schedule by ID."""
        f = self._schedule_file(schedule_id)
        if not f.exists():
            return None
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
            return Schedule(**data)
        except (json.JSONDecodeError, IOError, ValueError):
            return None

    def list_schedules(self) -> list[Schedule]:
        """List all schedules."""
        schedules = []
        if SCHEDULES_DIR.exists():
            for f in sorted(SCHEDULES_DIR.glob("*.json")):
                try:
                    data = json.loads(f.read_text(encoding="utf-8"))
                    schedules.append(Schedule(**data))
                except (json.JSONDecodeError, IOError, ValueError):
                    pass
        return schedules

    def create_schedule(self, request: ScheduleCreate) -> Schedule:
        """Create a new schedule."""
        now = datetime.now(timezone.utc)
        schedule = Schedule(
            id=str(uuid.uuid4())[:8],
            created_at=now,
            updated_at=now,
            **request.model_dump(),
        )
        self.save_schedule(schedule)
        return schedule

    def update_schedule(self, schedule_id: str, request: ScheduleUpdate) -> Schedule | None:
        """Update a schedule. Returns None if not found."""
        schedule = self.load_schedule(schedule_id)
        if not schedule:
            return None
        update_data = request.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(schedule, field, value)
        schedule.updated_at = datetime.now(timezone.utc)
        self.save_schedule(schedule)
        return schedule

    def delete_schedule(self, schedule_id: str) -> bool:
        """Delete a schedule. Returns True if deleted."""
        f = self._schedule_file(schedule_id)
        if not f.exists():
            return False
        f.unlink()
        return True


# Singleton instance
schedule_storage_service = ScheduleStorageService()
