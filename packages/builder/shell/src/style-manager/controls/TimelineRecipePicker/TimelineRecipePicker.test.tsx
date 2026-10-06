import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { customCodeTreeProblems } from '@craftkit/builder-schema';

import { clearTimelinePatch } from './timeline-patch';
import { TimelineRecipePicker } from './TimelineRecipePicker';
import { TIMELINE_RECIPE_PICKER_LABELS_AR } from './TimelineRecipePicker.labels';

afterEach(cleanup);

const apply = (attributes: Record<string, string | undefined>, patch: Readonly<Record<string, string | null>>) => {
  const next: Record<string, string> = {};
  for (const [name, value] of Object.entries({ ...attributes, ...patch })) {
    if (typeof value === 'string') next[name] = value;
  }
  return next;
};

describe('TimelineRecipePicker', () => {
  it('lists None and the seven named recipes with a one-line description; no keyframe surface', () => {
    render(<TimelineRecipePicker attributes={{ 'data-ck-timeline': 'split-reveal' }} onCommit={vi.fn()} />);
    const select = screen.getByRole('combobox', { name: 'Cinematic motion' });
    expect(Array.from((select as HTMLSelectElement).options).map((option) => option.value)).toEqual([
      '',
      'split-reveal',
      'stagger-in',
      'pin-sequence',
      'horizontal-scroll',
      'parallax-depth',
      'scrub-scale',
      'velocity-marquee',
    ]);
    expect(select).toHaveValue('split-reveal');
    expect(select).toHaveAccessibleDescription('Words rise and fade in as they enter');
    // Licence condition (DESIGN §C.1.2): names only — no timeline, keyframe or slider surface.
    expect(screen.queryByRole('slider')).not.toBeInTheDocument();
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
  });

  it('picking a recipe removes the CSS preset and its preset-only params in the SAME patch (door-valid)', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    const attributes = { 'data-ck-motion': 'fade-up', 'data-ck-trigger': 'load', 'data-ck-ease': 'spring' };
    render(<TimelineRecipePicker attributes={attributes} onCommit={onCommit} />);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Cinematic motion' }), 'stagger-in');
    expect(onCommit).toHaveBeenCalledTimes(1);
    const [patch, label] = onCommit.mock.calls[0] as [Record<string, string | null>, string];
    expect(label).toBe('Cinematic motion');
    expect(patch).toMatchObject({ 'data-ck-timeline': 'stagger-in', 'data-ck-motion': null, 'data-ck-trigger': null });
    const next = apply(attributes, patch);
    expect(next).toEqual({ 'data-ck-timeline': 'stagger-in', 'data-ck-ease': 'spring' });
    expect(
      customCodeTreeProblems({
        kind: 'root',
        children: [{ kind: 'element', tag: 'div', attributes: next, children: [{ kind: 'element', tag: 'p', text: 'a' }] }],
      }),
    ).toEqual([]);
  });

  it('None removes the recipe, its scrub and the reused params nothing else owns', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    const attributes = { 'data-ck-timeline': 'split-reveal', 'data-ck-scrub': 'true', 'data-ck-delay': '2' };
    render(<TimelineRecipePicker attributes={attributes} onCommit={onCommit} />);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Cinematic motion' }), '');
    expect(onCommit).toHaveBeenCalledWith(
      { 'data-ck-timeline': null, 'data-ck-scrub': null, 'data-ck-delay': null },
      'Cinematic motion',
    );
    // A hover effect still owns the params: they stay.
    expect(clearTimelinePatch({ ...attributes, 'data-ck-hover': 'lift' })).toEqual({
      'data-ck-timeline': null,
      'data-ck-scrub': null,
    });
  });

  it('the scrub row is off until a recipe is chosen, then writes one attribute', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    const { rerender } = render(<TimelineRecipePicker attributes={{}} onCommit={onCommit} />);
    expect(screen.getByRole('radio', { name: 'With the scrollbar' })).toBeDisabled();
    rerender(<TimelineRecipePicker attributes={{ 'data-ck-timeline': 'pin-sequence' }} onCommit={onCommit} />);
    await user.click(screen.getByRole('radio', { name: 'With the scrollbar' }));
    expect(onCommit).toHaveBeenLastCalledWith({ 'data-ck-scrub': 'true' }, 'Cinematic motion');
  });

  it('keyboard operable in Arabic RTL: the scrub row mirrors its arrows', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(
      <TimelineRecipePicker
        attributes={{ 'data-ck-timeline': 'split-reveal' }}
        onCommit={onCommit}
        dir="rtl"
        labels={TIMELINE_RECIPE_PICKER_LABELS_AR}
      />,
    );
    const select = screen.getByRole('combobox', { name: 'حركة سينمائية' });
    expect(select).toHaveAccessibleDescription('تظهر الكلمات واحدة تلو الأخرى عند الوصول إليها');
    expect(screen.getByRole('option', { name: 'كشف الكلمات' })).toBeInTheDocument();
    const byDefault = screen.getByRole('radio', { name: 'كما تعمل الوصفة' });
    byDefault.focus();
    await user.keyboard('{ArrowLeft}');
    expect(onCommit).toHaveBeenLastCalledWith({ 'data-ck-scrub': 'true' }, 'حركة سينمائية');
    expect(screen.getByRole('radio', { name: 'مع شريط التمرير' })).toHaveFocus();
  });
});
