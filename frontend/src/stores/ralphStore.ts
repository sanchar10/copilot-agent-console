/**
 * Ralph AI Runner store
 */

import { create } from 'zustand';
import type { ExecutionBatch, RalphRun, RunSummary } from '../api/ralph';
import * as ralphApi from '../api/ralph';

interface RalphState {
  // Data
  runs: RunSummary[];
  selectedRunId: string | null;
  selectedRun: RalphRun | null;
  selectedBatch: ExecutionBatch | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setRuns: (runs: RunSummary[]) => void;
  selectRun: (runId: string | null) => void;
  setSelectedRunDetails: (run: RalphRun | null, batch: ExecutionBatch | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  
  // API actions
  refreshRuns: () => Promise<void>;
  loadRunDetails: (runId: string) => Promise<void>;
  approveJob: (runId: string) => Promise<void>;
  skipJob: (runId: string) => Promise<void>;
  retryJob: (runId: string) => Promise<void>;
  submitFeedback: (runId: string, feedback: string) => Promise<void>;
  setAutoApprove: (runId: string, autoApprove: boolean) => Promise<void>;
  stopRun: (runId: string, force?: boolean) => Promise<void>;
  resumeRun: (runId: string) => Promise<void>;
  deleteRun: (runId: string) => Promise<void>;
}

export const useRalphStore = create<RalphState>((set, get) => ({
  // Initial state
  runs: [],
  selectedRunId: null,
  selectedRun: null,
  selectedBatch: null,
  isLoading: false,
  error: null,
  
  // Basic setters
  setRuns: (runs) => set({ runs }),
  selectRun: (runId) => set({ selectedRunId: runId }),
  setSelectedRunDetails: (run, batch) => set({ selectedRun: run, selectedBatch: batch }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  
  // API actions
  refreshRuns: async () => {
    try {
      const runs = await ralphApi.listRuns();
      set({ runs });
    } catch (error) {
      console.error('Failed to refresh runs:', error);
      set({ error: 'Failed to load runs' });
    }
  },
  
  loadRunDetails: async (runId) => {
    try {
      set({ isLoading: true, error: null });
      const { run, batch } = await ralphApi.getRunFull(runId);
      set({ selectedRun: run, selectedBatch: batch, selectedRunId: runId, isLoading: false });
    } catch (error) {
      console.error('Failed to load run details:', error);
      set({ error: 'Failed to load run details', isLoading: false });
    }
  },
  
  approveJob: async (runId) => {
    try {
      set({ isLoading: true, error: null });
      await ralphApi.approveJob(runId);
      await get().loadRunDetails(runId);
      await get().refreshRuns();
    } catch (error) {
      console.error('Failed to approve job:', error);
      set({ error: 'Failed to approve job', isLoading: false });
    }
  },
  
  skipJob: async (runId) => {
    try {
      set({ isLoading: true, error: null });
      await ralphApi.skipJob(runId);
      await get().loadRunDetails(runId);
      await get().refreshRuns();
    } catch (error) {
      console.error('Failed to skip job:', error);
      set({ error: 'Failed to skip job', isLoading: false });
    }
  },
  
  retryJob: async (runId) => {
    try {
      set({ isLoading: true, error: null });
      await ralphApi.retryJob(runId);
      await get().loadRunDetails(runId);
      await get().refreshRuns();
    } catch (error) {
      console.error('Failed to retry job:', error);
      set({ error: 'Failed to retry job', isLoading: false });
    }
  },
  
  submitFeedback: async (runId, feedback) => {
    try {
      set({ isLoading: true, error: null });
      await ralphApi.submitFeedback(runId, feedback);
      await get().loadRunDetails(runId);
      await get().refreshRuns();
    } catch (error) {
      console.error('Failed to submit feedback:', error);
      set({ error: 'Failed to submit feedback', isLoading: false });
    }
  },
  
  setAutoApprove: async (runId, autoApprove) => {
    try {
      await ralphApi.setAutoApprove(runId, autoApprove);
      await get().loadRunDetails(runId);
      await get().refreshRuns();
    } catch (error) {
      console.error('Failed to set auto-approve:', error);
      set({ error: 'Failed to set auto-approve' });
    }
  },
  
  stopRun: async (runId, force = false) => {
    try {
      set({ isLoading: true, error: null });
      await ralphApi.stopRun(runId, force);
      await get().loadRunDetails(runId);
      await get().refreshRuns();
    } catch (error) {
      console.error('Failed to stop run:', error);
      set({ error: 'Failed to stop run', isLoading: false });
    }
  },
  
  resumeRun: async (runId) => {
    try {
      set({ isLoading: true, error: null });
      await ralphApi.resumeRun(runId);
      await get().loadRunDetails(runId);
      await get().refreshRuns();
    } catch (error) {
      console.error('Failed to resume run:', error);
      set({ error: 'Failed to resume run', isLoading: false });
    }
  },
  
  deleteRun: async (runId) => {
    try {
      await ralphApi.deleteRun(runId);
      set((state) => ({
        runs: state.runs.filter((r) => r.id !== runId),
        selectedRunId: state.selectedRunId === runId ? null : state.selectedRunId,
        selectedRun: state.selectedRun?.id === runId ? null : state.selectedRun,
        selectedBatch: state.selectedRun?.id === runId ? null : state.selectedBatch,
      }));
    } catch (error) {
      console.error('Failed to delete run:', error);
      set({ error: 'Failed to delete run' });
    }
  },
}));
