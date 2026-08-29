import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { BlockAction } from '../../overlay/block-actions';
import { BlockActionBar } from './BlockActionBar';

afterEach(cleanup);

const ACTIONS: BlockAction[] = [
  { id: 'duplicate', label: 'Duplicate', enabled: true },
  { id: 'delete', label: 'Delete', enabled: true },
  { id: 'moveEarlier', label: 'Move earlier', enabled: false },
  { id: 'moveLater', label: 'Move later', enabled: true },
  { id: 'editText', label: 'Edit text', enabled: true },
];

describe('BlockActionBar (009 contract §6, US3)', () => {
  it('renders a labeled toolbar of real buttons in the resolved order', () => {
    render(<BlockActionBar label="Actions for Text" actions={ACTIONS} onAction={vi.fn()} />);
    const toolbar = screen.getByRole('toolbar', { name: 'Actions for Text' });
    const buttons = Array.from(toolbar.querySelectorAll('button'));
    const labels = buttons.map((button) => button.textContent);
    expect(labels).toEqual(['Duplicate', 'Delete', 'Move earlier', 'Move later', 'Edit text']);
    for (const button of buttons) {
      expect(button).toHaveAttribute('data-bldr-chrome-button', '');
      expect(button).toHaveAttribute('data-size', 'lg');
      expect(button).toHaveAttribute('data-variant', 'quiet');
    }
    expect(screen.getByRole('button', { name: 'Move earlier' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Duplicate' })).not.toBeDisabled();
  });

  it('renders nothing for an empty action list', () => {
    const { container } = render(
      <BlockActionBar label="Actions" actions={[]} onAction={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('each button calls onAction exactly once with its own id', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(<BlockActionBar label="Actions for Text" actions={ACTIONS} onAction={onAction} />);

    await user.click(screen.getByRole('button', { name: 'Duplicate' }));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenLastCalledWith('duplicate');

    await user.click(screen.getByRole('button', { name: 'Move later' }));
    expect(onAction).toHaveBeenCalledTimes(2);
    expect(onAction).toHaveBeenLastCalledWith('moveLater');

    await user.click(screen.getByRole('button', { name: 'Edit text' }));
    expect(onAction).toHaveBeenCalledTimes(3);
    expect(onAction).toHaveBeenLastCalledWith('editText');
  });

  it('disabled buttons never fire (US3/AC3)', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(<BlockActionBar label="Actions for Text" actions={ACTIONS} onAction={onAction} />);
    await user.click(screen.getByRole('button', { name: 'Move earlier' }));
    expect(onAction).not.toHaveBeenCalled();
  });

  it('activation never re-enters the canvas path: press cancelled, click contained', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    const outerClick = vi.fn();
    const outerPointerDown = vi.fn();
    const outerMouseDown = vi.fn();
    render(
      <div onClick={outerClick} onPointerDown={outerPointerDown} onMouseDown={outerMouseDown}>
        <BlockActionBar label="Actions for Text" actions={ACTIONS} onAction={onAction} />
      </div>,
    );

    await user.click(screen.getByRole('button', { name: 'Duplicate' }));
    expect(onAction).toHaveBeenCalledWith('duplicate');
    expect(outerClick).not.toHaveBeenCalled();
    expect(outerPointerDown).not.toHaveBeenCalled();
    expect(outerMouseDown).not.toHaveBeenCalled();

    // preventDefault on the press is what keeps focus where it is: fireEvent
    // reports `false` when the default was cancelled.
    const toolbar = screen.getByRole('toolbar', { name: 'Actions for Text' });
    expect(fireEvent.pointerDown(toolbar)).toBe(false);
    expect(fireEvent.mouseDown(toolbar)).toBe(false);
  });

  it('is ONE tab stop with roving tabindex; arrows skip disabled actions and wrap', async () => {
    const user = userEvent.setup();
    render(
      <>
        <BlockActionBar label="Actions for Text" actions={ACTIONS} onAction={vi.fn()} />
        <button type="button">after</button>
      </>,
    );
    const duplicate = screen.getByRole('button', { name: 'Duplicate' });
    const del = screen.getByRole('button', { name: 'Delete' });
    const later = screen.getByRole('button', { name: 'Move later' });
    const edit = screen.getByRole('button', { name: 'Edit text' });

    await user.tab();
    expect(duplicate).toHaveFocus();
    expect(duplicate).toHaveAttribute('tabindex', '0');
    expect(del).toHaveAttribute('tabindex', '-1');

    await user.keyboard('{ArrowRight}');
    expect(del).toHaveFocus();
    await user.keyboard('{ArrowRight}'); // skips the disabled "Move earlier"
    expect(later).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(edit).toHaveFocus();
    await user.keyboard('{ArrowRight}'); // wraps
    expect(duplicate).toHaveFocus();
    await user.keyboard('{ArrowLeft}'); // wraps backwards to the fifth action
    expect(edit).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(later).toHaveFocus();
    await user.keyboard('{Home}');
    expect(duplicate).toHaveFocus();
    await user.keyboard('{End}');
    expect(edit).toHaveFocus();

    // A single stop: Tab leaves the toolbar entirely.
    await user.tab();
    expect(screen.getByRole('button', { name: 'after' })).toHaveFocus();
  });

  it('activates with Enter and Space (US3/AC5 — operable without a pointer)', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(<BlockActionBar label="Actions for Text" actions={ACTIONS} onAction={onAction} />);

    await user.tab();
    await user.keyboard('{Enter}');
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenLastCalledWith('duplicate');

    await user.keyboard('{ArrowRight}');
    await user.keyboard(' ');
    expect(onAction).toHaveBeenCalledTimes(2);
    expect(onAction).toHaveBeenLastCalledWith('delete');
  });

  it('mirrors the arrow pair under RTL — forward is the reading direction', async () => {
    const user = userEvent.setup();
    render(
      <BlockActionBar label="Actions for Text" actions={ACTIONS} onAction={vi.fn()} dir="rtl" />,
    );
    const duplicate = screen.getByRole('button', { name: 'Duplicate' });
    const del = screen.getByRole('button', { name: 'Delete' });

    await user.tab();
    expect(duplicate).toHaveFocus();
    await user.keyboard('{ArrowLeft}'); // forward under RTL
    expect(del).toHaveFocus();
    await user.keyboard('{ArrowRight}'); // backward under RTL
    expect(duplicate).toHaveFocus();
  });

  it('keeps disabled actions laid out while the toolbar becomes the sole tab stop', async () => {
    const user = userEvent.setup();
    const allDisabled = ACTIONS.map((action) => ({ ...action, enabled: false }));
    render(
      <>
        <BlockActionBar label="Actions for Root" actions={allDisabled} onAction={vi.fn()} />
        <button type="button">after</button>
      </>,
    );
    const toolbar = screen.getByRole('toolbar', { name: 'Actions for Root' });
    const disabledActions = toolbar.querySelectorAll('button');
    expect(screen.getAllByRole('button')).toHaveLength(6); // 5 rendered + "after"
    expect(disabledActions).toHaveLength(5);
    for (const action of disabledActions) {
      expect(action).toBeDisabled();
      expect(action).toHaveAttribute('tabindex', '-1');
    }

    await user.tab();
    expect(toolbar).toHaveFocus();
    expect(toolbar).toHaveAttribute('tabindex', '0');

    await user.tab();
    expect(screen.getByRole('button', { name: 'after' })).toHaveFocus();
  });

  /**
   * ICON-ONLY, BUT NEVER NAMELESS.
   *
   * Five worded actions made this bar as wide as the block it floats over,
   * which is the opposite of ambient furniture. The words did not go away —
   * they moved into visually-hidden text, which is what the accessibility tree
   * and these tests read. A glyph plus `aria-label` would have worked too and
   * been worse: two names for one action, free to drift apart.
   */
  it('shows a mark for every action while the name stays in the accessibility tree', () => {
    render(<BlockActionBar label="Actions for Text" actions={ACTIONS} onAction={vi.fn()} />);
    const toolbar = screen.getByRole('toolbar', { name: 'Actions for Text' });

    for (const action of ACTIONS) {
      const button = screen.getByRole('button', { name: action.label });
      // A mark a person can see...
      const mark = button.querySelector('svg');
      expect(mark).not.toBeNull();
      expect(mark).toHaveAttribute('aria-hidden', 'true');
      // ...and the name they cannot, which is the ONE accessible name.
      expect(button.querySelector('.bldr-visually-hidden')?.textContent).toBe(action.label);
      expect(button).not.toHaveAttribute('aria-label');
      // Styling hooks on the id, so a rule never has to match English prose.
      expect(button).toHaveAttribute('data-action', action.id);
    }

    // Non-vacuous: every action really is distinct, so a single shared glyph
    // could not satisfy the loop above.
    const marks = [...toolbar.querySelectorAll('svg')].map((svg) => svg.innerHTML);
    expect(new Set(marks).size).toBe(ACTIONS.length);
  });
});
