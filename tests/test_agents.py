"""Tests for agent storage service and API router."""

from __future__ import annotations

import pytest


# ── helpers ──────────────────────────────────────────────────────────────

def _create_agent(client, **overrides):
    """Create an agent via the API and return the response JSON."""
    payload = {
        "name": "Test Agent",
        "description": "A test agent",
        "icon": "🧪",
        "model": "gpt-4.1",
        "system_message": {"mode": "replace", "content": "You are a test agent."},
    }
    payload.update(overrides)
    resp = client.post("/api/agents", json=payload)
    assert resp.status_code == 200
    return resp.json()


# ── agent storage (via API) ──────────────────────────────────────────────

class TestAgentCRUD:
    def test_create_agent(self, client):
        agent = _create_agent(client)
        assert agent["id"] == "test-agent"
        assert agent["name"] == "Test Agent"
        assert agent["description"] == "A test agent"
        assert agent["icon"] == "🧪"
        assert agent["model"] == "gpt-4.1"
        assert agent["system_message"]["mode"] == "replace"
        assert agent["system_message"]["content"] == "You are a test agent."
        assert "created_at" in agent
        assert "updated_at" in agent

    def test_create_agent_default_fields(self, client):
        resp = client.post("/api/agents", json={"name": "Minimal Agent"})
        assert resp.status_code == 200
        agent = resp.json()
        assert agent["model"] == "claude-sonnet-4"
        assert agent["icon"] == "🤖"
        assert agent["description"] == ""
        assert agent["tools"]["custom"] == []
        assert agent["tools"]["builtin"] == []
        assert agent["mcp_servers"] == []

    def test_create_agent_id_slug(self, client):
        agent = _create_agent(client, name="AI News Monitor!")
        assert agent["id"] == "ai-news-monitor"

    def test_create_agent_duplicate_name(self, client):
        agent1 = _create_agent(client, name="Duplicate")
        agent2 = _create_agent(client, name="Duplicate")
        assert agent1["id"] == "duplicate"
        assert agent2["id"] == "duplicate-1"

    def test_list_agents_empty(self, client):
        resp = client.get("/api/agents")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_list_agents(self, client):
        _create_agent(client, name="Agent A")
        _create_agent(client, name="Agent B")
        resp = client.get("/api/agents")
        assert resp.status_code == 200
        agents = resp.json()
        assert len(agents) == 2
        names = {a["name"] for a in agents}
        assert names == {"Agent A", "Agent B"}

    def test_get_agent(self, client):
        created = _create_agent(client)
        resp = client.get(f"/api/agents/{created['id']}")
        assert resp.status_code == 200
        agent = resp.json()
        assert agent["name"] == "Test Agent"
        assert agent["id"] == created["id"]

    def test_get_agent_not_found(self, client):
        resp = client.get("/api/agents/nonexistent")
        assert resp.status_code == 404

    def test_update_agent(self, client):
        created = _create_agent(client)
        resp = client.put(f"/api/agents/{created['id']}", json={
            "name": "Updated Agent",
            "model": "gpt-5",
        })
        assert resp.status_code == 200
        updated = resp.json()
        assert updated["name"] == "Updated Agent"
        assert updated["model"] == "gpt-5"
        # Unchanged fields preserved
        assert updated["description"] == "A test agent"
        assert updated["icon"] == "🧪"
        # updated_at should change
        assert updated["updated_at"] != created["updated_at"]

    def test_update_agent_partial(self, client):
        created = _create_agent(client)
        resp = client.put(f"/api/agents/{created['id']}", json={"icon": "🚀"})
        assert resp.status_code == 200
        assert resp.json()["icon"] == "🚀"
        assert resp.json()["name"] == "Test Agent"  # unchanged

    def test_update_agent_not_found(self, client):
        resp = client.put("/api/agents/nonexistent", json={"name": "X"})
        assert resp.status_code == 404

    def test_delete_agent(self, client):
        created = _create_agent(client)
        resp = client.delete(f"/api/agents/{created['id']}")
        assert resp.status_code == 200
        assert resp.json()["deleted"] is True
        # Verify gone
        resp = client.get(f"/api/agents/{created['id']}")
        assert resp.status_code == 404

    def test_delete_agent_not_found(self, client):
        resp = client.delete("/api/agents/nonexistent")
        assert resp.status_code == 404


class TestAgentFields:
    """Test that complex nested fields round-trip correctly."""

    def test_system_message_round_trip(self, client):
        agent = _create_agent(client, system_message={
            "mode": "append",
            "content": "Additional instructions...",
        })
        loaded = client.get(f"/api/agents/{agent['id']}").json()
        assert loaded["system_message"]["mode"] == "append"
        assert loaded["system_message"]["content"] == "Additional instructions..."

    def test_tools_round_trip(self, client):
        agent = _create_agent(client, tools={
            "custom": ["web_search", "web_fetch", "view"],
            "builtin": [],
        })
        loaded = client.get(f"/api/agents/{agent['id']}").json()
        assert loaded["tools"]["custom"] == ["web_search", "web_fetch", "view"]

    def test_mcp_servers_round_trip(self, client):
        agent = _create_agent(client, mcp_servers=[
            "github", "filesystem",
        ])
        loaded = client.get(f"/api/agents/{agent['id']}").json()
        assert loaded["mcp_servers"] == ["github", "filesystem"]


