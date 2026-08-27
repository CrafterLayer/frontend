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
    const labels = Array.from(toolbar.querySelectorAll('button')).map(
      (button) => button.textContent,
    );
    expect(labels).toEqual(['Duplicate', 'Delete', 'Move earlier', 'Move later', 'Edit text']);
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

  it('keeps disabled actions in the layout but out of the tab order', async () => {
    const user = userEvent.setup();
    const allDisabled = ACTIONS.map((action) => ({ ...action, enabled: false }));
    render(
      <>
        <BlockActionBar label="Actions for Root" actions={allDisabled} onAction={vi.fn()} />
        <button type="button">after</button>
      </>,
    );
    expect(screen.getAllByRole('button')).toHaveLength(6); // 5 rendered + "after"
    await user.tab(); // nothing in the bar can take focus
    expect(screen.getByRole('button', { name: 'after' })).toHaveFocus();
  });
});
