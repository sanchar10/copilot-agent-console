import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Header } from './Header';

describe('Header', () => {
  it('renders session name when provided', () => {
    render(<Header sessionName="My Session" />);
    expect(screen.getByText('My Session')).toBeInTheDocument();
  });

  it('renders placeholder when no session name', () => {
    render(<Header />);
    expect(screen.getByText('Select or create a session')).toBeInTheDocument();
  });

  it('renders model badge when model is provided', () => {
    render(<Header sessionName="Test" model="gpt-4" />);
    expect(screen.getByText('gpt-4')).toBeInTheDocument();
  });
});
