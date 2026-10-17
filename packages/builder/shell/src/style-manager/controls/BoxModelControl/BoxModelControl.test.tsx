import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import type { StyleBoxSide } from '@craftkit/builder-schema';

import { installBrowserStandIns } from '../../test-support';
import { spacingModel } from '../ScaleNumberControl';
import { BoxModelControl, type BoxModelControlProps, type BoxSideState } from './BoxModelControl';
import { BOX_MODEL_CONTROL_LABELS_AR } from './BoxModelControl.labels';

beforeAll(installBrowserStandIns);
afterEach(cleanup);

const model = spacingModel(['0', 'px', '1', '2', '3', '4', '5', '6', '8', '10', '12']);
const unset: BoxSideState = { value: undefined, origin: 'unset' };
const sides = (
  overrides: Partial<Record<StyleBoxSide, BoxSideState>> = {},
): Record<StyleBoxSide, BoxSideState> => ({
  'block-start': unset,
  'block-end': unset,
  'inline-start': unset,
  'inline-end': unset,
  ...overrides,
});

function setup(overrides: Partial<BoxModelControlProps> = {}) {
  const onCommit = vi.fn();
  const onPreview = vi.fn();
  render(
    <BoxModelControl
      dir="ltr"
      rings={[
        { id: 'margin', label: 'Margin', sides: sides(), model, min: -100 },
        {
          id: 'padding',
          label: 'Padding',
          sides: sides({ 'inline-start': { value: { kind: 'token', token: '4' }, origin: 'here' } }),
          model,
          units: ['px', 'rem'],
        },
      ]}
      onCommit={onCommit}
      onPreview={onPreview}
      {...overrides}
    />,
  );
  return { onCommit, onPreview };
}

describe('BoxModelControl', () => {
  it('names every side logically with its value', () => {
    setup();
    expect(screen.getByRole('button', { name: 'Padding inline-start, 16px' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Margin block-end, not set' })).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(8);
  });

  it('a scrub previews on every move and commits ONCE on pointerup', () => {
    const { onCommit, onPreview } = setup();
    const side = screen.getByRole('button', { name: 'Padding inline-start, 16px' });
    fireEvent.pointerDown(side, { pointerId: 1, button: 0, clientX: 100, clientY: 0 });
    fireEvent.pointerMove(side, { pointerId: 1, clientX: 92, clientY: 0 });
    fireEvent.pointerMove(side, { pointerId: 1, clientX: 84, clientY: 0 });
    expect(onPreview).toHaveBeenCalled();
    expect(onCommit).not.toHaveBeenCalled();
    fireEvent.pointerUp(side, { pointerId: 1, clientX: 84, clientY: 0 });
    // 16px of leftward travel on an LTR page grows inline-start by 8px: 16 → 24 = step 6.
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith('padding', 'inline-start', { kind: 'token', token: '6' });
    expect(onPreview).toHaveBeenLastCalledWith('padding', 'inline-start', null);
  });

  it('mirrors to the page direction: on an RTL page inline-start grows when dragged right', () => {
    const { onCommit } = setup({ dir: 'rtl' });
    const side = screen.getByRole('button', { name: 'Padding inline-start, 16px' });
    expect(side.closest('.bldr-box-model')).toHaveAttribute('dir', 'rtl');
    fireEvent.pointerDown(side, { pointerId: 1, button: 0, clientX: 100, clientY: 0 });
    fireEvent.pointerMove(side, { pointerId: 1, clientX: 116, clientY: 0 });
    fireEvent.pointerUp(side, { pointerId: 1, clientX: 116, clientY: 0 });
    expect(onCommit).toHaveBeenCalledWith('padding', 'inline-start', { kind: 'token', token: '6' });
  });

  it('Shift while scrubbing writes all sides; Alt the opposite pair', () => {
    const { onCommit } = setup();
    const side = screen.getByRole('button', { name: 'Margin block-start, not set' });
    fireEvent.pointerDown(side, { pointerId: 1, button: 0, clientX: 0, clientY: 100 });
    fireEvent.pointerMove(side, { pointerId: 1, clientX: 0, clientY: 84 });
    fireEvent.pointerUp(side, { pointerId: 1, clientX: 0, clientY: 84, shiftKey: true });
    expect(onCommit).toHaveBeenLastCalledWith('margin', 'all', { kind: 'token', token: '2' });
    fireEvent.pointerDown(side, { pointerId: 2, button: 0, clientX: 0, clientY: 100 });
    fireEvent.pointerMove(side, { pointerId: 2, clientX: 0, clientY: 84 });
    fireEvent.pointerUp(side, { pointerId: 2, clientX: 0, clientY: 84, altKey: true });
    expect(onCommit).toHaveBeenLastCalledWith('margin', 'block', { kind: 'token', token: '2' });
  });

  it('pressing a side opens an exact editor; the keyboard edits it', async () => {
    const user = userEvent.setup();
    const { onCommit } = setup();
    screen.getByRole('button', { name: 'Padding inline-start, 16px' }).focus();
    await user.keyboard('{Enter}');
    const field = await screen.findByRole('spinbutton', { name: 'Padding inline-start' });
    field.focus();
    await user.keyboard('{ArrowUp}');
    expect(onCommit).toHaveBeenCalledWith('padding', 'inline-start', { kind: 'raw', css: '17px' });
  });

  it('labels in Arabic', () => {
    setup({ labels: BOX_MODEL_CONTROL_LABELS_AR, dir: 'rtl' });
    expect(screen.getByRole('group', { name: 'المسافات' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Padding البداية، 16px' })).toBeInTheDocument();
  });
});
