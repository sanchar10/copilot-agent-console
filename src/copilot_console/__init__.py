"""Copilot Console - A feature-rich console for GitHub Copilot agents."""

# Suppress benign agent-framework "experimental" warnings emitted at import
# time for MemoryStore / SkillResource. We touch these features transitively
# via the workflow engine but don't depend on their public API. Done here in
# the package __init__ so it lands before any submodule imports agent_framework.
# We filter by message (not class) because importing the AF class itself would
# trigger the warnings we want to suppress. Track AF release notes for stable
# API migration before relying on these directly in our own code.
import warnings as _warnings
_warnings.filterwarnings(
    "ignore", message=r".*is experimental and may change.*"
)

from importlib.metadata import version as _pkg_version, PackageNotFoundError
from pathlib import Path


def _read_pyproject_version() -> str:
    """Read version from pyproject.toml (dev mode fallback)."""
    try:
        pyproject = Path(__file__).parent.parent.parent / "pyproject.toml"
        if pyproject.exists():
            for line in pyproject.read_text(encoding="utf-8").splitlines():
                if line.strip().startswith("version"):
                    return line.split("=", 1)[1].strip().strip('"').strip("'")
    except Exception:
        pass
    return "0.0.0-dev"


try:
    _installed_version = _pkg_version("copilot-console")
except PackageNotFoundError:
    _installed_version = None

# In dev mode (running via PYTHONPATH), the installed package metadata may be
# stale. Prefer pyproject.toml version when it exists and differs.
_pyproject_version = _read_pyproject_version()
if _pyproject_version != "0.0.0-dev" and _installed_version != _pyproject_version:
    __version__ = _pyproject_version
elif _installed_version:
    __version__ = _installed_version
else:
    __version__ = _pyproject_version

__app_name__ = "Copilot Console"
