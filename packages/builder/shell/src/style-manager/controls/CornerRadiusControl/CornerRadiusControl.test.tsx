import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { StyleCorner } from '@craftkit/builder-schema';

import type { BoxSideState } from '../BoxModelControl';
import { namedModel } from '../ScaleNumberControl';
import { CornerRadiusControl } from './CornerRadiusControl';
import { CORNER_RADIUS_CONTROL_LABELS_AR } from './CornerRadiusControl.labels';

afterEach(cleanup);

const model = namedModel(['none', 'sm', 'lg', 'xl', 'full']);
const lg: BoxSideState = { value: { kind: 'token', token: 'lg' }, origin: 'here' };
const all = (state: BoxSideState): Record<StyleCorner, BoxSideState> => ({
  'start-start': state,
  'start-end': state,
  'end-start': state,
  'end-end': state,
});

describe('CornerRadiusControl', () => {
  it('starts linked when every corner agrees, and steps all corners at once', () => {
    const onCommit = vi.fn();
    render(<CornerRadiusControl corners={all(lg)} model={model} dir="ltr" onCommit={onCommit} />);
    expect(screen.getByRole('button', { name: 'Same radius on every corner' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    fireEvent.keyDown(screen.getByRole('spinbutton', { name: 'All corners' }), { key: 'ArrowUp' });
    expect(onCommit).toHaveBeenCalledWith('all', { kind: 'token', token: 'xl' });
  });

  it('unlinks into four logical corners laid out in the page direction', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(
      <CornerRadiusControl
        corners={{ ...all(lg), 'end-end': { value: undefined, origin: 'unset' } }}
        model={model}
        dir="rtl"
        onCommit={onCommit}
      />,
    );
    // Disagreeing corners start unlinked.
    const corner = screen.getByRole('spinbutton', { name: 'Corner block-end inline-end' });
    expect(corner.closest('.bldr-corner-radius__grid')).toHaveAttribute('dir', 'rtl');
    fireEvent.keyDown(corner, { key: 'ArrowUp' });
    expect(onCommit).toHaveBeenCalledWith('end-end', { kind: 'token', token: 'none' });
    await user.click(screen.getByRole('button', { name: 'Same radius on every corner' }));
    expect(screen.getByRole('spinbutton', { name: 'All corners' })).toHaveAttribute(
      'aria-valuetext',
      'Mixed',
    );
  });

  it('labels in Arabic', () => {
    render(
      <CornerRadiusControl
        corners={all(lg)}
        model={model}
        dir="rtl"
        onCommit={vi.fn()}
        labels={CORNER_RADIUS_CONTROL_LABELS_AR}
      />,
    );
    expect(screen.getByRole('spinbutton', { name: 'كل الزوايا' })).toBeInTheDocument();
  });
});
