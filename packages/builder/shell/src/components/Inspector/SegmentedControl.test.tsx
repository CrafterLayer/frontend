import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SEGMENT_PATHS } from './segment-icons';
import { SegmentedControl } from './SegmentedControl';

const paths = (name: string) =>
  [...screen.getByRole('button', { name }).querySelectorAll('path')].map((path) =>
    path.getAttribute('d'),
  );

describe('SegmentedControl', () => {
  it('names every segment, presses exactly one, and ignores a click on the pressed one', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(
      <SegmentedControl
        kind="alignment"
        options={['start', 'center', 'end']}
        value="center"
        dir="ltr"
        disabled={false}
        onSelect={onSelect}
      />,
    );
    const pressed = screen.getAllByRole('button', { pressed: true });
    expect(pressed).toHaveLength(1);
    expect(pressed[0]).toHaveAccessibleName('Center alignment');
    expect(screen.getByRole('button', { name: 'Start alignment' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );

    await user.click(screen.getByRole('button', { name: 'Center alignment' }));
    expect(onSelect).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'End alignment' }));
    expect(onSelect).toHaveBeenCalledWith('end');
    const svg = screen.getByRole('button', { name: 'End alignment' }).querySelector('svg');
    expect(svg).toHaveAttribute('stroke', 'currentColor');
    expect(svg).toHaveAttribute('stroke-width', '1.5');
    expect(svg).toHaveAttribute('fill', 'none');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });

  it('swaps the start and end marks under rtl', () => {
    const view = render(
      <SegmentedControl
        kind="alignment"
        options={['start', 'center', 'end']}
        value="start"
        dir="ltr"
        disabled={false}
        onSelect={vi.fn()}
      />,
    );
    expect(paths('Start alignment')).toEqual([...SEGMENT_PATHS.start]);
    view.rerender(
      <SegmentedControl
        kind="alignment"
        options={['start', 'center', 'end']}
        value="start"
        dir="rtl"
        disabled={false}
        onSelect={vi.fn()}
      />,
    );
    expect(paths('Start alignment')).toEqual([...SEGMENT_PATHS.end]);
    expect(paths('End alignment')).toEqual([...SEGMENT_PATHS.start]);
    expect(paths('Center alignment')).toEqual([...SEGMENT_PATHS.center]);
  });

  it('disables every segment together and labels direction sets as such', () => {
    render(
      <SegmentedControl
        kind="direction"
        options={['row', 'column', 'row-reverse']}
        value="row"
        dir="ltr"
        disabled
        onSelect={vi.fn()}
      />,
    );
    for (const name of ['Row direction', 'Column direction', 'Reverse row direction']) {
      expect(screen.getByRole('button', { name })).toBeDisabled();
    }
  });
});
