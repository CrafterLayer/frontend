/**
 * PagePicker (2026-10-12): a named group of checkboxes, one per page in site order, the page
 * open now marked; the count says how many are checked; Select all and Clear; a change is
 * always reported in site order whatever order the boxes were ticked in.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { jobsLabels } from '../../copy/jobs-labels';
import type { Locale } from '../../model/view-types';
import { SAMPLE_PAGES, SAMPLE_PAGES_AR } from '../../testing/batch-fixtures';

import { PagePicker } from './PagePicker';

const EN = jobsLabels('en').form;
const CSS = readFileSync(
  join(process.cwd(), 'src', 'features', 'agent', 'components', 'PagePicker', 'PagePicker.css'),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//gu, '');

function Host({
  locale = 'en',
  onChange,
}: {
  readonly locale?: Locale;
  readonly onChange?: (ids: readonly string[]) => void;
}) {
  const [selected, setSelected] = useState<readonly string[]>(['home']);
  return (
    <PagePicker
      locale={locale}
      pages={locale === 'ar' ? SAMPLE_PAGES_AR : SAMPLE_PAGES}
      selected={selected}
      onChange={(next) => {
        onChange?.(next);
        setSelected(next);
      }}
      label={jobsLabels(locale).form.pages}
    />
  );
}

describe('PagePicker', () => {
  it('is a named group listing every page, the open one checked and marked', () => {
    render(<Host />);
    const group = screen.getByRole('group', { name: EN.pages });
    const boxes = within(group).getAllByRole('checkbox');
    expect(boxes).toHaveLength(SAMPLE_PAGES.length);
    expect(within(group).getByRole('checkbox', { name: /Home/u })).toBeChecked();
    expect(within(group).getByText(EN.current)).toBeInTheDocument();
    expect(within(group).getByText(EN.selected(1, 5))).toBeInTheDocument();
    // Addresses always read left to right.
    expect(within(group).getByText('/menu')).toHaveAttribute('dir', 'ltr');
  });

  it('reports a change in site order, and selects all or none', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Host onChange={onChange} />);
    await user.click(screen.getByRole('checkbox', { name: /Contact/u }));
    await user.click(screen.getByRole('checkbox', { name: /Menu/u }));
    expect(onChange).toHaveBeenLastCalledWith(['home', 'menu', 'contact']);
    expect(screen.getByText(EN.selected(3, 5))).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: EN.selectNone }));
    expect(onChange).toHaveBeenLastCalledWith([]);
    expect(screen.getAllByRole('checkbox').every((box) => !(box as HTMLInputElement).checked)).toBe(
      true,
    );
    await user.click(screen.getByRole('button', { name: EN.selectAll }));
    expect(onChange).toHaveBeenLastCalledWith(SAMPLE_PAGES.map(({ id }) => id));
  });

  it('toggles a page from the keyboard', async () => {
    const user = userEvent.setup();
    render(<Host />);
    const menu = screen.getByRole('checkbox', { name: /Menu/u });
    menu.focus();
    await user.keyboard(' ');
    expect(menu).toBeChecked();
  });

  it('speaks Arabic with Latin digits', () => {
    render(<Host locale="ar" />);
    const words = jobsLabels('ar').form;
    expect(screen.getByRole('group', { name: words.pages })).toBeInTheDocument();
    expect(screen.getByText(words.selected(1, 5))).toHaveTextContent(/1.*5/u);
    expect(screen.getByText(words.selected(1, 5)).textContent).not.toMatch(/[٠-٩]/u);
  });

  it('styles with logical properties and builder tokens only', () => {
    expect(CSS).not.toMatch(/\b(?:margin|padding|border)-(?:left|right|top|bottom)\b/u);
    expect(CSS).not.toMatch(/\b(?:left|right|top|bottom):/u);
    expect(CSS).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/iu);
    expect(CSS).toMatch(/:focus-visible/u);
  });
});
