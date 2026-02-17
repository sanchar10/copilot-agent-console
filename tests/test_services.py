"""Unit tests for backend services (no HTTP, direct Python calls)."""

from __future__ import annotations

import asyncio
import sys
from datetime import datetime, timedelta
from pathlib import Path

import pytest

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _fresh_config(monkeypatch, tmp_path: Path):
    """Monkeypatch config module constants to point at tmp_path and return them."""
    agent_home = tmp_path / "home"
    sessions_dir = agent_home / "sessions"
    settings_file = agent_home / "settings.json"
    metadata_file = agent_home / "metadata.json"
    agent_home.mkdir(parents=True, exist_ok=True)

    # Purge cached modules so constants are re-evaluated
    for mod in list(sys.modules):
        if mod.startswith("copilot_agent_console.app"):
            sys.modules.pop(mod, None)

    monkeypatch.setenv("COPILOT_AGENT_CONSOLE_HOME", str(agent_home))

    import copilot_agent_console.app.config as cfg

    monkeypatch.setattr(cfg, "APP_HOME", agent_home)
    monkeypatch.setattr(cfg, "SESSIONS_DIR", sessions_dir)
    monkeypatch.setattr(cfg, "SETTINGS_FILE", settings_file)
    monkeypatch.setattr(cfg, "METADATA_FILE", metadata_file)

    return cfg


def _make_session(session_id: str = "sess-1", name: str = "Test Session"):
    from copilot_agent_console.app.models.session import Session

    now = datetime.utcnow()
    return Session(
        session_id=session_id,
        session_name=name,
        model="gpt-4.1",
        created_at=now,
        updated_at=now,
    )


# ===================================================================
# StorageService
# ===================================================================

class TestStorageService:
    """Tests for StorageService (filesystem-based session/settings storage)."""

    def _make_service(self, monkeypatch, tmp_path):
        cfg = _fresh_config(monkeypatch, tmp_path)
        from copilot_agent_console.app.services.storage_service import StorageService
        return StorageService()

    # -- save / load --------------------------------------------------

    def test_save_and_load_session(self, monkeypatch, tmp_path):
        svc = self._make_service(monkeypatch, tmp_path)
        session = _make_session()
        svc.save_session(session)

        loaded = svc.load_session("sess-1")
        assert loaded is not None
        assert loaded["session_id"] == "sess-1"
        assert loaded["session_name"] == "Test Session"
        assert loaded["model"] == "gpt-4.1"

    def test_load_nonexistent_session(self, monkeypatch, tmp_path):
        svc = self._make_service(monkeypatch, tmp_path)
        assert svc.load_session("nope") is None

    # -- list ---------------------------------------------------------

    def test_list_all_sessions_empty(self, monkeypatch, tmp_path):
        svc = self._make_service(monkeypatch, tmp_path)
        assert svc.list_all_sessions() == []

    def test_list_all_sessions(self, monkeypatch, tmp_path):
        svc = self._make_service(monkeypatch, tmp_path)
        svc.save_session(_make_session("a", "Alpha"))
        svc.save_session(_make_session("b", "Beta"))

        sessions = svc.list_all_sessions()
        ids = {s["session_id"] for s in sessions}
        assert ids == {"a", "b"}

    # -- delete -------------------------------------------------------

    def test_delete_session(self, monkeypatch, tmp_path):
        svc = self._make_service(monkeypatch, tmp_path)
        svc.save_session(_make_session())
        assert svc.delete_session("sess-1") is True
        assert svc.load_session("sess-1") is None

    def test_delete_nonexistent_session(self, monkeypatch, tmp_path):
        svc = self._make_service(monkeypatch, tmp_path)
        assert svc.delete_session("nope") is False

    # -- settings -----------------------------------------------------

    def test_get_default_settings(self, monkeypatch, tmp_path):
        svc = self._make_service(monkeypatch, tmp_path)
        settings = svc.get_settings()
        assert "default_model" in settings

    def test_update_settings(self, monkeypatch, tmp_path):
        svc = self._make_service(monkeypatch, tmp_path)
        updated = svc.update_settings({"default_model": "gpt-4o"})
        assert updated["default_model"] == "gpt-4o"
        # Persisted
        assert svc.get_settings()["default_model"] == "gpt-4o"


