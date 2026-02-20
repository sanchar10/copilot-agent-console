# Feature: Application Settings

## Summary
Users can configure global application defaults that apply to new sessions, including default model and working directory.

## Acceptance Criteria
- [x] Settings button in sidebar (gear icon)
- [x] Modal with default Model and CWD options
- [x] Model dropdown shows available models
- [x] CWD accepts valid directory paths (invalid shows error)
- [x] Settings persist to ~/.copilot-web/settings.json
- [x] New sessions use saved defaults
