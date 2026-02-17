import { useState, useEffect, useRef } from 'react';
import { 
  subscribeToActiveAgents, 
  type ActiveAgentsUpdate, 
  type ActiveAgentSession 
} from '../../api/activeAgents';
import { useTabStore } from '../../stores/tabStore';

interface AgentMonitorProps {
  onClose: () => void;
}

function formatElapsedTime(startedAt: string | null): string {
  if (!startedAt) return '--:--';
  const start = new Date(startedAt).getTime();
  const now = Date.now();
  const elapsed = Math.floor((now - start) / 1000);
  
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function AgentCard({ session, onNavigate }: { session: ActiveAgentSession; onNavigate: (id: string) => void }) {
  const [elapsed, setElapsed] = useState(formatElapsedTime(session.started_at));
  
  // Update elapsed time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(formatElapsedTime(session.started_at));
    }, 1000);
    return () => clearInterval(interval);
  }, [session.started_at]);
  
  return (
    <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {/* Pulsing indicator */}
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </span>
          <span className="text-sm font-medium text-slate-200">
            {session.session_id.slice(0, 8)}...
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span title="Elapsed time">⏱️ {elapsed}</span>
          <span title="Chunks received">📦 {session.chunks_count}</span>
          <span title="Steps completed">🔧 {session.steps_count}</span>
        </div>
      </div>
      
      {/* Current step */}
      {session.current_step && (
        <div className="mb-3 px-2 py-1 bg-slate-900 rounded text-xs">
          <span className="text-emerald-400">▶</span>{' '}
          <span className="text-slate-300">{session.current_step.title}</span>
        </div>
      )}
      
      {/* Content tail - live output */}
      <div className="bg-slate-900 rounded p-3 font-mono text-xs text-slate-300 max-h-40 overflow-y-auto whitespace-pre-wrap break-words">
        {session.content_tail || (
          <span className="text-slate-500 italic">Waiting for output...</span>
        )}
      </div>
      
      {/* Footer */}
      <div className="flex justify-between items-center mt-3 pt-2 border-t border-slate-700">
        <span className="text-xs text-slate-500">
          {session.content_length ? `${session.content_length.toLocaleString()} chars` : ''}
        </span>
        <button
          onClick={() => onNavigate(session.session_id)}
          className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
        >
          Open Session →
        </button>
      </div>
    </div>
  );
}

export function AgentMonitor({ onClose }: AgentMonitorProps) {
  const [data, setData] = useState<ActiveAgentsUpdate>({ count: 0, sessions: [] });
  const [error, setError] = useState<string | null>(null);
  const [recentlyCompleted, setRecentlyCompleted] = useState<string[]>([]);
  const controllerRef = useRef<AbortController | null>(null);
  
  const { openTab } = useTabStore();
  
  useEffect(() => {
    // Subscribe to live updates
    controllerRef.current = subscribeToActiveAgents(
      (update) => {
        setData(update);
        setError(null);
      },
      (sessionId) => {
        // Show briefly that a session completed
        setRecentlyCompleted(prev => [...prev, sessionId]);
        setTimeout(() => {
          setRecentlyCompleted(prev => prev.filter(id => id !== sessionId));
        }, 3000);
      },
      (err) => {
        setError(err);
      }
    );
    
    return () => {
      controllerRef.current?.abort();
    };
  }, []);
  
  const handleNavigate = (sessionId: string) => {
    openTab({ id: `session:${sessionId}`, type: 'session', label: 'Session', sessionId });
    onClose();
  };
  
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-white">Active Agents Monitor</h2>
            <span className="px-2 py-0.5 bg-emerald-600 text-white text-sm rounded-full">
              {data.count} active
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {error && (
            <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-200 text-sm">
              {error}
            </div>
          )}
          
          {/* Recently completed */}
          {recentlyCompleted.length > 0 && (
            <div className="mb-4 p-3 bg-emerald-900/30 border border-emerald-700 rounded-lg">
              <span className="text-emerald-400 text-sm">
                ✅ Completed: {recentlyCompleted.map(id => id.slice(0, 8)).join(', ')}
              </span>
            </div>
          )}
          
          {data.count === 0 ? (
            <div className="text-center py-12">
              <div className="text-slate-500 mb-2">
                <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <p className="text-slate-400">No agents currently running</p>
              <p className="text-slate-500 text-sm mt-1">
                Send a message to start an agent session
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {data.sessions.map((session) => (
                <AgentCard 
                  key={session.session_id} 
                  session={session} 
                  onNavigate={handleNavigate}
                />
              ))}
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="p-3 border-t border-slate-700 text-center text-xs text-slate-500">
          Live updates every second • Content shows last 500 characters
        </div>
      </div>
    </div>
  );
}
