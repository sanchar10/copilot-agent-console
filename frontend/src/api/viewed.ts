/**
 * API for session viewed timestamps
 */

const API_BASE = '/api';

export interface ViewedTimestamps {
  [sessionId: string]: number;
}

/**
 * Get all session viewed timestamps
 */
export async function getViewedTimestamps(): Promise<ViewedTimestamps> {
  console.log(`[Viewed API] GET /viewed`);
  const response = await fetch(`${API_BASE}/viewed`);
  if (!response.ok) {
    console.error('[Viewed API] Failed to fetch viewed timestamps');
    return {};
  }
  const data = await response.json();
  console.log(`[Viewed API] Loaded ${Object.keys(data).length} timestamps:`, data);
  return data;
}

/**
 * Mark a session as viewed
 */
export async function markSessionViewed(sessionId: string): Promise<void> {
  try {
    console.log(`[Viewed API] POST /viewed/${sessionId}`);
    const response = await fetch(`${API_BASE}/viewed/${sessionId}`, {
      method: 'POST',
    });
    if (response.ok) {
      const data = await response.json();
      console.log(`[Viewed API] Success:`, data);
    } else {
      console.error(`[Viewed API] Failed: ${response.status}`);
    }
  } catch (error) {
    console.error('[Viewed API] Error:', error);
  }
}
