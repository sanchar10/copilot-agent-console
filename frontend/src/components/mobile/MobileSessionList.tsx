import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { mobileApiClient } from '../../api/mobileClient';
import type { Session } from '../../types/session';

interface ActiveAgentsResponse {
  count: number;
  sessions: { session_id: string; elapsed_seconds: number; current_step?: string }[];
}

interface ViewedTimestamps {
  [sessionId: string]: number;
}

interface Props {
  onNotification: (n: { message: string; sessionId?: string } | null) => void;
}

export function MobileSessionList({ onNotification }: Props) {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [viewed, setViewed] = useState<ViewedTimestamps>({});
  const [activeSessionIds, setActiveSessionIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [sessionsData, viewedData, activeData] = await Promise.all([
        mobileApiClient.get<{ sessions: Session[] }>('/sessions'),
        mobileApiClient.get<ViewedTimestamps>('/viewed'),
        mobileApiClient.get<ActiveAgentsResponse>('/sessions/active-agents'),
      ]);
      setSessions(sessionsData.sessions.filter(s => s.trigger !== 'schedule'));
      setViewed(viewedData);
      setActiveSessionIds(new Set(activeData.sessions.map(s => s.session_id)));
    } catch (err) {
      console.error('Failed to load sessions:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    // Poll for updates every 10 seconds
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, [loadData]);

  // SSE for active agent notifications
  useEffect(() => {
    const es = mobileApiClient.createEventSource('/sessions/active-agents/stream');

    es.addEventListener('completed', (event) => {
      const data = JSON.parse(event.data);
      const sid = data.session_id;
      const session = sessions.find(s => s.session_id === sid);
      onNotification({
        message: `Agent finished: ${session?.session_name || 'Session'}`,
        sessionId: sid,
      });
    });

    es.addEventListener('update', (event) => {
      const data = JSON.parse(event.data);
      const currentIds = new Set<string>(data.sessions.map((s: { session_id: string }) => s.session_id));
      setActiveSessionIds(currentIds);
    });

    es.onerror = () => {
      // SSE reconnects automatically
    };

    return () => es.close();
  }, [sessions, onNotification]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
  };

  const isUnread = (session: Session): boolean => {
    const viewedAt = viewed[session.session_id];
    if (!viewedAt) return true; // Never viewed
    const updatedAt = new Date(session.updated_at).getTime() / 1000;
    return updatedAt > viewedAt;
  };

  const handleSessionClick = async (sessionId: string) => {
    // Mark as viewed
    try {
      await mobileApiClient.post(`/viewed/${sessionId}`);
      setViewed(prev => ({ ...prev, [sessionId]: Date.now() / 1000 }));
    } catch { /* ignore */ }
    navigate(`/mobile/chat/${sessionId}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 pt-4 pb-2 bg-white dark:bg-[#252536] border-b border-gray-200 dark:border-[#3a3a4e]">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Sessions</h1>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="text-gray-500 dark:text-gray-400 p-2"
          >
            <svg className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto">
        {sessions.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500">
            <p>No sessions yet</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-[#3a3a4e]">
            {sessions.map(session => {
              const unread = isUnread(session);
              const isActive = activeSessionIds.has(session.session_id);
              return (
                <button
                  key={session.session_id}
                  onClick={() => handleSessionClick(session.session_id)}
                  className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-[#2a2a3c] active:bg-gray-100 dark:active:bg-[#32324a] transition-colors"
                >
                  {/* Unread dot */}
                  <div className="w-2.5 flex-shrink-0">
                    {unread && (
                      <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                    )}
                  </div>

                  {/* Session info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm truncate ${unread ? 'font-semibold text-gray-900 dark:text-gray-100' : 'text-gray-700 dark:text-gray-300'}`}>
                        {session.session_name}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      {session.model} · {formatTimeAgo(session.updated_at)}
                    </div>
                  </div>

                  {/* Active indicator */}
                  {isActive && (
                    <span className="flex-shrink-0 relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                    </span>
                  )}

                  {/* Chevron */}
                  <svg className="w-4 h-4 text-gray-300 dark:text-gray-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function formatTimeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}
