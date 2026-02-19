import { useEffect } from 'react';
import { useSessionStore } from '../../stores/sessionStore';
import { useUIStore } from '../../stores/uiStore';
import { useRalphStore } from '../../stores/ralphStore';
import { useTabStore, tabId } from '../../stores/tabStore';
import { useAgentMonitorStore } from '../../stores/agentMonitorStore';
import { useAgentStore } from '../../stores/agentStore';
import { listSessions } from '../../api/sessions';
import { fetchModels } from '../../api/models';
import { getSettings } from '../../api/settings';
import { getActiveAgents } from '../../api/activeAgents';
import { SessionList } from '../session/SessionList';
import { Button } from '../common/Button';
import { useFeatureFlags } from '../../hooks/useFeatureFlags';

export function Sidebar() {
  const { sessions, setSessions, startNewSession, setLoading, setError } = useSessionStore();
  const { setAvailableModels, setDefaultModel, setDefaultCwd, openSettingsModal, defaultModel, defaultCwd, availableModels } = useUIStore();
  const { runs, refreshRuns } = useRalphStore();
  const { activeTabId, openTab } = useTabStore();
  const { setOpen: setAgentMonitorOpen, activeCount, setActiveCount } = useAgentMonitorStore();
  const { agents, fetchAgents } = useAgentStore();
  const { hasFlag } = useFeatureFlags();
  const showRalph = hasFlag('ralph');

  // Get display name for current model
  const currentModelName = availableModels.find(m => m.id === defaultModel)?.name || defaultModel;
  
  // Count active Ralph runs
  const activeRunCount = runs.filter(r => ['pending', 'running', 'paused'].includes(r.status)).length;

  // Poll for active agents count every 5 seconds
  useEffect(() => {
    const fetchActiveCount = async () => {
      try {
        const data = await getActiveAgents();
        setActiveCount(data.count);
      } catch {
        // Ignore errors for polling
      }
    };
    
    fetchActiveCount();
    const interval = setInterval(fetchActiveCount, 5000);
    return () => clearInterval(interval);
  }, [setActiveCount]);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [sessionsData, modelsData, settingsData] = await Promise.all([
          listSessions(),
          fetchModels(),
          getSettings(),
        ]);
        setSessions(sessionsData);
        setAvailableModels(modelsData);
        setDefaultModel(settingsData.default_model);
        if (settingsData.default_cwd) {
          setDefaultCwd(settingsData.default_cwd);
        }
        fetchAgents();
      } catch (err) {
        // Backend may not be ready yet (dev mode race) — retry once after 2s
        console.warn('Initial load failed, retrying in 2s...', err);
        await new Promise(r => setTimeout(r, 2000));
        try {
          const [sessionsData, modelsData, settingsData] = await Promise.all([
            listSessions(),
            fetchModels(),
            getSettings(),
          ]);
          setSessions(sessionsData);
          setAvailableModels(modelsData);
          setDefaultModel(settingsData.default_model);
          if (settingsData.default_cwd) {
            setDefaultCwd(settingsData.default_cwd);
          }
          fetchAgents();
        } catch (retryErr) {
          setError(retryErr instanceof Error ? retryErr.message : 'Failed to load data');
        }
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [setSessions, setAvailableModels, setDefaultModel, setDefaultCwd, setLoading, setError, fetchAgents]);

  const handleNewSession = async () => {
    // startNewSession now refreshes MCP servers automatically and enables all by default
    await startNewSession(defaultModel, defaultCwd);
  };

  return (
    <aside className="w-72 bg-white dark:bg-[#252536] text-gray-900 dark:text-gray-100 flex flex-col overflow-y-auto border-r border-gray-200 dark:border-[#3a3a4e] shadow-sm dark:shadow-black/20">
      {/* Header - sticky at top */}
      <div className="sticky top-0 bg-white dark:bg-[#252536] p-4 border-b border-gray-200 dark:border-[#3a3a4e] z-10">
        <div className="flex items-center gap-2 mb-4">
          <svg className="w-8 h-8 text-emerald-500" viewBox="0 0 24 24" fill="currentColor">
            <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
          </svg>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Agent Console</h1>
        </div>
        <Button
          variant="primary"
          className="w-full"
          onClick={handleNewSession}
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Session
        </Button>

        {/* Ralph Monitor Button - only visible with ?features=ralph */}
        {showRalph && (() => {
          const ralphTabId = tabId.ralphMonitor();
          const isRalphActive = activeTabId === ralphTabId;
          return (
          <button
            onClick={() => {
              refreshRuns();
              openTab({ id: ralphTabId, type: 'ralph-monitor', label: 'Ralph Monitor' });
            }}
            className={`w-full mt-2 flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              isRalphActive
                ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800' 
                : 'bg-gray-50 dark:bg-[#2a2a3c] hover:bg-gray-100 dark:hover:bg-[#32324a] text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-[#3a3a4e]'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            Ralph Monitor
            {activeRunCount > 0 && (
              <span className="bg-emerald-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                {activeRunCount}
              </span>
            )}
          </button>
          );
        })()}

        {/* Agent Monitor Button */}
        <button
          onClick={() => setAgentMonitorOpen(true)}
          className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors bg-gray-50 dark:bg-[#2a2a3c] hover:bg-gray-100 dark:hover:bg-[#32324a] text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-[#3a3a4e]"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          Active Agents
          {activeCount > 0 && (
            <span className="relative flex h-5 min-w-5 items-center justify-center">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex items-center justify-center rounded-full h-5 min-w-5 px-1 bg-emerald-500 text-white text-xs">
                {activeCount}
              </span>
            </span>
          )}
        </button>
      </div>

      {/* AGENTS Section */}
      <div className="px-3 pt-3 pb-1 border-b border-gray-200 dark:border-[#3a3a4e]">
        <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-2 mb-2">
          Agents
        </h2>
        <button
          onClick={() => {
            fetchAgents();
            openTab({ id: tabId.agentLibrary(), type: 'agent-library', label: 'Agent Library' });
          }}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm ${
            activeTabId === tabId.agentLibrary()
              ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#32324a]'
          }`}
        >
          <span>📚</span>
          Library
          {agents.length > 0 && (
            <span className="ml-auto text-xs text-gray-400 dark:text-gray-500">{agents.length}</span>
          )}
        </button>
        <button
          onClick={() => {
            openTab({ id: tabId.scheduleManager(), type: 'schedule-manager', label: 'Automations' });
          }}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm ${
            activeTabId?.startsWith('schedule-manager')
              ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#32324a]'
          }`}
        >
          <span>⏰</span>
          Automations
        </button>
        <button
          onClick={() => {
            openTab({ id: tabId.taskBoard(), type: 'task-board', label: 'Runs' });
          }}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm ${
            activeTabId === tabId.taskBoard()
              ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#32324a]'
          }`}
        >
          <span>📋</span>
          Runs
        </button>
      </div>

      {/* Session List - grows to fill space, overflow hidden for virtual scroll */}
      <div className="flex-1 overflow-hidden p-3">
        <SessionList sessions={sessions.filter(s => s.trigger !== 'schedule')} />
      </div>

      {/* User Settings Footer - sticky at bottom */}
      <div className="sticky bottom-0 p-4 border-t border-gray-200 dark:border-[#3a3a4e] bg-white dark:bg-[#252536]">
        <button
          onClick={openSettingsModal}
          className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-[#32324a] transition-colors"
        >
          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-sm font-medium text-white">
            U
          </div>
          <div className="flex-1 text-left">
            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Settings</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">{currentModelName}</div>
          </div>
          <svg className="w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>
    </aside>
  );
}
