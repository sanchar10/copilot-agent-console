"""Seed content service — syncs bundled content to user directories on install/update.

Bundled content lives in src/copilot_agent_console/seed/ and mirrors two destination roots:
  seed/agent-console/  → ~/.copilot-agent-console/  (app-managed content)
  seed/copilot/        → ~/.copilot/                (CLI-level content)

Sync behaviors:
  - app/ items: copy-if-missing (don't overwrite user edits)
  - copilot/ items: copy-or-update (we own these, update on new versions)

Special handling:
  - .template files: expand {{APP_HOME}} variable, write without .template extension
  - mcp-config.json.template: merge into existing mcp-config.json (add new servers only)

Seeding runs only when the app version changes (install or update).
"""

import json
import shutil
from pathlib import Path

from copilot_agent_console.app.config import APP_HOME, METADATA_FILE
from copilot_agent_console.app.services.logging_service import get_logger

logger = get_logger(__name__)

# Root of bundled seed content
SEED_DIR = Path(__file__).parent.parent.parent / "seed"

# Destination roots
COPILOT_HOME = Path.home() / ".copilot"

# Template variables available in .template files
_TEMPLATE_VARS = {
    "APP_HOME": str(APP_HOME).replace("\\", "/"),
}


def _get_app_version() -> str:
    """Get current app version from package."""
    try:
        from copilot_agent_console import __version__
        return __version__
    except (ImportError, AttributeError):
        return "dev"


def _get_seeded_version() -> str | None:
    """Read the last seeded version from metadata."""
    if not METADATA_FILE.exists():
        return None
    try:
        data = json.loads(METADATA_FILE.read_text(encoding="utf-8"))
        return data.get("seed_version")
    except (json.JSONDecodeError, IOError):
        return None


def _set_seeded_version(version: str) -> None:
    """Write the seeded version to metadata."""
    data = {}
    if METADATA_FILE.exists():
        try:
            data = json.loads(METADATA_FILE.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, IOError):
            pass
    data["seed_version"] = version
    METADATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    METADATA_FILE.write_text(json.dumps(data, indent=2), encoding="utf-8")


def _expand_template(content: str) -> str:
    """Replace {{VAR}} placeholders with actual values."""
    for var, value in _TEMPLATE_VARS.items():
        content = content.replace("{{" + var + "}}", value)
    return content


def _merge_mcp_config(template_path: Path, dest_path: Path) -> bool:
    """Merge seed MCP servers into existing mcp-config.json (add new servers only).
    
    Returns True if any servers were added.
    """
    # Read and expand the template
    template_content = _expand_template(template_path.read_text(encoding="utf-8"))
    try:
        seed_config = json.loads(template_content)
    except json.JSONDecodeError:
        logger.warning(f"Invalid JSON in template: {template_path}")
        return False

    seed_servers = seed_config.get("mcpServers", {})
    if not seed_servers:
        return False

    # Read existing config (or start empty)
    existing = {}
    if dest_path.exists():
        try:
            existing = json.loads(dest_path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, IOError):
            pass

    existing_servers = existing.get("mcpServers", {})

    # Only add servers that don't already exist
    added = False
    for name, config in seed_servers.items():
        if name not in existing_servers:
            existing_servers[name] = config
            added = True
            logger.info(f"Seeded MCP server: {name}")

    if added:
        existing["mcpServers"] = existing_servers
        dest_path.parent.mkdir(parents=True, exist_ok=True)
        dest_path.write_text(json.dumps(existing, indent=2), encoding="utf-8")

    return added


def _sync_tree(src_root: Path, dest_root: Path, overwrite: bool = False) -> int:
    """Sync a directory tree from src to dest.
    
    Args:
        src_root: Source directory containing bundled content
        dest_root: Destination directory in user's home
        overwrite: If True, overwrite existing files when content differs.
                   If False, skip files that already exist.
    
    Returns:
        Number of files synced
    """
    synced = 0
    if not src_root.exists():
        return synced

    for src_file in src_root.rglob("*"):
        if src_file.is_dir():
            continue
        if "__pycache__" in src_file.parts or src_file.suffix == ".pyc":
            continue

        relative = src_file.relative_to(src_root)

        # Handle .template files
        if src_file.suffix == ".template":
            dest_relative = relative.with_name(relative.name.replace(".template", ""))
            dest_file = dest_root / dest_relative

            # Special case: mcp-config.json — merge, don't overwrite
            if dest_relative.name == "mcp-config.json":
                if _merge_mcp_config(src_file, dest_file):
                    synced += 1
                continue

            # Generic template: expand and write if missing
            if dest_file.exists() and not overwrite:
                continue
            content = _expand_template(src_file.read_text(encoding="utf-8"))
            if dest_file.exists():
                try:
                    if dest_file.read_text(encoding="utf-8") == content:
                        continue
                except IOError:
                    pass
            dest_file.parent.mkdir(parents=True, exist_ok=True)
            dest_file.write_text(content, encoding="utf-8")
            synced += 1
            logger.info(f"Seeded (template): {dest_relative}")
            continue

        # Regular file
        dest_file = dest_root / relative

        if dest_file.exists():
            if not overwrite:
                continue
            try:
                if dest_file.read_bytes() == src_file.read_bytes():
                    continue
            except IOError:
                pass

        dest_file.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src_file, dest_file)
        synced += 1
        logger.info(f"Seeded: {relative}")

    return synced


def seed_bundled_content(force: bool = False) -> None:
    """Sync all bundled seed content to user directories.
    
    Only runs when app version changes (install/update) unless force=True.
    """
    app_version = _get_app_version()
    seeded_version = _get_seeded_version()

    if not force and seeded_version == app_version:
        return

    logger.info(f"Seeding bundled content (version: {seeded_version} → {app_version})")
    total = 0

    # seed/agent-console/ → ~/.copilot-agent-console/ (copy-if-missing)
    app_seed = SEED_DIR / "agent-console"
    if app_seed.exists():
        count = _sync_tree(app_seed, APP_HOME, overwrite=False)
        total += count

    # seed/copilot/ → ~/.copilot/ (copy-or-update, we own these)
    copilot_seed = SEED_DIR / "copilot"
    if copilot_seed.exists():
        count = _sync_tree(copilot_seed, COPILOT_HOME, overwrite=True)
        total += count

    _set_seeded_version(app_version)
    logger.info(f"Seeding complete: {total} files synced")
