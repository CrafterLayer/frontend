import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { installBrowserStandIns } from '../../test-support';
import type { BoxSideState } from '../BoxModelControl';
import { numberModel } from '../ScaleNumberControl';
import { BorderSidesControl } from './BorderSidesControl';
import { BORDER_SIDES_CONTROL_LABELS_AR } from './BorderSidesControl.labels';

beforeAll(installBrowserStandIns);
afterEach(cleanup);

const one: BoxSideState = { value: { kind: 'token', token: '1' }, origin: 'here' };
const widths = { 'block-start': one, 'block-end': one, 'inline-start': one, 'inline-end': one };

function setup(dir: 'ltr' | 'rtl' = 'ltr') {
  const onCommitWidth = vi.fn();
  const onCommitStyle = vi.fn();
  render(
    <BorderSidesControl
      widths={widths}
      model={numberModel(['0', '1', '2', '4', '8'], 'px')}
      borderStyle="solid"
      dir={dir}
      onCommitWidth={onCommitWidth}
      onCommitStyle={onCommitStyle}
    />,
  );
  return { onCommitWidth, onCommitStyle };
}

describe('BorderSidesControl', () => {
  it('scrubs one logical side and commits once', () => {
    const { onCommitWidth } = setup('rtl');
    const side = screen.getByRole('button', { name: 'Border width inline-end, 1px' });
    fireEvent.pointerDown(side, { pointerId: 1, button: 0, clientX: 50, clientY: 0 });
    fireEvent.pointerMove(side, { pointerId: 1, clientX: 44, clientY: 0 });
    fireEvent.pointerUp(side, { pointerId: 1, clientX: 44, clientY: 0 });
    // inline-end is on the LEFT of an RTL page: dragging left grows it, 1 + 3 = 4px.
    expect(onCommitWidth).toHaveBeenCalledTimes(1);
    expect(onCommitWidth).toHaveBeenCalledWith('inline-end', { kind: 'token', token: '4' });
  });

  it('sets the style with one choice', async () => {
    const user = userEvent.setup();
    const { onCommitStyle } = setup();
    await user.click(screen.getByRole('radio', { name: 'Dashed' }));
    expect(onCommitStyle).toHaveBeenCalledWith('dashed');
  });

  it('labels in Arabic', () => {
    render(
      <BorderSidesControl
        widths={widths}
        model={numberModel(['0', '1'], 'px')}
        borderStyle={undefined}
        dir="rtl"
        onCommitWidth={vi.fn()}
        onCommitStyle={vi.fn()}
        labels={BORDER_SIDES_CONTROL_LABELS_AR}
      />,
    );
    expect(screen.getByRole('radiogroup', { name: 'نمط الحد' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'متقطع' })).toBeInTheDocument();
  });
});
