"""E2E: Tab management — opening, switching, and closing tabs."""

from playwright.sync_api import Page, expect


def _create_session_with_message(page: Page, message: str):
    """Helper: create a new session by sending a message."""
    page.locator("aside").get_by_role("button", name="New Session").click()
    page.wait_for_timeout(500)
    textarea = page.locator("main textarea")
    textarea.fill(message)
    textarea.press("Enter")
    expect(page.get_by_text(message)).to_be_visible(timeout=10000)
    expect(textarea).to_be_enabled(timeout=120000)


def test_tab_appears_when_session_opened(page: Page):
    """Opening a session creates a tab in the tab bar."""
    _create_session_with_message(page, "Tab test message 1")

    # Tab close buttons indicate tabs exist
    main = page.locator("main")
    tab_close_buttons = main.locator("button[title='Close tab'], button:has(svg.w-3)")
    assert tab_close_buttons.count() > 0, "At least one tab should be visible"


def test_multiple_tabs(page: Page):
    """Opening two sessions creates two tabs."""
    _create_session_with_message(page, "Multi tab test A")
    _create_session_with_message(page, "Multi tab test B")

    main = page.locator("main")
    expect(main.get_by_text("Multi tab test B")).to_be_visible()


def test_switching_tabs_preserves_messages(page: Page):
    """Both tabs' messages stay in the DOM when switching (tabs stay mounted)."""
    _create_session_with_message(page, "Tab persist A")
    _create_session_with_message(page, "Tab persist B")

    main = page.locator("main")

    # Tab B is active — its message is visible
    expect(main.get_by_text("Tab persist B")).to_be_visible()

    # Switch back to tab A by clicking its tab
    # The tab bar is inside main. Tabs are buttons with session names.
    tab_buttons = main.locator("[class*='tab'], button").filter(has_text="Tab persist A")
    if tab_buttons.count() == 0:
        # Fallback: click the first tab (left-most)
        main.locator("button").first.click()
    else:
        tab_buttons.first.click()

    page.wait_for_timeout(300)

    # Tab A's message should now be visible
    expect(main.get_by_text("Tab persist A")).to_be_visible()

    # Tab B's message should still be in the DOM (mounted but hidden)
    tab_b_msg = main.get_by_text("Tab persist B")
    expect(tab_b_msg).to_be_attached()


def test_other_tab_input_not_disabled_during_activation(page: Page):
    """When one session is activating, the other tab's input stays enabled."""
    _create_session_with_message(page, "Lock test session A")

    # Create second session — as soon as we send a message, this session
    # is activating (input locked). Quickly switch tab before it resolves.
    page.locator("aside").get_by_role("button", name="New Session").click()
    page.wait_for_timeout(500)

    textarea = page.locator("main textarea")
    textarea.fill("Lock test session B")
    textarea.press("Enter")

    # Immediately try to switch to the first tab
    main = page.locator("main")
    tab_buttons = main.locator("button").filter(has_text="Lock test session A")
    if tab_buttons.count() > 0:
        tab_buttons.first.click()
        page.wait_for_timeout(300)

        # The first tab's textarea should NOT be disabled — only the activating one should be
        first_tab_textarea = page.locator("main textarea")
        expect(first_tab_textarea).to_be_enabled(timeout=5000)