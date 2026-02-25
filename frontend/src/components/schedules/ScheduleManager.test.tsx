import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockOpenTab = vi.fn();
const mockFetchSchedules = vi.fn();
const mockFetchAgents = vi.fn();

vi.mock('../../utils/formatters', () => ({
  formatDateTime: (d: string) => `dt-${d}`,
}));

vi.mock('../../stores/scheduleStore', () => ({
  useScheduleStore: vi.fn(() => ({
    schedules: [],
    loading: false,
    fetchSchedules: mockFetchSchedules,
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

vi.mock('../../api/schedules', () => ({
  createSchedule: vi.fn(),
  updateSchedule: vi.fn(),
  deleteSchedule: vi.fn(),
  toggleSchedule: vi.fn(),
  runScheduleNow: vi.fn(),
}));

vi.mock('../common/FolderBrowserModal', () => ({
  FolderBrowserModal: () => <div data-testid="folder-browser-modal" />,
}));

import { ScheduleManager } from './ScheduleManager';
import { useScheduleStore } from '../../stores/scheduleStore';
import type { ScheduleWithNextRun } from '../../types/schedule';

function makeSchedule(overrides: Partial<ScheduleWithNextRun> = {}): ScheduleWithNextRun {
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

describe('ScheduleManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders empty state when no schedules', () => {
    render(<ScheduleManager />);
    expect(screen.getByText('No schedules yet')).toBeInTheDocument();
  });

  it('renders "New Schedule" button', () => {
    render(<ScheduleManager />);
    expect(screen.getByRole('button', { name: /New Schedule/ })).toBeInTheDocument();
  });

  it('renders schedule names when schedules exist', () => {
    vi.mocked(useScheduleStore).mockReturnValue({
      schedules: [makeSchedule(), makeSchedule({ id: 'sch-2', name: 'Evening Report' })],
      loading: false,
      fetchSchedules: mockFetchSchedules,
    } as ReturnType<typeof useScheduleStore>);

    render(<ScheduleManager />);
    expect(screen.getByText('Morning Check')).toBeInTheDocument();
    expect(screen.getByText('Evening Report')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    vi.mocked(useScheduleStore).mockReturnValue({
      schedules: [],
      loading: true,
      fetchSchedules: mockFetchSchedules,
    } as ReturnType<typeof useScheduleStore>);

    render(<ScheduleManager />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders header title', () => {
    render(<ScheduleManager />);
    expect(screen.getByText('Automations')).toBeInTheDocument();
  });

  it('renders agent filter when agents exist', () => {
    render(<ScheduleManager />);
    expect(screen.getByText('Filter by agent:')).toBeInTheDocument();
  });
});
