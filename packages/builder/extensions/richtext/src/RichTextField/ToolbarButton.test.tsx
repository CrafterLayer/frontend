import { createEvent, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ToolbarButton } from './ToolbarButton';

describe('ToolbarButton', () => {
  it('keeps the editor selection on pointer press while reporting its hover and focus anchors', () => {
    const onActivate = vi.fn();
    const onFocusChange = vi.fn();
    const onHoverChange = vi.fn();
    render(
      <ToolbarButton
        label="Clear formatting"
        onActivate={onActivate}
        onFocusChange={onFocusChange}
        onHoverChange={onHoverChange}
      />,
    );
    const button = screen.getByRole('button', { name: 'Clear formatting' });

    expect(button).toHaveTextContent('Clear formatting');
    expect(button).not.toHaveAttribute('aria-pressed');

    fireEvent.mouseEnter(button);
    expect(onHoverChange).toHaveBeenLastCalledWith('Clear formatting', button);
    fireEvent.mouseLeave(button);
    expect(onHoverChange).toHaveBeenLastCalledWith('Clear formatting', null);

    fireEvent.focus(button);
    expect(onFocusChange).toHaveBeenLastCalledWith('Clear formatting', button);
    fireEvent.blur(button);
    expect(onFocusChange).toHaveBeenLastCalledWith('Clear formatting', null);

    const pointerDown = createEvent.mouseDown(button);
    fireEvent(button, pointerDown);
    expect(pointerDown.defaultPrevented).toBe(true);
    expect(onActivate).not.toHaveBeenCalled();

    fireEvent.click(button);
    expect(onActivate).toHaveBeenCalledTimes(1);
  });
});
