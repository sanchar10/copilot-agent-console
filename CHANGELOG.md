# Changelog

## v0.9.1

### Release Summary

Patch release with four post-v0.9.0 hotfixes — the most consequential being the **silent enqueue regression** introduced by the SDK 1.0.0b2 migration, where rapid-fire queued messages were dropped instead of being processed in order. Also tightens chat UX (transient Intent rows no longer pollute persisted history; ask_user/elicitation cards auto-scroll into view) and brings `uv.lock` back into agreement with `pyproject.toml`'s declared dependency pins (lockfile drift carried over from v0.9.0).

### 🐛 Fixes

- **Silent enqueue regression** — `app/services/copilot_service.py` was still calling `session.send({prompt, mode})` with a positional dict at the `/enqueue` site, missing the v0.9.0 SDK 1.0.0b2 kwargs migration that was applied at the `/messages` site. The SDK treated the dict as the prompt string and defaulted `mode=None` (immediate), causing rapid-fire queued messages to be silently dropped or coalesced server-side. Now passes prompt as positional and mode/attachments as kwargs to match `CopilotSession.send(prompt, *, attachments=None, mode=None)`. Existing test strengthened from `assert_awaited_once()` to exact call-signature assertion, plus a new regression test on the attachments path that would have caught this in v0.9.0.
- **Bare 'Intent' step rows hidden from chat** — Intent is a transient streaming-only signal that was leaking into the persisted step list and adding visual noise. New generic `hideStepsByTitle` filter in `frontend/src/utils/stepFilter.ts` with `HIDDEN_STEP_TITLES = ['Intent']` chained after the existing `hideStepsByToolName` filter, applied uniformly in `StreamingMessage` (live), `MessageBubble` (persisted), and `mobileStepParser` (mobile parity).
- **Auto-scroll follows ask_user/elicitation cards** — `frontend/src/components/chat/ChatPane.tsx` auto-scroll effect previously only depended on streaming text and tool steps, so the viewport did not follow when a card appeared below the fold mid-turn. Effect deps now include `pendingAskUserForSession`, `pendingElicitationForSession`, and `resolvedElicitationsForSession` so the chat pane scrolls to keep the active prompt visible.

### 🧹 Chores

- **Stale SDK version reference refreshed** — `app/services/session_client.py` `list_mcp_servers` docstring now reads "SDK 1.0.0b2" instead of "SDK 0.3.0". Behavior unchanged: the `MCPServerList` wrapper still exists in 1.0.0b2 (`rpc.py:4567`), so normalization logic remains correct.
- **`uv.lock` synced to declared pins** — committed lockfile previously had `agent-framework==1.0.0rc2` while `pyproject.toml` declared `agent-framework==1.3.0` (latent inconsistency carried over from v0.9.0). Lock now matches pyproject; transitive AF/Azure packages updated accordingly. Verified via `uv sync` clean and app import smoke check.

## v0.9.0

### Release Summary

Major release driven by a coordinated upgrade of the entire **GitHub Copilot SDK + Agent Framework** stack — the previous v0.8.x train shipped a hidden incompatibility that disabled the workflow engine on every install (see Fixes below). This release also fixes a silent failure in automation runs on machines without a CLI default model, makes `agent.model` properly optional throughout the stack, simplifies the `/help` cache to be installer-driven, replaces the cold-start exponential retry with snappier linear polling, and makes the production browser-open fire exactly when the server is ready instead of after a fixed wait.

### 🔥 Critical fix

- **Workflow engine no longer disabled by SDK pin mismatch** — v0.8.x pinned `github-copilot-sdk==0.3.0` but `agent-framework-github-copilot==1.0.0b260225` hard-pinned `github-copilot-sdk==0.2.1`. pip installed both, but at runtime AF GHCP detected the mismatch and printed *"agent_framework_github_copilot not compatible with installed copilot SDK. Workflow engine will be unavailable."* — silently disabling all workflows for every v0.8.x user. The full SDK+AF stack is now bumped in lockstep so the dependency graph is consistent: `github-copilot-sdk 0.3.0 → 1.0.0b2`, `agent-framework rc2 → 1.3.0`, `agent-framework-github-copilot b260225 → b260507`, `agent-framework-declarative b260219 → b260507`. AF GHCP `1.0.0b260507` hard-pins `github-copilot-sdk==1.0.0b2`, matching our declaration.

### 🐛 Fixes

