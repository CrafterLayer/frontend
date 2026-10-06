import { describe, expect, it } from 'vitest';

import {
  CUSTOM_CODE_ATTRIBUTES,
  customCodeAttributeProblem,
  customCodeTreeProblems,
  customCodeTreeSchema,
  type CustomCodeNode,
} from './custom-code-tree';
import {
  CUSTOM_CODE_EFFECTS,
  customCodeEffectClass,
  customCodeEffectOfClass,
  isCustomCodeEffect,
} from './effects-vocabulary';
import {
  CUSTOM_CODE_HOVER_PRESETS,
  CUSTOM_CODE_MOTION_ATTRIBUTES,
  CUSTOM_CODE_MOTION_EASES,
  CUSTOM_CODE_MOTION_PRESETS,
  CUSTOM_CODE_MOTION_TRIGGERS,
  CUSTOM_CODE_MOTION_TRIGGER_TABLE,
  isHoverPreset,
  isMotionPreset,
  motionPresetGroup,
  motionTriggerProblem,
  motionTriggersFor,
} from './motion-vocabulary';
import { isCustomHookClass } from './utility-vocabulary';

const root = (...children: CustomCodeNode[]) => ({ kind: 'root' as const, children });
const el = (tag: string, attributes: Record<string, string> = {}, children: unknown[] = []) =>
  ({ kind: 'element', tag, attributes, children }) as unknown as CustomCodeNode;
const messages = (tree: unknown) => customCodeTreeProblems(tree).map((problem) => problem.message);

describe('the motion vocabulary (DESIGN §B.2)', () => {
  it('holds the exact preset, hover, trigger and ease lists', () => {
    expect(CUSTOM_CODE_MOTION_PRESETS).toHaveLength(41);
    expect(CUSTOM_CODE_MOTION_PRESETS.slice(0, 3)).toEqual(['fade', 'fade-up', 'fade-down']);
    expect(CUSTOM_CODE_MOTION_PRESETS.at(-1)).toBe('draw-line');
    expect(new Set(CUSTOM_CODE_MOTION_PRESETS).size).toBe(CUSTOM_CODE_MOTION_PRESETS.length);
    expect(CUSTOM_CODE_HOVER_PRESETS).toEqual([
      'lift',
      'glow',
      'scale',
      'tilt',
      'magnetic',
      'shine-sweep',
      'underline-grow',
      'image-zoom',
      'border-beam',
      'icon-nudge',
    ]);
    expect(CUSTOM_CODE_MOTION_TRIGGERS).toEqual(['view', 'load', 'hover', 'click', 'scroll']);
    expect(CUSTOM_CODE_MOTION_EASES).toEqual([
      'standard',
      'emphasized',
      'spring',
      'bounce',
      'linear',
    ]);
    expect(isMotionPreset('fade-up')).toBe(true);
    expect(isMotionPreset('lift')).toBe(false);
    expect(isHoverPreset('lift')).toBe(true);
    expect(isHoverPreset('fade-up')).toBe(false);
  });

  it('every motion attribute is admitted by the door', () => {
    for (const name of CUSTOM_CODE_MOTION_ATTRIBUTES)
      expect(CUSTOM_CODE_ATTRIBUTES).toContain(name);
    expect(CUSTOM_CODE_ATTRIBUTES).toContain('data-ck-speed');
  });

  it('the compatibility table: scroll presets need view or scroll, text plays on view, load or click', () => {
    expect(motionPresetGroup('parallax-slow')).toBe('scroll');
    expect(motionPresetGroup('split-words')).toBe('text');
    expect(motionTriggersFor('pin')).toEqual(CUSTOM_CODE_MOTION_TRIGGER_TABLE.scroll);
    expect(motionTriggerProblem('parallax-slow', 'scroll')).toBeUndefined();
    expect(motionTriggerProblem('parallax-slow', 'view')).toBeUndefined();
    expect(motionTriggerProblem('parallax-slow', 'click')).toMatch(
      /scroll preset and plays on view or scroll/u,
    );
    expect(motionTriggerProblem('typewriter', 'click')).toBeUndefined();
    expect(motionTriggerProblem('typewriter', 'scroll')).toEqual(expect.any(String));
    expect(motionTriggerProblem('fade-up', 'hover')).toBeUndefined();
    expect(motionTriggersFor('nope')).toEqual([]);
  });
});