# ===================================================================
# ResponseBuffer
# ===================================================================

class TestResponseBuffer:
    """Tests for ResponseBuffer (plain dataclass, no monkeypatching)."""

    def _make_buffer(self, session_id: str = "test"):
        from copilot_agent_console.app.services.response_buffer import ResponseBuffer
        return ResponseBuffer(session_id=session_id)

    def test_add_chunk(self):
        buf = self._make_buffer()
        buf.add_chunk("hello ")
        buf.add_chunk("world")
        assert buf.chunks == ["hello ", "world"]

    def test_get_full_content(self):
        buf = self._make_buffer()
        buf.add_chunk("foo")
        buf.add_chunk("bar")
        assert buf.get_full_content() == "foobar"

    def test_add_step(self):
        buf = self._make_buffer()
        buf.add_step({"type": "tool_call", "name": "grep"})
        assert len(buf.steps) == 1
        assert buf.steps[0]["name"] == "grep"

    def test_complete(self):
        from copilot_agent_console.app.services.response_buffer import ResponseStatus
        buf = self._make_buffer()
        buf.complete()
        assert buf.status == ResponseStatus.COMPLETED
        assert buf.completed_at is not None

    def test_fail(self):
        from copilot_agent_console.app.services.response_buffer import ResponseStatus
        buf = self._make_buffer()
        buf.fail("boom")
        assert buf.status == ResponseStatus.ERROR
        assert buf.error == "boom"
        assert buf.completed_at is not None

    def test_is_stale_running(self):
        buf = self._make_buffer()
        assert buf.is_stale() is False

    def test_is_stale_recently_completed(self):
        buf = self._make_buffer()
        buf.complete()
        assert buf.is_stale(max_age_seconds=300) is False

    def test_is_stale_old_completed(self):
        buf = self._make_buffer()
        buf.complete()
        buf.completed_at = datetime.utcnow() - timedelta(seconds=600)
        assert buf.is_stale(max_age_seconds=300) is True


# ===================================================================
# ResponseBufferManager
# ===================================================================

class TestResponseBufferManager:
    """Tests for ResponseBufferManager (async)."""

    def _make_manager(self):
        from copilot_agent_console.app.services.response_buffer import ResponseBufferManager
        return ResponseBufferManager()

    def test_create_and_get_buffer(self):
        async def _run():
            mgr = self._make_manager()
            buf = await mgr.create_buffer("s1")
            assert buf.session_id == "s1"
            got = await mgr.get_buffer("s1")
            assert got is buf
        asyncio.run(_run())

    def test_get_buffer_missing(self):
        async def _run():
            mgr = self._make_manager()
            assert await mgr.get_buffer("nope") is None
        asyncio.run(_run())

    def test_remove_buffer(self):
        async def _run():
            mgr = self._make_manager()
            await mgr.create_buffer("s1")
            await mgr.remove_buffer("s1")
            assert await mgr.get_buffer("s1") is None
        asyncio.run(_run())

    def test_has_active_response(self):
        async def _run():
            mgr = self._make_manager()
            assert mgr.has_active_response("s1") is False
            buf = await mgr.create_buffer("s1")
            assert mgr.has_active_response("s1") is True
            buf.complete()
            assert mgr.has_active_response("s1") is False
        asyncio.run(_run())

    def test_get_status_no_buffer(self):
        mgr = self._make_manager()
        status = mgr.get_status("nope")
        assert status == {"active": False}

    def test_get_status_running(self):
        async def _run():
            mgr = self._make_manager()
            await mgr.create_buffer("s1")
            status = mgr.get_status("s1")
            assert status["active"] is True
            assert status["status"] == "running"
        asyncio.run(_run())

    def test_get_all_active(self):
        async def _run():
            mgr = self._make_manager()
            await mgr.create_buffer("s1")
            await mgr.create_buffer("s2")
            active = mgr.get_all_active()
            ids = {a["session_id"] for a in active}
            assert ids == {"s1", "s2"}
        asyncio.run(_run())

    def test_get_active_count(self):
        async def _run():
            mgr = self._make_manager()
            assert mgr.get_active_count() == 0
            await mgr.create_buffer("s1")
            assert mgr.get_active_count() == 1
            buf = await mgr.get_buffer("s1")
            buf.complete()
            assert mgr.get_active_count() == 0
        asyncio.run(_run())


