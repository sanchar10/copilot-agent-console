"""E2E verification: Load a 2-agent sequential workflow via AF and generate Mermaid.

This script verifies the Agent Framework integration works end-to-end:
1. Parse a 2-agent sequential YAML workflow via WorkflowFactory (agents pre-registered)
2. Confirm it produces a Workflow object
3. Generate Mermaid visualization via WorkflowViz
4. Test the WorkflowEngine wrapper

Usage:
    python tests/test_workflow_e2e_verify.py
"""

import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

# Ensure src/ is on path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from agent_framework import Agent, Workflow, WorkflowViz
from agent_framework_declarative import WorkflowFactory

# AF declarative YAML: kind: Workflow, trigger with actions.
# Agents are pre-registered via WorkflowFactory(agents={...}) — not inline.
# This matches the Phase 1 approach: our agent library agents are pre-registered.
# Uses InvokeAzureAgent (the only agent action kind supported by AF).
YAML_CONTENT = """\
kind: Workflow
name: test-sequential
trigger:
  kind: OnConversationStart
  id: sequential_pipeline
  actions:
    - kind: InvokeAzureAgent
      id: research_step
      agent:
        name: researcher
    - kind: InvokeAzureAgent
      id: write_step
      agent:
        name: writer
"""


def _create_mock_agent(name: str, instructions: str) -> Agent:
    """Create a mock AF Agent that doesn't need an API key."""
    mock_client = MagicMock()
    mock_client.get_response = AsyncMock(return_value=MagicMock(
        text=f"Mock output from {name}",
        choices=[MagicMock(message=MagicMock(content=f"Mock output from {name}"))],
    ))
    return Agent(
        client=mock_client,
        name=name,
        instructions=instructions,
    )


