import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { OptionIcon } from '../OptionIcon';
import { SegmentedChoice } from './SegmentedChoice';

afterEach(cleanup);

const OPTIONS = ['block', 'flex', 'grid', 'none', 'inline-grid', 'contents'].map((value) => ({
  value,
  label: value,
  icon:
    value === 'inline-grid' || value === 'contents' ? undefined : <OptionIcon property="display" value={value} />,
}));

function setup(value: string | undefined, extra: { mixed?: boolean } = {}) {
  const onChange = vi.fn();
  render(
    <SegmentedChoice
      label="Display"
      options={OPTIONS}
      value={value}
      onChange={onChange}
      dir="ltr"
      moreLabel="More Display options"
      {...extra}
    />,
  );
  return onChange;
}

describe('SegmentedChoice', () => {
  it('draws iconed options as named radios and the rest in a labelled menu', () => {
    setup('flex');
    expect(screen.getAllByRole('radio')).toHaveLength(4);
    expect(screen.getByRole('radio', { name: 'flex' })).toHaveAttribute('aria-checked', 'true');
    const more = screen.getByRole('combobox', { name: 'More Display options' });
    expect(more).toHaveValue('');
    expect(Array.from((more as HTMLSelectElement).options).map((option) => option.value)).toEqual([
      '',
      'inline-grid',
      'contents',
    ]);
  });

  it('a radio click and a menu pick each write once', async () => {
    const user = userEvent.setup();
    const onChange = setup('block');
    await user.click(screen.getByRole('radio', { name: 'grid' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'More Display options' }), 'contents');
    expect(onChange.mock.calls).toEqual([['grid'], ['contents']]);
  });

  it('an overflow value shows in the menu and checks no segment', () => {
    setup('inline-grid');
    expect(screen.getByRole('combobox', { name: 'More Display options' })).toHaveValue('inline-grid');
    expect(screen.queryByRole('radio', { checked: true })).not.toBeInTheDocument();
  });

  it('Mixed checks nothing anywhere and says so', () => {
    setup('flex', { mixed: true });
    expect(screen.getByRole('radiogroup', { name: 'Display (Mixed)' })).toBeInTheDocument();
    expect(screen.queryByRole('radio', { checked: true })).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'More Display options' })).toHaveValue('');
  });
});
