"""Tests for search service — helpers and name matching."""

from __future__ import annotations

import json

import pytest


class TestSearchHelpers:
    def test_extract_snippet(self):
        from copilot_console.app.services.search_service import _extract_snippet

        text = "This is a long text about authentication and JWT tokens for the API"
        snippet = _extract_snippet(text, "authentication")
        assert "authentication" in snippet

    def test_extract_snippet_short_text(self):
        from copilot_console.app.services.search_service import _extract_snippet

        snippet = _extract_snippet("short text", "short")
        assert "short" in snippet

    def test_extract_session_id_unix(self):
        from copilot_console.app.services.search_service import _extract_session_id

        path = "/home/user/.copilot/session-state/a1b2c3d4-e5f6-7890-abcd-ef1234567890/events.jsonl"
        result = _extract_session_id(path)
        assert result == "a1b2c3d4-e5f6-7890-abcd-ef1234567890"

    def test_extract_session_id_windows(self):
        from copilot_console.app.services.search_service import _extract_session_id

        path = "C:\\Users\\user\\.copilot\\session-state\\a1b2c3d4-e5f6-7890-abcd-ef1234567890\\events.jsonl"
        result = _extract_session_id(path)
        assert result == "a1b2c3d4-e5f6-7890-abcd-ef1234567890"

    def test_parse_event_line_user_message(self):
        from copilot_console.app.services.search_service import _parse_event_line

        line = json.dumps({"type": "user.message", "data": {"content": "Fix the authentication bug"}})
        result = _parse_event_line(line, "authentication")
        assert result is not None

    def test_parse_event_line_no_match(self):
        from copilot_console.app.services.search_service import _parse_event_line

        line = json.dumps({"type": "user.message", "data": {"content": "Hello world"}})
        result = _parse_event_line(line, "kubernetes")
        assert result is None

    def test_parse_event_line_invalid_json(self):
        from copilot_console.app.services.search_service import _parse_event_line

        result = _parse_event_line("not json", "test")
        assert result is None
