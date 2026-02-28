"""Comprehensive tests for all backend API routers."""

from __future__ import annotations

import pytest


# ── helpers ──────────────────────────────────────────────────────────────

def _create_session(client, **overrides):
    """Create a session via the API and return the response JSON."""
    payload = {
        "model": "gpt-4.1",
        "name": "Test Session",
        "mcp_servers": [],
        "tools": {"custom": [], "builtin": []},
    }
    payload.update(overrides)
    resp = client.post("/api/sessions", json=payload)
    assert resp.status_code == 200
    return resp.json()


# ── tools router ─────────────────────────────────────────────────────────

class TestToolsRouter:
    def test_get_tools(self, client):
        resp = client.get("/api/tools")
        assert resp.status_code == 200
        data = resp.json()
        assert "tools" in data
        assert isinstance(data["tools"], list)

    def test_get_tool_not_found(self, client):
        resp = client.get("/api/tools/nonexistent-tool-xyz")
        assert resp.status_code == 404

    def test_post_refresh_tools(self, client):
        resp = client.post("/api/tools/refresh")
        assert resp.status_code == 200
        data = resp.json()
        assert "tools" in data
        assert isinstance(data["tools"], list)


# ── viewed router ────────────────────────────────────────────────────────

class TestViewedRouter:
    def test_get_viewed_empty(self, client):
        resp = client.get("/api/viewed")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, dict)

    def test_mark_and_get_viewed(self, client):
        session = _create_session(client)
        sid = session["session_id"]

        resp = client.post(f"/api/viewed/{sid}")
        assert resp.status_code == 200
        body = resp.json()
        assert body["session_id"] == sid
        assert isinstance(body["viewed_at"], float)

        # Verify it shows up in GET
        resp2 = client.get("/api/viewed")
        assert resp2.status_code == 200
        assert sid in resp2.json()

    def test_mark_viewed_with_explicit_timestamp(self, client):
        session = _create_session(client)
        sid = session["session_id"]

        resp = client.post(f"/api/viewed/{sid}?timestamp=1700000000.0")
        assert resp.status_code == 200
        assert resp.json()["viewed_at"] == 1700000000.0


# ── models router ────────────────────────────────────────────────────────

class TestModelsRouter:
    def test_get_models(self, client, monkeypatch):
        import copilot_console.app.services.copilot_service as cs_mod

        fake_models = [
            {"id": "gpt-4.1", "name": "GPT 4.1"},
            {"id": "claude-sonnet-4", "name": "Claude Sonnet 4"},
        ]
        monkeypatch.setattr(
            cs_mod.copilot_service, "get_models",
            lambda: fake_models,  # router awaits the return value
        )
        # The router does `await copilot_service.get_models()`.
        # A plain lambda returning a list works because FastAPI's test client
        # wraps the event-loop; but we need to return a coroutine.
        import asyncio

        async def _fake_get_models():
            return fake_models

        monkeypatch.setattr(cs_mod.copilot_service, "get_models", _fake_get_models)

        resp = client.get("/api/models")
        assert resp.status_code == 200
        data = resp.json()
        assert data == {"models": fake_models}


# ── settings router ─────────────────────────────────────────────────────

