/**
 * InlineConfirm (SPEC §4.15): an in-place confirm that replaces the button that opened it,
 * in the same footer row. Never a modal.
 *
 * Focus is the whole contract (SPEC §6.3), and every destination is asserted by name,
 * never by "focus left X", which a focus that fell to `body` would also pass:
 * - opening moves focus to Cancel, the safe answer;
 * - Esc and Cancel close it and return focus to the opener;
 * - confirming leaves focus wherever the action sent it (Undo build → the record's head),
 *   and only when the action sent it nowhere does it return to the opener.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { InlineConfirm, type InlineConfirmProps } from './InlineConfirm';

const CSS = readFileSync(
  join(
    process.cwd(),
    'src',
    'features',
    'agent',
    'components',
    'InlineConfirm',
    'InlineConfirm.css',
  ),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//g, '');

const MESSAGE = 'The page goes back to how it was before this request. The conversation stays.';

function UndoBuild(overrides: Partial<InlineConfirmProps>) {
  return (
    <InlineConfirm
      message={MESSAGE}
      confirmLabel="Undo"
      cancelLabel="Cancel"
      onConfirm={vi.fn()}
      renderOpener={({ open }) => (
        <button type="button" onClick={open}>
          Undo build
        </button>
      )}
      {...overrides}
    />
  );
}

function opener(): HTMLElement {
  return screen.getByRole('button', { name: 'Undo build' });
}

describe('InlineConfirm', () => {
  it('shows only its opener until opened', () => {
    render(<UndoBuild />);
    expect(opener()).toBeInTheDocument();
    expect(screen.queryByRole('group')).toBeNull();
  });

  it('replaces the opener in place and moves focus to Cancel', async () => {
    const user = userEvent.setup();
    render(<UndoBuild />);
    await user.click(opener());

    const group = screen.getByRole('group', { name: MESSAGE });
    expect(screen.queryByRole('button', { name: 'Undo build' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    expect(group).toContainElement(screen.getByRole('button', { name: 'Undo' }));
  });

  it('is never a modal', async () => {
    const user = userEvent.setup();
    render(<UndoBuild />);
    await user.click(opener());
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.getByRole('group')).not.toHaveAttribute('aria-modal');
  });

  it('cancels on Esc and returns focus to the opener', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    const onParentKey = vi.fn();
    render(
      <div onKeyDown={onParentKey}>
        <UndoBuild onCancel={onCancel} onConfirm={onConfirm} />
      </div>,
    );
    await user.click(opener());
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('group')).toBeNull();
    expect(opener()).toHaveFocus();
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
    // Esc is spent here: the composer or a popover around it must not also act on it.
    expect(
      onParentKey.mock.calls.some(([event]) => (event as KeyboardEvent).key === 'Escape'),
    ).toBe(false);
  });

  it('cancels with Cancel and returns focus to the opener', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<UndoBuild onCancel={onCancel} />);
    await user.click(opener());
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(opener()).toHaveFocus();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('confirms once, and returns focus to the opener when the action sends it nowhere', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<UndoBuild onConfirm={onConfirm} />);
    await user.click(opener());
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('group')).toBeNull();
    expect(opener()).toHaveFocus();
  });

  it('leaves focus where the confirmed action sent it', async () => {
    const user = userEvent.setup();
    function Record() {
      const head = useRef<HTMLHeadingElement>(null);
      return (
        <article aria-labelledby="head">
          <h3 id="head" tabIndex={-1} ref={head}>
            Build undone
          </h3>
          <UndoBuild
            onConfirm={() => {
              head.current?.focus();
            }}
          />
        </article>
      );
    }
    render(<Record />);
    await user.click(opener());
    // Cancel holds focus; the confirm sits before it.
    await user.keyboard('{Shift>}{Tab}{/Shift}');
    expect(screen.getByRole('button', { name: 'Undo' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('heading', { name: 'Build undone' })).toHaveFocus();
  });

  it('can be opened by its owner, and still lands on Cancel', async () => {
    const user = userEvent.setup();
    function HistoryRow() {
      const [confirming, setConfirming] = useState(false);
      return (
        <div>
          <button
            type="button"
            onKeyDown={(event) => {
              if (event.key === 'Delete') setConfirming(true);
            }}
          >
            Dental clinic, Amman
          </button>
          <InlineConfirm
            open={confirming}
            onOpenChange={setConfirming}
            tone="danger"
            message="Delete this conversation? This can't be undone. The page stays as it is."
            confirmLabel="Delete"
            cancelLabel="Cancel"
            onConfirm={vi.fn()}
            renderOpener={({ open }) => (
              <button type="button" onClick={open} aria-label="Delete conversation">
                ×
              </button>
            )}
          />
        </div>
      );
    }
    render(<HistoryRow />);
    await user.click(screen.getByRole('button', { name: 'Dental clinic, Amman' }));
    await user.keyboard('{Delete}');
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    expect(screen.getByRole('group')).toHaveAttribute('data-tone', 'danger');

    await user.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: 'Delete conversation' })).toHaveFocus();
  });
});

describe('InlineConfirm.css', () => {
  it('adds no box around the opener, so the footer lays it out directly', () => {
    expect(/\.ck-agent-confirm-opener\s*\{([^}]*)\}/.exec(CSS)?.[1]).toMatch(/display:\s*contents/);
  });

  it('takes the footer row’s full width', () => {
    const root = /\.ck-agent-confirm\s*\{([^}]*)\}/.exec(CSS)?.[1] ?? '';
    expect(root).toMatch(/flex:\s*1 1 100%/);
  });

  it('sizes its buttons 32px, and 44px on a coarse pointer', () => {
    expect(CSS).toMatch(/block-size:\s*var\(--bldr-control-md\)/);
    const coarse = /@media \(pointer: coarse\)\s*\{([\s\S]*?)\n\}/.exec(CSS)?.[1] ?? '';
    expect(coarse).toMatch(/block-size:\s*var\(--bldr-hit-target-min\)/);
  });

  it('draws a destructive confirm as an Alarm outline, never an Indigo fill', () => {
    const danger =
      /\[data-tone='danger'\][^{]*\.ck-agent-confirm__confirm[^{]*\{([^}]*)\}/.exec(CSS)?.[1] ?? '';
    expect(danger).toMatch(/border-color:\s*var\(--bldr-danger\)/);
    expect(danger).toMatch(/color:\s*var\(--bldr-danger\)/);
    expect(CSS).not.toMatch(/background-color:\s*var\(--bldr-accent\)/);
  });

  it('uses logical properties only', () => {
    expect(CSS).not.toMatch(
      /(^|[\s;{])(left|right|margin-left|margin-right|padding-left|padding-right|border-left|border-right)\s*:|text-align:\s*(left|right)|translateX/,
    );
  });
});
