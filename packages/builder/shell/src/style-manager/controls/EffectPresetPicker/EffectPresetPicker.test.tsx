import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { EffectPresetPicker } from './EffectPresetPicker';
import { EFFECT_PRESET_PICKER_LABELS_AR } from './EffectPresetPicker.labels';

afterEach(cleanup);

describe('EffectPresetPicker', () => {
  it('shows every effect as a toggle, pressed when worn', () => {
    render(<EffectPresetPicker value={['glass']} onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Glass' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Noise' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getAllByRole('button')).toHaveLength(11);
  });

  it('adds and removes one effect, keeping the others in order', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<EffectPresetPicker value={['glass', 'noise']} onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: 'Dot pattern' }));
    expect(onChange).toHaveBeenLastCalledWith(['glass', 'noise', 'dots']);
    await user.click(screen.getByRole('button', { name: 'Glass' }));
    expect(onChange).toHaveBeenLastCalledWith(['noise']);
  });

  it('labels in Arabic', () => {
    render(<EffectPresetPicker value={[]} onChange={vi.fn()} labels={EFFECT_PRESET_PICKER_LABELS_AR} />);
    expect(screen.getByRole('group', { name: 'مؤثرات جاهزة' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'زجاجي' })).toBeInTheDocument();
  });
});
