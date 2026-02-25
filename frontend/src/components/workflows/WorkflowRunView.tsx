/**
 * Workflow Run View — Mermaid diagram (left) + event/chat panel (right).
 * Connects to SSE stream for real-time updates.
 */

import { useEffect, useState, useRef } from 'react';
import { formatDateTime } from '../../utils/formatters';
import { MermaidDiagram } from '../chat/MermaidDiagram';
import * as workflowsApi from '../../api/workflows';
import type { WorkflowRun } from '../../types/workflow';

interface WorkflowRunViewProps {
  workflowId: string;
  runId: string;
}

interface RunEvent {
  type: string;
  run_id?: string;
  executor_id?: string;
  source_executor_id?: string;
  output?: string;
  error?: string;
  error_type?: string;
  error_message?: string;
  error_executor_id?: string;
  request_id?: string;
  data?: unknown;
  state?: string;
  iteration?: number;
  status?: string;
  workflow_name?: string;
  [key: string]: unknown;
}

export function WorkflowRunView({ workflowId, runId }: WorkflowRunViewProps) {
  const [run, setRun] = useState<WorkflowRun | null>(null);
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [mermaid, setMermaid] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const eventsEndRef = useRef<HTMLDivElement>(null);

  // Load initial run data and mermaid
  useEffect(() => {
    workflowsApi.getWorkflowRun(runId)
      .then((loadedRun) => {
        setRun(loadedRun);
        // For completed/failed runs, replay stored events — no SSE needed
        if (loadedRun.status === 'completed' || loadedRun.status === 'failed') {
          if (loadedRun.events && loadedRun.events.length > 0) {
            setEvents(loadedRun.events as RunEvent[]);
          } else {
            // Fallback for runs stored before events field existed
            const historicEvents: RunEvent[] = [];
            historicEvents.push({ type: 'workflow_started', workflow_name: loadedRun.workflow_name });
            if (loadedRun.node_results) {
              for (const [nodeId, result] of Object.entries(loadedRun.node_results)) {
                const r = result as Record<string, unknown>;
                historicEvents.push({
                  type: r.status === 'failed' ? 'executor_failed' : 'executor_completed',
                  executor_id: nodeId,
                  output: r.output as string | undefined,
                  error: r.error as string | undefined,
                });
              }
            }
            if (loadedRun.status === 'failed') {
              historicEvents.push({ type: 'workflow_failed', error: loadedRun.error || 'Workflow failed' });
            } else {
              historicEvents.push({ type: 'workflow_completed' });
            }
            setEvents(historicEvents);
          }
        }
      })
      .catch((e) => setError((e as Error).message));

    workflowsApi.visualizeWorkflow(workflowId)
      .then((r) => setMermaid(r.mermaid))
      .catch(() => {});
  }, [workflowId, runId]);

  // SSE connection — only for active runs
  useEffect(() => {
    // Don't connect SSE if run is already terminal
    if (run && (run.status === 'completed' || run.status === 'failed' || run.status === 'aborted')) {
      return;
    }
    // Wait for run data to load before deciding
    if (!run) return;

    const es = workflowsApi.createWorkflowRunStream(runId);
    eventSourceRef.current = es;

    es.onopen = () => setConnected(true);

    const terminalTypes = new Set(['run_complete', 'workflow_completed', 'workflow_failed']);

    es.addEventListener('workflow_event', (e) => {
      try {
        const data = JSON.parse(e.data);
        setEvents((prev) => [...prev, data]);
        // Terminal event — close SSE and refresh run data
        if (terminalTypes.has(data.type)) {
          workflowsApi.getWorkflowRun(runId)
            .then(setRun)
            .catch(() => {});
          setConnected(false);
          es.close();
        }
      } catch {
        // ignore parse errors
      }
    });

    es.addEventListener('human_input_required', (e) => {
      try {
        const data = JSON.parse(e.data);
        setEvents((prev) => [...prev, data]);
      } catch {
        // ignore
      }
    });

    es.onerror = () => {
      setConnected(false);
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [runId, run]);

  // Auto-scroll to bottom on new events
  useEffect(() => {
    eventsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events]);

  const handleApprove = async (requestId: string) => {
    try {
      await workflowsApi.sendHumanInput(runId, { request_id: requestId, data: true });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleReject = async (requestId: string) => {
    try {
      await workflowsApi.sendHumanInput(runId, { request_id: requestId, data: false });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const statusColor = run?.status === 'completed' ? 'text-green-500' :
    run?.status === 'failed' ? 'text-red-500' :
    run?.status === 'running' ? 'text-blue-500' :
    run?.status === 'paused' ? 'text-yellow-500' :
    'text-gray-500';

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Status bar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-200 dark:border-[#3a3a4e] bg-white dark:bg-[#252536]">
        <div className="flex items-center gap-2">
          <span className={`font-semibold ${statusColor}`}>
            {run?.status?.toUpperCase() || 'LOADING'}
          </span>
          {connected && (
            <span className="flex items-center gap-1 text-xs text-green-500">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              Live
            </span>
          )}
        </div>
        <div className="flex-1" />
        {run?.started_at && (
          <span className="text-xs text-gray-400 dark:text-gray-500">
            Started {formatDateTime(run.started_at)}
          </span>
        )}
        {run?.duration_seconds != null && (
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {run.duration_seconds.toFixed(1)}s
          </span>
        )}
      </div>

      {/* Main content: Events (left) + Mermaid (right) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left pane: Events feed */}
        <div className="w-3/5 border-r border-gray-200 dark:border-[#3a3a4e] flex flex-col overflow-hidden">
          <div className="px-3 py-2 bg-gray-50 dark:bg-[#2a2a3c] border-b border-gray-200 dark:border-[#3a3a4e] text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Events ({events.length})
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {error && (
              <div className="px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
                {error}
              </div>
            )}
            {events.length === 0 && !error && (
              <div className="text-sm text-gray-400 dark:text-gray-500 text-center py-8">
                {connected ? 'Waiting for events...' : 'No events yet'}
              </div>
            )}
            {events.map((event, idx) => (
              <EventCard
                key={idx}
                event={event}
                onApprove={handleApprove}
                onReject={handleReject}
              />
            ))}
            <div ref={eventsEndRef} />
          </div>
        </div>

        {/* Right pane: Mermaid diagram */}
        <div className="w-2/5 flex flex-col overflow-hidden">
          <div className="flex-1 min-h-0">
            {mermaid ? (
              <MermaidDiagram code={mermaid} className="h-full" />
            ) : (
              <div className="text-sm text-gray-400 dark:text-gray-500 text-center py-8">
                Loading diagram...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function EventCard({ event, onApprove, onReject }: {
  event: RunEvent;
  onApprove: (requestId: string) => void;
  onReject: (requestId: string) => void;
}) {
  const type = event.type || 'unknown';

  // Human input required — show approve/reject buttons
  if (type === 'human_input_required' && event.request_id) {
    return (
      <div className="px-3 py-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
        <div className="flex items-center gap-2 text-sm font-medium text-yellow-700 dark:text-yellow-400 mb-2">
          ⏸ Human Input Required
        </div>
        {event.data != null && (
          <div className="text-sm text-gray-600 dark:text-gray-300 mb-2">
            {typeof event.data === 'string' ? event.data : JSON.stringify(event.data as Record<string, unknown>, null, 2)}
          </div>
        )}
        <div className="flex gap-2">
          <button
            onClick={() => onApprove(event.request_id!)}
            className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 transition-colors"
          >
            ✓ Approve
          </button>
          <button
            onClick={() => onReject(event.request_id!)}
            className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 transition-colors"
          >
            ✕ Reject
          </button>
        </div>
      </div>
    );
  }

  // Completion events
  if (type === 'workflow_completed' || type === 'run_complete') {
    const status = event.status || 'completed';
    const isSuccess = status === 'completed';
    return (
      <div className={`px-3 py-2 rounded-lg border text-sm ${
        isSuccess
          ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400'
          : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'
      }`}>
        {isSuccess ? '✅ Workflow completed' : `❌ Workflow ${status}`}
      </div>
    );
  }

  // Error events
  if (type === 'workflow_failed') {
    return (
      <div className="px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
        ❌ {event.error || 'Workflow failed'}
      </div>
    );
  }

  // Start event
  if (type === 'workflow_started') {
    return (
      <div className="px-3 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-sm text-blue-700 dark:text-blue-400">
        🚀 Workflow started: {(event.workflow_name as string) || ''}
      </div>
    );
  }

  // Generic event — show all available details
  const icon = type.includes('invoke') || type.includes('start') ? '⚙️' :
    type.includes('complete') ? '✅' :
    type.includes('fail') || type.includes('error') ? '❌' :
    type.includes('input') ? '💬' : '📋';

  // Build a human-readable label
  const label = type.replace(/_/g, ' ');
  const nodeId = event.executor_id || event.source_executor_id;

  return (
    <div className="px-3 py-2 bg-white/50 dark:bg-[#2a2a3c]/50 border border-white/40 dark:border-[#3a3a4e] rounded-lg text-sm">
      <div className="flex items-center gap-2">
        <span>{icon}</span>
        <span className="font-medium text-gray-700 dark:text-gray-300">{label}</span>
        {nodeId && (
          <span className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs rounded font-mono">
            {nodeId}
          </span>
        )}
        {event.iteration != null && (
          <span className="text-xs text-gray-400 dark:text-gray-500">step {event.iteration}</span>
        )}
      </div>
      {event.state && (
        <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          State: <span className="font-medium">{event.state}</span>
        </div>
      )}
      {event.data != null && (
        <div className="mt-1 text-gray-600 dark:text-gray-400 text-xs whitespace-pre-wrap font-mono bg-gray-50 dark:bg-[#1e1e2e] rounded p-2 max-h-32 overflow-y-auto">
          {typeof event.data === 'string' ? event.data : JSON.stringify(event.data, null, 2)}
        </div>
      )}
      {event.output && (
        <div className="mt-1 text-gray-600 dark:text-gray-400 text-xs whitespace-pre-wrap">
          {typeof event.output === 'string' ? event.output : JSON.stringify(event.output, null, 2)}
        </div>
      )}
      {(event.error_message || event.error) && (
        <div className="mt-1 text-red-500 text-xs">
          {event.error_type && <span className="font-medium">{event.error_type}: </span>}
          {event.error_message || event.error}
        </div>
      )}
    </div>
  );
}
