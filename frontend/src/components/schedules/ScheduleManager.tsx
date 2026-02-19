/**
 * Schedule Manager — list and manage cron schedules for agents.
 */

import { useEffect, useState, useCallback } from 'react';
import { useAgentStore } from '../../stores/agentStore';
import { useTabStore, tabId } from '../../stores/tabStore';
import {
  listSchedules,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  toggleSchedule,
  runScheduleNow,
} from '../../api/schedules';
import { FolderBrowserModal } from '../common/FolderBrowserModal';
import type { ScheduleWithNextRun, CreateScheduleRequest, UpdateScheduleRequest } from '../../types/schedule';
import type { Agent } from '../../types/agent';

// --- Cron presets for common patterns ---
const CRON_PRESETS = [
  { label: 'Every hour', value: '0 * * * *' },
  { label: 'Every 6 hours', value: '0 */6 * * *' },
  { label: 'Daily at 8am', value: '0 8 * * *' },
  { label: 'Daily at midnight', value: '0 0 * * *' },
  { label: 'Weekdays at 9am', value: '0 9 * * 1-5' },
  { label: 'Weekly (Mon 9am)', value: '0 9 * * 1' },
  { label: 'Custom', value: '' },
];

function humanizeCron(cron: string): string {
  const parts = cron.split(' ');
  if (parts.length !== 5) return cron;
  const [min, hour, dom, mon, dow] = parts;
  if (min === '0' && hour === '*' && dom === '*' && mon === '*' && dow === '*') return 'Every hour';
  if (min === '0' && hour.startsWith('*/') && dom === '*' && mon === '*' && dow === '*') return `Every ${hour.slice(2)} hours`;
  if (dom === '*' && mon === '*' && dow === '*') return `Daily at ${hour}:${min.padStart(2, '0')}`;
  if (dom === '*' && mon === '*' && dow === '1-5') return `Weekdays at ${hour}:${min.padStart(2, '0')}`;
  if (dom === '*' && mon === '*' && dow === '1') return `Mondays at ${hour}:${min.padStart(2, '0')}`;
  return cron;
}

