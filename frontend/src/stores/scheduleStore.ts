/**
 * Schedule store.
 * Manages schedule state for the Sidebar count and Schedule Manager.
 */

import { create } from 'zustand';
import type { ScheduleWithNextRun } from '../types/schedule';
import { listSchedules } from '../api/schedules';

interface ScheduleState {
  schedules: ScheduleWithNextRun[];
  loading: boolean;
  error: string | null;

  fetchSchedules: () => Promise<void>;
  setSchedules: (schedules: ScheduleWithNextRun[]) => void;
}

export const useScheduleStore = create<ScheduleState>((set) => ({
  schedules: [],
  loading: false,
  error: null,

  fetchSchedules: async () => {
    set({ loading: true, error: null });
    try {
      const schedules = await listSchedules();
      set({ schedules, loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  setSchedules: (schedules) => set({ schedules }),
}));
