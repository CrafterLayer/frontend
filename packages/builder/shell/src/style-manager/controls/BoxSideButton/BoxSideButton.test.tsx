import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { installBrowserStandIns } from '../../test-support';
import { spacingModel } from '../ScaleNumberControl';
import { BoxSideButton } from './BoxSideButton';

beforeAll(installBrowserStandIns);
afterEach(cleanup);

const model = spacingModel(['0', '1', '2', '4', '6', '8']);

function setup(mode: 'free' | 'tokens' = 'free') {
  const onCommit = vi.fn();
  render(
    <BoxSideButton
      side="block-end"
      accessibleName="Padding block-end, 16px"
      display="16"
      fieldLabel="Padding block-end"
      value={{ kind: 'token', token: '4' }}
      model={model}
      mode={mode}
      dir="ltr"
      onCommit={onCommit}
    />,
  );
  return { onCommit, button: screen.getByRole('button', { name: 'Padding block-end, 16px' }) };
}

describe('BoxSideButton', () => {
  it('a press without travel opens the editor and writes nothing', async () => {
    const { onCommit, button } = setup();
    fireEvent.pointerDown(button, { pointerId: 1, button: 0, clientX: 0, clientY: 0 });
    fireEvent.pointerUp(button, { pointerId: 1, clientX: 1, clientY: 1 });
    fireEvent.click(button);
    expect(onCommit).not.toHaveBeenCalled();
    expect(await screen.findByRole('spinbutton', { name: 'Padding block-end' })).toBeInTheDocument();
  });

  it('a drag shows the landing value on the button while it moves', () => {
    const { button } = setup();
    fireEvent.pointerDown(button, { pointerId: 1, button: 0, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(button, { pointerId: 1, clientX: 0, clientY: 16 });
    expect(button).toHaveTextContent('6');
    expect(button).toHaveAttribute('data-scrubbing');
  });

  it('a cancelled drag writes nothing', () => {
    const { onCommit, button } = setup();
    fireEvent.pointerDown(button, { pointerId: 1, button: 0, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(button, { pointerId: 1, clientX: 0, clientY: 16 });
    fireEvent.pointerCancel(button, { pointerId: 1 });
    expect(onCommit).not.toHaveBeenCalled();
    expect(button).toHaveTextContent('16');
  });
});
