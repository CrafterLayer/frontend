/**
 * EnhanceButton: ✨ Improve my request («حسّن طلبي»), the owner's tool that reads the
 * request and fixes it before it runs.
 *
 * Ours to prove: it is absent when the provider cannot rewrite; named in the owner's words
 * and its tooltip says the same; `aria-disabled` (never `disabled`) with the reason as its
 * description on an empty draft or while a run is live; while it works it keeps the same
 * button, named "Improving your request", spinning, and a press does nothing; ready, a
 * press calls back once; and it is a ghost (never Indigo), 32px, 44 on a coarse pointer.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { t } from '../../copy';
import type { EnhancementView } from '../../model/view-types';

import { EnhanceButton } from './EnhanceButton';

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe = (): void => undefined;
    unobserve = (): void => undefined;
    disconnect = (): void => undefined;
  };
});

const CSS = readFileSync(
  join(process.cwd(), 'src', 'features', 'agent', 'components', 'EnhanceButton', 'EnhanceButton.css'),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//gu, '');

const IDLE: EnhancementView = { status: 'idle' };

describe('EnhanceButton', () => {
  it('is absent when the provider cannot rewrite requests', () => {
    const { container } = render(
      <EnhanceButton
        locale="en"
        enhancement={{ status: 'unavailable' }}
        empty={false}
        running={false}
        onEnhance={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('is named in the owner’s words, and its tooltip says the same', async () => {
    render(<EnhanceButton locale="ar" enhancement={IDLE} empty={false} running={false} onEnhance={vi.fn()} />);
    const button = screen.getByRole('button', { name: 'حسّن طلبي' });
    button.focus();
    const tooltip = await waitFor(() => screen.getByRole('tooltip'));
    expect(tooltip).toHaveTextContent('حسّن طلبي');
    expect(button.querySelector('svg')).toHaveAttribute('data-icon', 'sparkle');
  });

  it('calls back once on a press when it can run', async () => {
    const user = userEvent.setup();
    const onEnhance = vi.fn();
    render(<EnhanceButton locale="en" enhancement={IDLE} empty={false} running={false} onEnhance={onEnhance} />);
    await user.click(screen.getByRole('button', { name: 'Improve my request' }));
    expect(onEnhance).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['an empty draft', { empty: true, running: false }, 'enhance.empty'],
    ['a live run', { empty: false, running: true }, 'enhance.busy'],
  ] as const)('waits on %s: aria-disabled, focusable, and says why', async (_, state, reason) => {
    const user = userEvent.setup();
    const onEnhance = vi.fn();
    render(<EnhanceButton locale="en" enhancement={IDLE} {...state} onEnhance={onEnhance} />);
    const button = screen.getByRole('button', { name: 'Improve my request' });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toBeEnabled();
    expect(button).toHaveAccessibleDescription(t('en', reason));
    await user.click(button);
    expect(onEnhance).not.toHaveBeenCalled();
  });

  it('keeps the same button while it works: renamed, spinning, and deaf to presses', async () => {
    const user = userEvent.setup();
    const onEnhance = vi.fn();
    const { rerender } = render(
      <EnhanceButton locale="en" enhancement={IDLE} empty={false} running={false} onEnhance={onEnhance} />,
    );
    const button = screen.getByRole('button', { name: 'Improve my request' });
    rerender(
      <EnhanceButton
        locale="en"
        enhancement={{ status: 'enhancing' }}
        empty={false}
        running={false}
        onEnhance={onEnhance}
      />,
    );
    const working = screen.getByRole('button', { name: t('en', 'enhance.working') });
    expect(working).toBe(button);
    expect(working).toHaveAttribute('aria-disabled', 'true');
    expect(working.querySelector('svg')).toHaveAttribute('data-icon', 'spinner');
    await user.click(working);
    expect(onEnhance).not.toHaveBeenCalled();
  });

  it('is a ghost that never turns Indigo, 32px and 44px on a coarse pointer', () => {
    expect(CSS).not.toMatch(/--bldr-accent/u);
    expect(CSS).toMatch(/inline-size:\s*var\(--ck-agent-target,\s*var\(--bldr-control-md\)\)/u);
    expect(CSS).toMatch(
      /@media \(pointer: coarse\)\s*\{\s*\.ck-agent-enhance\s*\{\s*--ck-agent-target:\s*var\(--bldr-hit-target-min\)/u,
    );
  });
});
