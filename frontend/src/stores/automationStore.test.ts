import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAutomationStore } from './automationStore';
import type { AutomationWithNextRun } from '../types/automation';

vi.mock('../api/automations', () => ({
  listAutomations: vi.fn(),
}));

import { listAutomations } from '../api/automations';

const initialState = useAutomationStore.getState();

function resetStore() {
  useAutomationStore.setState(initialState, true);
  vi.clearAllMocks();
}

function makeAutomation(id: string, overrides: Partial<AutomationWithNextRun> = {}): AutomationWithNextRun {
  return {
    id,
    agent_id: 'agent-1',
    name: `Automation ${id}`,
    cron: '0 * * * *',
    prompt: 'Do something',
    cwd: null,
    enabled: true,
    max_runtime_minutes: 30,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    next_run: null,
    agent_name: 'Test Agent',
    ...overrides,
  };
}

describe('automationStore', () => {
  beforeEach(resetStore);

  // --- fetchAutomations ---
  describe('fetchAutomations', () => {
    it('loads automations and clears loading state', async () => {
      const automations = [makeAutomation('sc1'), makeAutomation('sc2')];
      vi.mocked(listAutomations).mockResolvedValue(automations);

      await useAutomationStore.getState().fetchAutomations();

      const state = useAutomationStore.getState();
      expect(state.automations).toHaveLength(2);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('sets loading true while fetching', async () => {
      let resolveFn: (value: AutomationWithNextRun[]) => void;
      vi.mocked(listAutomations).mockImplementation(
        () => new Promise((resolve) => { resolveFn = resolve; }),
      );

      const promise = useAutomationStore.getState().fetchAutomations();
      expect(useAutomationStore.getState().loading).toBe(true);

      resolveFn!([]);
      await promise;
      expect(useAutomationStore.getState().loading).toBe(false);
    });

    it('sets error on failure', async () => {
      vi.mocked(listAutomations).mockRejectedValue(new Error('Network error'));

      await useAutomationStore.getState().fetchAutomations();

      const state = useAutomationStore.getState();
      expect(state.error).toBe('Network error');
      expect(state.loading).toBe(false);
      expect(state.automations).toEqual([]);
    });

    it('clears previous error on new fetch', async () => {
      vi.mocked(listAutomations).mockRejectedValueOnce(new Error('fail'));
      await useAutomationStore.getState().fetchAutomations();
      expect(useAutomationStore.getState().error).toBe('fail');

      vi.mocked(listAutomations).mockResolvedValueOnce([]);
      await useAutomationStore.getState().fetchAutomations();
      expect(useAutomationStore.getState().error).toBeNull();
    });
  });

  // --- setAutomations ---
  describe('setAutomations', () => {
    it('sets automations directly', () => {
      const automations = [makeAutomation('sc1')];
      useAutomationStore.getState().setAutomations(automations);
      expect(useAutomationStore.getState().automations).toHaveLength(1);
      expect(useAutomationStore.getState().automations[0].id).toBe('sc1');
    });

    it('replaces existing automations', () => {
      useAutomationStore.getState().setAutomations([makeAutomation('sc1')]);
      useAutomationStore.getState().setAutomations([makeAutomation('sc2')]);
      const ids = useAutomationStore.getState().automations.map((s) => s.id);
      expect(ids).toEqual(['sc2']);
    });

    it('can set to empty array', () => {
      useAutomationStore.getState().setAutomations([makeAutomation('sc1')]);
      useAutomationStore.getState().setAutomations([]);
      expect(useAutomationStore.getState().automations).toEqual([]);
    });
  });
});
