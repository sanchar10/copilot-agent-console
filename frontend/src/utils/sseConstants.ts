/**
 * SSE event type constants used across desktop and mobile components.
 */
export const SSE_EVENTS = {
  /** Content chunk from the agent's response */
  DELTA: 'delta',
  /** Agent reasoning/tool step */
  STEP: 'step',
  /** Agent response completed */
  DONE: 'done',
  /** Error during agent response */
  ERROR: 'error',
  /** Active agents list updated */
  UPDATE: 'update',
  /** Agent session completed */
  COMPLETED: 'completed',
} as const;
