/**
 * Task Run Detail — shows full output and metadata for a single task run.
 */

import { useEffect, useState } from 'react';
import { formatDateTime } from '../../utils/formatters';
import { getTaskRun, abortTaskRun } from '../../api/automations';
import type { TaskRun, TaskRunStatus } from '../../types/automation';

const STATUS_CONFIG: Record<TaskRunStatus, { label: string; color: string; bg: string; darkColor: string; darkBg: string }> = {
  pending: { label: 'Pending', color: 'text-amber-700', bg: 'bg-amber-100', darkColor: 'dark:text-amber-400', darkBg: 'dark:bg-amber-900/30' },
  running: { label: 'Running', color: 'text-blue-700', bg: 'bg-blue-100', darkColor: 'dark:text-blue-400', darkBg: 'dark:bg-blue-900/30' },
  completed: { label: 'Completed', color: 'text-emerald-700', bg: 'bg-emerald-100', darkColor: 'dark:text-emerald-400', darkBg: 'dark:bg-emerald-900/30' },
  failed: { label: 'Failed', color: 'text-red-700', bg: 'bg-red-100', darkColor: 'dark:text-red-400', darkBg: 'dark:bg-red-900/30' },
  timed_out: { label: 'Timed Out', color: 'text-orange-700', bg: 'bg-orange-100', darkColor: 'dark:text-orange-400', darkBg: 'dark:bg-orange-900/30' },
  aborted: { label: 'Aborted', color: 'text-gray-700', bg: 'bg-gray-100', darkColor: 'dark:text-gray-400', darkBg: 'dark:bg-gray-800' },
};

function formatDuration(seconds: number | null): string {
  if (seconds === null) return '—';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}m ${secs}s`;
}

function MetaRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex gap-2">
      <span className="text-sm font-medium text-gray-500 dark:text-gray-400 w-32 shrink-0">{label}</span>
      <span className="text-sm text-gray-900 dark:text-gray-100 break-all">{value}</span>
    </div>
  );
}

export function TaskRunDetail({ runId }: { runId: string }) {
  const [run, setRun] = useState<TaskRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const data = await getTaskRun(runId);
        if (!cancelled) setRun(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    // Poll if running
    const interval = setInterval(async () => {
      try {
        const data = await getTaskRun(runId);
        if (!cancelled) {
          setRun(data);
          if (data.status !== 'running' && data.status !== 'pending') {
            clearInterval(interval);
          }
        }
      } catch { /* ignore poll errors */ }
    }, 3000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [runId]);

  const handleAbort = async () => {
    try {
      await abortTaskRun(runId);
      const data = await getTaskRun(runId);
      setRun(data);
    } catch (e) {
      console.error('Failed to abort:', e);
    }
  };

  if (loading) {
    return <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-500">Loading...</div>;
  }
  if (error || !run) {
    return <div className="flex-1 flex items-center justify-center text-red-500 dark:text-red-400">{error || 'Not found'}</div>;
  }

  const statusConfig = STATUS_CONFIG[run.status] || STATUS_CONFIG.pending;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{run.agent_name}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Task Run · {run.id}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusConfig.bg} ${statusConfig.color} ${statusConfig.darkBg} ${statusConfig.darkColor}`}>
              {run.status === 'running' && <span className="mr-1.5 animate-pulse">●</span>}
              {statusConfig.label}
            </span>
            {run.status === 'running' && (
              <button
                onClick={handleAbort}
                className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                ⛔ Abort
              </button>
            )}
          </div>
        </div>

        {/* Metadata */}
        <div className="bg-white/50 dark:bg-[#2a2a3c]/50 backdrop-blur border border-white/40 dark:border-[#3a3a4e] rounded-xl p-5 mb-6 space-y-2">
          <MetaRow label="Prompt" value={run.prompt} />
          <MetaRow label="Working Dir" value={run.cwd} />
          <MetaRow label="Started" value={run.started_at ? formatDateTime(run.started_at) : null} />
          <MetaRow label="Completed" value={run.completed_at ? formatDateTime(run.completed_at) : null} />
          <MetaRow label="Duration" value={formatDuration(run.duration_seconds)} />
          {run.token_usage && (
            <MetaRow
              label="Tokens"
              value={Object.entries(run.token_usage).map(([k, v]) => `${k}: ${v}`).join(' · ')}
            />
          )}
        </div>

        {/* Error */}
        {run.error && (
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl p-5 mb-6">
            <h3 className="text-sm font-semibold text-red-800 dark:text-red-400 mb-1">Error</h3>
            <pre className="text-sm text-red-700 dark:text-red-400 whitespace-pre-wrap">{run.error}</pre>
          </div>
        )}

        {/* Output */}
        <div className="bg-white/50 dark:bg-[#2a2a3c]/50 backdrop-blur border border-white/40 dark:border-[#3a3a4e] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Output</h3>
          {run.output ? (
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <pre className="whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200 bg-white/40 dark:bg-[#1e1e2e]/40 p-4 rounded-lg overflow-x-auto">
                {run.output}
              </pre>
            </div>
          ) : (
            <p className="text-sm text-gray-400 dark:text-gray-500 italic">
              {run.status === 'running' ? 'Collecting output...' : 'No output'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
