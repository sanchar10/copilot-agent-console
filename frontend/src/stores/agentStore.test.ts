import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAgentStore } from './agentStore';
import type { Agent } from '../types/agent';

vi.mock('../api/agents', () => ({
  listAgents: vi.fn(),
  createAgent: vi.fn(),
  updateAgent: vi.fn(),
  deleteAgent: vi.fn(),
}));

import * as agentsApi from '../api/agents';

const initialState = useAgentStore.getState();

function resetStore() {
  useAgentStore.setState(initialState, true);
  vi.clearAllMocks();
}

function makeAgent(id: string, overrides: Partial<Agent> = {}): Agent {
  return {
    id,
    name: `Agent ${id}`,
    description: 'A test agent',
    icon: '🤖',
    system_message: { mode: 'replace', content: 'You are helpful.' },
    model: 'gpt-4.1',
    tools: { custom: [], builtin: [], excluded_builtin: [] },
    mcp_servers: [],
    sub_agents: [],
    starter_prompts: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('agentStore', () => {
  beforeEach(resetStore);

  // --- fetchAgents ---
  describe('fetchAgents', () => {
    it('loads agents and clears loading state', async () => {
      const agents = [makeAgent('a1'), makeAgent('a2')];
      vi.mocked(agentsApi.listAgents).mockResolvedValue(agents);

      await useAgentStore.getState().fetchAgents();

      const state = useAgentStore.getState();
      expect(state.agents).toHaveLength(2);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('sets loading true while fetching', async () => {
      let resolveFn: (value: Agent[]) => void;
      vi.mocked(agentsApi.listAgents).mockImplementation(
        () => new Promise((resolve) => { resolveFn = resolve; }),
      );

      const promise = useAgentStore.getState().fetchAgents();
      expect(useAgentStore.getState().loading).toBe(true);

      resolveFn!([]);
      await promise;
      expect(useAgentStore.getState().loading).toBe(false);
    });

    it('sets error on failure', async () => {
      vi.mocked(agentsApi.listAgents).mockRejectedValue(new Error('Network error'));

      await useAgentStore.getState().fetchAgents();

      const state = useAgentStore.getState();
      expect(state.error).toBe('Network error');
      expect(state.loading).toBe(false);
      expect(state.agents).toEqual([]);
    });

    it('clears previous error on new fetch', async () => {
      vi.mocked(agentsApi.listAgents).mockRejectedValueOnce(new Error('fail'));
      await useAgentStore.getState().fetchAgents();
      expect(useAgentStore.getState().error).toBe('fail');

      vi.mocked(agentsApi.listAgents).mockResolvedValueOnce([]);
      await useAgentStore.getState().fetchAgents();
      expect(useAgentStore.getState().error).toBeNull();
    });
  });

  // --- createAgent ---
  describe('createAgent', () => {
    it('adds created agent to state and returns it', async () => {
      const agent = makeAgent('new-1');
      vi.mocked(agentsApi.createAgent).mockResolvedValue(agent);

      const result = await useAgentStore.getState().createAgent({ name: 'New' });

      expect(result).toEqual(agent);
      expect(useAgentStore.getState().agents).toHaveLength(1);
      expect(useAgentStore.getState().agents[0].id).toBe('new-1');
    });

    it('appends to existing agents', async () => {
      useAgentStore.setState({ agents: [makeAgent('existing')] });
      const agent = makeAgent('new-1');
      vi.mocked(agentsApi.createAgent).mockResolvedValue(agent);

      await useAgentStore.getState().createAgent({ name: 'New' });
      expect(useAgentStore.getState().agents).toHaveLength(2);
    });

    it('propagates API errors', async () => {
      vi.mocked(agentsApi.createAgent).mockRejectedValue(new Error('Create failed'));
      await expect(useAgentStore.getState().createAgent({ name: 'X' })).rejects.toThrow('Create failed');
    });
  });

  // --- updateAgent ---
  describe('updateAgent', () => {
    it('replaces the agent in state', async () => {
      useAgentStore.setState({ agents: [makeAgent('a1', { name: 'Old' })] });
      const updated = makeAgent('a1', { name: 'Updated' });
      vi.mocked(agentsApi.updateAgent).mockResolvedValue(updated);

      const result = await useAgentStore.getState().updateAgent('a1', { name: 'Updated' });

      expect(result.name).toBe('Updated');
      expect(useAgentStore.getState().agents[0].name).toBe('Updated');
    });

    it('does not affect other agents', async () => {
      useAgentStore.setState({ agents: [makeAgent('a1'), makeAgent('a2', { name: 'Keep' })] });
      vi.mocked(agentsApi.updateAgent).mockResolvedValue(makeAgent('a1', { name: 'Changed' }));

      await useAgentStore.getState().updateAgent('a1', { name: 'Changed' });
      expect(useAgentStore.getState().agents[1].name).toBe('Keep');
    });

    it('propagates API errors', async () => {
      vi.mocked(agentsApi.updateAgent).mockRejectedValue(new Error('Update failed'));
      await expect(useAgentStore.getState().updateAgent('a1', { name: 'X' })).rejects.toThrow('Update failed');
    });
  });

  // --- deleteAgent ---
  describe('deleteAgent', () => {
    it('removes the agent from state', async () => {
      useAgentStore.setState({ agents: [makeAgent('a1'), makeAgent('a2')] });
      vi.mocked(agentsApi.deleteAgent).mockResolvedValue(undefined);

      await useAgentStore.getState().deleteAgent('a1');
      const ids = useAgentStore.getState().agents.map((a) => a.id);
      expect(ids).toEqual(['a2']);
    });

    it('propagates API errors', async () => {
      vi.mocked(agentsApi.deleteAgent).mockRejectedValue(new Error('Delete failed'));
      await expect(useAgentStore.getState().deleteAgent('a1')).rejects.toThrow('Delete failed');
    });
  });
});
