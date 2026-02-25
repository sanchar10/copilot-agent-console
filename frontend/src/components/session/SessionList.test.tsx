import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// Mock SessionItem to isolate SessionList tests
vi.mock('./SessionItem', () => ({
  SessionItem: ({ session }: { session: { session_name: string } }) => (
    <div data-testid="session-item">{session.session_name}</div>
  ),
}));

// Mock virtualizer to render items normally
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count, estimateSize }: { count: number; estimateSize: () => number }) => ({
    getVirtualItems: () =>
      Array.from({ length: count }, (_, i) => ({
        index: i,
        key: i,
        size: estimateSize(),
        start: i * estimateSize(),
      })),
    getTotalSize: () => count * estimateSize(),
  }),
}));

import { SessionList } from './SessionList';
import type { Session } from '../../types/session';

function makeSession(id: string, name: string): Session {
  return {
    session_id: id,
    session_name: name,
    model: 'gpt-4',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-02T00:00:00Z',
  };
}

describe('SessionList', () => {
  it('renders a list of sessions', () => {
    const sessions = [makeSession('s1', 'Alpha'), makeSession('s2', 'Beta')];
    render(<SessionList sessions={sessions} />);
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
  });

  it('shows empty state when no sessions', () => {
    render(<SessionList sessions={[]} />);
    expect(screen.getByText('No sessions yet')).toBeInTheDocument();
    expect(screen.getByText(/Click "New Session" to start/)).toBeInTheDocument();
  });

  it('renders the correct number of session items', () => {
    const sessions = [
      makeSession('s1', 'One'),
      makeSession('s2', 'Two'),
      makeSession('s3', 'Three'),
    ];
    render(<SessionList sessions={sessions} />);
    expect(screen.getAllByTestId('session-item')).toHaveLength(3);
  });
});
