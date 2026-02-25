/**
 * Generic tab management store.
 * Supports multiple tab types: chat sessions, ralph monitor, file viewer, etc.
 */

import { create } from 'zustand';

export type TabType = 'session' | 'ralph-monitor' | 'file' | 'agent-library' | 'agent-detail' | 'schedule-manager' | 'task-board' | 'task-run-detail' | 'workflow-library' | 'workflow-editor' | 'workflow-run';

export interface Tab {
  id: string;           // "session:<uuid>", "ralph-monitor", "file:<path>", "agent-library", "agent:<id>", "schedule-manager", "task-board", "task-run:<id>", "workflow-library", "workflow:<id>", "workflow-run:<id>"
  type: TabType;
  label: string;
  sessionId?: string;   // for type='session'
  filePath?: string;    // for type='file'
  agentId?: string;     // for type='agent-detail'
  runId?: string;       // for type='task-run-detail' or 'workflow-run'
  scheduleId?: string;  // for type='task-board' (optional filter)
  workflowId?: string;  // for type='workflow-editor' or 'workflow-run'
}

interface TabState {
  tabs: Tab[];
  activeTabId: string | null;
  mruStack: string[];   // Most-recently-used order (top = most recent)

  // Core actions
  openTab: (tab: Tab) => void;
  closeTab: (tabId: string) => void;
  switchTab: (tabId: string) => void;
  updateTabLabel: (tabId: string, label: string) => void;
  replaceTab: (oldTabId: string, newTab: Tab) => void;

  // Convenience helpers
  getActiveSessionId: () => string | null;
  getOpenSessionIds: () => string[];
  isTabOpen: (tabId: string) => boolean;
}

// Helper to build tab IDs
export const tabId = {
  session: (sessionId: string) => `session:${sessionId}`,
  ralphMonitor: () => 'ralph-monitor',
  file: (filePath: string) => `file:${filePath}`,
  agentLibrary: () => 'agent-library',
  agentDetail: (agentId: string) => `agent:${agentId}`,
  scheduleManager: () => 'schedule-manager',
  taskBoard: (scheduleId?: string) => scheduleId ? `task-board:${scheduleId}` : 'task-board',
  taskRunDetail: (runId: string) => `task-run:${runId}`,
  workflowLibrary: () => 'workflow-library',
  workflowEditor: (workflowId: string) => `workflow:${workflowId}`,
  workflowRun: (runId: string) => `workflow-run:${runId}`,
};

// Helper to extract session ID from a tab ID
export function sessionIdFromTabId(id: string): string | null {
  if (id.startsWith('session:')) return id.slice(8);
  return null;
}

export const useTabStore = create<TabState>((set, get) => ({
  tabs: [],
  activeTabId: null,
  mruStack: [],

  openTab: (tab) =>
    set((state) => {
      const existing = state.tabs.find((t) => t.id === tab.id);
      if (existing) {
        // Tab already open — activate it, update mutable fields (agentId, label, etc.), move to top of MRU
        return {
          tabs: state.tabs.map((t) => (t.id === tab.id ? { ...t, ...tab } : t)),
          activeTabId: tab.id,
          mruStack: [tab.id, ...state.mruStack.filter((id) => id !== tab.id)],
        };
      }
      return {
        tabs: [...state.tabs, tab],
        activeTabId: tab.id,
        mruStack: [tab.id, ...state.mruStack],
      };
    }),

  closeTab: (closingTabId) =>
    set((state) => {
      const newTabs = state.tabs.filter((t) => t.id !== closingTabId);
      const newMruStack = state.mruStack.filter((id) => id !== closingTabId);
      let newActiveId = state.activeTabId;

      if (state.activeTabId === closingTabId) {
        // Activate the most recently used tab, or null if none left
        newActiveId = newMruStack[0] || null;
      }

      return { tabs: newTabs, activeTabId: newActiveId, mruStack: newMruStack };
    }),

  switchTab: (targetTabId) =>
    set((state) => {
      if (state.tabs.some((t) => t.id === targetTabId)) {
        return {
          activeTabId: targetTabId,
          mruStack: [targetTabId, ...state.mruStack.filter((id) => id !== targetTabId)],
        };
      }
      return state;
    }),

  updateTabLabel: (targetTabId, label) =>
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === targetTabId ? { ...t, label } : t)),
    })),

  replaceTab: (oldTabId, newTab) =>
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === oldTabId ? newTab : t)),
      activeTabId: state.activeTabId === oldTabId ? newTab.id : state.activeTabId,
      mruStack: state.mruStack.map((id) => (id === oldTabId ? newTab.id : id)),
    })),

  getActiveSessionId: () => {
    const { activeTabId, tabs } = get();
    if (!activeTabId) return null;
    const tab = tabs.find((t) => t.id === activeTabId);
    if (tab?.type === 'session' && tab.sessionId) return tab.sessionId;
    return null;
  },

  getOpenSessionIds: () => {
    return get()
      .tabs.filter((t) => t.type === 'session' && t.sessionId)
      .map((t) => t.sessionId!);
  },

  isTabOpen: (targetTabId) => {
    return get().tabs.some((t) => t.id === targetTabId);
  },
}));
