"""Tests for MCP service — global, agent-only, and remote server loading."""

from __future__ import annotations

import json

import pytest


# ── helpers ──────────────────────────────────────────────────────────────

def _write_mcp_config(path, servers: dict):
    """Write an mcp-config.json file with the given mcpServers dict."""
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({"mcpServers": servers}), encoding="utf-8")


# ── tests ────────────────────────────────────────────────────────────────

class TestMCPServerLoading:
    def test_global_servers_loaded(self, client, tmp_path):
        """Global MCP servers from ~/.copilot/mcp-config.json are returned."""
        user_home = tmp_path / "user-home"
        copilot_dir = user_home / ".copilot"
        _write_mcp_config(copilot_dir / "mcp-config.json", {
            "github-server": {
                "command": "node",
                "args": ["github-mcp.js"],
                "tools": ["*"],
            }
        })
        resp = client.post("/api/mcp/servers/refresh")
        assert resp.status_code == 200
        servers = resp.json()["servers"]
        github = [s for s in servers if s["name"] == "github-server"]
        assert len(github) == 1
        assert github[0]["source"] == "global"
        assert github[0]["command"] == "node"

    def test_agent_only_servers_loaded(self, client, tmp_path):
        """Agent-only servers from ~/.copilot-agent-console/mcp-config.json are returned."""
        agent_home = tmp_path / "agent-console-home"
        _write_mcp_config(agent_home / "mcp-config.json", {
            "custom-db": {
                "command": "python",
                "args": ["-m", "db_mcp"],
                "tools": ["query", "insert"],
            }
        })
        resp = client.post("/api/mcp/servers/refresh")
        assert resp.status_code == 200
        servers = resp.json()["servers"]
        db = [s for s in servers if s["name"] == "custom-db"]
        assert len(db) == 1
        assert db[0]["source"] == "agent-only"
        assert db[0]["tools"] == ["query", "insert"]

    def test_both_global_and_agent_only_merged(self, client, tmp_path):
        """Both global and agent-only servers appear in the combined list."""
        user_home = tmp_path / "user-home"
        agent_home = tmp_path / "agent-console-home"
        _write_mcp_config(user_home / ".copilot" / "mcp-config.json", {
            "global-server": {"command": "echo", "args": ["global"], "tools": ["*"]},
        })
        _write_mcp_config(agent_home / "mcp-config.json", {
            "agent-server": {"command": "echo", "args": ["agent"], "tools": ["*"]},
        })
        resp = client.post("/api/mcp/servers/refresh")
        assert resp.status_code == 200
        servers = resp.json()["servers"]
        names = [s["name"] for s in servers]
        assert "global-server" in names
        assert "agent-server" in names

    def test_remote_http_server(self, client, tmp_path):
        """Remote HTTP MCP servers are parsed correctly."""
        agent_home = tmp_path / "agent-console-home"
        _write_mcp_config(agent_home / "mcp-config.json", {
            "remote-api": {
                "type": "http",
                "url": "https://api.example.com/mcp",
                "headers": {"Authorization": "Bearer token123"},
                "tools": ["*"],
            }
        })
        resp = client.post("/api/mcp/servers/refresh")
        assert resp.status_code == 200
        servers = resp.json()["servers"]
        remote = [s for s in servers if s["name"] == "remote-api"]
        assert len(remote) == 1
        assert remote[0]["type"] == "http"
        assert remote[0]["url"] == "https://api.example.com/mcp"
        assert remote[0]["headers"] == {"Authorization": "Bearer token123"}
        assert remote[0]["command"] is None

    def test_remote_sse_server(self, client, tmp_path):
        """Remote SSE MCP servers are parsed correctly."""
        agent_home = tmp_path / "agent-console-home"
        _write_mcp_config(agent_home / "mcp-config.json", {
            "sse-server": {
                "type": "sse",
                "url": "https://stream.example.com/events",
                "tools": ["listen"],
            }
        })
        resp = client.post("/api/mcp/servers/refresh")
        assert resp.status_code == 200
        servers = resp.json()["servers"]
        sse = [s for s in servers if s["name"] == "sse-server"]
        assert len(sse) == 1
        assert sse[0]["type"] == "sse"
        assert sse[0]["url"] == "https://stream.example.com/events"

    def test_empty_config_returns_no_servers(self, client):
        """No config files → empty server list."""
        resp = client.get("/api/mcp/servers")
        assert resp.status_code == 200
        assert resp.json()["servers"] == []