function StatusBadge({ enabled }: { enabled: boolean }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
      enabled ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
    }`}>
      {enabled ? 'Active' : 'Paused'}
    </span>
  );
}

// --- Create / Edit Dialog ---
function ScheduleDialog({
  agents,
  existing,
  defaultAgentId,
  onSave,
  onCancel,
}: {
  agents: Agent[];
  existing?: ScheduleWithNextRun;
  defaultAgentId?: string;
  onSave: (req: CreateScheduleRequest | UpdateScheduleRequest, id?: string) => void;
  onCancel: () => void;
}) {
  const isEdit = !!existing;
  const [agentId, setAgentId] = useState(existing?.agent_id || defaultAgentId || agents[0]?.id || '');
  const [name, setName] = useState(existing?.name || '');
  const [cron, setCron] = useState(existing?.cron || '0 8 * * *');
  const [cronPreset, setCronPreset] = useState(() => {
    const match = CRON_PRESETS.find((p) => p.value === (existing?.cron || '0 8 * * *'));
    return match ? match.value : '';
  });
  const [prompt, setPrompt] = useState(existing?.prompt || '');
  const [cwd, setCwd] = useState(existing?.cwd || '');
  const [maxRuntime, setMaxRuntime] = useState(existing?.max_runtime_minutes || 30);
  const [showFolderPicker, setShowFolderPicker] = useState(false);

  const handlePresetChange = (value: string) => {
    setCronPreset(value);
    if (value) setCron(value);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !cron.trim() || !prompt.trim()) return;
    if (isEdit) {
      onSave({
        name: name.trim(),
        cron: cron.trim(),
        prompt: prompt.trim(),
        cwd: cwd.trim() || null,
        max_runtime_minutes: maxRuntime,
      } as UpdateScheduleRequest, existing!.id);
    } else {
      if (!agentId) return;
      onSave({
        agent_id: agentId,
        name: name.trim(),
        cron: cron.trim(),
        prompt: prompt.trim(),
        cwd: cwd.trim() || null,
        max_runtime_minutes: maxRuntime,
      } as CreateScheduleRequest);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50">
        <form onSubmit={handleSubmit} className="bg-white/80 dark:bg-[#252536]/95 backdrop-blur-xl border border-white/30 dark:border-[#3a3a4e] rounded-2xl shadow-2xl p-6 w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto">
          <h2 className="text-lg font-semibold dark:text-gray-100">{isEdit ? 'Edit Schedule' : 'New Schedule'}</h2>

          {!isEdit && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Agent</label>
              <select
                value={agentId}
                onChange={(e) => setAgentId(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-[#1e1e2e] dark:border-gray-600 dark:text-gray-100"
              >
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>{a.icon} {a.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Schedule Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Morning news check"
              className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-[#1e1e2e] dark:border-gray-600 dark:text-gray-100"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Frequency</label>
            <select
              value={cronPreset}
              onChange={(e) => handlePresetChange(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm mb-2 dark:bg-[#1e1e2e] dark:border-gray-600 dark:text-gray-100"
            >
              {CRON_PRESETS.map((p) => (
                <option key={p.label} value={p.value}>{p.label}</option>
              ))}
            </select>
            <input
              type="text"
              value={cron}
              onChange={(e) => { setCron(e.target.value); setCronPreset(''); }}
              placeholder="Cron expression (e.g. 0 8 * * *)"
              className="w-full border rounded-lg px-3 py-2 text-sm font-mono dark:bg-[#1e1e2e] dark:border-gray-600 dark:text-gray-100"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Prompt</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="What should the agent do each run?"
              rows={3}
              className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-[#1e1e2e] dark:border-gray-600 dark:text-gray-100"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Working Directory</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={cwd}
                onChange={(e) => setCwd(e.target.value)}
                placeholder="Optional — uses default CWD if empty"
                className="flex-1 border rounded-lg px-3 py-2 text-sm font-mono dark:bg-[#1e1e2e] dark:border-gray-600 dark:text-gray-100"
              />
              <button
                type="button"
                onClick={() => setShowFolderPicker(true)}
                className="px-3 py-2 border border-white/40 dark:border-gray-600 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-white/40 dark:hover:bg-[#32324a] transition-colors shrink-0"
                title="Browse folders"
              >
                📁
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Max Runtime (minutes)</label>
            <input
              type="number"
              value={maxRuntime}
              onChange={(e) => setMaxRuntime(Number(e.target.value))}
              min={1}
              max={120}
              className="w-24 border rounded-lg px-3 py-2 text-sm dark:bg-[#1e1e2e] dark:border-gray-600 dark:text-gray-100"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200">
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              {isEdit ? 'Save Changes' : 'Create Schedule'}
            </button>
          </div>
        </form>
      </div>

      <FolderBrowserModal
        isOpen={showFolderPicker}
        onClose={() => setShowFolderPicker(false)}
        onSelect={(path) => setCwd(path)}
        initialPath={cwd || undefined}
      />
    </>
  );
}

// --- Schedule Card ---
function ScheduleCard({
  schedule,
  onEdit,
  onToggle,
  onDelete,
  onRunNow,
  onViewRuns,
}: {
  schedule: ScheduleWithNextRun;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
  onRunNow: () => void;
  onViewRuns: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div
      onClick={onEdit}
      className="bg-white/50 dark:bg-[#2a2a3c]/50 backdrop-blur border border-white/40 dark:border-[#3a3a4e] rounded-xl p-5 hover:border-blue-300/60 dark:hover:border-blue-500/40 hover:shadow-md transition-all cursor-pointer"
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">{schedule.name}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {schedule.agent_name} · {humanizeCron(schedule.cron)}
          </p>
        </div>
        <StatusBadge enabled={schedule.enabled} />
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-3">{schedule.prompt}</p>

      {schedule.cwd && (
        <p className="text-xs text-gray-400 dark:text-gray-500 font-mono mb-3 truncate" title={schedule.cwd}>
          📁 {schedule.cwd}
        </p>
      )}

      {schedule.next_run && schedule.enabled && (
        <p className="text-xs text-blue-600 dark:text-blue-400 mb-3">
          Next run: {new Date(schedule.next_run).toLocaleString()}
        </p>
      )}

      <div className="flex items-center gap-2 pt-2 border-t border-white/40 dark:border-[#3a3a4e]" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onToggle}
          className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
            schedule.enabled
              ? 'bg-amber-50/80 text-amber-700 hover:bg-amber-100/80 dark:bg-amber-900/30 dark:text-amber-400 dark:hover:bg-amber-900/50'
              : 'bg-emerald-50/80 text-emerald-700 hover:bg-emerald-100/80 dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-900/50'
          }`}
        >
          {schedule.enabled ? '⏸ Pause' : '▶ Enable'}
        </button>
        <button
          onClick={onRunNow}
          className="text-xs px-3 py-1.5 rounded-lg bg-blue-50/80 text-blue-700 hover:bg-blue-100/80 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 transition-colors"
        >
          🚀 Run Now
        </button>
        <button
          onClick={onViewRuns}
          className="text-xs px-3 py-1.5 rounded-lg bg-white/40 text-gray-600 hover:bg-white/60 dark:bg-[#1e1e2e]/40 dark:text-gray-400 dark:hover:bg-[#32324a] transition-colors"
        >
          📋 Runs
        </button>
        <div className="flex-1" />
        {confirming ? (
          <div className="flex gap-1">
            <button onClick={onDelete} className="text-xs px-2 py-1 rounded bg-red-600 text-white hover:bg-red-700">
              Confirm
            </button>
            <button onClick={() => setConfirming(false)} className="text-xs px-2 py-1 rounded bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600">
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            className="text-xs text-gray-400 hover:text-red-500 transition-colors"
          >
            🗑
          </button>
        )}
      </div>
    </div>
  );
}

