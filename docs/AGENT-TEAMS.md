# What Are Agent Teams?

When you chat with an agent in Copilot Console, it runs as the main agent for that session. Sub-agents are additional agents loaded alongside it. The main agent can **automatically delegate** tasks to a sub-agent when it determines one is better suited for the job. Copilot Console allows formation of a team with a main agent configuration and set of custom sub-agents that are part of the team.

Each sub-agent runs in its own context — it has its own prompt, its own tool access, and returns results back to the main agent. 

**Example:** A "Dev Lead" agent that orchestrates the software development lifecycle across four specialists:

```
Dev Lead (main agent)
├── Designer — designs solutions, evaluates trade-offs, proposes file structure
├── Developer — writes code, implements features, fixes bugs
├── Code Reviewer — reviews changes for bugs, security issues, and best practices
└── Test Engineer — writes and runs tests, identifies edge cases, validates coverage
```

When you ask *"Implement a user authentication module"*, the Dev Lead coordinates the workflow: asks the Designer to design the approach and file structure, hands the design to the Developer to implement, sends the code to the Code Reviewer for a quality check, and finally passes it to the Test Engineer for test coverage — synthesizing feedback at each step before moving forward.

## Setting Up Sub-Agents

### 1. Create Agents

First, create the agents you want to use as sub-agents in the **Agent Library** (sidebar → Agents). Each agent needs at minimum a name, description, and prompt.

### 2. Add Sub-Agents to a Parent Agent

Open the parent agent in the Agent Editor. In the **Sub-Agents** selector, pick which agents should be available as sub-agents. This works just like the MCP and Tools selectors.

### 3. Start Chatting

Select the parent agent and start a new chat. The sub-agent selector in the chat view shows which sub-agents are active — you can toggle them on/off per session.

## How It Works

When you send a message:

1. Your message goes to the **main agent** (the one you selected)
2. The main agent decides whether to handle it directly or delegate
3. If it delegates, the **sub-agent** runs in a separate context with only its own tools and MCP servers
4. The sub-agent's response flows back to the main agent
5. The main agent incorporates the result and responds to you

Sub-agents have `infer: true` by default — the main agent automatically decides when to delegate based on the sub-agent's description. You don't need to explicitly ask for a specific sub-agent.

## Limitations

- **Tools and sub-agents are mutually exclusive** — A session cannot use both tools (custom or built-in include/exclude) and sub-agents simultaneously. This is a CLI-level limitation where `cwd` combined with `tools`/`available_tools` causes `custom_agents` to be silently dropped. The UI enforces this by disabling one selector when the other has selections. Sub-agents themselves _can_ have their own tools and MCP servers — the restriction only applies at the parent session level.
- **Excluded tools propagate to sub-agents** — When the parent session uses `excluded_tools`, those exclusions apply to ALL sub-agents in the session. A sub-agent's built-in tool whitelist ("Only" mode) IS honored, but the parent's exclusions are applied on top: `effective tools = sub-agent's whitelist MINUS parent's exclusions`. For example, if the parent excludes `create` and a sub-agent whitelists `['create', 'view', 'powershell']`, the sub-agent gets only `view` and `powershell`. Use prompt instructions to guide delegation instead of excluding tools from the parent.
- **No nesting** — Sub-agents cannot have their own sub-agents. Only one level of delegation is supported.
- **No custom tools** — Agents that use custom tools (Python-based tools defined in the Tools Builder) cannot be used as sub-agents. This is an SDK limitation.
- **Prompt and description required** — Sub-agents must have both a system prompt and a description. The prompt defines the sub-agent's behavior; the description tells the main agent when to delegate.
- **No per-agent model override** — Sub-agents use the session's model, not their own model setting.
- **CLI agents are always present** — Agents defined in `~/.copilot/agents/` are always available in every session regardless of sub-agent selection.

Agents eligible as sub-agents are marked with a 🧩 indicator in the Agent Library. You can filter the library to show only composable agents.

## Example: Dev Lead Team

These agents are included as samples in Copilot Console. You can find them in the **Agent Library** (sidebar → Agents) and use them as-is or customize them.

### Dev Lead (Parent Agent)

| Field | Value |
|---|---|
| **Name** | Dev Lead |
| **Description** | Orchestrates feature development by coordinating design, coding, review, and testing |
| **Model** | claude-sonnet-4 |
| **Prompt** | You are a dev lead orchestrating the software development lifecycle. For feature requests: first delegate to the Designer for design and file structure, then hand the design to the Developer for implementation, send the code to the Code Reviewer for quality checks, and finally pass it to the Test Engineer for test coverage. Synthesize feedback at each stage before proceeding to the next. |
| **MCP Servers** | github |
| **Sub-Agents** | Designer, Developer, Code Reviewer, Test Engineer |

### Designer (Sub-Agent)

| Field | Value |
|---|---|
| **Name** | Designer |
| **Description** | Designs solutions, evaluates trade-offs, and proposes file structure |
| **Prompt** | You are a software designer. Analyze requirements, evaluate design trade-offs, propose file/module structure, and identify patterns to follow. Keep designs practical and aligned with the existing codebase. |
| **Tools** | grep, glob, view (Only mode) |

### Developer (Sub-Agent)

| Field | Value |
|---|---|
| **Name** | Developer |
| **Description** | Implements features, writes code, and fixes bugs following the given design |
| **Prompt** | You are a software developer. Implement features following the provided design. Write clean, minimal code. Use existing patterns in the codebase. Make surgical changes — don't refactor unrelated code. |

### Code Reviewer (Sub-Agent)

| Field | Value |
|---|---|
| **Name** | Code Reviewer |
| **Description** | Reviews code for bugs, security issues, and adherence to best practices |
| **Prompt** | You are a code reviewer. Review changes for bugs, security vulnerabilities, and logic errors. Only flag issues that genuinely matter — never comment on style or formatting. Suggest concrete fixes. |
| **Tools** | grep, view (Only mode) |

### Test Engineer (Sub-Agent)

| Field | Value |
|---|---|
| **Name** | Test Engineer |
| **Description** | Writes tests, identifies edge cases, and validates coverage |
| **Prompt** | You are a test engineer. Write unit and integration tests for the given code. Identify edge cases, boundary conditions, and failure modes. Ensure tests are deterministic and cover the critical paths. |
