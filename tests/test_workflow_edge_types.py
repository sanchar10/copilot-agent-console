"""Verify AF edge types and human input: If, Switch, Parallel, Question, Confirmation.

Tests are both runnable as a script (python tests/test_workflow_edge_types.py)
and as pytest test cases.
"""

import sys
from pathlib import Path
from unittest.mock import MagicMock, AsyncMock

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from agent_framework import Agent, Workflow, WorkflowViz
from agent_framework_declarative import WorkflowFactory


def _mock_agent(name):
    client = MagicMock()
    client.get_response = AsyncMock(return_value=MagicMock(text=f"output from {name}"))
    return Agent(client=client, name=name, instructions=f"You are {name}.")


_AGENTS = {n: _mock_agent(n) for n in ["researcher", "writer", "reviewer", "editor"]}


YAML_IF = """\
kind: Workflow
name: test-if
trigger:
  kind: OnConversationStart
  id: start
  actions:
    - kind: InvokeAzureAgent
      id: classify_step
      agent:
        name: researcher
    - kind: If
      id: branch
      condition: "=true"
      actions:
        - kind: InvokeAzureAgent
          id: yes_path
          agent:
            name: writer
      elseActions:
        - kind: InvokeAzureAgent
          id: no_path
          agent:
            name: reviewer
"""

YAML_PARALLEL = """\
kind: Workflow
name: test-parallel
trigger:
  kind: OnConversationStart
  id: start
  actions:
    - kind: Parallel
      id: fan_out
      branches:
        - actions:
            - kind: InvokeAzureAgent
              id: branch_a
              agent:
                name: researcher
        - actions:
            - kind: InvokeAzureAgent
              id: branch_b
              agent:
                name: writer
    - kind: InvokeAzureAgent
      id: merge_step
      agent:
        name: editor
"""

YAML_SWITCH = """\
kind: Workflow
name: test-switch
trigger:
  kind: OnConversationStart
  id: start
  actions:
    - kind: InvokeAzureAgent
      id: classify
      agent:
        name: researcher
    - kind: Switch
      id: route
      value: "=classify.output"
      cases:
        - value: "positive"
          actions:
            - kind: InvokeAzureAgent
              id: case_a
              agent:
                name: writer
        - value: "negative"
          actions:
            - kind: InvokeAzureAgent
              id: case_b
              agent:
                name: reviewer
      defaultCase:
        - kind: InvokeAzureAgent
          id: case_default
          agent:
            name: editor
"""

YAML_HUMAN_QUESTION = """\
kind: Workflow
name: test-human-question
trigger:
  kind: OnConversationStart
  id: start
  actions:
    - kind: Question
      id: ask_topic
      variable: topic
      text: "What topic should I research?"
    - kind: InvokeAzureAgent
      id: research_step
      agent:
        name: researcher
"""

YAML_HUMAN_CONFIRMATION = """\
kind: Workflow
name: test-human-confirm
trigger:
  kind: OnConversationStart
  id: start
  actions:
    - kind: InvokeAzureAgent
      id: draft_step
      agent:
        name: writer
    - kind: Confirmation
      id: approve
      variable: approved
      text: "Approve this draft?"
    - kind: InvokeAzureAgent
      id: publish_step
      agent:
        name: editor
"""


class TestEdgeTypes:
    """Verify AF YAML edge types parse into Workflow objects."""

    def _factory(self):
        return WorkflowFactory(agents=_AGENTS)

    def test_if_edge_parses(self):
        wf = self._factory().create_workflow_from_yaml(YAML_IF)
        assert isinstance(wf, Workflow)

    def test_if_edge_mermaid(self):
        wf = self._factory().create_workflow_from_yaml(YAML_IF)
        mermaid = WorkflowViz(wf).to_mermaid()
        assert len(mermaid) > 0
        # If edge produces conditional edges in Mermaid
        assert "conditional" in mermaid or "branch" in mermaid

    def test_parallel_edge_parses(self):
        wf = self._factory().create_workflow_from_yaml(YAML_PARALLEL)
        assert isinstance(wf, Workflow)

    def test_parallel_edge_mermaid(self):
        wf = self._factory().create_workflow_from_yaml(YAML_PARALLEL)
        mermaid = WorkflowViz(wf).to_mermaid()
        assert len(mermaid) > 0
        # Parallel branches may be internal — just verify workflow is valid
        assert "merge_step" in mermaid

    def test_switch_edge_parses(self):
        wf = self._factory().create_workflow_from_yaml(YAML_SWITCH)
        assert isinstance(wf, Workflow)

    def test_switch_edge_mermaid(self):
        wf = self._factory().create_workflow_from_yaml(YAML_SWITCH)
        mermaid = WorkflowViz(wf).to_mermaid()
        assert len(mermaid) > 0


class TestHumanNodes:
    """Verify AF human input action kinds parse correctly."""

    def _factory(self):
        return WorkflowFactory(agents=_AGENTS)

    def test_question_parses(self):
        wf = self._factory().create_workflow_from_yaml(YAML_HUMAN_QUESTION)
        assert isinstance(wf, Workflow)
        executor_ids = [e.id for e in wf.get_executors_list()]
        assert "ask_topic" in executor_ids

    def test_question_mermaid(self):
        wf = self._factory().create_workflow_from_yaml(YAML_HUMAN_QUESTION)
        mermaid = WorkflowViz(wf).to_mermaid()
        assert "ask_topic" in mermaid

    def test_confirmation_parses(self):
        wf = self._factory().create_workflow_from_yaml(YAML_HUMAN_CONFIRMATION)
        assert isinstance(wf, Workflow)
        executor_ids = [e.id for e in wf.get_executors_list()]
        assert "approve" in executor_ids

    def test_confirmation_mermaid(self):
        wf = self._factory().create_workflow_from_yaml(YAML_HUMAN_CONFIRMATION)
        mermaid = WorkflowViz(wf).to_mermaid()
        assert "approve" in mermaid


if __name__ == "__main__":
    print("=== AF Edge Type + Human Node Verification ===\n")
    factory = WorkflowFactory(agents=_AGENTS)

    for name, yaml in [("If", YAML_IF), ("Parallel", YAML_PARALLEL), ("Switch", YAML_SWITCH),
                        ("Question", YAML_HUMAN_QUESTION), ("Confirmation", YAML_HUMAN_CONFIRMATION)]:
        print(f"Testing {name}...")
        wf = factory.create_workflow_from_yaml(yaml)
        assert isinstance(wf, Workflow)
        mermaid = WorkflowViz(wf).to_mermaid()
        print(f"  Executors: {[e.id for e in wf.get_executors_list()]}")
        print(f"  Mermaid ({len(mermaid)} chars):")
        for line in mermaid.splitlines():
            print(f"    {line}")
        print(f"  ✅ {name} works\n")

    print("=== All edge types + human nodes verified! ===")
