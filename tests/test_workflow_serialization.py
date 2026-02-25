"""Tests for workflow event serialization and event persistence.

Covers:
- _serialize_event_data: AF ActionComplete, Pydantic models, lists, dicts, edge cases
- _serialize_workflow_event: full AF WorkflowEvent → dict conversion
- Event persistence: events stored on WorkflowRun and round-tripped through JSON
- WorkflowRun.events field: model defaults and serialization
"""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import pytest

# Ensure src/ is on sys.path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))


# ---------------------------------------------------------------------------
# _serialize_event_data
# ---------------------------------------------------------------------------

class TestSerializeEventData:
    """Test the recursive event data serializer."""

    @pytest.fixture(autouse=True)
    def _import_serializer(self):
        from copilot_console.app.routers.workflows import _serialize_event_data
        self.serialize = _serialize_event_data

    def test_none(self):
        assert self.serialize(None) is None

    def test_string(self):
        assert self.serialize("hello") == "hello"

    def test_string_strips_whitespace(self):
        assert self.serialize("\n\nHello world\n") == "Hello world"

    def test_int(self):
        assert self.serialize(42) == 42

    def test_float(self):
        assert self.serialize(3.14) == 3.14

    def test_bool(self):
        assert self.serialize(True) is True

    def test_action_complete_with_result(self):
        """ActionComplete objects should unwrap to their .result."""
        ac = MagicMock()
        type(ac).__name__ = "ActionComplete"
        ac.result = "research output"
        assert self.serialize(ac) == "research output"

    def test_action_complete_none_result(self):
        """ActionComplete with None result → marker string."""
        ac = MagicMock()
        type(ac).__name__ = "ActionComplete"
        ac.result = None
        assert self.serialize(ac) == "(action completed)"

    def test_action_complete_nested(self):
        """ActionComplete wrapping another ActionComplete."""
        inner = MagicMock()
        type(inner).__name__ = "ActionComplete"
        inner.result = "deep value"

        outer = MagicMock()
        type(outer).__name__ = "ActionComplete"
        outer.result = inner
        assert self.serialize(outer) == "deep value"

    def test_pydantic_model(self):
        """Pydantic models should be dumped to dict."""
        from pydantic import BaseModel

        class Sample(BaseModel):
            name: str
            value: int

        m = Sample(name="test", value=5)
        result = self.serialize(m)
        assert result == {"name": "test", "value": 5}

    def test_list_single_meaningful(self):
        """List with one meaningful item should unwrap."""
        ac = MagicMock()
        type(ac).__name__ = "ActionComplete"
        ac.result = None
        result = self.serialize([ac, "actual content"])
        assert result == "actual content"

    def test_list_multiple_meaningful(self):
        """List with multiple meaningful items should stay as list."""
        result = self.serialize(["first", "second"])
        assert result == ["first", "second"]

    def test_list_all_action_complete(self):
        """List of only ActionComplete markers → None."""
        ac = MagicMock()
        type(ac).__name__ = "ActionComplete"
        ac.result = None
        assert self.serialize([ac]) is None

    def test_list_mixed_with_strings_and_action_complete(self):
        """Realistic AF output: [ActionComplete, string response]."""
        ac = MagicMock()
        type(ac).__name__ = "ActionComplete"
        ac.result = None
        result = self.serialize([ac, "\n\nHow can I help you?"])
        assert result == "How can I help you?"

    def test_dict(self):
        result = self.serialize({"key": "value", "num": 42})
        assert result == {"key": "value", "num": 42}

    def test_dict_nested(self):
        ac = MagicMock()
        type(ac).__name__ = "ActionComplete"
        ac.result = "unwrapped"
        result = self.serialize({"data": ac, "count": 1})
        assert result == {"data": "unwrapped", "count": 1}

    def test_sdk_object_repr_filtered(self):
        """SDK objects with memory addresses should be filtered to type name."""
        obj = MagicMock()
        obj.__str__ = lambda self: "<SomeSDKObject object at 0x00001234ABCD>"
        type(obj).__name__ = "SomeSDKObject"
        # Ensure it's not caught by ActionComplete or Pydantic checks
        del obj.result
        del obj.model_dump
        result = self.serialize(obj)
        assert result == "(SomeSDKObject)"

    def test_plain_object_with_str(self):
        """Objects with clean __str__ should pass through."""

        class Custom:
            def __str__(self):
                return "clean string"

        assert self.serialize(Custom()) == "clean string"

    def test_empty_list(self):
        assert self.serialize([]) is None

    def test_tuple(self):
        result = self.serialize(("a", "b"))
        assert result == ["a", "b"]


# ---------------------------------------------------------------------------
# _serialize_workflow_event
# ---------------------------------------------------------------------------

class TestSerializeWorkflowEvent:
    """Test full AF WorkflowEvent → dict conversion."""

    @pytest.fixture(autouse=True)
    def _import_serializer(self):
        from copilot_console.app.routers.workflows import _serialize_workflow_event
        self.serialize = _serialize_workflow_event

    def _make_event(self, **kwargs):
        """Create a mock WorkflowEvent with given attributes."""
        event = MagicMock()
        # Clear all auto-created attributes so getattr returns None
        event.executor_id = kwargs.get("executor_id")
        event.iteration = kwargs.get("iteration")
        event.state = kwargs.get("state")
        event.details = kwargs.get("details")
        event.data = kwargs.get("data")
        event.type = kwargs.get("type", "unknown")
        # Property-gated fields — simulate RuntimeError on wrong event types
        if "source_executor_id" in kwargs:
            event.source_executor_id = kwargs["source_executor_id"]
        else:
            type(event).source_executor_id = property(
                lambda self: (_ for _ in ()).throw(RuntimeError("not available"))
            )
        if "request_id" in kwargs:
            event.request_id = kwargs["request_id"]
        else:
            type(event).request_id = property(
                lambda self: (_ for _ in ()).throw(RuntimeError("not available"))
            )
        if "request_type" in kwargs:
            event.request_type = kwargs["request_type"]
        else:
            type(event).request_type = property(
                lambda self: (_ for _ in ()).throw(RuntimeError("not available"))
            )
        return event

    def test_basic_event(self):
        event = self._make_event(type="started")
        result = self.serialize(event, "run-123")
        assert result["run_id"] == "run-123"
        assert result["type"] == "started"

    def test_executor_id(self):
        event = self._make_event(type="executor_invoked", executor_id="research_step")
        result = self.serialize(event, "run-1")
        assert result["executor_id"] == "research_step"

    def test_iteration(self):
        event = self._make_event(type="superstep_started", iteration=2)
        result = self.serialize(event, "run-1")
        assert result["iteration"] == 2

    def test_state(self):
        event = self._make_event(type="status", state="WorkflowRunState.IN_PROGRESS")
        result = self.serialize(event, "run-1")
        assert result["state"] == "in_progress"

    def test_error_details(self):
        details = MagicMock()
        details.error_type = "ValueError"
        details.message = "bad input"
        details.executor_id = "step_a"
        event = self._make_event(type="failed", details=details)
        result = self.serialize(event, "run-1")
        assert result["error_type"] == "ValueError"
        assert result["error_message"] == "bad input"
        assert result["error_executor_id"] == "step_a"

    def test_data_string(self):
        event = self._make_event(type="output", data="\n\nAgent response here\n")
        result = self.serialize(event, "run-1")
        assert result["data"] == "Agent response here"

    def test_property_gated_fields_unavailable(self):
        """Properties that throw RuntimeError should be silently skipped."""
        event = self._make_event(type="started")
        result = self.serialize(event, "run-1")
        assert "source_executor_id" not in result
        assert "request_id" not in result
        assert "request_type" not in result

    def test_property_gated_fields_available(self):
        event = self._make_event(
            type="request_info",
            source_executor_id="step_a",
            request_id="req-42",
            request_type="SomeType",
        )
        result = self.serialize(event, "run-1")
        assert result["source_executor_id"] == "step_a"
        assert result["request_id"] == "req-42"
        assert result["request_type"] == "SomeType"

    def test_no_none_fields(self):
        """Fields with None values should not appear in output."""
        event = self._make_event(type="started")
        result = self.serialize(event, "run-1")
        for key, val in result.items():
            assert val is not None, f"Field '{key}' should not be None"

    def test_json_serializable(self):
        """Result must be fully JSON-serializable."""
        event = self._make_event(
            type="executor_completed",
            executor_id="step_a",
            iteration=1,
            data="output text",
        )
        result = self.serialize(event, "run-1")
        serialized = json.dumps(result, default=str)
        assert isinstance(serialized, str)
        roundtripped = json.loads(serialized)
        assert roundtripped["type"] == "executor_completed"


