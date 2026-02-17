def test_health(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_settings_smoke(client):
    resp = client.get("/api/settings")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data.get("default_model"), str)
    assert isinstance(data.get("default_cwd"), str)


def test_create_session_smoke(client):
    resp = client.post(
        "/api/sessions",
        json={
            "model": "gpt-4.1",
            "name": "Test Session",
            # Keep hermetic: avoid reading ~/.copilot for MCP/tool defaults.
            "mcp_servers": [],
            "tools": {"custom": [], "builtin": []},
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data.get("session_id"), str) and data["session_id"]
    assert data.get("session_name") == "Test Session"
