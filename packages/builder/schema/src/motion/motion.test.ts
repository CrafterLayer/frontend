import { describe, expect, it } from 'vitest';

import { findRawStyleLiterals } from '../blocks/style-values';
import {
  MOTION_DURATIONS,
  MOTION_PROP,
  REVEAL_EFFECTS,
  SCROLL_EFFECTS,
  type MotionSpec,
} from './types';
import { validateDocumentMotion, validateMotionSpec } from './validate';

const node = (props: Record<string, unknown>, responsive?: Record<string, unknown>) => ({
  hero: {
    props: props as never,
    ...(responsive === undefined ? {} : { responsive: responsive as never }),
  },
});

describe('motion vocabulary', () => {
  it('accepts a complete, in-vocabulary spec', () => {
    const spec: MotionSpec = {
      reveal: 'fade-up',
      scroll: 'parallax-slow',
      duration: 'normal',
      delay: 'short',
      easing: 'spring',
      stagger: 'tight',
      repeat: false,
    };

    expect(validateMotionSpec(spec)).toEqual({ ok: true, spec });
  });

  it('treats every field as optional, so silence means still', () => {
    expect(validateMotionSpec({})).toEqual({ ok: true, spec: {} });
  });

  /*
    The point of a closed union. A model inventing "slide-in-from-the-left"
    must fail the door rather than produce a section that silently never moves.
  */
  it('refuses an effect the vocabulary does not contain', () => {
    const result = validateMotionSpec({ reveal: 'slide-in-from-the-left' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0]?.code).toBe('invalid-motion-spec');
    }
  });

  it('refuses an unknown field rather than ignoring it', () => {
    expect(validateMotionSpec({ bounceHeight: 4 }).ok).toBe(false);
  });

  /*
    The law this vocabulary exists to keep. A raw millisecond count is a
    literal in exactly the way `padding: '16px'` is, and it would make motion
    the one part of the design system a theme edit could not move.
  */
  it('refuses a raw duration, because a number of milliseconds is a literal', () => {
    expect(validateMotionSpec({ duration: 300 }).ok).toBe(false);
    expect(validateMotionSpec({ duration: '300ms' }).ok).toBe(false);
  });

  it('names durations as steps, never as times', () => {
    for (const duration of MOTION_DURATIONS) {
      expect(duration).not.toMatch(/\d/);
      expect(validateMotionSpec({ duration }).ok).toBe(true);
    }
  });

  it('keeps every vocabulary member free of style literals', () => {
    const vocabulary = [...REVEAL_EFFECTS, ...SCROLL_EFFECTS, ...MOTION_DURATIONS];

    expect(findRawStyleLiterals(vocabulary as unknown as never)).toEqual([]);
  });

  it('offers "none" everywhere motion can be switched off', () => {
    expect(REVEAL_EFFECTS).toContain('none');
    expect(SCROLL_EFFECTS).toContain('none');
  });
});

describe('document-wide motion validation', () => {
  it('reports nothing for a document with no motion at all', () => {
    expect(validateDocumentMotion(node({ heading: 'Hello' }))).toEqual([]);
  });

  it('reports an invalid base motion prop against its node', () => {
    const issues = validateDocumentMotion(node({ [MOTION_PROP]: { reveal: 'nope' } }));

    expect(issues).toHaveLength(1);
    expect(issues[0]?.nodeId).toBe('hero');
  });

  /*
    Animating on a wide screen and staying still on a phone is a legitimate
    responsive choice, so motion is a real per-breakpoint override — and an
    override the validator skipped would be an unchecked door into the document.
  */
  it('validates motion inside a per-breakpoint override', () => {
    const issues = validateDocumentMotion(
      node({}, { mobile: { [MOTION_PROP]: { scroll: 'teleport' } } }),
    );

    expect(issues).toHaveLength(1);
    expect(issues[0]?.path.slice(0, 3)).toEqual(['responsive', 'mobile', MOTION_PROP]);
  });

  it('accepts a valid per-breakpoint override', () => {
    expect(
      validateDocumentMotion(node({}, { mobile: { [MOTION_PROP]: { reveal: 'none' } } })),
    ).toEqual([]);
  });
});
