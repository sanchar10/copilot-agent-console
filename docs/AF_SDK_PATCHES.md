# Agent Framework SDK Patches

Tracking monkey-patches and workarounds applied to the Microsoft Agent Framework
Python SDK. Review this list when upgrading `agent-framework` or
`agent-framework-core` — patches may become unnecessary as the SDK matures.

**Installed versions at time of writing:**
- `agent-framework==1.0.0b251120`
- `agent-framework-core==1.0.0b251001`

---

## 1. Declarative Workflow Input Seeding

| | |
|---|---|
| **File** | `src/copilot_console/app/services/workflow_engine.py` |
| **Method** | `WorkflowEngine.run_oneshot()` |
| **SDK gap** | `workflow.run(message=...)` passes the message to `_workflow_entry` (a `JoinExecutor`), which sends `ActionComplete()` downstream — **discarding the user input**. The first real agent never sees it. |
| **Root cause** | The .NET SDK has `InProcessExecution.StreamAsync(workflow, input, checkpointManager)` which seeds `System.LastMessage.Text` and `Workflow.Inputs` before executors run. The Python SDK has no equivalent class. |
| **What we patch** | `workflow._state.clear()` is replaced with a wrapper that re-seeds the declarative state (`_declarative_workflow_state`) after the internal reset, populating `Workflow.Inputs.input`, `System.LastMessage.Text`, and `System.LastMessageText`. |
| **Safety guards** | Pre-flight checks raise `RuntimeError` immediately if: (1) `Workflow._state` attribute is missing, (2) `State.clear/set/commit` methods are missing, (3) `State.clear` is not assignable, (4) `set()/commit()` fail after `clear()`. |
| **Restore** | Original `clear()` is restored in a `finally` block after execution. |
| **When to remove** | When the Python SDK ships `InProcessExecution` (or equivalent), or when `JoinExecutor` properly forwards the message string to downstream executors. |
| **Reference** | [.NET InProcessExecution usage](https://github.com/microsoft/agent-framework/blob/main/dotnet/samples/GettingStarted/Workflows/Declarative/Marketing/Program.cs), [AF sample YAML](https://github.com/microsoft/agent-framework/blob/main/workflow-samples/Marketing.yaml) |

---

## How to check if a patch is still needed

After upgrading the SDK:

1. Remove the patch temporarily
2. Run the `emoji-poem` workflow with a user message (e.g., "Shining stars")
3. If the first agent (`write`) receives the topic → patch is no longer needed
4. If the agent says "you haven't provided a topic" → patch is still required
