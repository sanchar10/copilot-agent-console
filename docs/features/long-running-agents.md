# Feature: Long-Running Agents

## Summary
Agent tasks continue executing on the server even when the browser is closed or refreshed, allowing long-running operations to complete.

## Acceptance Criteria
- [x] Agent runs in background task, not tied to SSE connection
- [x] Response chunks buffered for disconnected clients
- [x] Disconnect endpoint preserves active sessions
- [x] Reconnect detects and resumes active responses
- [x] Completed responses available after browser reopen
- [x] Buffer cleanup after response completion (5 min TTL)
