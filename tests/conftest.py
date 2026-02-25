from __future__ import annotations

import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient


# Ensure src/ is on sys.path so `import copilot_agent_console` works without installation.
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))


def pytest_collection_modifyitems(items):
    """Auto-mark e2e tests and reorder so they run AFTER unit tests.

    Playwright's sync_api starts an event loop that persists for the session,
    which conflicts with asyncio.run() in unit tests.  Running e2e last avoids this.
    """
    e2e_items = []
    other_items = []
    for item in items:
        if "e2e" in str(item.fspath):
            item.add_marker(pytest.mark.e2e)
            e2e_items.append(item)
        else:
            other_items.append(item)
    items[:] = other_items + e2e_items


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch, tmp_path: Path):
    # Keep tests hermetic: avoid writing to the real user home.
    agent_home = tmp_path / "agent-console-home"
    user_home = tmp_path / "user-home"
    agent_home.mkdir(parents=True, exist_ok=True)
    user_home.mkdir(parents=True, exist_ok=True)

    monkeypatch.setenv("COPILOT_AGENT_CONSOLE_HOME", str(agent_home))
    monkeypatch.setenv("HOME", str(user_home))
    monkeypatch.setenv("USERPROFILE", str(user_home))

    # Force a clean import so module-level constants pick up the env vars above.
    for mod in list(sys.modules):
        if mod.startswith("copilot_agent_console.app"):
            sys.modules.pop(mod, None)

    import copilot_agent_console.app.services.copilot_service as copilot_service_module

    async def _noop_start_main_client() -> None:
        return None

    # Prevent startup from trying to locate/start the Copilot CLI.
    monkeypatch.setattr(
        copilot_service_module.copilot_service,
        "_start_main_client",
        _noop_start_main_client,
    )

    # Bypass auth middleware — TestClient doesn't present as localhost
    import copilot_agent_console.app.middleware.auth as auth_module
    monkeypatch.setattr(auth_module, "_is_localhost", lambda request: True)

    from copilot_agent_console.app.main import app

    with TestClient(app) as test_client:
        yield test_client
