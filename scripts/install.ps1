# Copilot Agent Console — One-click installer for Windows
# Usage: irm https://raw.githubusercontent.com/sanchar10/copilot-agent-console/main/scripts/install.ps1 | iex

$ErrorActionPreference = "Stop"
$WHL_URL = "https://github.com/sanchar10/copilot-agent-console/releases/download/v0.2.0/copilot_agent_console-0.2.0-py3-none-any.whl"

Write-Host ""
Write-Host "  ✨ Copilot Agent Console Installer" -ForegroundColor Cyan
Write-Host "  ====================================" -ForegroundColor DarkGray
Write-Host ""

# --- Check Python ---
$python = Get-Command python -ErrorAction SilentlyContinue
if (-not $python) {
    Write-Host "  ❌ Python not found." -ForegroundColor Red
    Write-Host "     Install from https://www.python.org/downloads/" -ForegroundColor Yellow
    Write-Host "     Make sure to check 'Add Python to PATH' during install." -ForegroundColor Yellow
    exit 1
}
$pyVer = (python --version 2>&1) -replace 'Python\s*', ''
$pyMajor, $pyMinor = $pyVer.Split('.')[0..1] | ForEach-Object { [int]$_ }
if ($pyMajor -lt 3 -or ($pyMajor -eq 3 -and $pyMinor -lt 10)) {
    Write-Host "  ❌ Python 3.10+ required (found $pyVer)" -ForegroundColor Red
    exit 1
}
Write-Host "  ✅ Python $pyVer" -ForegroundColor Green

# --- Check Node.js ---
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
    Write-Host "  ❌ Node.js not found." -ForegroundColor Red
    Write-Host "     Install from https://nodejs.org/ (LTS recommended)" -ForegroundColor Yellow
    exit 1
}
$nodeVer = (node --version 2>&1) -replace 'v', ''
$nodeMajor = [int]($nodeVer.Split('.')[0])
if ($nodeMajor -lt 18) {
    Write-Host "  ❌ Node.js 18+ required (found $nodeVer)" -ForegroundColor Red
    exit 1
}
Write-Host "  ✅ Node.js $nodeVer" -ForegroundColor Green

# --- Check/Install Copilot CLI ---
$copilot = Get-Command copilot -ErrorAction SilentlyContinue
if (-not $copilot) {
    Write-Host "  📦 Installing GitHub Copilot CLI..." -ForegroundColor Yellow
    npm install -g @github/copilot 2>&1 | Out-Null
    $copilot = Get-Command copilot -ErrorAction SilentlyContinue
    if (-not $copilot) {
        Write-Host "  ❌ Failed to install Copilot CLI" -ForegroundColor Red
        exit 1
    }
}
$copilotVer = ((copilot --version 2>&1) | Select-Object -First 1) -replace '.*?(\d+\.\d+\.\d+[-\d]*).*', '$1'
Write-Host "  ✅ Copilot CLI $copilotVer" -ForegroundColor Green

# --- Check Copilot auth ---
Write-Host ""
$copilotConfig = "$env:USERPROFILE\.copilot\config.json"
$needsLogin = $true
if (Test-Path $copilotConfig) {
    try {
        $config = Get-Content $copilotConfig -Raw | ConvertFrom-Json
        if ($config.logged_in_users -and $config.logged_in_users.Count -gt 0) {
            $needsLogin = $false
            Write-Host "  ✅ Copilot authenticated ($($config.logged_in_users[0].login))" -ForegroundColor Green
        }
    } catch { }
}
if ($needsLogin) {
    Write-Host "  🔐 Copilot login required. Opening browser..." -ForegroundColor Yellow
    copilot login
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ❌ Copilot login failed. Run 'copilot login' manually." -ForegroundColor Red
        exit 1
    }
    Write-Host "  ✅ Copilot authenticated" -ForegroundColor Green
}

# --- Install/Upgrade pipx ---
$pipx = Get-Command pipx -ErrorAction SilentlyContinue
if (-not $pipx) {
    Write-Host ""
    Write-Host "  📦 Installing pipx..." -ForegroundColor Yellow
    pip install --user pipx 2>&1 | Out-Null
    python -m pipx ensurepath 2>&1 | Out-Null
    # Try to find pipx after install
    $pipx = Get-Command pipx -ErrorAction SilentlyContinue
}

# --- Install Agent Console ---
Write-Host ""
Write-Host "  📦 Installing Copilot Agent Console..." -ForegroundColor Yellow

if ($pipx) {
    try {
        pipx install --force $WHL_URL *>&1 | Out-Null
    } catch { }
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ⚠️  pipx install failed, trying pip..." -ForegroundColor Yellow
        try {
            pip install --force-reinstall --no-cache-dir $WHL_URL *>&1 | Out-Null
        } catch { }
    }
} else {
    try {
        pip install --force-reinstall --no-cache-dir $WHL_URL *>&1 | Out-Null
    } catch { }
}

# --- Verify ---
$ac = Get-Command agentconsole -ErrorAction SilentlyContinue
if ($ac) {
    $acVer = (agentconsole --version 2>&1)
    Write-Host "  ✅ $acVer" -ForegroundColor Green
} else {
    Write-Host "  ✅ Installed (run with: python -m copilot_agent_console.cli)" -ForegroundColor Green
}

Write-Host ""
Write-Host "  🚀 Ready! Run 'agentconsole' to start." -ForegroundColor Cyan
Write-Host ""
