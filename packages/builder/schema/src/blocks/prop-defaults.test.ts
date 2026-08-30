import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { blockPropDefaults, withBlockPropDefaults } from './prop-defaults';

describe('blockPropDefaults', () => {
  it('collects the defaults a props object declares', () => {
    const props = z.object({
      heading: z.string().default('Your headline'),
      tone: z.enum(['light', 'dark']).default('light'),
      spacing: z.enum(['sm', 'lg']).default('lg'),
    });

    expect(blockPropDefaults(props)).toEqual({
      heading: 'Your headline',
      tone: 'light',
      spacing: 'lg',
    });
  });

  it('reports nothing for props that declare no default', () => {
    const props = z.object({ eyebrow: z.string().optional(), body: z.string() });

    expect(blockPropDefaults(props)).toEqual({});
  });

  /*
    Both orderings are things a schema author writes, and only one of them puts
    the default on the outside. Peeling is what makes the two behave alike.
  */
  it('finds a default wrapped in optional, in either order', () => {
    expect(blockPropDefaults(z.object({ a: z.string().default('x').optional() }))).toEqual({
      a: 'x',
    });
    expect(blockPropDefaults(z.object({ b: z.string().optional().default('y') }))).toEqual({
      b: 'y',
    });
  });

  it('returns nothing for a schema that is not an object', () => {
    expect(blockPropDefaults(z.string().default('x'))).toEqual({});
  });

  it('carries non-string defaults through unchanged', () => {
    const props = z.object({ columns: z.number().default(3), wrap: z.boolean().default(false) });

    expect(blockPropDefaults(props)).toEqual({ columns: 3, wrap: false });
  });
});

describe('withBlockPropDefaults', () => {
  const defaults = { tone: 'light', spacing: 'lg', width: 'full' };

  it('fills only the keys a document omits', () => {
    expect(withBlockPropDefaults({ tone: 'dark' }, defaults)).toEqual({
      tone: 'dark',
      spacing: 'lg',
      width: 'full',
    });
  });

  /*
    The rule this whole module turns on. A repair to a rendering bug must not
    become a licence to rewrite values a person actually stored.
  */
  it('never overwrites a value the document holds', () => {
    const stored = { tone: 'dark', spacing: 'sm', width: 'narrow' };

    expect(withBlockPropDefaults(stored, defaults)).toEqual(stored);
  });

  /*
    `null` is a stored decision, not an absence. Treating it as missing would
    quietly replace a deliberate null with a default.
  */
  it('treats a stored null as a value, not as a gap', () => {
    const filled = withBlockPropDefaults({ tone: null }, defaults);

    expect(filled.tone).toBeNull();
  });

  /*
    Identity matters: the render path memoizes on props, so returning a fresh
    object for an already-complete node would look like a change on every
    render.
  */
  it('returns the original object when nothing is missing', () => {
    const stored = { tone: 'dark', spacing: 'sm', width: 'full' };

    expect(withBlockPropDefaults(stored, defaults)).toBe(stored);
  });

  it('returns the original object when the schema declares no defaults', () => {
    const stored = { tone: 'dark' };

    expect(withBlockPropDefaults(stored, {})).toBe(stored);
  });

  /*
    The exact defect this was written for, reproduced from the playground's own
    landing document: a hero that sets tone and align but not spacing or width
    rendered `mkt-section--spacing-undefined` and had 0px block padding.
  */
  it('repairs the hero shape that produced spacing-undefined in the browser', () => {
    const heroProps = z.object({
      heading: z.string().default('Your headline'),
      align: z.enum(['start', 'center']).default('center'),
      tone: z.enum(['light', 'dark']).default('light'),
      spacing: z.enum(['sm', 'md', 'lg']).default('lg'),
      width: z.enum(['narrow', 'full']).default('full'),
    });
    /*
      Typed as an open record on purpose: the whole point is that keys ABSENT
      from the stored object appear afterwards, and a narrow inferred type would
      make the assertions below unreachable rather than true.
    */
    const stored: Record<string, unknown> = {
      tone: 'dark',
      align: 'center',
      heading: 'Build pages your kernel can prove',
    };

    const filled = withBlockPropDefaults(stored, blockPropDefaults(heroProps));

    expect(filled['spacing']).toBe('lg');
    expect(filled['width']).toBe('full');
    expect(filled['tone']).toBe('dark');
    expect(Object.values(filled)).not.toContain(undefined);
  });
});

describe('blockPropDefaults caching', () => {
  /*
    This runs on the render path for every node on every frame, so walking the
    schema shape each time is pure waste. Identity is asserted rather than
    equality: only the same OBJECT proves the walk was skipped.
  */
  it('returns the same object for the same schema', () => {
    const props = z.object({ tone: z.enum(['light', 'dark']).default('light') });

    expect(blockPropDefaults(props)).toBe(blockPropDefaults(props));
  });

  it('gives a different schema object its own entry', () => {
    const a = z.object({ tone: z.enum(['light', 'dark']).default('light') });
    const b = z.object({ tone: z.enum(['light', 'dark']).default('dark') });

    expect(blockPropDefaults(a)).not.toBe(blockPropDefaults(b));
    expect(blockPropDefaults(b)).toEqual({ tone: 'dark' });
  });

  it('hands back a frozen result, so a caller cannot poison the cache', () => {
    const defaults = blockPropDefaults(z.object({ tone: z.string().default('light') }));

    expect(Object.isFrozen(defaults)).toBe(true);
  });
});
