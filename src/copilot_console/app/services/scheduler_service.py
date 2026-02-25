"""Scheduler service for recurring agent execution.

Uses APScheduler to trigger agent runs on cron schedules.
Integrates with TaskRunnerService for actual execution.
"""

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from copilot_console.app.models.schedule import Schedule, ScheduleWithNextRun
from copilot_console.app.services.schedule_storage_service import schedule_storage_service
from copilot_console.app.services.agent_storage_service import agent_storage_service
from copilot_console.app.services.task_runner_service import TaskRunnerService
from copilot_console.app.services.logging_service import get_logger

logger = get_logger(__name__)


class SchedulerService:
    """Manages cron-based scheduling of agent runs."""

    def __init__(self, task_runner: TaskRunnerService) -> None:
        self._task_runner = task_runner
        self._scheduler = AsyncIOScheduler()
        self._started = False

    def start(self) -> None:
        """Load all schedules and start the scheduler."""
        if self._started:
            return
        schedules = schedule_storage_service.list_schedules()
        for schedule in schedules:
            if schedule.enabled:
                self._register_job(schedule)
        self._scheduler.start()
        self._started = True
        logger.info(f"Scheduler started with {len(schedules)} schedules ({sum(1 for s in schedules if s.enabled)} enabled)")

    def shutdown(self) -> None:
        """Gracefully shut down the scheduler."""
        if self._started:
            self._scheduler.shutdown(wait=False)
            self._started = False
            logger.info("Scheduler shut down")

    def _register_job(self, schedule: Schedule) -> None:
        """Register a cron job for a schedule."""
        job_id = f"schedule-{schedule.id}"
        try:
            trigger = CronTrigger.from_crontab(schedule.cron)
            self._scheduler.add_job(
                self._trigger_run,
                trigger=trigger,
                id=job_id,
                args=[schedule.id],
                replace_existing=True,
                misfire_grace_time=60,
            )
            logger.info(f"Registered schedule {schedule.id} ({schedule.name}) cron={schedule.cron}")
        except ValueError as e:
            logger.error(f"Invalid cron expression for schedule {schedule.id}: {e}")

    def _unregister_job(self, schedule_id: str) -> None:
        """Remove a cron job."""
        job_id = f"schedule-{schedule_id}"
        try:
            self._scheduler.remove_job(job_id)
        except Exception:
            pass  # Job may not exist

    async def _trigger_run(self, schedule_id: str) -> None:
        """Called by APScheduler when a schedule fires."""
        schedule = schedule_storage_service.load_schedule(schedule_id)
        if not schedule or not schedule.enabled:
            return

        agent = agent_storage_service.load_agent(schedule.agent_id)
        if not agent:
            logger.error(f"Schedule {schedule_id}: agent {schedule.agent_id} not found")
            return

        logger.info(f"Schedule {schedule_id} ({schedule.name}) triggered for agent {agent.name}")
        await self._task_runner.submit_run(
            agent=agent,
            prompt=schedule.prompt,
            cwd=schedule.cwd,
            schedule_id=schedule.id,
            max_runtime_minutes=schedule.max_runtime_minutes,
        )

    async def run_now(self, schedule_id: str) -> str | None:
        """Manually trigger a schedule immediately. Returns run ID or None."""
        schedule = schedule_storage_service.load_schedule(schedule_id)
        if not schedule:
            return None

        agent = agent_storage_service.load_agent(schedule.agent_id)
        if not agent:
            return None

        run = await self._task_runner.submit_run(
            agent=agent,
            prompt=schedule.prompt,
            cwd=schedule.cwd,
            schedule_id=schedule.id,
            max_runtime_minutes=schedule.max_runtime_minutes,
        )
        return run.id

    def add_schedule(self, schedule: Schedule) -> None:
        """Add or update a schedule in the scheduler."""
        if schedule.enabled and self._started:
            self._register_job(schedule)

    def remove_schedule(self, schedule_id: str) -> None:
        """Remove a schedule from the scheduler."""
        self._unregister_job(schedule_id)

    def toggle_schedule(self, schedule_id: str, enabled: bool) -> None:
        """Enable or disable a schedule."""
        if enabled:
            schedule = schedule_storage_service.load_schedule(schedule_id)
            if schedule and self._started:
                self._register_job(schedule)
        else:
            self._unregister_job(schedule_id)

    def list_schedules_with_next_run(self) -> list[ScheduleWithNextRun]:
        """List all schedules with their next run times and agent names."""
        schedules = schedule_storage_service.list_schedules()
        result = []
        for schedule in schedules:
            agent = agent_storage_service.load_agent(schedule.agent_id)
            agent_name = agent.name if agent else "(deleted agent)"

            next_run = None
            if schedule.enabled and self._started:
                job_id = f"schedule-{schedule.id}"
                job = self._scheduler.get_job(job_id)
                if job and job.next_run_time:
                    next_run = job.next_run_time

            result.append(ScheduleWithNextRun(
                **schedule.model_dump(),
                next_run=next_run,
                agent_name=agent_name,
            ))
        return result
