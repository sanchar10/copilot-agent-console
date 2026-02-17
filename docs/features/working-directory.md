# Feature: Working Directory

## Summary
Users can set a working directory (CWD) per session, giving Copilot file system context for code-related tasks.

## Acceptance Criteria
- [x] CWD displayed in session header (click to edit inline)
- [x] Invalid directories show error
- [x] CWD persists with session
- [x] Default CWD configurable in settings
- [x] Each session has independent CWD
- [x] CWD passed to SDK on session create/resume
