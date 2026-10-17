import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MotionPresetGrid } from './MotionPresetGrid';
import { presetsForTrigger } from './presets-for-trigger';
import { MOTION_PRESET_GRID_LABELS_AR } from './MotionPresetGrid.labels';

afterEach(cleanup);

describe('MotionPresetGrid', () => {
  it('filters presets by trigger: scroll-linked presets only play on view or scroll', () => {
    expect(presetsForTrigger('scroll')).toContain('parallax-slow');
    expect(presetsForTrigger('scroll')).not.toContain('fade-up');
    expect(presetsForTrigger('click')).not.toContain('pin');
    render(<MotionPresetGrid kind="motion" trigger="load" value={undefined} onSelect={vi.fn()} />);
    expect(screen.getByRole('radio', { name: 'Fade up' })).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'Parallax (slow)' })).not.toBeInTheDocument();
  });

  it('picks a preset, and None removes the animation', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<MotionPresetGrid kind="motion" trigger="view" value="fade" onSelect={onSelect} />);
    expect(screen.getByRole('radio', { name: 'Fade' })).toHaveAttribute('aria-checked', 'true');
    await user.click(screen.getByRole('radio', { name: 'Zoom in' }));
    expect(onSelect).toHaveBeenLastCalledWith('zoom-in');
    await user.click(screen.getByRole('radio', { name: 'None' }));
    expect(onSelect).toHaveBeenLastCalledWith(null);
  });

  it('lists hover presets and moves with the arrows', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<MotionPresetGrid kind="hover" value="lift" onSelect={onSelect} />);
    screen.getByRole('radio', { name: 'Lift' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(onSelect).toHaveBeenCalledWith('glow');
  });

  it('labels in Arabic', () => {
    render(
      <MotionPresetGrid
        kind="hover"
        value={undefined}
        onSelect={vi.fn()}
        dir="rtl"
        labels={MOTION_PRESET_GRID_LABELS_AR}
      />,
    );
    expect(screen.getByRole('radiogroup', { name: 'تأثير التمرير' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'ارتفاع' })).toBeInTheDocument();
  });
});