class TestAgentEdgeCases:
    """Edge cases and error handling."""

    def test_create_agent_special_chars_in_name(self, client):
        agent = _create_agent(client, name="My Agent (v2) — Test!")
        assert agent["id"] == "my-agent-v2-test"

    def test_create_agent_empty_name_chars(self, client):
        agent = _create_agent(client, name="!!!")
        assert agent["id"] == "agent"

    def test_update_preserves_created_at(self, client):
        created = _create_agent(client)
        resp = client.put(f"/api/agents/{created['id']}", json={"name": "Updated"})
        updated = resp.json()
        assert updated["created_at"] == created["created_at"]


class TestSubAgentEligibility:
    """Test sub-agent eligibility rules via the API."""

    def _make_eligible(self, client, name="Eligible Agent"):
        """Create an agent that satisfies all sub-agent eligibility rules."""
        return _create_agent(client, name=name, description="An eligible agent",
            system_message={"mode": "replace", "content": "You are helpful."},
            tools={"custom": [], "builtin": []})

    def test_eligible_basic(self, client):
        self._make_eligible(client)
        resp = client.get("/api/agents/eligible-sub-agents")
        assert resp.status_code == 200
        agents = resp.json()
        assert len(agents) == 1
        assert agents[0]["name"] == "Eligible Agent"

    def test_ineligible_no_description(self, client):
        _create_agent(client, description="",
            system_message={"mode": "replace", "content": "You are helpful."})
        resp = client.get("/api/agents/eligible-sub-agents")
        assert resp.json() == []

    def test_ineligible_no_prompt(self, client):
        _create_agent(client, description="A test",
            system_message={"mode": "replace", "content": ""})
        resp = client.get("/api/agents/eligible-sub-agents")
        assert resp.json() == []

    def test_ineligible_has_custom_tools(self, client):
        _create_agent(client, description="A test",
            system_message={"mode": "replace", "content": "Prompt"},
            tools={"custom": ["web_search"], "builtin": []})
        resp = client.get("/api/agents/eligible-sub-agents")
        assert resp.json() == []

    def test_ineligible_has_excluded_builtin(self, client):
        _create_agent(client, description="A test",
            system_message={"mode": "replace", "content": "Prompt"},
            tools={"custom": [], "builtin": [], "excluded_builtin": ["grep"]})
        resp = client.get("/api/agents/eligible-sub-agents")
        assert resp.json() == []

    def test_exclude_self(self, client):
        agent = self._make_eligible(client)
        resp = client.get(f"/api/agents/eligible-sub-agents?exclude={agent['id']}")
        assert resp.json() == []

    def test_ineligible_has_sub_agents(self, client):
        """Agent with sub_agents of its own is not eligible (no nesting)."""
        sub = self._make_eligible(client, name="Sub")
        _create_agent(client, name="Parent", description="A parent",
            system_message={"mode": "replace", "content": "Prompt"},
            sub_agents=[sub["id"]])
        resp = client.get("/api/agents/eligible-sub-agents")
        agents = resp.json()
        # Only "Sub" should be eligible, not "Parent"
        assert len(agents) == 1
        assert agents[0]["id"] == "sub"

    def test_multiple_eligible(self, client):
        self._make_eligible(client, name="Agent A")
        self._make_eligible(client, name="Agent B")
        resp = client.get("/api/agents/eligible-sub-agents")
        assert len(resp.json()) == 2


class TestSubAgentRoundTrip:
    """Test that sub_agents field persists correctly."""

    def test_sub_agents_saved_and_loaded(self, client):
        # Create an eligible sub-agent first
        sub = _create_agent(client, name="Sub Agent", description="A sub",
            system_message={"mode": "replace", "content": "You are a sub."})
        # Create parent with sub-agent
        parent = _create_agent(client, name="Parent Agent", description="A parent",
            system_message={"mode": "replace", "content": "You are a parent."},
            sub_agents=[sub["id"]])
        loaded = client.get(f"/api/agents/{parent['id']}").json()
        assert loaded["sub_agents"] == [sub["id"]]

    def test_sub_agents_default_empty(self, client):
        agent = _create_agent(client)
        loaded = client.get(f"/api/agents/{agent['id']}").json()
        assert loaded["sub_agents"] == []

    def test_update_sub_agents(self, client):
        sub = _create_agent(client, name="Sub", description="A sub",
            system_message={"mode": "replace", "content": "Sub prompt."})
        parent = _create_agent(client, name="Parent", description="A parent",
            system_message={"mode": "replace", "content": "Parent prompt."})
        resp = client.put(f"/api/agents/{parent['id']}", json={"sub_agents": [sub["id"]]})
        assert resp.status_code == 200
        assert resp.json()["sub_agents"] == [sub["id"]]
