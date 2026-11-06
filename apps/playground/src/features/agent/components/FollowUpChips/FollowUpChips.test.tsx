/**
 * FollowUpChips: the next steps after a first build, each a chip that SENDS its request.
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { t } from '../../copy';
import type { Locale } from '../../model/view-types';

import { FOLLOW_UPS } from './constants';
import { FollowUpChips } from './FollowUpChips';

function mount(locale: Locale) {
  const onSend = vi.fn<(request: string) => void>();
  render(<FollowUpChips locale={locale} onSend={onSend} />);
  return { onSend, user: userEvent.setup() };
}

describe('FollowUpChips', () => {
  it('is a list named “Next steps” of four chips, in order (English)', () => {
    mount('en');
    const list = screen.getByRole('list', { name: 'Next steps' });
    expect(
      within(list)
        .getAllByRole('button')
        .map((chip) => chip.textContent),
    ).toEqual(['Restyle colours', 'Another style', 'Reorder sections', 'Add a section']);
  });

  it('speaks Arabic: «خطوات تالية» and its four chips', () => {
    mount('ar');
    const list = screen.getByRole('list', { name: 'خطوات تالية' });
    expect(
      within(list)
        .getAllByRole('button')
        .map((chip) => chip.textContent),
    ).toEqual(['بدّل الألوان', 'ستايل مختلف', 'رتّب الأقسام', 'أضف قسمًا']);
  });

  it('says that a chip sends, since unlike a suggestion it does', () => {
    mount('en');
    for (const chip of screen.getAllByRole('button')) {
      expect(chip).toHaveAccessibleDescription('Sends this as your next request');
    }
  });

  it.each(FOLLOW_UPS.map((followUp) => [followUp.id, followUp] as const))(
    '%s sends its whole request, in the panel’s language',
    async (_id, followUp) => {
      const { onSend, user } = mount('ar');
      await user.click(screen.getByRole('button', { name: t('ar', followUp.label) }));
      expect(onSend).toHaveBeenCalledWith(t('ar', followUp.request));
    },
  );

  it('sends once: a second pick, or a double click, does nothing', async () => {
    const { onSend, user } = mount('en');
    const colours = screen.getByRole('button', { name: 'Restyle colours' });
    await user.dblClick(colours);
    await user.click(screen.getByRole('button', { name: 'Add a section' }));
    expect(onSend).toHaveBeenCalledTimes(1);
    expect(onSend).toHaveBeenCalledWith(t('en', 'nextSteps.colors.request'));
    for (const chip of screen.getAllByRole('button')) {
      expect(chip).toHaveAttribute('aria-disabled', 'true');
    }
  });

  it('works from the keyboard: Tab reaches each chip, Enter and Space send', async () => {
    const { onSend, user } = mount('en');
    await user.tab();
    expect(screen.getByRole('button', { name: 'Restyle colours' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Another style' })).toHaveFocus();
    await user.keyboard(' ');
    expect(onSend).toHaveBeenCalledWith(t('en', 'nextSteps.style.request'));
  });

  it('are buttons that submit nothing, even inside a form', () => {
    mount('en');
    for (const chip of screen.getAllByRole('button')) {
      expect(chip).toHaveAttribute('type', 'button');
    }
  });
});
