import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MessageBubble } from './MessageBubble';

describe('MessageBubble', () => {
  it('renders a user message', () => {
    render(
      <MessageBubble
        message={{
          id: '1',
          role: 'user',
          content: 'Hello from test',
          timestamp: new Date().toISOString(),
        }}
      />,
    );

    expect(screen.getByText('You')).toBeInTheDocument();
    expect(screen.getByText('Hello from test')).toBeInTheDocument();
  });
});
