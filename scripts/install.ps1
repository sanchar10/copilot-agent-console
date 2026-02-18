# Copilot Agent Console - One-click installer for Windows
# Usage: irm https://raw.githubusercontent.com/sanchar10/copilot-agent-console/main/scripts/install.ps1 | iex

$WHL_URL = "https://github.com/sanchar10/copilot-agent-console/releases/download/v0.2.0/copilot_agent_console-0.2.0-py3-none-any.whl"

Write-Host ""
Write-Host "  Copilot Agent Console Installer" -ForegroundColor Cyan
Write-Host "  ====================================" -ForegroundColor DarkGray
Write-Host ""

# --- Check Python ---
$python = Get-Command python -ErrorAction SilentlyContinue
if (-not $python) {
    Write-Host "  [ERROR] Python not found." -ForegroundColor Red
    Write-Host "     Install from https://www.python.org/downloads/" -ForegroundColor Yellow
    Write-Host "     Make sure to check 'Add Python to PATH' during install." -ForegroundColor Yellow
    exit 1
}
$pyVer = (python --version 2>&1) -replace 'Python\s*', ''
$pyMajor, $pyMinor = $pyVer.Split('.')[0..1] | ForEach-Object { [int]$_ }
if ($pyMajor -lt 3 -or ($pyMajor -eq 3 -and $pyMinor -lt 10)) {
    Write-Host "  [ERROR] Python 3.10+ required (found $pyVer)" -ForegroundColor Red
    exit 1
}
Write-Host "  [OK] Python $pyVer" -ForegroundColor Green

# --- Check Node.js ---
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
    Write-Host "  [ERROR] Node.js not found." -ForegroundColor Red
    Write-Host "     Install from https://nodejs.org/ (LTS recommended)" -ForegroundColor Yellow
    exit 1
}
$nodeVer = (node --version 2>&1) -replace 'v', ''
$nodeMajor = [int]($nodeVer.Split('.')[0])
if ($nodeMajor -lt 18) {
    Write-Host "  [ERROR] Node.js 18+ required (found $nodeVer)" -ForegroundColor Red
    exit 1
}
Write-Host "  [OK] Node.js $nodeVer" -ForegroundColor Green

# --- Check/Install Copilot CLI ---
$copilot = Get-Command copilot -ErrorAction SilentlyContinue
if (-not $copilot) {
    Write-Host "  Installing GitHub Copilot CLI..." -ForegroundColor Yellow
    npm install -g @github/copilot 2>&1 | Out-Null
    $copilot = Get-Command copilot -ErrorAction SilentlyContinue
    if (-not $copilot) {
        Write-Host "  [ERROR] Failed to install Copilot CLI" -ForegroundColor Red
        exit 1
    }
}
$copilotVer = ((copilot --version 2>&1) | Select-Object -First 1) -replace '.*?(\d+\.\d+\.\d+[-\d]*).*', '$1'
Write-Host "  [OK] Copilot CLI $copilotVer" -ForegroundColor Green

# --- Check Copilot auth ---
Write-Host ""
$copilotConfig = "$env:USERPROFILE\.copilot\config.json"
$needsLogin = $true
if (Test-Path $copilotConfig) {
    try {
        $config = Get-Content $copilotConfig -Raw | ConvertFrom-Json
        if ($config.logged_in_users -and $config.logged_in_users.Count -gt 0) {
            $needsLogin = $false
            Write-Host "  [OK] Copilot authenticated ($($config.logged_in_users[0].login))" -ForegroundColor Green
        }
    } catch { }
}
if ($needsLogin) {
    Write-Host "  Copilot login required. Opening browser..." -ForegroundColor Yellow
    copilot login
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  [ERROR] Copilot login failed. Run 'copilot login' manually." -ForegroundColor Red
        exit 1
    }
    Write-Host "  [OK] Copilot authenticated" -ForegroundColor Green
}

# --- Install Agent Console ---
Write-Host ""
Write-Host "  Installing Copilot Agent Console..." -ForegroundColor Yellow

$installed = $false
$pipx = Get-Command pipx -ErrorAction SilentlyContinue
if ($pipx) {
    pipx install --force $WHL_URL 2>&1 | ForEach-Object {
        $line = $_.ToString().Trim()
        if ($line -ne '' -and $line -notmatch 'symlink|These apps') {
            Write-Host "  $line" -ForegroundColor DarkGray
        }
    }
    if ($LASTEXITCODE -eq 0) {
        $installed = $true
    } else {
        Write-Host "  [WARN] pipx install failed, using pip instead..." -ForegroundColor Yellow
    }
} else {
    Write-Host "  [WARN] pipx not found, using pip instead." -ForegroundColor Yellow
}
if (-not $installed) {
    pip install --user --no-cache-dir --ignore-installed $WHL_URL 2>&1 | ForEach-Object {
        $line = $_.ToString()
        if ($line -match 'Downloading.*copilot.agent.console|Installing collected') {
            Write-Host "  $line" -ForegroundColor DarkGray
        }
    }
    if ($LASTEXITCODE -eq 0) {
        $installed = $true
    } else {
        Write-Host "  [ERROR] pip install failed (exit code $LASTEXITCODE)." -ForegroundColor Red
        Write-Host "     Try running as Administrator:" -ForegroundColor Yellow
        Write-Host "     pip install $WHL_URL" -ForegroundColor Yellow
    }
}
if (-not $installed) {
    exit 1
}

# --- Verify ---
$ac = Get-Command agentconsole -ErrorAction SilentlyContinue
if (-not $ac) {
    # pip --user installs to user Scripts dir - find and add to PATH
    $userScripts = $null
    try {
        $userScripts = (python -c "import sysconfig; print(sysconfig.get_path('scripts', 'nt_user'))" 2>&1).Trim()
    } catch { }
    # Fallback: check common location
    if (-not $userScripts -or -not (Test-Path $userScripts)) {
        $pyVer = (python -c "import sys; print(f'Python{sys.version_info.major}{sys.version_info.minor}')" 2>&1).Trim()
        $userScripts = "$env:APPDATA\Python\$pyVer\Scripts"
    }
    if (Test-Path "$userScripts\agentconsole.exe") {
        $currentPath = [Environment]::GetEnvironmentVariable('Path', 'User')
        if ($currentPath -notlike "*$userScripts*") {
            [Environment]::SetEnvironmentVariable('Path', "$currentPath;$userScripts", 'User')
            Write-Host "  [OK] Added to PATH: $userScripts" -ForegroundColor Green
            Write-Host "  [NOTE] Restart your terminal for PATH to take effect." -ForegroundColor Yellow
        }
        $env:Path = "$env:Path;$userScripts"
        $ac = Get-Command agentconsole -ErrorAction SilentlyContinue
    }
}
if ($ac) {
    $acVer = (agentconsole --version 2>&1)
    Write-Host "  [OK] $acVer" -ForegroundColor Green
} else {
    Write-Host "  [OK] Installed" -ForegroundColor Green
    Write-Host "  [NOTE] Restart your terminal, then run 'agentconsole'." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "  Ready! Run 'agentconsole' to start." -ForegroundColor Cyan
Write-Host ""
