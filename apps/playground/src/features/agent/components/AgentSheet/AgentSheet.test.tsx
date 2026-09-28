/**
 * AgentSheet (SPEC §4.19, §3.16, §6.3): the panel on a phone, with two detents.
 *
 * - Full is a modal dialog: named, `aria-modal`, Tab and Shift+Tab loop inside it, Esc
 *   closes it (but not from a field that owns its Esc), a press above it drops it to mini.
 * - Mini is a region over the live canvas; focusing a text field raises the sheet to full.
 * - Every move names where focus goes: into the dialog; `[⤒]` on dropping (only when focus
 *   was in the sheet); `[⤓]` on rising; the rail's agent button on closing.
 * - The one live region is mounted once, outside the part that goes inert.
 * - The composer rides the visual viewport above the keyboard; safe areas are respected.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AgentSheet, type SheetDetent } from './AgentSheet';

const TOKENS = new Set(
  [
    ...readFileSync(
      join(process.cwd(), '..', '..', 'packages', 'builder', 'theme', 'src', 'css', 'chrome.css'),
      'utf8',
    ).matchAll(/(--bldr-[\w-]+)\s*:/gu),
  ].map(([, name = '']) => name),
);

const CSS = readFileSync(
  join(process.cwd(), 'src', 'features', 'agent', 'components', 'AgentSheet', 'AgentSheet.css'),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//gu, '');

interface HarnessProps {
  readonly initial?: SheetDetent;
  readonly onDetentChange?: (detent: SheetDetent) => void;
  readonly container?: Element | null;
}

/**
 * The rail's agent button, a control outside the sheet that moves it (as the host can),
 * and the sheet: the full face stands for the phone header, thread and composer; the mini
 * face for SheetMiniBar, with a field to show the keyboard raising the sheet.
 */
function Harness({ initial = 'full', onDetentChange, container }: HarnessProps) {
  const [detent, setDetent] = useState<SheetDetent>(initial);
  const rail = useRef<HTMLButtonElement | null>(null);
  const move = (next: SheetDetent): void => {
    onDetentChange?.(next);
    setDetent(next);
  };
  return (
    <div>
      <button
        ref={rail}
        type="button"
        onClick={() => {
          move('full');
        }}
      >
        Agent
      </button>
      <button
        type="button"
        onClick={() => {
          move('mini');
        }}
      >
        Host drops it
      </button>
      <AgentSheet
        locale="en"
        detent={detent}
        onDetentChange={move}
        returnFocus={() => rail.current}
        container={container}
        persistent={<div role="status" aria-live="polite" data-testid="live" />}
        mini={(sheet) => (
          <div>
            <p>1 of 8 on the page</p>
            <input aria-label="Quick note" />
            <button ref={sheet.backToChatRef} type="button" onClick={sheet.backToChat}>
              Back to the chat
            </button>
          </div>
        )}
      >
        {(sheet) => (
          <div>
            <button type="button" onClick={sheet.close}>
              Close
            </button>
            <button ref={sheet.showPageRef} type="button" onClick={sheet.showPage}>
              Show the page
            </button>
            <textarea aria-label="Message" />
            <button type="button">Send</button>
          </div>
        )}
      </AgentSheet>
    </div>
  );
}

function sheetRoot(): HTMLElement {
  const root = document.querySelector<HTMLElement>('.ck-agent-sheet');
  if (root === null) throw new Error('no sheet');
  return root;
}

function face(which: 'full' | 'mini'): HTMLElement {
  const element = sheetRoot().querySelector<HTMLElement>(`.ck-agent-sheet__${which}`);
  if (element === null) throw new Error(`no ${which} face`);
  return element;
}

afterEach(() => {
  Reflect.deleteProperty(window, 'visualViewport');
});

