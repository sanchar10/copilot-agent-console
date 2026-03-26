"""Tests for seed service — template expansion and MCP config merging."""

from __future__ import annotations

import json
from pathlib import Path

import pytest


@pytest.fixture
def seed_env(tmp_path, monkeypatch):
    """Set up isolated paths for seed service testing."""
    app_home = tmp_path / "copilot-console"
    app_home.mkdir()

    import copilot_console.app.services.seed_service as mod

    monkeypatch.setattr(mod, "APP_HOME", app_home)
    monkeypatch.setattr(mod, "METADATA_FILE", app_home / "metadata.json")
    monkeypatch.setattr(mod, "_TEMPLATE_VARS", {
        "APP_HOME": str(app_home).replace("\\", "/"),
    })

    return mod, app_home


class TestExpandTemplate:
    def test_replaces_app_home(self, seed_env):
        mod, app_home = seed_env
        result = mod._expand_template("path: {{APP_HOME}}/tools/my_tool.py")
        expected_path = str(app_home).replace("\\", "/")
        assert expected_path in result
        assert "{{APP_HOME}}" not in result

    def test_no_placeholder(self, seed_env):
        mod, _ = seed_env
        result = mod._expand_template("no placeholders here")
        assert result == "no placeholders here"

    def test_multiple_placeholders(self, seed_env):
        mod, app_home = seed_env
        result = mod._expand_template("{{APP_HOME}}/a and {{APP_HOME}}/b")
        assert result.count(str(app_home).replace("\\", "/")) == 2


class TestMergeMcpConfig:
    def test_merge_into_empty_dest(self, seed_env):
        mod, app_home = seed_env
        template = app_home / "mcp-config.json.template"
        dest = app_home / "mcp-config.json"

        template_content = json.dumps({
            "mcpServers": {
                "weather-server": {
                    "type": "local",
                    "command": "python",
                    "args": ["{{APP_HOME}}/servers/weather.py"],
                }
            }
        })
        template.write_text(template_content)

        result = mod._merge_mcp_config(template, dest)
        assert result is True
        assert dest.exists()

        config = json.loads(dest.read_text())
        assert "weather-server" in config["mcpServers"]

    def test_merge_preserves_existing(self, seed_env):
        mod, app_home = seed_env
        template = app_home / "mcp-config.json.template"
        dest = app_home / "mcp-config.json"

        # Existing config
        existing = {"mcpServers": {"my-server": {"type": "local", "command": "python"}}}
        dest.write_text(json.dumps(existing))

        # Template with new server
        template_content = json.dumps({
            "mcpServers": {
                "weather-server": {"type": "local", "command": "python", "args": []}
            }
        })
        template.write_text(template_content)

        result = mod._merge_mcp_config(template, dest)
        assert result is True

        config = json.loads(dest.read_text())
        assert "my-server" in config["mcpServers"]
        assert "weather-server" in config["mcpServers"]

    def test_merge_skips_existing_server(self, seed_env):
        mod, app_home = seed_env
        template = app_home / "mcp-config.json.template"
        dest = app_home / "mcp-config.json"

        existing = {"mcpServers": {"weather-server": {"type": "local", "command": "custom"}}}
        dest.write_text(json.dumps(existing))

        template_content = json.dumps({
            "mcpServers": {"weather-server": {"type": "local", "command": "python"}}
        })
        template.write_text(template_content)

        result = mod._merge_mcp_config(template, dest)
        assert result is False

        config = json.loads(dest.read_text())
        assert config["mcpServers"]["weather-server"]["command"] == "custom"

    def test_merge_invalid_template(self, seed_env):
        mod, app_home = seed_env
        template = app_home / "mcp-config.json.template"
        dest = app_home / "mcp-config.json"

        template.write_text("not valid json")
        result = mod._merge_mcp_config(template, dest)
        assert result is False


class TestSyncTree:
    def test_syncs_new_files(self, seed_env):
        mod, app_home = seed_env
        src = app_home / "seed-src"
        src.mkdir()
        (src / "file1.txt").write_text("content1")
        (src / "file2.txt").write_text("content2")

        dest = app_home / "seed-dest"
        dest.mkdir()

        count = mod._sync_tree(src, dest, overwrite=False)
        assert count == 2
        assert (dest / "file1.txt").read_text() == "content1"
        assert (dest / "file2.txt").read_text() == "content2"

    def test_skips_existing_without_overwrite(self, seed_env):
        mod, app_home = seed_env
        src = app_home / "seed-src"
        src.mkdir()
        (src / "file1.txt").write_text("new content")

        dest = app_home / "seed-dest"
        dest.mkdir()
        (dest / "file1.txt").write_text("existing content")

        count = mod._sync_tree(src, dest, overwrite=False)
        assert count == 0
        assert (dest / "file1.txt").read_text() == "existing content"

    def test_overwrites_with_flag(self, seed_env):
        mod, app_home = seed_env
        src = app_home / "seed-src"
        src.mkdir()
        (src / "file1.txt").write_text("new content")

        dest = app_home / "seed-dest"
        dest.mkdir()
        (dest / "file1.txt").write_text("existing content")

        count = mod._sync_tree(src, dest, overwrite=True)
        assert count == 1
        assert (dest / "file1.txt").read_text() == "new content"

    def test_skips_pycache(self, seed_env):
        mod, app_home = seed_env
        src = app_home / "seed-src"
        src.mkdir()
        cache_dir = src / "__pycache__"
        cache_dir.mkdir()
        (cache_dir / "module.cpython-312.pyc").write_bytes(b"bytecode")
        (src / "real_file.py").write_text("code")

        dest = app_home / "seed-dest"
        dest.mkdir()

        count = mod._sync_tree(src, dest, overwrite=False)
        assert count == 1
        assert not (dest / "__pycache__").exists()

    def test_handles_subdirectories(self, seed_env):
        mod, app_home = seed_env
        src = app_home / "seed-src"
        (src / "subdir").mkdir(parents=True)
        (src / "subdir" / "nested.txt").write_text("nested")

        dest = app_home / "seed-dest"
        dest.mkdir()

        count = mod._sync_tree(src, dest, overwrite=False)
        assert count == 1
        assert (dest / "subdir" / "nested.txt").read_text() == "nested"


class TestSeededVersion:
    def test_no_metadata(self, seed_env):
        mod, _ = seed_env
        assert mod._get_seeded_version() is None

    def test_set_and_get_version(self, seed_env):
        mod, _ = seed_env
        mod._set_seeded_version("0.6.0")
        assert mod._get_seeded_version() == "0.6.0"
