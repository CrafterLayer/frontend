/**
 * DefaultSkillsList (2026-10-12): the default skills with their switches, the exact instructions
 * behind a disclosure, and "Make it my own"; in both languages; styled with logical properties
 * and theme tokens only.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { knowledgeLabels } from '../../copy/knowledge-labels';
import { defaultSkillViews } from '../../model/default-skills';
import type { Locale } from '../../model/view-types';

import { DefaultSkillsList } from './DefaultSkillsList';

const CSS = readFileSync(
  join(process.cwd(), 'src/features/agent/components/DefaultSkillsList/DefaultSkillsList.css'),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//gu, '');

function setup(locale: Locale = 'en', disabled: readonly string[] = []) {
  const onToggle = vi.fn();
  const onMakeOwn = vi.fn();
  render(
    <DefaultSkillsList
      skills={defaultSkillViews(locale, disabled)}
      labels={knowledgeLabels(locale)}
      onToggle={onToggle}
      onMakeOwn={onMakeOwn}
    />,
  );
  return { user: userEvent.setup(), onToggle, onMakeOwn };
}

describe('DefaultSkillsList', () => {
  it('lists every default with a switch, on, under its counted heading', () => {
    setup();
    const section = screen.getByRole('region', { name: 'Default skills' });
    const switches = within(section).getAllByRole('switch');
    expect(switches).toHaveLength(7);
    expect(switches.every((element) => (element as HTMLInputElement).checked)).toBe(true);
    expect(within(section).getByText('7 of 7 on')).toBeInTheDocument();
    expect(
      within(section).getByRole('switch', { name: 'Use Design intelligence (UI UX Pro Max)' }),
    ).toBeInTheDocument();
  });

  it('switches one off and on', async () => {
    const { user, onToggle } = setup('en', ['craftkit.trust-proof']);
    expect(screen.getByText('6 of 7 on')).toBeInTheDocument();
    await user.click(screen.getByRole('switch', { name: 'Use Honest trust and proof' }));
    expect(onToggle).toHaveBeenCalledWith('craftkit.trust-proof', true);
    await user.click(screen.getByRole('switch', { name: 'Use Forms people finish' }));
    expect(onToggle).toHaveBeenLastCalledWith('craftkit.forms-convert', false);
  });

  it('shows exactly what a default teaches, and makes it the person’s own', async () => {
    const { user, onMakeOwn } = setup();
    const row = screen
      .getByRole('switch', { name: 'Use Natural copy in English and Arabic' })
      .closest('li') as HTMLElement;
    await user.click(within(row).getByText('What it teaches the Agent'));
    expect(within(row).getByText(/idioms word by word/u)).toBeVisible();
    await user.click(
      within(row).getByRole('button', { name: 'Make Natural copy in English and Arabic my own' }),
    );
    expect(onMakeOwn).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'craftkit.natural-copy' }),
    );
  });

  it('speaks Arabic', () => {
    setup('ar');
    const section = screen.getByRole('region', { name: 'المهارات الافتراضية' });
    expect(within(section).getByText('7 من 7 مفعّلة')).toBeInTheDocument();
    expect(
      within(section).getByRole('switch', { name: 'استخدم نصوص طبيعية بالعربية والإنجليزية' }),
    ).toBeInTheDocument();
    expect(within(section).getAllByRole('button', { name: /^اجعل .+ مهارتي$/u })).toHaveLength(7);
  });

  it('draws nothing without defaults', () => {
    const { container } = render(
      <DefaultSkillsList
        skills={[]}
        labels={knowledgeLabels('en')}
        onToggle={() => undefined}
        onMakeOwn={() => undefined}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('styles with logical properties and theme tokens only', () => {
    expect(CSS).not.toMatch(/(?:margin|padding|border)-(?:left|right|top|bottom)\b/u);
    expect(CSS).not.toMatch(/(?<![-\w])(?:left|right|width|height)\s*:/u);
    expect(CSS).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/iu);
  });
});
