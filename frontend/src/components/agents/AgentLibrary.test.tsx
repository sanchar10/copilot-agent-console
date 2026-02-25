import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockOpenTab = vi.fn();
const mockFetchAgents = vi.fn();

vi.mock('../../stores/agentStore', () => ({
  useAgentStore: vi.fn(() => ({
    agents: [],
    loading: false,
    fetchAgents: mockFetchAgents,
  })),
}));

vi.mock('../../stores/sessionStore', () => ({
  useSessionStore: Object.assign(
    vi.fn(() => ({})),
    { setState: vi.fn() },
  ),
}));

vi.mock('../../stores/uiStore', () => ({
  useUIStore: vi.fn(() => ({
    defaultCwd: '/tmp',
  })),
}));

vi.mock('../../stores/tabStore', () => ({
  useTabStore: Object.assign(
    vi.fn(() => ({
      openTab: mockOpenTab,
    })),
    { setState: vi.fn() },
  ),
  tabId: {
    agentDetail: (id: string) => `agent:${id}`,
    automationManager: () => 'automation-manager',
  },
}));

import { AgentLibrary } from './AgentLibrary';
import { useAgentStore } from '../../stores/agentStore';
import type { Agent } from '../../types/agent';

function makeAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: 'agent-1',
    name: 'Test Agent',
    description: 'A test agent',
    icon: '🤖',
    system_message: { mode: 'replace', content: 'You are a helper' },
    model: 'gpt-4',
    tools: { custom: [], builtin: [], excluded_builtin: [] },
    mcp_servers: [],
    sub_agents: [],
    starter_prompts: [],
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-02T00:00:00Z',
    ...overrides,
  };
}

describe('AgentLibrary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders empty state when no agents', () => {
    render(<AgentLibrary />);
    expect(screen.getByText('No agents yet')).toBeInTheDocument();
  });

  it('renders "New Agent" button', () => {
    render(<AgentLibrary />);
    expect(screen.getByRole('button', { name: /New Agent/ })).toBeInTheDocument();
  });

  it('renders agent names and icons when agents exist', () => {
    vi.mocked(useAgentStore).mockReturnValue({
      agents: [makeAgent(), makeAgent({ id: 'agent-2', name: 'Second Agent', icon: '🧠' })],
      loading: false,
      fetchAgents: mockFetchAgents,
    } as ReturnType<typeof useAgentStore>);

    render(<AgentLibrary />);
    expect(screen.getByText('Test Agent')).toBeInTheDocument();
    expect(screen.getByText('Second Agent')).toBeInTheDocument();
    expect(screen.getByText('🧠')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    vi.mocked(useAgentStore).mockReturnValue({
      agents: [],
      loading: true,
      fetchAgents: mockFetchAgents,
    } as ReturnType<typeof useAgentStore>);

    render(<AgentLibrary />);
    expect(screen.getByText('Loading agents...')).toBeInTheDocument();
  });

  it('clicking New Agent opens a tab', () => {
    render(<AgentLibrary />);
    fireEvent.click(screen.getByRole('button', { name: /New Agent/ }));
    expect(mockOpenTab).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'agent:new',
        type: 'agent-detail',
        label: 'New Agent',
      }),
    );
  });

  it('clicking an agent card opens its detail tab', () => {
    vi.mocked(useAgentStore).mockReturnValue({
      agents: [makeAgent()],
      loading: false,
      fetchAgents: mockFetchAgents,
    } as ReturnType<typeof useAgentStore>);

    render(<AgentLibrary />);
    fireEvent.click(screen.getByText('Test Agent'));
    expect(mockOpenTab).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'agent:agent-1',
        type: 'agent-detail',
        label: 'Test Agent',
      }),
    );
  });
});
