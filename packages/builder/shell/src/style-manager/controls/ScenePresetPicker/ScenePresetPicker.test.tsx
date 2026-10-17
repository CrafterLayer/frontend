import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ScenePresetPicker } from './ScenePresetPicker';
import { SCENE_PRESET_PICKER_LABELS_AR } from './ScenePresetPicker.labels';

afterEach(cleanup);

const PARTICLES = { 'data-ck-scene': 'particles', 'data-ck-density': 'medium', 'data-ck-palette': 'theme' };

describe('ScenePresetPicker', () => {
  it('lists every scene with its name and one-line description; the current one is checked', () => {
    render(<ScenePresetPicker attributes={PARTICLES} imageCount={1} onCommit={vi.fn()} />);
    const scenes = screen.getAllByRole('radio').filter((radio) => radio.closest('[aria-label="Scene"]') !== null);
    expect(scenes).toHaveLength(5);
    expect(screen.getByRole('radio', { name: /Particles/u })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: /Mural/u })).toHaveTextContent('slowly panning wall');
  });

  it('each change is ONE labelled commit of a closed value', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<ScenePresetPicker attributes={PARTICLES} imageCount={2} onCommit={onCommit} />);
    await user.click(screen.getByRole('radio', { name: /Mural/u }));
    expect(onCommit).toHaveBeenLastCalledWith({ 'data-ck-scene': 'mural' }, 'Animated background');
    await user.click(screen.getByRole('radio', { name: 'High' }));
    expect(onCommit).toHaveBeenLastCalledWith({ 'data-ck-density': 'high' }, 'Animated background');
    await user.click(screen.getByRole('radio', { name: 'Mono' }));
    expect(onCommit).toHaveBeenLastCalledWith({ 'data-ck-palette': 'mono' }, 'Animated background');
    // The checked scene is not a second write.
    await user.click(screen.getByRole('radio', { name: /Particles/u }));
    expect(onCommit).toHaveBeenCalledTimes(3);
  });

  it('a scene that draws from images refuses, and says why, when the layer holds none', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<ScenePresetPicker attributes={PARTICLES} imageCount={0} onCommit={onCommit} />);
    const mural = screen.getByRole('radio', { name: /Mural/u });
    expect(mural).toHaveAttribute('aria-disabled', 'true');
    expect(mural).toHaveAccessibleDescription('Needs at least one image inside the layer');
    await user.click(mural);
    expect(onCommit).not.toHaveBeenCalled();
    await user.click(screen.getByRole('radio', { name: /Mesh gradient/u }));
    expect(onCommit).toHaveBeenCalledWith({ 'data-ck-scene': 'mesh-gradient' }, 'Animated background');
  });

  it('arrow keys rove the scene cards with focus, mirrored in RTL, in Arabic', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(
      <ScenePresetPicker
        attributes={PARTICLES}
        imageCount={1}
        onCommit={onCommit}
        dir="rtl"
        labels={SCENE_PRESET_PICKER_LABELS_AR}
      />,
    );
    expect(screen.getByRole('group', { name: 'خلفية متحركة' })).toHaveAttribute('dir', 'rtl');
    const particles = screen.getByRole('radio', { name: /جزيئات/u });
    expect(particles).toHaveAttribute('tabindex', '0');
    particles.focus();
    // RTL: ArrowLeft moves forward (particles → mesh gradient).
    await user.keyboard('{ArrowLeft}');
    expect(onCommit).toHaveBeenLastCalledWith({ 'data-ck-scene': 'mesh-gradient' }, 'خلفية متحركة');
    expect(screen.getByRole('radio', { name: /تدرج متحرك/u })).toHaveFocus();
    await user.keyboard('{End}');
    expect(onCommit).toHaveBeenLastCalledWith({ 'data-ck-scene': 'ripple' }, 'خلفية متحركة');
  });
});