describe('motion attributes at the door', () => {
  it('admits closed enum values and refuses everything else', () => {
    expect(customCodeAttributeProblem('h1', 'data-ck-motion', 'fade-up')).toBeUndefined();
    expect(customCodeAttributeProblem('a', 'data-ck-hover', 'underline-grow')).toBeUndefined();
    expect(customCodeAttributeProblem('div', 'data-ck-delay', '6')).toBeUndefined();
    expect(customCodeAttributeProblem('div', 'data-ck-ease', 'spring')).toBeUndefined();
    expect(customCodeAttributeProblem('div', 'data-ck-once', 'false')).toBeUndefined();
    expect(customCodeAttributeProblem('div', 'data-ck-distance', 'lg')).toBeUndefined();
    expect(customCodeAttributeProblem('ul', 'data-ck-stagger', 'sm')).toBeUndefined();
    for (const [name, value] of [
      ['data-ck-motion', 'explode'],
      ['data-ck-motion', 'lift'],
      ['data-ck-hover', 'fade-up'],
      ['data-ck-trigger', 'dblclick'],
      ['data-ck-delay', '7'],
      ['data-ck-delay', '200ms'],
      ['data-ck-ease', 'cubic-bezier(0,0,1,1)'],
      ['data-ck-once', 'yes'],
      ['data-ck-distance', '40px'],
      ['data-ck-target', '#hero'],
    ] as const) {
      expect(customCodeAttributeProblem('div', name, value), `${name}=${value}`).toEqual(
        expect.any(String),
      );
    }
    expect(customCodeAttributeProblem('path', 'data-ck-motion', 'fade')).toEqual(
      expect.any(String),
    );
  });

  it('a param without a preset is refused', () => {
    expect(messages(root(el('h2', { 'data-ck-delay': '2' })))).toEqual([
      '<h2> data-ck-delay tunes an animation: write data-ck-motion or data-ck-hover on the same element, or drop data-ck-delay',
    ]);
    expect(messages(root(el('div', { 'data-ck-speed': 'fast' })))[0]).toMatch(
      /data-ck-speed tunes a behaviour or an animation/u,
    );
    expect(
      messages(root(el('div', { 'data-ck-motion': 'float', 'data-ck-speed': 'slow' }))),
    ).toEqual([]);
    expect(
      messages(root(el('div', { 'data-ck-behavior': 'marquee', 'data-ck-speed': 'slow' }))),
    ).toEqual([]);
    expect(messages(root(el('a', { 'data-ck-hover': 'lift', 'data-ck-ease': 'spring' })))).toEqual(
      [],
    );
  });

  it('a trigger must fit its preset, and a hover preset takes no trigger', () => {
    expect(
      messages(root(el('div', { 'data-ck-motion': 'parallax-slow', 'data-ck-trigger': 'click' }))),
    ).toHaveLength(1);
    expect(
      messages(root(el('div', { 'data-ck-motion': 'parallax-slow', 'data-ck-trigger': 'scroll' }))),
    ).toEqual([]);
    expect(
      messages(root(el('div', { 'data-ck-hover': 'glow', 'data-ck-trigger': 'view' })))[0],
    ).toMatch(/hover preset always plays on hover/u);
  });

  it('data-ck-target must name an id in the same tree, beside a click trigger', () => {
    const play = el('button', {
      'data-ck-motion': 'fade',
      'data-ck-trigger': 'click',
      'data-ck-target': 'panel',
    });
    expect(messages(root(play, el('div', { id: 'panel' })))).toEqual([]);
    expect(customCodeTreeSchema.safeParse(root(play, el('div', { id: 'panel' }))).success).toBe(
      true,
    );
    const missing = customCodeTreeProblems(root(play));
    expect(missing.map((problem) => problem.path)).toEqual([
      ['children', 0, 'attributes', 'data-ck-target'],
    ]);
    expect(missing[0]?.message).toMatch(/names no element in this region/u);
    expect(
      messages(
        root(
          el('button', { 'data-ck-motion': 'fade', 'data-ck-target': 'panel' }),
          el('div', { id: 'panel' }),
        ),
      )[0],
    ).toMatch(/data-ck-trigger='click'/u);
  });
});

describe('the effects library (DESIGN §C.1)', () => {
  it('lists the closed set of effects and their class form', () => {
    expect(CUSTOM_CODE_EFFECTS).toEqual([
      'glass',
      'mesh',
      'noise',
      'grid',
      'dots',
      'retro-grid',
      'spotlight',
      'gradient-border',
      'aurora-bg',
      'text-gradient',
      'ring-glow',
    ]);
    expect(customCodeEffectClass('glass')).toBe('ck-fx-glass');
    expect(customCodeEffectOfClass('ck-fx-retro-grid')).toBe('retro-grid');
    expect(customCodeEffectOfClass('ck-fx-sparkle')).toBeUndefined();
    expect(customCodeEffectOfClass('ck-hero')).toBeUndefined();
    expect(isCustomCodeEffect('mesh')).toBe(true);
  });

  it('the hook-class check refuses an unknown ck-fx- name; other ck- hooks behave as before', () => {
    expect(isCustomHookClass('ck-fx-glass')).toBe(true);
    expect(isCustomHookClass('ck-fx-aurora-bg')).toBe(true);
    expect(isCustomHookClass('ck-fx-sparkle')).toBe(false);
    expect(isCustomHookClass('ck-fx-')).toBe(false);
    expect(isCustomHookClass('ck-hero-glow')).toBe(true);
    expect(isCustomHookClass('ck-s-card')).toBe(true);
    expect(isCustomHookClass('ck-[17px]')).toBe(false);
  });
});
