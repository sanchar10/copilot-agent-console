"""Playwright E2E test configuration."""

from playwright.sync_api import Playwright

BASE_URL = "http://127.0.0.1:8765"


def create_browser(playwright: Playwright):
    """Create a browser instance for E2E tests."""
    return playwright.chromium.launch(headless=True)
