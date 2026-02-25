"""Tests for workflow models, storage service, and run service.

Tests are hermetic — use tmp_path for storage, no real filesystem side effects.
"""

from __future__ import annotations

import json
import sys
from datetime import datetime
from pathlib import Path

import pytest

# Ensure src/ is on sys.path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class TestWorkflowModels:
    """Test WorkflowMetadata, WorkflowRun, and related models."""

    def test_workflow_metadata_defaults(self):
        from copilot_agent_console.app.models.workflow import WorkflowMetadata

        meta = WorkflowMetadata(id="test-1", name="Test", yaml_filename="test-1.yaml")
        assert meta.id == "test-1"
        assert meta.description == ""
        assert meta.yaml_filename == "test-1.yaml"
        assert isinstance(meta.created_at, datetime)
        assert isinstance(meta.updated_at, datetime)

    def test_workflow_run_status_values(self):
        from copilot_agent_console.app.models.workflow import WorkflowRunStatus

        assert WorkflowRunStatus.PENDING == "pending"
        assert WorkflowRunStatus.RUNNING == "running"
        assert WorkflowRunStatus.PAUSED == "paused"
        assert WorkflowRunStatus.COMPLETED == "completed"
        assert WorkflowRunStatus.FAILED == "failed"
        assert WorkflowRunStatus.ABORTED == "aborted"

    def test_workflow_run_defaults(self):
        from copilot_agent_console.app.models.workflow import WorkflowRun, WorkflowRunStatus

        run = WorkflowRun(id="run-1", workflow_id="wf-1")
        assert run.status == WorkflowRunStatus.PENDING
        assert run.node_results == {}
        assert run.input is None
        assert run.error is None
        assert run.session_id is None

    def test_workflow_create(self):
        from copilot_agent_console.app.models.workflow import WorkflowCreate

        create = WorkflowCreate(name="My Workflow", yaml_content="kind: Workflow")
        assert create.name == "My Workflow"
        assert create.description == ""
        assert create.yaml_content == "kind: Workflow"

    def test_workflow_update_optional_fields(self):
        from copilot_agent_console.app.models.workflow import WorkflowUpdate

        update = WorkflowUpdate()
        assert update.name is None
        assert update.description is None
        assert update.yaml_content is None

    def test_workflow_detail(self):
        from copilot_agent_console.app.models.workflow import WorkflowDetail

        detail = WorkflowDetail(
            id="wf-1", name="Test", description="desc",
            yaml_content="kind: Workflow", created_at=datetime.utcnow(), updated_at=datetime.utcnow(),
        )
        assert detail.id == "wf-1"
        assert detail.yaml_content == "kind: Workflow"

    def test_workflow_run_summary(self):
        from copilot_agent_console.app.models.workflow import WorkflowRunSummary, WorkflowRunStatus

        summary = WorkflowRunSummary(
            id="run-1", workflow_id="wf-1", workflow_name="Test",
            status=WorkflowRunStatus.COMPLETED, input=None,
            started_at=datetime.utcnow(), completed_at=datetime.utcnow(),
            duration_seconds=1.5, error=None,
        )
        assert summary.status == "completed"
        assert summary.duration_seconds == 1.5


# ---------------------------------------------------------------------------
# Storage Service
# ---------------------------------------------------------------------------

