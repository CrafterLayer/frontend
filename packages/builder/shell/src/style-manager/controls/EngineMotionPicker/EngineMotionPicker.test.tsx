import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  engineMotionAttributePatch,
  engineMotionOfAttributes,
  engineMotionOfSpec,
  engineMotionPartPatch,
  engineRecipesFor,
  isSceneHostTag,
  specWithEngineMotion,
} from './engine-motion';
import { EngineMotionPicker } from './EngineMotionPicker';
import { ENGINE_MOTION_PICKER_LABELS_AR } from './EngineMotionPicker.labels';

afterEach(cleanup);

const recipeGroup = () => screen.getByRole('group', { name: 'Cinematic motion' });

describe('EngineMotionPicker', () => {
  it('shows None and each offered recipe with its name and description; the stored one is pressed', () => {
    render(<EngineMotionPicker value={{ timeline: 'fade-in' }} recipes={engineRecipesFor('text')} onChange={vi.fn()} />);
    const cards = Array.from(recipeGroup().querySelectorAll('button'));
    expect(cards.map((card) => card.getAttribute('data-value'))).toEqual(['none', 'fade-in', 'slide-in', 'split-reveal']);
    const fade = screen.getByRole('button', { name: 'Fade in' });
    expect(fade).toHaveAttribute('aria-pressed', 'true');
    expect(fade).toHaveAccessibleDescription('The element fades in and rises slightly as it enters');
    expect(screen.getByRole('button', { name: 'None' })).toHaveAttribute('aria-pressed', 'false');
    // No Animated background unless asked.
    expect(screen.queryByRole('group', { name: 'Animated background' })).toBeNull();
  });

  it('choosing a recipe, how it plays and None are each ONE labelled change of the whole value', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(<EngineMotionPicker value={{}} onChange={onChange} />);
    // Nothing chosen: no Plays row yet.
    expect(screen.queryByRole('radiogroup', { name: 'Plays' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Slide in' }));
    expect(onChange).toHaveBeenLastCalledWith({ timeline: 'slide-in' }, 'Cinematic motion');
    rerender(<EngineMotionPicker value={{ timeline: 'slide-in' }} onChange={onChange} />);
    await user.click(screen.getByRole('radio', { name: 'With scroll' }));
    expect(onChange).toHaveBeenLastCalledWith({ timeline: 'slide-in', scrub: true }, 'Cinematic motion');
    rerender(<EngineMotionPicker value={{ timeline: 'slide-in', scrub: true }} onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: 'None' }));
    expect(onChange).toHaveBeenLastCalledWith({}, 'Cinematic motion');
    // The pressed card is not a second write.
    await user.click(screen.getByRole('button', { name: 'Slide in' }));
    expect(onChange).toHaveBeenCalledTimes(3);
  });

  it('scene cards (hosted scenes only), then density and colours, label "Animated background"', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(<EngineMotionPicker value={{}} recipes={[]} scenes onChange={onChange} />);
    expect(screen.queryByRole('group', { name: 'Cinematic motion' })).toBeNull();
    const scenes = screen.getByRole('group', { name: 'Animated background' });
    expect(Array.from(scenes.querySelectorAll('button')).map((card) => card.getAttribute('data-value'))).toEqual([
      'none',
      'particles',
      'mesh-gradient',
    ]);
    await user.click(screen.getByRole('button', { name: 'Particles' }));
    expect(onChange).toHaveBeenLastCalledWith({ scene: 'particles' }, 'Animated background');
    rerender(<EngineMotionPicker value={{ scene: 'particles' }} recipes={[]} scenes onChange={onChange} />);
    await user.click(screen.getByRole('radio', { name: 'High' }));
    expect(onChange).toHaveBeenLastCalledWith({ scene: 'particles', density: 'high' }, 'Animated background');
    await user.click(screen.getByRole('radio', { name: 'Mono' }));
    expect(onChange).toHaveBeenLastCalledWith({ scene: 'particles', palette: 'mono' }, 'Animated background');
    rerender(
      <EngineMotionPicker value={{ scene: 'particles', density: 'high' }} recipes={[]} scenes onChange={onChange} />,
    );
    await user.click(screen.getAllByRole('button', { name: 'None' })[0]!);
    expect(onChange).toHaveBeenLastCalledWith({}, 'Animated background');
  });

  it('one tab stop; arrows move focus (mirrored in RTL) without writing; Enter chooses — in Arabic', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <EngineMotionPicker
        value={{}}
        recipes={engineRecipesFor('text')}
        dir="rtl"
        labels={ENGINE_MOTION_PICKER_LABELS_AR}
        onChange={onChange}
      />,
    );
    const group = screen.getByRole('group', { name: 'حركة سينمائية' });
    const cards = Array.from(group.querySelectorAll('button'));
    expect(cards.filter((card) => card.tabIndex === 0)).toHaveLength(1);
    cards[0]!.focus();
    // RTL: ArrowLeft is FORWARD.
    await user.keyboard('{ArrowLeft}');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'ظهور تدريجي' }));
    await user.keyboard('{End}');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'كشف الكلمات' }));
    expect(onChange).not.toHaveBeenCalled();
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledWith({ timeline: 'split-reveal' }, 'حركة سينمائية');
  });

  it('a stored recipe outside the offered list is still shown, pressed', () => {
    render(<EngineMotionPicker value={{ timeline: 'pin-sequence' }} recipes={engineRecipesFor('text')} onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Pinned steps' })).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('engine motion helpers', () => {
  it('narrows recipes per kind; containers drop the marquee recipe unless they are one', () => {
    expect(engineRecipesFor('text')).toEqual(['fade-in', 'slide-in', 'split-reveal']);
    expect(engineRecipesFor('media')).toEqual(['fade-in', 'slide-in', 'scrub-scale', 'parallax-depth']);
    expect(engineRecipesFor('container')).not.toContain('velocity-marquee');
    expect(engineRecipesFor('container', { marquee: true })).toContain('velocity-marquee');
    expect(engineRecipesFor('icon')).toEqual([]);
    expect(isSceneHostTag('section')).toBe(true);
    expect(isSceneHostTag('div')).toBe(true);
    expect(isSceneHostTag('h2')).toBe(false);
  });

  it('a tree patch: a recipe removes the CSS preset; clearing a scene takes its params; nothing changed ⇒ {}', () => {
    const attrs = { 'data-ck-motion': 'fade-up', 'data-ck-trigger': 'view' };
    expect(engineMotionAttributePatch(attrs, { timeline: 'fade-in' })).toMatchObject({
      'data-ck-timeline': 'fade-in',
      'data-ck-scrub': null,
      'data-ck-motion': null,
      'data-ck-trigger': null,
    });
    const scened = { 'data-ck-scene': 'particles', 'data-ck-density': 'high' };
    expect(engineMotionOfAttributes(scened)).toEqual({ scene: 'particles', density: 'high' });
    expect(engineMotionAttributePatch(scened, {})).toEqual({
      'data-ck-scene': null,
      'data-ck-density': null,
      'data-ck-palette': null,
    });
    expect(engineMotionAttributePatch(scened, { scene: 'particles', density: 'high' })).toEqual({});
    // An image scene layer is not a hosted scene: the picker leaves it alone.
    expect(engineMotionAttributePatch({ 'data-ck-scene': 'mural' }, {})).toEqual({});
    expect(engineMotionPartPatch({ timeline: 'slide-in', scrub: false })).toEqual({
      'data-ck-timeline': 'slide-in',
      'data-ck-scrub': 'false',
    });
    expect(engineMotionPartPatch({})).toEqual({ 'data-ck-timeline': null, 'data-ck-scrub': null });
  });

  it('a section spec merges; a new recipe drops reveal; clearing removes the keys', () => {
    const spec = { reveal: 'fade-up', duration: 'slow' } as const;
    const withRecipe = specWithEngineMotion(spec, { timeline: 'stagger-in', scrub: true });
    expect(withRecipe).toEqual({ duration: 'slow', timeline: 'stagger-in', scrub: true });
    const withScene = specWithEngineMotion(withRecipe, { ...engineMotionOfSpec(withRecipe), scene: 'mesh-gradient', palette: 'accent' });
    expect(withScene).toEqual({
      duration: 'slow',
      timeline: 'stagger-in',
      scrub: true,
      scene: 'mesh-gradient',
      scenePalette: 'accent',
    });
    expect(specWithEngineMotion(withScene, {})).toEqual({ duration: 'slow' });
  });
});