describe('AgentSheet: detents', () => {
  it('at full, is a modal dialog named for the agent, and takes focus in', () => {
    render(<Harness />);
    const dialog = screen.getByRole('dialog', { name: 'Abu Ghadab' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('data-detent', 'full');
    expect(face('full')).toHaveFocus();
    expect(face('full')).not.toHaveAttribute('inert');
    expect(face('mini')).toHaveAttribute('inert');
  });

  it('at mini, is a region over the canvas, never a dialog, and the chat is inert', () => {
    render(<Harness initial="mini" />);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('region', { name: 'Abu Ghadab' })).toBe(face('mini'));
    expect(sheetRoot()).toHaveAttribute('data-detent', 'mini');
    expect(sheetRoot()).not.toHaveAttribute('aria-modal');
    expect(face('full')).toHaveAttribute('inert');
    expect(face('mini')).not.toHaveAttribute('inert');
  });

  it('closed, keeps both faces mounted and inert', () => {
    render(<Harness initial="closed" />);
    expect(sheetRoot()).toHaveAttribute('data-detent', 'closed');
    expect(face('full')).toHaveAttribute('inert');
    expect(face('mini')).toHaveAttribute('inert');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Show the page drops to mini, with focus on Back to the chat', async () => {
    const user = userEvent.setup();
    const onDetentChange = vi.fn();
    render(<Harness onDetentChange={onDetentChange} />);
    await user.click(screen.getByRole('button', { name: 'Show the page' }));
    expect(onDetentChange).toHaveBeenLastCalledWith('mini');
    expect(screen.getByRole('button', { name: 'Back to the chat' })).toHaveFocus();
    expect(sheetRoot()).toHaveAttribute('data-from', 'full');
  });

  it('Back to the chat rises to full, with focus on Show the page', async () => {
    const user = userEvent.setup();
    const onDetentChange = vi.fn();
    render(<Harness onDetentChange={onDetentChange} />);
    await user.click(screen.getByRole('button', { name: 'Show the page' }));
    await user.click(screen.getByRole('button', { name: 'Back to the chat' }));
    expect(onDetentChange).toHaveBeenLastCalledWith('full');
    expect(screen.getByRole('button', { name: 'Show the page' })).toHaveFocus();
    expect(sheetRoot()).toHaveAttribute('data-from', 'mini');
  });

  it('Close returns focus to the rail’s agent button', async () => {
    const user = userEvent.setup();
    const onDetentChange = vi.fn();
    render(<Harness onDetentChange={onDetentChange} />);
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onDetentChange).toHaveBeenLastCalledWith('closed');
    expect(screen.getByRole('button', { name: 'Agent' })).toHaveFocus();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('dropping to mini never takes focus from the canvas', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const host = screen.getByRole('button', { name: 'Host drops it' });
    await user.click(host);
    expect(sheetRoot()).toHaveAttribute('data-detent', 'mini');
    expect(host).toHaveFocus();
  });

  it('a press on the top bar above the full sheet drops it to mini', async () => {
    const user = userEvent.setup();
    const onDetentChange = vi.fn();
    render(<Harness onDetentChange={onDetentChange} />);
    const scrim = sheetRoot().querySelector<HTMLElement>('.ck-agent-sheet__scrim');
    expect(scrim).toHaveAttribute('aria-hidden', 'true');
    await user.click(scrim!);
    expect(onDetentChange).toHaveBeenLastCalledWith('mini');
    expect(sheetRoot().querySelector('.ck-agent-sheet__scrim')).toBeNull();
  });

  it('opening the keyboard at mini raises the sheet to full', async () => {
    const user = userEvent.setup();
    const onDetentChange = vi.fn();
    render(<Harness initial="mini" onDetentChange={onDetentChange} />);
    const field = screen.getByRole('textbox', { name: 'Quick note' });
    await user.click(field);
    expect(onDetentChange).toHaveBeenLastCalledWith('full');
    // The field that raised it keeps focus: the person is typing.
    expect(field).toHaveFocus();
  });

  it('never moves by itself: only the host changes the detent', () => {
    const onDetentChange = vi.fn();
    const { rerender } = render(<Harness onDetentChange={onDetentChange} />);
    rerender(<Harness onDetentChange={onDetentChange} />);
    expect(onDetentChange).not.toHaveBeenCalled();
  });
});

describe('AgentSheet: keys', () => {
  it('Esc on a control closes the full sheet and returns focus to the rail button', async () => {
    const user = userEvent.setup();
    const onDetentChange = vi.fn();
    render(<Harness onDetentChange={onDetentChange} />);
    screen.getByRole('button', { name: 'Send' }).focus();
    await user.keyboard('{Escape}');
    expect(onDetentChange).toHaveBeenLastCalledWith('closed');
    expect(screen.getByRole('button', { name: 'Agent' })).toHaveFocus();
  });

  it('Esc in a text field belongs to the field, not the sheet', async () => {
    const user = userEvent.setup();
    const onDetentChange = vi.fn();
    render(<Harness onDetentChange={onDetentChange} />);
    await user.click(screen.getByRole('textbox', { name: 'Message' }));
    await user.keyboard('{Escape}');
    expect(onDetentChange).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('Esc at mini is the canvas’s: the sheet leaves it alone', async () => {
    const user = userEvent.setup();
    const onDetentChange = vi.fn();
    render(<Harness initial="mini" onDetentChange={onDetentChange} />);
    screen.getByRole('button', { name: 'Back to the chat' }).focus();
    await user.keyboard('{Escape}');
    expect(onDetentChange).not.toHaveBeenCalled();
  });

  it('Tab past the last control wraps to the first, and Shift+Tab back', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    screen.getByRole('button', { name: 'Send' }).focus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Send' })).toHaveFocus();
  });
});

describe('AgentSheet: the live region and the page around it', () => {
  it('keeps the one live region mounted and outside the inert face, in every detent', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const live = screen.getByTestId('live');
    expect(face('full').contains(live)).toBe(false);
    expect(face('mini').contains(live)).toBe(false);
    await user.click(screen.getByRole('button', { name: 'Show the page' }));
    expect(screen.getByTestId('live')).toBe(live);
    await user.click(screen.getByRole('button', { name: 'Back to the chat' }));
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.getByTestId('live')).toBe(live);
    expect(document.querySelectorAll('[aria-live], [role="status"]')).toHaveLength(1);
  });

  it('keeps the chat mounted across detents, so the thread keeps its place', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const message = screen.getByRole('textbox', { name: 'Message' });
    await user.type(message, 'Make the button green');
    await user.click(screen.getByRole('button', { name: 'Show the page' }));
    await user.click(screen.getByRole('button', { name: 'Back to the chat' }));
    expect(screen.getByRole('textbox', { name: 'Message' })).toBe(message);
    expect(message).toHaveValue('Make the button green');
  });

  it('mounts into a given container, leaving a marker in place', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const { container } = render(<Harness container={host} />);
    expect(host.querySelector('.ck-agent-sheet')).not.toBeNull();
    expect(container.querySelector('.ck-agent-sheet')).toBeNull();
    expect(container.querySelector('span[hidden]')).not.toBeNull();
    host.remove();
  });
});

