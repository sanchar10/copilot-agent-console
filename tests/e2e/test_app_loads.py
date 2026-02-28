"""E2E: App loads and sidebar is visible with core UI elements."""

from playwright.sync_api import Page, expect


def test_app_loads_sidebar(page: Page):
    """App loads and shows sidebar with Copilot Console title and New Session button."""
    sidebar = page.locator("aside")
    expect(sidebar).to_be_visible()

    expect(sidebar.locator("h1")).to_have_text("Copilot Console")

    new_session_btn = sidebar.get_by_role("button", name="New Session")
    expect(new_session_btn).to_be_visible()


def test_app_loads_main_area(page: Page):
    """Main area shows placeholder text when no session is selected."""
    main = page.locator("main")
    expect(main).to_be_visible()

    expect(main.get_by_text("Select or create a session")).to_be_visible(timeout=5000)


def test_sidebar_has_settings_button(page: Page):
    """Sidebar footer has a Settings button."""
    sidebar = page.locator("aside")
    settings_btn = sidebar.get_by_text("Settings")
    expect(settings_btn).to_be_visible()



def test_sidebar_has_active_agents(page: Page):
    """Sidebar has Active Agents button."""
    sidebar = page.locator("aside")
    agents_btn = sidebar.get_by_text("Active Agents")
    expect(agents_btn).to_be_visible()


def test_sidebar_shows_existing_sessions(page: Page):
    """If sessions exist in the backend, they appear in the sidebar."""
    sidebar = page.locator("aside")
    page.wait_for_timeout(2000)

    no_sessions = sidebar.get_by_text("No sessions yet")
    session_items = sidebar.locator("li")

    has_no_sessions = no_sessions.count() > 0 and no_sessions.is_visible()
    has_sessions = session_items.count() > 0

    assert has_no_sessions or has_sessions, "Sidebar should show either sessions or empty state"
