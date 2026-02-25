import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockCloseTab = vi.fn();
const mockUpdateTabLabel = vi.fn();
const mockReplaceTab = vi.fn();
const mockFetchAgents = vi.fn();
const mockCreateAgent = vi.fn();
const mockUpdateAgent = vi.fn();
const mockDeleteAgent = vi.fn();

vi.mock('../../stores/agentStore', () => ({
  useAgentStore: vi.fn(() => ({
    agents: [],
    loading: false,
    fetchAgents: mockFetchAgents,
    createAgent: mockCreateAgent,
    updateAgent: mockUpdateAgent,
    deleteAgent: mockDeleteAgent,
  })),
}));

vi.mock('../../stores/tabStore', () => ({
  useTabStore: vi.fn(() => ({
    closeTab: mockCloseTab,
    updateTabLabel: mockUpdateTabLabel,
    replaceTab: mockReplaceTab,
  })),
  tabId: {
    agentDetail: (id: string) => `agent:${id}`,
  },
}));

vi.mock('../../stores/uiStore', () => ({
  useUIStore: vi.fn(() => ({
    availableModels: [
      { id: 'gpt-4', name: 'GPT-4' },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
    ],
    defaultModel: 'gpt-4',
  })),
}));

vi.mock('../../api/mcp', () => ({
  listMCPServers: vi.fn().mockResolvedValue({ servers: [] }),
}));

vi.mock('../../api/tools', () => ({
  getTools: vi.fn().mockResolvedValue({ tools: [] }),
}));

vi.mock('../../api/agents', () => ({
  getEligibleSubAgents: vi.fn().mockResolvedValue([]),
}));

vi.mock('../chat/MCPSelector', () => ({
  MCPSelector: () => <div data-testid="mcp-selector" />,
}));

vi.mock('../chat/ToolsSelector', () => ({
  ToolsSelector: () => <div data-testid="tools-selector" />,
}));

vi.mock('../chat/SubAgentSelector', () => ({
  SubAgentSelector: () => <div data-testid="sub-agent-selector" />,
}));

vi.mock('../common/SystemPromptEditor', () => ({
  SystemPromptEditor: () => <div data-testid="system-prompt-editor" />,
}));

vi.mock('../common/EmojiPicker', () => ({
  EmojiPicker: ({ value }: { value: string }) => <div data-testid="emoji-picker">{value}</div>,
}));

vi.mock('../common/ConfirmModal', () => ({
  ConfirmModal: () => <div data-testid="confirm-modal" />,
}));

import { AgentEditor } from './AgentEditor';

describe('AgentEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders "New Agent" title for new agents', () => {
    render(<AgentEditor agentId="new" />);
    expect(screen.getByText(/New Agent/)).toBeInTheDocument();
  });

  it('renders name input', () => {
    render(<AgentEditor agentId="new" />);
    expect(screen.getByPlaceholderText('My Agent')).toBeInTheDocument();
  });

  it('renders save button', () => {
    render(<AgentEditor agentId="new" />);
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('renders model selector with available models', () => {
    render(<AgentEditor agentId="new" />);
    const modelSelect = screen.getByDisplayValue('GPT-4');
    expect(modelSelect).toBeInTheDocument();
  });

  it('renders system prompt editor', () => {
    render(<AgentEditor agentId="new" />);
    expect(screen.getByTestId('system-prompt-editor')).toBeInTheDocument();
  });

  it('renders description input', () => {
    render(<AgentEditor agentId="new" />);
    expect(screen.getByPlaceholderText('What does this agent do?')).toBeInTheDocument();
  });

  it('shows "Agent not found" for non-existent agent id', () => {
    render(<AgentEditor agentId="nonexistent" />);
    expect(screen.getByText(/Agent not found/)).toBeInTheDocument();
  });

  it('renders close button', () => {
    render(<AgentEditor agentId="new" />);
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });
});
