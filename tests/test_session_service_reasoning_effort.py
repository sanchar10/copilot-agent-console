"""Regression tests for SessionService → reasoning_effort field round-trip.

v0.8.8 fix: previously the three Session() constructors in session_service.py
that read from stored_meta dropped the `reasoning_effort` key, returning None
to the API. After server restart this caused the chat header to display the
model's metadata default effort instead of the value the session was actually
saved with — and on any subsequent PUT to the session, the bogus None was
written back to disk, silently corrupting session.json.

These tests guard the read path so reasoning_effort survives load.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from tests.test_services import _fresh_config, _make_session


def _save_session_with_effort(monkeypatch, tmp_path: Path, effort: str | None):
    """Persist a session.json that has reasoning_effort baked in."""
    _fresh_config(monkeypatch, tmp_path)
    from copilot_console.app.services.storage_service import storage_service

    session = _make_session("rt-effort", "RT Effort")
    session.reasoning_effort = effort
    storage_service.save_session(session)
    return session.session_id


class TestSessionLocalReasoningEffort:
    """get_session_local must propagate reasoning_effort from stored_meta."""

    def test_reasoning_effort_round_trips_high(self, monkeypatch, tmp_path):
        sid = _save_session_with_effort(monkeypatch, tmp_path, "high")
        from copilot_console.app.services.session_service import session_service
        loaded = session_service.get_session_local(sid)
        assert loaded is not None
        assert loaded.reasoning_effort == "high"

    def test_reasoning_effort_round_trips_low(self, monkeypatch, tmp_path):
        sid = _save_session_with_effort(monkeypatch, tmp_path, "low")
        from copilot_console.app.services.session_service import session_service
        loaded = session_service.get_session_local(sid)
        assert loaded is not None
        assert loaded.reasoning_effort == "low"

    def test_reasoning_effort_none_when_unset(self, monkeypatch, tmp_path):
        sid = _save_session_with_effort(monkeypatch, tmp_path, None)
        from copilot_console.app.services.session_service import session_service
        loaded = session_service.get_session_local(sid)
        assert loaded is not None
        assert loaded.reasoning_effort is None

    def test_no_silent_corruption_on_resave(self, monkeypatch, tmp_path):
        """Loading then re-saving must preserve reasoning_effort on disk."""
        sid = _save_session_with_effort(monkeypatch, tmp_path, "high")
        from copilot_console.app.services.session_service import session_service
        from copilot_console.app.services.storage_service import storage_service

        loaded = session_service.get_session_local(sid)
        assert loaded is not None
        # Mutate an unrelated field, save, reload from disk.
        loaded.session_name = "Renamed"
        storage_service.save_session(loaded)

        raw = storage_service.load_session(sid)
        assert raw is not None
        # Pre-fix: this would be None (silent corruption).
        assert raw["reasoning_effort"] == "high"