describe('AgentSheet: the keyboard', () => {
  function fakeViewport(height: number, scale = 1) {
    const listeners = new Set<() => void>();
    const viewport = {
      height,
      offsetTop: 0,
      scale,
      addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
      removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
    };
    Object.defineProperty(window, 'visualViewport', { value: viewport, configurable: true });
    return {
      viewport,
      fire: () => {
        for (const listener of listeners) listener();
      },
    };
  }

  it('lifts the full sheet by what the keyboard covers, so the composer rides above it', () => {
    const covered = window.innerHeight - 500;
    fakeViewport(500);
    render(<Harness />);
    expect(sheetRoot().style.getPropertyValue('--ck-agent-sheet-keyboard')).toBe(
      `${String(covered)}px`,
    );
  });

  it('follows the keyboard opening and closing', () => {
    const { viewport, fire } = fakeViewport(window.innerHeight);
    render(<Harness />);
    expect(sheetRoot().style.getPropertyValue('--ck-agent-sheet-keyboard')).toBe('0px');
    act(() => {
      viewport.height = window.innerHeight - 300;
      fire();
    });
    expect(sheetRoot().style.getPropertyValue('--ck-agent-sheet-keyboard')).toBe('300px');
  });

  it('ignores a pinch zoom, and the mini detent', () => {
    fakeViewport(400, 2);
    const zoomed = render(<Harness />);
    expect(sheetRoot().style.getPropertyValue('--ck-agent-sheet-keyboard')).toBe('0px');
    zoomed.unmount();

    fakeViewport(400);
    render(<Harness initial="mini" />);
    expect(sheetRoot().style.getPropertyValue('--ck-agent-sheet-keyboard')).toBe('0px');
  });
});

