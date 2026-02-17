/**
 * API for monitoring active agent sessions.
 */

const API_BASE = '/api';

export interface ActiveAgentSession {
  session_id: string;
  status: string;
  chunks_count: number;
  steps_count: number;
  started_at: string | null;
  content_length?: number;
  content_tail?: string;
  current_step?: {
    title: string;
    status: string;
    [key: string]: unknown;
  };
}

export interface ActiveAgentsUpdate {
  count: number;
  sessions: ActiveAgentSession[];
}

/**
 * Get a snapshot of all active agent sessions.
 */
export async function getActiveAgents(): Promise<ActiveAgentsUpdate> {
  const response = await fetch(`${API_BASE}/sessions/active-agents`);
  if (!response.ok) {
    throw new Error('Failed to fetch active agents');
  }
  return response.json();
}

/**
 * Subscribe to live updates of active agent sessions.
 * Returns an AbortController to stop the subscription.
 */
export function subscribeToActiveAgents(
  onUpdate: (data: ActiveAgentsUpdate) => void,
  onCompleted: (sessionId: string) => void,
  onError: (error: string) => void
): AbortController {
  const controller = new AbortController();
  
  const connect = async () => {
    try {
      const response = await fetch(`${API_BASE}/sessions/active-agents/stream`, {
        signal: controller.signal,
      });
      
      if (!response.ok) {
        onError('Failed to connect to active agents stream');
        return;
      }
      
      const reader = response.body?.getReader();
      if (!reader) {
        onError('No response body');
        return;
      }
      
      const decoder = new TextDecoder();
      let buffer = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split(/\r?\n\r?\n/);
        buffer = events.pop() || '';
        
        for (const event of events) {
          const lines = event.split(/\r?\n/);
          let eventName = '';
          const dataLines: string[] = [];
          
          for (const line of lines) {
            if (line.startsWith('event:')) {
              eventName = line.replace(/^event:\s?/, '').trim();
            } else if (line.startsWith('data:')) {
              dataLines.push(line.replace(/^data:\s?/, ''));
            }
          }
          
          const eventData = dataLines.join('\n');
          if (!eventData) continue;
          
          try {
            const data = JSON.parse(eventData);
            if (eventName === 'update') {
              onUpdate(data);
            } else if (eventName === 'completed') {
              onCompleted(data.session_id);
            }
          } catch (e) {
            console.error('Failed to parse SSE data:', e);
          }
        }
      }
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') {
        // Normal cancellation
        return;
      }
      onError(e instanceof Error ? e.message : 'Unknown error');
    }
  };
  
  connect();
  return controller;
}