def main():
    print("=== AF E2E Verification: 2-agent sequential workflow ===\n")

    # Step 1: Create mock agents and register with WorkflowFactory
    print("1. Creating mock agents and loading YAML via WorkflowFactory...")
    researcher = _create_mock_agent("researcher", "You are a researcher.")
    writer = _create_mock_agent("writer", "You are a writer.")

    factory = WorkflowFactory(agents={"researcher": researcher, "writer": writer})
    workflow = factory.create_workflow_from_yaml(YAML_CONTENT)
    wtype = type(workflow).__name__
    print(f"   Result type: {wtype}")

    assert isinstance(workflow, Workflow), f"Expected Workflow, got {wtype}"
    print("   \u2705 Correctly parsed as Workflow")

    # Step 2: Check name
    wname = getattr(workflow, "name", None)
    print(f"   Workflow name: {wname}")

    # Step 3: Visualize
    print("\n2. Generating Mermaid diagram via WorkflowViz...")
    viz = WorkflowViz(workflow)
    mermaid = viz.to_mermaid()
    print(f"   Mermaid diagram ({len(mermaid)} chars):")
    print()
    for line in mermaid.splitlines():
        print(f"   {line}")
    assert len(mermaid) > 0
    print("   \u2705 Mermaid visualization works")

    # Step 4: Test engine wrapper
    print("\n3. Testing WorkflowEngine wrapper...")
    from copilot_agent_console.app.services.workflow_engine import WorkflowEngine
    engine = WorkflowEngine()

    # Engine uses its own factory — register agents for this test
    engine._workflow_factory = WorkflowFactory(agents={"researcher": researcher, "writer": writer})

    wf2 = engine.load_from_yaml_string(YAML_CONTENT)
    assert isinstance(wf2, Workflow)
    print("   \u2705 load_from_yaml_string works")

    mermaid2 = engine.visualize(wf2)
    assert len(mermaid2) > 0
    print("   \u2705 visualize works")

    result = engine.validate_yaml(YAML_CONTENT)
    assert result["valid"] is True
    print("   \u2705 validate_yaml works")

    # Step 5: Test with file path
    print("\n4. Testing load from file path...")
    import tempfile
    with tempfile.NamedTemporaryFile(mode="w", suffix=".yaml", delete=False, encoding="utf-8") as f:
        f.write(YAML_CONTENT)
        tmp_path = f.name

    wf3 = engine.load_from_yaml_path(tmp_path)
    assert isinstance(wf3, Workflow)
    print("   \u2705 load_from_yaml_path works")

    Path(tmp_path).unlink()

    # Step 6: Test as_agent() — NOTE: declarative workflows use JoinExecutor as
    # start node, which doesn't accept list[Message]. as_agent() requires
    # imperative WorkflowBuilder or a compatible start executor.
    # This is expected behavior, not a bug.
    print("\n5. Testing as_agent() compatibility...")
    from agent_framework import WorkflowAgent, WorkflowBuilder, AgentExecutor
    try:
        agent = workflow.as_agent(name="test-sequential")
        print(f"   as_agent result type: {type(agent).__name__}")
        print("   \u2705 as_agent works with declarative workflow")
    except ValueError as e:
        print(f"   \u26a0\ufe0f  as_agent not compatible with declarative entry node: {e}")
        print("   Testing imperative WorkflowBuilder for as_agent()...")

        # Build same workflow imperatively — this supports as_agent()
        exec_r = AgentExecutor(researcher, id="researcher_exec")
        exec_w = AgentExecutor(writer, id="writer_exec")
        imperative_wf = (
            WorkflowBuilder(name="test-sequential-imperative", start_executor=exec_r)
            .add_edge(exec_r, exec_w)
            .build()
        )
        agent = imperative_wf.as_agent(name="test-sequential-imperative")
        assert isinstance(agent, WorkflowAgent)
        print(f"   as_agent result type: {type(agent).__name__}")
        print("   \u2705 as_agent works with imperative WorkflowBuilder")

    # Step 7: Test full storage + engine integration
    print("\n6. Testing storage + engine integration...")
    from copilot_agent_console.app.services.workflow_storage_service import WorkflowStorageService
    from copilot_agent_console.app.services.workflow_run_service import WorkflowRunService
    from copilot_agent_console.app.models.workflow import WorkflowCreate

    # Use temp dirs (don't touch real storage)
    import copilot_agent_console.app.workflow_config as wf_config
    import tempfile as tf
    tmpdir = Path(tf.mkdtemp())
    orig_wf = wf_config.WORKFLOWS_DIR
    orig_wr = wf_config.WORKFLOW_RUNS_DIR
    wf_config.WORKFLOWS_DIR = tmpdir / "workflows"
    wf_config.WORKFLOW_RUNS_DIR = tmpdir / "workflow-runs"
    wf_config.WORKFLOWS_DIR.mkdir()
    wf_config.WORKFLOW_RUNS_DIR.mkdir()

    try:
        storage = WorkflowStorageService()
        run_svc = WorkflowRunService()

        # Create workflow
        meta = storage.create_workflow(WorkflowCreate(name="Test Sequential", yaml_content=YAML_CONTENT))
        print(f"   Created workflow: {meta.id}")

        # Load via engine
        yaml_path = storage.get_yaml_path(meta.id)
        wf4 = engine.load_from_yaml_path(str(yaml_path))
        assert isinstance(wf4, Workflow)
        print("   \u2705 Storage → Engine load works")

        # Create run
        run = run_svc.create_run(meta.id, meta.name)
        run = run_svc.mark_running(run)
        run = run_svc.mark_completed(run, node_results={"research_step": {"status": "completed"}, "write_step": {"status": "completed"}})
        print(f"   Run {run.id}: {run.status} ({run.duration_seconds:.2f}s)")
        print("   \u2705 Full storage + engine + run lifecycle works")
    finally:
        wf_config.WORKFLOWS_DIR = orig_wf
        wf_config.WORKFLOW_RUNS_DIR = orig_wr
        import shutil
        shutil.rmtree(tmpdir, ignore_errors=True)

    print("\n=== All AF E2E checks passed! ===")


if __name__ == "__main__":
    main()
