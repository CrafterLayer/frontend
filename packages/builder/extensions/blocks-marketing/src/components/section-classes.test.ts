import { describe, expect, it } from 'vitest';

import {
  ALIGN_CLASSES,
  GAP_CLASSES,
  SPACING_CLASSES,
  TEXT_ALIGN_CLASSES,
  TONE_CLASSES,
  WIDTH_CLASSES,
  cx,
  sectionContentClasses,
  sectionShellClasses,
} from './section-classes';
import { sectionAlignments, sectionSpacings, sectionTones, sectionWidths } from './section-options';

describe('cx', () => {
  it('composes and drops falsy values', () => {
    // Read from a variable so the compiler cannot fold the condition away —
    // the point is the RUNTIME behaviour a block relies on.
    const off: boolean = 'a'.length > 99;

    expect(cx('a', off && 'b', undefined, 'c')).toBe('a c');
  });

  /*
    The reason `twMerge` is here rather than plain `clsx`. Without it a block
    that sets its own padding and then receives an override emits both classes
    and lets stylesheet order decide — the bug where a prop appears to do
    nothing at all.
  */
  it('lets a later utility win a conflict instead of emitting both', () => {
    expect(cx('py-section-lg', 'py-section-sm')).toBe('py-section-sm');
    expect(cx('bg-surface', 'bg-surface-inverse')).toBe('bg-surface-inverse');
  });

  it('keeps utilities that do not conflict', () => {
    expect(cx('py-section-lg', 'px-gutter')).toBe('py-section-lg px-gutter');
  });
});

describe('the vocabulary maps', () => {
  /*
    Exhaustiveness, checked at runtime as well as by the type. A value added to
    `section-options.ts` without a class here would render as nothing at all —
    which looks like a styling bug, not a missing mapping.
  */
  it('covers every value the shared vocabularies declare', () => {
    expect(Object.keys(TONE_CLASSES).sort()).toEqual([...sectionTones].sort());
    expect(Object.keys(SPACING_CLASSES).sort()).toEqual([...sectionSpacings].sort());
    expect(Object.keys(GAP_CLASSES).sort()).toEqual([...sectionSpacings].sort());
    expect(Object.keys(WIDTH_CLASSES).sort()).toEqual([...sectionWidths].sort());
    expect(Object.keys(ALIGN_CLASSES).sort()).toEqual([...sectionAlignments].sort());
    expect(Object.keys(TEXT_ALIGN_CLASSES).sort()).toEqual([...sectionAlignments].sort());
  });

  /*
    THE law, corrected. Every utility here must resolve through a token, so
    re-pointing that token still moves every page.

    A raw palette class like `bg-blue-500` is a literal with no token behind it
    and no binding can give it one. An arbitrary value like `p-[17px]` is a
    length wearing brackets. Both are banned.

    The numeric scale is NOT: see the note below.
  */
  it('names no raw palette colour and no arbitrary value', () => {
    const every = [
      ...Object.values(TONE_CLASSES),
      ...Object.values(SPACING_CLASSES),
      ...Object.values(GAP_CLASSES),
      ...Object.values(WIDTH_CLASSES),
    ]
      .join(' ')
      .split(' ');

    for (const utility of every) {
      // Tailwind's default palette: bg-blue-500, text-gray-700, and friends.
      expect(utility, utility).not.toMatch(
        /-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}$/,
      );
      /*
        Tailwind's NUMERIC scale is deliberately allowed.

        An earlier version of this test banned `p-4` alongside `bg-blue-500`,
        which was wrong. In Tailwind v4 the numeric scale multiplies
        `--spacing`, and the bridge binds that to `--t-space-unit` — so `p-4`
        compiles to `calc(var(--t-space-unit) * 4)`. It is FOUR STEPS of the
        site's own rhythm, not sixteen pixels, and it is exactly the shape the
        intent-only law already permits: `style-values.ts` refuses `'16px'` and
        accepts `4`.

        Banning it forced a named token for every internal gap a block needs,
        including the ones that are not design-system decisions at all.
      */
      // An arbitrary value is a literal wearing brackets.
      expect(utility, utility).not.toMatch(/\[/);
    }
  });

  /*
    Tone is a PAIR. A section that set its ground without its ink inherits
    whatever the page had, and the combination nobody checks is dark-on-dark.
  */
  it('pairs every ground with the ink that reads on it', () => {
    for (const [tone, classes] of Object.entries(TONE_CLASSES)) {
      expect(classes, tone).toMatch(/\btext-/);
      expect(classes, tone).toMatch(/\b(bg-|bg-transparent)/);
    }
  });

  /*
    An Arabic page aligned left is aligned to the wrong edge. Logical
    properties are what let one stylesheet serve both directions.
  */
  it('aligns text logically, never to a physical side', () => {
    const values = Object.values(TEXT_ALIGN_CLASSES).join(' ');

    expect(values).not.toMatch(/text-(left|right)\b/);
    expect(values).toMatch(/text-start/);
    expect(values).toMatch(/text-end/);
  });

  /*
    `full` means edge to edge. A very large fixed width looks correct until
    someone opens the page on a wider screen.
  */
  it('treats full width as no limit rather than a large one', () => {
    expect(WIDTH_CLASSES.full).toBe('max-w-none');
  });
});

describe('sectionShellClasses', () => {
  it('carries the ground, the rhythm, and a stated box model', () => {
    const classes = sectionShellClasses('dark', 'lg');

    expect(classes).toContain('bg-surface-inverse');
    expect(classes).toContain('text-text-inverse');
    expect(classes).toContain('py-section-lg');
    /*
      Stated rather than assumed: Tailwind's preflight sets it globally, but a
      block rendered into a host that resets differently would add its padding
      to its width, and the failure reads as an untraceable horizontal
      scrollbar.
    */
    expect(classes).toContain('box-border');
  });

  it('produces a class for every tone and spacing combination', () => {
    for (const tone of sectionTones) {
      for (const spacing of sectionSpacings) {
        expect(sectionShellClasses(tone, spacing).length, `${tone}/${spacing}`).toBeGreaterThan(0);
      }
    }
  });
});

describe('sectionContentClasses', () => {
  it('centres a bounded column with room at the page edge', () => {
    const classes = sectionContentClasses('standard');

    expect(classes).toContain('mx-auto');
    expect(classes).toContain('max-w-content-standard');
    // Without this, text meets the glass on a phone.
    expect(classes).toContain('px-gutter');
  });

  /*
    A flex or grid child that can shrink below its content is how a long word
    or a wide table produces a horizontal scrollbar on the whole page.
  */
  it('lets the column shrink below its content rather than overflowing the page', () => {
    expect(sectionContentClasses('wide')).toContain('min-w-0');
  });

  it('applies text alignment only when the section asked for it', () => {
    expect(sectionContentClasses('narrow')).not.toMatch(/text-(start|center|end)/);
    expect(sectionContentClasses('narrow', 'center')).toContain('text-center');
  });
});