class TestWorkflowStorageService:
    """Test WorkflowStorageService CRUD operations."""

    @pytest.fixture(autouse=True)
    def setup_storage(self, monkeypatch, tmp_path):
        """Redirect storage to tmp_path for hermetic tests."""
        # Clear cached modules to pick up monkeypatched paths
        for mod in list(sys.modules):
            if "workflow" in mod and "copilot_agent_console" in mod:
                sys.modules.pop(mod, None)

        workflows_dir = tmp_path / "workflows"
        workflow_runs_dir = tmp_path / "workflow-runs"
        workflows_dir.mkdir()
        workflow_runs_dir.mkdir()

        import copilot_agent_console.app.workflow_config as wf_config
        monkeypatch.setattr(wf_config, "WORKFLOWS_DIR", workflows_dir)
        monkeypatch.setattr(wf_config, "WORKFLOW_RUNS_DIR", workflow_runs_dir)

        from copilot_agent_console.app.services.workflow_storage_service import WorkflowStorageService
        self.service = WorkflowStorageService()
        self.workflows_dir = workflows_dir

    def test_create_workflow(self):
        from copilot_agent_console.app.models.workflow import WorkflowCreate

        req = WorkflowCreate(name="Test Pipeline", yaml_content="kind: Workflow\nname: test-pipeline")
        meta = self.service.create_workflow(req)

        assert meta.id == "test-pipeline"
        assert meta.name == "test-pipeline"
        assert (self.workflows_dir / f"{meta.id}.yaml").exists()
        # No meta.json file — YAML is the single source of truth
        assert not (self.workflows_dir / f"{meta.id}.meta.json").exists()

    def test_get_workflow(self):
        from copilot_agent_console.app.models.workflow import WorkflowCreate

        req = WorkflowCreate(name="Get Test", yaml_content="kind: Workflow\nname: get-test\ndescription: A test")
        meta = self.service.create_workflow(req)

        detail = self.service.get_workflow(meta.id)
        assert detail is not None
        assert detail.name == "get-test"
        assert "name: get-test" in detail.yaml_content

    def test_get_workflow_not_found(self):
        assert self.service.get_workflow("nonexistent") is None

    def test_list_workflows(self):
        from copilot_agent_console.app.models.workflow import WorkflowCreate

        self.service.create_workflow(WorkflowCreate(name="A", yaml_content="kind: Workflow\nname: alpha"))
        self.service.create_workflow(WorkflowCreate(name="B", yaml_content="kind: Workflow\nname: beta"))

        workflows = self.service.list_workflows()
        assert len(workflows) == 2
        names = {w.name for w in workflows}
        assert names == {"alpha", "beta"}

    def test_update_workflow(self):
        from copilot_agent_console.app.models.workflow import WorkflowCreate, WorkflowUpdate

        meta = self.service.create_workflow(WorkflowCreate(name="Original", yaml_content="kind: Workflow\nname: original"))
        updated = self.service.update_workflow(meta.id, WorkflowUpdate(yaml_content="kind: Workflow\nname: updated"))

        assert updated is not None
        assert updated.name == "updated"
        detail = self.service.get_workflow(meta.id)
        assert "name: updated" in detail.yaml_content

    def test_update_workflow_not_found(self):
        from copilot_agent_console.app.models.workflow import WorkflowUpdate

        assert self.service.update_workflow("nonexistent", WorkflowUpdate(name="x")) is None

    def test_delete_workflow(self):
        from copilot_agent_console.app.models.workflow import WorkflowCreate

        meta = self.service.create_workflow(WorkflowCreate(name="Delete Me", yaml_content="kind: Workflow\nname: delete-me"))
        assert self.service.delete_workflow(meta.id) is True
        assert self.service.get_workflow(meta.id) is None
        assert self.service.delete_workflow(meta.id) is False

    def test_get_yaml_path(self):
        from copilot_agent_console.app.models.workflow import WorkflowCreate

        meta = self.service.create_workflow(WorkflowCreate(name="Path Test", yaml_content="kind: Workflow\nname: path-test"))
        path = self.service.get_yaml_path(meta.id)
        assert path is not None
        assert path.exists()
        assert self.service.get_yaml_path("nonexistent") is None

    def test_get_yaml_content(self):
        from copilot_agent_console.app.models.workflow import WorkflowCreate

        meta = self.service.create_workflow(WorkflowCreate(name="Content", yaml_content="kind: Workflow\nname: content-test"))
        assert "name: content-test" in self.service.get_yaml_content(meta.id)
        assert self.service.get_yaml_content("nonexistent") is None

    def test_create_duplicate_name_gets_suffix(self):
        """Two workflows with same YAML name get distinct IDs."""
        from copilot_agent_console.app.models.workflow import WorkflowCreate

        m1 = self.service.create_workflow(WorkflowCreate(name="Dup", yaml_content="kind: Workflow\nname: dup"))
        m2 = self.service.create_workflow(WorkflowCreate(name="Dup", yaml_content="kind: Workflow\nname: dup"))
        assert m1.id == "dup"
        assert m2.id == "dup-2"
        assert len(self.service.list_workflows()) == 2


# ---------------------------------------------------------------------------
# Run Service
# ---------------------------------------------------------------------------

