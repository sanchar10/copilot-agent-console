"""Tests for resolve_agent_model — the central model+reasoning_effort fallback chain.

Covers the v0.8.8 hotfix path: automation runs from agents that ship without a
model field must resolve to settings.default_model, and surface a clear error
when neither is available.
"""

from unittest.mock import patch

import pytest


def _make_agent(model=None, reasoning_effort=None):
    # Imported inside helpers so each test sees the current sys.modules state
    # (test_services._fresh_config purges copilot_console.app.* between tests,
    # which would orphan module-level imports here).
    from copilot_console.app.models.agent import Agent

    return Agent(
        id="test-agent",
        name="Test Agent",
        model=model,
        reasoning_effort=reasoning_effort,
    )


def _resolve(agent):
    from copilot_console.app.services.model_resolver import resolve_agent_model

    return resolve_agent_model(agent)


def _patch_settings(return_value):
    # Patch on the freshly-imported module so the singleton matches the one
    # resolve_agent_model actually uses in this test run.
    from copilot_console.app.services import model_resolver

    return patch.object(
        model_resolver.storage_service, "get_settings", return_value=return_value
    )


class TestResolveAgentModel:
    def test_agent_with_model_returns_agent_pair(self):
        agent = _make_agent(model="gpt-5.4", reasoning_effort="high")
        with _patch_settings(
            {"default_model": "gpt-4.1", "default_reasoning_effort": "low"}
        ):
            model, effort = _resolve(agent)
        # Agent's pair wins — never crossed with settings.
        assert model == "gpt-5.4"
        assert effort == "high"

    def test_agent_with_model_no_effort_returns_none_effort(self):
        agent = _make_agent(model="gpt-5.4", reasoning_effort=None)
        with _patch_settings(
            {"default_model": "gpt-4.1", "default_reasoning_effort": "high"}
        ):
            model, effort = _resolve(agent)
        assert model == "gpt-5.4"
        # Must NOT borrow settings.default_reasoning_effort.
        assert effort is None

    def test_agent_without_model_falls_back_to_settings(self):
        agent = _make_agent(model=None)
        with _patch_settings(
            {"default_model": "gpt-4.1", "default_reasoning_effort": "medium"}
        ):
            model, effort = _resolve(agent)
        assert model == "gpt-4.1"
        assert effort == "medium"

    def test_agent_with_empty_string_model_treated_as_none(self):
        from copilot_console.app.models.agent import Agent

        # Pydantic validator coerces "" → None, so settings fallback applies.
        agent = Agent(id="a", name="A", model="")
        assert agent.model is None
        with _patch_settings({"default_model": "gpt-4.1"}):
            model, effort = _resolve(agent)
        assert model == "gpt-4.1"
        assert effort is None

    def test_no_model_anywhere_raises(self):
        agent = _make_agent(model=None)
        with _patch_settings({"default_model": ""}):
            with pytest.raises(ValueError, match="No model configured"):
                _resolve(agent)

    def test_no_model_anywhere_missing_key_raises(self):
        agent = _make_agent(model=None)
        with _patch_settings({}):
            with pytest.raises(ValueError, match="No model configured"):
                _resolve(agent)
