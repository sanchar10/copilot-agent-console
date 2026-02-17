"""E2E: Settings modal functionality."""

from playwright.sync_api import Page, expect


def test_open_settings_modal(page: Page):
    """Clicking Settings opens the settings modal."""
    page.locator("aside").get_by_text("Settings").click()

    expect(page.get_by_text("Default Model")).to_be_visible(timeout=5000)
    expect(page.get_by_text("Default Working Directory")).to_be_visible()

    expect(page.get_by_role("button", name="Save")).to_be_visible()
    expect(page.get_by_role("button", name="Cancel")).to_be_visible()


def test_settings_modal_cancel(page: Page):
    """Clicking Cancel closes settings modal without saving."""
    page.locator("aside").get_by_text("Settings").click()
    expect(page.get_by_text("Default Model")).to_be_visible(timeout=5000)

    page.get_by_role("button", name="Cancel").click()
    expect(page.get_by_text("Default Model")).not_to_be_visible(timeout=3000)


def test_settings_modal_has_model_dropdown(page: Page):
    """Settings modal has a model selection dropdown with options."""
    page.locator("aside").get_by_text("Settings").click()
    expect(page.get_by_text("Default Model")).to_be_visible(timeout=5000)

    select = page.locator("select").first
    expect(select).to_be_visible()
    assert select.locator("option").count() > 0, "Model dropdown should have at least one option"


def test_settings_modal_has_cwd_input(page: Page):
    """Settings modal has a working directory input field with a default value."""
    page.locator("aside").get_by_text("Settings").click()
    expect(page.get_by_text("Default Working Directory")).to_be_visible(timeout=5000)

    cwd_input = page.locator("input[type='text']").first
    expect(cwd_input).to_be_visible()
    assert len(cwd_input.input_value()) > 0, "CWD input should have a default value"
