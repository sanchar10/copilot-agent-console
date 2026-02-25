import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockOpenTab = vi.fn();
const mockFetchAutomations = vi.fn();
const mockFetchAgents = vi.fn();

vi.mock('../../utils/formatters', () => ({
  formatDateTime: (d: string) => `dt-${d}`,
}));

vi.mock('../../stores/automationStore', () => ({
  useAutomationStore: vi.fn(() => ({
    automations: [],
    loading: false,
    fetchAutomations: mockFetchAutomations,
  })),
}));

vi.mock('../../stores/agentStore', () => ({
  useAgentStore: vi.fn(() => ({
    agents: [
      { id: 'agent-1', name: 'Test Agent', icon: '🤖', model: 'gpt-4' },
    ],
    fetchAgents: mockFetchAgents,
  })),
}));

vi.mock('../../stores/tabStore', () => ({
  useTabStore: vi.fn(() => ({
    openTab: mockOpenTab,
  })),
  tabId: {
    taskBoard: (id?: string) => id ? `task-board:${id}` : 'task-board',
  },
}));

vi.mock('../../api/automations', () => ({
  createAutomation: vi.fn(),
  updateAutomation: vi.fn(),
  deleteAutomation: vi.fn(),
  toggleAutomation: vi.fn(),
  runAutomationNow: vi.fn(),
}));

vi.mock('../common/FolderBrowserModal', () => ({
  FolderBrowserModal: () => <div data-testid="folder-browser-modal" />,
}));

import { AutomationManager } from './AutomationManager';
import { useAutomationStore } from '../../stores/automationStore';
import type { AutomationWithNextRun } from '../../types/automation';

function makeAutomation(overrides: Partial<AutomationWithNextRun> = {}): AutomationWithNextRun {
  return {
    id: 'sch-1',
    agent_id: 'agent-1',
    agent_name: 'Test Agent',
    name: 'Morning Check',
    cron: '0 8 * * *',
    prompt: 'Check news',
    cwd: null,
    enabled: true,
    max_runtime_minutes: 30,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-02T00:00:00Z',
    next_run: '2025-01-03T08:00:00Z',
    ...overrides,
  };
}

describe('AutomationManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders empty state when no automations', () => {
    render(<AutomationManager />);
    expect(screen.getByText('No automations yet')).toBeInTheDocument();
  });

  it('renders "New Automation" button', () => {
    render(<AutomationManager />);
    expect(screen.getByRole('button', { name: /New Automation/ })).toBeInTheDocument();
  });

  it('renders automation names when automations exist', () => {
    vi.mocked(useAutomationStore).mockReturnValue({
      automations: [makeAutomation(), makeAutomation({ id: 'sch-2', name: 'Evening Report' })],
      loading: false,
      fetchAutomations: mockFetchAutomations,
    } as ReturnType<typeof useAutomationStore>);

    render(<AutomationManager />);
    expect(screen.getByText('Morning Check')).toBeInTheDocument();
    expect(screen.getByText('Evening Report')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    vi.mocked(useAutomationStore).mockReturnValue({
      automations: [],
      loading: true,
      fetchAutomations: mockFetchAutomations,
    } as ReturnType<typeof useAutomationStore>);

    render(<AutomationManager />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders header title', () => {
    render(<AutomationManager />);
    expect(screen.getByText('Automations')).toBeInTheDocument();
  });

  it('renders agent filter when agents exist', () => {
    render(<AutomationManager />);
    expect(screen.getByText('Filter by agent:')).toBeInTheDocument();
  });
});
