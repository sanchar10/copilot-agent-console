"""Filesystem router - browse directories and open files."""

import ctypes
import os
import platform
import re
import subprocess
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from copilot_console.app.services.storage_service import storage_service

router = APIRouter(prefix="/filesystem", tags=["filesystem"])


@router.get("/browse")
async def browse_directory(path: str | None = Query(None, description="Directory path to list. None returns root/drives.")) -> dict:
    """Browse a directory and return its subdirectories.
    
    On Windows with no path: returns available drive letters.
    On Unix with no path: returns contents of /.
    With a path: returns subdirectories of that path.
    """
    try:
        # No path provided - return root entries
        if not path:
            if platform.system() == "Windows":
                # Use GetLogicalDrives bitmask for reliable drive detection
                drives = []
                bitmask = ctypes.windll.kernel32.GetLogicalDrives()  # type: ignore[attr-defined]
                for i in range(26):
                    if bitmask & (1 << i):
                        letter = chr(ord('A') + i)
                        drive_path = f"{letter}:\\"
                        drives.append({
                            "name": f"{letter}:",
                            "path": drive_path,
                            "is_drive": True,
                        })
                return {
                    "current_path": "",
                    "parent_path": None,
                    "entries": drives,
                }
            else:
                # Unix - start at root
                path = "/"

        # Resolve and validate the path
        target = Path(path).resolve()
        
        if not target.exists():
            raise HTTPException(status_code=404, detail=f"Path does not exist: {path}")
        
        if not target.is_dir():
            raise HTTPException(status_code=400, detail=f"Path is not a directory: {path}")

        # Determine parent path
        parent_path: str | None = None
        if platform.system() == "Windows":
            # On Windows, parent of a drive root (e.g., C:\) goes back to drive list
            # Use target.parent == target which is True at drive roots
            if target.parent == target:
                parent_path = ""  # empty string means "go to drive list"
            else:
                parent_path = str(target.parent)
        else:
            if str(target) == "/":
                parent_path = None  # Already at root
            else:
                parent_path = str(target.parent)

        # List subdirectories
        entries = []
        try:
            for entry in sorted(target.iterdir(), key=lambda e: e.name.lower()):
                if entry.is_dir():
                    # Skip hidden directories and common uninteresting dirs
                    name = entry.name
                    if name.startswith('.') and name not in ('.', '..'):
                        continue
                    try:
                        # Check if we can actually access this directory
                        list(entry.iterdir())
                        accessible = True
                    except PermissionError:
                        accessible = False
                    except OSError:
                        accessible = False
                    
                    entries.append({
                        "name": name,
                        "path": str(entry),
                        "accessible": accessible,
                    })
        except PermissionError:
            raise HTTPException(
                status_code=403,
                detail=f"Permission denied: {path}"
            )
        except OSError as e:
            raise HTTPException(
                status_code=500,
                detail=f"Error reading directory: {e}"
            )

        return {
            "current_path": str(target),
            "parent_path": parent_path,
            "entries": entries,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {e}")


class OpenFileRequest(BaseModel):
    path: str
    session_id: str | None = None


_WEB_SCHEME_RE = re.compile(r"^[a-z][a-z0-9+.\-]*://", re.IGNORECASE)
_KNOWN_NON_FILE_SCHEMES = {"http", "https", "mailto", "tel", "sms", "data", "ftp", "file"}


def _is_web_url(candidate: str) -> bool:
    """Return True for things the UI shouldn't be sending to /open."""
    if not candidate:
        return False
    if candidate.startswith("//"):  # protocol-relative
        return True
    if candidate.lower().startswith("www."):
        return True
    if _WEB_SCHEME_RE.match(candidate):
        return True
    # mailto:/tel:/sms: etc. without //
    head, sep, _ = candidate.partition(":")
    if sep and head and head.lower() in _KNOWN_NON_FILE_SCHEMES:
        return True
    return False


def _resolve_candidate(candidate: str, session_id: str | None) -> Path:
    """Resolve a candidate path to an existing local Path or raise HTTPException.

    Precedence:
      1. Web scheme -> 400 (UI bug; should have been caught client-side).
      2. Absolute path that exists -> return it.
      3. Relative/bare with session_id -> join against session.cwd; return if exists.
      4. Otherwise -> 404.
    """
    raw = (candidate or "").strip()
    if not raw:
        raise HTTPException(status_code=400, detail="Empty path")

    if _is_web_url(raw):
        raise HTTPException(
            status_code=400,
            detail="Web URLs should be opened in the browser, not via /open",
        )

    expanded = Path(raw).expanduser()

    if expanded.is_absolute():
        if expanded.exists():
            return expanded
        raise HTTPException(status_code=404, detail=f"File not found: {raw}")

    # Relative or bare name — needs session context.
    if not session_id:
        raise HTTPException(
            status_code=400,
            detail="session_id required to resolve relative or bare path",
        )

    session_meta = storage_service.load_session(session_id)
    if not session_meta:
        raise HTTPException(status_code=404, detail=f"Session not found: {session_id}")

    cwd_raw = session_meta.get("cwd")
    if not cwd_raw:
        raise HTTPException(
            status_code=500,
            detail=f"Session {session_id} has no cwd",
        )
    cwd = Path(str(cwd_raw)).expanduser()
    joined = (cwd / expanded).resolve()
    if joined.exists():
        return joined
    raise HTTPException(status_code=404, detail=f"File not found: {raw}")


class OpenWithRequest(BaseModel):
    cwd: str
    target: str  # 'vscode' | 'terminal' | 'explorer'


@router.post("/open-with")
async def open_with(request: OpenWithRequest) -> dict:
    """Open a folder in VS Code, Terminal, or File Explorer."""
    cwd = Path(request.cwd).resolve()
    if not cwd.exists() or not cwd.is_dir():
        raise HTTPException(status_code=404, detail="Folder not found")

    system = platform.system()
    try:
        if request.target == "vscode":
            import shutil
            code_cmd = shutil.which("code") or "code"
            if system == "Windows":
                subprocess.Popen([code_cmd, str(cwd)], shell=True)
            else:
                subprocess.Popen([code_cmd, str(cwd)])
        elif request.target == "terminal":
            if system == "Windows":
                import shutil
                shell = shutil.which("pwsh") or shutil.which("powershell") or "cmd"
                if "pwsh" in shell or "powershell" in shell:
                    subprocess.Popen([shell, "-NoExit", "-Command", "Set-Location", str(cwd)],
                                     creationflags=subprocess.CREATE_NEW_CONSOLE)
                else:
                    subprocess.Popen(["cmd", "/k", "cd", "/d", str(cwd)],
                                     creationflags=subprocess.CREATE_NEW_CONSOLE)
            elif system == "Darwin":
                subprocess.Popen(["open", "-a", "Terminal", str(cwd)])
            else:
                subprocess.Popen(["x-terminal-emulator", "--working-directory", str(cwd)])
        elif request.target == "explorer":
            if system == "Windows":
                subprocess.Popen(["explorer", str(cwd)])
            elif system == "Darwin":
                subprocess.Popen(["open", str(cwd)])
            else:
                subprocess.Popen(["xdg-open", str(cwd)])
        else:
            raise HTTPException(status_code=400, detail=f"Unknown target: {request.target}")
        return {"status": "opened", "target": request.target, "cwd": str(cwd)}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"'{request.target}' not found — is it installed?")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to open: {e}")


@router.post("/open")
async def open_file(request: OpenFileRequest) -> dict:
    """Open a file or folder with the OS default application.

    Accepts:
      - Absolute paths (Windows drive, UNC, POSIX) — opened directly if they exist.
      - ``~``-prefixed paths — expanded against the user's home directory.
      - Relative paths or bare filenames — resolved against the session's cwd
        (``session_id`` is required in this case).

    Web URLs (``http(s):``, ``mailto:``, ``//host``, ``www.``) are rejected with
    400; the frontend should render those as native ``<a target="_blank">``.
    """
    file_path = _resolve_candidate(request.path, request.session_id)

    try:
        system = platform.system()
        if system == "Windows":
            if file_path.is_dir():
                subprocess.Popen(["explorer", str(file_path)])
            else:
                os.startfile(str(file_path))  # type: ignore[attr-defined]
        elif system == "Darwin":
            subprocess.Popen(["open", str(file_path)])
        else:
            subprocess.Popen(["xdg-open", str(file_path)])
        return {"status": "opened", "path": str(file_path)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to open file: {e}")
