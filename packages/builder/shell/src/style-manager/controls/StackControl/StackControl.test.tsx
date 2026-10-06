import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { StackControl, type StackControlProps } from './StackControl';
import { STACK_CONTROL_LABELS_AR } from './StackControl.labels';

afterEach(cleanup);

function setup(overrides: Partial<StackControlProps> = {}) {
  const onCommit = vi.fn();
  const onPreset = vi.fn();
  render(
    <StackControl
      label="Shadow"
      layers={['0 1px 2px #0002', '0 8px 24px #0003']}
      newLayer="0 4px 12px #0002"
      presets={[
        { id: 'soft', label: 'Soft' },
        { id: 'strong', label: 'Strong' },
      ]}
      onCommit={onCommit}
      onPreset={onPreset}
      {...overrides}
    />,
  );
  return { onCommit, onPreset };
}

describe('StackControl', () => {
  it('lists the layers in order and edits one on Enter', async () => {
    const user = userEvent.setup();
    const { onCommit } = setup();
    const second = screen.getByRole('textbox', { name: 'Layer 2' });
    await user.clear(second);
    await user.type(second, '0 0 0 1px #000');
    expect(onCommit).not.toHaveBeenCalled();
    await user.keyboard('{Enter}');
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(['0 1px 2px #0002', '0 0 0 1px #000']);
  });

  it('reorders with the move buttons, adds and removes layers', async () => {
    const user = userEvent.setup();
    const { onCommit } = setup();
    await user.click(screen.getByRole('button', { name: 'Move layer 2 up' }));
    expect(onCommit).toHaveBeenLastCalledWith(['0 8px 24px #0003', '0 1px 2px #0002']);
    expect(screen.getByRole('button', { name: 'Move layer 1 up' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Add layer' }));
    expect(onCommit).toHaveBeenLastCalledWith([
      '0 1px 2px #0002',
      '0 8px 24px #0003',
      '0 4px 12px #0002',
    ]);
    await user.click(screen.getByRole('button', { name: 'Remove layer 1' }));
    expect(onCommit).toHaveBeenLastCalledWith(['0 8px 24px #0003']);
  });

  it('a drag handle is keyboard sortable', () => {
    setup();
    const handle = screen.getByRole('button', { name: 'Reorder layer 1' });
    expect(handle).toHaveAttribute('aria-roledescription', 'sortable');
  });

  it('a preset replaces the stack; tokens mode shows presets only', async () => {
    const user = userEvent.setup();
    const { onPreset } = setup({ editable: false });
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Presets: Shadow' }), 'soft');
    expect(onPreset).toHaveBeenCalledWith('soft');
  });

  it('labels in Arabic', () => {
    setup({ labels: STACK_CONTROL_LABELS_AR, label: 'الظل' });
    expect(screen.getByRole('button', { name: 'إضافة طبقة' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'الطبقة 1' })).toBeInTheDocument();
  });
});
