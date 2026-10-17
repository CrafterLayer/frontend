import { createRef } from 'react';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Button } from './Button';

describe('Button', () => {
  it('uses button semantics and invokes its action when clicked', async () => {
    const user = userEvent.setup({ delay: null });
    const onClick = vi.fn();

    render(<Button onClick={onClick}>Create project</Button>);

    const button = screen.getByRole('button', { name: 'Create project' });
    expect(button.getAttribute('type')).toBe('button');

    await user.click(button);

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('preserves native Enter and Space keyboard activation', async () => {
    const user = userEvent.setup({ delay: null });
    const onClick = vi.fn();

    render(<Button onClick={onClick}>Continue</Button>);

    const button = screen.getByRole('button', { name: 'Continue' });
    await user.tab();
    expect(document.activeElement).toBe(button);

    await user.keyboard('{Enter}');
    await user.keyboard(' ');

    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it('does not invoke its action while disabled', async () => {
    const user = userEvent.setup({ delay: null });
    const onClick = vi.fn();

    render(
      <Button disabled onClick={onClick}>
        Delete
      </Button>,
    );

    const button = screen.getByRole('button', { name: 'Delete' });
    expect((button as HTMLButtonElement).disabled).toBe(true);

    await user.click(button);

    expect(onClick).not.toHaveBeenCalled();
  });

  it('announces loading and prevents duplicate activation', async () => {
    const user = userEvent.setup({ delay: null });
    const onClick = vi.fn();

    render(
      <Button loading loadingLabel="Saving changes" onClick={onClick}>
        Save
      </Button>,
    );

    const button = screen.getByRole('button', { name: /saving changes/i });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(screen.getByRole('status', { name: 'Saving changes' })).toBeTruthy();

    await user.click(button);

    expect(onClick).not.toHaveBeenCalled();
  });

  it('attaches the React 19 ref prop to the native element', () => {
    const ref = createRef<HTMLButtonElement>();

    render(<Button ref={ref}>Focus target</Button>);

    expect(ref.current).toBe(screen.getByRole('button', { name: 'Focus target' }));
  });

  it('keeps consumer classes alongside component classes', () => {
    render(<Button className="consumer-class">Styled action</Button>);

    const button = screen.getByRole('button', { name: 'Styled action' });
    expect(button.classList.contains('craftkit-button')).toBe(true);
    expect(button.classList.contains('consumer-class')).toBe(true);
  });
});
