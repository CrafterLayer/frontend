/**
 * IconButton (SPEC §4.21): the shell's ChromeButton, an AgentIcon and a Radix Tooltip.
 *
 * The first test is the regression this component exists for. The v1 composer re-rendered
 * as its textarea blurred, and a press on Send runs exactly that sequence: pointerdown
 * moves focus to the button, the textarea blurs, the composer re-renders, then pointerup.
 * v1's glyph was written through `dangerouslySetInnerHTML` with a fresh object per render,
 * so the re-render replaced the path under the pointer; pointerdown and pointerup then
 * had no common target and no click fired (visual audit P0-1). The control harness below
 * rebuilds that v1 button, so the test proves it can see the bug before it proves the fix.
 *
 * user-event computes a click the way a browser does, as the common ancestor of the
 * pointerdown and pointerup targets, so a detached pointerdown target loses the click here
 * exactly as it did in Chromium. The Chromium story `FirstClickAfterBlur` repeats the
 * press with Playwright's real mouse.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState, type ComponentType } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { AgentTooltipProvider } from './AgentTooltipProvider';
import { IconButton } from './IconButton';

/*
  Radix measures its tooltip before positioning it, and jsdom has no ResizeObserver. A
  no-op is the honest stand-in: these tests assert what the tooltip says and where it is
  mounted, never where it lands; geometry belongs to the Chromium stories.
*/
beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe = (): void => undefined;
    unobserve = (): void => undefined;
    disconnect = (): void => undefined;
  };
});

afterEach(() => {
  vi.restoreAllMocks();
});

const CSS = readFileSync(
  join(process.cwd(), 'src', 'features', 'agent', 'components', 'IconButton', 'IconButton.css'),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//g, '');

/* ── The first-click harness ─────────────────────────────────────────────────── */

interface SendSlotProps {
  readonly focused: boolean;
  readonly onClick: () => void;
}

/** The product's Send slot: an IconButton that re-renders whenever the composer does. */
function ProductSend({ focused, onClick }: SendSlotProps) {
  return (
    <IconButton
      icon="send"
      label="Send"
      className={focused ? 'is-focused' : 'is-blurred'}
      onClick={onClick}
    />
  );
}

/** The v1 Send slot, rebuilt as the control: a fresh `{ __html }` object on every render. */
function V1Send({ focused, onClick }: SendSlotProps) {
  return (
    <button
      type="button"
      aria-label="Send"
      className={focused ? 'is-focused' : 'is-blurred'}
      onClick={onClick}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: '<path d="M8 13V3M3.5 7.5 8 3l4.5 4.5"/>' }}
      />
    </button>
  );
}

/** A composer that re-renders as its textarea gains and loses focus, as v1's did. */
function Composer({ Send, onSend }: { Send: ComponentType<SendSlotProps>; onSend: () => void }) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <textarea
        aria-label="Your request"
        onFocus={() => {
          setFocused(true);
        }}
        onBlur={() => {
          setFocused(false);
        }}
      />
      <Send focused={focused} onClick={onSend} />
    </div>
  );
}

function pathIn(button: HTMLElement): Element {
  const path = button.querySelector('path');
  if (path === null) throw new Error('no path in the button');
  return path;
}

/** Press on the glyph, the deepest node a real pointer lands on, and release there. */
async function pressAfterBlur(Send: ComponentType<SendSlotProps>) {
  const user = userEvent.setup();
  const onSend = vi.fn();
  render(<Composer Send={Send} onSend={onSend} />);
  await user.click(screen.getByRole('textbox', { name: 'Your request' }));
  const button = screen.getByRole('button', { name: 'Send' });
  expect(button).toHaveClass('is-focused');

  const pressed = pathIn(button);
  await user.pointer({ keys: '[MouseLeft>]', target: pressed });
  // Between press and release: focus moved to the button, the textarea blurred, and the
  // composer re-rendered the Send slot. This is the window the v1 bug lived in.
  expect(button).toHaveFocus();
  expect(button).toHaveClass('is-blurred');

  const released = pathIn(button);
  await user.pointer({ keys: '[/MouseLeft]', target: released });
  return { onSend, pressed, released };
}

describe('IconButton: the first press after the textarea blurs', () => {
  it('control: the v1 button loses that press, because its glyph was replaced mid-press', async () => {
    const { onSend, pressed, released } = await pressAfterBlur(V1Send);
    expect(released).not.toBe(pressed);
    expect(pressed.isConnected).toBe(false);
    expect(onSend).not.toHaveBeenCalled();
  });

  it('fires click on the first press: the glyph under the pointer survives the re-render', async () => {
    const { onSend, pressed, released } = await pressAfterBlur(ProductSend);
    expect(released).toBe(pressed);
    expect(pressed.isConnected).toBe(true);
    expect(onSend).toHaveBeenCalledTimes(1);
  });
});

