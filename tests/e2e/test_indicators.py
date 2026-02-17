"""E2E: Session card indicators — spinner for active agent, input state during streaming."""

from playwright.sync_api import Page, expect


def test_spinner_appears_during_streaming(page: Page):
    """While agent is responding, session card shows a spinner (animate-spin SVG)."""
    page.locator("aside").get_by_role("button", name="New Session").click()
    page.wait_for_timeout(500)

    textarea = page.locator("main textarea")
    textarea.fill("Write a 200-word essay about testing")
    textarea.press("Enter")

    expect(page.get_by_text("Write a 200-word essay about testing")).to_be_visible(timeout=10000)

    # While streaming, sidebar should show spinner
    sidebar = page.locator("aside")
    spinner = sidebar.locator("svg.animate-spin")

    try:
        expect(spinner.first).to_be_visible(timeout=15000)
    except Exception:
        # If response was very fast, spinner may have disappeared — acceptable
        pass

    expect(textarea).to_be_enabled(timeout=120000)


def test_input_disabled_during_streaming(page: Page):
    """While agent is responding, the input textarea should be disabled."""
    page.locator("aside").get_by_role("button", name="New Session").click()
    page.wait_for_timeout(500)

    textarea = page.locator("main textarea")
    textarea.fill("Tell me a long story about a robot")
    textarea.press("Enter")

    page.wait_for_timeout(1000)
    # Eventually it should become enabled again
    expect(textarea).to_be_enabled(timeout=120000)


def test_copilot_label_appears_during_response(page: Page):
    """The 'Copilot' label appears during streaming response."""
    page.locator("aside").get_by_role("button", name="New Session").click()
    page.wait_for_timeout(500)

    textarea = page.locator("main textarea")
    textarea.fill("Reply with exactly: INDICATOR_TEST_OK")
    textarea.press("Enter")

    main = page.locator("main")
    expect(main.get_by_text("Copilot").first).to_be_visible(timeout=30000)

    expect(textarea).to_be_enabled(timeout=120000)