describe('AgentSheet.css', () => {
  it('respects the safe areas: the home indicator under both faces, the notch at the sides', () => {
    expect(CSS).toMatch(
      /--ck-agent-sheet-safe-block-end:\s*var\(\s*--ck-agent-safe-area-block-end,\s*env\(safe-area-inset-bottom, 0px\)\s*\)/u,
    );
    expect(CSS).toMatch(/--ck-agent-sheet-safe-inline-start:\s*env\(safe-area-inset-left, 0px\)/u);
    expect(CSS).toMatch(
      /:dir\(rtl\)\s*\{[^}]*--ck-agent-sheet-safe-inline-start:\s*env\(safe-area-inset-right, 0px\)/u,
    );
    expect(CSS).toMatch(
      /\.ck-agent-sheet__full\s*\{[^}]*padding-block-end:\s*max\(\s*0px,\s*calc\(var\(--ck-agent-sheet-safe-block-end\) - var\(--ck-agent-sheet-keyboard, 0px\)\)\s*\)/u,
    );
    expect(CSS).toMatch(
      /\.ck-agent-sheet__mini\s*\{[^}]*padding-block-end:\s*max\(var\(--bldr-space-md\), var\(--ck-agent-sheet-safe-block-end\)\)/u,
    );
  });

  it('sits under the editor’s top bar at full and on the keyboard', () => {
    expect(CSS).toMatch(/--ck-agent-sheet-top:\s*var\(--bldr-topbar-height\)/u);
    expect(CSS).toMatch(
      /\.ck-agent-sheet__full\s*\{[^}]*inset-block:\s*var\(--ck-agent-sheet-top\) var\(--ck-agent-sheet-keyboard, 0px\)/u,
    );
  });

  it('is the phone’s density: 44px targets, a 56px header, 16px input', () => {
    expect(CSS).toMatch(
      /\.ck-agent-sheet\s*\{[^}]*--bldr-agent-header-height:\s*calc\(var\(--bldr-hit-target-min\) \+ var\(--bldr-space-xl\)\)/u,
    );
    expect(CSS).toMatch(
      /\.ck-agent-sheet\s*\{[^}]*--bldr-agent-row-height:\s*var\(--bldr-hit-target-min\)/u,
    );
    expect(CSS).toMatch(/\.ck-agent-sheet\s*\{[^}]*--bldr-font-size-input:\s*16px/u);
    expect(CSS).toMatch(
      /\.ck-agent-icon-button[^{]*\{[^}]*inline-size:\s*var\(--bldr-hit-target-min\)/u,
    );
  });

  it('moves on the block axis over enter, leaves over exit, and not at all under reduced motion', () => {
    expect(CSS).toMatch(/translate var\(--bldr-duration-enter\) var\(--bldr-easing-enter\)/u);
    expect(CSS).toMatch(
      /\[data-detent='closed'\] \.ck-agent-sheet__full\s*\{[^}]*translate var\(--bldr-duration-exit\) var\(--bldr-easing-exit\)/u,
    );
    // Only the block axis moves: every `translate` starts with a zero inline offset.
    expect(CSS).not.toMatch(/translateX/u);
    for (const [, value = ''] of CSS.matchAll(/translate:\s*([^;]+);/gu)) {
      expect(value.startsWith('0 ')).toBe(true);
    }
    const reduced = CSS.slice(CSS.indexOf('prefers-reduced-motion'));
    expect(reduced).toMatch(/transition:\s*none/u);
  });

  it('floats at e3 on Paper with 12px top corners, and keeps an edge in forced colours', () => {
    expect(CSS).toMatch(
      /\.ck-agent-sheet__full\s*\{[^}]*box-shadow:\s*var\(--bldr-shadow-overlay\)/u,
    );
    expect(CSS).toMatch(
      /\.ck-agent-sheet__full\s*\{[^}]*border-start-start-radius:\s*var\(--bldr-radius-xl\)/u,
    );
    expect(CSS).toMatch(/forced-colors: active[\s\S]*border-block-start:[^;]*CanvasText/u);
  });

  it('reads only tokens the chrome contract defines, through logical properties', () => {
    const used = [...CSS.matchAll(/var\((--bldr-[\w-]+)/gu)].map(([, name = '']) => name);
    expect(used.filter((name) => !TOKENS.has(name))).toEqual([]);
    expect(CSS).not.toMatch(
      /(?:^|[\s;{])(?:left|right|top|bottom|(?:margin|padding|border)-(?:left|right|top|bottom)|(?:min-|max-)?(?:width|height))\s*:/mu,
    );
    expect(CSS).not.toMatch(/#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|oklch)\(/iu);
  });
});
