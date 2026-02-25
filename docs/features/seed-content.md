# Feature: Seed Content

## Summary
Seed content is a set of bundled defaults that ship with Copilot Console. On install or update, the app copies starter agents, tools, MCP configuration, and documentation into the user's home directories so the app is immediately useful out of the box.

## What Gets Seeded

| Content | Seed source | Destination |
|---|---|---|
| Agents | `seed/copilot-console/agents/` | `~/.copilot-console/agents/` |
| Custom tools | `seed/copilot-console/tools/` | `~/.copilot-console/tools/` |
| MCP config | `seed/copilot-console/mcp-config.json.template` | `~/.copilot-console/mcp-config.json` |
| Local MCP servers | `seed/copilot-console/local-mcp-servers/` | `~/.copilot-console/local-mcp-servers/` |
| Documentation | `seed/copilot-console/docs/` | `~/.copilot-console/docs/` |
| Copilot skills | `seed/copilot/skills/` | `~/.copilot/skills/` |

## Directory Layout

Bundled seed content lives in `src/copilot_console/seed/` and mirrors two destination roots:

```
src/copilot_console/seed/
├── copilot-console/           → ~/.copilot-console/
│   ├── agents/              # Starter agent definitions
│   ├── docs/                # App documentation (read by Console Guide agent)
│   ├── local-mcp-servers/   # Bundled MCP server scripts
│   ├── schedules/           # Default automation schedules
│   ├── tools/               # Starter custom tools
│   └── mcp-config.json.template
└── copilot/                 → ~/.copilot/
    └── skills/              # Copilot CLI skills
```

## When Seeding Runs

Seeding runs **once per app version** — on initial install and on each update. The app stores the last seeded version in a metadata file (`~/.copilot-console/metadata.json` → `seed_version` key). If the current app version matches the stored version, seeding is skipped.

Seeding can also be forced programmatically via `seed_bundled_content(force=True)`.

## Sync Behaviors

The two destination roots use different sync strategies:

### `copilot-console/` items → copy-if-missing
Files are copied **only if they don't already exist** at the destination. This preserves any edits the user has made to agents, tools, or config. If a user deletes a seed file, it will be restored on the next version update.

### `copilot/` items → copy-or-update
Files are **always synced** when the version changes — existing files are overwritten if the content differs. The app owns these files and keeps them up to date.

## Template Variable Expansion

Files with a `.template` extension receive variable expansion before being written. The `.template` suffix is stripped from the output filename.

| Variable | Value | Example |
|---|---|---|
| `{{APP_HOME}}` | Path to `~/.copilot-console/` | `C:/Users/me/.copilot-console` |

**Example:** `mcp-config.json.template` containing `{{APP_HOME}}/local-mcp-servers/weather_server.py` is written as `mcp-config.json` with the expanded path.

Agent JSON files that reference app paths (e.g., doc directories) should use the `.template` extension and `{{APP_HOME}}` variable so paths resolve correctly on any machine.

## MCP Config Merging

The seed `mcp-config.json.template` receives special handling: instead of overwriting the destination file, the app **merges** seed servers into the existing `mcp-config.json`.

- New servers (by name) are added
- Existing servers are **not** overwritten — user customizations are preserved
- If no `mcp-config.json` exists, one is created from the template

## How to Add New Seed Content

### Adding a seed agent
1. Create a JSON file in `src/copilot_console/seed/copilot-console/agents/`
2. Follow the agent schema used by existing agents (id, name, icon, description, model, system_message, tools, mcp_servers)
3. If the agent references app paths, use `.json.template` extension and `{{APP_HOME}}` variable
4. The agent will be copied to `~/.copilot-console/agents/` on next install/update (copy-if-missing)

### Adding a seed tool
1. Create a `.py` file in `src/copilot_console/seed/copilot-console/tools/`
2. Export a `TOOL_SPECS` list (see [Custom Tools](../CUSTOM-TOOLS.md))

### Adding an MCP server
1. Add the server entry to `src/copilot_console/seed/copilot-console/mcp-config.json.template`
2. If the server is a local script, place it in `local-mcp-servers/` and reference it with `{{APP_HOME}}`
3. New servers are merged in without affecting existing user config

### Adding documentation
1. Place markdown files in `src/copilot_console/seed/copilot-console/docs/`
2. These are copied to `~/.copilot-console/docs/` and can be read by agents like Console Guide
