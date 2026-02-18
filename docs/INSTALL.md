# Manual Installation

## Pre-Requisites

Before installing Copilot Agent Console, ensure the following are available. All commands below can be run in either **PowerShell** or **Command Prompt**.

| Requirement | Version | How to check |
|---|---|---|
| **Windows** | 10 or 11 | — |
| **Python** | 3.10 or higher | `python --version` |
| **Node.js** | 18 or higher | `node --version` |
| **GitHub Copilot CLI** | 0.0.410+ | `copilot --version` |
| **GitHub Copilot subscription** | Active | [github.com/settings/copilot](https://github.com/settings/copilot) |

### Step 1: Install Python

Download from [python.org](https://www.python.org/downloads/). During installation, **check "Add Python to PATH"**.

Verify:
```powershell
python --version    # Should show 3.10+
pip --version       # Should work
```

### Step 2: Install Node.js

Download from [nodejs.org](https://nodejs.org/) (LTS version recommended).

Verify:
```powershell
node --version      # Should show 18+
npm --version       # Should work
```

### Step 3: Install GitHub Copilot CLI

The Copilot CLI is the runtime that Copilot Agent Console communicates with. Install it globally:

```powershell
npm install -g @github/copilot
```

Verify:
```powershell
copilot --version   # Should show 0.0.410 or later
```

Authenticate with GitHub (required before first use):
```powershell
copilot login
```

---

## Installation

### Option A: pipx (Recommended)

[pipx](https://pipx.pypa.io/) installs Python applications in isolated environments and automatically adds them to PATH.

```powershell
# Install pipx if not already installed
pip install --user pipx
python -m pipx ensurepath
# Close and reopen the terminal after this

# Install Copilot Agent Console
pipx install https://github.com/sanchar10/copilot-agent-console/releases/download/v0.2.0/copilot_agent_console-0.2.0-py3-none-any.whl
```

### Option B: pip

```powershell
pip install https://github.com/sanchar10/copilot-agent-console/releases/download/v0.2.0/copilot_agent_console-0.2.0-py3-none-any.whl
```

> If `agentconsole` command is not found after install, run as a module:
> ```powershell
> python -m copilot_agent_console.cli
> ```

## Verify Installation

```powershell
agentconsole --version
```

## Updating

When a new version is available, the app shows a banner with the install command. To update manually:

```powershell
pipx install --force https://github.com/sanchar10/copilot-agent-console/releases/download/v0.2.0/copilot_agent_console-0.2.0-py3-none-any.whl
```

## Uninstalling

```powershell
pipx uninstall copilot-agent-console
```

This removes the application but keeps session data and settings in `~/.copilot-agent-console/`. To remove everything:

```powershell
Remove-Item -Recurse -Force "$env:USERPROFILE\.copilot-agent-console"
```
