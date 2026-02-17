---
name: ralph-runner
description: Sequential batch job execution with human oversight. Use for "start ralph loop", "ralph on [file]", "start job", "create job", "process backlog", "run a batch".
---

# ralph-runner

## Summary
Runs batch jobs sequentially with human oversight via the Agent Console backend. Each job runs in a fresh agent session that inherits your current session's configuration (model, MCP servers, tools, workspace).

## When to use
- "start ralph", "ralph on [file]", "run a batch", "process backlog"

## Commands

### Step 1: Create batch
**IMPORTANT:** Replace `YOUR_SESSION_ID` with your actual session ID (the UUID from your conversation context).

```powershell
$id = [guid]::NewGuid().ToString().Substring(0,8); $jobs = '[{"description": "Job 1", "context": ""}, {"description": "Job 2", "context": ""}]'; $jobs | Out-File "$env:TEMP\job-ralph_$id.json" -Encoding UTF8; py $env:USERPROFILE\.copilot\skills\ralph-runner\scripts\create_batch.py --session-id <YOUR_SESSION_ID> --file "$env:TEMP\job-ralph_$id.json"
```

### Step 2: Start batch
```powershell
py $env:USERPROFILE\.copilot\skills\ralph-runner\scripts\start_batch.py --batch-id <BATCH_ID>
```

## Workflow - MUST FINISH ALL STEPS

1. Gather list of job items based on the provided inputs
2. Show job list in a table (first 3 items for reference)
3. Ensure that you have enough information to run each job in the list
4. Ask clarifying question to user to build the full context for running the job
5. Ask: "Ready to start?"
6. **Get your session ID** from your conversation context (it's a UUID like `529fe8aa-4dfc-4cec-aff6-009e4b9cbe14`)
7. Run **Step 1** command with:
   - Replace `YOUR_SESSION_ID` with your actual session UUID
   - Replace jobs JSON with actual job descriptions
8. Run **Step 2** command with BATCH_ID
9. Say "🚀 Batch started! Batch Id: {BATCH_ID}. Check Ralph Monitor in Agent Console for Progress." and STOP

## CRITICAL
- **Session ID must be your actual UUID** - do NOT make up names
- Do NOT execute jobs yourself - backend does it
