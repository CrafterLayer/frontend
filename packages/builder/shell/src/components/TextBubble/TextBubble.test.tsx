import { cleanup, createEvent, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TextBubble, type TextBubbleProps } from './TextBubble';

afterEach(cleanup);

// Behavior and a11y only: the component is CONTENT — position, visibility,
// placement, and the arrow offset are the floating host's job and are proven
// in overlay/floating-host.test.ts and overlay/floating-position.test.ts.
function renderBubble(overrides: Partial<TextBubbleProps> = {}) {
  const runs = { bold: vi.fn(), italic: vi.fn(), clear: vi.fn() };
  const props: TextBubbleProps = {
    dir: 'ltr',
    onReturnFocus: () => true,
    actions: [
      { id: 'bold', label: 'Bold', pressed: true, run: runs.bold },
      { id: 'italic', label: 'Italic', pressed: false, run: runs.italic },
      // Deliberately NOT a toggle: must carry no aria-pressed at all.
      { id: 'clear', label: 'Clear formatting', run: runs.clear },
    ],
    ...overrides,
  };
  return { runs, ...render(<TextBubble {...props} />) };
}

describe('TextBubble (009 contract §5)', () => {
  it('renders a named group with real buttons in declaration order', () => {
    renderBubble();
    const group = screen.getByRole('group', { name: 'Formatting' });
    const labels = screen.getAllByRole('button').map((button) => button.textContent);
    expect(group).toBeInTheDocument();
    expect(labels).toEqual(['Bold', 'Italic', 'Clear formatting']);
  });

  it('reports pressed state for toggles ONLY — an action carries no aria-pressed', () => {
    renderBubble();
    expect(screen.getByRole('button', { name: 'Bold' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Italic' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Clear formatting' })).not.toHaveAttribute(
      'aria-pressed',
    );
  });

  it('every action fires exactly once through a real click — its own and only its own', async () => {
    // userEvent runs the full pointer sequence: this also proves the cancelled
    // pointer-down does not break activation (risk 2's other half).
    const user = userEvent.setup();
    const { runs } = renderBubble();
    await user.click(screen.getByRole('button', { name: 'Bold' }));
    expect(runs.bold).toHaveBeenCalledTimes(1);
    expect(runs.italic).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Italic' }));
    await user.click(screen.getByRole('button', { name: 'Clear formatting' }));
    expect(runs.bold).toHaveBeenCalledTimes(1);
    expect(runs.italic).toHaveBeenCalledTimes(1);
    expect(runs.clear).toHaveBeenCalledTimes(1);
  });

  it('cancels pointer-down AND mouse-down so focus never leaves the editor (risk 2)', () => {
    renderBubble();
    const button = screen.getByRole('button', { name: 'Bold' });
    const pointerDown = createEvent.pointerDown(button);
    fireEvent(button, pointerDown);
    expect(pointerDown.defaultPrevented).toBe(true);
    const mouseDown = createEvent.mouseDown(button);
    fireEvent(button, mouseDown);
    expect(mouseDown.defaultPrevented).toBe(true);
  });

  it('stops click propagation — an ancestor selection path never sees it (risk 9)', () => {
    const { runs } = renderBubble();
    const onDocumentClick = vi.fn();
    document.addEventListener('click', onDocumentClick);
    try {
      fireEvent.click(screen.getByRole('button', { name: 'Bold' }));
    } finally {
      document.removeEventListener('click', onDocumentClick);
    }
    expect(runs.bold).toHaveBeenCalledTimes(1);
    expect(onDocumentClick).not.toHaveBeenCalled();
  });

  it('disabled actions are semantically disabled and never fire', async () => {
    const user = userEvent.setup();
    const run = vi.fn();
    render(
      <TextBubble
        dir="ltr"
        onReturnFocus={() => true}
        actions={[{ id: 'clear', label: 'Clear formatting', disabled: true, run }]}
      />,
    );
    const button = screen.getByRole('button', { name: 'Clear formatting' });
    expect(button).toBeDisabled();
    await user.click(button);
    expect(run).not.toHaveBeenCalled();
  });

  it('carries the content direction on the group, so reading order flips under RTL', () => {
    renderBubble({ dir: 'rtl' });
    expect(screen.getByRole('group', { name: 'Formatting' })).toHaveAttribute('dir', 'rtl');
  });

  it.each([
    ['Escape', { key: 'Escape' }],
    ['Shift+Tab', { key: 'Tab', shiftKey: true }],
  ])('%s returns from the first enabled action and consumes that host key', (_name, init) => {
    const onReturnFocus = vi.fn(() => true);
    renderBubble({
      onReturnFocus,
      actions: [
        { id: 'clear', label: 'Clear formatting', disabled: true, run: vi.fn() },
        { id: 'bold', label: 'Bold', run: vi.fn() },
      ],
    });
    const bold = screen.getByRole('button', { name: 'Bold' });
    bold.focus();
    const event = createEvent.keyDown(bold, init);

    fireEvent(bold, event);

    expect(onReturnFocus).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it('Shift+Tab from a later action remains native, and a failed return consumes nothing', () => {
    const onReturnFocus = vi.fn(() => false);
    renderBubble({ onReturnFocus });
    const italic = screen.getByRole('button', { name: 'Italic' });
    italic.focus();
    const fromLater = createEvent.keyDown(italic, { key: 'Tab', shiftKey: true });
    fireEvent(italic, fromLater);
    expect(onReturnFocus).not.toHaveBeenCalled();
    expect(fromLater.defaultPrevented).toBe(false);

    const bold = screen.getByRole('button', { name: 'Bold' });
    bold.focus();
    const failedEscape = createEvent.keyDown(bold, { key: 'Escape' });
    fireEvent(bold, failedEscape);
    expect(onReturnFocus).toHaveBeenCalledTimes(1);
    expect(failedEscape.defaultPrevented).toBe(false);
  });
});
