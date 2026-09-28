/**
 * ModeMenu (SPEC §4.17, §6.7): Auto, Ask first, Plan as a radio menu of two-line items.
 * Ours to prove: the trigger shows the mode's name and is named "Mode: …" (the name
 * contains the visible word, WCAG 2.5.3); the items and their descriptions are the
 * catalog's, in the locale; the chosen one is checked; choosing calls back with the mode;
 * the keyboard opens and moves it; Esc returns focus to the trigger; and while a run is
 * live the trigger stays enabled and says the change applies to the next request.
 */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { t } from '../../copy';

import { ModeMenu } from './ModeMenu';

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe = (): void => undefined;
    unobserve = (): void => undefined;
    disconnect = (): void => undefined;
  };
});

function items(): HTMLElement[] {
  return within(screen.getByRole('menu')).getAllByRole('menuitemradio');
}

describe('ModeMenu', () => {
  it('shows the mode’s name and is named “Mode: …”', () => {
    render(<ModeMenu locale="en" mode="ask" running={false} onModeChange={vi.fn()} />);
    const trigger = screen.getByRole('button', { name: 'Mode: Ask first' });
    expect(trigger).toHaveTextContent('Ask first');
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
  });

  it.each(['auto', 'ask', 'plan'] as const)('lists the three modes with what each does (%s chosen)', async (mode) => {
    const user = userEvent.setup();
    render(<ModeMenu locale="en" mode={mode} running={false} onModeChange={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /^Mode:/u }));
    const list = items();
    expect(list.map((item) => item.getAttribute('aria-checked'))).toEqual(
      (['auto', 'ask', 'plan'] as const).map((value) => String(value === mode)),
    );
    expect(list[0]).toHaveTextContent(t('en', 'mode.auto'));
    expect(list[0]).toHaveTextContent(t('en', 'mode.auto.desc'));
    expect(list[2]).toHaveTextContent(t('en', 'mode.plan.desc'));
  });

  it('speaks Arabic', async () => {
    const user = userEvent.setup();
    render(<ModeMenu locale="ar" mode="auto" running={false} onModeChange={vi.fn()} />);
    await user.click(
      screen.getByRole('button', { name: t('ar', 'mode.aria', { mode: t('ar', 'mode.auto') }) }),
    );
    expect(items()[1]).toHaveTextContent(t('ar', 'mode.ask'));
    expect(screen.getByRole('menu')).toHaveAttribute('lang', 'ar');
  });

  it('calls back with the chosen mode', async () => {
    const user = userEvent.setup();
    const onModeChange = vi.fn();
    render(<ModeMenu locale="en" mode="auto" running={false} onModeChange={onModeChange} />);
    await user.click(screen.getByRole('button', { name: 'Mode: Auto' }));
    await user.click(within(screen.getByRole('menu')).getByRole('menuitemradio', { name: /Plan/u }));
    expect(onModeChange).toHaveBeenCalledWith('plan');
  });

  it('opens from the keyboard, moves with the arrows, and Esc returns to the trigger', async () => {
    const user = userEvent.setup();
    render(<ModeMenu locale="en" mode="auto" running={false} onModeChange={vi.fn()} />);
    await user.tab();
    const trigger = screen.getByRole('button', { name: 'Mode: Auto' });
    expect(trigger).toHaveFocus();
    await user.keyboard('{Enter}');
    await waitFor(() => {
      expect(items()[0]).toHaveFocus();
    });
    await user.keyboard('{ArrowDown}');
    expect(items()[1]).toHaveFocus();
    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(trigger).toHaveFocus();
    });
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('stays enabled while a run is live, and says the change applies next time', async () => {
    render(<ModeMenu locale="en" mode="auto" running onModeChange={vi.fn()} />);
    const trigger = screen.getByRole('button', { name: 'Mode: Auto' });
    expect(trigger).toBeEnabled();
    trigger.focus();
    const tooltip = await waitFor(() => screen.getByRole('tooltip'));
    expect(tooltip).toHaveTextContent(t('en', 'mode.running'));
  });
});
