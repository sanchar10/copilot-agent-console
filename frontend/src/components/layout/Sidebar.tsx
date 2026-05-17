import { useEffect, useState } from 'react';
import { useSessionStore } from '../../stores/sessionStore';
import { useUIStore } from '../../stores/uiStore';
import { useTabStore, tabId } from '../../stores/tabStore';
import { useAgentMonitorStore } from '../../stores/agentMonitorStore';
import { useAgentStore } from '../../stores/agentStore';
import { useWorkflowStore } from '../../stores/workflowStore';
import { useAutomationStore } from '../../stores/automationStore';
import { useProjectStore } from '../../stores/projectStore';
import { listSessions } from '../../api/sessions';
import { fetchModels } from '../../api/models';
import { getSettings } from '../../api/settings';
import { getAuthStatus } from '../../api/auth';
import { subscribeToActiveAgents } from '../../api/activeAgents';
import { apiClient } from '../../api/client';
import { useViewedStore } from '../../stores/viewedStore';
import { Dropdown } from '../common/Dropdown';
import { Modal } from '../common/Modal';
import { withRetry } from '../../utils/retry';
import { isUserSession } from '../../utils/sessionFilters';
import { SessionList } from '../session/SessionList';
import { Button } from '../common/Button';
import { SearchModal } from '../search/SearchModal';
import { useAuthStore } from '../../stores/authStore';
import { useToastStore } from '../../stores/toastStore';

