# Agent Framework SDK Patches

Tracking monkey-patches and workarounds applied to the Microsoft Agent
Framework Python SDK and the GitHub Copilot SDK. Review this list when
upgrading any of:

- `agent-framework`
- `agent-framework-core`
- `agent-framework-declarative`
- `agent-framework-github-copilot` (AF-GHCP)
- `github-copilot-sdk`

Patches may become unnecessary as the upstream SDKs mature.

**Installed versions at time of writing:**

- `agent-framework==1.3.0`
- `agent-framework-core==1.3.0`
- `agent-framework-declarative==1.0.0b260507`
- `agent-framework-github-copilot==1.0.0b260507`
- `github-copilot-sdk==1.0.0b2` (bundles Copilot CLI 1.0.43-0)

Patch 1 (input seeding) lives in `src/copilot_console/app/services/workflow_engine.py`
and is applied at run time — without it, oneshot declarative workflows may silently
drop user input on older AF builds. Verification under the upgraded stack is pending
(see "When to remove" below).

Patch 2 (the SDK 0.3.0 compat shim) was **removed in the May 2026 upgrade** — see §2
below for the historical record.

---

## 1. Declarative Workflow Input Seeding — ✅ Active

| | |
|---|---|
| **File** | `src/copilot_console/app/services/workflow_engine.py` |
| **Method** | `WorkflowEngine._declarative_state_seeder()` (used by `run_oneshot()`) |
| **Status** | **Active and required.** Rebuilt in commit `e402f85` against `agent-framework-core>=1.0.0rc2`. Hardened with explicit guards so future SDK changes fail loudly instead of silently dropping input. |
| **SDK gap** | `workflow.run(message=...)` passes the message to `_workflow_entry` (a `JoinExecutor`), which sends `ActionComplete()` downstream — **discarding the user input**. The first real agent never sees it. The .NET SDK has `InProcessExecution.StreamAsync(workflow, input, checkpointManager)` which seeds `System.LastMessage.Text` and `Workflow.Inputs` before executors run. The Python SDK has no equivalent. |
| **What we patch** | A context manager (`_declarative_state_seeder`) wraps `state.clear()` so that whenever the workflow internals reset state, we re-seed the declarative state key (`_declarative_workflow_state`) with `Inputs.input`, `System.LastMessage.Text`, `System.LastMessageText`, etc. |
| **Idempotency** | Only seeds when `_declarative_workflow_state` is absent after `clear()`. Preserves `Local` / `Outputs` / `Agent` across mid-workflow clears (HITL pause/resume, sub-workflow re-entry). On resume via `responses={...}` AF passes `reset_context=False` so `state.clear()` is never called — defensive idempotency still guards against future SDK changes. |
| **Guards (raise loudly on SDK drift)** | (1) `Workflow` must expose `_state`. (2) `state` must have callable `clear`/`set`/`get`/`commit`. (3) `state.clear` must be assignable (not frozen/slotted). Any failure raises `RuntimeError` referencing this doc. |
| **When to remove** | Test a oneshot declarative workflow (e.g. `mood-topic-poem`) without the patch (`with WorkflowEngine._null_seeder():`). If the first agent receives the topic, the AF Python SDK has fixed input seeding natively — remove the patch. Otherwise, if any guard now raises, the SDK internals moved and the patch needs rewriting against the new `Workflow` internals. |

---

## 2. AF-GHCP / Copilot SDK 0.3.0 Compatibility Shim — 🗑️ Removed (May 2026)

**Removed when the project upgraded to the coordinated stack** of
`github-copilot-sdk==1.0.0b2` + `agent-framework-github-copilot==1.0.0b260507`
(both released May 6–7, 2026). The newer AF-GHCP imports SDK symbols natively
(no synthetic `copilot.types` module needed) and uses kwargs throughout
(no method wrapping needed). Verified by:

```
python -c "from agent_framework_github_copilot import GitHubCopilotAgent"
```

succeeding without any module-level shim, and by the full backend test suite
passing (656 tests).

For the historical record, the shim previously did 7 things:

1. Synthesised a `copilot.types` module (re-exporting `MCPServerConfig`,
   `PermissionRequest`, `PermissionRequestResult`, `ResumeSessionConfig`,
   `SessionConfig`, `SystemMessageConfig`, `Tool`, `ToolInvocation`,
   `ToolResult`, `CopilotClientOptions`, `MessageOptions`) and registered it
   in `sys.modules` before AF-GHCP imported.
2. Wrapped `CopilotClient.__init__` to convert dict options → `SubprocessConfig`.
3. Wrapped `CopilotClient.create_session` to unpack dict config as `**kwargs`.
4. Wrapped `CopilotClient.resume_session` similarly.
5. Wrapped `CopilotSession.send_and_wait` to extract `prompt` from dict.
6. Wrapped `CopilotSession.send` similarly.
7. Marked each wrap with a `_PATCH_SENTINEL` attribute to prevent double-wrap on
   re-import / hot-reload.

If a future SDK or AF release breaks the bare import again, the git history
around `_apply_sdk_compat_shim()` and `_build_copilot_types_module()` shows
the pattern that worked before.

---

## How to verify a patch is still needed after upgrading

### Patch 1 (Input Seeding)

1. Pin a known-good oneshot declarative workflow (`mood-topic-poem` lives in the
   bundled seed content).
2. Run it with a topic via the workflows UI.
3. If the first agent receives the topic verbatim — the AF Python SDK now
   seeds inputs natively. Remove `_declarative_state_seeder` and switch
   `run_oneshot` back to `workflow.run(message=...)` directly.
4. If any of the three guards in `_declarative_state_seeder` raise
   `RuntimeError`, the SDK internals moved. Inspect `Workflow.__dict__`
   and the AF source to find the new state-management API and rewrite
   the seeder against it.

### Patch 2 (SDK 0.3.0 Compat Shim) — Removed

This patch was deleted in the May 2026 stack upgrade. Nothing to verify.
