"""Automation service for recurring agent execution.

Uses APScheduler to trigger agent runs on cron automations.
Integrates with TaskRunnerService for actual execution.
"""

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from copilot_console.app.models.automation import Automation, AutomationWithNextRun
from copilot_console.app.services.automation_storage_service import automation_storage_service
from copilot_console.app.services.agent_storage_service import agent_storage_service
from copilot_console.app.services.task_runner_service import TaskRunnerService
from copilot_console.app.services.logging_service import get_logger

logger = get_logger(__name__)


class AutomationService:
    """Manages cron-based automation of agent runs."""

    def __init__(self, task_runner: TaskRunnerService) -> None:
        self._task_runner = task_runner
        self._scheduler = AsyncIOScheduler()
        self._started = False

    def start(self) -> None:
        """Load all automations and start the cron scheduler."""
        if self._started:
            return
        automations = automation_storage_service.list_automations()
        for automation in automations:
            if automation.enabled:
                self._register_job(automation)
        self._scheduler.start()
        self._started = True
        logger.info(f"Automation service started with {len(automations)} automations ({sum(1 for s in automations if s.enabled)} enabled)")

    def shutdown(self) -> None:
        """Gracefully shut down the cron scheduler."""
        if self._started:
            self._scheduler.shutdown(wait=False)
            self._started = False
            logger.info("Automation service shut down")

    def _register_job(self, automation: Automation) -> None:
        """Register a cron job for an automation."""
        job_id = f"automation-{automation.id}"
        try:
            trigger = CronTrigger.from_crontab(automation.cron)
            self._scheduler.add_job(
                self._trigger_run,
                trigger=trigger,
                id=job_id,
                args=[automation.id],
                replace_existing=True,
                misfire_grace_time=60,
            )
            logger.info(f"Registered automation {automation.id} ({automation.name}) cron={automation.cron}")
        except ValueError as e:
            logger.error(f"Invalid cron expression for automation {automation.id}: {e}")

    def _unregister_job(self, automation_id: str) -> None:
        """Remove a cron job."""
        job_id = f"automation-{automation_id}"
        try:
            self._scheduler.remove_job(job_id)
        except Exception:
            pass  # Job may not exist

    async def _trigger_run(self, automation_id: str) -> None:
        """Called by APScheduler when an automation fires."""
        automation = automation_storage_service.load_automation(automation_id)
        if not automation or not automation.enabled:
            return

        agent = agent_storage_service.load_agent(automation.agent_id)
        if not agent:
            logger.error(f"Automation {automation_id}: agent {automation.agent_id} not found")
            return

        logger.info(f"Automation {automation_id} ({automation.name}) triggered for agent {agent.name}")
        await self._task_runner.submit_run(
            agent=agent,
            prompt=automation.prompt,
            cwd=automation.cwd,
            automation_id=automation.id,
            max_runtime_minutes=automation.max_runtime_minutes,
        )

    async def run_now(self, automation_id: str) -> str | None:
        """Manually trigger an automation immediately. Returns run ID or None."""
        automation = automation_storage_service.load_automation(automation_id)
        if not automation:
            return None

        agent = agent_storage_service.load_agent(automation.agent_id)
        if not agent:
            return None

        run = await self._task_runner.submit_run(
            agent=agent,
            prompt=automation.prompt,
            cwd=automation.cwd,
            automation_id=automation.id,
            max_runtime_minutes=automation.max_runtime_minutes,
        )
        return run.id

    def add_automation(self, automation: Automation) -> None:
        """Add or update an automation."""
        if automation.enabled and self._started:
            self._register_job(automation)

    def remove_automation(self, automation_id: str) -> None:
        """Remove an automation."""
        self._unregister_job(automation_id)

    def toggle_automation(self, automation_id: str, enabled: bool) -> None:
        """Enable or disable an automation."""
        if enabled:
            automation = automation_storage_service.load_automation(automation_id)
            if automation and self._started:
                self._register_job(automation)
        else:
            self._unregister_job(automation_id)

    def list_automations_with_next_run(self) -> list[AutomationWithNextRun]:
        """List all automations with their next run times and agent names."""
        automations = automation_storage_service.list_automations()
        result = []
        for automation in automations:
            agent = agent_storage_service.load_agent(automation.agent_id)
            agent_name = agent.name if agent else "(deleted agent)"

            next_run = None
            if automation.enabled and self._started:
                job_id = f"automation-{automation.id}"
                job = self._scheduler.get_job(job_id)
                if job and job.next_run_time:
                    next_run = job.next_run_time

            result.append(AutomationWithNextRun(
                **automation.model_dump(),
                next_run=next_run,
                agent_name=agent_name,
            ))
        return result
