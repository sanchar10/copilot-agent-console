"""E2E: Session creation, switching, and management."""

from playwright.sync_api import Page, expect


def test_click_new_session_opens_chat(page: Page):
    """Clicking New Session opens new session view with input box."""
    sidebar = page.locator("aside")
    sidebar.get_by_role("button", name="New Session").click()

    main = page.locator("main")
    expect(main.get_by_text("How can I help you today?")).to_be_visible(timeout=5000)

    textarea = main.locator("textarea")
    expect(textarea).to_be_visible()
    expect(textarea).to_be_enabled()


def test_new_session_shows_model_badge(page: Page):
    """New session header shows a model badge."""
    page.locator("aside").get_by_role("button", name="New Session").click()

    header = page.locator("header")
    expect(header).to_be_visible(timeout=5000)

    # Model badge is a button inside header
    model_badge = header.locator("button").first
    expect(model_badge).to_be_visible()


def test_create_session_by_sending_message(page: Page):
    """Typing and sending a message creates a session and shows it."""
    page.locator("aside").get_by_role("button", name="New Session").click()
    page.wait_for_timeout(500)

    textarea = page.locator("main textarea")
    textarea.fill("Hello, this is an E2E test")
    textarea.press("Enter")

    expect(page.get_by_text("Hello, this is an E2E test")).to_be_visible(timeout=10000)
    expect(page.locator("main").get_by_text("You").first).to_be_visible()

    # Session should appear in sidebar
    page.wait_for_timeout(2000)
    sidebar = page.locator("aside")
    assert sidebar.locator("li").count() > 0


def test_session_shows_streaming_response(page: Page):
    """After sending a message, a streaming response from Copilot appears."""
    page.locator("aside").get_by_role("button", name="New Session").click()
    page.wait_for_timeout(500)

    textarea = page.locator("main textarea")
    textarea.fill("Say exactly: E2E_TEST_RESPONSE_OK")
    textarea.press("Enter")

    # Wait for Copilot response label
    expect(page.locator("main").get_by_text("Copilot").first).to_be_visible(timeout=30000)

    # Wait for response to complete
    expect(textarea).to_be_enabled(timeout=120000)


def test_click_session_in_sidebar_opens_it(page: Page):
    """Clicking an existing session in sidebar opens it."""
    page.wait_for_timeout(2000)
    sidebar = page.locator("aside")

    if sidebar.locator("li").count() == 0:
        # Create one first
        sidebar.get_by_role("button", name="New Session").click()
        page.wait_for_timeout(500)
        textarea = page.locator("main textarea")
        textarea.fill("Session for click test")
        textarea.press("Enter")
        expect(page.get_by_text("Session for click test")).to_be_visible(timeout=10000)
        expect(textarea).to_be_enabled(timeout=120000)

    sidebar.locator("li").first.click()
    page.wait_for_timeout(2000)

    main = page.locator("main")
    expect(main.get_by_text("Select or create a session")).not_to_be_visible()


def test_delete_session(page: Page):
    """Create a session, then delete it via the sidebar."""
    sidebar = page.locator("aside")

    sidebar.get_by_role("button", name="New Session").click()
    page.wait_for_timeout(500)
    textarea = page.locator("main textarea")
    textarea.fill("Session to be deleted")
    textarea.press("Enter")
    expect(page.get_by_text("Session to be deleted").first).to_be_visible(timeout=10000)
    expect(textarea).to_be_enabled(timeout=120000)

    session_item = sidebar.locator("li").first
    session_item.hover()
    page.wait_for_timeout(500)

    delete_btn = session_item.locator("button[title='Delete session']")
    expect(delete_btn).to_be_visible()
    delete_btn.click()

    expect(page.get_by_text("Delete Session")).to_be_visible(timeout=5000)
    # Click the confirm button inside the modal (z-50 overlay)
    confirm_btn = page.locator(".fixed.inset-0.z-50 button", has_text="Delete")
    expect(confirm_btn).to_be_visible()
    confirm_btn.click()
    page.wait_for_timeout(2000)
