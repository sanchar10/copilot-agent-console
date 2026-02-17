"""CLI entry point for Copilot Agent Console."""

import argparse
import os
import sys
import webbrowser
from pathlib import Path
from threading import Timer

def check_copilot_sdk():
    """Check if github-copilot-sdk is available."""
    try:
        import copilot  # noqa: F401
        return True
    except ImportError:
        return False

def initialize_app_directory():
    """Create application directory and default files on first run."""
    import json
    import shutil
    
    app_home = Path.home() / ".copilot-agent-console"
    
    # Create directories
    (app_home / "sessions").mkdir(parents=True, exist_ok=True)
    (app_home / "tools").mkdir(exist_ok=True)
    
    # Create default settings if not exists
    settings_file = app_home / "settings.json"
    if not settings_file.exists():
        settings_file.write_text(json.dumps({
            "default_model": "gpt-4o",
            "default_cwd": str(Path.home()),
        }, indent=2))
        print(f"✓ Created settings at {settings_file}")
    
    # Seed bundled content (agents, skills, tools, MCP servers) on install/update
    from copilot_agent_console.app.services.seed_service import seed_bundled_content
    seed_bundled_content()
    
    return app_home


def open_browser_delayed(url: str, delay: float = 1.5):
    """Open browser after a short delay to let server start."""
    def _open():
        webbrowser.open(url)
    Timer(delay, _open).start()

def main():
    """Main entry point for Agent Console."""
    parser = argparse.ArgumentParser(
        prog="AgentConsole",
        description="Agent Console - A beautiful web UI for GitHub Copilot",
    )
    parser.add_argument(
        "--port", "-p",
        type=int,
        default=8765,
        help="Port to run the server on (default: 8765)"
    )
    parser.add_argument(
        "--host",
        default="127.0.0.1",
        help="Host to bind to (default: 127.0.0.1)"
    )
    parser.add_argument(
        "--no-browser",
        action="store_true",
        help="Don't automatically open browser"
    )
    parser.add_argument(
        "--no-sleep",
        action="store_true",
        help="Prevent Windows from sleeping while the app is running (useful for scheduled tasks)"
    )
    parser.add_argument(
        "--version", "-v",
        action="store_true",
        help="Show version and exit"
    )
    
    args = parser.parse_args()
    
    if args.version:
        from copilot_agent_console import __version__
        print(f"Copilot Agent Console v{__version__}")
        return 0
    
    # Check dependencies
    if not check_copilot_sdk():
        print("""
╔══════════════════════════════════════════════════════════════╗
║  Error: github-copilot-sdk not found!                        ║
║                                                              ║
║  Install it with: pip install github-copilot-sdk             ║
╚══════════════════════════════════════════════════════════════╝
        """)
        return 1
    
    # Initialize app directory
    app_home = initialize_app_directory()
    
    print(f"""
╔══════════════════════════════════════════════════════════════╗
║                   Agent Console                              ║
║          A beautiful web UI for GitHub Copilot               ║
╚══════════════════════════════════════════════════════════════╝

  App data:  {app_home}
  Server:    http://{args.host}:{args.port}
    """)
    
    # Open browser (delayed)
    if not args.no_browser:
        url = f"http://{args.host}:{args.port}"
        print(f"  Opening browser to {url}...")
        open_browser_delayed(url)
    
    # Prevent sleep if requested
    if args.no_sleep:
        os.environ["COPILOT_NO_SLEEP"] = "1"
        if sys.platform == "win32":
            print("  🔋 Sleep prevention enabled (Windows will stay awake)")
        else:
            print("  ⚠️  --no-sleep is only supported on Windows")

    print("\n  Press Ctrl+C to stop the server.\n")
    
    # Start server
    import uvicorn
    uvicorn.run(
        "copilot_agent_console.app.main:app",
        host=args.host,
        port=args.port,
        log_level="info",
    )
    
    return 0

if __name__ == "__main__":
    sys.exit(main())
