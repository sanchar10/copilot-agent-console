import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockOpenTab = vi.fn();
const mockFetchWorkflows = vi.fn();

vi.mock('../../utils/formatters', () => ({
  formatRelativeTime: (d: string) => `rel-${d}`,
}));

vi.mock('../../stores/workflowStore', () => ({
  useWorkflowStore: vi.fn(() => ({
    workflows: [],
    loading: false,
    fetchWorkflows: mockFetchWorkflows,
  })),
}));

vi.mock('../../stores/tabStore', () => ({
  useTabStore: vi.fn(() => ({
    openTab: mockOpenTab,
  })),
  tabId: {
    workflowEditor: (id: string) => `workflow:${id}`,
  },
}));

import { WorkflowLibrary } from './WorkflowLibrary';
import { useWorkflowStore } from '../../stores/workflowStore';
import type { WorkflowMetadata } from '../../types/workflow';

function makeWorkflow(overrides: Partial<WorkflowMetadata> = {}): WorkflowMetadata {
  return {
    id: 'wf-1',
    name: 'Test Workflow',
    description: 'A test workflow',
    yaml_filename: 'test.yaml',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-02T00:00:00Z',
    ...overrides,
  };
}

describe('WorkflowLibrary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders empty state when no workflows', () => {
    render(<WorkflowLibrary />);
    expect(screen.getByText('No workflows yet')).toBeInTheDocument();
  });

  it('renders "New Workflow" button', () => {
    render(<WorkflowLibrary />);
    expect(screen.getByRole('button', { name: /New Workflow/ })).toBeInTheDocument();
  });

  it('renders workflow names when workflows exist', () => {
    vi.mocked(useWorkflowStore).mockReturnValue({
      workflows: [makeWorkflow(), makeWorkflow({ id: 'wf-2', name: 'Second Workflow' })],
      loading: false,
      fetchWorkflows: mockFetchWorkflows,
    } as ReturnType<typeof useWorkflowStore>);

    render(<WorkflowLibrary />);
    expect(screen.getByText('Test Workflow')).toBeInTheDocument();
    expect(screen.getByText('Second Workflow')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    vi.mocked(useWorkflowStore).mockReturnValue({
      workflows: [],
      loading: true,
      fetchWorkflows: mockFetchWorkflows,
    } as ReturnType<typeof useWorkflowStore>);

    render(<WorkflowLibrary />);
    expect(screen.getByText('Loading workflows...')).toBeInTheDocument();
  });

  it('clicking New Workflow opens a tab', () => {
    render(<WorkflowLibrary />);
    fireEvent.click(screen.getByRole('button', { name: /New Workflow/ }));
    expect(mockOpenTab).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'workflow:new',
        type: 'workflow-editor',
        label: 'New Workflow',
      }),
    );
  });

  it('clicking a workflow card opens its editor tab', () => {
    vi.mocked(useWorkflowStore).mockReturnValue({
      workflows: [makeWorkflow()],
      loading: false,
      fetchWorkflows: mockFetchWorkflows,
    } as ReturnType<typeof useWorkflowStore>);

    render(<WorkflowLibrary />);
    fireEvent.click(screen.getByText('Test Workflow'));
    expect(mockOpenTab).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'workflow:wf-1',
        type: 'workflow-editor',
        label: 'Test Workflow',
      }),
    );
  });
});
