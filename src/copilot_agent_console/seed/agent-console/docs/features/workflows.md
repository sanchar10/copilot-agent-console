# Workflows

Workflows let you chain multiple agents together into automated pipelines. Instead of manually running agents one by one, you define a sequence of agent steps in YAML and run them as a single unit.

## How It Works

A workflow defines a series of **steps**, each invoking an agent. When you run a workflow:

1. The first agent receives your input message (or a default prompt)
2. Each subsequent agent receives the conversation history from previous agents
3. Agents can read files, analyze data, and create output — all within an isolated working directory
4. The workflow completes when the last agent finishes

Workflows use the [Microsoft Agent Framework](https://github.com/microsoft/agent-framework) for orchestration.

## Creating a Workflow

1. Click **Workflows** in the sidebar
2. Click **+ New Workflow**
3. Give it a name and write the YAML (see below)
4. Click **Save** — the Mermaid diagram updates automatically

### YAML Format

```yaml
kind: Workflow
name: my-workflow
trigger:
  kind: OnConversationStart
  id: my_trigger
  actions:
    - kind: InvokeAzureAgent
      id: step_one
      agent:
        name: Agent Name Here
    - kind: InvokeAzureAgent
      id: step_two
      agent:
        name: Another Agent
```

**Important**: The `agent.name` must match the agent's **display name** exactly (case-sensitive). This is the name shown in the Agent Library, not the filename.

## Running a Workflow

1. Open a workflow in the editor
2. Click **▶ Run**
3. Optionally enter an input message and/or select a working directory
4. The run opens in a new tab showing real-time progress

### Working Directory

Each workflow run gets an isolated working directory where agents can read and write files. By default this is `~/.copilot-agent-console/workflow-runs/{run_id}/`. You can override it using the **📁 folder picker** in the run dialog to point agents at a specific directory (e.g., your project folder).

## Sample Workflow: Codebase Health Check

The console ships with a pre-built **Codebase Health Check** workflow that demonstrates a 3-agent pipeline:

| Step | Agent | What It Does |
|------|-------|-------------|
| 1 | **Codebase Scanner** | Scans the directory — file counts, TODOs, large files, test presence, dependencies |
| 2 | **Health Analyst** | Scores health (0-100) across 5 categories, identifies top issues |
| 3 | **Report Generator** | Creates a styled `health-report.html` dashboard |

To try it:
1. Open **Workflows** → **Codebase Health Check**
2. Click **▶ Run**, select a project folder with the 📁 button
3. Wait for all 3 agents to complete
4. Open `health-report.html` from the working directory in your browser

## Managing Runs

- **Run History** appears at the bottom of the workflow editor
- Click a run to view its events and output
- **Delete** a run to clean up its working directory and session data
- Runs cannot be deleted while actively running

## Known Limitations

- **Sequential only** — Workflows currently support sequential agent chains only. Parallel execution (fan-out/fan-in) is not yet available in the declarative YAML format, though the underlying Agent Framework supports it programmatically. This will be added in a future update.
- **No abort** — There is no way to cancel a running workflow. You must wait for it to complete or fail.
- **Agent names must match exactly** — The `agent.name` in YAML must match the display name in the Agent Library. If you rename an agent, update all workflows that reference it.
- **No per-step model override** — All agents in a workflow use the model configured in their agent definition. There is no way to override the model per workflow step.