# ---------------------------------------------------------------------------
# WorkflowRun events field
# ---------------------------------------------------------------------------

class TestWorkflowRunEventsField:
    """Test that WorkflowRun model supports the events field."""

    def test_events_default_empty(self):
        from copilot_console.app.models.workflow import WorkflowRun
        run = WorkflowRun(id="run-1", workflow_id="wf-1")
        assert run.events == []

    def test_events_populated(self):
        from copilot_console.app.models.workflow import WorkflowRun
        events = [
            {"type": "started", "run_id": "run-1"},
            {"type": "executor_invoked", "executor_id": "step_a"},
            {"type": "executor_completed", "executor_id": "step_a", "data": "output"},
        ]
        run = WorkflowRun(id="run-1", workflow_id="wf-1", events=events)
        assert len(run.events) == 3
        assert run.events[0]["type"] == "started"
        assert run.events[2]["data"] == "output"

    def test_events_roundtrip_json(self):
        """Events should survive JSON serialization and deserialization."""
        from copilot_console.app.models.workflow import WorkflowRun
        events = [
            {"type": "started", "run_id": "run-1"},
            {"type": "output", "executor_id": "step_a", "data": "response text"},
        ]
        run = WorkflowRun(id="run-1", workflow_id="wf-1", events=events)
        dumped = run.model_dump()
        serialized = json.dumps(dumped, default=str)
        loaded = json.loads(serialized)
        assert loaded["events"] == events


# ---------------------------------------------------------------------------
# Event persistence via run service
# ---------------------------------------------------------------------------

class TestEventPersistence:
    """Test that events are persisted and loaded through the run service."""

    @pytest.fixture(autouse=True)
    def setup_run_service(self, monkeypatch, tmp_path):
        for mod in list(sys.modules):
            if "workflow" in mod and "copilot_console" in mod:
                sys.modules.pop(mod, None)

        workflows_dir = tmp_path / "workflows"
        workflow_runs_dir = tmp_path / "workflow-runs"
        workflows_dir.mkdir()
        workflow_runs_dir.mkdir()

        import copilot_console.app.workflow_config as wf_config
        monkeypatch.setattr(wf_config, "WORKFLOWS_DIR", workflows_dir)
        monkeypatch.setattr(wf_config, "WORKFLOW_RUNS_DIR", workflow_runs_dir)

        from copilot_console.app.services.workflow_run_service import WorkflowRunService
        self.service = WorkflowRunService()

    def test_mark_completed_stores_events(self):
        events = [
            {"type": "started", "run_id": "test"},
            {"type": "executor_invoked", "executor_id": "step_a"},
            {"type": "output", "executor_id": "step_a", "data": "Hello world"},
            {"type": "executor_completed", "executor_id": "step_a", "data": "Hello world"},
        ]
        run = self.service.create_run("wf-1", "Test")
        run = self.service.mark_running(run)
        run = self.service.mark_completed(run, node_results={"step_a": {"status": "completed"}}, events=events)

        loaded = self.service.load_run(run.id)
        assert loaded is not None
        assert len(loaded.events) == 4
        assert loaded.events[0]["type"] == "started"
        assert loaded.events[2]["data"] == "Hello world"

    def test_mark_failed_stores_events(self):
        events = [
            {"type": "started", "run_id": "test"},
            {"type": "executor_invoked", "executor_id": "step_a"},
            {"type": "workflow_failed", "error": "Something broke"},
        ]
        run = self.service.create_run("wf-1", "Test")
        run = self.service.mark_running(run)
        run = self.service.mark_failed(run, error="Something broke", events=events)

        loaded = self.service.load_run(run.id)
        assert loaded is not None
        assert len(loaded.events) == 3
        assert loaded.events[-1]["type"] == "workflow_failed"

    def test_mark_completed_without_events(self):
        """Backward compatibility: runs without events still work."""
        run = self.service.create_run("wf-1", "Test")
        run = self.service.mark_running(run)
        run = self.service.mark_completed(run, node_results={"step_a": {"status": "completed"}})

        loaded = self.service.load_run(run.id)
        assert loaded is not None
        assert loaded.events == []

    def test_events_survive_json_roundtrip_on_disk(self):
        """Events with various data types persist correctly to JSON files."""
        events = [
            {"type": "started"},
            {"type": "status", "state": "WorkflowRunState.IN_PROGRESS"},
            {"type": "executor_invoked", "executor_id": "step_a", "iteration": 1},
            {"type": "output", "executor_id": "step_a", "data": "response text"},
            {"type": "executor_completed", "executor_id": "step_a", "data": "response text"},
            {"type": "superstep_completed", "iteration": 1},
            {"type": "status", "state": "WorkflowRunState.IDLE"},
        ]
        run = self.service.create_run("wf-1", "Test")
        run = self.service.mark_running(run)
        run = self.service.mark_completed(run, events=events)

        loaded = self.service.load_run(run.id)
        assert len(loaded.events) == len(events)
        for original, loaded_evt in zip(events, loaded.events):
            assert original["type"] == loaded_evt["type"]
            if "executor_id" in original:
                assert original["executor_id"] == loaded_evt["executor_id"]
            if "data" in original:
                assert original["data"] == loaded_evt["data"]


# ---------------------------------------------------------------------------
# Workflow engine: sync_agents_from_library
# ---------------------------------------------------------------------------