/* ── Identity, name, tooltip ─────────────────────────────────────────────────── */

describe('IconButton', () => {
  it('keeps the same button and glyph nodes across renders', () => {
    const { rerender } = render(<IconButton icon="undo" label="Undo" />);
    const button = screen.getByRole('button', { name: 'Undo' });
    const svg = button.querySelector('svg');
    const shapes = [...(svg?.children ?? [])];

    rerender(<IconButton icon="undo" label="Undo Hero" hint="Can't undo" unavailable />);
    rerender(<IconButton icon="undo" label="Undo Hero" pressed={false} />);
    rerender(<IconButton icon="undo" label="Undo" pressed />);

    const after = screen.getByRole('button', { name: 'Undo' });
    expect(after).toBe(button);
    expect(after.querySelector('svg')).toBe(svg);
    expect([...(svg?.children ?? [])]).toEqual(shapes);
  });

  it('is named by its label, and its tooltip says exactly that name', async () => {
    const user = userEvent.setup();
    render(
      <AgentTooltipProvider delayDuration={0}>
        <IconButton icon="history" label="Conversations" />
      </AgentTooltipProvider>,
    );
    const button = screen.getByRole('button', { name: 'Conversations' });
    await user.tab();
    expect(button).toHaveFocus();
    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveTextContent(/^Conversations$/);
    // The tooltip repeats the name; it is not also wired up as the description.
    expect(button).not.toHaveAttribute('aria-describedby');
  });

  it('opens its tooltip on hover, from the shared provider', async () => {
    const user = userEvent.setup();
    render(
      <AgentTooltipProvider delayDuration={0}>
        <IconButton icon="plus" label="New conversation" />
      </AgentTooltipProvider>,
    );
    await user.hover(screen.getByRole('button', { name: 'New conversation' }));
    expect(await screen.findByRole('tooltip')).toHaveTextContent(/^New conversation$/);
  });

  it('works without a provider: it brings its own', async () => {
    const user = userEvent.setup();
    render(<IconButton icon="plus" label="New conversation" />);
    await user.tab();
    expect(await screen.findByRole('tooltip')).toHaveTextContent('New conversation');
  });

  it('shows a hint as a second tooltip line and as the description, never as the name', async () => {
    const user = userEvent.setup();
    render(
      <AgentTooltipProvider delayDuration={0}>
        <IconButton
          icon="plus"
          label="New conversation"
          hint="Available when the current work ends"
        />
      </AgentTooltipProvider>,
    );
    const button = screen.getByRole('button', { name: 'New conversation' });
    expect(button).toHaveAccessibleDescription('Available when the current work ends');
    await user.tab();
    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveTextContent('New conversation');
    expect(tooltip).toHaveTextContent('Available when the current work ends');
  });

  it('appends the caller’s own description after the hint', () => {
    render(
      <>
        <p id="revived">Undo isn't available after a reload.</p>
        <IconButton icon="undo" label="Undo Hero" unavailable describedBy="revived" />
      </>,
    );
    expect(screen.getByRole('button', { name: 'Undo Hero' })).toHaveAccessibleDescription(
      "Undo isn't available after a reload.",
    );
  });

  it('stays focusable while unavailable, and does nothing when pressed', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const onPointerDown = vi.fn();
    render(
      <IconButton
        icon="plus"
        label="New conversation"
        hint="Available when the current work ends"
        unavailable
        onClick={onClick}
        onPointerDown={onPointerDown}
      />,
    );
    const button = screen.getByRole('button', { name: 'New conversation' });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toBeEnabled();

    await user.click(button);
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    expect(button).toHaveFocus();
    expect(onClick).not.toHaveBeenCalled();
    // A trigger's own handlers (a menu opening on pointerdown) are held back as well.
    expect(onPointerDown).not.toHaveBeenCalled();
  });

  it('is a toggle when given pressed', async () => {
    const user = userEvent.setup();
    function Preview() {
      const [on, setOn] = useState(false);
      return (
        <IconButton
          icon="preview"
          label="Preview"
          pressed={on}
          onClick={() => {
            setOn((value) => !value);
          }}
        />
      );
    }
    render(<Preview />);
    const button = screen.getByRole('button', { name: 'Preview' });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    await user.click(button);
    expect(button).toHaveAttribute('aria-pressed', 'true');
  });

  it('forwards its ref and the attributes a popup trigger sets', () => {
    let node: HTMLButtonElement | null = null;
    render(
      <IconButton
        icon="history"
        label="Conversations"
        ref={(element) => {
          node = element;
        }}
        id="history-trigger"
        aria-haspopup="dialog"
        aria-expanded={false}
        aria-controls="history-popover"
        data-testid="trigger"
      />,
    );
    const button = screen.getByTestId('trigger');
    expect(node).toBe(button);
    expect(button).toHaveAttribute('id', 'history-trigger');
    expect(button).toHaveAttribute('aria-haspopup', 'dialog');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveAttribute('aria-controls', 'history-popover');
    expect(button).toHaveAttribute('type', 'button');
  });

  it('aligns its tooltip to its own inline end when asked, for a button at the panel’s edge', async () => {
    const user = userEvent.setup();
    render(
      <AgentTooltipProvider delayDuration={0}>
        <IconButton icon="plus" label="New conversation" tooltipAlign="end" />
      </AgentTooltipProvider>,
    );
    await user.tab();
    const content = (await screen.findByRole('tooltip')).closest('.ck-agent-tooltip');
    expect(content).toHaveAttribute('data-align', 'end');
  });

  it('keeps its tooltip shut while the menu or popover it opened is open', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <AgentTooltipProvider delayDuration={0}>
        <IconButton icon="more" label="More options" aria-haspopup="menu" aria-expanded />
      </AgentTooltipProvider>,
    );
    await user.hover(screen.getByRole('button', { name: 'More options' }));
    await user.tab();
    expect(screen.queryByRole('tooltip')).toBeNull();

    rerender(
      <AgentTooltipProvider delayDuration={0}>
        <IconButton icon="more" label="More options" aria-haspopup="menu" aria-expanded={false} />
      </AgentTooltipProvider>,
    );
    await user.unhover(screen.getByRole('button', { name: 'More options' }));
    await user.hover(screen.getByRole('button', { name: 'More options' }));
    expect(await screen.findByRole('tooltip')).toHaveTextContent('More options');
  });

  it('mounts its tooltip inside the panel, so it keeps the panel’s theme, language and direction', async () => {
    const user = userEvent.setup();
    render(
      <div data-bldr-theme="dark">
        <div className="ck-agent" data-testid="panel" dir="rtl" lang="ar">
          <AgentTooltipProvider delayDuration={0}>
            <IconButton icon="history" label="المحادثات" />
          </AgentTooltipProvider>
        </div>
      </div>,
    );
    await user.tab();
    const tooltip = await screen.findByRole('tooltip');
    const panel = screen.getByTestId('panel');
    expect(panel).toContainElement(tooltip);
    const content = tooltip.closest('.ck-agent-tooltip');
    expect(content).toHaveAttribute('lang', 'ar');
    expect(content).toHaveAttribute('dir', 'rtl');
    expect(within(panel).getByRole('button', { name: 'المحادثات' })).toBeInTheDocument();
  });

  it('still carries the language and direction when nothing themed is above it', async () => {
    const user = userEvent.setup();
    render(
      <div dir="rtl" lang="ar">
        <IconButton icon="plus" label="محادثة جديدة" />
      </div>,
    );
    await user.tab();
    const content = (await screen.findByRole('tooltip')).closest('.ck-agent-tooltip');
    expect(content).toHaveAttribute('lang', 'ar');
    expect(content).toHaveAttribute('dir', 'rtl');
  });
});

