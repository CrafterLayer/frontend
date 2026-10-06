import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DndContext } from '@dnd-kit/core';
import { SortableContext } from '@dnd-kit/sortable';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { StackLayerRow } from './StackLayerRow';

afterEach(cleanup);

function setup() {
  const onChange = vi.fn();
  const onRemove = vi.fn();
  render(
    <DndContext>
      <SortableContext items={['a']}>
        <ul>
          <StackLayerRow
            id="a"
            index={0}
            count={1}
            value="0 1px 2px #0002"
            onChange={onChange}
            onMove={vi.fn()}
            onRemove={onRemove}
          />
        </ul>
      </SortableContext>
    </DndContext>,
  );
  return { onChange, onRemove };
}

describe('StackLayerRow', () => {
  it('commits an edit on blur, and Escape drops the draft', async () => {
    const user = userEvent.setup();
    const { onChange } = setup();
    const input = screen.getByRole('textbox', { name: 'Layer 1' });
    await user.type(input, ' inset');
    await user.keyboard('{Escape}');
    expect(input).toHaveValue('0 1px 2px #0002');
    await user.type(input, ' inset');
    await user.tab();
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('0 1px 2px #0002 inset');
  });

  it('cannot move a lone layer and removes it', async () => {
    const user = userEvent.setup();
    const { onRemove } = setup();
    expect(screen.getByRole('button', { name: 'Move layer 1 up' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move layer 1 down' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Remove layer 1' }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});