class TestWorkflowEngineSyncAgents:
    """Test agent library → AF agent bridge."""

    @pytest.fixture(autouse=True)
    def setup(self, monkeypatch, tmp_path):
        for mod in list(sys.modules):
            if "workflow" in mod and "copilot_console" in mod:
                sys.modules.pop(mod, None)

        workflows_dir = tmp_path / "workflows"
        workflow_runs_dir = tmp_path / "workflow-runs"
        agents_dir = tmp_path / "agents"
        workflows_dir.mkdir()
        workflow_runs_dir.mkdir()
        agents_dir.mkdir()

        import copilot_console.app.workflow_config as wf_config
        monkeypatch.setattr(wf_config, "WORKFLOWS_DIR", workflows_dir)
        monkeypatch.setattr(wf_config, "WORKFLOW_RUNS_DIR", workflow_runs_dir)

        self.agents_dir = agents_dir
        self.monkeypatch = monkeypatch

    def _create_mock_agent(self, name, content="You are helpful.", description="A test agent"):
        from copilot_console.app.models.agent import Agent, SystemMessage
        return Agent(
            id=f"agent-{name}",
            name=name,
            description=description,
            system_message=SystemMessage(mode="replace", content=content),
        )

    def test_sync_populates_agents(self):
        from copilot_console.app.services.workflow_engine import WorkflowEngine
        from copilot_console.app.services import agent_storage_service as ass_mod

        agents = [
            self._create_mock_agent("researcher", "You research topics."),
            self._create_mock_agent("writer", "You write content."),
        ]
        self.monkeypatch.setattr(ass_mod.agent_storage_service, "list_agents", lambda: agents)

        engine = WorkflowEngine()
        engine.sync_agents_from_library()

        assert "researcher" in engine._agents
        assert "writer" in engine._agents
        assert len(engine._registered_agents) == 2

    def test_sync_uses_system_message_content(self):
        from copilot_console.app.services.workflow_engine import WorkflowEngine
        from copilot_console.app.services import agent_storage_service as ass_mod

        agents = [self._create_mock_agent("my-agent", "Custom instructions here.")]
        self.monkeypatch.setattr(ass_mod.agent_storage_service, "list_agents", lambda: agents)

        engine = WorkflowEngine()
        engine.sync_agents_from_library()

        af_agent = engine._agents["my-agent"]
        # GitHubCopilotAgent stores instructions internally — verify agent was created
        assert af_agent.name == "my-agent"
        assert "my-agent" in engine._registered_agents

    def test_sync_no_system_message(self):
        """Agent without system_message falls back to description."""
        from copilot_console.app.services.workflow_engine import WorkflowEngine
        from copilot_console.app.services import agent_storage_service as ass_mod
        from copilot_console.app.models.agent import Agent

        agent = Agent(id="agent-1", name="fallback-agent", description="I help with stuff")
        agents = [agent]
        self.monkeypatch.setattr(ass_mod.agent_storage_service, "list_agents", lambda: agents)

        engine = WorkflowEngine()
        engine.sync_agents_from_library()

        af_agent = engine._agents["fallback-agent"]
        assert af_agent.name == "fallback-agent"
        assert "fallback-agent" in engine._registered_agents

    def test_sync_empty_library(self):
        from copilot_console.app.services.workflow_engine import WorkflowEngine
        from copilot_console.app.services import agent_storage_service as ass_mod

        self.monkeypatch.setattr(ass_mod.agent_storage_service, "list_agents", lambda: [])

        engine = WorkflowEngine()
        engine.sync_agents_from_library()

        assert len(engine._agents) == 0
        assert len(engine._registered_agents) == 0


class TestAgentBridgeTools:
    """Tests for FunctionTool creation from agent tool definitions."""

    @pytest.fixture(autouse=True)
    def setup(self, monkeypatch, tmp_path):
        import sys
        for mod in list(sys.modules):
            if "workflow" in mod and "copilot_console" in mod:
                sys.modules.pop(mod, None)

        workflows_dir = tmp_path / "workflows"
        workflow_runs_dir = tmp_path / "workflow-runs"
        workflows_dir.mkdir()
        workflow_runs_dir.mkdir()

        import copilot_console.app.workflow_config as wf_config
        monkeypatch.setattr(wf_config, "WORKFLOWS_DIR", workflows_dir)
        monkeypatch.setattr(wf_config, "WORKFLOW_RUNS_DIR", workflow_runs_dir)
        self.monkeypatch = monkeypatch

    def _create_agent_with_tools(self, name="tool-agent", custom_tools=None,
                                  builtin=None, excluded_builtin=None,
                                  mcp_servers=None, model=None):
        from copilot_console.app.models.agent import Agent, AgentTools, SystemMessage
        tools = AgentTools(
            custom=custom_tools or [],
            builtin=builtin or [],
            excluded_builtin=excluded_builtin or [],
        )
        return Agent(
            id=f"agent-{name}",
            name=name,
            description="Test agent",
            system_message=SystemMessage(mode="replace", content=f"You are {name}."),
            tools=tools,
            mcp_servers=mcp_servers or [],
            model=model or "",
        )

    def test_custom_tools_become_function_tools(self):
        """Custom tool specs should be wrapped as FunctionTool with name, description, func, input_model."""
        from copilot_console.app.services.workflow_engine import WorkflowEngine
        from copilot_console.app.services import agent_storage_service as ass_mod
        from copilot_console.app.services import tools_service as ts_mod
        from copilot_console.app.models.tools import ToolSpecWithHandler

        def my_handler(location: str) -> str:
            return f"Weather in {location}"

        spec = ToolSpecWithHandler(
            name="get_weather",
            description="Get the weather",
            parameters={"type": "object", "properties": {"location": {"type": "string"}}, "required": ["location"]},
            source_file="test.py",
            handler=my_handler,
        )

        agent = self._create_agent_with_tools(custom_tools=["get_weather"])
        self.monkeypatch.setattr(ass_mod.agent_storage_service, "list_agents", lambda: [agent])

        # Mock tools_service to return our spec
        mock_ts = type("MockTS", (), {"get_tools_for_session": lambda self, sel: [spec]})()
        self.monkeypatch.setattr(ts_mod, "get_tools_service", lambda: mock_ts)

        engine = WorkflowEngine()
        engine.sync_agents_from_library()

        af_agent = engine._agents["tool-agent"]
        # AF stores tools in _tools after normalize_tools
        assert af_agent._tools is not None
        assert len(af_agent._tools) == 1

        ft = af_agent._tools[0]
        assert ft.name == "get_weather"
        assert ft.description == "Get the weather"
        assert ft.parameters() == spec.parameters

    def test_multiple_custom_tools(self):
        """Multiple custom tools should all be converted to FunctionTool."""
        from copilot_console.app.services.workflow_engine import WorkflowEngine
        from copilot_console.app.services import agent_storage_service as ass_mod
        from copilot_console.app.services import tools_service as ts_mod
        from copilot_console.app.models.tools import ToolSpecWithHandler

        specs = [
            ToolSpecWithHandler(
                name=f"tool_{i}", description=f"Tool {i}",
                parameters={"type": "object", "properties": {}},
                source_file="test.py", handler=lambda: f"result {i}",
            )
            for i in range(3)
        ]

        agent = self._create_agent_with_tools(custom_tools=["tool_0", "tool_1", "tool_2"])
        self.monkeypatch.setattr(ass_mod.agent_storage_service, "list_agents", lambda: [agent])
        mock_ts = type("MockTS", (), {"get_tools_for_session": lambda self, sel: specs})()
        self.monkeypatch.setattr(ts_mod, "get_tools_service", lambda: mock_ts)

        engine = WorkflowEngine()
        engine.sync_agents_from_library()

        assert len(engine._agents["tool-agent"]._tools) == 3

    def test_no_custom_tools_passes_none(self):
        """Agent without custom tools should not set _tools."""
        from copilot_console.app.services.workflow_engine import WorkflowEngine
        from copilot_console.app.services import agent_storage_service as ass_mod

        agent = self._create_agent_with_tools(custom_tools=[])
        self.monkeypatch.setattr(ass_mod.agent_storage_service, "list_agents", lambda: [agent])

        engine = WorkflowEngine()
        engine.sync_agents_from_library()

        # No tools passed → _tools should be empty/None
        af_agent = engine._agents["tool-agent"]
        assert not af_agent._tools

    def test_tool_resolution_failure_logs_warning(self):
        """If tools_service raises, agent should still be created without tools."""
        from copilot_console.app.services.workflow_engine import WorkflowEngine
        from copilot_console.app.services import agent_storage_service as ass_mod
        from copilot_console.app.services import tools_service as ts_mod

        agent = self._create_agent_with_tools(custom_tools=["nonexistent_tool"])
        self.monkeypatch.setattr(ass_mod.agent_storage_service, "list_agents", lambda: [agent])

        def raise_error(sel):
            raise RuntimeError("Tool not found")
        mock_ts = type("MockTS", (), {"get_tools_for_session": raise_error})()
        self.monkeypatch.setattr(ts_mod, "get_tools_service", lambda: mock_ts)

        engine = WorkflowEngine()
        engine.sync_agents_from_library()

        # Agent should still be registered, just without tools
        assert "tool-agent" in engine._agents
        assert not engine._agents["tool-agent"]._tools