// --- Main Component ---
interface ScheduleManagerProps {
  agentId?: string;     // optional initial agent filter
  agentName?: string;   // display name for filtered view
}

export function ScheduleManager({ agentId: initialAgentId }: ScheduleManagerProps) {
  const [schedules, setSchedules] = useState<ScheduleWithNextRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogMode, setDialogMode] = useState<'closed' | 'create' | 'edit'>('closed');
  const [editingSchedule, setEditingSchedule] = useState<ScheduleWithNextRun | undefined>();
  const [filterAgentId, setFilterAgentId] = useState<string>(initialAgentId || '');
  const { agents, fetchAgents } = useAgentStore();
  const { openTab } = useTabStore();

  // Sync filter when parent tab's agentId changes (singleton tab, re-opened with different agent)
  useEffect(() => {
    setFilterAgentId(initialAgentId || '');
  }, [initialAgentId]);

  const refresh = useCallback(async () => {
    try {
      const data = await listSchedules();
      setSchedules(data);
    } catch (e) {
      console.error('Failed to load schedules:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgents();
    refresh();
  }, [fetchAgents, refresh]);

  const filteredSchedules = filterAgentId
    ? schedules.filter((s) => s.agent_id === filterAgentId)
    : schedules;

  const handleSave = async (req: CreateScheduleRequest | UpdateScheduleRequest, id?: string) => {
    try {
      if (id) {
        await updateSchedule(id, req as UpdateScheduleRequest);
      } else {
        await createSchedule(req as CreateScheduleRequest);
      }
      setDialogMode('closed');
      setEditingSchedule(undefined);
      refresh();
    } catch (e) {
      console.error('Failed to save schedule:', e);
    }
  };

  const handleEdit = (schedule: ScheduleWithNextRun) => {
    setEditingSchedule(schedule);
    setDialogMode('edit');
  };

  const handleToggle = async (id: string) => {
    try {
      await toggleSchedule(id);
      refresh();
    } catch (e) {
      console.error('Failed to toggle schedule:', e);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteSchedule(id);
      refresh();
    } catch (e) {
      console.error('Failed to delete schedule:', e);
    }
  };

  const handleRunNow = async (id: string) => {
    try {
      await runScheduleNow(id);
      const schedule = schedules.find((s) => s.id === id);
      openTab({
        id: tabId.taskBoard(id),
        type: 'task-board',
        label: `Runs: ${schedule?.name || 'Schedule'}`,
        scheduleId: id,
      });
    } catch (e) {
      console.error('Failed to run schedule:', e);
    }
  };

  const handleViewRuns = (schedule: ScheduleWithNextRun) => {
    openTab({
      id: tabId.taskBoard(schedule.id),
      type: 'task-board',
      label: `Runs: ${schedule.name}`,
      scheduleId: schedule.id,
    });
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Automations</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Automated agent runs on cron schedules
            </p>
          </div>
          <button
            onClick={() => { setEditingSchedule(undefined); setDialogMode('create'); }}
            disabled={agents.length === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50"
          >
            + New Schedule
          </button>
        </div>

        {/* Agent filter */}
        {agents.length > 0 && (
          <div className="flex items-center gap-3 mb-4">
            <label className="text-sm text-gray-500 dark:text-gray-400">Filter by agent:</label>
            <select
              value={filterAgentId}
              onChange={(e) => setFilterAgentId(e.target.value)}
              className="border border-white/40 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm bg-white/50 dark:bg-[#1e1e2e] dark:text-gray-100"
            >
              <option value="">All Agents</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>{a.icon} {a.name}</option>
              ))}
            </select>
            {filterAgentId && (
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {filteredSchedules.length} schedule{filteredSchedules.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-gray-400 dark:text-gray-500">Loading...</div>
        ) : filteredSchedules.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">⏰</div>
            <p className="text-gray-500 dark:text-gray-400">
              {filterAgentId ? 'No schedules for this agent' : 'No schedules yet'}
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
              Create a schedule to run agents automatically
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredSchedules.map((s) => (
              <ScheduleCard
                key={s.id}
                schedule={s}
                onEdit={() => handleEdit(s)}
                onToggle={() => handleToggle(s.id)}
                onDelete={() => handleDelete(s.id)}
                onRunNow={() => handleRunNow(s.id)}
                onViewRuns={() => handleViewRuns(s)}
              />
            ))}
          </div>
        )}
      </div>

      {dialogMode !== 'closed' && (
        <ScheduleDialog
          agents={agents}
          existing={dialogMode === 'edit' ? editingSchedule : undefined}
          defaultAgentId={filterAgentId || undefined}
          onSave={handleSave}
          onCancel={() => { setDialogMode('closed'); setEditingSchedule(undefined); }}
        />
      )}
    </div>
  );
}
