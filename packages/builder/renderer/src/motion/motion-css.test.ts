/*
  @vitest-environment node

  Reads and writes a generated file and touches no DOM. Under the package's
  default jsdom environment `import.meta.url` is an http URL and
  fileURLToPath rejects it.
*/
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { MOTION_DURATIONS, REVEAL_EFFECTS, SCROLL_EFFECTS } from '@craftkit/builder-schema';
import { MOTION_CLASS, buildMotionCss, motionAttributes } from './motion-css';

const CHECKED_IN_CSS = fileURLToPath(new URL('./motion.css', import.meta.url));

describe('motion stylesheet', () => {
  it('has a rule for every reveal effect except none', () => {
    const css = buildMotionCss();

    for (const effect of REVEAL_EFFECTS) {
      if (effect === 'none') {
        continue;
      }
      expect(css).toContain(`[data-reveal='${effect}']`);
    }
  });

  /*
    `pin` is deliberately absent: CSS cannot hold a section in place while the
    page scrolls past it, so it belongs to the contained engine. Asserting the
    absence keeps a future edit from adding a `pin` rule that silently does
    nothing, which is worse than an effect that visibly needs the extension.
  */
  it('covers every scroll effect CSS can express, and omits pin', () => {
    const css = buildMotionCss();

    for (const effect of SCROLL_EFFECTS) {
      if (effect === 'none' || effect === 'pin') {
        continue;
      }
      expect(css).toContain(`[data-scroll='${effect}']`);
    }
    expect(css).not.toContain(`[data-scroll='pin']`);
  });

  it('drives every effect from a scroll timeline rather than JavaScript', () => {
    expect(buildMotionCss()).toContain('animation-timeline: view()');
  });

  it('turns motion completely off under a reduced-motion preference', () => {
    const css = buildMotionCss();

    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain('animation: none !important');
    /*
      The failure this guards against: fill-mode leaves an element at its
      start frame, so removing the animation without restoring opacity turns
      an accessibility preference into a blank page.
    */
    expect(css).toContain('opacity: 1 !important');
  });

  it('leaves content visible where scroll timelines are unsupported', () => {
    expect(buildMotionCss()).toContain('@supports not (animation-timeline: view())');
  });

  it('names a duration for every step in the vocabulary', () => {
    const css = buildMotionCss();

    for (const duration of MOTION_DURATIONS) {
      expect(css).toContain(`[data-duration='${duration}']`);
    }
  });

  it('holds the checked-in stylesheet equal to its generator', () => {
    // Regenerate with:
    //   UPDATE_MOTION_CSS=1 pnpm --filter @craftkit/builder-renderer test
    const expected = buildMotionCss();
    if (process.env['UPDATE_MOTION_CSS'] === '1') {
      writeFileSync(CHECKED_IN_CSS, expected, 'utf8');
    }

    expect(readFileSync(CHECKED_IN_CSS, 'utf8')).toBe(expected);
  });
});

describe('motion attributes', () => {
  it('emits nothing at all for a node with no motion', () => {
    expect(motionAttributes(undefined)).toEqual({});
    expect(motionAttributes({})).toEqual({});
  });

  /*
    "none" is how a person switches motion off, and it has to leave no trace:
    an element still carrying the motion class would keep the reduced-motion
    and fallback rules pointed at it for no reason.
  */
  it('treats an explicit none as no motion at all', () => {
    expect(motionAttributes({ reveal: 'none', scroll: 'none' })).toEqual({});
  });

  it('carries the class and the chosen steps as attributes, never as inline style', () => {
    const attributes = motionAttributes({ reveal: 'fade-up', duration: 'slow', easing: 'spring' });

    expect(attributes).toEqual({
      class: MOTION_CLASS,
      'data-reveal': 'fade-up',
      'data-duration': 'slow',
      'data-easing': 'spring',
    });
    expect(JSON.stringify(attributes)).not.toMatch(/\d+ms/);
  });

  it('marks a repeating reveal only when it is asked for', () => {
    expect(motionAttributes({ reveal: 'fade', repeat: true })['data-motion-repeat']).toBe('true');
    expect(motionAttributes({ reveal: 'fade' })['data-motion-repeat']).toBeUndefined();
    expect(
      motionAttributes({ reveal: 'fade', repeat: false })['data-motion-repeat'],
    ).toBeUndefined();
  });
});
