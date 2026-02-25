import { describe, it, expect, beforeEach } from 'vitest';
import { useTabStore, tabId, sessionIdFromTabId } from './tabStore';
import type { Tab } from './tabStore';

const initialState = useTabStore.getState();

function resetStore() {
  useTabStore.setState(initialState, true);
}

function makeSessionTab(sessionId: string, label = `Session ${sessionId}`): Tab {
  return { id: tabId.session(sessionId), type: 'session', label, sessionId };
}

function makeFileTab(filePath: string): Tab {
  return { id: tabId.file(filePath), type: 'file', label: filePath, filePath };
}

describe('tabStore', () => {
  beforeEach(resetStore);

  // --- tabId helpers ---
  describe('tabId helpers', () => {
    it('builds session tab id', () => {
      expect(tabId.session('abc')).toBe('session:abc');
    });

    it('builds ralph-monitor tab id', () => {
      expect(tabId.ralphMonitor()).toBe('ralph-monitor');
    });

    it('builds file tab id', () => {
      expect(tabId.file('/foo/bar.ts')).toBe('file:/foo/bar.ts');
    });

    it('builds agent-library tab id', () => {
      expect(tabId.agentLibrary()).toBe('agent-library');
    });

    it('builds agent-detail tab id', () => {
      expect(tabId.agentDetail('a1')).toBe('agent:a1');
    });

    it('builds workflow tab ids', () => {
      expect(tabId.workflowLibrary()).toBe('workflow-library');
      expect(tabId.workflowEditor('w1')).toBe('workflow:w1');
      expect(tabId.workflowRun('r1')).toBe('workflow-run:r1');
    });

    it('builds task-board tab id with and without scheduleId', () => {
      expect(tabId.taskBoard()).toBe('task-board');
      expect(tabId.taskBoard('s1')).toBe('task-board:s1');
    });
  });

  // --- sessionIdFromTabId ---
  describe('sessionIdFromTabId', () => {
    it('extracts session id from session tab id', () => {
      expect(sessionIdFromTabId('session:abc-123')).toBe('abc-123');
    });

    it('returns null for non-session tab id', () => {
      expect(sessionIdFromTabId('ralph-monitor')).toBeNull();
      expect(sessionIdFromTabId('file:/foo.ts')).toBeNull();
    });
  });

  // --- openTab ---
  describe('openTab', () => {
    it('adds a new tab and activates it', () => {
      const tab = makeSessionTab('s1');
      useTabStore.getState().openTab(tab);
      const state = useTabStore.getState();
      expect(state.tabs).toHaveLength(1);
      expect(state.activeTabId).toBe(tab.id);
    });

    it('adds tab to MRU stack', () => {
      useTabStore.getState().openTab(makeSessionTab('s1'));
      expect(useTabStore.getState().mruStack[0]).toBe(tabId.session('s1'));
    });

    it('activates existing tab without duplicating', () => {
      const tab = makeSessionTab('s1');
      useTabStore.getState().openTab(tab);
      useTabStore.getState().openTab(makeSessionTab('s2'));
      useTabStore.getState().openTab(tab);
      const state = useTabStore.getState();
      expect(state.tabs).toHaveLength(2);
      expect(state.activeTabId).toBe(tab.id);
    });

    it('updates mutable fields when reopening existing tab', () => {
      useTabStore.getState().openTab(makeSessionTab('s1', 'Old Label'));
      useTabStore.getState().openTab(makeSessionTab('s1', 'New Label'));
      const tab = useTabStore.getState().tabs.find((t) => t.sessionId === 's1');
      expect(tab?.label).toBe('New Label');
    });

    it('moves reopened tab to top of MRU', () => {
      useTabStore.getState().openTab(makeSessionTab('s1'));
      useTabStore.getState().openTab(makeSessionTab('s2'));
      useTabStore.getState().openTab(makeSessionTab('s1'));
      expect(useTabStore.getState().mruStack[0]).toBe(tabId.session('s1'));
    });
  });

  // --- closeTab ---
  describe('closeTab', () => {
    it('removes tab from tabs list', () => {
      useTabStore.getState().openTab(makeSessionTab('s1'));
      useTabStore.getState().closeTab(tabId.session('s1'));
      expect(useTabStore.getState().tabs).toHaveLength(0);
    });

    it('removes tab from MRU stack', () => {
      useTabStore.getState().openTab(makeSessionTab('s1'));
      useTabStore.getState().closeTab(tabId.session('s1'));
      expect(useTabStore.getState().mruStack).toHaveLength(0);
    });

    it('activates MRU tab when closing active tab', () => {
      useTabStore.getState().openTab(makeSessionTab('s1'));
      useTabStore.getState().openTab(makeSessionTab('s2'));
      useTabStore.getState().openTab(makeSessionTab('s3'));
      // MRU: [s3, s2, s1], active: s3
      useTabStore.getState().closeTab(tabId.session('s3'));
      expect(useTabStore.getState().activeTabId).toBe(tabId.session('s2'));
    });

    it('sets activeTabId to null when closing last tab', () => {
      useTabStore.getState().openTab(makeSessionTab('s1'));
      useTabStore.getState().closeTab(tabId.session('s1'));
      expect(useTabStore.getState().activeTabId).toBeNull();
    });

    it('does not change activeTabId when closing non-active tab', () => {
      useTabStore.getState().openTab(makeSessionTab('s1'));
      useTabStore.getState().openTab(makeSessionTab('s2'));
      // active is s2
      useTabStore.getState().closeTab(tabId.session('s1'));
      expect(useTabStore.getState().activeTabId).toBe(tabId.session('s2'));
    });
  });

  // --- switchTab ---
  describe('switchTab', () => {
    it('changes activeTabId', () => {
      useTabStore.getState().openTab(makeSessionTab('s1'));
      useTabStore.getState().openTab(makeSessionTab('s2'));
      useTabStore.getState().switchTab(tabId.session('s1'));
      expect(useTabStore.getState().activeTabId).toBe(tabId.session('s1'));
    });

    it('moves switched tab to top of MRU', () => {
      useTabStore.getState().openTab(makeSessionTab('s1'));
      useTabStore.getState().openTab(makeSessionTab('s2'));
      useTabStore.getState().switchTab(tabId.session('s1'));
      expect(useTabStore.getState().mruStack[0]).toBe(tabId.session('s1'));
    });

    it('does nothing for unknown tab id', () => {
      useTabStore.getState().openTab(makeSessionTab('s1'));
      useTabStore.getState().switchTab('nonexistent');
      expect(useTabStore.getState().activeTabId).toBe(tabId.session('s1'));
    });
  });

  // --- updateTabLabel ---
  describe('updateTabLabel', () => {
    it('updates label of an existing tab', () => {
      useTabStore.getState().openTab(makeSessionTab('s1', 'Old'));
      useTabStore.getState().updateTabLabel(tabId.session('s1'), 'New');
      const tab = useTabStore.getState().tabs[0];
      expect(tab.label).toBe('New');
    });

    it('does not affect other tabs', () => {
      useTabStore.getState().openTab(makeSessionTab('s1', 'Label 1'));
      useTabStore.getState().openTab(makeSessionTab('s2', 'Label 2'));
      useTabStore.getState().updateTabLabel(tabId.session('s1'), 'Updated');
      expect(useTabStore.getState().tabs[1].label).toBe('Label 2');
    });
  });

  // --- replaceTab ---
  describe('replaceTab', () => {
    it('replaces a tab in-place', () => {
      useTabStore.getState().openTab(makeSessionTab('s1'));
      const newTab = makeFileTab('/readme.md');
      useTabStore.getState().replaceTab(tabId.session('s1'), newTab);
      const state = useTabStore.getState();
      expect(state.tabs).toHaveLength(1);
      expect(state.tabs[0].type).toBe('file');
    });

    it('updates activeTabId if replaced tab was active', () => {
      useTabStore.getState().openTab(makeSessionTab('s1'));
      const newTab = makeFileTab('/readme.md');
      useTabStore.getState().replaceTab(tabId.session('s1'), newTab);
      expect(useTabStore.getState().activeTabId).toBe(newTab.id);
    });

    it('updates MRU stack entry', () => {
      useTabStore.getState().openTab(makeSessionTab('s1'));
      const newTab = makeFileTab('/readme.md');
      useTabStore.getState().replaceTab(tabId.session('s1'), newTab);
      expect(useTabStore.getState().mruStack).toContain(newTab.id);
      expect(useTabStore.getState().mruStack).not.toContain(tabId.session('s1'));
    });

    it('does not change activeTabId if replaced tab was not active', () => {
      useTabStore.getState().openTab(makeSessionTab('s1'));
      useTabStore.getState().openTab(makeSessionTab('s2'));
      // active is s2
      const newTab = makeFileTab('/readme.md');
      useTabStore.getState().replaceTab(tabId.session('s1'), newTab);
      expect(useTabStore.getState().activeTabId).toBe(tabId.session('s2'));
    });
  });

  // --- MRU stack behavior ---
  describe('MRU stack behavior', () => {
    it('maintains correct MRU order across opens and switches', () => {
      useTabStore.getState().openTab(makeSessionTab('s1'));
      useTabStore.getState().openTab(makeSessionTab('s2'));
      useTabStore.getState().openTab(makeSessionTab('s3'));
      // MRU: [s3, s2, s1]
      useTabStore.getState().switchTab(tabId.session('s1'));
      // MRU: [s1, s3, s2]
      const mru = useTabStore.getState().mruStack;
      expect(mru).toEqual([
        tabId.session('s1'),
        tabId.session('s3'),
        tabId.session('s2'),
      ]);
    });

    it('does not duplicate entries in MRU', () => {
      useTabStore.getState().openTab(makeSessionTab('s1'));
      useTabStore.getState().openTab(makeSessionTab('s1'));
      useTabStore.getState().switchTab(tabId.session('s1'));
      const mru = useTabStore.getState().mruStack;
      const unique = new Set(mru);
      expect(unique.size).toBe(mru.length);
    });
  });

  // --- isTabOpen ---
  describe('isTabOpen', () => {
    it('returns true for an open tab', () => {
      useTabStore.getState().openTab(makeSessionTab('s1'));
      expect(useTabStore.getState().isTabOpen(tabId.session('s1'))).toBe(true);
    });

    it('returns false for a closed tab', () => {
      expect(useTabStore.getState().isTabOpen(tabId.session('s1'))).toBe(false);
    });

    it('returns false after tab is closed', () => {
      useTabStore.getState().openTab(makeSessionTab('s1'));
      useTabStore.getState().closeTab(tabId.session('s1'));
      expect(useTabStore.getState().isTabOpen(tabId.session('s1'))).toBe(false);
    });
  });

  // --- getActiveSessionId ---
  describe('getActiveSessionId', () => {
    it('returns sessionId of active session tab', () => {
      useTabStore.getState().openTab(makeSessionTab('s1'));
      expect(useTabStore.getState().getActiveSessionId()).toBe('s1');
    });

    it('returns null when no tab is active', () => {
      expect(useTabStore.getState().getActiveSessionId()).toBeNull();
    });

    it('returns null when active tab is not a session', () => {
      useTabStore.getState().openTab(makeFileTab('/foo.ts'));
      expect(useTabStore.getState().getActiveSessionId()).toBeNull();
    });
  });

  // --- getOpenSessionIds ---
  describe('getOpenSessionIds', () => {
    it('returns all open session ids', () => {
      useTabStore.getState().openTab(makeSessionTab('s1'));
      useTabStore.getState().openTab(makeSessionTab('s2'));
      useTabStore.getState().openTab(makeFileTab('/foo.ts'));
      const ids = useTabStore.getState().getOpenSessionIds();
      expect(ids).toEqual(['s1', 's2']);
    });

    it('returns empty array when no sessions are open', () => {
      expect(useTabStore.getState().getOpenSessionIds()).toEqual([]);
    });
  });
});
