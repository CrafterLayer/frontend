import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TransformOriginControl } from './TransformOriginControl';
import { TRANSFORM_ORIGIN_CONTROL_LABELS_AR } from './TransformOriginControl.labels';

afterEach(cleanup);

describe('TransformOriginControl', () => {
  it('writes the physical keyword a logical point means on the page', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    const { rerender } = render(<TransformOriginControl value={undefined} dir="ltr" onCommit={onCommit} />);
    await user.click(screen.getByRole('radio', { name: 'Block start, inline start' }));
    expect(onCommit).toHaveBeenLastCalledWith('top-left');
    rerender(<TransformOriginControl value={undefined} dir="rtl" onCommit={onCommit} />);
    await user.click(screen.getByRole('radio', { name: 'Block start, inline start' }));
    expect(onCommit).toHaveBeenLastCalledWith('top-right');
  });

  it('reads a stored keyword back as its logical point', () => {
    render(<TransformOriginControl value="bottom-right" dir="rtl" onCommit={vi.fn()} />);
    expect(screen.getByRole('radio', { name: 'Block end, inline start' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('moves in two dimensions with the arrows, mirrored for RTL', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<TransformOriginControl value="center" dir="rtl" onCommit={onCommit} />);
    screen.getByRole('radio', { name: 'Centre' }).focus();
    await user.keyboard('{ArrowLeft}');
    // In RTL, ArrowLeft moves towards inline-end, which is the LEFT side.
    expect(onCommit).toHaveBeenLastCalledWith('left');
    await user.keyboard('{ArrowUp}');
    expect(onCommit).toHaveBeenLastCalledWith('top-left');
  });

  it('labels in Arabic', () => {
    render(
      <TransformOriginControl
        value="center"
        dir="rtl"
        onCommit={vi.fn()}
        labels={TRANSFORM_ORIGIN_CONTROL_LABELS_AR}
      />,
    );
    expect(screen.getByRole('radiogroup', { name: 'نقطة الارتكاز' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'الوسط' })).toHaveAttribute('aria-checked', 'true');
  });
});