class TestAgentBridgeBuiltinTools:
    """Tests for available_tools/excluded_tools (built-in tool filtering)."""

    @pytest.fixture(autouse=True)
    def setup(self, monkeypatch, tmp_path):
        import sys
        for mod in list(sys.modules):
            if "workflow" in mod and "copilot_console" in mod:
                sys.modules.pop(mod, None)

        workflows_dir = tmp_path / "workflows"
        workflow_runs_dir = tmp_path / "workflow-runs"
        workflows_dir.mkdir()
        workflow_runs_dir.mkdir()

        import copilot_console.app.workflow_config as wf_config
        monkeypatch.setattr(wf_config, "WORKFLOWS_DIR", workflows_dir)
        monkeypatch.setattr(wf_config, "WORKFLOW_RUNS_DIR", workflow_runs_dir)
        self.monkeypatch = monkeypatch

    def _create_agent_with_builtin(self, builtin=None, excluded_builtin=None):
        from copilot_console.app.models.agent import Agent, AgentTools, SystemMessage
        tools = AgentTools(
            custom=[],
            builtin=builtin or [],
            excluded_builtin=excluded_builtin or [],
        )
        return Agent(
            id="agent-test",
            name="test-agent",
            description="Test",
            system_message=SystemMessage(mode="replace", content="You are test."),
            tools=tools,
        )

    def test_available_tools_stored(self):
        """Builtin tools from agent definition should be stored as _available_tools."""
        from copilot_console.app.services.workflow_engine import WorkflowEngine
        from copilot_console.app.services import agent_storage_service as ass_mod

        agent = self._create_agent_with_builtin(builtin=["code_search", "file_reader"])
        self.monkeypatch.setattr(ass_mod.agent_storage_service, "list_agents", lambda: [agent])

        engine = WorkflowEngine()
        engine.sync_agents_from_library()

        af_agent = engine._agents["test-agent"]
        assert af_agent._available_tools == ["code_search", "file_reader"]
        assert af_agent._excluded_tools is None

    def test_excluded_tools_stored(self):
        """Excluded builtin tools should be stored as _excluded_tools."""
        from copilot_console.app.services.workflow_engine import WorkflowEngine
        from copilot_console.app.services import agent_storage_service as ass_mod

        agent = self._create_agent_with_builtin(excluded_builtin=["web_search"])
        self.monkeypatch.setattr(ass_mod.agent_storage_service, "list_agents", lambda: [agent])

        engine = WorkflowEngine()
        engine.sync_agents_from_library()

        af_agent = engine._agents["test-agent"]
        assert af_agent._available_tools is None
        assert af_agent._excluded_tools == ["web_search"]

    def test_no_builtin_tools_both_none(self):
        """Agent without builtin/excluded_builtin → both None."""
        from copilot_console.app.services.workflow_engine import WorkflowEngine
        from copilot_console.app.services import agent_storage_service as ass_mod

        agent = self._create_agent_with_builtin()
        self.monkeypatch.setattr(ass_mod.agent_storage_service, "list_agents", lambda: [agent])

        engine = WorkflowEngine()
        engine.sync_agents_from_library()

        af_agent = engine._agents["test-agent"]
        assert af_agent._available_tools is None
        assert af_agent._excluded_tools is None

    def test_workflow_copilot_agent_is_github_copilot_agent(self):
        """WorkflowCopilotAgent must be a proper subclass of GitHubCopilotAgent."""
        from copilot_console.app.services.workflow_engine import WorkflowCopilotAgent
        from agent_framework_github_copilot import GitHubCopilotAgent
        assert issubclass(WorkflowCopilotAgent, GitHubCopilotAgent)


class TestAgentBridgeMCPAndModel:
    """Tests for MCP server and model passing through default_options."""

    @pytest.fixture(autouse=True)
    def setup(self, monkeypatch, tmp_path):
        import sys
        for mod in list(sys.modules):
            if "workflow" in mod and "copilot_console" in mod:
                sys.modules.pop(mod, None)

        workflows_dir = tmp_path / "workflows"
        workflow_runs_dir = tmp_path / "workflow-runs"
        workflows_dir.mkdir()
        workflow_runs_dir.mkdir()

        import copilot_console.app.workflow_config as wf_config
        monkeypatch.setattr(wf_config, "WORKFLOWS_DIR", workflows_dir)
        monkeypatch.setattr(wf_config, "WORKFLOW_RUNS_DIR", workflow_runs_dir)
        self.monkeypatch = monkeypatch

    def test_model_passed_in_settings(self):
        """Agent model should be passed via default_options and stored in settings."""
        from copilot_console.app.services.workflow_engine import WorkflowEngine
        from copilot_console.app.services import agent_storage_service as ass_mod
        from copilot_console.app.models.agent import Agent, SystemMessage

        agent = Agent(
            id="agent-1", name="model-agent", description="Test",
            system_message=SystemMessage(mode="replace", content="You help."),
            model="gpt-4o",
        )
        self.monkeypatch.setattr(ass_mod.agent_storage_service, "list_agents", lambda: [agent])

        engine = WorkflowEngine()
        engine.sync_agents_from_library()

        af_agent = engine._agents["model-agent"]
        # AF stores model in _settings after popping from opts
        assert af_agent._settings["model"] == "gpt-4o"

    def test_mcp_servers_passed_via_opts(self):
        """MCP servers should be passed via default_options and stored in _mcp_servers."""
        from copilot_console.app.services.workflow_engine import WorkflowEngine
        from copilot_console.app.services import agent_storage_service as ass_mod
        from copilot_console.app.services import mcp_service as mcp_mod
        from copilot_console.app.models.agent import Agent, SystemMessage

        mcp_sdk_config = {
            "my-server": {"command": "npx", "args": ["-y", "my-mcp-server"]}
        }

        agent = Agent(
            id="agent-1", name="mcp-agent", description="Test",
            system_message=SystemMessage(mode="replace", content="You help."),
            mcp_servers=["my-server"],
        )
        self.monkeypatch.setattr(ass_mod.agent_storage_service, "list_agents", lambda: [agent])
        self.monkeypatch.setattr(mcp_mod.mcp_service, "get_servers_for_sdk", lambda servers: mcp_sdk_config)

        engine = WorkflowEngine()
        engine.sync_agents_from_library()

        af_agent = engine._agents["mcp-agent"]
        assert af_agent._mcp_servers == mcp_sdk_config

    def test_mcp_resolution_failure_logs_warning(self):
        """If MCP resolution fails, agent is created without MCP servers."""
        from copilot_console.app.services.workflow_engine import WorkflowEngine
        from copilot_console.app.services import agent_storage_service as ass_mod
        from copilot_console.app.services import mcp_service as mcp_mod
        from copilot_console.app.models.agent import Agent, SystemMessage

        agent = Agent(
            id="agent-1", name="mcp-fail-agent", description="Test",
            system_message=SystemMessage(mode="replace", content="You help."),
            mcp_servers=["bad-server"],
        )
        self.monkeypatch.setattr(ass_mod.agent_storage_service, "list_agents", lambda: [agent])
        self.monkeypatch.setattr(mcp_mod.mcp_service, "get_servers_for_sdk",
                                 lambda s: (_ for _ in ()).throw(RuntimeError("Server not found")))

        engine = WorkflowEngine()
        engine.sync_agents_from_library()

        assert "mcp-fail-agent" in engine._agents
        assert engine._agents["mcp-fail-agent"]._mcp_servers is None

    def test_no_model_uses_af_default(self):
        """Agent without model → AF falls back to its own default model from settings."""
        from copilot_console.app.services.workflow_engine import WorkflowEngine
        from copilot_console.app.services import agent_storage_service as ass_mod
        from copilot_console.app.models.agent import Agent, SystemMessage

        agent = Agent(
            id="agent-1", name="no-model", description="Test",
            system_message=SystemMessage(mode="replace", content="You help."),
        )
        self.monkeypatch.setattr(ass_mod.agent_storage_service, "list_agents", lambda: [agent])

        engine = WorkflowEngine()
        engine.sync_agents_from_library()

        # No model passed → AF uses its own default from settings (not None)
        af_agent = engine._agents["no-model"]
        assert af_agent._settings.get("model") is not None


