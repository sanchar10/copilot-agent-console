"""Tests for cli_notify module — CLI notification hook system."""

from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import patch

import pytest


@pytest.fixture
def notify_env(tmp_path, monkeypatch):
    """Set up isolated paths for cli_notify testing."""
    app_home = tmp_path / ".copilot-console"
    copilot_home = tmp_path / ".copilot"
    app_home.mkdir()
    copilot_home.mkdir()

    import copilot_console.cli_notify as mod

    monkeypatch.setattr(mod, "APP_HOME", app_home)
    monkeypatch.setattr(mod, "COPILOT_HOME", copilot_home)
    monkeypatch.setattr(mod, "SETTINGS_FILE", app_home / "settings.json")
    monkeypatch.setattr(mod, "HOOKS_DIR", copilot_home / "hooks")
    monkeypatch.setattr(mod, "HOOK_CONFIG_FILE", copilot_home / "hooks" / "console-notifications.json")

    return mod


class TestReadWriteSettings:
    def test_read_missing_settings(self, notify_env):
        assert notify_env._read_settings() == {}

    def test_write_and_read_settings(self, notify_env):
        notify_env._write_settings({"cli_notifications": True, "port": 9000})
        result = notify_env._read_settings()
        assert result["cli_notifications"] is True
        assert result["port"] == 9000

    def test_read_corrupted_settings(self, notify_env):
        notify_env.SETTINGS_FILE.write_text("not json", encoding="utf-8")
        assert notify_env._read_settings() == {}


class TestIsEnabled:
    def test_disabled_by_default(self, notify_env):
        assert notify_env._is_enabled() is False

    def test_enabled_after_write(self, notify_env):
        notify_env._write_settings({"cli_notifications": True})
        assert notify_env._is_enabled() is True

    def test_disabled_when_false(self, notify_env):
        notify_env._write_settings({"cli_notifications": False})
        assert notify_env._is_enabled() is False


class TestHookConfig:
    def test_create_hook_config(self, notify_env):
        notify_env._create_hook_config()
        assert notify_env.HOOK_CONFIG_FILE.exists()
        config = json.loads(notify_env.HOOK_CONFIG_FILE.read_text())
        assert "hooks" in config
        assert "agentStop" in config["hooks"]

    def test_remove_hook_config(self, notify_env):
        notify_env._create_hook_config()
        assert notify_env.HOOK_CONFIG_FILE.exists()
        notify_env._remove_hook_config()
        assert not notify_env.HOOK_CONFIG_FILE.exists()

    def test_remove_nonexistent_hook_config(self, notify_env):
        # Should not raise
        notify_env._remove_hook_config()


class TestCmdOnOff:
    def test_cmd_on_enables_and_creates_hook(self, notify_env):
        notify_env.cmd_on()
        assert notify_env._is_enabled() is True
        assert notify_env.HOOK_CONFIG_FILE.exists()

    def test_cmd_off_disables_and_removes_hook(self, notify_env):
        notify_env.cmd_on()
        notify_env.cmd_off()
        assert notify_env._is_enabled() is False
        assert not notify_env.HOOK_CONFIG_FILE.exists()

    def test_cmd_on_preserves_other_settings(self, notify_env):
        notify_env._write_settings({"default_model": "gpt-4", "server_port": 9000})
        notify_env.cmd_on()
        settings = notify_env._read_settings()
        assert settings["default_model"] == "gpt-4"
        assert settings["server_port"] == 9000
        assert settings["cli_notifications"] is True


class TestGetPort:
    def test_default_port(self, notify_env):
        assert notify_env._get_port() == 8765

    def test_custom_port(self, notify_env):
        notify_env._write_settings({"server_port": 9000})
        assert notify_env._get_port() == 9000


class TestCmdHookAgentStop:
    def test_noop_when_disabled(self, notify_env):
        # Should return silently without calling API
        with patch("sys.stdin") as mock_stdin:
            mock_stdin.read.return_value = '{"sessionId": "abc"}'
            notify_env.cmd_hook_agent_stop()
            # No exception = success

    def test_noop_on_invalid_json(self, notify_env):
        notify_env._write_settings({"cli_notifications": True})
        with patch("sys.stdin") as mock_stdin:
            mock_stdin.read.return_value = "not json"
            notify_env.cmd_hook_agent_stop()

    def test_noop_on_missing_session_id(self, notify_env):
        notify_env._write_settings({"cli_notifications": True})
        with patch("sys.stdin") as mock_stdin:
            mock_stdin.read.return_value = '{"stopReason": "done"}'
            notify_env.cmd_hook_agent_stop()


class TestMain:
    def test_unknown_command(self, notify_env):
        with patch("sys.argv", ["cli-notify", "bogus"]):
            with pytest.raises(SystemExit, match="1"):
                notify_env.main()

    def test_on_command(self, notify_env):
        with patch("sys.argv", ["cli-notify", "on"]):
            notify_env.main()
        assert notify_env._is_enabled() is True

    def test_off_command(self, notify_env):
        notify_env.cmd_on()
        with patch("sys.argv", ["cli-notify", "off"]):
            notify_env.main()
        assert notify_env._is_enabled() is False

    def test_status_command(self, notify_env, capsys):
        with patch("sys.argv", ["cli-notify"]):
            notify_env.main()
        output = capsys.readouterr().out
        assert "CLI notifications:" in output
