"""Workflow-specific configuration and constants.

Extends the base config with workflow storage directories.
Does NOT modify the existing config.py — imports from it.
"""

from copilot_agent_console.app.config import APP_HOME


# Workflow storage directories
WORKFLOWS_DIR = APP_HOME / "workflows"
WORKFLOW_RUNS_DIR = APP_HOME / "workflow-runs"


def ensure_workflow_directories() -> None:
    """Create workflow-specific directories if they don't exist."""
    for directory in [WORKFLOWS_DIR, WORKFLOW_RUNS_DIR]:
        directory.mkdir(parents=True, exist_ok=True)