class TestAgentBridgeSystemMessage:
    """Tests for system_message mode mapping (append/replace)."""

    @pytest.fixture(autouse=True)
    def setup(self, monkeypatch, tmp_path):
        import sys
        for mod in list(sys.modules):
            if "workflow" in mod and "copilot_console" in mod:
                sys.modules.pop(mod, None)

        workflows_dir = tmp_path / "workflows"
        workflow_runs_dir = tmp_path / "workflow-runs"
        workflows_dir.mkdir()
        workflow_runs_dir.mkdir()

        import copilot_console.app.workflow_config as wf_config
        monkeypatch.setattr(wf_config, "WORKFLOWS_DIR", workflows_dir)
        monkeypatch.setattr(wf_config, "WORKFLOW_RUNS_DIR", workflow_runs_dir)
        self.monkeypatch = monkeypatch

    def test_replace_mode_passed(self):
        """Agent with mode=replace should pass {mode: replace, content: ...} to AF."""
        from copilot_console.app.services.workflow_engine import WorkflowEngine
        from copilot_console.app.services import agent_storage_service as ass_mod
        from copilot_console.app.models.agent import Agent, SystemMessage

        agent = Agent(
            id="agent-1", name="replace-agent", description="Test",
            system_message=SystemMessage(mode="replace", content="You are a strict reviewer."),
        )
        self.monkeypatch.setattr(ass_mod.agent_storage_service, "list_agents", lambda: [agent])

        engine = WorkflowEngine()
        engine.sync_agents_from_library()

        af_agent = engine._agents["replace-agent"]
        sys_msg = af_agent._default_options.get("system_message")
        assert sys_msg is not None
        assert sys_msg["mode"] == "replace"
        assert sys_msg["content"] == "You are a strict reviewer."

    def test_append_mode_passed(self):
        """Agent with mode=append should pass {mode: append, content: ...} to AF."""
        from copilot_console.app.services.workflow_engine import WorkflowEngine
        from copilot_console.app.services import agent_storage_service as ass_mod
        from copilot_console.app.models.agent import Agent, SystemMessage

        agent = Agent(
            id="agent-1", name="append-agent", description="Test",
            system_message=SystemMessage(mode="append", content="Always be concise."),
        )
        self.monkeypatch.setattr(ass_mod.agent_storage_service, "list_agents", lambda: [agent])

        engine = WorkflowEngine()
        engine.sync_agents_from_library()

        af_agent = engine._agents["append-agent"]
        sys_msg = af_agent._default_options.get("system_message")
        assert sys_msg is not None
        assert sys_msg["mode"] == "append"
        assert sys_msg["content"] == "Always be concise."

    def test_no_system_message_falls_back_to_description(self):
        """Agent without system_message should use description as append."""
        from copilot_console.app.services.workflow_engine import WorkflowEngine
        from copilot_console.app.services import agent_storage_service as ass_mod
        from copilot_console.app.models.agent import Agent

        agent = Agent(id="agent-1", name="no-msg", description="I help with code reviews")
        self.monkeypatch.setattr(ass_mod.agent_storage_service, "list_agents", lambda: [agent])

        engine = WorkflowEngine()
        engine.sync_agents_from_library()

        af_agent = engine._agents["no-msg"]
        sys_msg = af_agent._default_options.get("system_message")
        assert sys_msg is not None
        assert sys_msg["mode"] == "append"
        assert sys_msg["content"] == "I help with code reviews"

    def test_no_system_message_no_description_falls_back_to_name(self):
        """Agent without system_message or description uses 'You are {name}.'."""
        from copilot_console.app.services.workflow_engine import WorkflowEngine
        from copilot_console.app.services import agent_storage_service as ass_mod
        from copilot_console.app.models.agent import Agent

        agent = Agent(id="agent-1", name="mystery-agent", description="")
        self.monkeypatch.setattr(ass_mod.agent_storage_service, "list_agents", lambda: [agent])

        engine = WorkflowEngine()
        engine.sync_agents_from_library()

        af_agent = engine._agents["mystery-agent"]
        sys_msg = af_agent._default_options.get("system_message")
        assert sys_msg["content"] == "You are mystery-agent."

    def test_empty_content_falls_back(self):
        """SystemMessage with empty content should fall back to description."""
        from copilot_console.app.services.workflow_engine import WorkflowEngine
        from copilot_console.app.services import agent_storage_service as ass_mod
        from copilot_console.app.models.agent import Agent, SystemMessage

        agent = Agent(
            id="agent-1", name="empty-msg", description="Fallback desc",
            system_message=SystemMessage(mode="replace", content=""),
        )
        self.monkeypatch.setattr(ass_mod.agent_storage_service, "list_agents", lambda: [agent])

        engine = WorkflowEngine()
        engine.sync_agents_from_library()

        af_agent = engine._agents["empty-msg"]
        sys_msg = af_agent._default_options.get("system_message")
        assert sys_msg["content"] == "Fallback desc"
        assert sys_msg["mode"] == "append"


