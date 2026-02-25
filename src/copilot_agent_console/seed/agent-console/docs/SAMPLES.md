# Packaged Samples

Copilot Console ships with pre-built agents, workflows, automations, and tools to get you started. You can find them in the Agent Library, Workflow Library, and Tools sections.

---

## Try It Now

### 1. 📰 Daily Tech Brief (Automation)

**What:** An agent searches the web for the latest AI, developer tools, cloud, and open source news — then produces a styled HTML report.

**Try it:**
1. Go to **Agents** → **Morning Tech Brief** → **Automations**
2. You'll see **Daily Tech Brief** (runs at 8 AM weekdays, disabled by default)
3. Toggle it **ON** to start receiving daily briefs, or click **Run Now** to try immediately
4. Open the generated `tech-brief-YYYY-MM-DD.html` from the working directory

**Agents:** 📰 Morning Tech Brief
**Schedule:** `0 8 * * 1-5` (8 AM, Mon–Fri)

---

### 2. 🔍 Codebase Health Check (Workflow)

**What:** A 3-agent pipeline that scans a codebase, scores its health across 5 categories, and generates a styled HTML dashboard.

**Try it:**
1. Go to **Workflows** → **Codebase Health Check**
2. Click **▶ Run**
3. Use the 📁 button to select a project folder
4. Watch the three agents work in sequence
5. Open `health-report.html` from the working directory

**Agents:**
| Step | Agent | Role |
|------|-------|------|
| 1 | 🔍 Codebase Scanner | Inventories files, TODOs, tests, dependencies |
| 2 | 📊 Health Analyst | Scores health 0–100 across structure, tests, docs, hygiene, dependencies |
| 3 | 🎨 Report Generator | Creates a styled HTML dashboard |

---

### 3. ✍️ Emoji Poem (Workflow)

**What:** A 2-agent pipeline — one writes a poem on any topic, the other transforms it into a beautiful HTML page with inline emoji.

**Try it:**
1. Go to **Workflows** → **Emoji Poem**
2. Click **▶ Run**
3. Enter a topic (e.g., "shining stars", "rainy morning", "coffee")
4. The poet writes, the illustrator decorates with emoji and saves `emoji-poem.html`

**Agents:**
| Step | Agent | Role |
|------|-------|------|
| 1 | ✍️ Creative Poet | Writes a 3–5 stanza poem on the given topic |
| 2 | 🎨 Emoji Illustrator | Adds inline emoji and saves a styled HTML page |

---

### 4. 🔧 Tool Builder (Agent)

**What:** Describe a custom tool in plain English — the agent generates a working Python tool file, drops it into `~/.copilot-agent-console/tools/`, and it's immediately available to all agents.

**Try it:**
1. Go to **Agents** → **Tool Builder** → **New Session**
2. Describe the tool: *"Create a tool that converts CSV files to JSON"*
3. The agent writes the tool file and saves it — no restart needed

---

## All Packaged Content

### Agents

| Icon | Name | Purpose |
|------|------|---------|
| 📰 | Morning Tech Brief | Web search for latest tech news, HTML report |
| 🔍 | Codebase Scanner | Read-only directory analysis (files, TODOs, tests) |
| 📊 | Health Analyst | Scores codebase health from scan data |
| 🎨 | Report Generator | Creates styled HTML reports/dashboards |
| ✍️ | Creative Poet | Writes poems on any topic |
| 🎨 | Emoji Illustrator | Adds inline emoji, saves styled HTML |
| 🔧 | Tool Builder | Generates custom Python tools from descriptions |
| 📖 | Copilot Console Guide | Answers questions about Copilot Console by reading bundled docs |

### Workflows

| Name | Steps | Description |
|------|-------|-------------|
| Codebase Health Check | Scanner → Analyst → Report Generator | Full codebase health analysis pipeline |
| Emoji Poem | Creative Poet → Emoji Illustrator | Topic → poem → emoji HTML page |

### Automations

| Name | Agent | Schedule | Default |
|------|-------|----------|---------|
| Daily Tech Brief | Morning Tech Brief | 8 AM Mon–Fri | Disabled |

### Tools

| File | Description |
|------|-------------|
| `system_tools.py` | System utilities (clipboard, notifications, etc.) |

---

## Customizing Samples

All seed content is yours to modify:
- **Agents** — Edit system prompts, change models, add MCP servers
- **Workflows** — Add/remove/reorder steps, reference your own agents
- **Automations** — Change schedules, prompts, or working directories
- **Tools** — Modify or extend the packaged tools
