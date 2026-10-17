/**
 * StopButton (SPEC §4.17, §6.3, §6.7): ■ and the word at every width, in its own place.
 *
 * Ours to prove: the name and the word (WCAG 2.5.3: the name contains the visible word,
 * even while stopping); stopping is `aria-disabled`, never `disabled`, so the focus the
 * press put here stays; a press while stopping does nothing; the chord is announced and
 * shown for the platform; and `isStopShortcut` accepts exactly the chord.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { t } from '../../copy';

import { StopButton } from './StopButton';
import { isStopShortcut, stopKeyShortcuts, stopShortcutLabel } from './stop-shortcut';

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe = (): void => undefined;
    unobserve = (): void => undefined;
    disconnect = (): void => undefined;
  };
});

const CSS = readFileSync(
  join(process.cwd(), 'src', 'features', 'agent', 'components', 'StopButton', 'StopButton.css'),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//gu, '');

function StopProbe({ onStop }: { readonly onStop: () => void }) {
  const [stopping, setStopping] = useState(false);
  return (
    <StopButton
      locale="en"
      stopping={stopping}
      apple
      onStop={() => {
        onStop();
        setStopping(true);
      }}
    />
  );
}

describe('StopButton', () => {
  it('shows ■ and the word, and is named by it', () => {
    render(<StopButton locale="en" stopping={false} onStop={vi.fn()} />);
    const button = screen.getByRole('button', { name: 'Stop' });
    expect(button).toHaveTextContent('Stop');
    expect(button.querySelector('svg')).not.toBeNull();
    expect(button).not.toHaveAttribute('aria-disabled');
  });

  it('speaks Arabic in the masdar', () => {
    render(<StopButton locale="ar" stopping={false} onStop={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'إيقاف' })).toHaveTextContent('إيقاف');
  });

  it('keeps focus on the same button while stopping, named “Stopping…”, aria-disabled', async () => {
    const user = userEvent.setup();
    const onStop = vi.fn();
    render(<StopProbe onStop={onStop} />);
    const stop = screen.getByRole('button', { name: 'Stop' });
    await user.click(stop);
    expect(onStop).toHaveBeenCalledTimes(1);
    const stopping = screen.getByRole('button', { name: t('en', 'stopping') });
    expect(stopping).toBe(stop);
    expect(stopping).toHaveFocus();
    expect(stopping).toHaveAttribute('aria-disabled', 'true');
    expect(stopping).not.toBeDisabled();
    // The visible word stays: the RunBar's status already says "Stopping…".
    expect(stopping).toHaveTextContent('Stop');
  });

  it('ignores a press while stopping', async () => {
    const user = userEvent.setup();
    const onStop = vi.fn();
    render(<StopButton locale="en" stopping onStop={onStop} />);
    await user.click(screen.getByRole('button', { name: t('en', 'stopping') }));
    expect(onStop).not.toHaveBeenCalled();
  });

  it('announces the platform’s chord, and its tooltip names it', async () => {
    const { rerender } = render(<StopButton locale="en" stopping={false} apple onStop={vi.fn()} />);
    const button = screen.getByRole('button', { name: 'Stop' });
    expect(button).toHaveAttribute('aria-keyshortcuts', 'Meta+.');
    button.focus();
    const tooltip = await waitFor(() => screen.getByRole('tooltip'));
    expect(tooltip).toHaveTextContent(t('en', 'stop.tooltip', { shortcut: stopShortcutLabel(true) }));

    rerender(<StopButton locale="en" stopping={false} apple={false} onStop={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Stop' })).toHaveAttribute(
      'aria-keyshortcuts',
      'Control+.',
    );
    expect(stopKeyShortcuts(false)).toBe('Control+.');
  });

  it('is 32px on a fine pointer and 44px on a coarse one', () => {
    expect(CSS).toMatch(/block-size:\s*var\(--ck-agent-target,\s*var\(--bldr-control-md\)\)/u);
    expect(CSS).toMatch(
      /@media \(pointer: coarse\)\s*\{\s*\.ck-agent-stop\s*\{\s*--ck-agent-target:\s*var\(--bldr-hit-target-min\)/u,
    );
  });
});

describe('isStopShortcut', () => {
  function chord(init: KeyboardEventInit): boolean {
    let seen = false;
    const target = document.createElement('div');
    target.addEventListener('keydown', (event) => {
      seen = isStopShortcut(event);
    });
    fireEvent.keyDown(target, init);
    return seen;
  }

  it.each([
    [{ key: '.', ctrlKey: true }, true],
    [{ key: '.', metaKey: true }, true],
    [{ key: '.' }, false],
    [{ key: '.', ctrlKey: true, shiftKey: true }, false],
    [{ key: '.', metaKey: true, altKey: true }, false],
    [{ key: ',', ctrlKey: true }, false],
    [{ key: '.', ctrlKey: true, repeat: true }, false],
  ] as const)('%o → %s', (init, expected) => {
    expect(chord(init)).toBe(expected);
  });

  it('skips an event another handler already spent', () => {
    const event = {
      key: '.',
      ctrlKey: true,
      metaKey: false,
      shiftKey: false,
      altKey: false,
      repeat: false,
      defaultPrevented: true,
    } as unknown as ReactKeyboardEvent;
    expect(isStopShortcut(event)).toBe(false);
  });
});
