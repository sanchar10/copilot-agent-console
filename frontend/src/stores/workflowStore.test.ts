import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useWorkflowStore } from './workflowStore';
import type { WorkflowMetadata } from '../types/workflow';

vi.mock('../api/workflows', () => ({
  listWorkflows: vi.fn(),
  createWorkflow: vi.fn(),
  updateWorkflow: vi.fn(),
  deleteWorkflow: vi.fn(),
}));

import * as workflowsApi from '../api/workflows';

const initialState = useWorkflowStore.getState();

function resetStore() {
  useWorkflowStore.setState(initialState, true);
  vi.clearAllMocks();
}

function makeWorkflow(id: string, overrides: Partial<WorkflowMetadata> = {}): WorkflowMetadata {
  return {
    id,
    name: `Workflow ${id}`,
    description: 'A test workflow',
    yaml_filename: `${id}.yaml`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('workflowStore', () => {
  beforeEach(resetStore);

  // --- fetchWorkflows ---
  describe('fetchWorkflows', () => {
    it('loads workflows and clears loading state', async () => {
      const workflows = [makeWorkflow('w1'), makeWorkflow('w2')];
      vi.mocked(workflowsApi.listWorkflows).mockResolvedValue(workflows);

      await useWorkflowStore.getState().fetchWorkflows();

      const state = useWorkflowStore.getState();
      expect(state.workflows).toHaveLength(2);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('sets loading true while fetching', async () => {
      let resolveFn: (value: WorkflowMetadata[]) => void;
      vi.mocked(workflowsApi.listWorkflows).mockImplementation(
        () => new Promise((resolve) => { resolveFn = resolve; }),
      );

      const promise = useWorkflowStore.getState().fetchWorkflows();
      expect(useWorkflowStore.getState().loading).toBe(true);

      resolveFn!([]);
      await promise;
      expect(useWorkflowStore.getState().loading).toBe(false);
    });

    it('sets error on failure', async () => {
      vi.mocked(workflowsApi.listWorkflows).mockRejectedValue(new Error('Network error'));

      await useWorkflowStore.getState().fetchWorkflows();

      const state = useWorkflowStore.getState();
      expect(state.error).toBe('Network error');
      expect(state.loading).toBe(false);
      expect(state.workflows).toEqual([]);
    });

    it('clears previous error on new fetch', async () => {
      vi.mocked(workflowsApi.listWorkflows).mockRejectedValueOnce(new Error('fail'));
      await useWorkflowStore.getState().fetchWorkflows();
      expect(useWorkflowStore.getState().error).toBe('fail');

      vi.mocked(workflowsApi.listWorkflows).mockResolvedValueOnce([]);
      await useWorkflowStore.getState().fetchWorkflows();
      expect(useWorkflowStore.getState().error).toBeNull();
    });
  });

  // --- createWorkflow ---
  describe('createWorkflow', () => {
    it('adds created workflow to state and returns it', async () => {
      const workflow = makeWorkflow('new-1');
      vi.mocked(workflowsApi.createWorkflow).mockResolvedValue(workflow);

      const result = await useWorkflowStore.getState().createWorkflow({ name: 'New', yaml_content: 'steps: []' });

      expect(result).toEqual(workflow);
      expect(useWorkflowStore.getState().workflows).toHaveLength(1);
    });

    it('appends to existing workflows', async () => {
      useWorkflowStore.setState({ workflows: [makeWorkflow('existing')] });
      vi.mocked(workflowsApi.createWorkflow).mockResolvedValue(makeWorkflow('new-1'));

      await useWorkflowStore.getState().createWorkflow({ name: 'New', yaml_content: 'steps: []' });
      expect(useWorkflowStore.getState().workflows).toHaveLength(2);
    });

    it('propagates API errors', async () => {
      vi.mocked(workflowsApi.createWorkflow).mockRejectedValue(new Error('Create failed'));
      await expect(
        useWorkflowStore.getState().createWorkflow({ name: 'X', yaml_content: '' }),
      ).rejects.toThrow('Create failed');
    });
  });

  // --- updateWorkflow ---
  describe('updateWorkflow', () => {
    it('replaces the workflow in state', async () => {
      useWorkflowStore.setState({ workflows: [makeWorkflow('w1', { name: 'Old' })] });
      const updated = makeWorkflow('w1', { name: 'Updated' });
      vi.mocked(workflowsApi.updateWorkflow).mockResolvedValue(updated);

      const result = await useWorkflowStore.getState().updateWorkflow('w1', { name: 'Updated' });

      expect(result.name).toBe('Updated');
      expect(useWorkflowStore.getState().workflows[0].name).toBe('Updated');
    });

    it('does not affect other workflows', async () => {
      useWorkflowStore.setState({ workflows: [makeWorkflow('w1'), makeWorkflow('w2', { name: 'Keep' })] });
      vi.mocked(workflowsApi.updateWorkflow).mockResolvedValue(makeWorkflow('w1', { name: 'Changed' }));

      await useWorkflowStore.getState().updateWorkflow('w1', { name: 'Changed' });
      expect(useWorkflowStore.getState().workflows[1].name).toBe('Keep');
    });

    it('propagates API errors', async () => {
      vi.mocked(workflowsApi.updateWorkflow).mockRejectedValue(new Error('Update failed'));
      await expect(useWorkflowStore.getState().updateWorkflow('w1', { name: 'X' })).rejects.toThrow('Update failed');
    });
  });

  // --- deleteWorkflow ---
  describe('deleteWorkflow', () => {
    it('removes the workflow from state', async () => {
      useWorkflowStore.setState({ workflows: [makeWorkflow('w1'), makeWorkflow('w2')] });
      vi.mocked(workflowsApi.deleteWorkflow).mockResolvedValue(undefined);

      await useWorkflowStore.getState().deleteWorkflow('w1');
      const ids = useWorkflowStore.getState().workflows.map((w) => w.id);
      expect(ids).toEqual(['w2']);
    });

    it('propagates API errors', async () => {
      vi.mocked(workflowsApi.deleteWorkflow).mockRejectedValue(new Error('Delete failed'));
      await expect(useWorkflowStore.getState().deleteWorkflow('w1')).rejects.toThrow('Delete failed');
    });
  });
});
