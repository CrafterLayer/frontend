import { describe, expect, it } from 'vitest';

import {
  CUSTOM_CODE_ENTRANCE_PRESETS,
  CUSTOM_CODE_HOVER_PRESETS,
  CUSTOM_CODE_MOTION_PRESETS,
  CUSTOM_CODE_STAGGER_PRESETS,
} from '@craftkit/builder-schema';

import { declarationsOf, insideKeyframes } from './css-test-utils';
import {
  buildMotionPresetsCss,
  hoverPresetCss,
  INLINE_AXIS_HOVERS,
  INLINE_AXIS_PRESETS,
  motionPresetCss,
  NO_PREFERENCE,
} from './presets-css';

const FULL = buildMotionPresetsCss();
const DECLARATIONS = declarationsOf(FULL);
const MOVING = new Set([
  'animation',
  'animation-name',
  'animation-timeline',
  'animation-play-state',
  'transition',
  'transition-property',
]);

describe('buildMotionPresetsCss', () => {
  it('has a rule for every data-ck-motion and data-ck-hover name in the vocabulary', () => {
    for (const name of CUSTOM_CODE_MOTION_PRESETS)
      expect(FULL, name).toContain(`[data-ck-motion='${name}']`);
    for (const name of CUSTOM_CODE_HOVER_PRESETS)
      expect(FULL, name).toContain(`[data-ck-hover='${name}']`);
  });

  it('puts every animation and transition under prefers-reduced-motion: no-preference', () => {
    const outside = DECLARATIONS.filter(
      (declaration) =>
        MOVING.has(declaration.property) &&
        !insideKeyframes(declaration) &&
        !declaration.ancestors.includes(NO_PREFERENCE),
    );
    expect(outside).toEqual([]);
  });

  it('keeps every entrance, stagger and text start state out of the default: the final state is the default', () => {
    const presets = [
      ...CUSTOM_CODE_ENTRANCE_PRESETS,
      ...CUSTOM_CODE_STAGGER_PRESETS,
      'split-chars',
      'split-words',
      'split-lines',
      'blur-words',
    ];
    const hidden = DECLARATIONS.filter(
      (declaration) =>
        !insideKeyframes(declaration) &&
        !declaration.ancestors.includes(NO_PREFERENCE) &&
        presets.some((name) => declaration.selector.includes(`[data-ck-motion='${name}']`)) &&
        (/^(?:opacity|transform|clip-path|filter|translate|scale)$/u.test(declaration.property) ||
          declaration.value === 'hidden'),
    );
    expect(hidden).toEqual([]);
  });

  it('moves every inline-axis preset by the RTL sign, and flips the sign under :dir(rtl) with a [dir] fallback', () => {
    for (const name of INLINE_AXIS_PRESETS) {
      expect(motionPresetCss(name as (typeof CUSTOM_CODE_MOTION_PRESETS)[number]), name).toContain(
        'var(--ck-inline-sign',
      );
    }
    for (const name of INLINE_AXIS_HOVERS) {
      expect(hoverPresetCss(name as (typeof CUSTOM_CODE_HOVER_PRESETS)[number]), name).toContain(
        'var(--ck-inline-sign',
      );
    }
    expect(FULL).toMatch(
      /:where\(\[data-ck-motion\]:dir\(rtl\), \[data-ck-hover\]:dir\(rtl\)\) \{\n\s+--ck-inline-sign: -1;/u,
    );
    expect(FULL).toContain(":where([dir='rtl'] [data-ck-motion]");
    // fade-start enters from the inline start: negative x in LTR (sign 1), positive in RTL (sign -1).
    expect(motionPresetCss('fade-start')).toContain(
      'translateX(calc(var(--ck-dist) * -1 * var(--ck-inline-sign, 1)))',
    );
    expect(motionPresetCss('fade-end')).toContain(
      'translateX(calc(var(--ck-dist) * var(--ck-inline-sign, 1)))',
    );
  });

  it('scrubs entrances on view() with an IntersectionObserver fallback, and plays on load or data-ck-play', () => {
    const fadeUp = motionPresetCss('fade-up');
    expect(fadeUp).toContain('animation-timeline: view();');
    expect(fadeUp).toContain('[data-ck-inview]');
    expect(fadeUp).toContain("[data-ck-motion='fade-up'][data-ck-trigger='load']");
    expect(fadeUp).toContain("[data-ck-motion='fade-up'][data-ck-play]");
    expect(FULL).toContain('@supports not (animation-timeline: view())');
  });

  it('keeps the canvas still: automatic rules skip [data-ck-still], Preview (data-ck-play) does not', () => {
    const automatic = DECLARATIONS.filter(
      (declaration) =>
        MOVING.has(declaration.property) &&
        !insideKeyframes(declaration) &&
        declaration.selector.includes('[data-ck-motion=') &&
        !declaration.selector.includes('[data-ck-play]') &&
        !declaration.selector.includes('[data-ck-rearm]') &&
        declaration.value !== 'paused' &&
        declaration.value !== 'running',
    );
    expect(automatic.length).toBeGreaterThan(0);
    for (const declaration of automatic) {
      // A rule without the live guard must be one only Preview or a runtime-built node reaches.
      const guarded = declaration.selector.includes(':not([data-ck-still] *)');
      const runtimeOnly = declaration.selector.includes('.ck-tw');
      expect(guarded || runtimeOnly, declaration.selector).toBe(true);
    }
  });

  it('pauses loops longer than 5 s on hover and focus, and not shorter ones', () => {
    expect(motionPresetCss('float')).toMatch(
      /:is\(:hover, :focus-within\):not\(\[data-ck-still\] \*\) \{\n\s+animation-play-state: paused;/u,
    );
    expect(motionPresetCss('orbit')).toContain(':is(:hover, :focus-within)');
    expect(motionPresetCss('pulse')).not.toContain(
      ":not([data-ck-trigger='hover']):is(:hover, :focus-within)",
    );
  });

  it('reads distances, durations and curves from tokens, with spring and bounce as linear() curves', () => {
    expect(FULL).toContain('--ck-dist: var(--t-motion-distance, 24px);');
    expect(FULL).toContain('--ck-dur: var(--ck-dur-fast, 400ms);');
    expect(FULL).toContain('@supports (animation-timing-function: linear(0, 1))');
    expect(FULL).toMatch(/--ck-ease: var\(--ck-ease-spring, linear\(0, [0-9.]+/u);
    expect(FULL).toMatch(/--ck-ease: var\(--ck-ease-bounce, linear\(0, [0-9.]+/u);
    expect(FULL).toContain("[data-ck-delay='6']");
    expect(FULL).toContain('--ck-delay: 480ms;');
  });

  it('emits only the selected presets, and nothing for an empty selection', () => {
    const some = buildMotionPresetsCss({ presets: ['fade-up'], hovers: ['lift'] });
    expect(some).toContain("[data-ck-motion='fade-up']");
    expect(some).toContain("[data-ck-hover='lift']");
    expect(some).not.toContain("[data-ck-motion='fade-down']");
    expect(some).not.toContain('@property --ck-beam-angle');
    expect(buildMotionPresetsCss({ presets: [], hovers: [] })).toBe('');
    expect(buildMotionPresetsCss({ presets: ['not-a-preset'], hovers: [] })).toBe('');
    expect(buildMotionPresetsCss({ presets: [], hovers: ['border-beam'] })).toContain(
      '@property --ck-beam-angle',
    );
  });

  it('sits in @layer components after Tailwind’s layer order, so an element’s own utilities win', () => {
    expect(FULL).toContain('@layer properties, theme, base, components, utilities;');
    expect(FULL).toContain('@layer components {');
  });
});
