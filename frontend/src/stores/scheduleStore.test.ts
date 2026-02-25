import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useScheduleStore } from './scheduleStore';
import type { ScheduleWithNextRun } from '../types/schedule';

vi.mock('../api/schedules', () => ({
  listSchedules: vi.fn(),
}));

import { listSchedules } from '../api/schedules';

const initialState = useScheduleStore.getState();

function resetStore() {
  useScheduleStore.setState(initialState, true);
  vi.clearAllMocks();
}

function makeSchedule(id: string, overrides: Partial<ScheduleWithNextRun> = {}): ScheduleWithNextRun {
  return {
    id,
    agent_id: 'agent-1',
    name: `Schedule ${id}`,
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

describe('scheduleStore', () => {
  beforeEach(resetStore);

  // --- fetchSchedules ---
  describe('fetchSchedules', () => {
    it('loads schedules and clears loading state', async () => {
      const schedules = [makeSchedule('sc1'), makeSchedule('sc2')];
      vi.mocked(listSchedules).mockResolvedValue(schedules);

      await useScheduleStore.getState().fetchSchedules();

      const state = useScheduleStore.getState();
      expect(state.schedules).toHaveLength(2);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('sets loading true while fetching', async () => {
      let resolveFn: (value: ScheduleWithNextRun[]) => void;
      vi.mocked(listSchedules).mockImplementation(
        () => new Promise((resolve) => { resolveFn = resolve; }),
      );

      const promise = useScheduleStore.getState().fetchSchedules();
      expect(useScheduleStore.getState().loading).toBe(true);

      resolveFn!([]);
      await promise;
      expect(useScheduleStore.getState().loading).toBe(false);
    });

    it('sets error on failure', async () => {
      vi.mocked(listSchedules).mockRejectedValue(new Error('Network error'));

      await useScheduleStore.getState().fetchSchedules();

      const state = useScheduleStore.getState();
      expect(state.error).toBe('Network error');
      expect(state.loading).toBe(false);
      expect(state.schedules).toEqual([]);
    });

    it('clears previous error on new fetch', async () => {
      vi.mocked(listSchedules).mockRejectedValueOnce(new Error('fail'));
      await useScheduleStore.getState().fetchSchedules();
      expect(useScheduleStore.getState().error).toBe('fail');

      vi.mocked(listSchedules).mockResolvedValueOnce([]);
      await useScheduleStore.getState().fetchSchedules();
      expect(useScheduleStore.getState().error).toBeNull();
    });
  });

  // --- setSchedules ---
  describe('setSchedules', () => {
    it('sets schedules directly', () => {
      const schedules = [makeSchedule('sc1')];
      useScheduleStore.getState().setSchedules(schedules);
      expect(useScheduleStore.getState().schedules).toHaveLength(1);
      expect(useScheduleStore.getState().schedules[0].id).toBe('sc1');
    });

    it('replaces existing schedules', () => {
      useScheduleStore.getState().setSchedules([makeSchedule('sc1')]);
      useScheduleStore.getState().setSchedules([makeSchedule('sc2')]);
      const ids = useScheduleStore.getState().schedules.map((s) => s.id);
      expect(ids).toEqual(['sc2']);
    });

    it('can set to empty array', () => {
      useScheduleStore.getState().setSchedules([makeSchedule('sc1')]);
      useScheduleStore.getState().setSchedules([]);
      expect(useScheduleStore.getState().schedules).toEqual([]);
    });
  });
});