class TestSettingsRouter:
    def test_patch_default_model(self, client):
        resp = client.patch("/api/settings", json={"default_model": "gpt-4.1"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["default_model"] == "gpt-4.1"

    def test_patch_bad_cwd_returns_400(self, client):
        resp = client.patch(
            "/api/settings",
            json={"default_cwd": "/this/path/does/not/exist/abc123"},
        )
        assert resp.status_code == 400

    def test_patch_valid_cwd(self, client, tmp_path):
        d = tmp_path / "mydir"
        d.mkdir()
        resp = client.patch("/api/settings", json={"default_cwd": str(d)})
        assert resp.status_code == 200
        assert resp.json()["default_cwd"] == str(d)


# ── sessions router ─────────────────────────────────────────────────────

class TestSessionsRouter:
    def test_list_sessions(self, client, monkeypatch):
        import copilot_console.app.services.copilot_service as cs_mod

        async def _fake_list():
            return []

        monkeypatch.setattr(cs_mod.copilot_service, "list_sessions", _fake_list)

        resp = client.get("/api/sessions")
        assert resp.status_code == 200
        data = resp.json()
        assert "sessions" in data
        assert isinstance(data["sessions"], list)

    def test_get_session_not_found(self, client, monkeypatch):
        import copilot_console.app.services.copilot_service as cs_mod

        async def _fake_list():
            return []

        monkeypatch.setattr(cs_mod.copilot_service, "list_sessions", _fake_list)

        resp = client.get("/api/sessions/nonexistent-id-xyz")
        assert resp.status_code == 404

    def test_delete_session(self, client, monkeypatch):
        import copilot_console.app.services.copilot_service as cs_mod

        session = _create_session(client)
        sid = session["session_id"]

        async def _fake_delete(session_id):
            return None

        monkeypatch.setattr(cs_mod.copilot_service, "delete_session", _fake_delete)

        resp = client.delete(f"/api/sessions/{sid}")
        assert resp.status_code == 200
        assert resp.json()["success"] is True

    def test_patch_session_rename(self, client, monkeypatch):
        import copilot_console.app.services.copilot_service as cs_mod

        async def _fake_list():
            return []

        monkeypatch.setattr(cs_mod.copilot_service, "list_sessions", _fake_list)

        session = _create_session(client)
        sid = session["session_id"]

        resp = client.patch(f"/api/sessions/{sid}", json={"name": "Renamed"})
        assert resp.status_code == 200
        assert resp.json()["session_name"] == "Renamed"

    def test_patch_session_bad_cwd(self, client, monkeypatch):
        import copilot_console.app.services.copilot_service as cs_mod

        async def _fake_list():
            return []

        monkeypatch.setattr(cs_mod.copilot_service, "list_sessions", _fake_list)

        session = _create_session(client)
        sid = session["session_id"]

        resp = client.patch(
            f"/api/sessions/{sid}",
            json={"cwd": "/nonexistent/dir/abc"},
        )
        assert resp.status_code == 400

    def test_patch_session_not_found(self, client, monkeypatch):
        import copilot_console.app.services.copilot_service as cs_mod

        async def _fake_list():
            return []

        monkeypatch.setattr(cs_mod.copilot_service, "list_sessions", _fake_list)

        resp = client.patch(
            "/api/sessions/does-not-exist",
            json={"name": "Renamed"},
        )
        assert resp.status_code == 404

    def test_active_agents(self, client):
        resp = client.get("/api/sessions/active-agents")
        assert resp.status_code == 200
        data = resp.json()
        assert data["count"] == 0
        assert data["sessions"] == []


# ── logs router ──────────────────────────────────────────────────────────

class TestLogsRouter:
    def test_server_logs(self, client, monkeypatch):
        import copilot_console.app.routers.logs as logs_router

        monkeypatch.setattr(
            logs_router, "read_server_logs",
            lambda tail=100: ["line1", "line2"],
        )

        resp = client.get("/api/logs/server")
        assert resp.status_code == 200
        data = resp.json()
        assert data["count"] == 2
        assert data["lines"] == ["line1", "line2"]

    def test_server_logs_with_tail(self, client, monkeypatch):
        import copilot_console.app.routers.logs as logs_router

        monkeypatch.setattr(
            logs_router, "read_server_logs",
            lambda tail=100: [f"line{i}" for i in range(tail)],
        )

        resp = client.get("/api/logs/server?tail=5")
        assert resp.status_code == 200
        assert resp.json()["count"] == 5

    def test_session_logs(self, client, monkeypatch):
        import copilot_console.app.routers.logs as logs_router

        monkeypatch.setattr(
            logs_router, "read_session_logs",
            lambda session_id, tail=None, level=None: ["session log 1"],
        )

        resp = client.get("/api/logs/sessions/some-session-id")
        assert resp.status_code == 200
        data = resp.json()
        assert data["session_id"] == "some-session-id"
        assert data["count"] == 1

# ── mcp router ───────────────────────────────────────────────────────────

class TestMCPRouter:
    def test_list_mcp_servers(self, client):
        resp = client.get("/api/mcp/servers")
        assert resp.status_code == 200
        data = resp.json()
        assert "servers" in data
        assert isinstance(data["servers"], list)

    def test_refresh_mcp_servers(self, client):
        resp = client.post("/api/mcp/servers/refresh")
        assert resp.status_code == 200
        data = resp.json()
        assert "servers" in data
        assert isinstance(data["servers"], list)
