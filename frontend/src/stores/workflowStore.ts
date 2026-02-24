/**
 * Workflow definition store.
 * Manages workflow CRUD state for the Workflow Library and Editor.
 */

import { create } from 'zustand';
import type { WorkflowMetadata, WorkflowCreate, WorkflowUpdate } from '../types/workflow';
import * as workflowsApi from '../api/workflows';

interface WorkflowState {
  workflows: WorkflowMetadata[];
  loading: boolean;
  error: string | null;

  // Actions
  fetchWorkflows: () => Promise<void>;
  createWorkflow: (request: WorkflowCreate) => Promise<WorkflowMetadata>;
  updateWorkflow: (workflowId: string, request: WorkflowUpdate) => Promise<WorkflowMetadata>;
  deleteWorkflow: (workflowId: string) => Promise<void>;
}

export const useWorkflowStore = create<WorkflowState>((set) => ({
  workflows: [],
  loading: false,
  error: null,

  fetchWorkflows: async () => {
    set({ loading: true, error: null });
    try {
      const workflows = await workflowsApi.listWorkflows();
      set({ workflows, loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  createWorkflow: async (request) => {
    const workflow = await workflowsApi.createWorkflow(request);
    set((state) => ({ workflows: [...state.workflows, workflow] }));
    return workflow;
  },

  updateWorkflow: async (workflowId, request) => {
    const updated = await workflowsApi.updateWorkflow(workflowId, request);
    set((state) => ({
      workflows: state.workflows.map((w) => (w.id === workflowId ? updated : w)),
    }));
    return updated;
  },

  deleteWorkflow: async (workflowId) => {
    await workflowsApi.deleteWorkflow(workflowId);
    set((state) => ({
      workflows: state.workflows.filter((w) => w.id !== workflowId),
    }));
  },
}));