class TestAgentBridgeSubAgents:
    """Tests for sub-agent (custom_agents) bridging."""

    @pytest.fixture(autouse=True)
    def setup(self, monkeypatch, tmp_path):
        import sys
        for mod in list(sys.modules):
            if "workflow" in mod and "copilot_console" in mod:
                sys.modules.pop(mod, None)

        workflows_dir = tmp_path / "workflows"
        workflow_runs_dir = tmp_path / "workflow-runs"
        workflows_dir.mkdir()
        workflow_runs_dir.mkdir()

        import copilot_console.app.workflow_config as wf_config
        monkeypatch.setattr(wf_config, "WORKFLOWS_DIR", workflows_dir)
        monkeypatch.setattr(wf_config, "WORKFLOW_RUNS_DIR", workflow_runs_dir)
        self.monkeypatch = monkeypatch

    def test_sub_agents_resolved_to_custom_agents(self):
        """Agent with sub_agents should have _custom_agents populated."""
        from copilot_console.app.services.workflow_engine import WorkflowEngine
        from copilot_console.app.services import agent_storage_service as ass_mod
        from copilot_console.app.models.agent import Agent, SystemMessage

        sdk_custom_agents = [
            {"name": "sub-1", "display_name": "Sub Agent 1", "description": "Helper",
             "prompt": "You help.", "infer": True},
        ]

        agent = Agent(
            id="agent-1", name="parent-agent", description="Parent",
            system_message=SystemMessage(mode="replace", content="You orchestrate."),
            sub_agents=["sub-1"],
        )
        self.monkeypatch.setattr(ass_mod.agent_storage_service, "list_agents", lambda: [agent])
        self.monkeypatch.setattr(
            ass_mod.agent_storage_service, "convert_to_sdk_custom_agents",
            lambda ids, mcp_svc: sdk_custom_agents,
        )

        engine = WorkflowEngine()
        engine.sync_agents_from_library()

        af_agent = engine._agents["parent-agent"]
        assert af_agent._custom_agents == sdk_custom_agents

    def test_no_sub_agents_custom_agents_is_none(self):
        """Agent without sub_agents should have _custom_agents as None."""
        from copilot_console.app.services.workflow_engine import WorkflowEngine
        from copilot_console.app.services import agent_storage_service as ass_mod
        from copilot_console.app.models.agent import Agent, SystemMessage

        agent = Agent(
            id="agent-1", name="solo-agent", description="Solo",
            system_message=SystemMessage(mode="replace", content="You work alone."),
        )
        self.monkeypatch.setattr(ass_mod.agent_storage_service, "list_agents", lambda: [agent])

        engine = WorkflowEngine()
        engine.sync_agents_from_library()

        assert engine._agents["solo-agent"]._custom_agents is None

    def test_sub_agent_resolution_failure_logs_warning(self):
        """If sub-agent resolution fails, agent is created without custom_agents."""
        from copilot_console.app.services.workflow_engine import WorkflowEngine
        from copilot_console.app.services import agent_storage_service as ass_mod
        from copilot_console.app.models.agent import Agent, SystemMessage

        agent = Agent(
            id="agent-1", name="broken-parent", description="Parent",
            system_message=SystemMessage(mode="replace", content="You orchestrate."),
            sub_agents=["nonexistent-sub"],
        )
        self.monkeypatch.setattr(ass_mod.agent_storage_service, "list_agents", lambda: [agent])
        self.monkeypatch.setattr(
            ass_mod.agent_storage_service, "convert_to_sdk_custom_agents",
            lambda ids, mcp_svc: (_ for _ in ()).throw(RuntimeError("Sub-agent not found")),
        )

        engine = WorkflowEngine()
        engine.sync_agents_from_library()

        assert "broken-parent" in engine._agents
        assert engine._agents["broken-parent"]._custom_agents is None


class TestWorkflowCopilotAgentSessionInjection:
    """Tests for _inject_session_fields and _resume_session override."""

    def test_inject_available_tools(self):
        from copilot_console.app.services.workflow_engine import WorkflowCopilotAgent
        agent = WorkflowCopilotAgent(
            name="test", available_tools=["code_search"],
            default_options={"system_message": {"mode": "append", "content": "test"}},
        )
        config = {}
        agent._inject_session_fields(config)
        assert config["available_tools"] == ["code_search"]
        assert "excluded_tools" not in config

    def test_inject_excluded_tools(self):
        from copilot_console.app.services.workflow_engine import WorkflowCopilotAgent
        agent = WorkflowCopilotAgent(
            name="test", excluded_tools=["web_search"],
            default_options={"system_message": {"mode": "append", "content": "test"}},
        )
        config = {}
        agent._inject_session_fields(config)
        assert config["excluded_tools"] == ["web_search"]
        assert "available_tools" not in config

    def test_inject_custom_agents(self):
        from copilot_console.app.services.workflow_engine import WorkflowCopilotAgent
        custom = [{"name": "sub", "display_name": "Sub", "description": "Help",
                    "prompt": "You help.", "infer": True}]
        agent = WorkflowCopilotAgent(
            name="test", custom_agents=custom,
            default_options={"system_message": {"mode": "append", "content": "test"}},
        )
        config = {}
        agent._inject_session_fields(config)
        assert config["custom_agents"] == custom

    def test_inject_all_fields(self):
        from copilot_console.app.services.workflow_engine import WorkflowCopilotAgent
        custom = [{"name": "sub", "display_name": "Sub", "description": "Help",
                    "prompt": "You help.", "infer": True}]
        agent = WorkflowCopilotAgent(
            name="test", available_tools=["code_search"], custom_agents=custom,
            default_options={"system_message": {"mode": "append", "content": "test"}},
        )
        config = {}
        agent._inject_session_fields(config)
        assert config["available_tools"] == ["code_search"]
        assert config["custom_agents"] == custom

    def test_inject_nothing_when_all_none(self):
        from copilot_console.app.services.workflow_engine import WorkflowCopilotAgent
        agent = WorkflowCopilotAgent(
            name="test",
            default_options={"system_message": {"mode": "append", "content": "test"}},
        )
        config = {}
        agent._inject_session_fields(config)
        assert "available_tools" not in config
        assert "excluded_tools" not in config
        assert "custom_agents" not in config

    def test_available_takes_precedence_over_excluded(self):
        """If both available and excluded are set, available wins (matching SDK behavior)."""
        from copilot_console.app.services.workflow_engine import WorkflowCopilotAgent
        agent = WorkflowCopilotAgent(
            name="test", available_tools=["code_search"], excluded_tools=["web_search"],
            default_options={"system_message": {"mode": "append", "content": "test"}},
        )
        config = {}
        agent._inject_session_fields(config)
        assert config["available_tools"] == ["code_search"]
        assert "excluded_tools" not in config

    def test_inject_working_directory(self):
        from copilot_console.app.services.workflow_engine import WorkflowCopilotAgent
        agent = WorkflowCopilotAgent(
            name="test", working_directory="/tmp/workflow-run-123",
            default_options={"system_message": {"mode": "append", "content": "test"}},
        )
        config = {}
        agent._inject_session_fields(config)
        assert config["working_directory"] == "/tmp/workflow-run-123"

    def test_inject_no_working_directory_when_none(self):
        from copilot_console.app.services.workflow_engine import WorkflowCopilotAgent
        agent = WorkflowCopilotAgent(
            name="test",
            default_options={"system_message": {"mode": "append", "content": "test"}},
        )
        config = {}
        agent._inject_session_fields(config)
        assert "working_directory" not in config


