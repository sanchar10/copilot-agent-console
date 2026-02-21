import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { mobileApiClient } from '../../api/mobileClient';

interface ActiveSession {
  session_id: string;
  session_name?: string;
  elapsed_seconds: number;
  current_step?: string;
  content_tail?: string;
}

interface ActiveAgentsUpdate {
  count: number;
  sessions: ActiveSession[];
}

export function MobileAgentMonitor() {
  const navigate = useNavigate();
  const [agents, setAgents] = useState<ActiveSession[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // Initial fetch
    mobileApiClient.get<ActiveAgentsUpdate>('/sessions/active-agents')
      .then(data => setAgents(data.sessions))
      .catch(() => {});

    // SSE for live updates
    const es = mobileApiClient.createEventSource('/sessions/active-agents/stream');
    
    es.addEventListener('update', (event) => {
      const data: ActiveAgentsUpdate = JSON.parse(event.data);
      setAgents(data.sessions);
      setConnected(true);
    });

    es.onerror = () => {
      setConnected(false);
    };

    es.onopen = () => {
      setConnected(true);
    };

    return () => es.close();
  }, []);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 pt-4 pb-2 bg-white dark:bg-[#252536] border-b border-gray-200 dark:border-[#3a3a4e]">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Active Agents</h1>
          {connected && (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
          )}
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
          {agents.length === 0 ? 'No agents running' : `${agents.length} agent${agents.length !== 1 ? 's' : ''} running`}
        </p>
      </div>

      {/* Agent list */}
      <div className="flex-1 overflow-y-auto p-3">
        {agents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500 gap-3">
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            <p className="text-sm">All quiet — no agents are running</p>
          </div>
        ) : (
          <div className="space-y-3">
            {agents.map(agent => (
              <button
                key={agent.session_id}
                onClick={() => navigate(`/mobile/chat/${agent.session_id}`)}
                className="w-full text-left bg-white dark:bg-[#2a2a3c] rounded-xl p-4 shadow-sm border border-gray-100 dark:border-[#3a3a4e] active:bg-gray-50 dark:active:bg-[#32324a] transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                      </span>
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {agent.session_name || 'Session'}
                      </span>
                    </div>
                    {agent.current_step && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate pl-4">
                        {agent.current_step}
                      </p>
                    )}
                    {agent.content_tail && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 line-clamp-2 pl-4">
                        {agent.content_tail.slice(-200)}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
                    {formatElapsed(agent.elapsed_seconds)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ${mins % 60}m`;
}