- **Automation no-output bug** — `app/services/task_runner_service.py` now resolves `(model, reasoning_effort)` via the new `model_resolver.resolve_agent_model()` helper before launching the session. Previously, an empty string `model` flowed through to the SDK, which treated it as falsy and silently omitted the field from the JSON-RPC payload — leaving the CLI to fall back to its own internal default (which doesn't exist on a fresh machine). Affected the seeded **Daily Tech Brief** automation, plus any "Run Now" from an agent without an explicit model.
- **Loud failure when no model resolvable** — if the agent has no model AND `settings.default_model` is empty, the run is marked `FAILED` with a clear error in `TaskRun.error` and an `ERROR`-level server log: *"No model configured. Agent 'X' has no model and no default_model is set. Configure one in Settings → Default Model."*
- **AgentEditor no longer corrupts saved agents** — `frontend/src/components/agents/AgentEditor.tsx` no longer pre-fills the model field with the current app default on load. Previously, opening any model-less agent and clicking Save would write the live default into the JSON, freezing it against settings changes.
- **Seeded `morning-tech-brief.json`** — dropped the empty `"model": ""` line that triggered the bug for new installs.
- **`/help` works in unactivated session panes** — typing `/help [question]` in a brand-new session pane (before the session is created on the server) now renders the loading bubble and answer in-place. When the user then sends their first real message, the help Q&A is migrated seamlessly into the new session's history. Powered by a `NEW_SESSION_KEY` sentinel in `chatStore` and a race-immune `updateMessageEverywhere` helper that finds the bubble by id regardless of which session key currently holds it.
- **`/help` cache survives app upgrades cleanly** — the previous in-app version-pinning logic in `help_service.py` is replaced by an installer-driven cleanup. `scripts/install.sh` and `scripts/install.ps1` now strip `help_session_id` from `~/.copilot-console/settings.json` on every install/upgrade, so a fresh `/help` session is always created against the current CLI/SDK. Single source of truth, no in-app version checks.
- **Cold-start "server unreachable" toast clears on reconnect** — `frontend/src/api/events.ts` SSE `open` handler now dismisses the `'server-down'` toast immediately when the channel reconnects, instead of letting it linger for its full 5-second duration. Affects both backend restart and initial cold start.

### ✨ Changes

- **`agent.model` is now optional** — schema (`app/models/agent.py`), TypeScript types (`frontend/src/types/agent.ts`), and storage (`agent_storage_service.save_agent` uses `exclude_none=True`) all treat absence as legitimate. None means "use the app default model from Settings at runtime."
- **Back-compat for legacy JSON** — pydantic `field_validator` coerces existing `"model": ""` to `None` on load. No on-disk migration needed.
- **AgentEditor adds "Use app default" toggle** — checkbox above the model selector that maps to `(model=null, reasoning_effort=null)`. Reasoning effort stays atomic with model: agent's effort with agent's model, settings' effort with settings' model, never crossed.
- **`workflow_engine.py` simplified ~5x** — Patch 2 (`_tool_to_copilot_tool` override) and the `kwargs`-rewrap shim are no longer needed against AF 1.3.0 / GHCP b260507 and have been removed (218 → 41 line diff). `docs/guides/AF_SDK_PATCHES.md` updated to mark Patch 2 as Removed and document the kwargs hotfix history. Workflow engine init also goes through the model resolver; on failure it logs an error but doesn't crash (degraded fallback).
- **Frontend cold-start retry is snappier** — `frontend/src/utils/retry.ts` now supports a `maxDelayMs` cap (default `Infinity`, backward compatible). `Sidebar.tsx` and `viewedStore.ts` use `{maxAttempts: 8, initialDelayMs: 2000, maxDelayMs: 2000}` → linear 2-second polling with a 14-second budget. Old config (`{maxAttempts: 4, initialDelayMs: 2000}`) had 2s/4s/8s exponential delays, so a server ready at t=7s could leave the UI waiting until t=14s. New config snaps to ready within 2s of backend availability — meaningful for `--expose` cold starts.
- **Browser auto-open fires exactly when ready** — `cli.py` no longer schedules a daemon `Timer` thread with an 8s readiness probe. Instead, it sets `COPILOT_OPEN_BROWSER_URL` in env, and the FastAPI lifespan in `app/main.py` calls `webbrowser.open()` immediately after the "Copilot Console started successfully" log. Removes both the up-to-8s open delay on slow startups and the "open against not-yet-ready server" race.
- **AF "experimental feature" warnings suppressed at import** — benign `ExperimentalWarning` from `agent_framework` (HARNESS / SKILLS) suppressed at the package `__init__` so the server console stays clean. Same precedent as the OTEL `Failed to detach context` filter.

### 🧪 Tests

- New `tests/test_model_resolver.py` (6 tests): agent-pair preserved, fallback to settings, empty-string coercion, hard-fail when nothing resolvable.
- New `TestAgentModelOptional` class in `tests/test_agents.py` (5 tests): None model round-trips, legacy `""` loads as None, `save_agent` omits the key from disk.
- New `tests/test_session_service_reasoning_effort.py`: reasoning-effort atomicity with model selection.
- New `updateMessageEverywhere` tests in `frontend/src/stores/chatStore.test.ts` (3 tests): patches across sessions, finds messages after sentinel→real-id migration, no-op on missing id.
- Frontend retry config update verified by running all 394 frontend tests; backend test suite (656 tests) green after each backend change.

### ⬆️ Dependency upgrades

- `github-copilot-sdk`: `0.3.0` → `1.0.0b2`
- `agent-framework`: `1.0.0rc2` → `1.3.0`
- `agent-framework-github-copilot`: `1.0.0b260225` → `1.0.0b260507`
- `agent-framework-declarative`: `1.0.0b260219` → `1.0.0b260507`

---

## v0.8.7

### Release Summary

Citation pipeline overhaul. File / folder references in chat messages are now reliably detected, classified per-platform (Windows / POSIX / macOS), and resolved against the right working directory on click — including for `/help` responses, which now route through the help agent's `docs/` cwd. Plain-text references (no markdown link wrapping), nested markdown like `<span>`-wrapped text, and edge cases such as `/etc/hosts`, `/Users/me/Documents`, and `workspace\folder-name` all work. False positives on prose like `if/else`, `application/json`, `3/4`, and regex escapes (`\d`, `\n`) have been eliminated.

### 🐛 Fixes

- **File citations now work for plain-text paths** — `frontend/src/utils/citation.tsx` introduces a strict per-platform scanner regex (Windows / UNC / POSIX-sysroot / POSIX-with-extension / `~/path` / Windows-relative / POSIX-relative-with-ext / bare filename). Previously only markdown-linked paths were detected.
- **Recursive scanner walks into `<span>`, `<em>` etc.** — `processChildrenForCitations` no longer skips text wrapped in inline elements.
- **`/etc/hosts`, `/usr/bin/ls`, `/Users/me/Documents` etc. now classify as files** — added POSIX system-root allowlist (Linux + macOS roots: `Users`, `Applications`, `Library`, `System`, `Volumes`, `private`).
- **Help responses resolve under `docs/`** — `MessageBubble` wraps help messages in an inner `CitationProvider` keyed on `helpSessionId` so the help agent's cwd is used instead of the chat session's cwd.
- **Server-side resolution endpoint** (`src/copilot_console/app/routers/filesystem.py`) — 4-tier precedence: web URL → 400, absolute path → open if exists, relative + session cwd → join, else 404 with toast.
- **No more clickable false positives** — `if/else`, `application/json`, `Read/write`, `true/false`, `3/4`, `16/9`, `\d`, `\n`, `www.example.com/page/article` all stay plain text.
- **Removed legacy `processFileLinks.tsx`** — replaced by the consolidated `citation.tsx`.

### ⚠️ Known Limitations

- **Single-segment relative folders** in plain text (e.g. `Desktop/`, `Documents/`) are not auto-detected — indistinguishable from prose like `etc/`, `or/`. Workaround: use absolute path or wrap in markdown link.
- **CommonMark backslash escapes** — paths like `C:\Users\sandee\.copilot\…` get the `\.` stripped by the CommonMark parser. LLM-side issue; out of scope.

---

## v0.8.6

### Release Summary

Hotfix: the published v0.8.5 wheel was missing all `.md` files under `seed/copilot-console/docs/` because hatchling honors `.gitignore` (the synced docs are gitignored — they're regenerated by `scripts/sync-seed-docs.js` at build time). With no FAQ on disk, the in-app `/help` agent had nothing to ground on and answered from training-data guesses about Copilot CLI instead of Copilot Console.

### 🐛 Fixes

- **`/help` no longer hallucinates** — `pyproject.toml` now uses `[tool.hatch.build.targets.wheel].artifacts` to force-include `src/copilot_console/seed/copilot-console/docs/**/*.md` in the wheel, despite the `.gitignore` entry. Verified by inspecting the published wheel before/after.
- **Existing v0.8.5 installs auto-heal on upgrade** — the seeder re-syncs docs whenever `seed_version` differs from app version, so bumping to 0.8.6 triggers a one-time docs refresh on next launch.

---

## v0.8.5

### Release Summary

v0.8.5 ships the in-app **`/help` slash command** backed by a hand-validated **FAQ.md** that the help agent reads first, plus a global **Cmd/Ctrl+K SearchModal** for cross-session search. It pins **`github-copilot-sdk==0.3.0`** so SDK changes can't break the build mid-week, and tightens dozens of UX details across MCP, sub-agents, mobile, and chat. Sessions whose history can no longer be loaded by the Copilot CLI now show a clear **"⚠ Session history unavailable"** banner with a one-line CLI-fallback recovery instead of a silent blank pane. The offline-detection layer was removed in favor of a simpler server-truth-only model.

---

### ✨ Features

#### `/help` & Documentation
- **`/help` slash command** — opens a dedicated help session backed by a `help-assistant` agent that reads `docs/guides/FAQ.md` first, then the per-feature guides shipped under `~/.copilot-console/docs/`
- **`docs/guides/FAQ.md`** — new, hand-validated FAQ covering sessions, agents, models, MCP, custom tools, workflows, automations, mobile, special cards, settings, and error banners. Every answer was code-validated against the implementation.
- **WORKFLOWS.md merge** — duplicate `docs/Workflows.md` removed; single source of truth at `docs/guides/WORKFLOWS.md`

#### Global Search & Layout
- **Cmd/Ctrl+K SearchModal** — fast cross-session search from anywhere
- **Global banner system** — unified surface for sticky cross-session notices

#### MCP Servers — Full UI Control
- **New MCP Servers settings tab** — create, edit, enable/disable, and delete MCP servers without editing config files
- **Canonical-source backend** — single source of truth for MCP server config; settings endpoint exposes per-server enabled state
- **Auto-enable defaults** — sensible servers are turned on out of the box for new installs
- **Reset OAuth button** — one-click recovery from stale OAuth tokens (e.g. EACCES port collisions) without manually deleting `~/.copilot/mcp-oauth-config/`
- **Persistent per-server OAuth status badge** in the MCP picker — click a failed badge to re-trigger sign-in
- **Cold-only OAuth readiness gate** — sessions only block on OAuth when servers actually need it
- **Global OAuth event bus + sticky toasts** — sign-in prompts persist across tab switches and survive reloads
- **MCP picker UX** — shortened "app" / "App" labels, tighter badge slots, persistent connection dot

#### Agent Framework Workflows
- **AF declarative features exposed** — Human-in-the-Loop, TryCatch nodes, PowerFx guard expressions, YAML overlay visualization, event styling
- **AF-GHCP / SDK 0.3.0 shim** — keeps the Agent Framework working against the latest Copilot SDK
- **Seed workflow rename** — `feature-tour` → `mood-topic-poem`, `feature-tour-advanced` → `workflow-feature-advanced`; new `backend-feature-kickoff.yaml` seed
- **Removed `emoji-poem` workflow + Emoji Illustrator agent** from seed data
- **WorkflowEditor + WorkflowRunView upgrades** — sticky failure toasts, run timeline polish
- **PowerFx guard tests + visualize overlay tests**

#### Sessions & Sub-Agents
- **Model + agent picker refinements** — clearer sub-agent enablement flow; agents added via the Sub-Agents picker now appear in `/agent`
- **Session-history-unavailable banner** — when the Copilot CLI's `session resume` rejects a session.jsonl (typically written by an older CLI build), an in-chat amber banner explains the cause and points to `copilot --resume <id>` as a CLI-side workaround. No more silent blank panes.

#### Mobile Companion
- **SSE handling fixes** — robust reconnect on backgrounding/network changes
- **OAuth + network state alignment** — mobile no longer races the desktop on auth state

#### Chat & Messages
- **Better loading UX** — Session/Context message tooltips
- **MessageBubble polish** — long system messages wrap instead of overflowing; thinner system divider ticks give text more width
- **Sub-agent events surfaced as chat steps** — `subagent.started/completed/failed` now appear in the chat timeline
- **Toast UX** — distinct error icon, no auto-dismiss on body click

#### Slash Commands & UX
- **`/compact` simplified** — Phase 5 cleanup; MCP gate skipped when no servers configured
- **Reasoning text from SDK** — uses native `reasoning_text` field; dropped legacy system_notification filter

---

### 🧹 Removed

- **Offline-detection layer** — `useNetworkStatus`, `network_probe.py`, `health.py` router, offline banner, and store wiring are gone (~210 LOC removed). The app now trusts the server as the source of truth for connectivity, which is simpler and more accurate than client-side probing.
- **`approve_all_permissions` try/except shim** — no longer needed against current SDK
- **`emoji-poem` workflow + Emoji Illustrator seed agent**
- **Duplicate `docs/Workflows.md`** — content merged into `docs/guides/WORKFLOWS.md`

---

### 🔒 Pinning

- **`github-copilot-sdk==0.3.0`** — pinned exactly so SDK API changes can't silently break a release. Bump deliberately when validating against a new SDK.
- **Bundled CLI** — the SDK ships with its own bundled Copilot CLI; `npm install -g @github/copilot` in the installers remains unpinned (latest is fine).

---

### 🐛 Bug Fixes

- **Installer (Windows): CLI version display** — `install.ps1` no longer prints the entire version line when the regex doesn't match; falls back to `"unknown"` cleanly
- **Installer (Windows): no longer kills the host PowerShell session on error** — `install.ps1` now uses `throw` instead of `exit 1`, so when invoked via `irm | iex` from an interactive prompt the user is returned to the prompt with the error message instead of having the entire `powershell` window close
- **Workflow engine: fresh installs failed with `'WorkflowCopilotAgent' object has no attribute called 'run'`** — root cause: `agent-framework` and its `github-copilot` / `declarative` plugins were hidden behind a `[workflows]` extra that the installer scripts never enabled, so fresh `pipx install` runs got no AF at all. For users who had AF cached from prior installs, the unconstrained `>=1.0.0rc2` floated up to AF 1.2.x where `BaseContextProvider` was renamed `ContextProvider` — old AF-GHCP `b260225` raises `ImportError`, the workflow engine's `except ImportError` substitutes a stub `GitHubCopilotAgent` with no `.run()` method, and AF's declarative runner crashes calling `.run()`. Fix: promoted the three packages to base `dependencies` and pinned to the exact known-good versions (`agent-framework==1.0.0rc2`, `agent-framework-github-copilot==1.0.0b260225`, `agent-framework-declarative==1.0.0b260219`) so fresh installs always get a coherent set. Newer AF-GHCP releases (`b260311`–`b260429`) hard-pin `github-copilot-sdk==0.2.1` and are incompatible with our `github-copilot-sdk==0.3.0` requirement, so a forward-jump is not currently viable.
- **Auth status: Disconnect appeared to do nothing on machines with `gh` CLI logged in** — `/auth/status` was checking the SDK first and falling back to `gh auth status`. `gh`'s token (`~/.config/gh/`) is unrelated to the Copilot SDK's token (`~/.copilot/`), so a stale `gh` login produced false-positive `authenticated: true` responses. After clicking Disconnect (or `copilot logout` from another terminal), the backend correctly removed the Copilot token but `/auth/status` still returned `true` via the gh fallback, so the UI never refreshed. Fix: removed the `gh` fallback — auth status now reports exactly what the Copilot SDK reports, which is the only source that matches what the app can actually do.
- **Settings → Authentication: signed-in username didn't appear until after clicking Disconnect** — `/auth/status` returns `{ login: ... }` but the frontend store uses `username`. Sidebar's startup fetch copied the response straight into the store (TypeScript cast hid the mismatch), so `username` ended up undefined and the parenthesised display name was hidden. SettingsModal's own refresh path translated correctly, which is why the username only appeared *after* clicking Disconnect (which triggered SettingsModal's refresh). Fix: introduced a single `getAuthStatus()` helper (`api/auth.ts`) that owns the wire→store translation; both Sidebar and SettingsModal now use it.
- **New: cold-start auth heads-up toast** — when the app loads and the user is not signed in, a single auto-closing warning toast points at Settings (replaces the previous silent failure when the user later tried a workflow / chat).
- **MCP OAuth recovery** — picker badges now reflect real server state; click-to-retrigger works without a session restart
- **Mobile SSE/OAuth races** — fixed inconsistent state on resume from background

---

### 🧪 Tests

- MCP OAuth coordinator + retrigger endpoint + selector badges
- EventBus pub/sub, replay buffer, slow-subscriber drop
- PowerFx guard + workflow visualize overlay
- `/help` service: FAQ.md priority + fallback to guides

---

### 📦 Installation

```powershell
# Windows (PowerShell)
irm https://raw.githubusercontent.com/sanchar10/copilot-console/main/scripts/install.ps1 | iex
```

```bash
# macOS / Linux (Bash)
curl -fsSL https://raw.githubusercontent.com/sanchar10/copilot-console/main/scripts/install.sh | bash
```

```powershell
# Or manual install with pipx
pipx install --force https://github.com/sanchar10/copilot-console/releases/download/v0.8.5/copilot_console-0.8.5-py3-none-any.whl
```

---

## v0.8.1 (2026-04-21)

### 🐛 Bug Fixes

- **Model listing resilience** — raw RPC fallback when SDK `list_models()` fails due to server-side API changes (ModelBilling schema)
- **Updated default models** — fallback list now includes gpt-4.1, gpt-5.2, gpt-5-mini, claude-sonnet-4.5, claude-opus-4.5, claude-haiku-4.5
- **UTF-8 encoding** — all JSON file operations now specify `encoding="utf-8"` to prevent Windows cp1252 crashes
- **Resume stream callbacks** — `onElicitation` and `onAskUser` now wired in `resumeResponseStream` for tab-close/refresh recovery
- **Release build** — workflow uses root `npm run build` to include `sync-seed-docs` step

---

### 📦 Installation

```powershell
# One-line installer (recommended)
irm https://raw.githubusercontent.com/sanchar10/copilot-console/main/scripts/install.ps1 | iex

# Or manual install with pipx
pipx install --force https://github.com/sanchar10/copilot-console/releases/download/v0.8.1/copilot_console-0.8.1-py3-none-any.whl
```

---

## v0.8.0 (2026-04-20)

### Release Summary

v0.8.0 brings **slash commands, unified session settings, and project-aware sessions**. The `/agent` slash command lets you pick an agent persona before or during a session. `/compact` now works seamlessly across new, resumed, and active sessions. When you filter the sidebar by project, new sessions automatically start in that project's folder — with a toast confirming the working directory.

---

### ✨ Features

#### Slash Commands & Session Settings
- **Two-level `/agent` picker** — browse agents by source, select and change the agent persona for the session; works on new and active sessions
- **Unified session settings matrix** — `/compact` and `/agent` persist to `session.json` and work correctly across new, resumed, and active session lifecycles
- **Deferred compact with SSE events** — compact runs post-first-turn with step events streamed to the UI

#### Chat & Messages
- **Timestamps on chat messages** — each message header shows a right-aligned timestamp; `event_id` propagated through the event pipeline
- **Server-confirmed agent names** — agent switch messages use the name returned by the server, with error handling if missing

#### Project-Aware New Sessions
- **New sessions use project folder** — when the sidebar project filter is set to a specific project, "New Session" uses that project's folder as CWD instead of the default
- **Folder existence validation** — checks the project folder via browse endpoint before use; falls back to default with a warning toast if the folder is missing
- **Multi-line info toast** — shows session working directory, project name, and full folder path

---

### 🐛 Bug Fixes

- Fix slash command palette height and dark background contrast (`#2f2f45`)
- Fix duplicate agent switch messages on resumed sessions
- Fix agent selection with `'default'` sentinel and case-insensitive guard
- Fix mode indicator reading from `session.json` on tab reopen
- Fix model switching on resumed sessions via `rpc.model.switch_to()`
- Fix model persistence to `session.json` for resumed sessions
- Remove duplicate compact UI messages; drain SDK events post-compact
- Fix compact error logging at warning level for server visibility
- Remove toast notification for `/agent` on new session (avoids premature toast)
- Right-align timestamps in chat message headers

---

### 📖 Documentation

- Update marketing page: slash commands section with `/agent` picker screenshot, side-by-side layout
- Update README feature table for slash commands
- Add slash command & session settings architecture spec

---

### 📦 Installation

```powershell
# One-line installer (recommended)
irm https://raw.githubusercontent.com/sanchar10/copilot-console/main/scripts/install.ps1 | iex

# Or manual install with pipx
pipx install --force https://github.com/sanchar10/copilot-console/releases/download/v0.8.0/copilot_console-0.8.0-py3-none-any.whl
```

See [README](https://github.com/sanchar10/copilot-console#readme) for full setup instructions.

---

## v0.7.0 (2026-04-15)

### Release Summary

v0.7.0 is a substantial release focused on **interactive agent input, mobile parity, macOS support, and auth overhaul**. This version introduces ask_user and elicitation—powerful mechanisms that let agents ask you structured questions mid-conversation without interrupting your workflow. On the platform side, we've unified the mobile and desktop experiences, redesigned settings with a tabbed layout, stabilized auth detection across providers, and added comprehensive macOS/Linux support.

---

### ✨ Features

#### Interactive Agent Input (ask_user & elicitation)
- **Add ask_user support end-to-end** — Agents can now send simple text questions with Submit/Skip UX
- **Add MCP elicitation support** — Rich structured input via JSON schema (text fields, dropdowns, checkboxes, required field validation)
- **Add desktop notifications for input requests** — Users are alerted when agents ask a question (includes session tab open action)
- **Render markdown in question messages** — Question text supports bold, italic, and code formatting
- **Preserve ask_user/elicitation Futures on reconnect** — Pending questions are restored when you reconnect; interact with them to resume
- **Add ElicitationCard and ResolvedElicitationCard components** — Styled cards for rendering and tracking input state

#### Auth & Security
- **Auth overhaul with 3-source fallback** — SDK auth → functional probe → `gh auth status` CLI fallback. No more false "not authenticated" for users who authenticated via `gh auth login`
- **Fix Windows subprocess crash** — Replace `asyncio.create_subprocess_exec` (broken on Windows + Python 3.14) with `subprocess.run` via `asyncio.to_thread`
- **Auth status shows provider and username** — Settings displays "GitHub Copilot (username)" instead of generic "Connected"
- **Provider-agnostic auth terms** — "Connect" / "Disconnect" instead of "Sign in" / "Sign out" (future multi-provider ready)

#### Settings Redesign
- **4-tab settings modal** — Authentication, General, Mobile, Notifications tabs with deep-linking
- **Sidebar lock icon** — Inline 🔒/🔓 emoji after Settings text shows auth status at a glance
- **CLI notifications moved to Notifications tab** — Previously in Mobile tab; now grouped with Registered Devices
- **Auth tab shows inline lock icons** — Emoji locks matching sidebar for visual consistency

#### "Open with" Session Folder
- **Add "Open with" dropdown** — Open session folder in VS Code, Terminal, or Explorer from the sidebar
- **Fix VS Code shell launch** — Use shell=True on Windows for proper shell integration
- **Fix terminal launch on Windows** — Use CREATE_NEW_CONSOLE instead of deprecated cmd start
- **Fix PowerShell compatibility** — Sessions folder opens correctly in PowerShell

#### Agent Management
- **Priority-based agent dedup and sectioned dropdown** — Multiple agents of the same type are deduplicated; sub-agents are organized by section (Copilot, Custom, Workspace)
- **Unified agent discovery across 4 sources** — Agents from CLI config, workspace, npm scripts, and Copilot SDK are unified with priority-based dedup

#### Audio & Notifications
- **Add audio tones for events** — Configurable notification sounds
- **Add desktop notifications for agent responses** — Alerts when agents complete work (in addition to input requests)

#### Code Blocks & UI Polish
- **Add copy button on code blocks with language label** — Easy code sharing; shows syntax language
- **Compact input box height** — Streamlined input UX with adjusted button icons
- **Show live intent + bouncing dots in input box during streaming** — Visual feedback while agent is thinking
- **Render ask_user/elicitation as styled Q&A in steps** — Interactive questions appear as polished cards with dividers

---

### 🐛 Bug Fixes

#### Frontend State & Connectivity
- **Fix race condition in resolve_elicitation** — Prevent duplicate future pop crashes
- **Fix mobile duplicate streaming** — Abort POST /messages reader to prevent message re-send on reconnect
- **Fix mobile stuck streaming state on resume** — Properly clear streaming lock after reconnect
- **Fix mobile response-status field name mismatch** — Align API field names with state machine expectations
- **Fix stale agent badge count and CWD change confirmation** — Session counts update correctly when working directory changes

#### ask_user/elicitation Lifecycle
- **Cancel pending interactions on disconnect/reconnect** — Clean up futures to prevent stale card renders
- **Clear ask_user/elicitation cards on desktop abort** — Dismiss cards when you abort a session
- **Clear pending ask_user/elicitation on mobile abort** — Mobile cleanup matches desktop behavior
- **Fix ask_user Skip to send cancel signal** — Skip button matches CLI Esc behavior (sends cancellation)
- **Disable mobile textarea during pending ask_user/elicitation** — Prevent accidental input while agent awaits response
- **Gray background for mobile input during pending interaction** — Visual indicator that input is temporarily disabled
- **Fix mobile ask_user/elicitation using mobileApiClient** — Use correct client for interaction endpoints

#### Mobile UX & Rendering
- **Fix mobile enqueue state**: Clear sending lock on first SSE event, allow send during streaming
- **Auto-expand steps accordion while streaming on mobile** — Steps are visible as agent works
- **Improve mobile step parser** — Cleaner tool summaries, no raw JSON fragments in output
- **Move StepsAccordion border to bottom** — Separator between steps and content for clarity
- **Move mobile steps above content** — Match desktop step ordering
- **Trim leading whitespace from mobile message content** — Cleaner text rendering
- **Distinguish intentional abort from stream errors** — Proper error messaging on mobile
- **Fix notification click to open session tab** — Even if tab is closed, notification reopens it
- **Fix mobile input during streaming** — 3-state design with activation, thinking, and enqueue support

#### Elicitation/ask_user Internals
- **Fix missing @router decorator on send_message endpoint** — Backend routing error fixed
- **Fix ChatPane test mock for elicitation state** — Test infrastructure updated
- **Update _pending_elicitations refs after service split** — Use ElicitationManager correctly after refactoring
- **Remove redundant cancel_pending_elicitations calls** — Eliminate duplicate cancellation logic
- **Remove leftover .bak file** — Cleanup temporary file
- **Fix turn boundary for streaming** — Use assistant.turn_end instead of assistant.message

#### Error Handling & Toast System
- **Fix contextual error messages** — Error messages are now informative and actionable
- **Fix file upload toast** — User feedback on upload state changes
- **Add toast system + self-healing sub-agent cleanup** — Automatic cleanup on working directory change

#### Session Management
- **Mark session viewed after abort** — Prevent false unread indicator
- **Mark session ready on active response reconnect** — Session state is accurate on resume
- **Move markViewed to active-agents completion callback** — Centralized view tracking

#### Utilities & Dependencies
- **Remove unused common/Select.tsx** — Replaced by custom Dropdown component (no loss of functionality)

---

### ♻️ Refactoring

#### Frontend Architecture (Stage 3)
- **Extract SSE parser to shared utility** — `utils/sseParser.ts` eliminates 3× copy-paste parsing code
- **Deduplicate ChatStep definition** — Single canonical definition in `types/message.ts`; re-exports elsewhere
- **Decompose InputBox.tsx** — Extract `useFileUpload` and `useSlashCommands` hooks (834 → 429 lines)
- **Decompose ChatPane.tsx** — Extract PinsDrawer and utilities (818 → 588 lines)
- **Add exponential-backoff reconnection** — Robust retry logic for active-agent subscriptions

#### Backend Architecture (Stage 2)
- **Backend service restructuring** — Modularize copilot_service.py into focused, testable units

#### Component Cleanup
- **Migrate all native select elements to custom Dropdown** — Consistent, keyboard-accessible dropdown UX
- **Replace sidebar project list native select with Dropdown** — Unified component everywhere

#### TypeScript Strict Mode
- **Resolve 6 pre-existing TypeScript strict errors** — Clean strict:true compilation

---

### 📱 Mobile

#### Input & Interaction
- **Mobile ask_user and elicitation support** — Full parity with desktop; cards render responsively
- **Mobile input: pulsating dots + "Thinking..." with amber background** — Visual feedback while agent streams
- **Remove redundant chat area pulsating dots on mobile** — Single clear indicator
- **Disable mobile textarea during pending ask_user/elicitation** — User-friendly state blocking

#### Streaming & State
- **Fix mobile duplicate streaming by aborting POST /messages reader** — Prevent re-sends
- **Fix mobile stuck streaming state on resume stream error** — Proper error recovery
- **Mobile input: 3-state design with activation, thinking, and enqueue** — Smooth state transitions
- **Fix mobile enqueue: clear sending lock on first SSE event** — Allow send during streaming

#### Step Rendering
- **Auto-expand steps accordion while streaming** — Real-time visibility
- **Improve mobile step parser** — Cleaner summaries, no JSON fragments
- **Move StepsAccordion border and mobile steps above content** — Better UX order
- **Trim leading whitespace from mobile message content** — Polished output

#### Reconnect & Cleanup
- **Restore ask_user card on reconnect via response-status pending_input** — Pending questions are preserved
- **Revert cancel-on-navigate experiments, keep clean mobile state** — Stable cancel logic
- **Switch mobile cancel from sendBeacon to fetch with keepalive** — Reliable cancellation

---

### 🏗️ Architecture

#### Core Refactoring
- **Stage 3 frontend restructuring** — SSE parser consolidation, ChatStep dedup, component decomposition
- **Stage 2 backend restructuring** — Modular service design with clear boundaries

#### Revert & Stabilization
- **Revert system CLI override, use SDK-bundled CLI only** — Simplify dependency management
- **Revert unnecessary replay changes** — Keep clean state machine transitions
- **Revert desktop to original step rendering** — Mobile has dedicated parser; desktop unchanged
- **Migrate desktop MessageBubble to shared stepParser** — Shared logic, desktop behavior preserved

#### Code Cleanup
- **Clean up dead ask_user/elicitation code** — Remove obsolete functions and references
- **Migrate desktop MessageBubble to shared stepParser** — Eliminate parser duplication
- **Migrate mobile steps rendering with shared step parser** — Unified parsing across platforms

---

### 📝 Documentation

#### Setup & Contributing
- **Add DEV-SETUP.md for macOS/Linux contributor setup** — Step-by-step guide for setting up development environment on Unix systems
- **Stage 5 — macOS support** — Install script, caffeinate integration, cross-platform messages
- **Add frontend/dist fallback for editable dev installs** — Support development workflow when frontend isn't pre-built

#### Cross-Platform Documentation
- **Remove Windows bias from all docs** — README, INSTALL, CONTRIBUTING now use `shell` fences, forward-slash paths, and platform-neutral language
- **Cross-platform uninstall instructions** — `pip uninstall` (universal) with `pipx` note, plus platform-specific data removal commands
- **ripgrep as required prerequisite** — Moved from optional to required in install docs; labeled "for session content search"
- **Console Guide agent tip** — Added to "First Things to Try" in README
- **Eliminate seed docs duplication** — Seed docs are now build-generated (via `sync-seed-docs.js`), gitignored, and no longer maintained as separate copies

#### Release
- **Add codebase survey documentation** — Orchestration and architecture notes for future maintainers

---

### 🚀 Platform Support

#### macOS/Linux Support
- **Add install.sh for Unix-like systems** — First-class macOS and Linux support
- **Add caffeinate integration** — Prevent sleep during long-running sessions on macOS
- **Add cross-platform messages** — Consistent user-facing text across Windows, macOS, Linux
- **Add DEV-SETUP.md** — Comprehensive development environment guide for macOS/Linux contributors

