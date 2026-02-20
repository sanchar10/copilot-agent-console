# Contributing

For contributors who want to modify the code.

## Prerequisites

- Python 3.10+
- Node.js 18+
- GitHub Copilot CLI 0.0.410+ (see [Manual Installation](INSTALL.md))

## Setup

```powershell
# Clone the repo
git clone https://github.com/sanchar10/copilot-agent-console.git
cd copilot-agent-console

# Install all dependencies (frontend + backend)
npm run setup

# Start in development mode (hot reload for both frontend and backend)
npm run dev
```

- Frontend: http://localhost:5173 (Vite dev server with HMR)
- Backend: http://localhost:8765 (FastAPI with auto-reload)

## Building the Package

```powershell
# Build frontend
npm run build

# Build Python wheel
pip install build
python -m build --wheel

# Output: dist\copilot_agent_console-0.2.0-py3-none-any.whl
```

## Running Tests

```powershell
# Backend tests
python -m pytest

# Frontend tests
npm test --prefix frontend
```

## Architecture

| Layer | Technology |
|---|---|
| Frontend | React, TypeScript, Vite, Tailwind CSS, Zustand |
| Backend | Python, FastAPI, Uvicorn |
| AI Runtime | GitHub Copilot SDK → Copilot CLI |
| Streaming | Server-Sent Events (SSE) |
| Scheduling | APScheduler |
| Storage | JSON files (no database) |
