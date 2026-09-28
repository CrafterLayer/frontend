/**
 * SendButton (SPEC §4.17, §6.5): the Send slot, driven by `model/send-state.ts`.
 *
 * Ours to prove, over every state: its name and glyph, `aria-disabled` (never `disabled`)
 * when there is nothing to do, a press then doing nothing, Queued saying its word, the
 * tooltip's second line as the description, and that Stop is never one of its states.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { t } from '../../copy';
import { SEND_SLOT, SEND_STATES } from '../../model/send-state';
import type { Locale, SendState } from '../../model/view-types';

import { SendButton } from './SendButton';

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe = (): void => undefined;
    unobserve = (): void => undefined;
    disconnect = (): void => undefined;
  };
});

const CSS = readFileSync(
  join(process.cwd(), 'src', 'features', 'agent', 'components', 'SendButton', 'SendButton.css'),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//gu, '');

const EXPECTED: Readonly<
  Record<SendState, { readonly name: 'send' | 'queue' | 'queued'; readonly disabled: boolean; readonly icon: string }>
> = {
  'idle-empty': { name: 'send', disabled: true, icon: 'send' },
  'idle-ready': { name: 'send', disabled: false, icon: 'send' },
  'running-empty': { name: 'send', disabled: true, icon: 'send' },
  'running-ready': { name: 'queue', disabled: false, icon: 'queue' },
  'running-queued': { name: 'queued', disabled: true, icon: 'check' },
};

const LOCALES = ['ar', 'en'] as const satisfies readonly Locale[];

describe('SendButton', () => {
  it.each(LOCALES.flatMap((locale) => SEND_STATES.map((state) => [locale, state] as const)))(
    '%s, %s: the name, the glyph and whether it can act',
    (locale, state) => {
      render(<SendButton locale={locale} state={state} onSend={vi.fn()} />);
      const expected = EXPECTED[state];
      const button = screen.getByRole('button', { name: t(locale, expected.name) });
      expect(button.querySelector('svg')).toHaveAttribute('data-icon', expected.icon);
      if (expected.disabled) expect(button).toHaveAttribute('aria-disabled', 'true');
      else expect(button).not.toHaveAttribute('aria-disabled');
      expect(button).toBeEnabled();
      expect(SEND_SLOT[state].disabled).toBe(expected.disabled);
    },
  );

  it.each(SEND_STATES)('%s is never Stop', (state) => {
    render(<SendButton locale="en" state={state} onSend={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /stop/iu })).toBeNull();
    expect(screen.getByRole('button').textContent).not.toMatch(/stop/iu);
  });

  it.each(SEND_STATES)('%s: a press sends only when it can', async (state) => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<SendButton locale="en" state={state} onSend={onSend} />);
    await user.click(screen.getByRole('button'));
    expect(onSend).toHaveBeenCalledTimes(SEND_SLOT[state].disabled ? 0 : 1);
  });

  it('says Queued in words, described by when it will start', () => {
    render(<SendButton locale="en" state="running-queued" onSend={vi.fn()} />);
    const button = screen.getByRole('button', { name: 'Queued' });
    expect(button).toHaveTextContent('Queued');
    expect(button).toHaveAccessibleDescription(t('en', 'queue.caption'));
  });

  it('teaches the keys while Enter sends', () => {
    render(<SendButton locale="ar" state="idle-ready" onSend={vi.fn()} />);
    expect(screen.getByRole('button', { name: t('ar', 'send') })).toHaveAccessibleDescription(
      t('ar', 'keys.hint'),
    );
  });

  it('is a 32px circle, 44px on a coarse pointer, with a token fill', () => {
    expect(CSS).toMatch(/inline-size:\s*var\(--ck-agent-target,\s*var\(--bldr-control-md\)\)/u);
    expect(CSS).toMatch(/border-radius:\s*var\(--bldr-radius-full\)/u);
    expect(CSS).toMatch(
      /@media \(pointer: coarse\)\s*\{\s*\.ck-agent-send\s*\{\s*--ck-agent-target:\s*var\(--bldr-hit-target-min\)/u,
    );
    expect(CSS).toMatch(/background-color:\s*var\(--bldr-accent\)/u);
  });
});
