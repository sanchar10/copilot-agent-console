/**
 * Sentinel sessionId used to key /help bubbles in the new-session pane
 * before a real session has been created server-side.
 *
 * This value MUST never be:
 *   - sent to the server
 *   - stored on disk / in localStorage
 *   - placed in the tab bar or sessionStore.sessions
 *
 * It is consumed only by:
 *   - chatStore.messagesPerSession (as a key)
 *   - the new-session pane in ChatPane.tsx (as a render source)
 *   - the migration step in InputBox.handleSubmit (read once, then cleared)
 */
export const NEW_SESSION_KEY = '__new_session__';