class TestMCPServerForSDK:
    def test_sdk_format_local_server(self, client, tmp_path):
        """get_servers_for_sdk returns correct format for local servers."""
        from copilot_agent_console.app.services.mcp_service import mcp_service

        user_home = tmp_path / "user-home"
        _write_mcp_config(user_home / ".copilot" / "mcp-config.json", {
            "local-srv": {
                "command": "python",
                "args": ["-m", "my_mcp"],
                "tools": ["*"],
                "env": {"API_KEY": "test"},
                "cwd": "/tmp/work",
            }
        })
        mcp_service.refresh()
        sdk = mcp_service.get_servers_for_sdk(["local-srv"])
        assert "local-srv" in sdk
        assert sdk["local-srv"]["command"] == "python"
        assert sdk["local-srv"]["args"] == ["-m", "my_mcp"]
        assert sdk["local-srv"]["env"] == {"API_KEY": "test"}
        assert sdk["local-srv"]["cwd"] == "/tmp/work"

    def test_sdk_format_remote_server(self, client, tmp_path):
        """get_servers_for_sdk returns correct format for remote servers."""
        from copilot_agent_console.app.services.mcp_service import mcp_service

        agent_home = tmp_path / "agent-console-home"
        _write_mcp_config(agent_home / "mcp-config.json", {
            "remote-srv": {
                "type": "http",
                "url": "https://api.example.com/mcp",
                "headers": {"Auth": "Bearer x"},
                "tools": ["*"],
            }
        })
        mcp_service.refresh()
        sdk = mcp_service.get_servers_for_sdk(["remote-srv"])
        assert "remote-srv" in sdk
        assert sdk["remote-srv"]["type"] == "http"
        assert sdk["remote-srv"]["url"] == "https://api.example.com/mcp"
        assert sdk["remote-srv"]["headers"] == {"Auth": "Bearer x"}
        assert "command" not in sdk["remote-srv"]

    def test_sdk_selections_filter(self, client, tmp_path):
        """Only selected servers are returned in SDK format."""
        from copilot_agent_console.app.services.mcp_service import mcp_service

        user_home = tmp_path / "user-home"
        _write_mcp_config(user_home / ".copilot" / "mcp-config.json", {
            "enabled-srv": {"command": "echo", "args": ["a"], "tools": ["*"]},
            "disabled-srv": {"command": "echo", "args": ["b"], "tools": ["*"]},
        })
        mcp_service.refresh()
        sdk = mcp_service.get_servers_for_sdk(["enabled-srv"])
        assert "enabled-srv" in sdk
        assert "disabled-srv" not in sdk


class TestAgentMCPRoundTrip:
    def test_agent_mcp_selections_persist(self, client):
        """Agent MCP server selections round-trip through create/get."""
        resp = client.post("/api/agents", json={
            "name": "MCP Agent",
            "mcp_servers": ["github", "custom-db"],
        })
        assert resp.status_code == 200
        agent_id = resp.json()["id"]
        
        loaded = client.get(f"/api/agents/{agent_id}").json()
        assert loaded["mcp_servers"] == ["github", "custom-db"]

    def test_agent_mcp_update(self, client):
        """Agent MCP selections can be updated."""
        resp = client.post("/api/agents", json={
            "name": "MCP Update Agent",
            "mcp_servers": ["github"],
        })
        agent_id = resp.json()["id"]
        
        client.put(f"/api/agents/{agent_id}", json={
            "mcp_servers": ["new-server"],
        })
        loaded = client.get(f"/api/agents/{agent_id}").json()
        assert loaded["mcp_servers"] == ["new-server"]
