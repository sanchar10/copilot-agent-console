# Known Limitations

This document lists known limitations of Copilot Agent Console and the underlying GitHub Copilot CLI/SDK.

## Tools and Sub-Agents Are Mutually Exclusive

**Affected area:** Session configuration, Agent definitions

When a session uses a working directory (`cwd`), GitHub Copilot CLI silently drops `custom_agents` if any `tools` or `available_tools` are also present in the session options. This is a CLI-level bug, not an Agent Console issue.

**Workaround:** The UI enforces mutual exclusion — selecting any tools (custom or built-in include/exclude) disables the sub-agents selector, and vice versa. Clear all selections in one category to re-enable the other.

**Note:** Sub-agents themselves _can_ have their own tools, MCP servers, and built-in tool whitelists. The limitation only applies at the parent session level.

## Sub-Agents Cannot Be Nested

An agent that has sub-agents cannot itself be used as a sub-agent. Only leaf agents (no sub-agents of their own) are eligible for the sub-agent role.

## Sub-Agent Eligibility Requirements

To be used as a sub-agent, an agent must:

1. Have a non-empty **description** (used for auto-dispatch routing)
2. Have a non-empty **system message/prompt** (used as the sub-agent's instructions)
3. Have **no custom tools** (SDK limitation)
4. Have **no excluded built-in tools** (SDK limitation)
5. Have **no sub-agents** of its own (no nesting)
6. Not be the parent agent itself (no self-reference)

## No Per-Agent Model Override for Sub-Agents

Sub-agents inherit the model of the parent session. There is no way to specify a different model per sub-agent in the current SDK.

## Custom Tools Cannot Have Top-Level Imports

Custom tools (Python files in `~/.copilot-agent-console/tools/`) run in a sandboxed environment. Top-level imports of third-party packages are not supported — use inline imports within the function body instead.

## MCP Server Configuration Is Global

MCP servers are configured globally in `~/.copilot/mcp-config.json` or `~/.copilot-agent-console/mcp-config.json`. Per-session MCP server configuration is selection-based (include/exclude from the global list), not definition-based.

## Session Working Directory Cannot Be Changed After First Message

While the working directory (`cwd`) can be updated in session settings, the underlying SDK client must be destroyed and recreated. This means the Copilot model loses all conversation context accumulated in the current SDK session.