class TestWorkflowEngineLifecycle:
    """Tests for WorkflowEngine set_working_directory and stop_agents."""

    def test_set_working_directory_updates_all_agents(self):
        from copilot_console.app.services.workflow_engine import WorkflowCopilotAgent, WorkflowEngine
        engine = WorkflowEngine()
        engine._agents = {
            "a1": WorkflowCopilotAgent(name="a1", default_options={"system_message": {"mode": "append", "content": "t"}}),
            "a2": WorkflowCopilotAgent(name="a2", default_options={"system_message": {"mode": "append", "content": "t"}}),
        }
        engine.set_working_directory("/tmp/test-run")
        assert engine._agents["a1"]._working_directory == "/tmp/test-run"
        assert engine._agents["a2"]._working_directory == "/tmp/test-run"

    @pytest.mark.asyncio
    async def test_stop_agents_calls_stop_on_all(self):
        from copilot_console.app.services.workflow_engine import WorkflowEngine
        agent1 = MagicMock()
        agent1.stop = AsyncMock()
        agent2 = MagicMock()
        agent2.stop = AsyncMock()
        engine = WorkflowEngine()
        engine._agents = {"a1": agent1, "a2": agent2}
        await engine.stop_agents()
        agent1.stop.assert_called_once()
        agent2.stop.assert_called_once()

    @pytest.mark.asyncio
    async def test_stop_agents_handles_errors_gracefully(self):
        from copilot_console.app.services.workflow_engine import WorkflowEngine
        agent1 = MagicMock()
        agent1.stop = AsyncMock(side_effect=RuntimeError("boom"))
        agent2 = MagicMock()
        agent2.stop = AsyncMock()
        engine = WorkflowEngine()
        engine._agents = {"a1": agent1, "a2": agent2}
        # Should not raise — errors are logged and suppressed
        await engine.stop_agents()
        agent2.stop.assert_called_once()

    def test_collect_session_ids_from_agents(self):
        from copilot_console.app.services.workflow_engine import WorkflowEngine
        agent1 = MagicMock()
        agent1._session_ids = ["sess-aaa", "sess-bbb"]
        agent2 = MagicMock()
        agent2._session_ids = ["sess-ccc"]
        engine = WorkflowEngine()
        engine._agents = {"a1": agent1, "a2": agent2}
        ids = engine.collect_session_ids()
        assert sorted(ids) == ["sess-aaa", "sess-bbb", "sess-ccc"]

    def test_collect_session_ids_no_client(self):
        from copilot_console.app.services.workflow_engine import WorkflowEngine
        agent1 = MagicMock()
        agent1._session_ids = []
        engine = WorkflowEngine()
        engine._agents = {"a1": agent1}
        assert engine.collect_session_ids() == []

    def test_collect_session_ids_empty(self):
        from copilot_console.app.services.workflow_engine import WorkflowEngine
        engine = WorkflowEngine()
        engine._agents = {}
        assert engine.collect_session_ids() == []


class TestWorkflowRunServiceFlatStorage:
    """Tests for flattened run storage and delete returning run data."""

    @pytest.fixture(autouse=True)
    def setup(self, tmp_path):
        import copilot_console.app.services.workflow_run_service as svc_mod
        self._orig_dir = svc_mod.WORKFLOW_RUNS_DIR
        svc_mod.WORKFLOW_RUNS_DIR = tmp_path / "workflow-runs"
        svc_mod.WORKFLOW_RUNS_DIR.mkdir()
        self.runs_dir = svc_mod.WORKFLOW_RUNS_DIR
        self.svc = svc_mod.WorkflowRunService()
        yield
        svc_mod.WORKFLOW_RUNS_DIR = self._orig_dir

    def test_save_and_load_flat(self):
        from copilot_console.app.models.workflow import WorkflowRun, WorkflowRunStatus
        run = WorkflowRun(
            id="run-flat-1", workflow_id="wf-1", status=WorkflowRunStatus.PENDING,
            started_at=datetime(2025, 1, 1, tzinfo=timezone.utc), copilot_session_ids=["s1", "s2"],
        )
        self.svc.save_run(run)
        assert (self.runs_dir / "run-flat-1.json").exists()
        loaded = self.svc.load_run("run-flat-1")
        assert loaded is not None
        assert loaded.copilot_session_ids == ["s1", "s2"]

    def test_load_legacy_fallback(self):
        """Runs stored in date-based dirs should still load."""
        from copilot_console.app.models.workflow import WorkflowRun, WorkflowRunStatus
        date_dir = self.runs_dir / "2025-01-15"
        date_dir.mkdir()
        run = WorkflowRun(
            id="run-legacy-1", workflow_id="wf-1", status=WorkflowRunStatus.COMPLETED,
            started_at=datetime(2025, 1, 15, tzinfo=timezone.utc),
        )
        data = run.model_dump(exclude={"node_results"})
        for key in ("started_at", "completed_at"):
            if data.get(key):
                data[key] = data[key].isoformat()
        data["node_results"] = run.node_results
        (date_dir / "run-legacy-1.json").write_text(json.dumps(data, default=str))
        loaded = self.svc.load_run("run-legacy-1")
        assert loaded is not None
        assert loaded.id == "run-legacy-1"

    def test_list_runs_includes_both(self):
        """list_runs should find both flat and legacy runs."""
        from copilot_console.app.models.workflow import WorkflowRun, WorkflowRunStatus
        # Flat run
        run1 = WorkflowRun(id="flat-1", workflow_id="wf-1", status=WorkflowRunStatus.COMPLETED,
                           started_at=datetime(2025, 2, 1, tzinfo=timezone.utc))
        self.svc.save_run(run1)
        # Legacy run
        date_dir = self.runs_dir / "2025-01-15"
        date_dir.mkdir()
        run2 = WorkflowRun(id="legacy-1", workflow_id="wf-1", status=WorkflowRunStatus.COMPLETED,
                           started_at=datetime(2025, 1, 15, tzinfo=timezone.utc))
        data = run2.model_dump(exclude={"node_results"})
        for key in ("started_at", "completed_at"):
            if data.get(key):
                data[key] = data[key].isoformat()
        data["node_results"] = run2.node_results
        (date_dir / "legacy-1.json").write_text(json.dumps(data, default=str))

        runs = self.svc.list_runs()
        ids = [r.id for r in runs]
        assert "flat-1" in ids
        assert "legacy-1" in ids

    def test_delete_run_returns_run(self):
        """delete_run should return the WorkflowRun with session IDs."""
        from copilot_console.app.models.workflow import WorkflowRun, WorkflowRunStatus
        run = WorkflowRun(id="del-1", workflow_id="wf-1", status=WorkflowRunStatus.COMPLETED,
                          started_at=datetime(2025, 1, 1, tzinfo=timezone.utc), copilot_session_ids=["sess-x"])
        self.svc.save_run(run)
        deleted = self.svc.delete_run("del-1")
        assert deleted is not None
        assert deleted.copilot_session_ids == ["sess-x"]
        assert not (self.runs_dir / "del-1.json").exists()

    def test_delete_run_not_found(self):
        assert self.svc.delete_run("nonexistent") is None

    def test_copilot_session_ids_default_empty(self):
        """WorkflowRun.copilot_session_ids defaults to empty list."""
        from copilot_console.app.models.workflow import WorkflowRun, WorkflowRunStatus
        run = WorkflowRun(id="r1", workflow_id="wf-1", status=WorkflowRunStatus.PENDING,
                          started_at=datetime(2025, 1, 1, tzinfo=timezone.utc))
        assert run.copilot_session_ids == []


