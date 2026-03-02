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

    def test_create_session_without_mcp_or_tools_defaults_to_empty(self, client):
        """When mcp_servers/tools are omitted, session starts with none selected."""
        resp = client.post("/api/sessions", json={"model": "gpt-4.1"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["mcp_servers"] == []
        assert data["tools"]["custom"] == []
        assert data["tools"]["builtin"] == []

    def test_create_session_with_explicit_mcp_and_tools(self, client):
        """When mcp_servers/tools are provided, they are used as-is."""
        resp = client.post("/api/sessions", json={
            "model": "gpt-4.1",
            "mcp_servers": ["server-a"],
            "tools": {"custom": ["tool-a"], "builtin": []},
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["mcp_servers"] == ["server-a"]
        assert data["tools"]["custom"] == ["tool-a"]

    def test_active_agents(self, client):
        resp = client.get("/api/sessions/active-agents")
        assert resp.status_code == 200
        data = resp.json()
        assert data["count"] == 0
        assert data["sessions"] == []


# ── CLI session adoption ─────────────────────────────────────────────────

class TestCLISessionAdoption:
    """Verify that CLI sessions are adopted with none selected for MCP/tools."""

    def test_adopt_cli_session_has_empty_mcp_and_tools(self, client, monkeypatch):
        """When a CLI session is clicked, adoption should have no MCP servers or tools selected."""
        import copilot_console.app.services.copilot_service as cs_mod

        # Fake SDK session (simulates a CLI-created session with context)
        fake_context = type('FakeContext', (), {
            'cwd': 'C:\\Users\\testuser\\projects\\myapp',
        })()
        fake_sdk_session = type('FakeSession', (), {
            'sessionId': 'cli-session-123',
            'session_id': 'cli-session-123',
            'startTime': '2026-01-01T00:00:00Z',
            'modifiedTime': '2026-01-01T01:00:00Z',
            'summary': 'CLI test session',
            'context': fake_context,
        })()

        async def _fake_list():
            return [fake_sdk_session]

        async def _fake_messages(session_id):
            return []

        monkeypatch.setattr(cs_mod.copilot_service, "list_sessions", _fake_list)
        monkeypatch.setattr(cs_mod.copilot_service, "get_cached_session_metadata", lambda sid: None)
        monkeypatch.setattr(cs_mod.copilot_service, "get_session_messages", _fake_messages)

        # GET triggers adoption via get_session → get_session_with_messages
        resp = client.get("/api/sessions/cli-session-123")
        assert resp.status_code == 200
        data = resp.json()
        assert data["mcp_servers"] == []
        assert data["tools"]["custom"] == []
        assert data["tools"]["builtin"] == []
        assert data["session_name"] == "CLI test session"
        assert data["cwd"] == "C:\\Users\\testuser\\projects\\myapp"


# ── Session optimization ─────────────────────────────────────────────────

class TestSessionOptimization:
    """Verify optimized session paths: get_session_local, auto-name, enqueue."""

    def test_get_session_local_returns_from_storage(self, client):
        """get_session_local reads session.json without SDK calls."""
        from copilot_console.app.services.session_service import session_service

        # Create a session (writes session.json)
        resp = client.post("/api/sessions", json={"model": "gpt-4.1", "cwd": "/tmp/test"})
        assert resp.status_code == 200
        session_id = resp.json()["session_id"]

        # get_session_local should return the session from disk
        session = session_service.get_session_local(session_id)
        assert session is not None
        assert session.session_id == session_id
        assert session.model == "gpt-4.1"
        assert session.mcp_servers == []
        assert session.tools.custom == []

    def test_get_session_local_returns_none_for_unknown(self, client):
        """get_session_local returns None when session.json doesn't exist."""
        from copilot_console.app.services.session_service import session_service
        assert session_service.get_session_local("nonexistent-id") is None

    def test_auto_name_pending_on_create(self, client):
        """Creating a session without a name adds it to pending auto-name set."""
        from copilot_console.app.services.session_service import session_service

        resp = client.post("/api/sessions", json={"model": "gpt-4.1"})
        session_id = resp.json()["session_id"]
        assert session_service.should_auto_name(session_id) is True

    def test_auto_name_not_pending_when_name_set(self, client):
        """Creating a session with a user-provided name does NOT pend auto-naming."""
        from copilot_console.app.services.session_service import session_service

        resp = client.post("/api/sessions", json={"model": "gpt-4.1", "name": "My Session"})
        session_id = resp.json()["session_id"]
        assert session_service.should_auto_name(session_id) is False

    def test_consume_auto_name_clears_flag(self, client):
        """consume_auto_name returns True once then False."""
        from copilot_console.app.services.session_service import session_service

        resp = client.post("/api/sessions", json={"model": "gpt-4.1"})
        session_id = resp.json()["session_id"]

        assert session_service.consume_auto_name(session_id) is True
        assert session_service.consume_auto_name(session_id) is False
        assert session_service.should_auto_name(session_id) is False

    def test_get_session_uses_cache(self, client, monkeypatch):
        """get_session with stored meta uses SDK cache, not list_sessions."""
        import copilot_console.app.services.copilot_service as cs_mod

        # Create a session first
        resp = client.post("/api/sessions", json={"model": "gpt-4.1"})
        session_id = resp.json()["session_id"]

        # Put fake metadata in SDK cache
        fake_sdk = type('FakeSession', (), {
            'sessionId': session_id,
            'startTime': '2026-01-01T00:00:00Z',
            'modifiedTime': '2026-01-02T00:00:00Z',
        })()
        cs_mod.copilot_service._sdk_metadata_cache[session_id] = fake_sdk

        # Track if list_sessions is called (it should NOT be)
        list_called = []

        async def _tracking_list():
            list_called.append(True)
            return []

        async def _fake_messages(session_id):
            return []

        monkeypatch.setattr(cs_mod.copilot_service, "list_sessions", _tracking_list)
        monkeypatch.setattr(cs_mod.copilot_service, "get_session_messages", _fake_messages)

        # GET /{session_id} calls get_session → should use cache, not list_sessions
        resp = client.get(f"/api/sessions/{session_id}")
        assert resp.status_code == 200
        assert list_called == [], "list_sessions should NOT be called when cache has data"

    def test_enqueue_checks_active_not_get_session(self, client, monkeypatch):
        """Enqueue endpoint uses is_session_active, not get_session."""
        import copilot_console.app.services.copilot_service as cs_mod

        # Session doesn't need to exist in storage — just check the 404 path
        monkeypatch.setattr(cs_mod.copilot_service, "is_session_active", lambda sid: False)

        resp = client.post("/api/sessions/fake-id/enqueue", json={"content": "test"})
        assert resp.status_code == 404


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
