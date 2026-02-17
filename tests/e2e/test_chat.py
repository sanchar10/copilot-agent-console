"""E2E: Chat functionality — message display, input behavior."""

from playwright.sync_api import Page, expect


def test_user_message_shows_you_label(page: Page):
    """User messages display with 'You' label."""
    page.locator("aside").get_by_role("button", name="New Session").click()
    page.wait_for_timeout(500)

    textarea = page.locator("main textarea")
    textarea.fill("Quick test message")
    textarea.press("Enter")

    main = page.locator("main")
    expect(main.get_by_text("You").first).to_be_visible(timeout=10000)
    expect(main.get_by_text("Quick test message")).to_be_visible()


def test_shift_enter_creates_newline(page: Page):
    """Shift+Enter in textarea creates a newline instead of sending."""
    page.locator("aside").get_by_role("button", name="New Session").click()
    page.wait_for_timeout(500)

    textarea = page.locator("main textarea")
    textarea.fill("Line 1")
    textarea.press("Shift+Enter")
    textarea.type("Line 2")

    value = textarea.input_value()
    assert "Line 1" in value and "Line 2" in value, "Shift+Enter should add newline, not send"


def test_empty_message_not_sent(page: Page):
    """Pressing Enter with empty input does nothing."""
    page.locator("aside").get_by_role("button", name="New Session").click()
    page.wait_for_timeout(500)

    textarea = page.locator("main textarea")
    textarea.press("Enter")

    main = page.locator("main")
    expect(main.get_by_text("How can I help you today?")).to_be_visible(timeout=3000)


def test_send_button_disabled_when_empty(page: Page):
    """Send button is disabled when textarea is empty."""
    page.locator("aside").get_by_role("button", name="New Session").click()
    page.wait_for_timeout(500)

    # Send button is the last button in main area
    send_btn = page.locator("main .border-t button").last
    expect(send_btn).to_be_disabled()

    textarea = page.locator("main textarea")
    textarea.fill("Hello")
    expect(send_btn).to_be_enabled()