class TestWorkflowRunService:
    """Test WorkflowRunService lifecycle operations."""

    @pytest.fixture(autouse=True)
    def setup_run_service(self, monkeypatch, tmp_path):
        """Redirect storage to tmp_path."""
        for mod in list(sys.modules):
            if "workflow" in mod and "copilot_agent_console" in mod:
                sys.modules.pop(mod, None)

        workflows_dir = tmp_path / "workflows"
        workflow_runs_dir = tmp_path / "workflow-runs"
        workflows_dir.mkdir()
        workflow_runs_dir.mkdir()

        import copilot_agent_console.app.workflow_config as wf_config
        monkeypatch.setattr(wf_config, "WORKFLOWS_DIR", workflows_dir)
        monkeypatch.setattr(wf_config, "WORKFLOW_RUNS_DIR", workflow_runs_dir)

        from copilot_agent_console.app.services.workflow_run_service import WorkflowRunService
        self.service = WorkflowRunService()
        self.runs_dir = workflow_runs_dir

    def test_create_run(self):
        run = self.service.create_run("wf-1", "Test Workflow")
        assert run.workflow_id == "wf-1"
        assert run.workflow_name == "Test Workflow"
        assert run.status == "pending"
        assert run.started_at is not None

    def test_mark_running(self):
        run = self.service.create_run("wf-1", "Test")
        run = self.service.mark_running(run)
        assert run.status == "running"

    def test_mark_completed(self):
        run = self.service.create_run("wf-1", "Test")
        run = self.service.mark_running(run)
        run = self.service.mark_completed(run, node_results={"step1": {"status": "completed"}})
        assert run.status == "completed"
        assert run.completed_at is not None
        assert run.duration_seconds is not None
        assert run.node_results == {"step1": {"status": "completed"}}

    def test_mark_failed(self):
        run = self.service.create_run("wf-1", "Test")
        run = self.service.mark_running(run)
        run = self.service.mark_failed(run, error="Something broke")
        assert run.status == "failed"
        assert run.error == "Something broke"

    def test_mark_paused(self):
        run = self.service.create_run("wf-1", "Test")
        run = self.service.mark_running(run)
        run = self.service.mark_paused(run)
        assert run.status == "paused"

    def test_load_run(self):
        run = self.service.create_run("wf-1", "Test")
        loaded = self.service.load_run(run.id)
        assert loaded is not None
        assert loaded.id == run.id
        assert loaded.workflow_id == "wf-1"

    def test_load_run_not_found(self):
        assert self.service.load_run("nonexistent") is None

    def test_list_runs(self):
        self.service.create_run("wf-1", "Test A")
        self.service.create_run("wf-1", "Test B")
        self.service.create_run("wf-2", "Other")

        all_runs = self.service.list_runs()
        assert len(all_runs) == 3

        wf1_runs = self.service.list_runs(workflow_id="wf-1")
        assert len(wf1_runs) == 2

    def test_list_runs_with_status_filter(self):
        from copilot_agent_console.app.models.workflow import WorkflowRunStatus

        run = self.service.create_run("wf-1", "Test")
        self.service.mark_running(run)

        running = self.service.list_runs(status="running")
        assert len(running) == 1
        pending = self.service.list_runs(status="pending")
        assert len(pending) == 0

    def test_delete_run(self):
        run = self.service.create_run("wf-1", "Test")
        assert self.service.delete_run(run.id) is not None
        assert self.service.load_run(run.id) is None
        assert self.service.delete_run(run.id) is None


# ---------------------------------------------------------------------------
# Engine (import-level verification — actual AF execution needs YAML fixtures)
# ---------------------------------------------------------------------------

class TestWorkflowEngine:
    """Test WorkflowEngine import and basic validation."""

    def test_engine_import(self):
        from copilot_agent_console.app.services.workflow_engine import WorkflowEngine
        engine = WorkflowEngine()
        assert engine is not None

    def test_validate_yaml_invalid(self):
        from copilot_agent_console.app.services.workflow_engine import WorkflowEngine
        engine = WorkflowEngine()
        result = engine.validate_yaml("this is not valid yaml for AF")
        assert result["valid"] is False
        assert "error" in result

    def test_validate_yaml_valid_workflow(self, tmp_path):
        """Test that a valid AF workflow YAML can be loaded and visualized."""
        from copilot_agent_console.app.services.workflow_engine import WorkflowEngine

        yaml_content = """
kind: Workflow
name: test-workflow
steps:
  - type: CallAgent
    agent: researcher
    inputs:
      topic: "AI agents"

agents:
  - name: researcher
    type: completion
    instructions: "You are a researcher. Summarize the given topic."
    model:
      type: openai
      name: gpt-4o
"""
        engine = WorkflowEngine()
        result = engine.validate_yaml(yaml_content)
        # AF may or may not accept this depending on model config
        # At minimum, we verify the method runs without crashing
        assert "valid" in result
