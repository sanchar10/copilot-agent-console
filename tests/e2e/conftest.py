"""Pytest fixtures for Playwright E2E tests.

Prerequisites:
  1. Backend running: python -m uvicorn copilot_console.app.main:app --port 8765
  2. Frontend built:  npm run build --prefix frontend
  3. Static symlink:  src/copilot_console/static -> frontend/dist  (junction on Windows)
  4. Playwright:      pip install playwright && python -m playwright install chromium
"""

import pytest
from playwright.sync_api import sync_playwright, Page, BrowserContext

BASE_URL = "http://127.0.0.1:8765"


@pytest.fixture(scope="session")
def browser():
    """Launch a shared browser for the entire test session."""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        yield browser
        browser.close()


@pytest.fixture()
def context(browser) -> BrowserContext:
    """Create a fresh browser context per test (isolated cookies/storage)."""
    ctx = browser.new_context(viewport={"width": 1280, "height": 800})
    yield ctx
    ctx.close()


@pytest.fixture()
def page(context) -> Page:
    """Create a fresh page per test and navigate to the app."""
    pg = context.new_page()
    pg.goto(BASE_URL, wait_until="networkidle")
    yield pg
    pg.close()