class TestRunningSubfolder:
    """Tests for running/ subfolder and zombie recovery."""

    @pytest.fixture(autouse=True)
    def setup(self, tmp_path):
        import copilot_console.app.services.workflow_run_service as svc_mod
        self._orig_dir = svc_mod.WORKFLOW_RUNS_DIR
        svc_mod.WORKFLOW_RUNS_DIR = tmp_path / "workflow-runs"
        svc_mod.WORKFLOW_RUNS_DIR.mkdir()
        self.runs_dir = svc_mod.WORKFLOW_RUNS_DIR
        self.svc = svc_mod.WorkflowRunService()
        yield
        svc_mod.WORKFLOW_RUNS_DIR = self._orig_dir

    def test_mark_running_moves_to_running_dir(self):
        from copilot_console.app.models.workflow import WorkflowRunStatus
        run = self.svc.create_run("wf-1", "Test WF")
        assert (self.runs_dir / f"{run.id}.json").exists()
        run = self.svc.mark_running(run)
        # Should be in running/ now, not in main
        assert not (self.runs_dir / f"{run.id}.json").exists()
        assert (self.runs_dir / "running" / f"{run.id}.json").exists()
        assert run.status == WorkflowRunStatus.RUNNING

    def test_mark_completed_moves_back_to_main(self):
        run = self.svc.create_run("wf-1", "Test WF")
        run = self.svc.mark_running(run)
        assert (self.runs_dir / "running" / f"{run.id}.json").exists()
        run = self.svc.mark_completed(run, node_results={"step": {"status": "completed"}})
        assert (self.runs_dir / f"{run.id}.json").exists()
        assert not (self.runs_dir / "running" / f"{run.id}.json").exists()

    def test_mark_failed_moves_back_to_main(self):
        run = self.svc.create_run("wf-1", "Test WF")
        run = self.svc.mark_running(run)
        run = self.svc.mark_failed(run, "Something broke")
        assert (self.runs_dir / f"{run.id}.json").exists()
        assert not (self.runs_dir / "running" / f"{run.id}.json").exists()

    def test_load_run_finds_in_running_dir(self):
        run = self.svc.create_run("wf-1", "Test WF")
        run = self.svc.mark_running(run)
        loaded = self.svc.load_run(run.id)
        assert loaded is not None
        assert loaded.status.value == "running"

    def test_list_runs_includes_running(self):
        run1 = self.svc.create_run("wf-1", "Test WF")
        run1 = self.svc.mark_running(run1)
        run2 = self.svc.create_run("wf-1", "Test WF 2")
        run2 = self.svc.mark_completed(self.svc.mark_running(run2))
        runs = self.svc.list_runs()
        ids = [r.id for r in runs]
        assert run1.id in ids
        assert run2.id in ids

    def test_delete_run_from_running_dir(self):
        run = self.svc.create_run("wf-1", "Test WF")
        run = self.svc.mark_running(run)
        deleted = self.svc.delete_run(run.id)
        assert deleted is not None
        assert not (self.runs_dir / "running" / f"{run.id}.json").exists()

    def test_save_run_routes_by_status(self):
        from copilot_console.app.models.workflow import WorkflowRun, WorkflowRunStatus
        # RUNNING → running/
        run = WorkflowRun(id="route-1", workflow_id="wf-1", status=WorkflowRunStatus.RUNNING,
                          started_at=datetime(2025, 1, 1, tzinfo=timezone.utc))
        self.svc.save_run(run)
        assert (self.runs_dir / "running" / "route-1.json").exists()
        assert not (self.runs_dir / "route-1.json").exists()
        # PAUSED → running/
        run.status = WorkflowRunStatus.PAUSED
        run.id = "route-2"
        self.svc.save_run(run)
        assert (self.runs_dir / "running" / "route-2.json").exists()
        # COMPLETED → main
        run.status = WorkflowRunStatus.COMPLETED
        run.id = "route-3"
        self.svc.save_run(run)
        assert (self.runs_dir / "route-3.json").exists()


class TestZombieRecovery:
    """Tests for startup zombie run recovery."""

    @pytest.fixture(autouse=True)
    def setup(self, tmp_path):
        import copilot_console.app.services.workflow_run_service as svc_mod
        self._orig_dir = svc_mod.WORKFLOW_RUNS_DIR
        svc_mod.WORKFLOW_RUNS_DIR = tmp_path / "workflow-runs"
        svc_mod.WORKFLOW_RUNS_DIR.mkdir()
        self.runs_dir = svc_mod.WORKFLOW_RUNS_DIR
        self.svc_mod = svc_mod
        yield
        svc_mod.WORKFLOW_RUNS_DIR = self._orig_dir

    def test_recover_zombie_runs(self):
        from copilot_console.app.models.workflow import WorkflowRun, WorkflowRunStatus
        # Simulate a crash: create a run in running/ manually
        running_dir = self.runs_dir / "running"
        running_dir.mkdir(exist_ok=True)
        run = WorkflowRun(
            id="zombie-1", workflow_id="wf-1", status=WorkflowRunStatus.RUNNING,
            started_at=datetime(2025, 1, 1, tzinfo=timezone.utc), copilot_session_ids=["sid-1", "sid-2"],
        )
        svc = self.svc_mod.WorkflowRunService()
        svc._save_to(running_dir / "zombie-1.json", run)

        count = svc.recover_zombie_runs()
        assert count == 1
        # Should be moved to main dir
        assert not (running_dir / "zombie-1.json").exists()
        assert (self.runs_dir / "zombie-1.json").exists()
        # Should be marked failed with session IDs preserved
        recovered = svc.load_run("zombie-1")
        assert recovered.status == WorkflowRunStatus.FAILED
        assert recovered.error == "Server terminated unexpectedly"
        assert recovered.copilot_session_ids == ["sid-1", "sid-2"]

    def test_recover_no_zombies(self):
        svc = self.svc_mod.WorkflowRunService()
        # __init__ already called recover — running/ should be empty
        assert svc.recover_zombie_runs() == 0

    def test_startup_auto_recovers(self):
        from copilot_console.app.models.workflow import WorkflowRun, WorkflowRunStatus
        # Place a zombie before constructing service
        running_dir = self.runs_dir / "running"
        running_dir.mkdir(exist_ok=True)
        run = WorkflowRun(
            id="auto-zombie", workflow_id="wf-1", status=WorkflowRunStatus.RUNNING,
            started_at=datetime(2025, 1, 1, tzinfo=timezone.utc),
        )
        data = run.model_dump(exclude={"node_results"})
        for key in ("started_at", "completed_at"):
            if data.get(key):
                data[key] = data[key].isoformat()
        data["node_results"] = run.node_results
        (running_dir / "auto-zombie.json").write_text(json.dumps(data, default=str))

        # Constructor should auto-recover
        svc = self.svc_mod.WorkflowRunService()
        assert not (running_dir / "auto-zombie.json").exists()
        recovered = svc.load_run("auto-zombie")
        assert recovered.status == WorkflowRunStatus.FAILED


class TestIncrementalSessionIdCapture:
    """Tests for session ID capture in _create_session."""

    def test_session_ids_list_initialized(self):
        from copilot_console.app.services.workflow_engine import WorkflowCopilotAgent
        agent = WorkflowCopilotAgent(
            name="test",
            default_options={"system_message": {"mode": "append", "content": "test"}},
        )
        assert agent._session_ids == []

    @pytest.mark.asyncio
    async def test_create_session_captures_id(self):
        from copilot_console.app.services.workflow_engine import WorkflowCopilotAgent
        agent = WorkflowCopilotAgent(
            name="test",
            default_options={"system_message": {"mode": "append", "content": "test"}},
        )
        # Mock the client
        mock_session = MagicMock()
        mock_session.session_id = "captured-session-123"
        agent._client = MagicMock()
        agent._client.create_session = AsyncMock(return_value=mock_session)
        agent._settings = {"model": None}
        agent._tools = None
        agent._permission_handler = None
        agent._mcp_servers = None

        session = await agent._create_session(streaming=False)
        assert session.session_id == "captured-session-123"
        assert "captured-session-123" in agent._session_ids