export function Sidebar() {
  const { sessions, setSessions, startNewSession, setLoading, setError } = useSessionStore();
  const { setAvailableModels, setDefaultModel, setDefaultReasoningEffort, setDefaultCwd, openSettingsModal, defaultModel, defaultReasoningEffort, defaultCwd } = useUIStore();
  const { activeTabId, openTab } = useTabStore();
  const { setOpen: setAgentMonitorOpen, activeCount, setActiveCount } = useAgentMonitorStore();
  const { agents, fetchAgents } = useAgentStore();
  const { workflows, fetchWorkflows } = useWorkflowStore();
  const { automations, fetchAutomations } = useAutomationStore();
  const { selectedProject, selectProject, loadProjects } = useProjectStore();
  // Subscribe to projects so component re-renders when mappings load
  const projects = useProjectStore(s => s.projects);
  const [searchOpen, setSearchOpen] = useState(false);
  const [appVersion, setAppVersion] = useState('');
  const [workflowInstallModal, setWorkflowInstallModal] = useState<{ command: string } | null>(null);
  const authStatus = useAuthStore(s => s.status);
  const setAuthStatus = useAuthStore(s => s.setStatus);

  // Inline helper that uses current projects state for reactivity
  const getProjectName = (cwd: string): string => {
    if (!cwd) return '';
    const norm = cwd.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
    for (const [storedCwd, name] of Object.entries(projects)) {
      if (storedCwd.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase() === norm) {
        return name;
      }
    }
    const normalized = cwd.replace(/\\/g, '/').replace(/\/+$/, '');
    return normalized.split('/').pop() || cwd;
  };

  const setActiveAgentIds = useViewedStore(s => s.setActiveAgentIds);

  // Detect macOS for keyboard shortcut labels
  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

  // Ctrl+K / Cmd+K global shortcut to open search
  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    document.addEventListener('keydown', handleGlobalKey);
    return () => document.removeEventListener('keydown', handleGlobalKey);
  }, []);

  // Subscribe to active-agents SSE stream — replaces polling
  useEffect(() => {
    const controller = subscribeToActiveAgents(
      (data) => {
        setActiveCount(data.count);
        setActiveAgentIds(new Set(data.sessions.map(s => s.session_id)));
      },
      (sessionId, updatedAt) => {
        // Agent completed: update the session's updated_at so hasUnread() works
        if (updatedAt) {
          const iso = new Date(updatedAt * 1000).toISOString();
          useSessionStore.getState().setSessions(
            useSessionStore.getState().sessions.map(s =>
              s.session_id === sessionId ? { ...s, updated_at: iso } : s
            )
          );
        }
        // If user is currently viewing this session, mark as viewed
        const activeSessionId = useTabStore.getState().getActiveSessionId();
        if (activeSessionId === sessionId) {
          useViewedStore.getState().markViewed(sessionId);
        }
      },
      (_error) => {
        // SSE disconnected — will auto-reconnect on next mount
      }
    );
    return () => controller.abort();
  }, [setActiveCount, setActiveAgentIds]);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [sessionsData, modelsData, settingsData, authData] = await withRetry(
          () => Promise.all([listSessions(), fetchModels(), getSettings(), getAuthStatus()]),
          { maxAttempts: 8, initialDelayMs: 2000, maxDelayMs: 2000 },
        );
        setSessions(sessionsData);
        setAvailableModels(modelsData);
        setAuthStatus(authData);
        // Heads-up toast on cold start when the user isn't signed in. Single-shot,
        // de-duped via stable id so a retry of loadData() doesn't stack a copy.
        // Auto-closes — we deliberately avoid persistent banner state to keep this
        // simple; users who miss the toast still get the lock icon in the sidebar.
        if (authData.authenticated === false) {
          useToastStore.getState().addToast(
            'Not signed in to GitHub Copilot. Sign in to enable chat, agents, and workflows.',
            'warning',
            {
              id: 'auth-required',
              duration: 8000,
              action: {
                label: 'Open Settings',
                onClick: () => openSettingsModal(),
              },
            }
          );
        }
        setDefaultModel(settingsData.default_model);
        setDefaultReasoningEffort(settingsData.default_reasoning_effort ?? null);
        if (settingsData.default_cwd) {
          setDefaultCwd(settingsData.default_cwd);
        }
        fetchAgents();
        fetchWorkflows();
        fetchAutomations();
        loadProjects();
        // Load desktop notification setting (non-blocking)
        if (settingsData.desktop_notifications) {
          import('../../utils/desktopNotifications').then(({ setDesktopNotificationSetting }) => {
            setDesktopNotificationSetting(settingsData.desktop_notifications as 'all' | 'input_only' | 'off');
          });
        }
        // Fetch app version (non-blocking, server is confirmed up)
        apiClient.get<{ current_version: string }>('/settings/update-check')
          .then(info => setAppVersion(info.current_version))
          .catch(() => {});
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [setSessions, setAvailableModels, setDefaultModel, setDefaultReasoningEffort, setDefaultCwd, setLoading, setError, fetchAgents, fetchWorkflows, fetchAutomations, loadProjects]);

  const handleNewSession = async () => {
    let cwd = defaultCwd;

    // When a project filter is active, use that project's folder as CWD
    if (selectedProject) {
      const match = sessions.find(
        s => isUserSession(s) && s.cwd && getProjectName(s.cwd) === selectedProject
      );
      if (match?.cwd) {
        // Verify the folder still exists via browse endpoint
        try {
          await apiClient.get(`/filesystem/browse?path=${encodeURIComponent(match.cwd)}`);
          cwd = match.cwd;
          useToastStore.getState().addToast(
            `Session working directory\nProject: ${selectedProject}\nFolder: ${match.cwd}`,
            'info',
          );
        } catch {
          useToastStore.getState().addToast(
            'Project folder not found, creating session in default folder',
            'warning',
          );
        }
      }
    }

    await startNewSession(defaultModel, cwd, defaultReasoningEffort);
  };

  return (
    <aside className="w-[264px] flex-shrink-0 bg-qd-bg-elev text-qd-text flex flex-col overflow-y-auto border-r border-qd-border">
      {/* Header - sticky at top */}
      <div className="sticky top-0 bg-qd-bg-elev px-4 pt-3 pb-3 border-b border-qd-border-soft z-10">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-[22px] h-[22px] rounded-qd-md bg-qd-accent text-qd-text-inv grid place-items-center flex-shrink-0">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
            </svg>
          </div>
          <h1 className="text-[13px] font-semibold tracking-[-0.01em] text-qd-text flex-1">Copilot Console</h1>
          <button
            onClick={() => setSearchOpen(true)}
            className="p-1 rounded-qd-sm text-qd-text-muted hover:text-qd-text hover:bg-qd-panel transition-colors"
            title={`Search sessions (${isMac ? '⌘K' : 'Ctrl+K'})`}
            aria-label="Search sessions"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
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

        {/* Agent Monitor Button */}
        <button
          onClick={() => setAgentMonitorOpen(true)}
          className="w-full mt-2 flex items-center justify-center gap-2 px-3 py-1.5 rounded-qd-md transition-colors text-sm bg-qd-panel hover:bg-qd-panel-deep text-qd-text-dim border border-qd-border-soft"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          Active Agents
          {activeCount > 0 && (
            <span className="relative flex h-5 min-w-5 items-center justify-center">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: 'var(--status-running)' }}></span>
              <span className="relative inline-flex items-center justify-center rounded-full h-5 min-w-5 px-1 text-white text-xs" style={{ background: 'var(--status-running)' }}>
                {activeCount}
              </span>
            </span>
          )}
        </button>
      </div>

      {/* Navigation — flat entries */}
      <div className="px-3 pt-2 pb-1 border-b border-qd-border-soft">
        <button
          onClick={() => {
            fetchAgents();
            openTab({ id: tabId.agentLibrary(), type: 'agent-library', label: 'Agent Library' });
          }}
          className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-qd-sm transition-colors text-sm ${
            activeTabId === tabId.agentLibrary()
              ? 'bg-qd-panel-deep text-qd-text'
              : 'text-qd-text-dim hover:bg-qd-panel hover:text-qd-text'
          }`}
        >
          <span>🤖</span>
          Agents
          {agents.length > 0 && (
            <span className="ml-auto text-[11px] font-mono text-qd-text-muted">{agents.length}</span>
          )}
        </button>
        <button
          onClick={() => {
            fetchAutomations();
            openTab({ id: tabId.automationManager(), type: 'automation-manager', label: 'Automations' });
          }}
          className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-qd-sm transition-colors text-sm ${
            activeTabId?.startsWith('automation-manager')
              ? 'bg-qd-panel-deep text-qd-text'
              : 'text-qd-text-dim hover:bg-qd-panel hover:text-qd-text'
          }`}
        >
          <span>⏰</span>
          Automations
          {automations.length > 0 && (
            <span className="ml-auto text-[11px] font-mono text-qd-text-muted">{automations.length}</span>
          )}
        </button>
        <button
          onClick={() => {
            openTab({ id: tabId.taskBoard(), type: 'task-board', label: 'Runs' });
          }}
          className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-qd-sm transition-colors text-sm ${
            activeTabId === tabId.taskBoard()
              ? 'bg-qd-panel-deep text-qd-text'
              : 'text-qd-text-dim hover:bg-qd-panel hover:text-qd-text'
          }`}
        >
          <span>📋</span>
          Runs
        </button>
        <button
          onClick={async () => {
            try {
              const res = await apiClient.get<{ agent_framework: boolean; install_command: string }>('/features');
              if (!res.agent_framework) {
                setWorkflowInstallModal({ command: res.install_command });
                return;
              }
            } catch {
              // endpoint unavailable — proceed anyway
            }
            fetchWorkflows();
            openTab({ id: tabId.workflowLibrary(), type: 'workflow-library', label: 'Workflow Library' });
          }}
          className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-qd-sm transition-colors text-sm ${
            activeTabId === tabId.workflowLibrary()
              ? 'bg-qd-panel-deep text-qd-text'
              : 'text-qd-text-dim hover:bg-qd-panel hover:text-qd-text'
          }`}
        >
          <span>🔀</span>
          Workflows
          {workflows.length > 0 && (
            <span className="ml-auto text-[11px] font-mono text-qd-text-muted">{workflows.length}</span>
          )}
        </button>
      </div>

      {/* Session List - grows to fill space, overflow hidden for virtual scroll */}
      <div className="flex-1 overflow-hidden pl-4 pt-3 pb-3 flex flex-col">
        {/* Folder filter */}
        {sessions.length > 0 && (() => {
          // Build unique folder entries: { name, cwd (shortest path for that name) }
          const folderMap = new Map<string, string>(); // name → cwd
          sessions
            .filter(s => isUserSession(s) && s.cwd)
            .forEach(s => {
              const name = getProjectName(s.cwd!);
              if (!folderMap.has(name)) folderMap.set(name, s.cwd!);
            });
          const folderEntries = [...folderMap.entries()]
            .map(([name, cwd]) => {
              const segments = cwd.replace(/\\/g, '/').replace(/\/+$/, '').split('/').filter(Boolean);
              const shortPath = segments.length <= 3 ? cwd : '…/' + segments.slice(-2).join('/');
              return { name, path: shortPath, fullPath: cwd };
            })
            .sort((a, b) => a.name.localeCompare(b.name));
          const totalNonAutoSessions = sessions.filter(isUserSession).length;
          const dropdownOptions = [
            { value: '', label: `All Projects (${folderEntries.length}) · ${totalNonAutoSessions} sessions` },
            ...folderEntries.map(({ name, fullPath }) => {
              const count = sessions.filter(s => isUserSession(s) && s.cwd && getProjectName(s.cwd) === name).length;
              const suffix = ` · ${count} sessions`;
              const maxNameLen = 40 - suffix.length;
              const displayName = name.length > maxNameLen ? '…' + name.slice(-maxNameLen + 1) : name;
              return { value: name, label: `${displayName}${suffix}`, title: fullPath };
            }),
          ];
          return folderEntries.length > 1 ? (
            <Dropdown
              options={dropdownOptions}
              value={selectedProject || ''}
              onChange={v => selectProject(v || null)}
              variant="full"
              className="mb-2 mr-4"
              dropdownClassName="left-0 -right-4 max-h-[40vh]"
            />
          ) : null;
        })()}
        {sessions.length > 0 && (() => {
          const filteredSessions = sessions.filter(s => {
            if (!isUserSession(s)) return false;
            if (selectedProject) {
              if (!s.cwd) return false;
              if (getProjectName(s.cwd) !== selectedProject) return false;
            }
            return true;
          });
          return (
            <div className="flex-1 overflow-hidden">
              <SessionList sessions={filteredSessions} />
            </div>
          );
        })()}
      </div>

      {/* User Settings Footer - sticky at bottom */}
      <div className="sticky bottom-0 p-2 border-t border-qd-border-soft bg-qd-bg-elev">
        <button
          onClick={() => openSettingsModal()}
          title={`Settings${appVersion ? ` · v${appVersion}` : ''}${authStatus.authenticated === null ? ' · Checking auth...' : authStatus.authenticated ? ` · Authenticated via ${authStatus.provider || 'unknown'}` : ' · No auth configured'}`}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-qd-sm hover:bg-qd-panel transition-colors"
        >
          <span className="text-base">⚙️</span>
          <span className="flex-1 text-left text-sm font-medium text-qd-text">Settings</span>
          <span className="text-xs leading-none">{authStatus.authenticated === null ? '⏳' : authStatus.authenticated ? '🔒' : '🔐'}</span>
          {appVersion && <span className="text-[10px] leading-none font-mono text-qd-text-muted">v{appVersion}</span>}
        </button>
      </div>

      <SearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* Workflow install instructions modal */}
      <Modal
        isOpen={!!workflowInstallModal}
        onClose={() => setWorkflowInstallModal(null)}
        title="Install Agent Framework"
        footer={
          <Button onClick={() => setWorkflowInstallModal(null)}>OK</Button>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-qd-text-dim">
            Workflows require the <strong>Agent Framework</strong> package. Install it by running:
          </p>
          <pre className="bg-gray-100 dark:bg-gray-800 rounded-lg px-4 py-3 text-sm font-mono text-qd-text overflow-x-auto select-all">
            {workflowInstallModal?.command}
          </pre>
          <p className="text-xs text-qd-text-muted">
            After installing, restart Copilot Console for the changes to take effect.
          </p>
        </div>
      </Modal>
    </aside>
  );
}
