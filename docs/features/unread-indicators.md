# Feature: Unread Indicators

## Summary
Visual indicators in the session list show which sessions have new messages or are actively processing, helping users track activity across multiple sessions.

## Acceptance Criteria
- [x] Spinner shows during active agent processing
- [x] Blue dot shows for completed but unread responses
- [x] Viewing session clears indicators (spinner takes precedence over dot)
- [x] Viewed state persists in ~/.copilot-web/viewed.json
- [x] Indicators update in real-time
- [x] Works across browser restarts
