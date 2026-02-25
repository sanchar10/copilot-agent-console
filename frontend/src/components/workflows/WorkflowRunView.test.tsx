import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

// scrollIntoView is not available in jsdom
Element.prototype.scrollIntoView = vi.fn();

vi.mock('../../utils/formatters', () => ({
  formatDateTime: (d: string) => `dt-${d}`,
}));

vi.mock('../../api/workflows', () => ({
  getWorkflowRun: vi.fn().mockResolvedValue({
    id: 'run-1',
    workflow_id: 'wf-1',
    workflow_name: 'Test Workflow',
    status: 'completed',
    input: null,
    started_at: '2025-01-01T00:00:00Z',
    completed_at: '2025-01-01T00:01:00Z',
    duration_seconds: 60,
    node_results: {},
    events: [
      { type: 'workflow_started', workflow_name: 'Test Workflow' },
      { type: 'workflow_completed' },
    ],
    error: null,
    session_id: null,
  }),
  visualizeWorkflow: vi.fn().mockResolvedValue({ mermaid: 'graph TD; A-->B;' }),
  createWorkflowRunStream: vi.fn().mockReturnValue({
    onopen: null,
    onerror: null,
    addEventListener: vi.fn(),
    close: vi.fn(),
  }),
  sendHumanInput: vi.fn(),
}));

vi.mock('../chat/MermaidDiagram', () => ({
  MermaidDiagram: ({ code }: { code: string }) => <div data-testid="mermaid-diagram">{code}</div>,
}));

import { WorkflowRunView } from './WorkflowRunView';

describe('WorkflowRunView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders events panel header', () => {
    render(<WorkflowRunView workflowId="wf-1" runId="run-1" />);
    expect(screen.getByText(/Events/)).toBeInTheDocument();
  });

  it('renders loading status initially', () => {
    render(<WorkflowRunView workflowId="wf-1" runId="run-1" />);
    expect(screen.getByText('LOADING')).toBeInTheDocument();
  });

  it('renders loading diagram placeholder initially', () => {
    render(<WorkflowRunView workflowId="wf-1" runId="run-1" />);
    expect(screen.getByText('Loading diagram...')).toBeInTheDocument();
  });

  it('renders the status bar', () => {
    render(<WorkflowRunView workflowId="wf-1" runId="run-1" />);
    // Before async loads complete, status is LOADING
    const statusEl = screen.getByText('LOADING');
    expect(statusEl).toBeInTheDocument();
  });
});
