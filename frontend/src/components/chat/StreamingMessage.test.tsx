import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StreamingMessage } from './StreamingMessage';

describe('StreamingMessage', () => {
  it('hides the bordered bubble when content is empty and all steps are filtered', () => {
    // ask_user is in STEPS_WITH_DEDICATED_UI, so this step is filtered out;
    // with no content the bordered bubble should not render (avatar+label still do).
    const { container } = render(
      <StreamingMessage
        content=""
        steps={[
          { title: 'Tool: ask_user', detail: 'id=call_x\nInput: {"question":"pick one"}' },
        ]}
      />,
    );

    // The bordered shell uses `rounded-lg` + `border` classes — neither should appear.
    const borderedShell = container.querySelector('.rounded-lg.border');
    expect(borderedShell).toBeNull();
  });

  it('hides the bordered bubble when content is empty and steps is undefined', () => {
    const { container } = render(<StreamingMessage content="" />);
    const borderedShell = container.querySelector('.rounded-lg.border');
    expect(borderedShell).toBeNull();
  });

  it('renders the bordered bubble when content is non-empty', () => {
    const { container } = render(<StreamingMessage content="Hello" />);
    const borderedShell = container.querySelector('.rounded-lg.border');
    expect(borderedShell).not.toBeNull();
  });

  it('renders the bordered bubble when there are visible (non-filtered) steps', () => {
    const { container } = render(
      <StreamingMessage
        content=""
        steps={[{ title: 'Tool: edit', detail: 'editing file' }]}
      />,
    );
    const borderedShell = container.querySelector('.rounded-lg.border');
    expect(borderedShell).not.toBeNull();
  });

  it('always shows the Copilot label even when bubble is hidden', () => {
    const { getByText } = render(<StreamingMessage content="" />);
    expect(getByText('Copilot')).toBeInTheDocument();
  });
});