/* ── The stylesheet's promises ───────────────────────────────────────────────── */

describe('IconButton.css', () => {
  it('is 32px on a fine pointer and 44px on a coarse one', () => {
    expect(CSS).toMatch(/block-size:\s*var\(--bldr-control-md\);/);
    expect(CSS).toMatch(/inline-size:\s*var\(--bldr-control-md\);/);
    const coarse = /@media \(pointer: coarse\)\s*\{([\s\S]*?)\n\}/.exec(CSS)?.[1] ?? '';
    expect(coarse).toMatch(/block-size:\s*var\(--bldr-hit-target-min\);/);
    expect(coarse).toMatch(/inline-size:\s*var\(--bldr-hit-target-min\);/);
  });

  it('never paints hover in Indigo (SPEC §2.1 rule 3)', () => {
    const hoverRules = [...CSS.matchAll(/([^{}]*:hover[^{}]*)\{([^}]*)\}/g)];
    expect(hoverRules.length).toBeGreaterThan(0);
    for (const [, selector = '', body = ''] of hoverRules) {
      if (selector.includes("aria-pressed='true'")) continue;
      expect({ selector: selector.trim(), indigo: /--bldr-accent\b(?!-soft)/.test(body) }).toEqual({
        selector: selector.trim(),
        indigo: false,
      });
    }
  });

  it('uses logical properties only', () => {
    expect(CSS).not.toMatch(
      /(^|[\s;{])(left|right|margin-left|margin-right|padding-left|padding-right|border-left|border-right)\s*:|text-align:\s*(left|right)|translateX/,
    );
  });
});
