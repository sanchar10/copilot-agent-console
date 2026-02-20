# Feature: Session Management

## Summary
Users can create multiple chat sessions, switch between them using tabs, and manage session lifecycle (create, resume, delete).

## Acceptance Criteria
- [x] "New Session" button creates a new session tab
- [x] Sessions list in sidebar shows all sessions
- [x] Sessions sorted by most recently updated
- [x] Tab bar shows open sessions
- [x] Clicking sidebar session opens it in a tab
- [x] Tab close disconnects session but keeps history
- [x] Delete removes session permanently
- [x] Session names are editable
- [x] Sessions created lazily (on first message, not on "New Session" click)