# ===================================================================
# SessionService — update_session destroys client on config change
# ===================================================================

class TestSessionServiceUpdate:
    """Verify that changing CWD/MCP/tools destroys the active SessionClient."""

    def _setup(self, monkeypatch, tmp_path):
        """Return (session_service, copilot_service) with fresh config."""
        cfg = _fresh_config(monkeypatch, tmp_path)
        from copilot_agent_console.app.services.session_service import session_service
        from copilot_agent_console.app.services.copilot_service import copilot_service
        from copilot_agent_console.app.services.storage_service import storage_service

        # Ensure storage dir exists and save a session
        cfg.SESSIONS_DIR.mkdir(parents=True, exist_ok=True)
        session = _make_session("s1", "Test")
        session.cwd = "/old/path"
        session.mcp_servers = ["server-a"]
        session.tools = {"custom": ["tool-a"], "builtin": []}
        storage_service.save_session(session)

        return session_service, copilot_service, session

    def test_cwd_change_destroys_active_client(self, monkeypatch, tmp_path):
        async def _run():
            svc, copilot, session = self._setup(monkeypatch, tmp_path)
            # Simulate an active client
            copilot._session_clients["s1"] = type('FakeClient', (), {'stop': lambda self: asyncio.sleep(0)})()
            assert copilot.is_session_active("s1")

            from copilot_agent_console.app.models.session import SessionUpdate
            monkeypatch.setattr("os.path.isdir", lambda p: True)  # CWD validation
            await svc.update_session("s1", SessionUpdate(cwd="/new/path"))

            # Client should have been destroyed
            assert not copilot.is_session_active("s1")
        asyncio.run(_run())

    def test_mcp_change_destroys_active_client(self, monkeypatch, tmp_path):
        async def _run():
            svc, copilot, session = self._setup(monkeypatch, tmp_path)
            copilot._session_clients["s1"] = type('FakeClient', (), {'stop': lambda self: asyncio.sleep(0)})()

            from copilot_agent_console.app.models.session import SessionUpdate
            await svc.update_session("s1", SessionUpdate(mcp_servers=["server-b"]))

            assert not copilot.is_session_active("s1")
        asyncio.run(_run())

    def test_tools_change_destroys_active_client(self, monkeypatch, tmp_path):
        async def _run():
            svc, copilot, session = self._setup(monkeypatch, tmp_path)
            copilot._session_clients["s1"] = type('FakeClient', (), {'stop': lambda self: asyncio.sleep(0)})()

            from copilot_agent_console.app.models.session import SessionUpdate
            await svc.update_session("s1", SessionUpdate(tools={"custom": ["tool-b"], "builtin": []}))

            assert not copilot.is_session_active("s1")
        asyncio.run(_run())

    def test_name_change_does_not_destroy_client(self, monkeypatch, tmp_path):
        async def _run():
            svc, copilot, session = self._setup(monkeypatch, tmp_path)
            copilot._session_clients["s1"] = type('FakeClient', (), {'stop': lambda self: asyncio.sleep(0)})()

            from copilot_agent_console.app.models.session import SessionUpdate
            await svc.update_session("s1", SessionUpdate(name="Renamed"))

            # Client should still be active — name change doesn't recreate
            assert copilot.is_session_active("s1")

            # Cleanup
            del copilot._session_clients["s1"]
        asyncio.run(_run())

    def test_same_cwd_does_not_destroy_client(self, monkeypatch, tmp_path):
        async def _run():
            svc, copilot, session = self._setup(monkeypatch, tmp_path)
            copilot._session_clients["s1"] = type('FakeClient', (), {'stop': lambda self: asyncio.sleep(0)})()

            from copilot_agent_console.app.models.session import SessionUpdate
            monkeypatch.setattr("os.path.isdir", lambda p: True)
            # Same CWD as existing — should NOT destroy
            await svc.update_session("s1", SessionUpdate(cwd="/old/path"))

            assert copilot.is_session_active("s1")

            # Cleanup
            del copilot._session_clients["s1"]
        asyncio.run(_run())
